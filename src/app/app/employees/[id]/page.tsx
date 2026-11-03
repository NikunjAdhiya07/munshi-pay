import Link from "next/link";
import {
  Flash,
  Missing,
  Money,
  Origin,
  PageHeader,
} from "../../../../components/ui";
import { maskSecret } from "../../../../domain/employees";
import { saveEmployee } from "../../../../server/actions";
import { requireView } from "../../../../server/auth";
import { readStore } from "../../../../server/store";

const tabs = ["profile", "other", "salary", "nominee", "documents"] as const;

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; notice?: string; error?: string }>;
}) {
  const session = await requireView("employees");
  const { id } = await params;
  const query = await searchParams;
  const tab = tabs.includes(query.tab as (typeof tabs)[number])
    ? query.tab
    : "profile";
  const store = readStore();
  const employee = store.employees.find(
    (item) => item.id === id && item.companyId === session.companyId,
  );
  if (!employee) {
    return (
      <Missing
        title="Employee not found in this company."
        href="/app/employees"
        label="Back to employees"
      />
    );
  }
  const categories = store.categories.filter(
    (item) => item.companyId === session.companyId,
  );
  const listOf = (type: "department" | "designation" | "bank") =>
    store.misc
      .filter(
        (item) => item.companyId === session.companyId && item.type === type,
      )
      .map((item) => item.description);
  const lists = {
    department: listOf("department"),
    designation: listOf("designation"),
    bank: listOf("bank"),
  };
  const latest = [...employee.salaryRows].sort((a, b) =>
    b.asOn.localeCompare(a.asOn),
  )[0];

  return (
    <>
      <PageHeader
        title={employee.name}
        lede={`${employee.code} · ${employee.leftDate ? `Left ${employee.leftDate}` : "Active"} · ${employee.department || "No department"}`}
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />
      <nav className="tabs" aria-label="Employee sections">
        {tabs.map((item) => (
          <Link
            key={item}
            href={`/app/employees/${id}?tab=${item}`}
            aria-current={tab === item ? "page" : undefined}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </Link>
        ))}
      </nav>
      {tab === "profile" ? (
        <form className="panel form-measure" action={saveEmployee}>
          <input type="hidden" name="id" value={employee.id} />
          <input type="hidden" name="tab" value="profile" />
          <ProfileFields employee={employee} lists={lists} />
          <button type="submit">Save profile</button>
        </form>
      ) : null}
      {tab === "other" ? (
        <form className="panel form-measure" action={saveEmployee}>
          <input type="hidden" name="id" value={employee.id} />
          <input type="hidden" name="tab" value="other" />
          <label>
            <span>Blood group</span>
            <input name="bloodGroup" defaultValue={employee.bloodGroup} />
          </label>
          <ListSelect
            label="PF bank"
            name="pfBankName"
            options={lists.bank}
            current={employee.pfBankName ?? ""}
          />
          <label>
            <span>PF bank IFSC</span>
            <input name="pfIfsc" defaultValue={employee.pfIfsc ?? ""} />
          </label>
          <label>
            <span>PF bank account</span>
            <input
              name="pfAccount"
              defaultValue={maskSecret(employee.pfAccount ?? "")}
              autoComplete="off"
              aria-describedby="pf-account-help"
            />
          </label>
          <p id="pf-account-help" className="help">
            Shown with most characters hidden. Leave it as shown to keep the
            saved account, or type a new one.
          </p>
          <ListSelect
            label="Shift"
            name="shift"
            options={store.shifts
              .filter((item) => item.companyId === session.companyId)
              .map((item) => item.name)}
            current={employee.shift ?? ""}
            manage={{ href: "/app/shifts", label: "Shift master" }}
          />
          <label>
            <span>Week off</span>
            <input name="weekOff" defaultValue={employee.weekOff} />
          </label>
          <label>
            <span>Notice days</span>
            <input name="noticeDays" defaultValue={employee.noticeDays} />
          </label>
          <label>
            <span>Emergency contact</span>
            <input name="emergencyName" defaultValue={employee.emergencyName} />
          </label>
          <label>
            <span>Emergency phone</span>
            <input
              name="emergencyPhone"
              defaultValue={employee.emergencyPhone}
            />
          </label>
          <button type="submit">Save other details</button>
        </form>
      ) : null}
      {tab === "salary" ? (
        <div className="grid-2">
          <form className="panel form-measure" action={saveEmployee}>
            <input type="hidden" name="id" value={employee.id} />
            <input type="hidden" name="tab" value="salary" />
            <p className="help">
              Current rate:{" "}
              {latest ? <Money paise={latest.grossPaise} /> : "none"}. CTC is
              stored as entered and is not calculated.
            </p>
            <label>
              <span>As on</span>
              <input name="asOn" type="date" required />
            </label>
            <label>
              <span>Category</span>
              <select name="categoryId" defaultValue={latest?.categoryId ?? ""}>
                <option value="">No category</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.structure})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                {employee.salaryBase === "per-day"
                  ? "Daily rate (rupees)"
                  : "Monthly gross (rupees)"}
              </span>
              <input name="gross" inputMode="decimal" required />
            </label>
            <label>
              <span>CTC (rupees, optional)</span>
              <input name="ctc" inputMode="decimal" />
            </label>
            <button type="submit">Add salary row</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>As on</th>
                  <th className="num">Gross</th>
                  <th className="num">CTC</th>
                </tr>
              </thead>
              <tbody>
                {[...employee.salaryRows]
                  .sort((a, b) => b.asOn.localeCompare(a.asOn))
                  .map((row) => (
                    <tr key={row.id}>
                      <td>{row.asOn}</td>
                      <td className="num">
                        <Money paise={row.grossPaise} />
                      </td>
                      <td className="num">
                        {row.ctcPaise == null ? (
                          "—"
                        ) : (
                          <Money paise={row.ctcPaise} />
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {tab === "nominee" ? (
        <form className="panel form-measure" action={saveEmployee}>
          <input type="hidden" name="id" value={employee.id} />
          <input type="hidden" name="tab" value="nominee" />
          <label>
            <span>Nominee name</span>
            <input name="nomineeName" defaultValue={employee.nomineeName} />
          </label>
          <label>
            <span>Relation</span>
            <input
              name="nomineeRelation"
              defaultValue={employee.nomineeRelation}
            />
          </label>
          <label>
            <span>Percentage</span>
            <input
              name="nomineePercent"
              defaultValue={employee.nomineePercent}
            />
          </label>
          <label>
            <span>Birth date</span>
            <input
              name="nomineeBirthDate"
              type="date"
              defaultValue={employee.nomineeBirthDate}
            />
          </label>
          <button type="submit">Save nominee</button>
        </form>
      ) : null}
      {tab === "documents" ? (
        <div>
          <form className="panel form-measure" action={saveEmployee}>
            <input type="hidden" name="id" value={employee.id} />
            <input type="hidden" name="tab" value="documents" />
            <label>
              <span>Document type</span>
              <input name="docType" placeholder="PAN, Aadhaar, appointment" />
            </label>
            <label>
              <span>Number</span>
              <input name="docNumber" />
            </label>
            <label>
              <span>Name on document</span>
              <input name="docName" />
            </label>
            <button type="submit">Add document record</button>
          </form>
          <ul>
            {employee.documents.map((doc) => (
              <li key={doc.id}>
                {doc.type} · {doc.number || "No number"} ·{" "}
                {doc.nameOnDocument || employee.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/**
 * A pick from a Misc. entry list. A value saved before the list existed stays
 * selectable so opening and saving the form does not erase it.
 */
function ListSelect({
  label,
  name,
  options,
  current,
  manage = { href: "/app/misc", label: "Misc. entry" },
}: {
  label: string;
  name: string;
  options: string[];
  current: string;
  manage?: { href: string; label: string };
}) {
  const legacy =
    current &&
    !options.some((item) => item.toLowerCase() === current.toLowerCase());
  return (
    <>
      <label>
        <span>{label}</span>
        <select name={name} defaultValue={current}>
          <option value="">Not set</option>
          {legacy ? (
            <option value={current}>{current} (not in list)</option>
          ) : null}
          {options.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      {options.length === 0 ? (
        <p className="help">
          No choices yet. Add them under{" "}
          <Link href={manage.href}>{manage.label}</Link>.
        </p>
      ) : null}
    </>
  );
}

type ProfileEmployee = {
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  gender: string;
  mobile: string;
  email: string;
  localAddress?: string;
  permanentAddress?: string;
  paymentBy: string;
  bankName: string;
  ifsc: string;
  account: string;
  payee: string;
  salaryBase: string;
  department: string;
  designation: string;
  marital: string;
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
  epfMode: string;
  pfJoinDate?: string;
  pfLeaveDate?: string;
  pfLeaveReason?: string;
  esiDeduct: boolean;
  esiNumber: string;
  esiDispensary?: string;
  esiJoinDate?: string;
  esiLeaveDate?: string;
  esiLeaveReason?: string;
  bonusEligible?: boolean;
  leaveEncashment?: boolean;
  abry?: boolean;
};

/** An identifier shown with most characters hidden. Left as shown, it is kept. */
function SecretField({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        name={name}
        defaultValue={maskSecret(value)}
        autoComplete="off"
        aria-describedby="secret-help"
      />
    </label>
  );
}

function ProfileFields({
  employee,
  lists,
}: {
  lists: { department: string[]; designation: string[]; bank: string[] };
  employee: ProfileEmployee;
}) {
  return (
    <>
      <fieldset className="plain-fieldset">
        <legend>Name</legend>
        <label>
          <span>First name</span>
          <input
            name="firstName"
            defaultValue={employee.firstName ?? employee.name}
            maxLength={60}
            required
          />
        </label>
        <label>
          <span>Middle name</span>
          <input
            name="middleName"
            defaultValue={employee.middleName ?? ""}
            maxLength={60}
          />
        </label>
        <label>
          <span>Last name</span>
          <input
            name="lastName"
            defaultValue={employee.lastName ?? ""}
            maxLength={60}
          />
        </label>
        <p className="help">
          Full name: {employee.name}. It is built from the parts above when you
          save.
        </p>
        <label>
          <span>Gender</span>
          <select name="gender" defaultValue={employee.gender}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
      </fieldset>
      <fieldset className="plain-fieldset">
        <legend>Contact and address</legend>
        <label>
          <span>Mobile</span>
          <input name="mobile" defaultValue={employee.mobile} />
        </label>
        <label>
          <span>Email</span>
          <input name="email" defaultValue={employee.email} />
        </label>
        <label>
          <span>Local address</span>
          <textarea
            name="localAddress"
            defaultValue={employee.localAddress ?? ""}
            maxLength={300}
          />
        </label>
        <label>
          <span>Permanent address</span>
          <textarea
            name="permanentAddress"
            defaultValue={employee.permanentAddress ?? ""}
            maxLength={300}
          />
        </label>
      </fieldset>
      <fieldset className="plain-fieldset">
        <legend>Work</legend>
        <ListSelect
          label="Department"
          name="department"
          options={lists.department}
          current={employee.department}
        />
        <ListSelect
          label="Designation"
          name="designation"
          options={lists.designation}
          current={employee.designation}
        />
        <label>
          <span>Salary base</span>
          <select name="salaryBase" defaultValue={employee.salaryBase}>
            <option value="salary">Salary</option>
            <option value="per-day">Per day</option>
          </select>
        </label>
        <label>
          <span>Marital status</span>
          <select name="marital" defaultValue={employee.marital}>
            <option value="unmarried">Unmarried</option>
            <option value="married">Married</option>
            <option value="divorcee">Divorcee</option>
          </select>
        </label>
        <label>
          <span>Birth date</span>
          <input
            name="birthDate"
            type="date"
            defaultValue={employee.birthDate}
          />
        </label>
        <label>
          <span>Join date</span>
          <input
            name="joinDate"
            type="date"
            defaultValue={employee.joinDate}
            required
          />
        </label>
        <label>
          <span>Left date</span>
          <input name="leftDate" type="date" defaultValue={employee.leftDate} />
        </label>
        <label>
          <span>Left reason</span>
          <input name="leftReason" defaultValue={employee.leftReason} />
        </label>
      </fieldset>
      <fieldset className="plain-fieldset">
        <legend>Payment and identity</legend>
        <label>
          <span>Payment by</span>
          <select name="paymentBy" defaultValue={employee.paymentBy}>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
          </select>
        </label>
        <ListSelect
          label="Bank"
          name="bankName"
          options={lists.bank}
          current={employee.bankName}
        />
        <label>
          <span>IFSC</span>
          <input name="ifsc" defaultValue={employee.ifsc} />
        </label>
        <SecretField label="Account" name="account" value={employee.account} />
        <label>
          <span>Payee</span>
          <input name="payee" defaultValue={employee.payee} />
        </label>
        <SecretField label="PAN" name="pan" value={employee.pan} />
        <SecretField label="Aadhaar" name="aadhaar" value={employee.aadhaar} />
        <p id="secret-help" className="help">
          Account, PAN, and Aadhaar are shown with most characters hidden. Leave
          one as shown to keep the saved value, type a new one to replace it, or
          clear it to remove it.
        </p>
      </fieldset>
      <fieldset className="plain-fieldset">
        <legend>Provident fund</legend>
        <label className="check">
          <input
            name="pfDeduct"
            type="checkbox"
            defaultChecked={employee.pfDeduct}
          />
          PF deduction
        </label>
        <label className="check">
          <input
            name="voluntaryPf"
            type="checkbox"
            defaultChecked={employee.voluntaryPf}
          />
          Voluntary PF
        </label>
        <label>
          <span>PF number</span>
          <input name="pfNumber" defaultValue={employee.pfNumber} />
        </label>
        <label>
          <span>UAN</span>
          <input name="uan" defaultValue={employee.uan} />
        </label>
        <label>
          <span>EPF difference on</span>
          <select name="epfMode" defaultValue={employee.epfMode}>
            <option value="full-basic">Full basic</option>
            <option value="limited-basic">Limited basic</option>
            <option value="full-gross">Full gross</option>
            <option value="limited-gross">Limited gross</option>
          </select>
        </label>
        <label>
          <span>PF join date</span>
          <input
            name="pfJoinDate"
            type="date"
            defaultValue={employee.pfJoinDate ?? ""}
          />
        </label>
        <label>
          <span>PF leave date</span>
          <input
            name="pfLeaveDate"
            type="date"
            defaultValue={employee.pfLeaveDate ?? ""}
          />
        </label>
        <label>
          <span>PF leave reason</span>
          <input
            name="pfLeaveReason"
            defaultValue={employee.pfLeaveReason ?? ""}
          />
        </label>
      </fieldset>
      <fieldset className="plain-fieldset">
        <legend>ESI</legend>
        <label className="check">
          <input
            name="esiDeduct"
            type="checkbox"
            defaultChecked={employee.esiDeduct}
          />
          ESI deduction
        </label>
        <label>
          <span>ESI number</span>
          <input name="esiNumber" defaultValue={employee.esiNumber} />
        </label>
        <label>
          <span>ESI dispensary</span>
          <input
            name="esiDispensary"
            defaultValue={employee.esiDispensary ?? ""}
          />
        </label>
        <label>
          <span>ESI join date</span>
          <input
            name="esiJoinDate"
            type="date"
            defaultValue={employee.esiJoinDate ?? ""}
          />
        </label>
        <label>
          <span>ESI leave date</span>
          <input
            name="esiLeaveDate"
            type="date"
            defaultValue={employee.esiLeaveDate ?? ""}
          />
        </label>
        <label>
          <span>ESI leave reason</span>
          <input
            name="esiLeaveReason"
            defaultValue={employee.esiLeaveReason ?? ""}
          />
        </label>
      </fieldset>
      <fieldset className="plain-fieldset">
        <legend>Other flags</legend>
        <label className="check">
          <input
            name="bonusEligible"
            type="checkbox"
            defaultChecked={employee.bonusEligible ?? true}
          />
          Bonus
        </label>
        <label className="check">
          <input
            name="leaveEncashment"
            type="checkbox"
            defaultChecked={employee.leaveEncashment ?? true}
          />
          Leave encashment
        </label>
        <label className="check">
          <input
            name="abry"
            type="checkbox"
            defaultChecked={employee.abry ?? false}
          />
          ABRY
        </label>
        <p className="help">
          These flags, the PF and ESI dates, and the dispensary are recorded
          only. Pay and the registers do not read them yet.
        </p>
      </fieldset>
    </>
  );
}
