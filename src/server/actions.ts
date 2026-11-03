"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { PROFILE_FIELDS, SECRET_KEYS } from "../domain/companyProfile";
import { keepIfMasked } from "../domain/employees";
import { fileProblem, findImport } from "../domain/import";
import { parseRupeeText } from "../domain/money";
import { navPaths } from "../domain/navigation";
import { can, safeReturnPath } from "./access";
import {
  authEnv,
  clearSession,
  currentPeriod,
  lastCompany,
  rememberCompany,
  requireSession,
  requireView,
  writePeriod,
  writeSession,
} from "./auth";
import {
  addCategory,
  CategoryError,
  deleteCategory,
  updateCategory,
} from "./categories";
import {
  type CompanyDetailsInput,
  CompanyError,
  createCompany,
  type LogoChange,
  saveCompanyDetails,
} from "./companies";
import {
  addDeduction as createDeduction,
  DeductionError,
  deleteDeduction,
  listedType,
  updateDeduction,
} from "./deductions";
import {
  addEmployee,
  deleteEmployee,
  EmployeeError,
  updateProfile,
} from "./employees";
import { addHoliday, deleteHoliday, HolidayError } from "./holidays";
import {
  commitPreview,
  ImportError,
  reviewUpload,
  savePreview,
} from "./import";
import {
  addLeavePolicy,
  deleteLeavePolicy,
  LEAVE_POLICY_FIELDS,
  LeavePolicyError,
  type LeavePolicyInput,
  updateLeavePolicy,
} from "./leavePolicy";
import {
  addBalance,
  addEncashment,
  type CarryResult,
  carryForward,
  deleteBalance,
  LeaveRegisterError,
  updateBalance,
} from "./leaveRegister";
import {
  addLoan as createLoan,
  deleteLoan,
  LoanError,
  type LoanInput,
  updateLoan,
} from "./loans";
import {
  addMisc,
  assertListed,
  deleteMisc,
  MiscError,
  updateMisc,
} from "./misc";
import { recordMuster } from "./muster";
import {
  adjustLine,
  lockPeriod,
  PayrollError,
  processPeriod,
  unlockPeriod,
} from "./payroll";
import {
  addShift,
  assertShiftListed,
  deleteShift,
  SHIFT_FIELDS,
  ShiftError,
  type ShiftInput,
  updateShift,
} from "./shifts";
import { addSlab, deleteSlab, SlabError, updateSlab } from "./slabs";
import { readStore, updateStore, writeStore } from "./store";
import {
  changePassword,
  landingCompany,
  memberOf,
  roleFor,
  signIn,
  UserError,
} from "./users";

class InputError extends Error {}

