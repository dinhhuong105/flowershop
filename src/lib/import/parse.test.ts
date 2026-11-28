// Test bộ đọc dữ liệu nhập sản phẩm (Ngày 20, phần C2).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseJson, parseImport, isFormulaCell } from "./parse";
import type { ParseResult } from "./parse";

const HEADER = "externalId,name,description,price,salePrice,categoryName,imageUrls,stock,sku";

// Một dòng CSV hợp lệ tối thiểu (externalId + name + price).
function oneRowCsv(overrides: string = ""): string {
  return `${HEADER}\nX1,Hoa hồng,hoa đỏ,890000,${overrides}\n`;
}

describe("parse CSV (Ngày 20 C2)", () => {
  it("không BOM: dòng hợp lệ → đủ field, trống → null/[]", () => {
    const result = parseCsv(
      `${HEADER}\nX1,Hoa hồng,hoa đỏ,890000,,Hồng,https://a.test/1.jpg|https://a.test/2.jpg,5,SKU-1\n`,
    );
    assert.equal(result.errors.length, 0);
    assert.equal(result.totalLines, 2);
    const row = result.rows[0];
    assert.equal(row.externalId, "X1");
    assert.equal(row.name, "Hoa hồng");
    assert.equal(row.description, "hoa đỏ");
    assert.equal(row.price, 890000);
    assert.equal(row.salePrice, null);
    assert.equal(row.categoryName, "Hồng");
    assert.deepEqual(row.imageUrls, [
      "https://a.test/1.jpg",
      "https://a.test/2.jpg",
    ]);
    assert.equal(row.stock, 5);
    assert.equal(row.sku, "SKU-1");
    assert.equal(row.formulaFlagged, false);
    assert.deepEqual(row.flaggedFields, []);
    // raw giữ nguyên object gốc của dòng.
    assert.equal(row.raw["externalId"], "X1");
    assert.equal(row.raw["price"], "890000");
  });

  it("có BOM vẫn parse bình thường", () => {
    const result = parseCsv(
      "﻿" + `${HEADER}\nX1,Hoa hồng,,890000,,,,,\n`,
    );
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows[0].externalId, "X1");
  });

  it("dấu phân tách `;`", () => {
    const result = parseCsv(
      "externalId;name;price\nX1;Hoa hồng;890000\nX2;Hoa lan;120000\n",
    );
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[1].name, "Hoa lan");
    assert.equal(result.rows[1].price, 120000);
  });

  it("dấu phân tách tab", () => {
    const result = parseCsv("externalId\tname\tprice\nX1\tHoa hồng\t890000\n");
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows[0].name, "Hoa hồng");
  });

  it("ngoặc kép: dấu phẩy trong ô, `\"\"` = một `\"`, xuống dòng trong ô", () => {
    const result = parseCsv(
      `${HEADER}\nX1,"Hoa hồng, đỏ","dòng 1\ndòng 2",890000,,,,,\nX2,"Hoa ""đẹp""",,120000,,,,,\n`,
    );
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].name, "Hoa hồng, đỏ");
    assert.equal(result.rows[0].description, "dòng 1 dòng 2"); // B5: chuẩn hóa khoảng trắng
    assert.equal(result.rows[1].name, 'Hoa "đẹp"');
    // Ô có xuống dòng trong ngoặc kép tính là 1 dòng logic.
    assert.equal(result.totalLines, 3);
  });

  it("quá 2.000 dòng → lỗi toàn cục, không parse tiếp", () => {
    const lines = [HEADER];
    for (let i = 0; i < 2001; i++) {
      lines.push(`X${i},Hoa ${i},,100000,,,,,`);
    }
    const result = parseCsv(lines.join("\n"));
    assert.equal(result.rows.length, 0);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].line, 0);
    assert.match(result.errors[0].reason, /vượt quá 2000 dòng/);
  });

  it("đúng 2.000 dòng logic (header + 1.999 dòng dữ liệu) vẫn parse", () => {
    const lines = [HEADER];
    for (let i = 0; i < 1999; i++) {
      lines.push(`X${i},Hoa ${i},,100000,,,,,`);
    }
    const result = parseCsv(lines.join("\n"));
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows.length, 1999);
    assert.equal(result.totalLines, 2000);
  });

  it("header trùng sau chuẩn hóa (Name/name) → lỗi dòng 1", () => {
    const result = parseCsv("name,Name,price\nHoa, Hoa, 100\n");
    assert.equal(result.rows.length, 0);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].line, 1);
    assert.match(result.errors[0].reason, /trùng/);
  });

  it("header có cột rỗng → lỗi dòng 1", () => {
    const result = parseCsv("externalId,,price\nX1,,100\n");
    assert.equal(result.rows.length, 0);
    assert.equal(result.errors[0].line, 1);
    assert.match(result.errors[0].reason, /rỗng/);
  });

  it("tệp rỗng → lỗi toàn cục", () => {
    const result = parseCsv("   \n  ");
    assert.equal(result.rows.length, 0);
    assert.equal(result.errors[0].line, 0);
  });

  it("externalId thiếu thì lấy từ SKU; cả hai trống → lỗi dòng", () => {
    const fromSku = parseCsv(
      "sku,name,price\nSKU-9,Hoa hồng,890000\n",
    );
    assert.equal(fromSku.errors.length, 0);
    assert.equal(fromSku.rows[0].externalId, "SKU-9");
    assert.equal(fromSku.rows[0].sku, "SKU-9");

    const missing = parseCsv("name,price\nHoa hồng,890000\n");
    assert.equal(missing.rows.length, 0);
    assert.equal(missing.errors.length, 1);
    assert.equal(missing.errors[0].line, 2);
    assert.match(missing.errors[0].reason, /externalId\/SKU/);
  });

  it("externalId quá 100 ký tự → lỗi dòng", () => {
    const result = parseCsv(`${HEADER}\n${"X".repeat(101)},Hoa hồng,,100,,,,,\n`);
    assert.equal(result.rows.length, 0);
    assert.match(result.errors[0].reason, /externalId/);
  });

  it("biên tên: 2 ký tự lỗi, 3 ok, 160 ok, 161 lỗi", () => {
    const two = parseCsv(`${HEADER}\nX1,Ho,,100,,,,,\n`);
    assert.match(two.errors[0].reason, /tên/);
    const three = parseCsv(`${HEADER}\nX1,Hoa,,100,,,,,\n`);
    assert.equal(three.errors.length, 0);
    const ok160 = parseCsv(`${HEADER}\nX1,${"a".repeat(160)},,100,,,,,\n`);
    assert.equal(ok160.errors.length, 0);
    const over161 = parseCsv(`${HEADER}\nX1,${"a".repeat(161)},,100,,,,,\n`);
    assert.match(over161.errors[0].reason, /tên/);
  });

  it("giá: 0 lỗi, âm lỗi, chữ lỗi, khoảng trắng trong số lỗi; 890000.5 và 890000,5 ok", () => {
    for (const bad of ["0", "-5", "abc", "890 000"]) {
      const result = parseCsv(`${HEADER}\nX1,Hoa hồng,,${bad},,,,,\n`);
      assert.equal(result.rows.length, 0, `giá ${bad} phải lỗi`);
      assert.match(result.errors[0].reason, /giá/);
    }
    const dot = parseCsv(`${HEADER}\nX1,Hoa hồng,,890000.5,,,,,\n`);
    assert.equal(dot.rows[0].price, 890000.5);
    // Dấu phẩy KHÔNG có ngoặc kép thì tách ô: price=890000, salePrice=5.
    const comma = parseCsv(`${HEADER}\nX1,Hoa hồng,,890000,5,,,,,\n`);
    assert.equal(comma.rows[0].price, 890000);
    assert.equal(comma.rows[0].salePrice, 5);
    const commaQuoted = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,"890000,5",,,,,\n`,
    );
    assert.equal(commaQuoted.rows[0].price, 890000.5);
    // B3 (bản sau Retry — ĐẢO NGƯỢC Ngày 20): "890.000" = 890.000
    // (dấu phân tách nghìn), "1.000.000" = 1000000.
    const vnStyle = parseCsv(`${HEADER}\nX1,Hoa hồng,,890.000,,,,,\n`);
    assert.equal(vnStyle.rows[0].price, 890000);
    const million = parseCsv(`${HEADER}\nX1,Hoa hồng,,"1.000.000",,,,,\n`);
    assert.equal(million.rows[0].price, 1000000);
    const commaThousands = parseCsv(`${HEADER}\nX1,Hoa hồng,,"1,234,567",,,,,\n`);
    assert.equal(commaThousands.rows[0].price, 1234567);
    const mixed = parseCsv(`${HEADER}\nX1,Hoa hồng,,"1.234,56",,,,,\n`);
    assert.equal(mixed.rows[0].price, 1234.56);
    // Nhóm nghìn sai ("12.34.567": nhóm đầu 2 số rồi 2 số) → lỗi.
    const badGroups = parseCsv(`${HEADER}\nX1,Hoa hồng,,"12.34.567",,,,,\n`);
    assert.equal(badGroups.rows.length, 0);
  });

  it("salePrice > price → lỗi; bằng price cũng lỗi (nghiêm ngặt); trống → null", () => {
    const over = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,150000,,,,\n`,
    );
    assert.match(over.errors[0].reason, /khuyến mãi/);
    const equal = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,100000,,,,\n`,
    );
    assert.equal(equal.rows.length, 0, "salePrice bằng giá gốc phải lỗi");
    assert.match(equal.errors[0].reason, /khuyến mãi/);
    const empty = parseCsv(oneRowCsv());
    assert.equal(empty.rows[0].salePrice, null);
  });

  it("imageUrls: 9 ảnh → lỗi; phân tách `|`; `;` không còn tách; URL phải http(s)", () => {
    const nine = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,,,${"https://a.test/1.jpg|".repeat(8)}https://a.test/9.jpg,,\n`,
    );
    assert.match(nine.errors[0].reason, /8 ảnh/);
    const eight = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,,,${"https://a.test/1.jpg|".repeat(7)}https://a.test/8.jpg,,\n`,
    );
    assert.equal(eight.errors.length, 0);
    assert.equal(eight.rows[0].imageUrls.length, 8);
    const pipes = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,,,https://a.test/a.jpg | https://a.test/b.jpg | https://a.test/c.jpg,,\n`,
    );
    assert.deepEqual(pipes.rows[0].imageUrls, [
      "https://a.test/a.jpg",
      "https://a.test/b.jpg",
      "https://a.test/c.jpg",
    ]);
    const semis = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,,,https://a.test/a.jpg;https://a.test/b.jpg,,\n`,
    );
    assert.deepEqual(semis.rows[0].imageUrls, [
      "https://a.test/a.jpg;https://a.test/b.jpg",
    ]);
    const badScheme = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,,,javascript:alert(1),,\n`,
    );
    assert.match(badScheme.errors[0].reason, /http\(s\)/);
    const relative = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,,,a.jpg,,\n`,
    );
    assert.match(relative.errors[0].reason, /http\(s\)/);
  });

  it("stock: -1 lỗi, 1.5 lỗi, trống → null, 0 ok", () => {
    // Mỗi dòng đủ 9 ô theo HEADER (externalId,name,description,price,
    // salePrice,categoryName,imageUrls,stock,sku).
    const neg = parseCsv(`${HEADER}\nX1,Hoa hồng,,100000,,,,-1,\n`);
    assert.match(neg.errors[0].reason, /tồn kho/);
    const frac = parseCsv(`${HEADER}\nX1,Hoa hồng,,100000,,,,1.5,\n`);
    assert.match(frac.errors[0].reason, /tồn kho/);
    const empty = parseCsv(`${HEADER}\nX1,Hoa hồng,,100000,,,,,\n`);
    assert.equal(empty.rows[0].stock, null);
    const zero = parseCsv(`${HEADER}\nX1,Hoa hồng,,100000,,,,0,\n`);
    assert.equal(zero.rows[0].stock, 0);
  });

  it("mô tả > 2.000 ký tự, danh mục > 100, SKU > 100 → lỗi dòng", () => {
    const longDesc = parseCsv(
      `${HEADER}\nX1,Hoa hồng,${"a".repeat(2001)},100,,,,,\n`,
    );
    assert.match(longDesc.errors[0].reason, /mô tả/);
    const longCat = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100,,${"a".repeat(101)},,,\n`,
    );
    assert.match(longCat.errors[0].reason, /danh mục/);
    const longSku = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100,,,,,${"S".repeat(101)}\n`,
    );
    assert.match(longSku.errors[0].reason, /SKU/);
  });

  it("1 dòng lỗi không dừng cả tệp — thu thập lỗi, dòng khác vẫn parse", () => {
    const result = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,,,,,\nX2,Ho,,0,,,,,\nX3,Hoa lan,,120000,,,,,\n`,
    );
    assert.equal(result.rows.length, 2);
    assert.deepEqual(
      result.rows.map((r) => r.externalId),
      ["X1", "X3"],
    );
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].line, 3);
  });

  it("header tiếng Việt (Tên sản phẩm, Giá, SKU...) vẫn nhận", () => {
    const result = parseCsv(
      "Mã,Tên sản phẩm,Giá,Số lượng\nSKU-1,Hoa hồng,890000,5\n",
    );
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows[0].externalId, "SKU-1");
    assert.equal(result.rows[0].name, "Hoa hồng");
    assert.equal(result.rows[0].price, 890000);
    assert.equal(result.rows[0].stock, 5);
  });

  it("parseImport chuyển đúng định dạng", () => {
    const csv = parseImport("externalId,name,price\nX1,Hoa,100\n", "csv");
    assert.equal(csv.rows.length, 1);
    const json = parseImport(
      '[{"externalId":"X1","name":"Hoa","price":100}]',
      "json",
    );
    assert.equal(json.rows.length, 1);
  });
});

describe("ô công thức (Ngày 20 C2)", () => {
  it("isFormulaCell nhận =, +, -, @, tab, CR; từ chối còn lại", () => {
    for (const v of ["=1+1", "+1", "-1", "@x", "\tx", "\rx"]) {
      assert.equal(isFormulaCell(v), true, JSON.stringify(v));
    }
    for (const v of ["", "abc", " 1", "1+1", "= "]) {
      // "= " vẫn bắt đầu bằng `=` nên là công thức; kiểm riêng dưới.
      if (v === "= ") continue;
      assert.equal(isFormulaCell(v), false, JSON.stringify(v));
    }
    assert.equal(isFormulaCell("= "), true);
  });

  it("ô công thức được GIỮ NGUYÊN + đánh cờ, ghi rõ field", () => {
    const formula = "=2+5+cmd|' /C calc'!A0";
    const result = parseCsv(
      `${HEADER}\nX1,${formula},,890000,,,,,\n`,
    );
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows.length, 1);
    // Dữ liệu không bị sửa.
    assert.equal(result.rows[0].name, formula);
    assert.equal(result.rows[0].formulaFlagged, true);
    assert.deepEqual(result.rows[0].flaggedFields, ["name"]);
  });

  it("ô giá trị âm vừa bị cờ vừa lỗi giá (cờ không thay kiểm tra)", () => {
    const result = parseCsv(`${HEADER}\nX1,Hoa hồng,,-5,,,,,\n`);
    assert.equal(result.rows.length, 0);
    assert.match(result.errors[0].reason, /giá/);
  });
});

describe("parse JSON (Ngày 20 C2)", () => {
  it("mảng ở gốc", () => {
    const result = parseJson(
      '[{"externalId":"X1","name":"Hoa hồng","price":890000}]',
    );
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows[0].price, 890000);
    assert.equal(result.totalLines, 1);
  });

  it("object có khóa items / products / data", () => {
    const item = '{"externalId":"X1","name":"Hoa hồng","price":890000}';
    for (const key of ["items", "products", "data"]) {
      const result = parseJson(`{"${key}":[${item}]}`);
      assert.equal(result.errors.length, 0, key);
      assert.equal(result.rows.length, 1, key);
    }
  });

  it("object không có khóa mảng → lỗi toàn cục; JSON sai cú pháp → lỗi toàn cục", () => {
    const noKey = parseJson('{"foo":[]}');
    assert.equal(noKey.rows.length, 0);
    assert.equal(noKey.errors[0].line, 0);
    const badSyntax = parseJson('{"items":[');
    assert.equal(badSyntax.rows.length, 0);
    assert.equal(badSyntax.errors[0].line, 0);
    const scalar = parseJson("42");
    assert.equal(scalar.errors[0].line, 0);
  });

  it("phần tử không phải object → lỗi đúng dòng (chỉ số + 1)", () => {
    const result = parseJson(
      '[{"externalId":"X1","name":"Hoa hồng","price":100},"chuỗi",42]',
    );
    assert.equal(result.rows.length, 1);
    assert.deepEqual(
      result.errors.map((e) => e.line),
      [2, 3],
    );
  });

  it("imageUrls dạng mảng JSON; stock/salePrice dạng số", () => {
    const result = parseJson(
      '[{"externalId":"X1","name":"Hoa hồng","price":100000,"salePrice":90000,"imageUrls":["https://a.test/a.jpg","https://a.test/b.jpg"],"stock":3}]',
    );
    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.rows[0].imageUrls, ["https://a.test/a.jpg", "https://a.test/b.jpg"]);
    assert.equal(result.rows[0].salePrice, 90000);
    assert.equal(result.rows[0].stock, 3);
  });

  it("JSON lồng sâu 1.000 tầng → lỗi toàn cục, không stack overflow", () => {
    const item = JSON.stringify({
      externalId: "X1",
      name: "Hoa hồng",
      price: 100,
    });
    const deep = "[".repeat(1000) + item + "]".repeat(1000);
    let result: ParseResult | undefined;
    assert.doesNotThrow(() => {
      result = parseJson(deep);
    });
    assert.equal(result?.rows.length, 0);
    assert.equal(result?.errors[0]?.line, 0);
    assert.match(result?.errors[0]?.reason ?? "", /quá sâu/);
  });

  it("mảng 1.000.000 phần tử → lỗi nhanh, không duyệt sâu", () => {
    const big = "[" + "1,".repeat(999999) + "1]";
    const started = Date.now();
    const result = parseJson(big);
    const elapsed = Date.now() - started;
    assert.equal(result.rows.length, 0);
    assert.equal(result.errors[0].line, 0);
    assert.match(result.errors[0].reason, /vượt quá 2000 phần tử/);
    assert.ok(elapsed < 5000, `parse 1M phần tử mất ${elapsed}ms`);
  });

  it("__proto__ trong JSON bị từ chối (B2) và không làm nhiễm prototype", () => {
    const result = parseJson(
      '{"items":[{"__proto__":{"polluted":true},"externalId":"X1","name":"Hoa hồng","price":100}]}',
    );
    assert.equal(result.rows.length, 0);
    assert.match(result.errors[0].reason, /__proto__/);
    assert.equal(
      ({} as Record<string, unknown>)["polluted"],
      undefined,
    );
  });

  it("quá 2.000 phần tử → lỗi toàn cục", () => {
    const items = Array.from({ length: 2001 }, (_, i) => ({
      externalId: `X${i}`,
      name: "Hoa",
      price: 100,
    }));
    const result = parseJson(JSON.stringify({ items }));
    assert.equal(result.rows.length, 0);
    assert.equal(result.errors[0].line, 0);
    assert.equal(result.totalLines, 2001);
  });
});

describe("giới hạn đầu vào + làm sạch (Ngày 20 bản sau Retry B2/B5/B6)", () => {
  it("CSV quá 40 cột → lỗi toàn cục dòng 1", () => {
    const header = Array.from({ length: 41 }, (_, i) => `c${i}`).join(",");
    const result = parseCsv(`${header}\n${"x,".repeat(40)}x\n`);
    assert.equal(result.rows.length, 0);
    assert.equal(result.errors[0].line, 1);
    assert.match(result.errors[0].reason, /40 cột/);
  });

  it("CSV ô quá 5000 ký tự → lỗi dòng đó, dòng khác vẫn đọc", () => {
    const big = "a".repeat(5001);
    const result = parseCsv(
      `${HEADER}\nX1,Hoa hồng,${big},100000,,,,,\nX2,Hoa lan,,200000,,,,,\n`,
    );
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].externalId, "X2");
    assert.match(result.errors[0].reason, /5000 ký tự/);
  });

  it("tệp nhị phân/UTF-16 (byte NUL) → lỗi toàn cục", () => {
    const csv = parseCsv("externalId,name,price\nX1,Hoa\u0000hồng,100000\n");
    assert.equal(csv.rows.length, 0);
    assert.match(csv.errors[0].reason, /nhị phân|UTF-16/);
    const json = parseJson('[{"externalId":"X1","name":"Hoa\u0000","price":100}]');
    assert.equal(json.rows.length, 0);
    assert.match(json.errors[0].reason, /nhị phân|UTF-16/);
  });

  it("JSON sâu 7 tầng → lỗi (giới hạn 6); sâu 6 ok", () => {
    const deep7 = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
    const bad = parseJson(JSON.stringify({ items: [deep7] }));
    assert.equal(bad.rows.length, 0);
    assert.match(bad.errors[0].reason, /6 tầng/);
    const deep6 = { a: { b: 1 } }; // extra(4) → a(5) → b(6): đúng giới hạn
    const ok = parseJson(
      JSON.stringify({ items: [{ externalId: "X1", name: "Hoa", price: 100, extra: deep6 }] }),
    );
    assert.equal(ok.rows.length, 1);
  });

  it("JSON chứa khóa __proto__/constructor/prototype → lỗi toàn cục", () => {
    for (const key of ["__proto__", "constructor", "prototype"]) {
      const raw = `{"items":[{"externalId":"X1","name":"Hoa","price":100,"${key}":{"x":1}}]}`;
      const result = parseJson(raw);
      assert.equal(result.rows.length, 0, `khóa ${key} phải bị từ chối`);
      assert.match(result.errors[0].reason, new RegExp(key));
    }
  });

  it("làm sạch văn bản: bỏ thẻ HTML, ký tự điều khiển, gọn khoảng trắng", () => {
    const result = parseCsv(
      `${HEADER}\nX1,"<b>Hoa   hồng</b>  đỏ",<script>alert(1)</script>mô tả,100000,,,,,\n`,
    );
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].name, "Hoa hồng đỏ");
    assert.equal(result.rows[0].description, "alert(1)mô tả"); // chỉ bỏ thẻ, giữ text
  });

  it("xuất CSV lỗi: ô công thức được vô hiệu bằng dấu nháy đơn", async () => {
    const { buildErrorsCsv, neutralizeCsvCell } = await import("./parse");
    assert.equal(neutralizeCsvCell("=2+2"), "'=2+2");
    assert.equal(neutralizeCsvCell("+cmd"), "'+cmd");
    assert.equal(neutralizeCsvCell("bình thường"), "bình thường");
    const csv = buildErrorsCsv([
      { line: 2, reason: "=cmd|calc" },
      { line: 3, reason: "thiếu tên" },
    ]);
    assert.ok(csv.startsWith("Dòng,Lý do"));
    assert.ok(csv.includes("'=cmd|calc"), "ô công thức phải có dấu nháy đơn");
    assert.ok(csv.includes("thiếu tên"));
  });
});
