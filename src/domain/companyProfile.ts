import { keepIfMasked } from "./employees.ts";
import { parseRupeeText } from "./money.ts";

/**
 * The plain-data company profile. Every field here is stored and shown. None
 * of them changes a payroll figure: the pay rules in "Other details" and the
 * PF and ESI account settings are recorded as the company states them, and
 * the engine does not read them until the rule behind each one is confirmed
 * (DEC-004). Blank means "not set", never a statutory default.
 */
export type CompanyProfile = {
  // Company details
  estType: string;
  address: string;
  email: string;
  phone: string;
  district: string;
  pinCode: string;
  bankName: string;
  bankIfsc: string;
  bankAccount: string;
  bankAddress: string;
  companyView: string;
  companyStatus: string;
  /** A small PNG or JPEG as a data URL. Empty when there is no logo. */
  logo: string;
  // Name and details of contractor or unit
  unitEstType: string;
  unitName: string;
  unitAddress: string;
  ptAsPerEmployeeState: boolean;
  itAuto: boolean;
  ptNumber: string;
  panNo: string;
  tanNo: string;
  payScaleOn: string;
  leaveMethod: string;
  leaveCalOn: string;
  minWageLimitPaise: number | null;
  bonusPercent: number | null;
  bonusLimitPaise: number | null;
  otOn: string;
  otRatio: number | null;
  esiOnOt: boolean;
  // Provident fund
  pfNo: string;
  pfStartDate: string;
  extCode: string;
  pfDiffEpfPercent: number | null;
  pfPensionPercent: number | null;
  pfAc2Percent: number | null;
  pfAc2MinPaise: number | null;
  pfAc21Percent: number | null;
  pfAc21MinPaise: number | null;
  pfAc22Percent: number | null;
  pfAc22MinPaise: number | null;
  pfGroup: string;
  pfCompanyGroup: string;
  pfOffice: string;
  pfCalculation: "" | "basic" | "allowance";
  // Employees' State Insurance
  esiNo: string;
  esiStartDate: string;
  esiCompanyGroup: string;
  esiEmployerPercent: number | null;
  localOffice: string;
  esiCalculation: "" | "gross" | "all";
};

export type ProfileKey = keyof CompanyProfile;

export function emptyProfile(): CompanyProfile {
  return {
    estType: "",
    address: "",
    email: "",
    phone: "",
    district: "",
    pinCode: "",
    bankName: "",
    bankIfsc: "",
    bankAccount: "",
    bankAddress: "",
    companyView: "",
    companyStatus: "",
    logo: "",
    unitEstType: "",
    unitName: "",
    unitAddress: "",
    ptAsPerEmployeeState: false,
    itAuto: false,
    ptNumber: "",
    panNo: "",
    tanNo: "",
    payScaleOn: "",
    leaveMethod: "",
    leaveCalOn: "",
    minWageLimitPaise: null,
    bonusPercent: null,
    bonusLimitPaise: null,
    otOn: "",
    otRatio: null,
    esiOnOt: false,
    pfNo: "",
    pfStartDate: "",
    extCode: "",
    pfDiffEpfPercent: null,
    pfPensionPercent: null,
    pfAc2Percent: null,
    pfAc2MinPaise: null,
    pfAc21Percent: null,
    pfAc21MinPaise: null,
    pfAc22Percent: null,
    pfAc22MinPaise: null,
    pfGroup: "",
    pfCompanyGroup: "",
    pfOffice: "",
    pfCalculation: "",
    esiNo: "",
    esiStartDate: "",
    esiCompanyGroup: "",
    esiEmployerPercent: null,
    localOffice: "",
    esiCalculation: "",
  };
}

/** An older store, or a company created before the profile existed, gains every field blank. */
export function withProfile(
  profile: Partial<CompanyProfile> | undefined,
): CompanyProfile {
  return { ...emptyProfile(), ...profile };
}

export type FieldKind =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "pin"
  | "date"
  /** A percent or ratio from 0 to 100 with up to three decimals. */
  | "rate"
  /** Rupees typed by a person. Stored as integer paise. */
  | "money"
  /** Free text with the values the reference screen offers as suggestions. */
  | "choice"
  | "bank"
  | "check"
  | "radio"
  /** Shown masked. A submission equal to the mask keeps the saved value. */
  | "secret";

export type ProfileField = {
  key: Exclude<ProfileKey, "logo">;
  label: string;
  kind: FieldKind;
  max?: number;
  /** Suggestions for a choice, or the allowed values for a radio. */
  options?: { value: string; label: string }[];
  help?: string;
  /** A format a typed value must match, after trimming. */
  format?: { pattern: RegExp; message: string; upper?: boolean };
};

const opt = (...values: string[]) =>
  values.map((value) => ({ value, label: value }));

