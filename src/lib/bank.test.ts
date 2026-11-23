import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { bankNameForBin, getBankInfo } from "./bank";

const KEYS = ["BANK_BIN", "BANK_NAME", "BANK_ACCOUNT", "BANK_ACCOUNT_NAME"];

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

function setEnv(bin: string, name: string): void {
  process.env.BANK_BIN = bin;
  process.env.BANK_NAME = name;
  process.env.BANK_ACCOUNT = "1234567890";
  process.env.BANK_ACCOUNT_NAME = "HOA TUOI DEMO";
}

describe("bankNameForBin (K-9)", () => {
  it("970415 là VietinBank, 970436 là Vietcombank", () => {
    assert.equal(bankNameForBin("970415"), "VietinBank");
    assert.equal(bankNameForBin("970436"), "Vietcombank");
  });
  it("các BIN lớn khác khớp danh mục VietQR", () => {
    assert.equal(bankNameForBin("970418"), "BIDV");
    assert.equal(bankNameForBin("970405"), "Agribank");
    assert.equal(bankNameForBin("970407"), "Techcombank");
    assert.equal(bankNameForBin("970422"), "MBBank");
    assert.equal(bankNameForBin("970416"), "ACB");
    assert.equal(bankNameForBin("970432"), "VPBank");
    assert.equal(bankNameForBin("970423"), "TPBank");
  });
  it("BIN chưa biết → null", () => {
    assert.equal(bankNameForBin("970999"), null);
  });
});

describe("getBankInfo (K-9)", () => {
  it("tên hiển thị lấy từ BIN, bỏ qua BANK_NAME sai", () => {
    // Cấu hình thử Ngày 6: BIN 970415 mà BANK_NAME ghi Vietcombank —
    // tên hiển thị phải là VietinBank (ngân hàng nhận tiền thật).
    setEnv("970415", "Vietcombank");
    assert.equal(getBankInfo()?.name, "VietinBank");
  });
  it("BIN đã biết + BANK_NAME đúng → tên đó", () => {
    setEnv("970436", "Vietcombank");
    assert.equal(getBankInfo()?.name, "Vietcombank");
  });
  it("BIN chưa biết → dùng BANK_NAME", () => {
    setEnv("970999", "Ngân hàng Test");
    assert.equal(getBankInfo()?.name, "Ngân hàng Test");
  });
  it("thiếu trường → null", () => {
    setEnv("970436", "Vietcombank");
    delete process.env.BANK_ACCOUNT;
    assert.equal(getBankInfo(), null);
  });
});
