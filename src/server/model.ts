import type { CompanyProfile } from "../domain/companyProfile.ts";

export type SalaryBase = "salary" | "per-day";
export type EpfMode =
  | "full-basic"
  | "limited-basic"
  | "full-gross"
  | "limited-gross";
export type Role = "owner" | "viewer";

/** One company and the role this person holds there (DEC-017). */
export type Membership = {
  companyId: string;
  role: Role;
};

/** A consultancy user. The password is a scrypt hash, never the typed text (DEC-018). */
export type User = {
  id: string;
  username: string;
  passwordHash: string;
  accountOwner: boolean;
  /** Bumped when the password changes so older session cookies stop working. */
  sessionVersion: number;
  memberships: Membership[];
};

/** A failed sign-in, kept in the store so a restart does not clear the lockout. */
export type SignInFailure = {
  username: string;
  at: number;
};

export type Company = {
  id: string;
  /** Server-assigned. A typed number is ignored. */
  number: string;
  shortName: string;
  name: string;
  location: string;
  city: string;
  state: string;
  /** Set when this record is a site of another company. Null for a company. */
  parentId: string | null;
  professionalTax: boolean;
  pfEmployeePercent: number | null;
  pfLimitPaise: number | null;
  esiEmployeePercent: number | null;
  esiExceptionLimitPaise: number;
  /** Plain-data profile fields. See `CompanyProfile`; none feeds payroll yet. */
  profile: CompanyProfile;
};

export type Category = {
  id: string;
  companyId: string;
  name: string;
  structure: "gross" | "ctc";
  basicPercent: number;
  daPercent: number;
};

export type SalaryRow = {
  id: string;
  asOn: string;
  categoryId: string | null;
  grossPaise: number;
  ctcPaise: number | null;
};

export type Employee = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  mobile: string;
  email: string;
  paymentBy: "bank" | "cash" | "cheque";
  bankName: string;
  ifsc: string;
  account: string;
  payee: string;
  pfBankName: string;
  pfIfsc: string;
  pfAccount: string;
  salaryBase: SalaryBase;
  gender: "male" | "female";
  department: string;
  designation: string;
  marital: "unmarried" | "married" | "divorcee";
  birthDate: string;
  joinDate: string;
  leftDate: string;
  leftReason: string;
  pan: string;
  aadhaar: string;
  pfDeduct: boolean;
  voluntaryPf: boolean;
  pfNumber: string;
  uan: string;
  epfMode: EpfMode;
  esiDeduct: boolean;
  esiNumber: string;
  bloodGroup: string;
  shift: string;
  weekOff: string;
  noticeDays: string;
  emergencyName: string;
  emergencyPhone: string;
  nomineeName: string;
  nomineeRelation: string;
  nomineePercent: string;
  nomineeBirthDate: string;
  /**
   * Fields below were added later, so records saved before then do not have
   * them. The store fills them in when it loads. None of them is read by the
   * muster or the pay engine. `name` stays the full name everywhere.
   */
  firstName?: string;
  middleName?: string;
  lastName?: string;
  localAddress?: string;
  permanentAddress?: string;
  bonusEligible?: boolean;
  leaveEncashment?: boolean;
  abry?: boolean;
  pfJoinDate?: string;
  pfLeaveDate?: string;
  pfLeaveReason?: string;
  esiDispensary?: string;
  esiJoinDate?: string;
  esiLeaveDate?: string;
  esiLeaveReason?: string;
  salaryRows: SalaryRow[];
  documents: {
    id: string;
    type: string;
    number: string;
    nameOnDocument: string;
    fileName: string;
  }[];
};

export type MiscItem = {
  id: string;
  companyId: string;
  type: "department" | "designation" | "bank";
  description: string;
};

export type Holiday = {
  id: string;
  companyId: string;
  date: string;
  year: string;
  description: string;
};

