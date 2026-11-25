// Unit test quy tắc thuần của biểu mẫu danh mục (25/11).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateCategoryForm } from "./category-validation";

describe("validateCategoryForm", () => {
  it("tên hợp lệ + slug trống → tự sinh slug từ tên", () => {
    const { errors, values } = validateCategoryForm({
      name: "Hoa Khai Trương",
      slug: "",
      sortOrder: "",
    });
    assert.deepEqual(errors, {});
    assert.equal(values?.slug, "hoa-khai-truong");
    assert.equal(values?.sortOrder, 0);
  });

  it("tên quá ngắn → lỗi name", () => {
    const { errors, values } = validateCategoryForm({
      name: "AB",
      slug: "",
      sortOrder: "1",
    });
    assert.equal(values, null);
    assert.equal(errors.name, "Tên danh mục phải từ 3 đến 120 ký tự.");
  });

  it("slug nhập tay sai mẫu → lỗi slug", () => {
    const { errors, values } = validateCategoryForm({
      name: "Hoa Đẹp",
      slug: "Hoa Đẹp!",
      sortOrder: "1",
    });
    assert.equal(values, null);
    assert.match(errors.slug ?? "", /chữ thường, số và dấu gạch nối/);
  });

  it("slug trùng đường dẫn cố định → lỗi slug", () => {
    const { errors, values } = validateCategoryForm({
      name: "Giỏ Hàng",
      slug: "cart",
      sortOrder: "1",
    });
    assert.equal(values, null);
    assert.equal(
      errors.slug,
      "Đường dẫn này đã được hệ thống dùng, vui lòng chọn đường dẫn khác.",
    );
  });

  it("slug trùng /admin cũng bị chặn", () => {
    const { values } = validateCategoryForm({
      name: "Quản Trị",
      slug: "admin",
      sortOrder: "1",
    });
    assert.equal(values, null);
  });

  it("thứ tự ngoài khoảng → lỗi sortOrder", () => {
    const { errors, values } = validateCategoryForm({
      name: "Hoa Đẹp",
      slug: "hoa-dep",
      sortOrder: "10000",
    });
    assert.equal(values, null);
    assert.equal(errors.sortOrder, "Thứ tự sắp xếp phải từ 0 đến 9999.");
  });

  it("thứ tự không phải số nguyên → lỗi sortOrder", () => {
    const { errors } = validateCategoryForm({
      name: "Hoa Đẹp",
      slug: "hoa-dep",
      sortOrder: "1.5",
    });
    assert.equal(errors.sortOrder, "Thứ tự sắp xếp phải là số nguyên.");
  });
});
