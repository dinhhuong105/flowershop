// Test DB cho bộ nhập sản phẩm (Ngày 20 C5/C6, căn chỉnh bản sau
// Retry B2/B5/B9): upsert theo khóa (sourceName, externalId), SP đã
// duyệt → chỉ cập nhật giá (không ghi đè tên/mô tả), trùng SKU →
// hàng LỖI "SKU đã tồn tại", trùng slug hệ thống → bỏ qua, duyệt/
// từ chối/hoàn tác, needsReview ẩn khỏi tìm kiếm, giới hạn 5 lô/giờ
// + 20 lô/ngày, tải feed 10 lần/giờ, chạy song song không trùng
// hàng. Chỉ chạy khi DATABASE_URL trỏ localhost. Dữ liệu tự tạo
// (tiền tố "IMP-TEST") rồi tự xóa, kể cả lô nhập và nhật ký
// import:/product:IMP-*. Dọn cả lô nhập của lần chạy trước để
// giới hạn giờ/ngày không rò sang lần chạy sau.
// Chạy: npx tsx --test src/lib/admin/import-batches.db.test.ts
process.loadEnvFile(".env");

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const dbHost = (() => {
  try {
    return new URL((process.env.DATABASE_URL ?? "").trim()).hostname;
  } catch {
    return "";
  }
})();
if (dbHost !== "localhost" && dbHost !== "127.0.0.1" && dbHost !== "::1") {
  throw new Error(
    `[test:db] Từ chối chạy: DATABASE_URL không phải localhost (host: ${dbHost || "(trống)"}).`,
  );
}

import { db } from "@/lib/db";
import { searchProducts } from "../search";
import {
  approveImportedProducts,
  cancelImportBatch,
  computePreview,
  confirmImportRights,
  createImportBatch,
  getImportBatch,
  rejectImportedProduct,
  runImportChunk,
  saveImportMapping,
  undoImportBatch,
  DEFAULT_PRICE_OPTIONS,
  type PriceOptions,
} from "./import-batches";

const SRC = "IMP TEST";
const CAT_SLUG = "hoa-tuoi";
const CSV_1 = `sku,name,price,category,stock
IMP-001,Bó Hoa Nhập Test Một,250000,Hoa tươi,5
IMP-002,Bó Hoa Nhập Test Hai,320000,Hoa tươi,3
`;
// IMP-001 đổi tên trong file (để chứng minh B5: SP đã duyệt chỉ
// đổi giá, tên cũ giữ nguyên) + đổi giá 250000 → 260000.
const CSV_2 = `sku,name,price,category,stock
IMP-001,Bó Hoa Nhập Test Một ĐỔI TÊN,260000,Hoa tươi,5
IMP-003,Bó Hoa Nhập Test Ba,180000,Hoa tươi,2
`;
const CSV_3 = `sku,name,price,category,stock
IMP-001,Bó Hoa Nhập Test Một,270000,Hoa tươi,5
`;
const CSV_SYS = `sku,name,price,category,stock
HT-001,Bó Hoa Trùng SKU Hệ Thống,100000,Hoa tươi,1
IMP-004,Bó Hồng Đỏ Tình Yêu,100000,Hoa tươi,1
`;

const createdBatchIds: number[] = [];

async function cleanup() {
  // Dọn toàn bộ dữ liệu nhập (mọi nguồn) để lần chạy sau không
  // dính giới hạn giờ/ngày của lần này; SP seed/hệ thống không
  // phải source=import nên không bị chạm.
  await db.product.deleteMany({ where: { source: "import" } });
  await db.importBatch.deleteMany({});
  await db.rateLimitEvent.deleteMany({
    where: { key: "import:feed-fetch:global" },
  });
  for (const id of createdBatchIds) {
    await db.settingsAudit.deleteMany({ where: { key: `import:${id}` } });
  }
  await db.settingsAudit.deleteMany({
    where: { key: { startsWith: "product:IMP-" } },
  });
}

