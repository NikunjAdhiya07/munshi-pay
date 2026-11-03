import { isIsoDate } from "../domain/dates.ts";
import {
  fullName,
  keepIfMasked,
  nextEmployeeCode,
  sameCode,
} from "../domain/employees.ts";
import { assertListed } from "./misc.ts";
import type { Employee, Store } from "./model.ts";

export class EmployeeError extends Error {}

const GENDERS = ["male", "female"] as const;
const PAYMENT_BY = ["bank", "cash", "cheque"] as const;
const MARITAL = ["unmarried", "married", "divorcee"] as const;
const SALARY_BASES = ["salary", "per-day"] as const;
const EPF_MODES = [
  "full-basic",
  "limited-basic",
  "full-gross",
  "limited-gross",
] as const;

const NAME_MAX = 60;
const ADDRESS_MAX = 300;
const FIELD_MAX = 100;

export type NewEmployeeInput = {
  firstName: string;
  middleName: string;
  lastName: string;
  joinDate: string;
  gender: string;
  salaryBase: string;
  department: string;
  designation: string;
  mobile: string;
  email: string;
  pfDeduct: boolean;
  esiDeduct: boolean;
};

export type ProfileInput = NewEmployeeInput & {
  paymentBy: string;
  bankName: string;
  ifsc: string;
  account: string;
  payee: string;
  marital: string;
  birthDate: string;
  leftDate: string;
  leftReason: string;
  localAddress: string;
  permanentAddress: string;
  pan: string;
  aadhaar: string;
  voluntaryPf: boolean;
  pfNumber: string;
  uan: string;
  epfMode: string;
  pfJoinDate: string;
  pfLeaveDate: string;
  pfLeaveReason: string;
  esiNumber: string;
  esiDispensary: string;
  esiJoinDate: string;
  esiLeaveDate: string;
  esiLeaveReason: string;
  bonusEligible: boolean;
  leaveEncashment: boolean;
  abry: boolean;
};

function oneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): T {
  const found = allowed.find((item) => item === value);
  if (!found) throw new EmployeeError(`${label} is not a valid choice.`);
  return found;
}

function limited(value: string, max: number, label: string): string {
  const text = value.trim();
  if (text.length > max) {
    throw new EmployeeError(`${label} must be ${max} characters or fewer.`);
  }
  return text;
}

function optionalDate(value: string, label: string): string {
  const text = value.trim();
  if (text !== "" && !isIsoDate(text)) {
    throw new EmployeeError(`${label} must be a real date.`);
  }
  return text;
}

/** A name built from its parts, each part limited, and the whole required. */
function buildName(input: {
  firstName: string;
  middleName: string;
  lastName: string;
}): { first: string; middle: string; last: string; name: string } {
  const first = limited(input.firstName, NAME_MAX, "First name");
  const middle = limited(input.middleName, NAME_MAX, "Middle name");
  const last = limited(input.lastName, NAME_MAX, "Last name");
  const name = fullName(first, middle, last);
  if (!name) throw new EmployeeError("Enter the employee's name.");
  return { first, middle, last, name };
}

function audit(
  store: Store,
  companyId: string,
  actor: string,
  action: string,
  id: string,
): void {
  store.audit.unshift({
    id,
    at: new Date().toISOString(),
    actor,
    action,
    companyId,
  });
}

/** Does another employee of this company already use the code? */
export function codeTaken(
  store: Store,
  companyId: string,
  code: string,
  exceptId?: string,
): boolean {
  return store.employees.some(
    (item) =>
      item.companyId === companyId &&
      item.id !== exceptId &&
      sameCode(item.code, code),
  );
}

/** The code the next new employee of the company will get. */
export function nextCodeFor(store: Store, companyId: string): string {
  return nextEmployeeCode(
    store.employees
      .filter((item) => item.companyId === companyId)
      .map((item) => item.code),
  );
}

/**
 * Adds an employee. The code is assigned here, from the company's own codes,
 * so two people adding at once cannot pick the same one and a posted code is
 * never trusted. Everything is checked before the store is changed.
 */