export type Shift = {
  id: string;
  companyId: string;
  name: string;
  inTime: string;
  outTime: string;
  /** Total hours. Kept as the text that was entered. */
  hours: string;
  /**
   * Fields below were added later, so records saved before then do not have
   * them. They are recorded only. No pay or muster rule reads them.
   */
  inTime2?: string;
  outTime2?: string;
  presentHours?: string;
  halfDayHours?: string;
  nightOffShift?: string;
  nightDutyPunch?: string;
};

export type PtSlab = {
  id: string;
  companyId: string;
  asOn: string;
  state: string;
  lowerPaise: number;
  upperPaise: number;
  amountPaise: number;
};

export type Muster = {
  id: string;
  companyId: string;
  employeeId: string;
  period: string;
  paidDays: number;
  weekOff: number;
  publicHoliday: number;
  compOff: number;
  onDuty: number;
};

export type LoanPost = {
  period: string;
  paise: number;
};

export type Loan = {
  id: string;
  companyId: string;
  employeeId: string;
  date: string;
  amountPaise: number;
  installmentPaise: number;
  receivedPaise: number;
  paidInstallments: number;
  posts: LoanPost[];
};

export type Deduction = {
  id: string;
  companyId: string;
  employeeId: string;
  period: string;
  type: string;
  amountPaise: number;
};

export type LeavePolicy = {
  id: string;
  companyId: string;
  cadre: string;
  name: string;
  duration: string;
  ratio: string;
};

export type LeaveBalance = {
  id: string;
  companyId: string;
  employeeId: string;
  year: string;
  leaveName: string;
  broughtForward: number;
  yearCount: number;
  balance: number;
};

export type Encashment = {
  id: string;
  companyId: string;
  employeeId: string;
  year: string;
  leaveName: string;
  amountPaise: number;
  used: number;
  cashed: number;
};

export type PayrollLine = {
  employeeId: string;
  basicPaise: number;
  daPaise: number;
  otherEarningPaise: number;
  grossPaise: number;
  pfPaise: number;
  esiPaise: number;
  ptPaise: number;
  otherDeductionPaise: number;
  loanPaise: number;
  deductionPaise: number;
  netPaise: number;
  payable: boolean;
  exceptions: {
    code: string;
    severity: "critical" | "warning";
    reason: string;
  }[];
  earningAdjustmentPaise: number;
  deductionAdjustmentPaise: number;
};

export type PayrollRun = {
  id: string;
  companyId: string;
  period: string;
  status: "calculated" | "in-review" | "locked";
  lines: PayrollLine[];
  processedAt: string;
};

export type LockRecord = {
  id: string;
  companyId: string;
  period: string;
  kind: "salary-attendance";
  lockedAt: string;
  lockedBy: string;
};

export type Audit = {
  id: string;
  at: string;
  actor: string;
  action: string;
  companyId: string;
};

export type ImportBatch = {
  id: string;
  companyId: string;
  kind: string;
  rows: Record<string, string>[];
  at: string;
  actor: string;
};

export type Right = {
  role: Role;
  menu: string;
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
};

export type Store = {
  /** demo is the untouched sample. A saved store is the company's own records. */
  source?: "demo" | "company";
  companies: Company[];
  employees: Employee[];
  misc: MiscItem[];
  holidays: Holiday[];
  shifts: Shift[];
  categories: Category[];
  slabs: PtSlab[];
  muster: Muster[];
  loans: Loan[];
  deductions: Deduction[];
  leavePolicies: LeavePolicy[];
  leaveBalances: LeaveBalance[];
  encashments: Encashment[];
  runs: PayrollRun[];
  locks: LockRecord[];
  audit: Audit[];
  imports: ImportBatch[];
  rights: Right[];
  users: User[];
  signInFailures: SignInFailure[];
};

export const MENUS = [
  "company",
  "employees",
  "masters",
  "muster",
  "loans",
  "deductions",
  "leave",
  "payroll",
  "reports",
  "control",
  "import",
  "export",
  "users",
  "reports-salary",
  "reports-pf",
  "reports-esi",
  "reports-tax",
  "reports-general",
  "reports-attendance",
] as const;

export type Menu = (typeof MENUS)[number];
