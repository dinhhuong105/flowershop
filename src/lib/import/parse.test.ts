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
    assert.equal(result.rows[0].description, "dòng 1\ndòng 2");
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

  it("giá: 0 lỗi, âm lỗi, chữ lỗi; 890000.5 và 890000,5 ok", () => {
    for (const bad of ["0", "-5", "abc", "1.000.000", "890 000"]) {
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
    // "890.000" kiểu VN KHÔNG được hiểu là 890.000: dấu `.` chỉ là
    // phân tách thập phân nên giá trị là 890.
    const vnStyle = parseCsv(`${HEADER}\nX1,Hoa hồng,,890.000,,,,,\n`);
    assert.equal(vnStyle.rows[0].price, 890);
  });

  it("salePrice > price → lỗi; bằng price thì ok; trống → null", () => {
    const over = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,150000,,,,\n`,
    );
    assert.match(over.errors[0].reason, /khuyến mãi/);
    const equal = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,100000,,,,\n`,
    );
    assert.equal(equal.errors.length, 0);
    assert.equal(equal.rows[0].salePrice, 100000);
    const empty = parseCsv(oneRowCsv());
    assert.equal(empty.rows[0].salePrice, null);
  });

  it("imageUrls: 7 ảnh → lỗi; phân tách `|` và `;` đều được", () => {
    const seven = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,,,${"a.jpg|".repeat(6)}a.jpg,,\n`,
    );
    assert.match(seven.errors[0].reason, /6 ảnh/);
    const pipes = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,,,a.jpg | b.jpg | c.jpg,,\n`,
    );
    assert.deepEqual(pipes.rows[0].imageUrls, ["a.jpg", "b.jpg", "c.jpg"]);
    const semis = parseCsv(
      `${HEADER}\nX1,Hoa hồng,,100000,,,a.jpg;b.jpg,,\n`,
    );
    assert.deepEqual(semis.rows[0].imageUrls, ["a.jpg", "b.jpg"]);
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
      '[{"externalId":"X1","name":"Hoa hồng","price":100000,"salePrice":90000,"imageUrls":["a.jpg","b.jpg"],"stock":3}]',
    );
    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.rows[0].imageUrls, ["a.jpg", "b.jpg"]);
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

  it("__proto__ trong JSON không làm nhiễm prototype", () => {
    const result = parseJson(
      '{"items":[{"__proto__":{"polluted":true},"externalId":"X1","name":"Hoa hồng","price":100}]}',
    );
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows.length, 1);
    assert.equal(
      ({} as Record<string, unknown>)["polluted"],
      undefined,
    );
    // raw vẫn giữ khóa __proto__ dưới dạng own property.
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.rows[0].raw, "__proto__"),
      true,
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
