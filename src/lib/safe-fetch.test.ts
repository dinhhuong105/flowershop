// Test bộ tải an toàn safe-fetch (Ngày 20, phần C3).
//
// Máy chủ giả local chỉ nghe 127.0.0.1, cổng ngẫu nhiên, hostname
// dùng `localhost` (nằm trong no_proxy của máy này — VM đặt
// NODE_USE_ENV_PROXY=1 + egress proxy, hostname khác sẽ bị đẩy qua
// proxy). Mọi test kết nối thật đều dùng resolve giả trả 127.0.0.1
// + opts.allowLoopbackForTest (CHỈ để test).
// Các ca bị chặn không chạm mạng nên hostname nào cũng được — hàm
// resolve giả phải được dùng thật (quyết định chặn dựa vào IP nó
// trả về).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  safeFetch,
  SafeFetchError,
  isBlockedIp,
  parseIpLiteral,
  parseInetAton,
  imageDimensions,
  HTML_NOT_DATA_MESSAGE,
  MAX_IMAGE_DIMENSION,
  type ResolveFn,
} from "./safe-fetch";

// ------------------------------------------------------------ Hỗ trợ ---

// Máy chủ HTTP giả local (chỉ 127.0.0.1, cổng ngẫu nhiên).
type FakeServer = { port: number; close: () => Promise<void> };

async function startHttp(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<FakeServer> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

// PNG 1x1 tối thiểu (magic bytes thật) + JPEG tối thiểu.
function pngBytes(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // signature
    0x00, 0x00, 0x00, 0x0d, // độ dài IHDR
    0x49, 0x48, 0x44, 0x52, // "IHDR"
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
    0x08, 0x02, 0x00, 0x00, 0x00, // bit depth 8, color type 2
    0x00, 0x00, 0x00, 0x00, // CRC (không kiểm ở đây)
    0x00, 0x00, 0x00, 0x00, // độ dài IEND
    0x49, 0x45, 0x4e, 0x44, // "IEND"
    0xae, 0x42, 0x60, 0x82, // CRC
  ]);
}

function jpegBytes(): Buffer {
  // JPEG tối thiểu có SOF0 1x1 (bản sau Retry kiểm kích thước ảnh ở
  // cuối body nên JPEG test cũng cần SOF thật).
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x07, 0x4a, 0x46, 0x49, 0x46, 0x00,
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01,
    0x11, 0x00,
  ]);
}

function feedHandler(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  if (req.url === "/feed.json") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"items":[]}');
    return;
  }
  if (req.url === "/feed-vnd") {
    res.writeHead(200, { "Content-Type": "application/vnd.api+json" });
    res.end('{"data":[]}');
    return;
  }
  if (req.url === "/feed.csv") {
    res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8" });
    res.end("externalId,name,price\nX1,Hoa,100\n");
    return;
  }
  if (req.url === "/img.png") {
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(pngBytes());
    return;
  }
  if (req.url === "/img.jpg") {
    res.writeHead(200, { "Content-Type": "image/jpeg" });
    res.end(jpegBytes());
    return;
  }
  if (req.url === "/img-bad.png") {
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end("hello, this is plain text, not a png");
    return;
  }
  if (req.url === "/img-jpeg-as-png.png") {
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(jpegBytes());
    return;
  }
  if (req.url === "/html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<html></html>");
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
}

// Handler chuỗi redirect: /r1 → /r2 → ... → /final (200).
function chainHandler(
  chain: Record<string, string>,
): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  return (req, res) => {
    const urlPath = req.url ?? "/";
    if (urlPath === "/final") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
      return;
    }
    const next = chain[urlPath];
    if (next) {
      res.writeHead(302, { Location: next });
      res.end();
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  };
}

// resolve giả: chỉ trả IP đã định sẵn, không chạm DNS thật.
// Hostname không có trong map → [] (không phân giải được).
function fakeResolve(map: Record<string, string[]>): ResolveFn {
  return async (hostname: string) => map[hostname] ?? [];
}

const loopbackResolve = fakeResolve({ localhost: ["127.0.0.1"] });

// Mong đợi safeFetch throw SafeFetchError với code cho trước.
async function expectCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  assert.ok(
    caught instanceof SafeFetchError,
    `phải throw SafeFetchError(${code}), nhận được ${String(caught)}`,
  );
  assert.equal(caught.code, code);
}