/** Rupees from a form field as paise. Blank is zero; anything else invalid is refused. */
function money(form: FormData, name: string, label: string): number {
  const raw = String(form.get(name) ?? "").trim();
  if (!raw) return 0;
  const paise = parseRupeeText(raw);
  if (paise === null) {
    throw new InputError(
      `${label} must be an amount in rupees with at most two decimals.`,
    );
  }
  return paise;
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

async function guard(menu: string, action: "add" | "edit" | "delete" = "edit") {
  const session = await requireSession();
  const store = readStore();
  if (!session.companyId) redirect("/companies");
  if (!can(session.role, store.rights, menu, action)) {
    redirect("/app?error=You+do+not+have+permission+for+that+action");
  }
  if (!store.companies.some((company) => company.id === session.companyId)) {
    redirect("/");
  }
  return session;
}

export async function login(form: FormData): Promise<void> {
  if (!process.env.AUTH_SECRET) {
    redirect("/?error=Authentication+is+not+configured");
  }
  const store = readStore();
  const result = signIn(
    store,
    text(form, "username"),
    String(form.get("password") ?? ""),
    Date.now(),
    authEnv(),
  );
  writeStore(store);
  if (result.status === "unconfigured") {
    redirect("/?error=Authentication+is+not+configured");
  }
  if (result.status === "limited") {
    redirect("/?error=Too+many+attempts.+Wait+and+try+again");
  }
  if (result.status !== "ok") {
    redirect("/?error=User+id+or+password+is+incorrect");
  }
  const user = store.users.find((item) => item.id === result.userId);
  if (!user) redirect("/?error=User+id+or+password+is+incorrect");
  // Straight to the dashboard: the company used last, or the first one by name.
  // A login with no company has nothing to open and sees the company page.
  const landing = landingCompany(store, user.id, await lastCompany(user.id));
  await writeSession({
    userId: user.id,
    companyId: landing?.id ?? "",
    version: user.sessionVersion,
  });
  if (!landing) redirect("/companies");
  await rememberCompany(user.id, landing.id);
  redirect("/app");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/");
}

export async function switchCompany(form: FormData): Promise<void> {
  const session = await requireSession();
  const companyId = text(form, "companyId");
  const store = readStore();
  if (!memberOf(store, session.userId, companyId)) {
    redirect("/app?error=That+company+is+not+open+for+this+login");
  }
  await writeSession({
    userId: session.userId,
    companyId,
    version: session.version,
  });
  await rememberCompany(session.userId, companyId);
  // Stay on the same page when the new company's role may open it.
  const stay = safeReturnPath(
    text(form, "from"),
    roleFor(store, session.userId, companyId),
    store.rights,
    navPaths,
  );
  redirect(stay ?? "/app");
}

export async function enterCompany(form: FormData): Promise<void> {
  const session = await requireSession();
  const companyId = text(form, "companyId");
  const query = text(form, "q");
  const store = readStore();
  const allowed = memberOf(store, session.userId, companyId);
  const back = new URLSearchParams();
  if (query) back.set("q", query);
  if (!allowed) {
    back.set("error", "That company is not open for this login.");
    redirect(`/companies?${back.toString()}`);
  }
  await writeSession({
    userId: session.userId,
    companyId,
    version: session.version,
  });
  await rememberCompany(session.userId, companyId);
  redirect("/app");
}

export async function replacePassword(form: FormData): Promise<void> {
  const session = await requireSession();
  try {
    updateStore((store) => {
      changePassword(
        store,
        session.userId,
        String(form.get("current") ?? ""),
        String(form.get("next") ?? ""),
        new Date().toISOString(),
        randomUUID(),
      );
    });
  } catch (error) {
    if (!(error instanceof UserError)) throw error;
    redirect(`/companies?error=${encodeURIComponent(error.message)}`);
  }
  await clearSession();
  redirect("/?notice=Sign+in+with+the+new+password");
}

export async function setPeriod(form: FormData): Promise<void> {
  const session = await requireSession();
  const period = text(form, "period");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
    redirect("/app?error=Choose+a+valid+month");
  await writePeriod(period);
  // Stay on the page the person was on. Process salary is no longer forced.
  const stay = safeReturnPath(
    text(form, "from"),
    session.role,
    readStore().rights,
    navPaths,
  );
  redirect(stay ?? "/app");
}

/** The whole company form as the text a person typed, plus the logo choice. */
async function companyDetails(form: FormData): Promise<CompanyDetailsInput> {
  const upload = form.get("logo");
  let logo: LogoChange = { action: "keep" };
  if (form.get("removeLogo") === "on") logo = { action: "remove" };
  if (upload instanceof File && upload.size > 0) {
    logo = { action: "set", bytes: new Uint8Array(await upload.arrayBuffer()) };
  }
  return {
    name: text(form, "name"),
    shortName: text(form, "shortName"),
    location: text(form, "location"),
    city: text(form, "city"),
    state: text(form, "state"),
    professionalTax: form.get("professionalTax") === "on",
    pfEmployeePercent: text(form, "pfEmployeePercent"),
    pfLimit: text(form, "pfLimit"),
    esiEmployeePercent: text(form, "esiEmployeePercent"),
    esiExceptionLimit: text(form, "esiExceptionLimit"),
    field: (key) => text(form, key),
    logo,
  };
}

export async function saveCompany(form: FormData): Promise<void> {
  const session = await guard("company");
  const details = await companyDetails(form);
  try {
    updateStore((store) => {
      saveCompanyDetails(
        store,
        session.companyId,
        session.userId,
        details,
        randomUUID,
      );
    });
  } catch (error) {
    if (!(error instanceof CompanyError)) throw error;
    redirect(`/app/company/profile?${profileDraft(form, error.message)}`);
  }
  redirect("/app/company/profile?notice=Company+profile+saved");
}

/**
 * What a refused save sends back so the form keeps what was typed. Bank
 * account, PAN, and TAN never go into the address, and the logo cannot.
 */
function profileDraft(form: FormData, error: string, extra = ""): string {
  const keys = [
    "name",
    "shortName",
    "location",
    "city",
    "state",
    "professionalTax",
    "pfEmployeePercent",
    "pfLimit",
    "esiEmployeePercent",
    "esiExceptionLimit",
    ...PROFILE_FIELDS.map((field) => field.key).filter(
      (key) => !SECRET_KEYS.includes(key),
    ),
  ];
  const params = new URLSearchParams({ error, draft: "1" });
  if (extra) params.set("kind", extra);
  for (const key of keys) params.set(key, text(form, key));
  return params.toString();
}

export async function addCompany(form: FormData): Promise<void> {
  const session = await guard("company", "add");
  const kind = text(form, "kind") === "site" ? "site" : "company";
  const details = await companyDetails(form);
  try {
    updateStore((store) => {
      createCompany(
        store,
        session.userId,
        session.companyId,
        { ...details, kind },
        randomUUID,
      );
    });
  } catch (error) {
    if (!(error instanceof CompanyError)) throw error;
    redirect(`/app/company/new?${profileDraft(form, error.message, kind)}`);
  }
  redirect(
    `/app/company?notice=${kind === "site" ? "Site+created" : "Company+created"}`,
  );
}
/** Opens a membership company on its profile. Creating a company does not do this. */
export async function openCompany(form: FormData): Promise<void> {
  const session = await requireView("company");
  const companyId = text(form, "companyId");
  const store = readStore();
  if (!memberOf(store, session.userId, companyId)) {
    redirect("/app/company?error=That+company+is+not+open+for+this+login");
  }
  await writeSession({
    userId: session.userId,
    companyId,
    version: session.version,
  });
  redirect("/app/company/profile");
}

/** The employee fields a form posts. Checkboxes are on or off, never missing. */
function employeeInput(form: FormData) {
  const on = (name: string) => form.get(name) === "on";
  return {
    firstName: text(form, "firstName"),
    middleName: text(form, "middleName"),
    lastName: text(form, "lastName"),
    joinDate: text(form, "joinDate"),
    gender: text(form, "gender") || "male",
    salaryBase: text(form, "salaryBase") || "salary",
    department: text(form, "department"),
    designation: text(form, "designation"),
    mobile: text(form, "mobile"),
    email: text(form, "email"),
    pfDeduct: on("pfDeduct"),
    esiDeduct: on("esiDeduct"),
  };
}

export async function createEmployee(form: FormData): Promise<void> {
  const session = await guard("employees", "add");
  const input = employeeInput(form);
  let id = "";
  try {
    updateStore((store) => {
      id = addEmployee(
        store,
        session.companyId,
        session.username,
        input,
        randomUUID,
      ).id;
    });
  } catch (error) {
    if (!(error instanceof EmployeeError || error instanceof MiscError)) {
      throw error;
    }
    // Keep what the person typed so they can correct it.
    const draft = new URLSearchParams({
      error: error.message,
      firstName: input.firstName,
      middleName: input.middleName,
      lastName: input.lastName,
      joinDate: input.joinDate,
      gender: input.gender,
      salaryBase: input.salaryBase,
      department: input.department,
      designation: input.designation,
      mobile: input.mobile,
      email: input.email,
      pfDeduct: input.pfDeduct ? "1" : "0",
      esiDeduct: input.esiDeduct ? "1" : "0",
    });
    redirect(`/app/employees/new?${draft.toString()}`);
  }
  redirect(`/app/employees/${id}?notice=Employee+created`);
}
export async function removeEmployee(form: FormData): Promise<void> {
  const session = await guard("employees", "delete");
  const id = text(form, "id");
  const code = text(form, "code");
  try {
    updateStore((store) => {
      deleteEmployee(store, session.companyId, id, session.username, code);
    });
  } catch (error) {
    if (error instanceof EmployeeError) {
      redirect(
        `/app/employees?confirm=${encodeURIComponent(id)}&error=${encodeURIComponent(error.message)}`,
      );
    }
    throw error;
  }
  redirect("/app/employees?notice=Employee+deleted");
}

export async function saveEmployee(form: FormData): Promise<void> {
  const session = await guard("employees");
  const id = text(form, "id");
  const tabName = text(form, "tab") || "profile";
  try {
    updateStore((store) => {
      const employee = store.employees.find(
        (item) => item.id === id && item.companyId === session.companyId,
      );
      if (!employee) return;
      const tab = tabName;
      if (tab === "profile") {
        const on = (name: string) => form.get(name) === "on";
        updateProfile(
          store,
          session.companyId,
          session.username,
          id,
          {
            ...employeeInput(form),
            paymentBy: text(form, "paymentBy") || "bank",
            bankName: text(form, "bankName"),
            ifsc: text(form, "ifsc"),
            account: text(form, "account"),
            payee: text(form, "payee"),
            marital: text(form, "marital") || "unmarried",
            birthDate: text(form, "birthDate"),
            leftDate: text(form, "leftDate"),
            leftReason: text(form, "leftReason"),
            localAddress: text(form, "localAddress"),
            permanentAddress: text(form, "permanentAddress"),
            pan: text(form, "pan"),
            aadhaar: text(form, "aadhaar"),
            voluntaryPf: on("voluntaryPf"),
            pfNumber: text(form, "pfNumber"),
            uan: text(form, "uan"),
            epfMode: text(form, "epfMode") || "limited-basic",
            pfJoinDate: text(form, "pfJoinDate"),
            pfLeaveDate: text(form, "pfLeaveDate"),
            pfLeaveReason: text(form, "pfLeaveReason"),
            esiNumber: text(form, "esiNumber"),
            esiDispensary: text(form, "esiDispensary"),
            esiJoinDate: text(form, "esiJoinDate"),
            esiLeaveDate: text(form, "esiLeaveDate"),
            esiLeaveReason: text(form, "esiLeaveReason"),
            bonusEligible: on("bonusEligible"),
            leaveEncashment: on("leaveEncashment"),
            abry: on("abry"),
          },
          randomUUID,
        );
      }
      if (tab === "other") {
        assertListed(
          store,
          session.companyId,
          "bank",
          text(form, "pfBankName"),
          employee.pfBankName ?? "",
        );
        assertShiftListed(
          store,
          session.companyId,
          text(form, "shift"),
          employee.shift ?? "",
        );
        employee.bloodGroup = text(form, "bloodGroup");
        employee.pfBankName = text(form, "pfBankName");
        employee.pfIfsc = text(form, "pfIfsc");
        employee.pfAccount = keepIfMasked(
          text(form, "pfAccount"),
          employee.pfAccount ?? "",
        );
        employee.shift = text(form, "shift");
        employee.weekOff = text(form, "weekOff");
        employee.noticeDays = text(form, "noticeDays");
        employee.emergencyName = text(form, "emergencyName");
        employee.emergencyPhone = text(form, "emergencyPhone");
      }
      if (tab === "salary") {
        const gross = money(form, "gross", "Gross");
        const asOn = text(form, "asOn");
        const categoryId = text(form, "categoryId") || null;
        const ctc = text(form, "ctc") ? money(form, "ctc", "CTC") : null;
        if (gross > 0 && asOn) {
          employee.salaryRows.push({
            id: randomUUID(),
            asOn,
            categoryId,
            grossPaise: gross,
            ctcPaise: ctc,
          });
        }
      }
      if (tab === "nominee") {
        employee.nomineeName = text(form, "nomineeName");
        employee.nomineeRelation = text(form, "nomineeRelation");
        employee.nomineePercent = text(form, "nomineePercent");
        employee.nomineeBirthDate = text(form, "nomineeBirthDate");
      }
      if (tab === "documents") {
        const docType = text(form, "docType");
        if (docType) {
          employee.documents.push({
            id: randomUUID(),
            type: docType,
            number: text(form, "docNumber"),
            nameOnDocument: text(form, "docName"),
            fileName: "",
          });
        }
      }
    });
  } catch (error) {
    if (
      !(
        error instanceof MiscError ||
        error instanceof EmployeeError ||
        error instanceof ShiftError ||
        error instanceof InputError
      )
    ) {
      throw error;
    }
    redirect(
      `/app/employees/${id}?tab=${tabName}&error=${encodeURIComponent(error.message)}`,
    );
  }
  redirect(`/app/employees/${id}?tab=${tabName}&notice=Saved`);
}

export async function saveMisc(form: FormData): Promise<void> {
  const id = text(form, "id");
  const session = await guard("masters", id ? "edit" : "add");
  const type = text(form, "type");
  const description = text(form, "description");
  try {
    updateStore((store) => {
      if (id) {
        updateMisc(
          store,
          session.companyId,
          session.username,
          id,
          description,
          randomUUID,
        );
      } else {
        addMisc(
          store,
          session.companyId,
          session.username,
          { type, description },
          randomUUID,
        );
      }
    });
  } catch (error) {
    if (!(error instanceof MiscError)) throw error;
    // Keep what the person typed so they can correct it.
    const draft = new URLSearchParams({ error: error.message, description });
    if (type) draft.set("type", type);
    if (id) draft.set("edit", id);
    redirect(`/app/misc?${draft.toString()}`);
  }
  redirect(
    `/app/misc?notice=${encodeURIComponent(id ? "Entry updated" : "Entry added")}`,
  );
}

export async function removeMisc(form: FormData): Promise<void> {
  const session = await guard("masters", "delete");
  const id = text(form, "id");
  try {
    updateStore((store) =>
      deleteMisc(store, session.companyId, session.username, id, randomUUID),
    );
  } catch (error) {
    if (!(error instanceof MiscError)) throw error;
    redirect(`/app/misc?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/app/misc?notice=Entry+deleted");
}

export async function addMaster(): Promise<void> {
  await guard("masters", "add");
  redirect("/app/masters?notice=Saved");
}

export async function saveHoliday(form: FormData): Promise<void> {
  const session = await guard("masters", "add");
  const input = {
    date: text(form, "date"),
    year: text(form, "year"),
    description: text(form, "description"),
  };
  try {
    updateStore((store) =>
      addHoliday(store, session.companyId, session.username, input, randomUUID),
    );
  } catch (error) {
    if (!(error instanceof HolidayError)) throw error;
    const draft = new URLSearchParams({ error: error.message, ...input });
    redirect(`/app/holidays?${draft.toString()}`);
  }
  redirect("/app/holidays?notice=Holiday+added");
}

export async function removeHoliday(form: FormData): Promise<void> {
  const session = await guard("masters", "delete");
  try {
    updateStore((store) =>
      deleteHoliday(
        store,
        session.companyId,
        session.username,
        text(form, "id"),
        randomUUID,
      ),
    );
  } catch (error) {
    if (!(error instanceof HolidayError)) throw error;
    redirect(`/app/holidays?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/app/holidays?notice=Holiday+deleted");
}

export async function saveShift(form: FormData): Promise<void> {
  const id = text(form, "id");
  const session = await guard("masters", id ? "edit" : "add");
  const input = Object.fromEntries(
    SHIFT_FIELDS.map((field) => [field, text(form, field)]),
  ) as ShiftInput;
  try {
    updateStore((store) => {
      if (id) {
        updateShift(
          store,
          session.companyId,
          session.username,
          id,
          input,
          randomUUID,
        );
      } else {
        addShift(store, session.companyId, session.username, input, randomUUID);
      }
    });
  } catch (error) {
    if (!(error instanceof ShiftError)) throw error;
    // Keep what the person typed so they can correct it.
    const draft = new URLSearchParams({ ...input, error: error.message });
    if (id) draft.set("edit", id);
    redirect(`/app/shifts?${draft.toString()}`);
  }
  redirect(
    `/app/shifts?notice=${encodeURIComponent(id ? "Shift updated" : "Shift added")}`,
  );
}

export async function removeShift(form: FormData): Promise<void> {
  const session = await guard("masters", "delete");
  const id = text(form, "id");
  try {
    updateStore((store) =>
      deleteShift(store, session.companyId, session.username, id, randomUUID),
    );
  } catch (error) {
    if (!(error instanceof ShiftError)) throw error;
    redirect(`/app/shifts?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/app/shifts?notice=Shift+deleted");
}

export async function saveSlab(form: FormData): Promise<void> {
  const id = text(form, "id");
  const session = await guard("masters", id ? "edit" : "add");
  const input = {
    asOn: text(form, "asOn"),
    state: text(form, "state"),
    lower: text(form, "lower"),
    upper: text(form, "upper"),
    amount: text(form, "amount"),
  };
  try {
    updateStore((store) => {
      if (id) {
        updateSlab(
          store,
          session.companyId,
          session.username,
          id,
          input,
          randomUUID,
        );
      } else {
        addSlab(store, session.companyId, session.username, input, randomUUID);
      }
    });
  } catch (error) {
    if (!(error instanceof SlabError)) throw error;
    const draft = new URLSearchParams({ error: error.message, ...input });
    if (id) draft.set("editSlab", id);
    redirect(`/app/masters?${draft.toString()}#pt-title`);
  }
  redirect(
    `/app/masters?notice=${encodeURIComponent(id ? "Slab updated" : "Slab added")}#pt-title`,
  );
}

export async function removeSlab(form: FormData): Promise<void> {
  const session = await guard("masters", "delete");
  try {
    updateStore((store) =>
      deleteSlab(
        store,
        session.companyId,
        session.username,
        text(form, "id"),
        randomUUID,
      ),
    );
  } catch (error) {
    if (!(error instanceof SlabError)) throw error;
    redirect(`/app/masters?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/app/masters?notice=Slab+deleted#pt-title");
}

function count(form: FormData, name: string): number {
  const value = Number(text(form, name) || "0");
  return Number.isFinite(value) ? value : 0;
}

export async function saveCategory(form: FormData): Promise<void> {
  const id = text(form, "id");
  const session = await guard("masters", id ? "edit" : "add");
  const structure = text(form, "structure") === "ctc" ? "ctc" : "gross";
  const input = {
    name: text(form, "name"),
    structure,
    basicPercent: text(form, "basicPercent"),
    daPercent: text(form, "daPercent"),
  } as const;
  try {
    updateStore((store) => {
      if (id) {
        updateCategory(
          store,
          session.companyId,
          session.username,
          id,
          input,
          randomUUID,
        );
      } else {
        addCategory(
          store,
          session.companyId,
          session.username,
          input,
          randomUUID,
        );
      }
    });
  } catch (error) {
    if (!(error instanceof CategoryError)) throw error;
    // Keep what the person typed so they can correct it.
    const draft = new URLSearchParams({
      error: error.message,
      name: input.name,
      structure,
      basic: input.basicPercent,
      da: input.daPercent,
    });
    if (id) draft.set("edit", id);
    redirect(`/app/percentages?${draft.toString()}`);
  }
  redirect(
    `/app/percentages?notice=${encodeURIComponent(id ? "Category updated" : "Category added")}`,
  );
}

export async function removeCategory(form: FormData): Promise<void> {
  const session = await guard("masters", "delete");
  const id = text(form, "id");
  try {
    updateStore((store) =>
      deleteCategory(
        store,
        session.companyId,
        session.username,
        id,
        randomUUID,
      ),
    );
  } catch (error) {
    if (!(error instanceof CategoryError)) throw error;
    redirect(`/app/percentages?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/app/percentages?notice=Category+deleted");
}

export async function saveMuster(form: FormData): Promise<void> {
  const session = await guard("muster");
  const period = await currentPeriod();
  try {
    updateStore((store) =>
      recordMuster(
        store,
        session.companyId,
        period,
        (id) => ({
          paidDays: count(form, `paid-${id}`),
          weekOff: count(form, `wo-${id}`),
          publicHoliday: count(form, `ph-${id}`),
          compOff: count(form, `cf-${id}`),
          onDuty: count(form, `od-${id}`),
        }),
        randomUUID,
      ),
    );
  } catch (error) {
    const message =
      error instanceof PayrollError ? error.message : "Muster was not saved";
    redirect(`/app/muster?error=${encodeURIComponent(message)}`);
  }
  redirect("/app/muster?notice=Muster+saved");
}

export async function saveLoan(form: FormData): Promise<void> {
  const id = text(form, "id");
  const session = await guard("loans", id ? "edit" : "add");
  const input: LoanInput = {
    employeeId: text(form, "employeeId"),
    date: text(form, "date"),
    amount: text(form, "amount"),
    installment: text(form, "installment"),
    received: text(form, "received"),
  };
  try {
    updateStore((store) => {
      if (id) {
        updateLoan(
          store,
          session.companyId,
          session.username,
          id,
          input,
          randomUUID,
        );
      } else {
        createLoan(
          store,
          session.companyId,
          session.username,
          input,
          randomUUID,
        );
      }
    });
  } catch (error) {
    if (!(error instanceof LoanError)) throw error;
    const draft = new URLSearchParams({
      error: error.message,
      ...input,
      ...(id ? { edit: id } : {}),
    });
    redirect(`/app/loans?${draft.toString()}`);
  }
  redirect(`/app/loans?notice=${id ? "Loan+updated" : "Loan+saved"}`);
}

export async function removeLoan(form: FormData): Promise<void> {
  const session = await guard("loans", "delete");
  try {
    updateStore((store) =>
      deleteLoan(
        store,
        session.companyId,
        session.username,
        text(form, "id"),
        randomUUID,
      ),
    );
  } catch (error) {
    if (!(error instanceof LoanError)) throw error;
    redirect(`/app/loans?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/app/loans?notice=Loan+deleted");
}

/** The list filter to return to. Only a valid month and a listed type are kept. */
async function deductionFilter(form: FormData): Promise<URLSearchParams> {
  const params = new URLSearchParams();
  const period = text(form, "backPeriod");
  params.set(
    "period",
    /^\d{4}-\d{2}$/.test(period) ? period : await currentPeriod(),
  );
  const type = listedType(text(form, "backType"));
  if (type) params.set("filterType", type);
  return params;
}

function deductionMessage(error: unknown): string {
  if (error instanceof DeductionError || error instanceof PayrollError) {
    return error.message;
  }
  throw error;
}

export async function addDeduction(form: FormData): Promise<void> {
  const session = await guard("deductions", "add");
  const period = await currentPeriod();
  const input = {
    employeeId: text(form, "employeeId"),
    type: text(form, "type"),
    amount: text(form, "amount"),
  };
  try {
    updateStore((store) =>
      createDeduction(
        store,
        session.companyId,
        period,
        session.username,
        input,
        randomUUID,
      ),
    );
  } catch (error) {
    // Keep what the person typed so they can correct it.
    const draft = new URLSearchParams({
      error: deductionMessage(error),
      ...input,
    });
    redirect(`/app/deductions?${draft.toString()}`);
  }
  redirect("/app/deductions?notice=Deduction+added");
}

export async function saveDeduction(form: FormData): Promise<void> {
  const session = await guard("deductions", "edit");
  const id = text(form, "id");
  const back = await deductionFilter(form);
  const input = { type: text(form, "type"), amount: text(form, "amount") };
  try {
    updateStore((store) =>
      updateDeduction(
        store,
        session.companyId,
        session.username,
        id,
        input,
        randomUUID,
      ),
    );
  } catch (error) {
    const draft = new URLSearchParams(back);
    draft.set("error", deductionMessage(error));
    draft.set("edit", id);
    draft.set("type", input.type);
    draft.set("amount", input.amount);
    redirect(`/app/deductions?${draft.toString()}`);
  }
  const done = new URLSearchParams(back);
  done.set("notice", "Deduction updated");
  redirect(`/app/deductions?${done.toString()}`);
}

export async function removeDeduction(form: FormData): Promise<void> {
  const session = await guard("deductions", "delete");
  const back = await deductionFilter(form);
  try {
    updateStore((store) =>
      deleteDeduction(
        store,
        session.companyId,
        session.username,
        text(form, "id"),
        randomUUID,
      ),
    );
  } catch (error) {
    const draft = new URLSearchParams(back);
    draft.set("error", deductionMessage(error));
    redirect(`/app/deductions?${draft.toString()}`);
  }
  const done = new URLSearchParams(back);
  done.set("notice", "Deduction deleted");
  redirect(`/app/deductions?${done.toString()}`);
}

export async function saveLeavePolicy(form: FormData): Promise<void> {
  const id = text(form, "id");
  const session = await guard("leave", id ? "edit" : "add");
  const input = Object.fromEntries(
    LEAVE_POLICY_FIELDS.map((field) => [field, text(form, field)]),
  ) as LeavePolicyInput;
  try {
    updateStore((store) => {
      if (id) {
        updateLeavePolicy(
          store,
          session.companyId,
          session.username,
          id,
          input,
          randomUUID,
        );
      } else {
        addLeavePolicy(
          store,
          session.companyId,
          session.username,
          input,
          randomUUID,
        );
      }
    });
  } catch (error) {
    if (!(error instanceof LeavePolicyError)) throw error;
    // Keep what the person typed so they can correct it.
    const draft = new URLSearchParams({ ...input, error: error.message });
    if (id) draft.set("edit", id);
    redirect(`/app/leave-policy?${draft.toString()}`);
  }
  redirect(
    `/app/leave-policy?notice=${encodeURIComponent(id ? "Policy updated" : "Policy added")}`,
  );
}

export async function removeLeavePolicy(form: FormData): Promise<void> {
  const session = await guard("leave", "delete");
  const id = text(form, "id");
  try {
    updateStore((store) =>
      deleteLeavePolicy(
        store,
        session.companyId,
        session.username,
        id,
        randomUUID,
      ),
    );
  } catch (error) {
    if (!(error instanceof LeavePolicyError)) throw error;
    redirect(`/app/leave-policy?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/app/leave-policy?notice=Policy+deleted");
}

export async function addLeave(form: FormData): Promise<void> {
  const session = await guard("leave", "add");
  const kind = text(form, "kind");
  let amountPaise = 0;
  try {
    amountPaise = money(form, "amount", "Amount");
  } catch (error) {
    if (!(error instanceof InputError)) throw error;
    redirect(`/app/leave?error=${encodeURIComponent(error.message)}`);
  }
  if (kind === "encash") {
    try {
      updateStore((store) => {
        addEncashment(
          store,
          session.companyId,
          session.username,
          {
            employeeId: text(form, "employeeId"),
            year: text(form, "year") || "2026",
            leaveName: text(form, "leaveName"),
            amountPaise,
            used: text(form, "used") || "0",
            cashed: text(form, "cashed") || "0",
          },
          randomUUID,
        );
      });
    } catch (error) {
      if (!(error instanceof LeaveRegisterError)) throw error;
      redirect(`/app/leave?error=${encodeURIComponent(error.message)}`);
    }
  }
  redirect("/app/leave?notice=Leave+record+saved");
}

/** The register view to return to. Only a four-digit year and an id-shaped employee value are kept. */
function registerView(form: FormData): URLSearchParams {
  const params = new URLSearchParams();
  const year = text(form, "backYear");
  if (/^\d{4}$/.test(year)) params.set("year", year);
  const employee = text(form, "backEmployee");
  if (/^[\w-]{1,64}$/.test(employee)) params.set("employee", employee);
  return params;
}

export async function saveBalance(form: FormData): Promise<void> {
  const id = text(form, "id");
  const session = await guard("leave", id ? "edit" : "add");
  const counts = {
    broughtForward: text(form, "broughtForward"),
    yearCount: text(form, "yearCount"),
    balance: text(form, "balance"),
  };
  const input = {
    ...counts,
    employeeId: text(form, "employeeId"),
    year: text(form, "year"),
    leaveName: text(form, "leaveName"),
  };
  const view = registerView(form);
  try {
    updateStore((store) => {
      if (id) {
        updateBalance(
          store,
          session.companyId,
          session.username,
          id,
          counts,
          randomUUID,
        );
      } else {
        addBalance(
          store,
          session.companyId,
          session.username,
          input,
          randomUUID,
        );
      }
    });
  } catch (error) {
    if (!(error instanceof LeaveRegisterError)) throw error;
    // Keep what the person typed so they can correct it.
    for (const [key, value] of Object.entries(id ? counts : input)) {
      view.set(key, value);
    }
    view.set("error", error.message);
    if (id) view.set("edit", id);
    redirect(`/app/leave?${view.toString()}`);
  }
  if (!id && /^\d{4}$/.test(input.year)) view.set("year", input.year);
  view.set("notice", id ? "Balance updated" : "Balance added");
  redirect(`/app/leave?${view.toString()}`);
}

export async function removeBalance(form: FormData): Promise<void> {
  const session = await guard("leave", "delete");
  const view = registerView(form);
  try {
    updateStore((store) =>
      deleteBalance(
        store,
        session.companyId,
        session.username,
        text(form, "id"),
        randomUUID,
      ),
    );
  } catch (error) {
    if (!(error instanceof LeaveRegisterError)) throw error;
    view.set("error", error.message);
    redirect(`/app/leave?${view.toString()}`);
  }
  view.set("notice", "Balance deleted");
  redirect(`/app/leave?${view.toString()}`);
}

export async function runCarryForward(form: FormData): Promise<void> {
  const session = await guard("leave", "add");
  const from = text(form, "fromYear");
  const view = new URLSearchParams();
  let result: CarryResult = { created: 0, skipped: 0, differing: 0 };
  try {
    updateStore((store) => {
      result = carryForward(
        store,
        session.companyId,
        session.username,
        from,
        randomUUID,
      );
    });
  } catch (error) {
    if (!(error instanceof LeaveRegisterError)) throw error;
    view.set("error", error.message);
    redirect(`/app/leave?${view.toString()}`);
  }
  const to = String(Number(from) + 1);
  view.set("year", to);
  const parts = [
    `${result.created} ${result.created === 1 ? "row" : "rows"} carried from ${from} to ${to}.`,
  ];
  if (result.skipped > 0) {
    parts.push(
      `${result.skipped} already in ${to} ${result.skipped === 1 ? "was" : "were"} left as ${result.skipped === 1 ? "it was" : "they were"}.`,
    );
  }
  if (result.differing > 0) {
    parts.push(
      `${result.differing} of them ${result.differing === 1 ? "has" : "have"} brought forward that differs from the ${from} balance. Edit ${result.differing === 1 ? "it" : "them"} if the ${from} balance changed.`,
    );
  }
  view.set("notice", parts.join(" "));
  redirect(`/app/leave?${view.toString()}`);
}

export async function runPayroll(): Promise<void> {
  const session = await guard("payroll");
  const period = await currentPeriod();
  try {
    updateStore((store) => {
      processPeriod(store, session.companyId, period, session.username);
    });
  } catch (error) {
    const message =
      error instanceof PayrollError
        ? error.message
        : "Payroll could not be processed";
    redirect(`/app/payroll?error=${encodeURIComponent(message)}`);
  }
  redirect("/app/payroll?notice=Salary+processed");
}

export async function saveLine(form: FormData): Promise<void> {
  const session = await guard("payroll");
  const period = await currentPeriod();
  try {
    updateStore((store) => {
      adjustLine(
        store,
        session.companyId,
        period,
        text(form, "employeeId"),
        money(form, "earning", "Earning adjustment"),
        money(form, "deduction", "Deduction adjustment"),
      );
    });
  } catch (error) {
    const message =
      error instanceof PayrollError || error instanceof InputError
        ? error.message
        : "Line was not saved";
    redirect(`/app/payroll/entry?error=${encodeURIComponent(message)}`);
  }
  redirect("/app/payroll/entry?notice=Line+updated");
}

export async function lockMonth(form: FormData): Promise<void> {
  const session = await guard("control");
  const period = await currentPeriod();
  if (text(form, "confirm") !== "LOCK") {
    redirect("/app/control?error=Type+LOCK+to+confirm");
  }
  try {
    updateStore((store) =>
      lockPeriod(store, session.companyId, period, session.username),
    );
  } catch (error) {
    const message =
      error instanceof PayrollError ? error.message : "Lock failed";
    redirect(`/app/control?error=${encodeURIComponent(message)}`);
  }
  redirect("/app/control?notice=Period+locked");
}

export async function unlockMonth(form: FormData): Promise<void> {
  const session = await guard("control", "delete");
  const period = await currentPeriod();
  if (text(form, "confirm") !== "UNLOCK") {
    redirect("/app/control?error=Type+UNLOCK+to+confirm");
  }
  updateStore((store) =>
    unlockPeriod(store, session.companyId, period, session.username),
  );
  redirect("/app/control?notice=Period+unlocked");
}

export async function stageImport(form: FormData): Promise<void> {
  const session = await guard("import", "add");
  const kind = text(form, "kind");
  const back = `/app/import/${encodeURIComponent(kind)}`;
  if (!findImport(kind))
    redirect("/app/import?error=That+import+is+not+available");
  const file = form.get("file");
  if (!(file instanceof File)) {
    redirect(`${back}?error=${encodeURIComponent("Choose an .xlsx file.")}`);
  }
  const problem = fileProblem(file.name, file.size);
  if (problem) redirect(`${back}?error=${encodeURIComponent(problem)}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const review = await reviewUpload(kind, bytes);
    if (review.state === "file") {
      redirect(`${back}?error=${encodeURIComponent(review.message)}`);
    }
    const id = await savePreview({
      companyId: session.companyId,
      actor: session.username,
      kind,
      bytes,
    });
    redirect(`${back}?preview=${id}`);
  } catch (error) {
    if (error instanceof ImportError) {
      redirect(`${back}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

export async function saveImport(form: FormData): Promise<void> {
  const session = await guard("import", "add");
  const kind = text(form, "kind");
  const back = `/app/import/${encodeURIComponent(kind)}`;
  try {
    const store = readStore();
    const count = await commitPreview(
      store,
      text(form, "preview"),
      session.companyId,
      session.username,
    );
    writeStore(store);
    redirect(
      `${back}?notice=${encodeURIComponent(`Stored ${count} rows for this company.`)}`,
    );
  } catch (error) {
    if (error instanceof ImportError) {
      redirect(`${back}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}