export function addEmployee(
  store: Store,
  companyId: string,
  actor: string,
  input: NewEmployeeInput,
  newId: () => string,
): Employee {
  const { first, middle, last, name } = buildName(input);
  const joinDate = input.joinDate.trim();
  if (!isIsoDate(joinDate)) {
    throw new EmployeeError("Join date is required and must be a real date.");
  }
  const gender = oneOf(input.gender, GENDERS, "Gender");
  const salaryBase = oneOf(input.salaryBase, SALARY_BASES, "Salary base");
  const department = input.department.trim();
  const designation = input.designation.trim();
  assertListed(store, companyId, "department", department, "");
  assertListed(store, companyId, "designation", designation, "");
  const mobile = limited(input.mobile, 20, "Mobile");
  const email = limited(input.email, 120, "Email");

  const code = nextCodeFor(store, companyId);
  if (codeTaken(store, companyId, code)) {
    throw new EmployeeError(
      `Employee code ${code} is already used in this company.`,
    );
  }

  const employee: Employee = {
    id: newId(),
    companyId,
    code,
    name,
    firstName: first,
    middleName: middle,
    lastName: last,
    mobile,
    email,
    paymentBy: "bank",
    bankName: "",
    ifsc: "",
    account: "",
    payee: name,
    pfBankName: "",
    pfIfsc: "",
    pfAccount: "",
    salaryBase,
    gender,
    department,
    designation,
    marital: "unmarried",
    birthDate: "",
    joinDate,
    leftDate: "",
    leftReason: "",
    localAddress: "",
    permanentAddress: "",
    pan: "",
    aadhaar: "",
    pfDeduct: input.pfDeduct,
    voluntaryPf: false,
    pfNumber: "",
    uan: "",
    epfMode: "limited-basic",
    pfJoinDate: "",
    pfLeaveDate: "",
    pfLeaveReason: "",
    esiDeduct: input.esiDeduct,
    esiNumber: "",
    esiDispensary: "",
    esiJoinDate: "",
    esiLeaveDate: "",
    esiLeaveReason: "",
    bonusEligible: true,
    leaveEncashment: true,
    abry: false,
    bloodGroup: "",
    shift: "",
    weekOff: "",
    noticeDays: "",
    emergencyName: "",
    emergencyPhone: "",
    nomineeName: "",
    nomineeRelation: "",
    nomineePercent: "",
    nomineeBirthDate: "",
    salaryRows: [],
    documents: [],
  };
  store.employees.push(employee);
  audit(store, companyId, actor, `Added employee ${code}`, `audit-${newId()}`);
  return employee;
}

/**
 * Saves the profile tab. Aadhaar, PAN, and bank accounts reach this function
 * masked when they were not touched, and the saved value is kept. Nothing is
 * changed unless every field is valid. The audit entry names the employee code
 * and never a value.
 */
