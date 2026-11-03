import assert from "node:assert/strict";
import test from "node:test";
import { isIsoDate } from "./dates.ts";
import {
  fullName,
  keepIfMasked,
  maskSecret,
  nextEmployeeCode,
  sameCode,
} from "./employees.ts";

test("a full name joins the parts that are filled in", () => {
  assert.equal(fullName("Asha", "Kumar", "Rao"), "Asha Kumar Rao");
  assert.equal(fullName("Asha", "", "Rao"), "Asha Rao");
  assert.equal(fullName("  Asha ", " ", ""), "Asha");
  assert.equal(fullName("Asha  Devi", "", "Rao"), "Asha Devi Rao");
  assert.equal(fullName("", "", ""), "");
});

test("the next code keeps the prefix and padding of the highest number", () => {
  assert.equal(nextEmployeeCode(["E001", "E002", "E006"]), "E007");
  assert.equal(nextEmployeeCode(["E009"]), "E010");
  assert.equal(nextEmployeeCode(["E099"]), "E100");
  assert.equal(nextEmployeeCode(["7", "12", "9"]), "13");
  assert.equal(nextEmployeeCode(["EMP-0042", "EMP-0007"]), "EMP-0043");
  assert.equal(nextEmployeeCode(["A5", "B10"]), "B11");
});

test("the next code starts at 1 when no code ends in a number", () => {
  assert.equal(nextEmployeeCode([]), "1");
  assert.equal(nextEmployeeCode(["OWNER", "ADMIN"]), "1");
  assert.equal(nextEmployeeCode(["OWNER", "E004"]), "E005");
});

test("the next code is never one that is already used", () => {
  const codes = ["E001", "E002", "E010", "X5", "e011"];
  const next = nextEmployeeCode(codes);
  assert.ok(!codes.some((code) => sameCode(code, next)), next);
});

test("codes match without regard to case or spaces", () => {
  assert.ok(sameCode("E001", " e001 "));
  assert.ok(!sameCode("E001", "E002"));
});

test("a secret shows its last characters and hides the rest", () => {
  assert.equal(maskSecret("123412341234"), "XXXXXXXX1234");
  assert.equal(maskSecret("ABCDE1234F"), "XXXXXX234F");
  assert.equal(maskSecret("00123456789"), "XXXXXXX6789");
  assert.equal(maskSecret(""), "");
  assert.equal(maskSecret("   "), "");
});

test("a short secret shows less, and the length is kept", () => {
  assert.equal(maskSecret("1234567"), "XXXXX67");
  assert.equal(maskSecret("123456"), "XXXX56");
  assert.equal(maskSecret("12"), "XX");
  assert.equal(maskSecret("123"), "XX3");
  for (const value of ["1", "12", "123", "12345", "1234567", "12345678"]) {
    assert.equal(maskSecret(value).length, value.length);
  }
});

test("a masked secret never shows more than four characters", () => {
  const masked = maskSecret("9876543210123456");
  assert.equal(masked.replaceAll("X", "").length, 4);
});

test("an untouched masked field keeps the saved value", () => {
  const saved = "123412341234";
  assert.equal(keepIfMasked(maskSecret(saved), saved), saved);
  assert.equal(keepIfMasked(` ${maskSecret(saved)} `, saved), saved);
});

test("a changed or cleared masked field is the new value", () => {
  const saved = "123412341234";
  assert.equal(keepIfMasked("999988887777", saved), "999988887777");
  assert.equal(keepIfMasked("", saved), "");
  assert.equal(keepIfMasked("  ", saved), "");
  assert.equal(keepIfMasked("XXXXXXXX9999", saved), "XXXXXXXX9999");
});

test("a field with nothing saved takes what was typed", () => {
  assert.equal(keepIfMasked("", ""), "");
  assert.equal(keepIfMasked("ABCDE1234F", ""), "ABCDE1234F");
});

test("dates must be real calendar dates", () => {
  assert.ok(isIsoDate("2026-10-07"));
  assert.ok(isIsoDate("2028-02-29"));
  assert.ok(!isIsoDate("2026-02-29"));
  assert.ok(!isIsoDate("2026-13-01"));
  assert.ok(!isIsoDate("07-10-2026"));
  assert.ok(!isIsoDate(""));
  assert.ok(!isIsoDate(undefined));
});
