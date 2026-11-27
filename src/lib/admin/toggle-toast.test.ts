// Unit test — logic thuần cho toast hoàn tác Ẩn/Hiện (Đợt 4 — 25/11).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toggleNewsToastMessage,
  toggleToastMessage,
  toggleZoneToastMessage,
  undoToggleFormData,
  undoToggleNewsFormData,
  undoToggleZoneFormData,
} from "./toggle-toast";

describe("toggleToastMessage", () => {
  it("đang bán mà bấm Ẩn thì báo 'Đã ẩn sản phẩm'", () => {
    assert.equal(toggleToastMessage(true), "Đã ẩn sản phẩm");
  });

  it("đã ẩn mà bấm Hiện lại thì báo 'Đã hiện lại sản phẩm'", () => {
    assert.equal(toggleToastMessage(false), "Đã hiện lại sản phẩm");
  });
});

describe("undoToggleFormData", () => {
  it("hoàn tác sau khi ẩn thì đặt lại isActive=true", () => {
    const fd = undoToggleFormData(21, true);
    assert.equal(fd.get("productId"), "21");
    assert.equal(fd.get("isActive"), "true");
  });

  it("hoàn tác sau khi hiện lại thì đặt lại isActive=false", () => {
    const fd = undoToggleFormData(21, false);
    assert.equal(fd.get("productId"), "21");
    assert.equal(fd.get("isActive"), "false");
  });
});

describe("toggleZoneToastMessage (Ngày 12 C2)", () => {
  it("đang bật mà bấm Tắt thì báo 'Đã tắt khu vực'", () => {
    assert.equal(toggleZoneToastMessage(true), "Đã tắt khu vực");
  });

  it("đã tắt mà bấm Bật lại thì báo 'Đã bật lại khu vực'", () => {
    assert.equal(toggleZoneToastMessage(false), "Đã bật lại khu vực");
  });
});

describe("undoToggleZoneFormData (Ngày 12 C2)", () => {
  it("hoàn tác sau khi tắt thì đặt lại isActive=true", () => {
    const fd = undoToggleZoneFormData(2, true);
    assert.equal(fd.get("zoneId"), "2");
    assert.equal(fd.get("isActive"), "true");
  });

  it("hoàn tác sau khi bật lại thì đặt lại isActive=false", () => {
    const fd = undoToggleZoneFormData(2, false);
    assert.equal(fd.get("zoneId"), "2");
    assert.equal(fd.get("isActive"), "false");
  });
});

describe("toggleNewsToastMessage (Ngày 18)", () => {
  it("đang xuất bản mà bấm về nháp thì báo 'Đã chuyển bài về nháp'", () => {
    assert.equal(toggleNewsToastMessage(true), "Đã chuyển bài về nháp");
  });

  it("đang nháp mà bấm xuất bản thì báo 'Đã xuất bản bài'", () => {
    assert.equal(toggleNewsToastMessage(false), "Đã xuất bản bài");
  });
});

describe("undoToggleNewsFormData (Ngày 18)", () => {
  it("hoàn tác sau khi về nháp thì đặt lại isPublished=true", () => {
    const fd = undoToggleNewsFormData(7, true);
    assert.equal(fd.get("newsId"), "7");
    assert.equal(fd.get("isPublished"), "true");
  });

  it("hoàn tác sau khi xuất bản thì đặt lại isPublished=false", () => {
    const fd = undoToggleNewsFormData(7, false);
    assert.equal(fd.get("newsId"), "7");
    assert.equal(fd.get("isPublished"), "false");
  });
});
