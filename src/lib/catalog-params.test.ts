import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCatalogHref,
  hasActiveFilter,
  parseCatalogParams,
} from "./catalog-params";
import type { CatalogParams } from "./catalog-params";

const BASE: CatalogParams = { dip: null, gia: null, sx: null, trang: 1 };

describe("parseCatalogParams", () => {
  it("giữ giá trị hợp lệ", () => {
    assert.deepEqual(parseCatalogParams({ dip: "sinh-nhat" }), {
      ...BASE,
      dip: "sinh-nhat",
    });
    assert.deepEqual(parseCatalogParams({ gia: "1-2tr" }), {
      ...BASE,
      gia: "1-2tr",
    });
    assert.deepEqual(parseCatalogParams({ sx: "gia-giam" }), {
      ...BASE,
      sx: "gia-giam",
    });
    assert.deepEqual(parseCatalogParams({ trang: "2" }), { ...BASE, trang: 2 });
  });

  it("giá trị không hợp lệ thành null", () => {
    assert.equal(parseCatalogParams({ dip: "abc" }).dip, null);
    assert.equal(parseCatalogParams({ gia: "xyz" }).gia, null);
    assert.equal(parseCatalogParams({ sx: ";DROP TABLE" }).sx, null);
    assert.equal(parseCatalogParams({ sx: "gia-tang;DROP TABLE products" }).sx, null);
    assert.equal(parseCatalogParams({ dip: "' OR 1=1--" }).dip, null);
  });

  it("trang không phải số nguyên dương thành 1", () => {
    for (const bad of ["abc", "0", "-1", "1.5", "", "99999999999999999999"]) {
      assert.equal(parseCatalogParams({ trang: bad }).trang, 1, bad);
    }
    assert.equal(parseCatalogParams({}).trang, 1);
    assert.equal(parseCatalogParams({ trang: "12" }).trang, 12);
  });

  it("trang quá lớn bị chặn trần ở 10000 (F-1)", () => {
    assert.equal(parseCatalogParams({ trang: "10000" }).trang, 10000);
    assert.equal(parseCatalogParams({ trang: "10001" }).trang, 10000);
    assert.equal(parseCatalogParams({ trang: "99999999999" }).trang, 10000);
    assert.equal(parseCatalogParams({ trang: "9007199254740991" }).trang, 10000);
  });

  it("tham số lặp lấy giá trị đầu tiên", () => {
    assert.deepEqual(
      parseCatalogParams({ dip: ["sinh-nhat", "khai-truong"] }),
      { ...BASE, dip: "sinh-nhat" },
    );
    assert.deepEqual(parseCatalogParams({ trang: ["3", "2"] }), {
      ...BASE,
      trang: 3,
    });
  });
});

describe("buildCatalogHref", () => {
  it("thứ tự tham số cố định dip, gia, sx, trang", () => {
    assert.equal(
      buildCatalogHref("hoa-tuoi", {
        dip: "sinh-nhat",
        gia: "1-2tr",
        sx: "gia-tang",
        trang: 2,
      }),
      "/hoa-tuoi?dip=sinh-nhat&gia=1-2tr&sx=gia-tang&trang=2",
    );
  });

  it("trang=1 bị bỏ khỏi URL", () => {
    assert.equal(
      buildCatalogHref("hoa-tuoi", { ...BASE, sx: "gia-giam", trang: 1 }),
      "/hoa-tuoi?sx=gia-giam",
    );
  });

  it("đổi dip/gia/sx thì bỏ trang", () => {
    const params: CatalogParams = { dip: null, gia: null, sx: "gia-tang", trang: 2 };
    assert.equal(
      buildCatalogHref("hoa-tuoi", params, { dip: "khai-truong" }),
      "/hoa-tuoi?dip=khai-truong&sx=gia-tang",
    );
    assert.equal(
      buildCatalogHref("hoa-tuoi", params, { sx: "gia-giam" }),
      "/hoa-tuoi?sx=gia-giam",
    );
    assert.equal(
      buildCatalogHref("hoa-tuoi", params, { gia: "tren-2tr" }),
      "/hoa-tuoi?gia=tren-2tr&sx=gia-tang",
    );
  });

  it("đổi trang thì giữ nguyên bộ lọc", () => {
    const params: CatalogParams = { dip: "khai-truong", gia: null, sx: "gia-giam", trang: 1 };
    assert.equal(
      buildCatalogHref("hoa-tuoi", params, { trang: 2 }),
      "/hoa-tuoi?dip=khai-truong&sx=gia-giam&trang=2",
    );
  });

  it("không có tham số nào thì chỉ trả /<slug>", () => {
    assert.equal(buildCatalogHref("hoa-tuoi", BASE), "/hoa-tuoi");
  });

  it("bỏ một tham số bằng null", () => {
    const params: CatalogParams = { dip: "sinh-nhat", gia: null, sx: null, trang: 1 };
    assert.equal(buildCatalogHref("hoa-tuoi", params, { dip: null }), "/hoa-tuoi");
  });
});

describe("hasActiveFilter", () => {
  it("chỉ trang thì false", () => {
    assert.equal(hasActiveFilter({ ...BASE, trang: 2 }), false);
  });

  it("dip/gia/sx khác null thì true", () => {
    assert.equal(hasActiveFilter({ ...BASE, dip: "sinh-nhat" }), true);
    assert.equal(hasActiveFilter({ ...BASE, gia: "duoi-1tr" }), true);
    assert.equal(hasActiveFilter({ ...BASE, sx: "gia-tang" }), true);
  });
});