describe("import sản phẩm (Ngày 20 C5/C6)", () => {
  let catId = 0;
  let batch1 = 0;
  let batch2 = 0;
  let batch3 = 0;
  let batch4 = 0;
  let batch5 = 0;
  let prod1 = 0;
  let prod2 = 0;
  let prod3 = 0;

  before(async () => {
    await cleanup();
    const cat = await db.category.findUnique({ where: { slug: CAT_SLUG } });
    assert.ok(cat, "cần danh mục seed hoa-tuoi");
    catId = cat.id;
  });

  after(async () => {
    await cleanup();
  });

  async function createAndMap(csv: string, priceOptions: PriceOptions = DEFAULT_PRICE_OPTIONS) {
    const created = await createImportBatch({
      sourceName: SRC,
      kind: "file",
      fileName: "nhap-test.csv",
      fileContent: csv,
      createdBy: "test",
    });
    assert.equal(created.ok, true, created.ok ? "" : created.error);
    if (!created.ok) throw new Error("không tạo được lô");
    createdBatchIds.push(created.batchId);
    const batch = await getImportBatch(created.batchId);
    assert.ok(batch, "lô vừa tạo phải đọc được");
    const saved = await saveImportMapping(
      created.batchId,
      batch.payload.mapping,
      { "Hoa tươi": catId },
      null,
      priceOptions,
    );
    assert.equal(saved.ok, true, saved.ok ? "" : saved.error);
    return created.batchId;
  }

  async function runBatch(id: number) {
    const rights = await confirmImportRights(id, true, SRC);
    assert.equal(rights.ok, true, rights.ok ? "" : rights.error);
    const run = await runImportChunk(id);
    assert.equal(run.ok, true, run.ok ? "" : run.error);
    if (!run.ok || !run.done) throw new Error("lô chưa chạy xong");
    return run;
  }

  it("tạo lô CSV + ánh xạ tự động + xem trước: 2 dòng mới → tạo mới", async () => {
    batch1 = await createAndMap(CSV_1);
    const preview = await computePreview(batch1);
    assert.ok(preview);
    assert.equal(preview.total, 2);
    assert.equal(preview.toCreate, 2);
    assert.equal(preview.toUpdate, 0);
    assert.equal(preview.toSkip, 0);
    assert.equal(preview.errorTotal, 0);
  });

  it("chạy lô: tạo 2 SP import needsReview, ẩn khỏi tìm kiếm", async () => {
    const run = await runBatch(batch1);
    assert.equal(run.created, 2);
    assert.equal(run.done, true);
    const rows = await db.product.findMany({
      where: { sourceName: SRC },
      orderBy: { sku: "asc" },
    });
    assert.equal(rows.length, 2);
    for (const r of rows) {
      assert.equal(r.source, "import");
      assert.equal(r.needsReview, true);
      assert.equal(r.isActive, false);
      assert.equal(r.importBatchId, batch1);
      assert.ok(r.importedAt);
    }
    prod1 = rows[0].id; // IMP-001
    prod2 = rows[1].id; // IMP-002
    const found = await searchProducts("Bó Hoa Nhập Test Một");
    assert.equal(found.total, 0, "SP chờ duyệt phải ẩn khỏi tìm kiếm");
  });

  it("duyệt 1 SP (đồng thời hiện) → hiện ra tìm kiếm; updatedAt giữ nguyên", async () => {
    const before = await db.product.findUniqueOrThrow({ where: { id: prod1 } });
    const res = await approveImportedProducts([prod1], true);
    assert.equal(res.approved, 1);
    assert.deepEqual(res.missing, []);
    const afterRow = await db.product.findUniqueOrThrow({ where: { id: prod1 } });
    assert.equal(afterRow.needsReview, false);
    assert.equal(afterRow.isActive, true);
    // Duyệt không chạm updatedAt (giữ nguyên mốc nhập để nhật ký
    // rõ ràng; quy tắc "sửa tay" của Ngày 20 đã bỏ ở bản sau Retry).
    assert.ok(
      afterRow.updatedAt.getTime() - (afterRow.importedAt?.getTime() ?? 0) <= 1000,
      `updatedAt lệch importedAt quá 1s: ${afterRow.updatedAt} vs ${afterRow.importedAt}`,
    );
    assert.equal(afterRow.updatedAt.getTime(), before.updatedAt.getTime());
    const found = await searchProducts("Bó Hoa Nhập Test Một");
    assert.equal(found.total, 1);
    assert.equal(found.products[0].id, prod1);
  });

  it("từ chối 1 SP → xóa + ghi nhật ký", async () => {
    const res = await rejectImportedProduct(prod2);
    assert.equal(res.ok, true, res.ok ? "" : res.error);
    assert.equal(await db.product.count({ where: { id: prod2 } }), 0);
    const audit = await db.settingsAudit.findMany({
      where: { key: "product:IMP-002" },
    });
    assert.ok(audit.length >= 1, "phải có nhật ký xóa SP");
  });

  it("nhập lại cùng khóa: SP đã duyệt → chỉ cập nhật giá, tên cũ giữ nguyên (B5)", async () => {
    batch2 = await createAndMap(CSV_2);
    const preview = await computePreview(batch2);
    assert.ok(preview);
    assert.equal(preview.toUpdate, 1, "IMP-001 đã tồn tại → cập nhật");
    assert.equal(preview.toCreate, 1, "IMP-003 mới → tạo mới");
    const priceOnlyRow = preview.rows.find((r) => r.externalId === "IMP-001");
    assert.ok(priceOnlyRow, "xem trước phải có hàng IMP-001");
    assert.equal(priceOnlyRow.priceOnly, true, "SP đã duyệt → chỉ cập nhật giá");
    assert.equal(priceOnlyRow.reason, "chỉ cập nhật giá");
    const run = await runBatch(batch2);
    assert.equal(run.updated, 1);
    assert.equal(run.created, 1);
    // Chạy lại cùng tệp → cập nhật, không tạo trùng.
    assert.equal(
      await db.product.count({ where: { sourceName: SRC, sourceExternalId: "IMP-001" } }),
      1,
      "IMP-001 chỉ có đúng 1 SP sau khi nhập lại",
    );
    const p1 = await db.product.findUniqueOrThrow({ where: { id: prod1 } });
    assert.equal(p1.price, 260000);
    assert.equal(
      p1.name,
      "Bó Hoa Nhập Test Một",
      "tên trong file đã đổi nhưng SP đã duyệt KHÔNG bị ghi đè tên",
    );
    assert.equal(p1.needsReview, false, "cập nhật không bật lại chờ duyệt");
    const p3 = await db.product.findFirstOrThrow({ where: { sku: "IMP-003" } });
    prod3 = p3.id;
    assert.equal(p3.needsReview, true);
  });

  it("sửa tay sau khi nhập → nhập lại vẫn chỉ đổi giá, không ghi đè phần sửa tay (B5)", async () => {
    // Giả lập sửa tay: đổi tên + mô tả trực tiếp trong DB.
    await db.product.update({
      where: { id: prod1 },
      data: {
        name: "Bó Hoa ĐÃ SỬA TAY",
        description: "Mô tả đã sửa tay",
      },
    });
    batch3 = await createAndMap(CSV_3);
    const preview = await computePreview(batch3);
    assert.ok(preview);
    assert.equal(preview.toUpdate, 1, "SP đã duyệt → cập nhật chỉ-giá");
    assert.equal(preview.toSkip, 0, "không còn luật bỏ qua khi sửa tay");
    const run = await runBatch(batch3);
    assert.equal(run.updated, 1);
    const p1 = await db.product.findUniqueOrThrow({ where: { id: prod1 } });
    assert.equal(p1.price, 270000);
    assert.equal(p1.name, "Bó Hoa ĐÃ SỬA TAY", "tên sửa tay giữ nguyên");
    assert.equal(p1.description, "Mô tả đã sửa tay", "mô tả sửa tay giữ nguyên");
    // Hàng chạy xong ghi "giá đổi" vào message.
    const row = await db.importRow.findFirstOrThrow({
      where: { batchId: batch3, externalId: "IMP-001" },
    });
    assert.equal(row.status, "UPDATED");
    assert.equal(row.message, "giá đổi");
  });

  it("trùng SKU → hàng LỖI 'SKU đã tồn tại'; trùng slug hệ thống → bỏ qua, không đổi SP hệ thống (B5)", async () => {
    batch4 = await createAndMap(CSV_SYS);
    const preview = await computePreview(batch4);
    assert.ok(preview);
    assert.equal(preview.toSkip, 1, "IMP-004 trùng đường dẫn SP hệ thống → bỏ qua");
    assert.equal(preview.errorTotal, 1, "HT-001 trùng SKU hệ thống → lỗi");
    assert.ok(
      Object.keys(preview.errorReasons).some((r) => r.includes("SKU đã tồn tại")),
      `phải có lý do "SKU đã tồn tại": ${JSON.stringify(preview.errorReasons)}`,
    );
    assert.ok(
      Object.keys(preview.skipReasons).some((r) => r.includes("trùng đường dẫn")),
      `phải có lý do trùng đường dẫn: ${JSON.stringify(preview.skipReasons)}`,
    );
    const sys = await db.product.findUniqueOrThrow({ where: { sku: "HT-001" } });
    assert.equal(sys.name, "Bó Hồng Đỏ Tình Yêu", "SP hệ thống không bị đổi");
  });

  it("hoàn tác lô: xóa SP còn chờ duyệt, giữ SP đã duyệt", async () => {
    // Lô 2: IMP-003 còn chờ duyệt → xóa; IMP-001 đã chuyển sang lô 3
    // sau lần cập nhật chỉ-giá nên không còn thuộc lô 2.
    const res = await undoImportBatch(batch2);
    assert.equal(res.ok, true, res.ok ? "" : res.error);
    if (!res.ok) throw new Error("hoàn tác thất bại");
    assert.equal(res.deleted, 1, "chỉ xóa IMP-003 còn chờ duyệt");
    assert.equal(await db.product.count({ where: { id: prod3 } }), 0);
    assert.equal(await db.product.count({ where: { id: prod1 } }), 1);
    const batch = await getImportBatch(batch2);
    assert.equal(batch?.status, "ROLLED_BACK");
    const audit = await db.settingsAudit.findMany({
      where: { key: `import:${batch2}` },
    });
    assert.ok(
      audit.some((a) => (a.newValue ?? "").includes("Hoàn tác")),
      "phải có nhật ký hoàn tác",
    );
    // Lô 3: chỉ có IMP-001 đã duyệt → không xóa gì, liệt kê giữ lại.
    const res3 = await undoImportBatch(batch3);
    assert.equal(res3.ok, true, res3.ok ? "" : res3.error);
    if (!res3.ok) throw new Error("hoàn tác lô 3 thất bại");
    assert.equal(res3.deleted, 0);
    assert.ok(
      res3.kept.some((k) => k.id === prod1 && k.reason === "đã duyệt"),
      `SP đã duyệt phải nằm trong danh sách giữ lại: ${JSON.stringify(res3.kept)}`,
    );
    assert.equal(await db.product.count({ where: { id: prod1 } }), 1);
  });

  it("B1: lô mới ghi import_rows + sourceKind/fileSha256/rowsTotal", async () => {
    const rows = await db.importRow.findMany({
      where: { batchId: batch1 },
      orderBy: { rowIndex: "asc" },
    });
    assert.equal(rows.length, 2, "lô 1 có 2 dòng");
    assert.ok(rows.every((r) => r.status === "CREATED"), "sau khi chạy xong, các hàng là CREATED");
    assert.equal(rows[0].externalId, "IMP-001");
    assert.ok(rows[0].productId !== null, "hàng CREATED phải nối productId");
    const batch = await getImportBatch(batch1);
    assert.equal(batch?.sourceKind, "CSV");
    assert.equal(batch?.rowsTotal, 2);
    assert.equal(batch?.fileSha256?.length, 64, "sha256 hex 64 ký tự");
    assert.equal(batch?.status, "DONE");
    assert.equal(batch?.created, 2);
  });

  it("B1: hủy lô chưa chạy → vẫn PREVIEW (chạy tiếp được), không mất hàng", async () => {
    // Dùng lô 4 (đã tạo, chưa chạy) để không chạm giới hạn 5 lô/giờ.
    const before = await getImportBatch(batch4);
    assert.equal(before?.status, "PREVIEW");
    const res = await cancelImportBatch(batch4);
    assert.equal(res.ok, true);
    const batch = await getImportBatch(batch4);
    assert.equal(batch?.status, "PREVIEW");
    const rows = await db.importRow.findMany({ where: { batchId: batch4 } });
    assert.equal(rows.length, 2, "hủy không xóa hàng");
    assert.ok(rows.every((r) => r.status === "PENDING"), "hàng vẫn PENDING để chạy tiếp");
  });

  it("B9: tải feed 10 lần/giờ — lần thứ 11 bị chặn (fail-closed)", async () => {
    const url = "https://feed-khong-ton-tai.invalid/feed.json";
    for (let i = 0; i < 10; i++) {
      const r = await createImportBatch({
        sourceName: SRC,
        kind: "feed",
        sourceUrl: url,
        createdBy: "test",
      });
      assert.equal(r.ok, false, `lần tải ${i + 1} phải lỗi (feed không tồn tại)`);
      if (!r.ok) {
        assert.ok(
          r.error.includes("Không tải được feed"),
          `lần ${i + 1} phải lỗi tải feed, nhận: ${r.error}`,
        );
      }
    }
    const blocked = await createImportBatch({
      sourceName: SRC,
      kind: "feed",
      sourceUrl: url,
      createdBy: "test",
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.ok(
        blocked.error.includes("10 lần tải feed"),
        `lần 11 phải bị chặn giới hạn: ${blocked.error}`,
      );
    }
  });

  it("B3: tùy chọn giá — hệ số + làm tròn; salePrice bằng giá gốc → lỗi", async () => {
    const csv = `sku,name,price,salePrice,category,stock
IMP-P1,Bó Hoa Giá Test Một,100000,90000,Hoa tươi,2
IMP-P2,Bó Hoa Giá Test Hai,99900,99900,Hoa tươi,2
IMP-P3,Bó Hoa Giá Test Ba,500,,Hoa tươi,2
IMP-P4,"Bó Hoa SQLi Test "'; DROP TABLE products; --",100000,"'; DROP TABLE products; --",Hoa tươi,1
`;
    const created = await createImportBatch({
      sourceName: SRC,
      kind: "file",
      fileName: "nhap-gia-test.csv",
      fileContent: csv,
      createdBy: "test",
    });
    assert.equal(created.ok, true, created.ok ? "" : created.error);
    if (!created.ok) throw new Error("không tạo được lô giá");
    batch5 = created.batchId;
    createdBatchIds.push(batch5);
    const batch = await getImportBatch(batch5);
    assert.ok(batch);
    // Tùy chọn sai → từ chối, lô vẫn ở PREVIEW.
    for (const bad of [
      { multiplier: 0.05, rounding: "none" },
      { multiplier: 11, rounding: "none" },
      { multiplier: 1.005, rounding: "none" },
      { multiplier: 1, rounding: "500" },
    ] as const) {
      const r = await saveImportMapping(
        batch5,
        batch.payload.mapping,
        { "Hoa tươi": catId },
        null,
        // Cố tình truyền giá trị sai kiểu để kiểm validate phía server.
        bad as unknown as PriceOptions,
      );
      assert.equal(r.ok, false, `tùy chọn ${JSON.stringify(bad)} phải bị từ chối`);
    }
    // Hệ số 1,05, không làm tròn: 100000 → 105000.
    const ok1 = await saveImportMapping(
      batch5,
      batch.payload.mapping,
      { "Hoa tươi": catId },
      null,
      { multiplier: 1.05, rounding: "none" },
    );
    assert.equal(ok1.ok, true, ok1.ok ? "" : ok1.error);
    const preview1 = await computePreview(batch5);
    assert.ok(preview1);
    assert.equal(preview1.rows.find((r) => r.externalId === "IMP-P1")?.price, 105000);
    // Hệ số 1,5 + làm tròn 1000: 100000 → 150000, 500 → 1000.
    const ok2 = await saveImportMapping(
      batch5,
      batch.payload.mapping,
      { "Hoa tươi": catId },
      null,
      { multiplier: 1.5, rounding: "1000" },
    );
    assert.equal(ok2.ok, true, ok2.ok ? "" : ok2.error);
    const preview2 = await computePreview(batch5);
    assert.ok(preview2);
    assert.equal(preview2.toCreate, 3, "P1, P3, P4 tạo mới (P2 lỗi)");
    assert.equal(preview2.errorTotal, 1, "IMP-P2 salePrice bằng giá gốc → lỗi");
    assert.ok(
      Object.keys(preview2.errorReasons).some((r) => r.includes("nhỏ hơn giá gốc")),
      `lý do phải nói salePrice nhỏ hơn giá gốc: ${JSON.stringify(preview2.errorReasons)}`,
    );
    assert.equal(preview2.rows.find((r) => r.externalId === "IMP-P1")?.price, 150000);
    assert.equal(preview2.rows.find((r) => r.externalId === "IMP-P1")?.salePrice, 135000);
    assert.equal(preview2.rows.find((r) => r.externalId === "IMP-P3")?.price, 1000);
  });

  it("B11: hai lần chạy song song trên 1 lô không xử lý trùng hàng", async () => {
    const rights = await confirmImportRights(batch5, true, SRC);
    assert.equal(rights.ok, true, rights.ok ? "" : rights.error);
    const [r1, r2] = await Promise.all([
      runImportChunk(batch5),
      runImportChunk(batch5),
    ]);
    assert.ok(r1.ok || r2.ok, "ít nhất một lần chạy phải xong");
    // Mỗi SP chỉ tạo đúng 1 lần dù chạy song song.
    assert.equal(await db.product.count({ where: { sku: "IMP-P1" } }), 1);
    assert.equal(await db.product.count({ where: { sku: "IMP-P3" } }), 1);
    assert.equal(await db.product.count({ where: { sku: "IMP-P4" } }), 1);
    // B11 SQLi: chuỗi độc lưu nguyên văn, bảng vẫn nguyên vẹn.
    const p4 = await db.product.findUniqueOrThrow({ where: { sku: "IMP-P4" } });
    assert.equal(p4.name, `Bó Hoa SQLi Test "'; DROP TABLE products; --`);
    assert.equal(p4.description, "'; DROP TABLE products; --");
    const rows = await db.importRow.findMany({
      where: { batchId: batch5 },
      orderBy: { rowIndex: "asc" },
    });
    assert.deepEqual(
      rows.map((r) => r.status),
      ["CREATED", "ERROR", "CREATED", "CREATED"],
    );
    const batch = await getImportBatch(batch5);
    assert.equal(batch?.status, "DONE");
    assert.equal(batch?.created, 3);
    assert.equal(batch?.failed, 1);
  });

  it("B11: hạn giữ (lease) chặn lần chạy thứ hai khi lô đang chạy", async () => {
    const before = await getImportBatch(batch4);
    assert.ok(before);
    await db.importBatch.update({
      where: { id: batch4 },
      data: {
        payload: {
          parseErrors: before.payload.errors,
          runStartedAt: new Date().toISOString(),
          runLeaseUntil: new Date(Date.now() + 30_000).toISOString(),
        } as unknown as object,
      },
    });
    const busy = await runImportChunk(batch4);
    assert.equal(busy.ok, false);
    if (!busy.ok) {
      assert.ok(busy.error.includes("đang chạy"), `phải báo đang chạy: ${busy.error}`);
    }
    // Dọn hạn giữ để trạng thái cuối sạch.
    await db.importBatch.update({
      where: { id: batch4 },
      data: {
        payload: {
          parseErrors: before.payload.errors,
          runStartedAt: null,
          runLeaseUntil: null,
        } as unknown as object,
      },
    });
  });

  it("B9: giới hạn 5 lô/giờ + 20 lô/ngày (toàn cục)", async () => {
    // Đã có 5 lô trong giờ (lô 1–5) → lô thứ 6 bị chặn theo giờ.
    const sixth = await createImportBatch({
      sourceName: SRC,
      kind: "file",
      fileName: "nhap-test-6.csv",
      fileContent: CSV_3,
      createdBy: "test",
    });
    assert.equal(sixth.ok, false);
    if (!sixth.ok) {
      assert.ok(
        sixth.error.includes("5 lô trong 1 giờ"),
        `phải nói 5 lô trong 1 giờ: ${sixth.error}`,
      );
    }
    // Đẩy 5 lô kiểm tra ra khỏi cửa sổ giờ (3 giờ trước) + chèn
    // 15 lô cùng ngày → đủ 20 lô trong ngày, 0 lô trong giờ → lô
    // mới bị chặn theo ngày (không phải theo giờ).
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await db.importBatch.updateMany({
      where: { sourceName: SRC },
      data: { createdAt: threeHoursAgo },
    });
    for (let i = 0; i < 15; i++) {
      await db.importBatch.create({
        data: {
          sourceName: "IMP-LIMIT",
          kind: "file",
          sourceKind: "CSV",
          createdBy: "test",
          createdAt: threeHoursAgo,
        },
      });
    }
    const daily = await createImportBatch({
      sourceName: SRC,
      kind: "file",
      fileName: "nhap-test-7.csv",
      fileContent: CSV_3,
      createdBy: "test",
    });
    assert.equal(daily.ok, false);
    if (!daily.ok) {
      assert.ok(
        daily.error.includes("20 lô trong ngày"),
        `phải nói 20 lô trong ngày: ${daily.error}`,
      );
    }
  });
});
