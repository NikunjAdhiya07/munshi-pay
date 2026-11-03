import assert from "node:assert/strict";
import test from "node:test";
import { emptyProfile } from "../domain/companyProfile.ts";
import {
  CompanyError,
  createCompany,
  saveCompanyDetails,
  saveCompanyIdentity,
} from "./companies.ts";
import { seedStore } from "./store.ts";
import { addUser } from "./users.ts";

let counter = 0;
const newId = () => `id-${++counter}`;

const draft = {
  name: "River Tools",
  shortName: "RIVER",
  location: "Plant 2",
  city: "Surat",
  state: "Gujarat",
  kind: "company" as const,
};

const identity = {
  name: "Northwind Components",
  shortName: "NORTH",
  location: "",
  city: "",
  state: "Gujarat",
};

test("creating a company keeps the creator's role and gives owners Owner", () => {
  const store = seedStore();
  addUser(store, {
    id: "boss",
    username: "boss",
    password: "password1",
    accountOwner: true,
    memberships: [{ companyId: "c1", role: "owner" }],
  });
  addUser(store, {
    id: "clerk",
    username: "clerk",
    password: "password1",
    memberships: [{ companyId: "c1", role: "viewer" }],
  });
  const company = createCompany(store, "clerk", "c1", draft, newId);
  assert.equal(company.number, "3");
  assert.equal(company.parentId, null);
  assert.equal(company.pfEmployeePercent, null);
  assert.equal(company.esiEmployeePercent, null);
  assert.equal(company.esiExceptionLimitPaise, 0);
  const clerk = store.users.find((user) => user.id === "clerk");
  const boss = store.users.find((user) => user.id === "boss");
  assert.equal(
    clerk?.memberships.find((item) => item.companyId === company.id)?.role,
    "viewer",
  );
  assert.equal(
    boss?.memberships.find((item) => item.companyId === company.id)?.role,
    "owner",
  );
  assert.equal(
    store.audit.some((item) => item.action.includes("password")),
    false,
  );
});

test("a site is a company under the company it was created from", () => {
  const store = seedStore();
  addUser(store, {
    id: "boss",
    username: "boss",
    password: "password1",
    accountOwner: true,
    memberships: [{ companyId: "c1", role: "owner" }],
  });
  const site = createCompany(
    store,
    "boss",
    "c1",
    { ...draft, shortName: "RIVER2", kind: "site" },
    newId,
  );
  assert.equal(site.parentId, "c1");
  assert.equal(
    store.users
      .find((user) => user.id === "boss")
      ?.memberships.filter((item) => item.companyId === site.id).length,
    1,
  );
});

test("a blank name, a duplicate short name, and an outsider are refused", () => {
  const store = seedStore();
  addUser(store, {
    id: "boss",
    username: "boss",
    password: "password1",
    accountOwner: true,
    memberships: [{ companyId: "c1", role: "owner" }],
  });
  const before = store.companies.length;
  assert.throws(
    () => createCompany(store, "boss", "c1", { ...draft, name: "  " }, newId),
    CompanyError,
  );
  assert.throws(
    () =>
      createCompany(
        store,
        "boss",
        "c1",
        { ...draft, shortName: "north" },
        newId,
      ),
    /short name/,
  );
  assert.throws(
    () => createCompany(store, "boss", "c2", draft, newId),
    /belong/,
  );
  assert.equal(store.companies.length, before);
  assert.throws(
    () =>
      saveCompanyIdentity(store, "c1", {
        name: "Northwind Components",
        shortName: "harbour",
        location: "",
        city: "",
        state: "Gujarat",
      }),
    /short name/,
  );
  assert.equal(store.companies[0]?.shortName, "NORTH");
});

