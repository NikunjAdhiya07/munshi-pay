import fs from "node:fs";
import path from "node:path";
import { emptyProfile, withProfile } from "../domain/companyProfile.ts";
import { MENUS, type Right, type Role, type Store } from "./model.ts";

function rightsFor(role: Role, allowWrite: boolean): Right[] {
  return MENUS.map((menu) => ({
    role,
    menu,
    view: true,
    add: allowWrite,
    edit: allowWrite,
    delete: allowWrite,
  }));
}

export function seedStore(): Store {
  return {
    source: "demo",
    companies: [
      {
        id: "c1",
        number: "1",
        shortName: "NORTH",
        name: "Northwind Components",
        location: "",
        city: "",
        state: "Gujarat",
        parentId: null,
        professionalTax: true,
        pfEmployeePercent: null,
        pfLimitPaise: null,
        esiEmployeePercent: null,
        esiExceptionLimitPaise: 2_100_000,
        profile: emptyProfile(),
      },
      {
        id: "c2",
        number: "2",
        shortName: "HARBOUR",
        name: "Harbour Logistics",
        location: "",
        city: "",
        state: "Maharashtra",
        parentId: null,
        professionalTax: false,
        pfEmployeePercent: null,
        pfLimitPaise: null,
        esiEmployeePercent: null,
        esiExceptionLimitPaise: 2_100_000,
        profile: emptyProfile(),
      },
    ],
    categories: [
      {
        id: "cat-staff",
        companyId: "c1",
        name: "Staff",
        structure: "gross",
        basicPercent: 50,
        daPercent: 20,
      },
      {
        id: "cat-worker",
        companyId: "c1",
        name: "Worker",
        structure: "gross",
        basicPercent: 70,
        daPercent: 10,
      },
    ],
    employees: [
      employee("e1", "E001", "Asha Rao", "cat-staff", "salary", 4_000_000, "", {
        mobile: "9000000001",
        birthDate: "1990-10-07",
        pan: "DEMO-PAN",
        aadhaar: "DEMO-AADHAAR",
        uan: "DEMO-UAN",
        bankName: "Demo Bank",
        ifsc: "DEMO0000001",
        account: "DEMO-ACCOUNT",
        pfBankName: "Demo PF Bank",
        pfIfsc: "DEMO0000002",
        pfAccount: "DEMO-PF",
      }),
      employee(
        "e2",
        "E002",
        "Ravi Menon",
        "cat-worker",
        "per-day",
        80_000,
        "",
        {
          birthDate: "1992-10-20",
          joinDate: "2026-09-20",
          bankName: "Demo Bank",
          ifsc: "DEMO0000001",
          account: "DEMO-ACCOUNT",
        },
      ),
      employee("e3", "E003", "Meera Shah", "cat-staff", "salary", 0, ""),
      employee("e4", "E004", "Imran Qureshi", null, "salary", 3_200_000, ""),
      employee(
        "e5",
        "E005",
        "Leela Das",
        "cat-staff",
        "salary",
        2_800_000,
        "2026-09-30",
      ),
      employee(
        "e6",
        "E006",
        "Nikhil Bose",
        "cat-staff",
        "salary",
        8_000_000,
        "",
      ),
    ],
    misc: [
      item("m1", "department", "Accounts"),
      item("m2", "department", "Plant"),
      item("m3", "designation", "Accountant"),
      item("m4", "designation", "Operator"),
      item("m5", "bank", "Demo Bank"),
      item("m6", "bank", "Demo PF Bank"),
    ],
    holidays: [
      {
        id: "h1",
        companyId: "c1",
        date: "2026-10-02",
        year: "2026",
        description: "Gandhi Jayanti",
      },
    ],
    shifts: [
      {
        id: "s1",
        companyId: "c1",
        name: "General",
        inTime: "09:30",
        outTime: "18:30",
        hours: "8",
      },
    ],
    slabs: [
      {
        id: "pt1",
        companyId: "c1",
        asOn: "2026-04-01",
        state: "Gujarat",
        lowerPaise: 0,
        upperPaise: 99_999_999,
        amountPaise: 20_000,
      },
    ],
    muster: [
      muster("mu1", "e1", 26),
      muster("mu2", "e2", 20),
      muster("mu6", "e6", 26),
    ],
    loans: [
      {
        id: "ln1",
        companyId: "c1",
        employeeId: "e1",
        date: "2026-04-01",
        amountPaise: 500_000,
        installmentPaise: 100_000,
        receivedPaise: 0,
        paidInstallments: 0,
        posts: [],
      },
    ],
    deductions: [
      {
        id: "d1",
        companyId: "c1",
        employeeId: "e2",
        period: "2026-10",
        type: "Food",
        amountPaise: 25_000,
      },
    ],
    leavePolicies: [
      {
        id: "lp1",
        companyId: "c1",
        cadre: "Staff",
        name: "Privilege leave",
        duration: "12 days",
        ratio: "1 per 20 worked",
      },
    ],
    leaveBalances: [
      {
        id: "lb1",
        companyId: "c1",
        employeeId: "e1",
        year: "2026",
        leaveName: "Privilege leave",
        broughtForward: 2,
        yearCount: 12,
        balance: 10,
      },
    ],
    encashments: [],
    runs: [],
    locks: [],
    audit: [],
    imports: [],
    rights: [...rightsFor("owner", true), ...rightsFor("viewer", false)],
    users: [],
    signInFailures: [],
  };
}

