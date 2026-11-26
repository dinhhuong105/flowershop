-- Ngày 15 C1: chỉ mục theo thời gian cho bảng nhật ký hoạt động
-- (settings_audit) — trang /admin/activity sắp xếp mới nhất trước,
-- lọc theo khoảng ngày, không tải toàn bộ bảng.
-- Rollback: DROP INDEX "settings_audit_createdAt_idx";
CREATE INDEX "settings_audit_createdAt_idx" ON "settings_audit"("createdAt");
