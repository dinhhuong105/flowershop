// Máy chủ Telegram GIẢ để kiểm thử (mục 9 + D5-23/D5-24 đặc tả Ngày 5).
// CHỈ dùng khi test, KHÔNG dùng trong vận hành thật.
// Ghi mọi yêu cầu POST /bot<token>/sendMessage vào file JSONL.
// Chế độ (biến môi trường MOCK_TELEGRAM_MODE):
//   ok       → trả 200 {"ok":true} (mặc định)
//   error500 → trả 500 {"ok":false}
//   hang     → không trả gì (để test timeout 5 giây của máy chủ)
// Cổng: MOCK_TELEGRAM_PORT (mặc định 18080). File log:
// MOCK_TELEGRAM_LOG (mặc định /tmp/mock-telegram-requests.jsonl).
// Chạy: node scripts/mock-telegram.mjs
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";

const port = Number(process.env.MOCK_TELEGRAM_PORT ?? 18080);
const mode = process.env.MOCK_TELEGRAM_MODE ?? "ok";
const logPath = process.env.MOCK_TELEGRAM_LOG ?? "/tmp/mock-telegram-requests.jsonl";

const server = createServer((req, res) => {
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, mode }));
    return;
  }
  if (req.method !== "POST" || !req.url?.includes("/sendMessage")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
    return;
  }
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    try {
      appendFileSync(logPath, `${JSON.stringify({ url: req.url, body: JSON.parse(body) })}\n`);
    } catch {
      // Ghi log lỗi cũng không được làm hỏng việc trả lời.
    }
    if (mode === "hang") {
      // Cố tình không trả gì — phía gọi sẽ timeout sau 5 giây.
      return;
    }
    if (mode === "error500") {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error_code: 500 }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, result: { message_id: 1 } }));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Mock Telegram đang chạy ở http://127.0.0.1:${port} (chế độ ${mode}, log ${logPath})`);
});