test("saving the company profile writes every field together and audits no secret", () => {
  const store = seedStore();
  addUser(store, {
    id: "boss",
    username: "boss",
    password: "password1",
    accountOwner: true,
    memberships: [{ companyId: "c1", role: "owner" }],
  });
  const values: Record<string, string> = {
    district: "Gandhinagar",
    bankAccount: "123456789012",
    panNo: "ABCDE1234F",
    pfNo: "GJAHD1684981000",
    pfAc2Percent: "0.500",
  };
  saveCompanyDetails(
    store,
    "c1",
    "boss",
    {
      ...identity,
      professionalTax: false,
      pfEmployeePercent: "12",
      pfLimit: "15000.00",
      esiEmployeePercent: "0.75",
      esiExceptionLimit: "21000",
      field: (key) => values[key] ?? "",
      logo: { action: "keep" },
    },
    newId,
  );
  const company = store.companies[0];
  assert.equal(company?.profile.district, "Gandhinagar");
  assert.equal(company?.profile.pfAc2Percent, 0.5);
  assert.equal(company?.professionalTax, false);
  assert.equal(company?.pfEmployeePercent, 12);
  assert.equal(company?.pfLimitPaise, 1_500_000);
  assert.equal(company?.esiEmployeePercent, 0.75);
  assert.equal(company?.esiExceptionLimitPaise, 2_100_000);
  const audit = JSON.stringify(store.audit);
  assert.ok(audit.includes("Saved company profile"));
  for (const secret of ["123456789012", "ABCDE1234F", "GJAHD1684981000"]) {
    assert.equal(audit.includes(secret), false);
  }
});

test("a refused profile field leaves the whole company unchanged", () => {
  const store = seedStore();
  addUser(store, {
    id: "boss",
    username: "boss",
    password: "password1",
    accountOwner: true,
    memberships: [{ companyId: "c1", role: "owner" }],
  });
  const before = JSON.stringify(store.companies[0]);
  const auditBefore = store.audit.length;
  assert.throws(
    () =>
      saveCompanyDetails(
        store,
        "c1",
        "boss",
        {
          ...identity,
          name: "Renamed",
          professionalTax: false,
          pfEmployeePercent: "",
          pfLimit: "",
          esiEmployeePercent: "",
          esiExceptionLimit: "",
          field: (key) => (key === "pinCode" ? "12" : ""),
          logo: { action: "keep" },
        },
        newId,
      ),
    CompanyError,
  );
  assert.equal(JSON.stringify(store.companies[0]), before);
  assert.equal(store.audit.length, auditBefore);
  for (const [setting, pattern] of [
    ["pfEmployeePercent", /PF employee percent/],
    ["pfLimit", /PF limit/],
    ["esiEmployeePercent", /ESI employee percent/],
    ["esiExceptionLimit", /ESI exception limit/],
  ] as const) {
    assert.throws(
      () =>
        saveCompanyDetails(
          store,
          "c1",
          "boss",
          {
            ...identity,
            professionalTax: true,
            pfEmployeePercent: "",
            pfLimit: "",
            esiEmployeePercent: "",
            esiExceptionLimit: "",
            [setting]: "abc",
            field: () => "",
            logo: { action: "keep" },
          },
          newId,
        ),
      pattern,
    );
  }
  assert.equal(JSON.stringify(store.companies[0]), before);
});

test("a logo can be set from an image, refused when it is not one, and removed", () => {
  const store = seedStore();
  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9,
  ]);
  const base = {
    ...identity,
    professionalTax: true,
    pfEmployeePercent: "",
    pfLimit: "",
    esiEmployeePercent: "",
    esiExceptionLimit: "",
    field: () => "",
  };
  saveCompanyDetails(
    store,
    "c1",
    "nobody",
    { ...base, logo: { action: "set", bytes: png } },
    newId,
  );
  assert.match(
    store.companies[0]?.profile.logo ?? "",
    /^data:image\/png;base64,/,
  );
  saveCompanyDetails(
    store,
    "c1",
    "nobody",
    { ...base, logo: { action: "keep" } },
    newId,
  );
  assert.notEqual(store.companies[0]?.profile.logo, "");
  assert.throws(
    () =>
      saveCompanyDetails(
        store,
        "c1",
        "nobody",
        { ...base, logo: { action: "set", bytes: new Uint8Array([1, 2, 3]) } },
        newId,
      ),
    /PNG or JPEG/,
  );
  assert.notEqual(store.companies[0]?.profile.logo, "");
  saveCompanyDetails(
    store,
    "c1",
    "nobody",
    { ...base, logo: { action: "remove" } },
    newId,
  );
  assert.equal(store.companies[0]?.profile.logo, "");
});