export const PROFILE_FIELDS: readonly ProfileField[] = [
  {
    key: "estType",
    label: "Est type",
    kind: "choice",
    options: opt("Company"),
  },
  { key: "address", label: "Address", kind: "textarea", max: 240 },
  { key: "email", label: "Email id", kind: "email", max: 120 },
  { key: "phone", label: "Phone no", kind: "phone" },
  { key: "district", label: "District", kind: "text" },
  { key: "pinCode", label: "Pin code", kind: "pin" },
  { key: "bankName", label: "Bank name", kind: "bank" },
  {
    key: "bankIfsc",
    label: "IFSC code",
    kind: "text",
    max: 11,
    format: {
      pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/,
      message: "IFSC code must be 11 characters, such as ABCD0123456.",
      upper: true,
    },
  },
  { key: "bankAccount", label: "A/C no", kind: "secret", max: 34 },
  { key: "bankAddress", label: "Bank address", kind: "textarea", max: 240 },
  {
    key: "companyView",
    label: "Company view",
    kind: "choice",
    options: opt("Main"),
  },
  {
    key: "companyStatus",
    label: "Company status",
    kind: "choice",
    options: opt("Active", "Inactive"),
  },
  {
    key: "unitEstType",
    label: "Est type",
    kind: "choice",
    options: opt("Company"),
  },
  { key: "unitName", label: "Unit / contractor name", kind: "text", max: 120 },
  { key: "unitAddress", label: "Address", kind: "textarea", max: 240 },
  {
    key: "ptAsPerEmployeeState",
    label: "PT as per employee state",
    kind: "check",
  },
  { key: "itAuto", label: "IT auto", kind: "check" },
  { key: "ptNumber", label: "PT number", kind: "text", max: 30 },
  {
    key: "panNo",
    label: "PAN no",
    kind: "secret",
    max: 10,
    format: {
      pattern: /^[A-Z]{5}\d{4}[A-Z]$/,
      message: "PAN must be 10 characters, such as ABCDE1234F.",
      upper: true,
    },
  },
  {
    key: "tanNo",
    label: "TAN no",
    kind: "secret",
    max: 10,
    format: {
      pattern: /^[A-Z]{4}\d{5}[A-Z]$/,
      message: "TAN must be 10 characters, such as ABCD12345E.",
      upper: true,
    },
  },
  {
    key: "payScaleOn",
    label: "Pay scale on",
    kind: "choice",
    options: opt("Month Days"),
  },
  {
    key: "leaveMethod",
    label: "Leave method",
    kind: "choice",
    options: opt("As Per Calendar"),
  },
  {
    key: "leaveCalOn",
    label: "Leave cal. on",
    kind: "choice",
    options: opt("Salary"),
  },
  { key: "minWageLimitPaise", label: "Min. wage limit (Rs.)", kind: "money" },
  { key: "bonusPercent", label: "Bonus %", kind: "rate" },
  { key: "bonusLimitPaise", label: "Bonus limit (Rs.)", kind: "money" },
  { key: "otOn", label: "OT on", kind: "choice", options: opt("Gross") },
  { key: "otRatio", label: "OT ratio", kind: "rate" },
  { key: "esiOnOt", label: "ESI on OT", kind: "check" },
  { key: "pfNo", label: "PF no", kind: "text", max: 30 },
  { key: "pfStartDate", label: "PF start date", kind: "date" },
  { key: "extCode", label: "Ext code", kind: "text", max: 20 },
  { key: "pfDiffEpfPercent", label: "Diff EPF", kind: "rate" },
  { key: "pfPensionPercent", label: "Pension (A/C 10)", kind: "rate" },
  { key: "pfAc2Percent", label: "A/C-2", kind: "rate" },
  { key: "pfAc2MinPaise", label: "A/C-2 (min. Rs.)", kind: "money" },
  { key: "pfAc21Percent", label: "A/C-21", kind: "rate" },
  { key: "pfAc21MinPaise", label: "A/C-21 (min. Rs.)", kind: "money" },
  { key: "pfAc22Percent", label: "A/C-22", kind: "rate" },
  { key: "pfAc22MinPaise", label: "A/C-22 (min. Rs.)", kind: "money" },
  { key: "pfGroup", label: "PF group", kind: "text", max: 20 },
  { key: "pfCompanyGroup", label: "PF company group", kind: "text", max: 20 },
  { key: "pfOffice", label: "PF office", kind: "text", max: 80 },
  {
    key: "pfCalculation",
    label: "PF calculation",
    kind: "radio",
    options: [
      { value: "basic", label: "PF on basic" },
      { value: "allowance", label: "PF on allowance" },
    ],
  },
  { key: "esiNo", label: "ESI no", kind: "text", max: 30 },
  { key: "esiStartDate", label: "ESI start date", kind: "date" },
  { key: "esiCompanyGroup", label: "ESI company group", kind: "text", max: 20 },
  { key: "esiEmployerPercent", label: "ESI employer (%)", kind: "rate" },
  { key: "localOffice", label: "Local office", kind: "text", max: 80 },
  {
    key: "esiCalculation",
    label: "ESI calculation",
    kind: "radio",
    options: [
      { value: "gross", label: "ESI on gross" },
      { value: "all", label: "Set ESI all" },
    ],
  },
];