function opensslAvailable(): boolean {
  try {
    execFileSync("openssl", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("SSRF bị chặn (Ngày 20 C3)", () => {
  it("IP literal nội bộ/đặc dụng → blocked, không cần phân giải", async () => {
    // resolve giả này throw nếu bị gọi — chứng tỏ IP literal không
    // qua DNS (và cũng không chạm mạng).
    const mustNotResolve: ResolveFn = async () => {
      throw new Error("không được gọi resolve với IP literal");
    };
    for (const url of [
      "http://127.0.0.1/",
      "http://127.1.2.3/",
      "http://[::1]/",
      "http://169.254.169.254/",
      "http://192.168.1.10/",
      "http://10.0.0.5/",
      "http://0.0.0.0/",
      "http://100.64.0.1/",
    ]) {
      await expectCode(safeFetch(url, { resolve: mustNotResolve }), "blocked");
    }
  });

  it("localhost. / localhost:3000 → blocked (resolve giả trả 127.0.0.1)", async () => {
    const resolve = fakeResolve({
      "localhost.": ["127.0.0.1"],
      localhost: ["127.0.0.1"],
    });
    await expectCode(safeFetch("http://localhost./", { resolve }), "blocked");
    await expectCode(
      safeFetch("http://localhost:3000/", { resolve }),
      "blocked",
    );
  });

  it("tên miền resolve ra IP riêng tư → blocked", async () => {
    const resolve = fakeResolve({ "shop.example": ["10.0.0.5"] });
    await expectCode(
      safeFetch("http://shop.example/feed.json", { resolve }),
      "blocked",
    );
  });

  it("URL có user:pass@ → blocked", async () => {
    await expectCode(
      safeFetch("http://user:pass@shop.example/", {
        resolve: fakeResolve({ "shop.example": ["93.184.216.34"] }),
      }),
      "blocked",
    );
  });

  it("cổng 8080 (không phải 80/443) → blocked", async () => {
    await expectCode(
      safeFetch("http://shop.example:8080/", {
        resolve: fakeResolve({ "shop.example": ["93.184.216.34"] }),
      }),
      "blocked",
    );
  });

  it("scheme khác (ftp) → blocked; URL không parse được → invalid_url", async () => {
    await expectCode(
      safeFetch("ftp://example.com/", {
        resolve: fakeResolve({ "example.com": ["93.184.216.34"] }),
      }),
      "blocked",
    );
    await expectCode(safeFetch("not a url", {}), "invalid_url");
    await expectCode(safeFetch("", {}), "invalid_url");
  });

  it("resolve mặc định: localhost → loopback → blocked (không cần opts)", async () => {
    // Dùng DNS thật của máy (localhost → 127.0.0.1 qua /etc/hosts).
    await expectCode(safeFetch("http://localhost:1234/"), "blocked");
  });
});

describe("thành công với máy chủ giả local (Ngày 20 C3)", () => {
  it("feed JSON + CSV (kèm charset) → 200 + body nguyên vẹn", async () => {
    const { port, close } = await startHttp(feedHandler);
    try {
      const json = await safeFetch(`http://localhost:${port}/feed.json`, {
        resolve: loopbackResolve,
        allowLoopbackForTest: true,
      });
      assert.equal(json.status, 200);
      assert.equal(json.contentType, "application/json");
      assert.equal(json.body.toString("utf8"), '{"items":[]}');

      const csv = await safeFetch(`http://localhost:${port}/feed.csv`, {
        resolve: loopbackResolve,
        allowLoopbackForTest: true,
      });
      assert.equal(csv.status, 200);
      assert.equal(csv.contentType, "text/csv; charset=utf-8");
      assert.match(csv.body.toString("utf8"), /Hoa/);
    } finally {
      await close();
    }
  });

  it("feed application/*+json được nhận", async () => {
    const { port, close } = await startHttp(feedHandler);
    try {
      const result = await safeFetch(`http://localhost:${port}/feed-vnd`, {
        resolve: loopbackResolve,
        allowLoopbackForTest: true,
      });
      assert.equal(result.status, 200);
      assert.equal(result.contentType, "application/vnd.api+json");
    } finally {
      await close();
    }
  });

  it("ảnh PNG/JPEG có magic bytes thật → 200 + body đúng", async () => {
    const { port, close } = await startHttp(feedHandler);
    try {
      const png = await safeFetch(`http://localhost:${port}/img.png`, {
        kind: "image",
        resolve: loopbackResolve,
        allowLoopbackForTest: true,
      });
      assert.equal(png.status, 200);
      assert.deepEqual(png.body, pngBytes());

      const jpg = await safeFetch(`http://localhost:${port}/img.jpg`, {
        kind: "image",
        resolve: loopbackResolve,
        allowLoopbackForTest: true,
      });
      assert.equal(jpg.status, 200);
      assert.deepEqual(jpg.body, jpegBytes());
    } finally {
      await close();
    }
  });

  it("Content-Type sai kind → bad_content_type", async () => {
    const { port, close } = await startHttp(feedHandler);
    try {
      await expectCode(
        safeFetch(`http://localhost:${port}/html`, {
          resolve: loopbackResolve,
          allowLoopbackForTest: true,
        }),
        "bad_content_type",
      );
      await expectCode(
        safeFetch(`http://localhost:${port}/feed.json`, {
          kind: "image",
          resolve: loopbackResolve,
          allowLoopbackForTest: true,
        }),
        "bad_content_type",
      );
    } finally {
      await close();
    }
  });

  it("HTTP 404 → lỗi network (không trả body lỗi như thành công)", async () => {
    const { port, close } = await startHttp(feedHandler);
    try {
      await expectCode(
        safeFetch(`http://localhost:${port}/khong-co`, {
          resolve: loopbackResolve,
          allowLoopbackForTest: true,
        }),
        "network",
      );
    } finally {
      await close();
    }
  });
});

describe("redirect (Ngày 20 C3)", () => {
  it("Location tương đối → theo đúng, đủ 3 lần redirect thì ok", async () => {
    const { port, close } = await startHttp(
      chainHandler({ "/r1": "/r2", "/r2": "/r3", "/r3": "/final" }),
    );
    try {
      const result = await safeFetch(`http://localhost:${port}/r1`, {
        resolve: loopbackResolve,
        allowLoopbackForTest: true,
      });
      assert.equal(result.status, 200);
    } finally {
      await close();
    }
  });

  it("quá 3 lần redirect → lỗi redirect", async () => {
    const { port, close } = await startHttp(
      chainHandler({
        "/r1": "/r2",
        "/r2": "/r3",
        "/r3": "/r4",
        "/r4": "/final",
      }),
    );
    try {
      await expectCode(
        safeFetch(`http://localhost:${port}/r1`, {
          resolve: loopbackResolve,
          allowLoopbackForTest: true,
        }),
        "redirect",
      );
    } finally {
      await close();
    }
  });

  it("redirect tới địa chỉ chặn → blocked (kiểm lại DNS/IP ở hop redirect)", async () => {
    // Hop 1 cần allowLoopbackForTest để tới máy chủ giả; vì vậy
    // đích chặn ở đây dùng IP riêng tư 10.0.0.5 (cờ test chỉ cho
    // phép loopback, không cho phép IP riêng tư).
    const { port, close } = await startHttp((_req, res) => {
      res.writeHead(302, { Location: "http://blocked.example/" });
      res.end();
    });
    try {
      await expectCode(
        safeFetch(`http://localhost:${port}/`, {
          resolve: fakeResolve({
            localhost: ["127.0.0.1"],
            "blocked.example": ["10.0.0.5"],
          }),
          allowLoopbackForTest: true,
        }),
        "blocked",
      );
    } finally {
      await close();
    }
  });

  it("redirect tới cổng lạ → blocked", async () => {
    const { port, close } = await startHttp((_req, res) => {
      res.writeHead(302, { Location: "http://shop.example:8080/" });
      res.end();
    });
    try {
      await expectCode(
        safeFetch(`http://localhost:${port}/`, {
          resolve: fakeResolve({
            localhost: ["127.0.0.1"],
            "shop.example": ["93.184.216.34"],
          }),
          allowLoopbackForTest: true,
        }),
        "blocked",
      );
    } finally {
      await close();
    }
  });

  it("https → http (downgrade) → lỗi redirect", async (t) => {
    // Cần máy chủ HTTPS thật với chứng chỉ do CA tự ký. Node chỉ
    // tin CA qua NODE_EXTRA_CA_CERTS (đọc lúc KHỞI ĐỘNG tiến
    // trình) nên phần fetch chạy trong tiến trình con với env đó;
    // tiến trình test vẫn giữ máy chủ HTTPS chạy trong lúc chờ.
    if (!opensslAvailable()) {
      t.skip("openssl không có sẵn — bỏ qua test downgrade HTTPS");
      return;
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "safe-fetch-https-"));
    try {
      const caKey = path.join(tmp, "ca.key");
      const caPem = path.join(tmp, "ca.pem");
      const srvKey = path.join(tmp, "srv.key");
      const srvCsr = path.join(tmp, "srv.csr");
      const srvPem = path.join(tmp, "srv.pem");
      const extCnf = path.join(tmp, "ext.cnf");
      execFileSync(
        "openssl",
        [
          "req", "-x509", "-newkey", "rsa:2048",
          "-keyout", caKey, "-out", caPem, "-days", "2", "-nodes",
          "-subj", "/CN=TestCA",
          "-addext", "basicConstraints=critical,CA:TRUE",
        ],
        { stdio: "ignore" },
      );
      execFileSync(
        "openssl",
        [
          "req", "-newkey", "rsa:2048",
          "-keyout", srvKey, "-out", srvCsr, "-nodes",
          "-subj", "/CN=localhost",
        ],
        { stdio: "ignore" },
      );
      fs.writeFileSync(extCnf, "subjectAltName=DNS:localhost,IP:127.0.0.1\n");
      execFileSync(
        "openssl",
        [
          "x509", "-req", "-in", srvCsr,
          "-CA", caPem, "-CAkey", caKey, "-CAcreateserial",
          "-out", srvPem, "-days", "2", "-extfile", extCnf,
        ],
        { stdio: "ignore" },
      );

      const server = https.createServer(
        { key: fs.readFileSync(srvKey), cert: fs.readFileSync(srvPem) },
        (_req, res) => {
          // Hạ cấp xuống http — đích dùng cổng 9 (đóng) để chắc
          // chắn lỗi phải đến từ kiểm tra downgrade, không phải
          // từ kết nối tới đích.
          res.writeHead(302, { Location: "http://localhost:9/khong-toi" });
          res.end();
        },
      );
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const port = (server.address() as { port: number }).port;

      const safeFetchPath = fileURLToPath(
        new URL("./safe-fetch.ts", import.meta.url),
      );
      const driver = path.join(tmp, "downgrade-driver.mjs");
      fs.writeFileSync(
        driver,
        [
          `import { safeFetch } from ${JSON.stringify(safeFetchPath)};`,
          `const url = process.argv[2];`,
          `const resolve = async () => ["127.0.0.1"];`,
          `try {`,
          `  const r = await safeFetch(url, { resolve, allowLoopbackForTest: true });`,
          `  console.log(JSON.stringify({ ok: true, status: r.status }));`,
          `} catch (err) {`,
          `  console.log(JSON.stringify({ ok: false, code: err && err.code ? err.code : "?", message: String(err && err.message) }));`,
          `}`,
          ``,
        ].join("\n"),
      );

      const output = await new Promise<{ ok: boolean; code?: string }>(
        (resolvePromise, rejectPromise) => {
          const child: ChildProcess = spawn(
            process.execPath,
            [driver, `https://localhost:${port}/`],
            { env: { ...process.env, NODE_EXTRA_CA_CERTS: caPem } },
          );
          let out = "";
          let errText = "";
          const timer = setTimeout(() => {
            child.kill("SIGKILL");
            rejectPromise(
              new Error(`tiến trình con timeout, stderr: ${errText.slice(0, 300)}`),
            );
          }, 15000);
          child.stdout?.on("data", (d: Buffer) => {
            out += d.toString("utf8");
          });
          child.stderr?.on("data", (d: Buffer) => {
            errText += d.toString("utf8");
          });
          child.on("error", (err) => {
            clearTimeout(timer);
            rejectPromise(err);
          });
          child.on("close", (code) => {
            clearTimeout(timer);
            if (code !== 0) {
              rejectPromise(
                new Error(
                  `tiến trình con thoát mã ${code}, stderr: ${errText.slice(0, 300)}`,
                ),
              );
              return;
            }
            try {
              resolvePromise(
                JSON.parse(out.trim()) as { ok: boolean; code?: string },
              );
            } catch {
              rejectPromise(
                new Error(`tiến trình con in ra không phải JSON: ${out.slice(0, 300)}`),
              );
            }
          });
        },
      );
      assert.equal(output.ok, false);
      assert.equal(output.code, "redirect");
      await new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("DNS rebinding (Ngày 20 C3)", () => {
  it("chỉ phân giải 1 lần, ghim IP lần đầu (lần 2 trả IP khác vẫn ok)", async () => {
    const { port, close } = await startHttp(feedHandler);
    try {
      let calls = 0;
      const flippingResolve: ResolveFn = async () => {
        calls += 1;
        return calls === 1 ? ["127.0.0.1"] : ["127.0.0.2"];
      };
      // Máy chủ chỉ nghe 127.0.0.1: nếu fetch phân giải lại rồi nối
      // 127.0.0.2 thì sẽ ECONNREFUSED.
      const result = await safeFetch(`http://localhost:${port}/feed.json`, {
        resolve: flippingResolve,
        allowLoopbackForTest: true,
      });
      assert.equal(result.status, 200);
      assert.equal(calls, 1);
    } finally {
      await close();
    }
  });
});

describe("giới hạn tài nguyên (Ngày 20 C3)", () => {
  it("phản hồi vô hạn (không bao giờ kết thúc) → timeout", async () => {
    const { port, close } = await startHttp((_req, _res) => {
      // Không viết gì, không kết thúc — treo mãi.
    });
    try {
      const started = Date.now();
      await expectCode(
        safeFetch(`http://localhost:${port}/`, {
          resolve: loopbackResolve,
          allowLoopbackForTest: true,
          timeoutMs: 300,
        }),
        "timeout",
      );
      assert.ok(
        Date.now() - started < 5000,
        "timeout phải cắt sớm, không chờ vô hạn",
      );
    } finally {
      await close();
    }
  });

  it("phản hồi chậm từng byte (1 byte/200ms, timeout 500ms) → timeout", async () => {
    const { port, close } = await startHttp((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      const timer = setInterval(() => {
        if (res.destroyed) {
          clearInterval(timer);
          return;
        }
        res.write("x");
      }, 200);
      req.on("close", () => clearInterval(timer));
      // An toàn: dừng sau 5s dù client chưa ngắt.
      setTimeout(() => {
        clearInterval(timer);
        try {
          res.end();
        } catch {
          /* kệ */
        }
      }, 5000).unref();
    });
    try {
      const started = Date.now();
      await expectCode(
        safeFetch(`http://localhost:${port}/`, {
          resolve: loopbackResolve,
          allowLoopbackForTest: true,
          timeoutMs: 500,
        }),
        "timeout",
      );
      assert.ok(Date.now() - started < 5000, "timeout tổng phải cắt nhỏ giọt");
    } finally {
      await close();
    }
  });

  it("Content-Length khai 10 nhưng gửi 100KB → fetch fail an toàn (không tin Content-Length)", async () => {
    // Máy chủ TCP thô: khai Content-Length: 10 nhưng gửi body
    // chunked dài 100 KB. Parser HTTP của Node tự từ chối combo
    // Content-Length + Transfer-Encoding (framing mập mờ) nên
    // lời khai dối không bao giờ tới được logic đọc body — fetch
    // fail đóng (network), không chấp nhận body theo số đã khai.
    // (Ca đếm byte thật thì xem test chunked 100KB bên dưới.)
    const server = net.createServer((socket) => {
      let received = Buffer.alloc(0);
      socket.on("data", (chunk: Buffer) => {
        received = Buffer.concat([received, chunk]);
        if (!received.includes("\r\n\r\n")) return;
        socket.write(
          "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 10\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n",
        );
        const oneKb = Buffer.alloc(1024, "a");
        for (let i = 0; i < 100; i++) {
          socket.write("400\r\n");
          socket.write(oneKb);
          socket.write("\r\n");
        }
        socket.write("0\r\n\r\n");
        socket.end();
      });
      socket.on("error", () => {
        /* client hủy kết nối sớm — bình thường */
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    try {
      await expectCode(
        safeFetch(`http://localhost:${port}/`, {
          resolve: loopbackResolve,
          allowLoopbackForTest: true,
          maxBytes: 1000,
        }),
        "network",
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("body chunked 100KB, không khai Content-Length → too_large với maxBytes nhỏ", async () => {
    // Giới hạn đếm theo byte THẬT nhận được trên luồng, không dựa
    // vào Content-Length (ở đây máy chủ không khai gì cả).
    const server = net.createServer((socket) => {
      let received = Buffer.alloc(0);
      socket.on("data", (chunk: Buffer) => {
        received = Buffer.concat([received, chunk]);
        if (!received.includes("\r\n\r\n")) return;
        socket.write(
          "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n",
        );
        const oneKb = Buffer.alloc(1024, "a");
        for (let i = 0; i < 100; i++) {
          socket.write("400\r\n");
          socket.write(oneKb);
          socket.write("\r\n");
        }
        socket.write("0\r\n\r\n");
        socket.end();
      });
      socket.on("error", () => {
        /* client hủy kết nối sớm — bình thường */
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    try {
      await expectCode(
        safeFetch(`http://localhost:${port}/`, {
          resolve: loopbackResolve,
          allowLoopbackForTest: true,
          maxBytes: 1000,
        }),
        "too_large",
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("tệp 10 MB → too_large với giới hạn feed mặc định 5 MB", async () => {
    const big = Buffer.alloc(10 * 1024 * 1024, "b");
    const { port, close } = await startHttp((_req, res) => {
      res.on("error", () => {
        /* client hủy giữa chừng gây EPIPE — bình thường */
      });
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(big);
    });
    try {
      await expectCode(
        safeFetch(`http://localhost:${port}/`, {
          resolve: loopbackResolve,
          allowLoopbackForTest: true,
        }),
        "too_large",
      );
    } finally {
      await close();
    }
  });

  it("magic bytes: khai image/png nhưng body là text → bad_content_type", async () => {
    const { port, close } = await startHttp(feedHandler);
    try {
      await expectCode(
        safeFetch(`http://localhost:${port}/img-bad.png`, {
          kind: "image",
          resolve: loopbackResolve,
          allowLoopbackForTest: true,
        }),
        "bad_content_type",
      );
      // Khai PNG nhưng magic bytes là JPEG → cũng lỗi.
      await expectCode(
        safeFetch(`http://localhost:${port}/img-jpeg-as-png.png`, {
          kind: "image",
          resolve: loopbackResolve,
          allowLoopbackForTest: true,
        }),
        "bad_content_type",
      );
    } finally {
      await close();
    }
  });
});

describe("isBlockedIp / parseIpLiteral (Ngày 20 C3)", () => {
  it("isBlockedIp chặn đúng các dải", () => {
    const blocked = [
      "127.0.0.1",
      "127.1.2.3",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "169.254.0.1",
      "0.0.0.0",
      "0.1.2.3",
      "100.64.0.1",
      "100.127.255.255",
      "192.0.0.1",
      "192.0.0.255",
      "192.0.2.1",
      "198.51.100.1",
      "203.0.113.1",
      "240.0.0.1",
      "255.255.255.255",
      "::1",
      "::",
      "fe80::1",
      "fc00::1",
      "fd12:3456::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "not-an-ip",
    ];
    for (const ip of blocked) {
      assert.equal(isBlockedIp(ip), true, ip);
    }
    const allowed = [
      "8.8.8.8",
      "93.184.216.34",
      "172.32.0.1",
      "100.128.0.1",
      "192.0.1.1",
      "192.0.3.1",
      "2001:db8::1",
      "2606:4700:4700::1111",
      "::ffff:8.8.8.8",
    ];
    for (const ip of allowed) {
      assert.equal(isBlockedIp(ip), false, ip);
    }
  });

  it("parseIpLiteral chỉ nhận IP literal", () => {
    assert.equal(parseIpLiteral("127.0.0.1"), "127.0.0.1");
    assert.equal(parseIpLiteral("::1"), "::1");
    assert.equal(parseIpLiteral("[::1]"), "::1");
    assert.equal(parseIpLiteral("example.com"), null);
    assert.equal(parseIpLiteral("localhost"), null);
    assert.equal(parseIpLiteral("256.1.1.1"), null);
    assert.equal(parseIpLiteral(""), null);
  });

  it("SafeFetchError mang code + là Error", () => {
    const err = new SafeFetchError("blocked", "bị chặn");
    assert.ok(err instanceof Error);
    assert.equal(err.code, "blocked");
    assert.equal(err.name, "SafeFetchError");
    assert.equal(err.message, "bị chặn");
  });
});

describe("bổ sung bảo mật (Ngày 20 bản sau Retry B11)", () => {
  // PNG/JPEG/WebP/AVIF với kích thước tùy chọn (header thật).
  function pngWithSize(width: number, height: number): Buffer {
    const buf = Buffer.alloc(33);
    Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
      0x0d, 0x49, 0x48, 0x44, 0x52,
    ]).copy(buf, 0);
    buf.writeUInt32BE(width, 16);
    buf.writeUInt32BE(height, 20);
    buf[24] = 0x08;
    buf[25] = 0x02;
    return buf;
  }

  function jpegWithSize(width: number, height: number): Buffer {
    const buf = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x07, 0x4a, 0x46, 0x49, 0x46, 0x00,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01,
      0x11, 0x00,
    ]);
    buf.writeUInt16BE(height, 16);
    buf.writeUInt16BE(width, 18);
    return buf;
  }

  function webpVp8x(width: number, height: number): Buffer {
    const buf = Buffer.alloc(30);
    buf.write("RIFF", 0, "latin1");
    buf.writeUInt32LE(22, 4);
    buf.write("WEBP", 8, "latin1");
    buf.write("VP8X", 12, "latin1");
    buf.writeUInt32LE(10, 16);
    buf[20] = 0x00;
    const w = width - 1;
    const h = height - 1;
    buf[24] = w & 0xff;
    buf[25] = (w >> 8) & 0xff;
    buf[26] = (w >> 16) & 0xff;
    buf[27] = h & 0xff;
    buf[28] = (h >> 8) & 0xff;
    buf[29] = (h >> 16) & 0xff;
    return buf;
  }

  function avifWithSize(width: number, height: number): Buffer {
    const ftyp = Buffer.alloc(24);
    ftyp.writeUInt32BE(24, 0);
    ftyp.write("ftypavif", 4, "latin1");
    const ispe = Buffer.alloc(20);
    ispe.writeUInt32BE(20, 0);
    ispe.write("ispe", 4, "latin1");
    ispe.writeUInt32BE(width, 12);
    ispe.writeUInt32BE(height, 16);
    const metaSize = 8 + 4 + ispe.length;
    const meta = Buffer.alloc(metaSize);
    meta.writeUInt32BE(metaSize, 0);
    meta.write("meta", 4, "latin1");
    ispe.copy(meta, 12);
    return Buffer.concat([ftyp, meta]);
  }

  it("IP dạng số inet_aton (2130706433, 0x7f000001, 017700000001, 127.1) → blocked", async () => {
    for (const host of [
      "2130706433",
      "0x7f000001",
      "017700000001",
      "127.1",
      "0x7f.1",
      "0177.0.0.1",
    ]) {
      await expectCode(
        safeFetch(`http://${host}/`, {
          resolve: fakeResolve({}),
        }),
        "blocked",
      );
    }
    // [::ffff:127.0.0.1] (IPv4-mapped) → blocked.
    await expectCode(
      safeFetch("http://[::ffff:127.0.0.1]/", {
        resolve: fakeResolve({}),
      }),
      "blocked",
    );
  });

  it("parseInetAton/isBlockedIp: dạng số + multicast bị chặn", () => {
    assert.equal(parseInetAton("2130706433"), 0x7f000001);
    assert.equal(parseInetAton("0x7f000001"), 0x7f000001);
    assert.equal(parseInetAton("017700000001"), 0x7f000001);
    assert.equal(parseInetAton("127.1"), 0x7f000001);
    assert.equal(parseInetAton("0x7f.0.0.1"), 0x7f000001);
    assert.equal(parseInetAton("0177.0.0.1"), 0x7f000001);
    assert.equal(parseInetAton("1.2.3.4.5"), null);
    assert.equal(parseInetAton("256.1.1.1"), null);
    assert.equal(parseInetAton("example.com"), null);
    assert.equal(parseIpLiteral("2130706433"), "127.0.0.1");
    for (const ip of [
      "2130706433",
      "0x7f000001",
      "017700000001",
      "127.1",
      "224.0.0.1",
      "239.255.255.250",
      "ff02::1",
      "ff00::1",
    ]) {
      assert.equal(isBlockedIp(ip), true, ip);
    }
    for (const ip of ["223.255.255.255", "8.8.8.8", "2001:db8::1"]) {
      assert.equal(isBlockedIp(ip), false, ip);
    }
  });

  it("cổng 22/6379/5432 → blocked", async () => {
    for (const port of [22, 6379, 5432]) {
      await expectCode(
        safeFetch(`http://example.com:${port}/`, {
          resolve: fakeResolve({ "example.com": ["93.184.216.34"] }),
        }),
        "blocked",
      );
    }
  });

  it("scheme file:/gopher:/data: → blocked", async () => {
    for (const url of [
      "file:///etc/passwd",
      "gopher://example.com/",
      "data:text/html,<h1>x</h1>",
    ]) {
      await expectCode(
        safeFetch(url, { resolve: fakeResolve({}) }),
        "blocked",
      );
    }
  });

  it("feed trả HTML (Content-Type text/html hoặc body bắt đầu `<`) → đúng thông báo", async () => {
    const server = await startHttp((req, res) => {
      if (req.url === "/html-as-text") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("<html><body>xin chào</body></html>");
        return;
      }
      if (req.url === "/html-ws") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("  \n<html><body>x</body></html>");
        return;
      }
      feedHandler(req, res);
    });
    try {
      const base = `http://localhost:${server.port}`;
      const opts = { resolve: loopbackResolve, allowLoopbackForTest: true };
      for (const path of ["/html", "/html-as-text", "/html-ws"]) {
        let caught: unknown;
        try {
          await safeFetch(base + path, opts);
        } catch (err) {
          caught = err;
        }
        assert.ok(caught instanceof SafeFetchError, path);
        assert.equal(caught.code, "bad_content_type");
        assert.equal(caught.message, HTML_NOT_DATA_MESSAGE);
      }
    } finally {
      await server.close();
    }
  });

  it("imageDimensions đọc đúng PNG/JPEG/WebP/AVIF", () => {
    assert.deepEqual(imageDimensions("image/png", pngWithSize(320, 240)), {
      width: 320,
      height: 240,
    });
    assert.deepEqual(imageDimensions("image/jpeg", jpegWithSize(640, 480)), {
      width: 640,
      height: 480,
    });
    assert.deepEqual(imageDimensions("image/webp", webpVp8x(800, 600)), {
      width: 800,
      height: 600,
    });
    assert.deepEqual(imageDimensions("image/avif", avifWithSize(1024, 768)), {
      width: 1024,
      height: 768,
    });
    assert.equal(imageDimensions("image/png", Buffer.alloc(10)), null);
  });

  it("ảnh vượt 6000×6000 → bad_content_type; đúng 6000×6000 thì qua", async () => {
    const server = await startHttp((req, res) => {
      if (req.url === "/big.png") {
        res.writeHead(200, { "Content-Type": "image/png" });
        res.end(pngWithSize(7000, 100));
        return;
      }
      if (req.url === "/big.jpg") {
        res.writeHead(200, { "Content-Type": "image/jpeg" });
        res.end(jpegWithSize(100, 7000));
        return;
      }
      if (req.url === "/max.png") {
        res.writeHead(200, { "Content-Type": "image/png" });
        res.end(pngWithSize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION));
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    });
    try {
      const base = `http://localhost:${server.port}`;
      const opts = {
        kind: "image" as const,
        resolve: loopbackResolve,
        allowLoopbackForTest: true,
      };
      await expectCode(safeFetch(base + "/big.png", opts), "bad_content_type");
      await expectCode(safeFetch(base + "/big.jpg", opts), "bad_content_type");
      const ok = await safeFetch(base + "/max.png", opts);
      assert.equal(ok.status, 200);
    } finally {
      await server.close();
    }
  });

  it("ảnh đa dạng thức: GIF/HTML, PNG chứa HTML → bad_content_type", async () => {
    const server = await startHttp((req, res) => {
      if (req.url === "/gif-html") {
        res.writeHead(200, { "Content-Type": "image/gif" });
        res.end("GIF89a<html><script>alert(1)</script>");
        return;
      }
      if (req.url === "/png-html") {
        res.writeHead(200, { "Content-Type": "image/png" });
        res.end("<html><script>alert(1)</script></html>");
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    });
    try {
      const base = `http://localhost:${server.port}`;
      const opts = {
        kind: "image" as const,
        resolve: loopbackResolve,
        allowLoopbackForTest: true,
      };
      await expectCode(safeFetch(base + "/gif-html", opts), "bad_content_type");
      await expectCode(safeFetch(base + "/png-html", opts), "bad_content_type");
    } finally {
      await server.close();
    }
  });
});
