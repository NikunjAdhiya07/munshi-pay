import {
  type CompanyProfile,
  emptyProfile,
  logoDataUrl,
  ProfileInputError,
  parseProfile,
} from "../domain/companyProfile.ts";
import { parsePercentText, parseRupeeText } from "../domain/money.ts";
import type { Company, Store } from "./model.ts";

export class CompanyError extends Error {}

export type LogoChange =
  | { action: "keep" }
  | { action: "remove" }
  | { action: "set"; bytes: Uint8Array };

/** Everything the company form submits, as the text a person typed. */
export type CompanyDetailsInput = {
  name: string;
  shortName: string;
  location: string;
  city: string;
  state: string;
  professionalTax: boolean;
  pfEmployeePercent: string;
  pfLimit: string;
  esiEmployeePercent: string;
  esiExceptionLimit: string;
  /** Trimmed text for a profile field name, and "on" or "" for a checkbox. */
  field: (key: string) => string;
  logo: LogoChange;
};

/**
 * What creating a company or a site needs. The identity fields are required.
 * Everything else is optional and starts blank, so a draft with only the
 * identity still creates a company with an empty profile.
 */
export type CompanyDraft = Pick<
  CompanyDetailsInput,
  "name" | "shortName" | "location" | "city" | "state"
> &
  Partial<
    Omit<
      CompanyDetailsInput,
      "name" | "shortName" | "location" | "city" | "state"
    >
  > & {
    kind: "company" | "site";
  };

const LIMITS = { name: 120, shortName: 20, location: 80, city: 80, state: 80 };

function required(raw: string, label: string, max: number): string {
  const value = raw.trim();
  if (!value) throw new CompanyError(`Enter the ${label}.`);
  if (value.length > max) {
    throw new CompanyError(`${label} must be ${max} characters or fewer.`);
  }
  return value;
}

function optional(raw: string, label: string, max: number): string {
  const value = raw.trim();
  if (value.length > max) {
    throw new CompanyError(`${label} must be ${max} characters or fewer.`);
  }
  return value;
}