export const FIELD_BY_KEY = Object.fromEntries(
  PROFILE_FIELDS.map((field) => [field.key, field]),
) as Record<ProfileField["key"], ProfileField>;

/** Suggestions for the state field. Any text is still accepted. */
export const INDIAN_STATES: readonly string[] = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export class ProfileInputError extends Error {}

/**
 * A percent or ratio typed by a person, from 0 to 100 with up to three
 * decimals ("0.500", "3.67"). Returns null for anything else.
 */
export function parseRateText(raw: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,3}))?$/.exec(raw.trim());
  if (!match) return null;
  const thousandths =
    Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
  if (thousandths > 100_000) return null;
  return thousandths / 1000;
}

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  return (
    date.getUTCFullYear() === +match[1] &&
    date.getUTCMonth() === +match[2] - 1 &&
    date.getUTCDate() === +match[3]
  );
}

/**
 * Reads every profile field from a submitted form. `get` returns the trimmed
 * text for a name, and a checkbox as "on" or "". The logo is not read here.
 * Throws ProfileInputError with a message a person can act on.
 */
export function parseProfile(
  get: (key: string) => string,
  current: CompanyProfile,
): CompanyProfile {
  const next: CompanyProfile = { ...current };
  const set = (key: ProfileKey, value: string | boolean | number | null) => {
    (next as Record<string, unknown>)[key] = value;
  };
  for (const field of PROFILE_FIELDS) {
    const raw = get(field.key).trim();
    const label = field.label;
    const max = field.max ?? 80;
    switch (field.kind) {
      case "check":
        set(field.key, raw === "on");
        break;
      case "radio": {
        const allowed = field.options?.map((item) => item.value) ?? [];
        if (raw && !allowed.includes(raw)) {
          throw new ProfileInputError(`Choose a listed ${label}.`);
        }
        set(field.key, raw);
        break;
      }
      case "rate": {
        if (!raw) {
          set(field.key, null);
          break;
        }
        const value = parseRateText(raw);
        if (value === null) {
          throw new ProfileInputError(
            `${label} must be from 0 to 100 with at most three decimals.`,
          );
        }
        set(field.key, value);
        break;
      }
      case "money": {
        if (!raw) {
          set(field.key, null);
          break;
        }
        const paise = parseRupeeText(raw);
        if (paise === null) {
          throw new ProfileInputError(
            `${label} must be an amount in rupees with at most two decimals.`,
          );
        }
        set(field.key, paise);
        break;
      }
      case "date":
        if (raw && !validDate(raw)) {
          throw new ProfileInputError(`${label} must be a valid date.`);
        }
        set(field.key, raw);
        break;
      case "email":
        if (raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
          throw new ProfileInputError(`${label} must be an email address.`);
        }
        limit(raw, label, max);
        set(field.key, raw);
        break;
      case "phone":
        if (raw && !/^[0-9+()\-\s]{5,20}$/.test(raw)) {
          throw new ProfileInputError(
            `${label} may hold digits, spaces, +, -, and brackets only, 5 to 20 characters.`,
          );
        }
        set(field.key, raw);
        break;
      case "pin":
        if (raw && !/^\d{6}$/.test(raw)) {
          throw new ProfileInputError(`${label} must be 6 digits.`);
        }
        set(field.key, raw);
        break;
      case "secret": {
        const key = field.key as "bankAccount" | "panNo" | "tanNo";
        const kept = keepIfMasked(raw, current[key]);
        set(field.key, formatted(field, kept, label, max));
        break;
      }
      default:
        set(field.key, formatted(field, raw, label, max));
    }
  }
  return next;
}

function limit(value: string, label: string, max: number): void {
  if (value.length > max) {
    throw new ProfileInputError(`${label} must be ${max} characters or fewer.`);
  }
}

function formatted(
  field: ProfileField,
  raw: string,
  label: string,
  max: number,
): string {
  const value = field.format?.upper ? raw.toUpperCase() : raw;
  limit(value, label, max);
  if (value && field.format && !field.format.pattern.test(value)) {
    throw new ProfileInputError(field.format.message);
  }
  return value;
}

export const LOGO_MAX_BYTES = 150 * 1024;

/**
 * The type of an uploaded logo from its first bytes, never from the file name
 * or the type the browser sent. Only PNG and JPEG are accepted; SVG can carry
 * script, so it is refused.
 */
export function logoType(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length > 8 && png.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }
  if (
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  return null;
}

/** A logo upload as a data URL, or a ProfileInputError saying what is wrong. */
export function logoDataUrl(bytes: Uint8Array): string {
  if (bytes.length > LOGO_MAX_BYTES) {
    throw new ProfileInputError("The logo must be 150 KB or smaller.");
  }
  const type = logoType(bytes);
  if (!type)
    throw new ProfileInputError("The logo must be a PNG or JPEG image.");
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${type};base64,${btoa(binary)}`;
}

/** Fields whose value must never go into a URL, a log, or an audit entry. */
export const SECRET_KEYS: readonly ProfileKey[] = [
  "bankAccount",
  "panNo",
  "tanNo",
];
