-- Cột "Nguồn" cho sản phẩm/danh mục (Ngày 17 P1): giá trị lấy từ đâu —
-- seed mẫu / nhập tay trong admin / nhập file. Dữ liệu cũ (toàn bộ là
-- seed mẫu Ngày 1) nhận mặc định 'seed'; sản phẩm/danh mục tạo mới
-- trong admin ghi 'manual' ở tầng ghi (xem products.ts/categories.ts).
ALTER TABLE "products" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'seed';
ALTER TABLE "categories" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'seed';