test("a new company starts with a blank profile", () => {
  const store = seedStore();
  addUser(store, {
    id: "boss",
    username: "boss",
    password: "password1",
    accountOwner: true,
    memberships: [{ companyId: "c1", role: "owner" }],
  });
  const company = createCompany(store, "boss", "c1", draft, newId);
  assert.deepEqual(company.profile, emptyProfile());
});

const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9,
]);

function ownerStore() {
  const store = seedStore();
  addUser(store, {
    id: "boss",
    username: "boss",
    password: "password1",
    accountOwner: true,
    memberships: [{ companyId: "c1", role: "owner" }],
  });
  return store;
}

const fullDraft = (values: Record<string, string>) => ({
  ...draft,
  professionalTax: true,
  pfEmployeePercent: "12",
  pfLimit: "15000",
  esiEmployeePercent: "0.75",
  esiExceptionLimit: "21000",
  field: (key: string) => values[key] ?? "",
  logo: { action: "set" as const, bytes: png },
});

test("a new company or site is created with every detail the edit form holds", () => {
  const store = ownerStore();
  const values = {
    district: "Surat",
    bankAccount: "123456789012",
    bankIfsc: "hdfc0001234",
    panNo: "ABCDE1234F",
    pfNo: "GJAHD1684981000",
    pfAc2Percent: "0.500",
    esiCalculation: "gross",
  };
  const company = createCompany(store, "boss", "c1", fullDraft(values), newId);
  assert.equal(company.profile.district, "Surat");
  assert.equal(company.profile.bankIfsc, "HDFC0001234");
  assert.equal(company.profile.panNo, "ABCDE1234F");
  assert.equal(company.profile.pfAc2Percent, 0.5);
  assert.equal(company.profile.esiCalculation, "gross");
  assert.match(company.profile.logo, /^data:image\/png;base64,/);
  assert.equal(company.professionalTax, true);
  assert.equal(company.pfEmployeePercent, 12);
  assert.equal(company.pfLimitPaise, 1_500_000);
  assert.equal(company.esiEmployeePercent, 0.75);
  assert.equal(company.esiExceptionLimitPaise, 2_100_000);

  const site = createCompany(
    store,
    "boss",
    "c1",
    { ...fullDraft(values), shortName: "RIVER2", kind: "site" },
    newId,
  );
  assert.equal(site.parentId, "c1");
  assert.equal(site.profile.pfNo, "GJAHD1684981000");

  const audit = JSON.stringify(store.audit);
  for (const secret of ["123456789012", "ABCDE1234F", "GJAHD1684981000"]) {
    assert.equal(audit.includes(secret), false);
  }
});

test("a refused field on a new company creates nothing", () => {
  const store = ownerStore();
  const companies = store.companies.length;
  const audit = store.audit.length;
  const users = JSON.stringify(store.users);
  const refused: Record<string, string>[] = [
    { panNo: "not-a-pan" },
    { bankIfsc: "123" },
    { pfAc2Percent: "250" },
  ];
  for (const values of refused) {
    assert.throws(
      () => createCompany(store, "boss", "c1", fullDraft(values), newId),
      CompanyError,
    );
  }
  assert.throws(
    () =>
      createCompany(
        store,
        "boss",
        "c1",
        {
          ...fullDraft({}),
          logo: { action: "set", bytes: new Uint8Array([1, 2, 3]) },
        },
        newId,
      ),
    /PNG or JPEG/,
  );
  assert.equal(store.companies.length, companies);
  assert.equal(store.audit.length, audit);
  assert.equal(JSON.stringify(store.users), users);
});