function employee(
  id: string,
  code: string,
  name: string,
  categoryId: string | null,
  salaryBase: "salary" | "per-day",
  grossPaise: number,
  leftDate: string,
  patch: Partial<Store["employees"][number]> = {},
): Store["employees"][number] {
  return {
    id,
    companyId: "c1",
    code,
    name,
    mobile: "",
    email: "",
    paymentBy: "bank",
    bankName: "",
    ifsc: "",
    account: "",
    payee: name,
    pfBankName: "",
    pfIfsc: "",
    pfAccount: "",
    salaryBase,
    gender: "female",
    department: id === "e2" ? "Plant" : "Accounts",
    designation: id === "e2" ? "Operator" : "Accountant",
    marital: "unmarried",
    birthDate: "",
    joinDate: "2024-04-01",
    leftDate,
    leftReason: leftDate ? "Resigned" : "",
    pan: "",
    aadhaar: "",
    pfDeduct: true,
    voluntaryPf: false,
    pfNumber: "",
    uan: "",
    epfMode: "limited-basic",
    esiDeduct: true,
    esiNumber: "",
    bloodGroup: "",
    shift: "General",
    weekOff: "Sunday",
    noticeDays: "30",
    emergencyName: "",
    emergencyPhone: "",
    nomineeName: "",
    nomineeRelation: "",
    nomineePercent: "",
    nomineeBirthDate: "",
    salaryRows:
      grossPaise > 0
        ? [
            {
              id: `${id}-sal`,
              asOn: "2026-04-01",
              categoryId,
              grossPaise,
              ctcPaise: null,
            },
          ]
        : [],
    documents: [],
    ...patch,
  };
}

function item(
  id: string,
  type: "department" | "designation" | "bank",
  description: string,
): Store["misc"][number] {
  return { id, companyId: "c1", type, description };
}

function muster(
  id: string,
  employeeId: string,
  paidDays: number,
): Store["muster"][number] {
  return {
    id,
    companyId: "c1",
    employeeId,
    period: "2026-10",
    paidDays,
    weekOff: 4,
    publicHoliday: 1,
    compOff: 0,
    onDuty: 0,
  };
}

const cache = new Map<string, Store>();

export function storePath(): string {
  return (
    process.env.STORE_PATH ?? path.join(process.cwd(), "data", "store.json")
  );
}

/** Sample seed stays Demo. A store the company has saved, or an older file, does not. */
export function dataOrigin(store: {
  source?: "demo" | "company";
}): "demo" | "company" {
  return store.source === "demo" ? "demo" : "company";
}

export function originLabel(store: {
  source?: "demo" | "company";
}): "Demo" | "Company store" {
  return dataOrigin(store) === "demo" ? "Demo" : "Company store";
}

export function readStore(): Store {
  const file = storePath();
  const hit = cache.get(file);
  if (hit) return hit;
  let store: Store;
  if (fs.existsSync(/*turbopackIgnore: true*/ file)) {
    store = JSON.parse(
      fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8"),
    ) as Store;
    ensureStore(store);
  } else {
    store = seedStore();
    writeStore(store);
  }
  cache.set(file, store);
  return store;
}

export function writeStore(store: Store): void {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    /*turbopackIgnore: true*/ file,
    JSON.stringify(store, null, 2),
  );
  cache.set(file, store);
}

export function updateStore(change: (store: Store) => void): Store {
  const store = readStore();
  change(store);
  store.source = "company";
  writeStore(store);
  return store;
}

export function resetStoreCache(): void {
  cache.clear();
}

function ensureStore(store: Store): void {
  store.imports ??= [];
  store.users ??= [];
  store.signInFailures ??= [];
  let highest = 0;
  for (const company of store.companies) {
    const parsed = Number(company.number);
    if (Number.isInteger(parsed) && parsed > highest) highest = parsed;
  }
  for (const company of store.companies) {
    company.location ??= "";
    company.city ??= "";
    company.parentId ??= null;
    company.profile = withProfile(company.profile);
    if (!company.number) company.number = String(++highest);
  }
  for (const loan of store.loans) {
    loan.paidInstallments ??= 0;
    loan.posts ??= [];
  }
  for (const holiday of store.holidays)
    holiday.year ??= holiday.date.slice(0, 4);
  for (const person of store.employees) {
    // The reference turns these on for a new employee. A name that was saved
    // whole stays whole: it is not split into parts by guesswork.
    person.bonusEligible ??= true;
    person.leaveEncashment ??= true;
    person.abry ??= false;
  }
  for (const menu of MENUS) {
    for (const role of ["owner", "viewer"] as const) {
      if (
        store.rights.some((right) => right.role === role && right.menu === menu)
      ) {
        continue;
      }
      const allow = role === "owner";
      store.rights.push({
        role,
        menu,
        view: true,
        add: allow,
        edit: allow,
        delete: allow,
      });
    }
  }
}