function same(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function assertShortName(store: Store, shortName: string, exceptId: string) {
  const taken = store.companies.some(
    (company) => company.id !== exceptId && same(company.shortName, shortName),
  );
  if (taken) throw new CompanyError("A company already uses that short name.");
}

function nextNumber(companies: Company[]): string {
  let highest = 0;
  for (const company of companies) {
    const parsed = Number(company.number);
    if (Number.isInteger(parsed) && parsed > highest) highest = parsed;
  }
  return String(highest + 1);
}

function settingPercent(raw: string, label: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  const parsed = parsePercentText(value);
  if (parsed === null) {
    throw new CompanyError(
      `${label} must be from 0 to 100 with at most two decimals.`,
    );
  }
  return parsed;
}

function settingMoney(raw: string, label: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  const paise = parseRupeeText(value);
  if (paise === null) {
    throw new CompanyError(
      `${label} must be an amount in rupees with at most two decimals.`,
    );
  }
  return paise;
}

type Checked = {
  name: string;
  shortName: string;
  location: string;
  city: string;
  state: string;
  professionalTax: boolean;
  pfEmployeePercent: number | null;
  pfLimitPaise: number | null;
  esiEmployeePercent: number | null;
  esiExceptionLimitPaise: number | null;
  profile: CompanyProfile;
};

/**
 * Checks every field of the company form and returns the values to store. It
 * writes nothing, so a refused field leaves the store as it was. `current` is
 * the profile being edited, or a blank one for a new company.
 */
function checkDetails(
  store: Store,
  input: CompanyDetailsInput,
  exceptId: string,
  current: CompanyProfile,
): Checked {
  const name = required(input.name, "company name", LIMITS.name);
  const shortName = required(input.shortName, "short name", LIMITS.shortName);
  assertShortName(store, shortName, exceptId);
  const location = optional(input.location, "location", LIMITS.location);
  const city = optional(input.city, "city", LIMITS.city);
  const state = optional(input.state, "state", LIMITS.state);
  const pfEmployeePercent = settingPercent(
    input.pfEmployeePercent,
    "PF employee percent",
  );
  const pfLimitPaise = settingMoney(input.pfLimit, "PF limit");
  const esiEmployeePercent = settingPercent(
    input.esiEmployeePercent,
    "ESI employee percent",
  );
  const esiExceptionLimitPaise = settingMoney(
    input.esiExceptionLimit,
    "ESI exception limit",
  );
  let profile: CompanyProfile;
  try {
    profile = parseProfile(input.field, current);
    if (input.logo.action === "remove") profile.logo = "";
    if (input.logo.action === "set") {
      profile.logo = logoDataUrl(input.logo.bytes);
    }
  } catch (error) {
    if (error instanceof ProfileInputError) {
      throw new CompanyError(error.message);
    }
    throw error;
  }
  return {
    name,
    shortName,
    location,
    city,
    state,
    professionalTax: input.professionalTax,
    pfEmployeePercent,
    pfLimitPaise,
    esiEmployeePercent,
    esiExceptionLimitPaise,
    profile,
  };
}

/**
 * Creates a company or a site with the full profile the edit screen holds. An
 * account owner receives Owner in it. Anyone else receives the role they
 * already hold in the company they created it from, so creating a company does
 * not raise their rights (DEC-017). Statutory percents stay unset unless the
 * person types them. Everything is checked before anything is written.
 */
export function createCompany(
  store: Store,
  actorUserId: string,
  sourceCompanyId: string,
  draft: CompanyDraft,
  newId: () => string,
): Company {
  const actor = store.users.find((user) => user.id === actorUserId);
  if (!actor) throw new CompanyError("Sign in again.");
  const sourceRole = actor.memberships.find(
    (item) => item.companyId === sourceCompanyId,
  )?.role;
  const source = store.companies.find((item) => item.id === sourceCompanyId);
  if (!sourceRole || !source) {
    throw new CompanyError("Choose a company you belong to.");
  }
  const checked = checkDetails(
    store,
    {
      professionalTax: false,
      pfEmployeePercent: "",
      pfLimit: "",
      esiEmployeePercent: "",
      esiExceptionLimit: "",
      field: () => "",
      logo: { action: "keep" },
      ...draft,
    },
    "",
    emptyProfile(),
  );
  const company: Company = {
    id: newId(),
    number: nextNumber(store.companies),
    shortName: checked.shortName,
    name: checked.name,
    location: checked.location,
    city: checked.city,
    state: checked.state,
    parentId: draft.kind === "site" ? source.id : null,
    professionalTax: checked.professionalTax,
    pfEmployeePercent: checked.pfEmployeePercent,
    pfLimitPaise: checked.pfLimitPaise,
    esiEmployeePercent: checked.esiEmployeePercent,
    esiExceptionLimitPaise: checked.esiExceptionLimitPaise ?? 0,
    profile: checked.profile,
  };
  store.companies.push(company);
  for (const user of store.users) {
    if (!user.accountOwner) continue;
    if (user.memberships.some((item) => item.companyId === company.id))
      continue;
    user.memberships.push({ companyId: company.id, role: "owner" });
  }
  if (
    !actor.accountOwner &&
    !actor.memberships.some((item) => item.companyId === company.id)
  ) {
    actor.memberships.push({ companyId: company.id, role: sourceRole });
  }
  store.audit.unshift({
    id: newId(),
    at: new Date().toISOString(),
    actor: actor.username,
    action:
      draft.kind === "site"
        ? `Created site ${company.shortName} under ${source.shortName}`
        : `Created company ${company.shortName}`,
    companyId: company.id,
  });
  return company;
}

/** Identity fields on the company profile. Percents stay with the caller. */
export function saveCompanyIdentity(
  store: Store,
  companyId: string,
  input: {
    name: string;
    shortName: string;
    location: string;
    city: string;
    state: string;
  },
): void {
  const company = store.companies.find((item) => item.id === companyId);
  if (!company) throw new CompanyError("Company not found.");
  const name = required(input.name, "company name", LIMITS.name);
  const shortName = required(input.shortName, "short name", LIMITS.shortName);
  assertShortName(store, shortName, company.id);
  company.name = name;
  company.shortName = shortName;
  company.location = optional(input.location, "location", LIMITS.location);
  company.city = optional(input.city, "city", LIMITS.city);
  company.state = optional(input.state, "state", LIMITS.state);
}

/**
 * Saves the whole company profile in one step. Everything is checked before
 * anything is written, so a refused field leaves the company as it was. The
 * audit entry names the company only: no registration number, tax number, or
 * bank detail goes into it.
 */
export function saveCompanyDetails(
  store: Store,
  companyId: string,
  actorUserId: string,
  input: CompanyDetailsInput,
  newId: () => string,
): void {
  const company = store.companies.find((item) => item.id === companyId);
  if (!company) throw new CompanyError("Company not found.");
  const checked = checkDetails(store, input, company.id, company.profile);
  company.name = checked.name;
  company.shortName = checked.shortName;
  company.location = checked.location;
  company.city = checked.city;
  company.state = checked.state;
  company.professionalTax = checked.professionalTax;
  company.pfEmployeePercent = checked.pfEmployeePercent;
  company.pfLimitPaise = checked.pfLimitPaise;
  company.esiEmployeePercent = checked.esiEmployeePercent;
  if (checked.esiExceptionLimitPaise !== null) {
    company.esiExceptionLimitPaise = checked.esiExceptionLimitPaise;
  }
  company.profile = checked.profile;
  const actor = store.users.find((user) => user.id === actorUserId);
  store.audit.unshift({
    id: newId(),
    at: new Date().toISOString(),
    actor: actor?.username ?? "system",
    action: `Saved company profile for ${checked.shortName}`,
    companyId: company.id,
  });
}
