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
      seoTitle: "",
      seoDescription: "",
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
      seoTitle: "",
      seoDescription: "",
    });
    assert.equal(values, null);
    assert.equal(errors.name, "Tên danh mục phải từ 3 đến 120 ký tự.");
  });

  it("slug nhập tay sai mẫu → lỗi slug", () => {
    const { errors, values } = validateCategoryForm({
      name: "Hoa Đẹp",
      slug: "Hoa Đẹp!",
      sortOrder: "1",
      seoTitle: "",
      seoDescription: "",
    });
    assert.equal(values, null);
    assert.match(errors.slug ?? "", /chữ thường, số và dấu gạch nối/);
  });

  it("slug trùng đường dẫn cố định → lỗi slug", () => {
    const { errors, values } = validateCategoryForm({
      name: "Giỏ Hàng",
      slug: "cart",
      sortOrder: "1",
      seoTitle: "",
      seoDescription: "",
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
      seoTitle: "",
      seoDescription: "",
    });
    assert.equal(values, null);
  });

  it("slug trùng đường dẫn cố định → lỗi slug (trang, checkout, search — Ngày 15 B1)", () => {
    for (const slug of ["trang", "checkout", "search"]) {
      const { values, errors } = validateCategoryForm({
        name: "Danh Mục Thử",
        slug,
        sortOrder: "1",
        seoTitle: "",
        seoDescription: "",
      });
      assert.equal(values, null, `slug ${slug} phải bị từ chối`);
      assert.ok(errors.slug, `slug ${slug} phải có lỗi slug`);
    }
  });

  it("thứ tự ngoài khoảng → lỗi sortOrder", () => {
    const { errors, values } = validateCategoryForm({
      name: "Hoa Đẹp",
      slug: "hoa-dep",
      sortOrder: "10000",
      seoTitle: "",
      seoDescription: "",
    });
    assert.equal(values, null);
    assert.equal(errors.sortOrder, "Thứ tự sắp xếp phải từ 0 đến 9999.");
  });

  it("thứ tự không phải số nguyên → lỗi sortOrder", () => {
    const { errors } = validateCategoryForm({
      name: "Hoa Đẹp",
      slug: "hoa-dep",
      sortOrder: "1.5",
      seoTitle: "",
      seoDescription: "",
    });
    assert.equal(errors.sortOrder, "Thứ tự sắp xếp phải là số nguyên.");
  });

  it("SEO: rỗng → null chuỗi; ≤ 120/160 → nhận; quá dài → lỗi (Ngày 14 D1)", () => {
    const { values } = validateCategoryForm({
      name: "Hoa Đẹp",
      slug: "hoa-dep",
      sortOrder: "1",
      seoTitle: "",
      seoDescription: "",
    });
    assert.equal(values?.seoTitle, "");
    assert.equal(values?.seoDescription, "");
    const ok = validateCategoryForm({
      name: "Hoa Đẹp",
      slug: "hoa-dep",
      sortOrder: "1",
      seoTitle: "T".repeat(120),
      seoDescription: "M".repeat(160),
    });
    assert.deepEqual(ok.errors, {});
    assert.equal(ok.values?.seoTitle.length, 120);
    const longTitle = validateCategoryForm({
      name: "Hoa Đẹp",
      slug: "hoa-dep",
      sortOrder: "1",
      seoTitle: "T".repeat(121),
      seoDescription: "",
    });
    assert.equal(longTitle.errors.seoTitle, "Tiêu đề SEO tối đa 120 ký tự.");
    const longDesc = validateCategoryForm({
      name: "Hoa Đẹp",
      slug: "hoa-dep",
      sortOrder: "1",
      seoTitle: "",
      seoDescription: "M".repeat(161),
    });
    assert.equal(longDesc.errors.seoDescription, "Mô tả SEO tối đa 160 ký tự.");
  });
});
