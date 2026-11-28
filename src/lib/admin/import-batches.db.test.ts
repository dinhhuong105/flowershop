// Test DB cho bộ nhập sản phẩm (Ngày 20 C5/C6): upsert theo khóa
// (sourceName, externalId), sửa tay → bỏ qua + ghi đè, trùng SKU/slug
// hệ thống → bỏ qua, duyệt/từ chối/hoàn tác, needsReview ẩn khỏi
// tìm kiếm, giới hạn 5 lô/ngày. Chỉ chạy khi DATABASE_URL trỏ
// localhost. Dữ liệu tự tạo (tiền tố "IMP-TEST") rồi tự xóa, kể cả
// lô nhập và nhật ký import:/product:IMP-*.
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
} from "./import-batches";

const SRC = "IMP TEST";
const CAT_SLUG = "hoa-tuoi";
const CSV_1 = `sku,name,price,category,stock
IMP-001,Bó Hoa Nhập Test Một,250000,Hoa tươi,5
IMP-002,Bó Hoa Nhập Test Hai,320000,Hoa tươi,3
`;
const CSV_2 = `sku,name,price,category,stock
IMP-001,Bó Hoa Nhập Test Một,260000,Hoa tươi,5
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
  await db.product.deleteMany({ where: { sourceName: SRC } });
  await db.importBatch.deleteMany({ where: { sourceName: SRC } });
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

  async function createAndMap(csv: string) {
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
      false,
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
    // Duyệt không chạm updatedAt (nếu không, lần nhập lại sau sẽ nhầm
    // SP đã duyệt thành "đã chỉnh sửa tay").
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

  it("nhập lại cùng khóa: đã duyệt chưa sửa tay → cập nhật", async () => {
    batch2 = await createAndMap(CSV_2);
    const preview = await computePreview(batch2);
    assert.ok(preview);
    assert.equal(preview.toUpdate, 1, "IMP-001 đã tồn tại → cập nhật");
    assert.equal(preview.toCreate, 1, "IMP-003 mới → tạo mới");
    const run = await runBatch(batch2);
    assert.equal(run.updated, 1);
    assert.equal(run.created, 1);
    const p1 = await db.product.findUniqueOrThrow({ where: { id: prod1 } });
    assert.equal(p1.price, 260000);
    assert.equal(p1.needsReview, false, "cập nhật không bật lại chờ duyệt");
    const p3 = await db.product.findFirstOrThrow({ where: { sku: "IMP-003" } });
    prod3 = p3.id;
    assert.equal(p3.needsReview, true);
  });

  it("sửa tay sau khi nhập → bỏ qua; bật ghi đè → cập nhật", async () => {
    // Giả lập sửa tay: đẩy updatedAt ra sau importedAt hơn 1 giờ.
    await db.$executeRaw`UPDATE "products" SET "updatedAt" = NOW() + interval '1 hour' WHERE "id" = ${prod1}`;
    batch3 = await createAndMap(CSV_3);
    const preview = await computePreview(batch3);
    assert.ok(preview);
    assert.equal(preview.toSkip, 1, "đã sửa tay → bỏ qua");
    assert.ok(
      Object.keys(preview.skipReasons).some((r) => r.includes("chỉnh sửa tay")),
      `lý do phải nói "chỉnh sửa tay": ${JSON.stringify(preview.skipReasons)}`,
    );
    // Bật ghi đè rồi xem trước lại → cập nhật.
    const batch = await getImportBatch(batch3);
    assert.ok(batch);
    const saved = await saveImportMapping(
      batch3,
      batch.payload.mapping,
      { "Hoa tươi": catId },
      null,
      true,
    );
    assert.equal(saved.ok, true);
    const preview2 = await computePreview(batch3);
    assert.ok(preview2);
    assert.equal(preview2.toUpdate, 1);
    assert.equal(preview2.toSkip, 0);
    const run = await runBatch(batch3);
    assert.equal(run.updated, 1);
    const p1 = await db.product.findUniqueOrThrow({ where: { id: prod1 } });
    assert.equal(p1.price, 270000);
  });

  it("trùng SKU/slug hệ thống → bỏ qua, không đổi SP hệ thống", async () => {
    batch4 = await createAndMap(CSV_SYS);
    const preview = await computePreview(batch4);
    assert.ok(preview);
    assert.equal(preview.toSkip, 2);
    assert.ok(
      Object.keys(preview.skipReasons).some((r) => r.includes("trùng SKU hệ thống")),
      `phải có lý do trùng SKU hệ thống: ${JSON.stringify(preview.skipReasons)}`,
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
    // sau lần cập nhật ghi đè nên không còn thuộc lô 2.
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
    // Dùng lô 4 (đã tạo, chưa chạy) để không chạm giới hạn 5 lô/ngày.
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

  it("giới hạn 5 lô/ngày: lô thứ 5 được tạo, lô thứ 6 bị từ chối", async () => {
    const fifth = await createImportBatch({
      sourceName: SRC,
      kind: "file",
      fileName: "nhap-test-5.csv",
      fileContent: CSV_3,
      createdBy: "test",
    });
    assert.equal(fifth.ok, true, fifth.ok ? "" : fifth.error);
    if (fifth.ok) createdBatchIds.push(fifth.batchId);
    const sixth = await createImportBatch({
      sourceName: SRC,
      kind: "file",
      fileName: "nhap-test-6.csv",
      fileContent: CSV_3,
      createdBy: "test",
    });
    assert.equal(sixth.ok, false);
    if (!sixth.ok) {
      assert.ok(sixth.error.includes("5 lô"), `thông báo phải nói 5 lô: ${sixth.error}`);
    }
  });
});
