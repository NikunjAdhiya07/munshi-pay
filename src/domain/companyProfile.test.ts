import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyProfile,
  FIELD_BY_KEY,
  LOGO_MAX_BYTES,
  logoDataUrl,
  logoType,
  PROFILE_FIELDS,
  ProfileInputError,
  parseProfile,
  parseRateText,
  withProfile,
} from "./companyProfile.ts";
import { maskSecret } from "./employees.ts";

const form = (values: Record<string, string>) => (key: string) =>
  values[key] ?? "";

/** Every field on the reference Company Details tab, as a profile key or a legacy company column. */
const REFERENCE_FIELDS: Record<string, string> = {
  "Short Name": "company.shortName",
  CNO: "company.number",
  "Est Type": "estType",
  "Company Name": "company.name",
  Address: "address",
  "Email Id": "email",
  "Phone No": "phone",
  "Branch/Location": "company.location",
  City: "company.city",
  District: "district",
  State: "company.state",
  PinCode: "pinCode",
  "Bank Name": "bankName",
  "IFSC Code": "bankIfsc",
  "A/C No": "bankAccount",
  "Bank Address": "bankAddress",
  "Company View": "companyView",
  "Company Status": "companyStatus",
  "Unit Est Type": "unitEstType",
  "Unit/Cont. Name": "unitName",
  "Unit Address": "unitAddress",
  "PT As Per Employee State": "ptAsPerEmployeeState",
  "Professional Tax": "company.professionalTax",
  "IT Auto": "itAuto",
  "PT Number": "ptNumber",
  "PAN No": "panNo",
  "TAN No": "tanNo",
  "Pay Scale On": "payScaleOn",
  "Leave Method": "leaveMethod",
  "Leave Cal.On": "leaveCalOn",
  "Min.Weg Limit": "minWageLimitPaise",
  "Bonus %": "bonusPercent",
  "Bonus Limit": "bonusLimitPaise",
  "OT On": "otOn",
  "OT Ratio": "otRatio",
  "ESI On OT": "esiOnOt",
  Logo: "logo",
  "PF No": "pfNo",
  "PF Start Date": "pfStartDate",
  "PF Limit": "company.pfLimitPaise",
  "Ext Code": "extCode",
  "Diff EPF": "pfDiffEpfPercent",
  "Pens.(A/C 10)": "pfPensionPercent",
  "A/C-2": "pfAc2Percent",
  "A/C-2(Min.Rs.)": "pfAc2MinPaise",
  "A/C-21": "pfAc21Percent",
  "A/C-21(Min.Rs.)": "pfAc21MinPaise",
  "A/C-22": "pfAc22Percent",
  "A/C-22(Min.Rs.)": "pfAc22MinPaise",
  "PF Group": "pfGroup",
  "PF Cmp.Gr": "pfCompanyGroup",
  "PF Office": "pfOffice",
  "PF Cal.": "pfCalculation",
  "ESI Start Date": "esiStartDate",
  "ESI No": "esiNo",
  "ESI Limit": "company.esiExceptionLimitPaise",
  "ESI Comp.Gr.": "esiCompanyGroup",
  "Employee(%)": "company.esiEmployeePercent",
  "Employer(%)": "esiEmployerPercent",
  "Local Office": "localOffice",
  "ESI Cal.": "esiCalculation",
};

test("every field on the reference company details screen has a home", () => {
  const profile = emptyProfile();
  for (const [label, key] of Object.entries(REFERENCE_FIELDS)) {
    if (key.startsWith("company.")) continue;
    assert.ok(key in profile, `${label} -> ${key} missing from the profile`);
    if (key !== "logo") assert.ok(FIELD_BY_KEY[key as never], label);
  }
});

test("the field list and the profile type agree and carry no duplicates", () => {
  const keys = Object.keys(emptyProfile()).filter((key) => key !== "logo");
  assert.deepEqual(
    PROFILE_FIELDS.map((field) => field.key).sort(),
    keys.sort(),
  );
  assert.equal(new Set(keys).size, keys.length);
});

test("a blank profile holds no statutory default", () => {
  const profile = emptyProfile();
  for (const [key, value] of Object.entries(profile)) {
    assert.ok(
      value === "" || value === false || value === null,
      `${key} should start blank`,
    );
  }
});

test("an older company gains every profile field blank and keeps what it had", () => {
  const upgraded = withProfile(undefined);
  assert.deepEqual(upgraded, emptyProfile());
  const partial = withProfile({ district: "Gandhinagar" });
  assert.equal(partial.district, "Gandhinagar");
  assert.equal(partial.pfNo, "");
});

