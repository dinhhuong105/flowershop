// Unit test — logic thuần cho toast hoàn tác Ẩn/Hiện (Đợt 4 — 25/11).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toggleToastMessage,
  undoToggleFormData,
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