export function updateProfile(
  store: Store,
  companyId: string,
  actor: string,
  employeeId: string,
  input: ProfileInput,
  newId: () => string,
): Employee {
  const employee = store.employees.find(
    (item) => item.id === employeeId && item.companyId === companyId,
  );
  if (!employee) throw new EmployeeError("Employee not found in this company.");

  const { first, middle, last, name } = buildName(input);
  const gender = oneOf(input.gender, GENDERS, "Gender");
  const paymentBy = oneOf(input.paymentBy, PAYMENT_BY, "Payment by");
  const marital = oneOf(input.marital, MARITAL, "Marital status");
  const salaryBase = oneOf(input.salaryBase, SALARY_BASES, "Salary base");
  const epfMode = oneOf(input.epfMode, EPF_MODES, "EPF difference mode");

  // A blank join date keeps the saved one, as the form did before.
  const joinDate =
    optionalDate(input.joinDate, "Join date") || employee.joinDate;
  const birthDate = optionalDate(input.birthDate, "Birth date");
  const leftDate = optionalDate(input.leftDate, "Left date");
  const pfJoinDate = optionalDate(input.pfJoinDate, "PF join date");
  const pfLeaveDate = optionalDate(input.pfLeaveDate, "PF leave date");
  const esiJoinDate = optionalDate(input.esiJoinDate, "ESI join date");
  const esiLeaveDate = optionalDate(input.esiLeaveDate, "ESI leave date");
  if (leftDate && leftDate < joinDate) {
    throw new EmployeeError("Left date cannot be before the join date.");
  }
  if (pfLeaveDate && pfJoinDate && pfLeaveDate < pfJoinDate) {
    throw new EmployeeError("PF leave date cannot be before the PF join date.");
  }
  if (esiLeaveDate && esiJoinDate && esiLeaveDate < esiJoinDate) {
    throw new EmployeeError(
      "ESI leave date cannot be before the ESI join date.",
    );
  }

  const department = input.department.trim();
  const designation = input.designation.trim();
  const bankName = input.bankName.trim();
  assertListed(store, companyId, "department", department, employee.department);
  assertListed(
    store,
    companyId,
    "designation",
    designation,
    employee.designation,
  );
  assertListed(store, companyId, "bank", bankName, employee.bankName);

  const next = {
    mobile: limited(input.mobile, 20, "Mobile"),
    email: limited(input.email, 120, "Email"),
    ifsc: limited(input.ifsc, FIELD_MAX, "IFSC"),
    account: limited(
      keepIfMasked(input.account, employee.account),
      FIELD_MAX,
      "Account",
    ),
    payee: limited(input.payee, FIELD_MAX, "Payee"),
    leftReason: limited(input.leftReason, FIELD_MAX, "Left reason"),
    localAddress: limited(input.localAddress, ADDRESS_MAX, "Local address"),
    permanentAddress: limited(
      input.permanentAddress,
      ADDRESS_MAX,
      "Permanent address",
    ),
    pan: limited(keepIfMasked(input.pan, employee.pan), FIELD_MAX, "PAN"),
    aadhaar: limited(
      keepIfMasked(input.aadhaar, employee.aadhaar),
      FIELD_MAX,
      "Aadhaar",
    ),
    pfNumber: limited(input.pfNumber, FIELD_MAX, "PF number"),
    uan: limited(input.uan, FIELD_MAX, "UAN"),
    pfLeaveReason: limited(input.pfLeaveReason, FIELD_MAX, "PF leave reason"),
    esiNumber: limited(input.esiNumber, FIELD_MAX, "ESI number"),
    esiDispensary: limited(input.esiDispensary, FIELD_MAX, "ESI dispensary"),
    esiLeaveReason: limited(
      input.esiLeaveReason,
      FIELD_MAX,
      "ESI leave reason",
    ),
  };

  employee.name = name;
  employee.firstName = first;
  employee.middleName = middle;
  employee.lastName = last;
  employee.gender = gender;
  employee.paymentBy = paymentBy;
  employee.marital = marital;
  employee.salaryBase = salaryBase;
  employee.epfMode = epfMode;
  employee.joinDate = joinDate;
  employee.birthDate = birthDate;
  employee.leftDate = leftDate;
  employee.pfJoinDate = pfJoinDate;
  employee.pfLeaveDate = pfLeaveDate;
  employee.esiJoinDate = esiJoinDate;
  employee.esiLeaveDate = esiLeaveDate;
  employee.department = department;
  employee.designation = designation;
  employee.bankName = bankName;
  employee.pfDeduct = input.pfDeduct;
  employee.voluntaryPf = input.voluntaryPf;
  employee.esiDeduct = input.esiDeduct;
  employee.bonusEligible = input.bonusEligible;
  employee.leaveEncashment = input.leaveEncashment;
  employee.abry = input.abry;
  Object.assign(employee, next);
  audit(
    store,
    companyId,
    actor,
    `Updated profile of employee ${employee.code}`,
    `audit-${newId()}`,
  );
  return employee;
}

export function deleteEmployee(
  store: Store,
  companyId: string,
  employeeId: string,
  actor: string,
  confirmCode: string,
): void {
  const employee = store.employees.find(
    (item) => item.id === employeeId && item.companyId === companyId,
  );
  if (!employee) {
    throw new EmployeeError("Employee not found in this company.");
  }
  if (confirmCode !== employee.code) {
    throw new EmployeeError("Type the employee code to confirm deletion.");
  }
  const processed = store.runs.some(
    (run) =>
      run.companyId === companyId &&
      run.lines.some((line) => line.employeeId === employeeId),
  );
  if (processed) {
    throw new EmployeeError(
      "This employee is in a processed payroll. Set the left date instead of deleting the record.",
    );
  }
  const same = (item: { companyId: string; employeeId: string }) =>
    !(item.companyId === companyId && item.employeeId === employeeId);
  store.employees = store.employees.filter((item) => item.id !== employeeId);
  store.muster = store.muster.filter(same);
  store.loans = store.loans.filter(same);
  store.deductions = store.deductions.filter(same);
  store.leaveBalances = store.leaveBalances.filter(same);
  store.encashments = store.encashments.filter(same);
  store.audit.unshift({
    id: `audit-delete-${employeeId}-${Date.now()}`,
    at: new Date().toISOString(),
    actor,
    action: `Deleted employee ${employeeId}`,
    companyId,
  });
}