test("rates take up to three decimals between 0 and 100", () => {
  assert.equal(parseRateText("0.500"), 0.5);
  assert.equal(parseRateText("3.67"), 3.67);
  assert.equal(parseRateText("100"), 100);
  assert.equal(parseRateText("100.000"), 100);
  assert.equal(parseRateText("100.001"), null);
  assert.equal(parseRateText("0.5001"), null);
  assert.equal(parseRateText("-1"), null);
  assert.equal(parseRateText("abc"), null);
});

test("a submitted profile is parsed into typed values", () => {
  const profile = parseProfile(
    form({
      address: " Plot 468, Sector 24 ",
      email: "hr@example.com",
      phone: "+91 79 1234 5678",
      pinCode: "382024",
      bankIfsc: "abcd0123456",
      panNo: "abcde1234f",
      pfStartDate: "2024-04-01",
      pfAc2Percent: "0.500",
      pfAc2MinPaise: "500.00",
      minWageLimitPaise: "12,500.50",
      otRatio: "2",
      esiOnOt: "on",
      pfCalculation: "basic",
      esiCalculation: "all",
      pfNo: "GJAHD1684981000",
    }),
    emptyProfile(),
  );
  assert.equal(profile.address, "Plot 468, Sector 24");
  assert.equal(profile.bankIfsc, "ABCD0123456");
  assert.equal(profile.panNo, "ABCDE1234F");
  assert.equal(profile.pfAc2Percent, 0.5);
  assert.equal(profile.pfAc2MinPaise, 50_000);
  assert.equal(profile.minWageLimitPaise, 1_250_050);
  assert.equal(profile.otRatio, 2);
  assert.equal(profile.esiOnOt, true);
  assert.equal(profile.itAuto, false);
  assert.equal(profile.pfCalculation, "basic");
  assert.equal(profile.esiCalculation, "all");
  assert.equal(profile.bonusPercent, null);
  assert.equal(profile.pfNo, "GJAHD1684981000");
});

test("a masked account, PAN, and TAN submitted as shown keep the saved value", () => {
  const saved = {
    ...emptyProfile(),
    bankAccount: "123456789012",
    panNo: "ABCDE1234F",
    tanNo: "ABCD12345E",
  };
  const kept = parseProfile(
    form({
      bankAccount: maskSecret(saved.bankAccount),
      panNo: maskSecret(saved.panNo),
      tanNo: maskSecret(saved.tanNo),
    }),
    saved,
  );
  assert.equal(kept.bankAccount, "123456789012");
  assert.equal(kept.panNo, "ABCDE1234F");
  assert.equal(kept.tanNo, "ABCD12345E");
  const cleared = parseProfile(form({}), saved);
  assert.equal(cleared.bankAccount, "");
  assert.equal(cleared.panNo, "");
});

test("a bad value is refused with a message that names the field", () => {
  const bad = (values: Record<string, string>, pattern: RegExp) =>
    assert.throws(
      () => parseProfile(form(values), emptyProfile()),
      (error: unknown) =>
        error instanceof ProfileInputError && pattern.test(error.message),
    );
  bad({ pinCode: "3820" }, /Pin code must be 6 digits/);
  bad({ email: "not-an-email" }, /Email id/);
  bad({ phone: "call me" }, /Phone no/);
  bad({ bankIfsc: "123" }, /IFSC/);
  bad({ panNo: "12345" }, /PAN/);
  bad({ tanNo: "12345" }, /TAN/);
  bad({ pfStartDate: "2026-02-30" }, /PF start date/);
  bad({ esiStartDate: "01-04-2026" }, /ESI start date/);
  bad({ pfAc2Percent: "100.5" }, /A\/C-2 must be from 0 to 100/);
  bad({ pfAc2MinPaise: "12.345" }, /A\/C-2 \(min\. Rs\.\)/);
  bad({ pfCalculation: "everything" }, /PF calculation/);
  bad({ address: "x".repeat(241) }, /Address must be 240/);
});

test("a logo is accepted only as a small PNG or JPEG judged by its bytes", () => {
  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
  ]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const svg = new TextEncoder().encode("<svg onload='alert(1)'></svg>");
  assert.equal(logoType(png), "image/png");
  assert.equal(logoType(jpeg), "image/jpeg");
  assert.equal(logoType(svg), null);
  assert.match(logoDataUrl(png), /^data:image\/png;base64,/);
  assert.throws(() => logoDataUrl(svg), /PNG or JPEG/);
  const big = new Uint8Array(LOGO_MAX_BYTES + 1);
  big.set(png);
  assert.throws(() => logoDataUrl(big), /150 KB/);
});
