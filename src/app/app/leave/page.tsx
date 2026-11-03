import Link from "next/link";
import {
  Empty,
  Flash,
  Money,
  Origin,
  PageHeader,
} from "../../../components/ui";
import { can } from "../../../server/access";
import {
  addLeave,
  removeBalance,
  runCarryForward,
  saveBalance,
} from "../../../server/actions";
import { currentPeriod, requireView } from "../../../server/auth";
import {
  policyLeaveNames,
  registerFor,
  registerYears,
} from "../../../server/leaveRegister";
import type { LeaveBalance } from "../../../server/model";
import { readStore } from "../../../server/store";

type Query = {
  notice?: string;
  error?: string;
  year?: string;
  employee?: string;
  edit?: string;
  delete?: string;
  employeeId?: string;
  leaveName?: string;
  broughtForward?: string;
  yearCount?: string;
  balance?: string;
};

const COUNTS = [
  ["broughtForward", "Brought forward"],
  ["yearCount", "This year"],
  ["balance", "Balance"],
] as const;

function Days({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="help">None</span>;
  return <span className="figures">{value}</span>;
}

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const session = await requireView("leave");
  const headerYear = (await currentPeriod()).slice(0, 4);
  const query = await searchParams;
  const store = readStore();
  const company = session.companyId;
  const canAdd = can(session.role, store.rights, "leave", "add");
  const canEdit = can(session.role, store.rights, "leave", "edit");
  const canDelete = can(session.role, store.rights, "leave", "delete");
  const people = store.employees
    .filter((item) => item.companyId === company)
    .sort((a, b) => a.code.localeCompare(b.code));
  const year = /^\d{4}$/.test(query.year ?? "")
    ? (query.year as string)
    : headerYear;
  const years = [
    ...new Set([year, headerYear, ...registerYears(store, company)]),
  ].sort((a, b) => b.localeCompare(a));
  const leaveNames = policyLeaveNames(store, company);
  const { columns, unlisted, lines, duplicates } = registerFor(
    store,
    company,
    year,
  );
  const selected = people.find((item) => item.id === query.employee);
  const selectedRows = selected
    ? store.leaveBalances
        .filter(
          (item) =>
            item.companyId === company &&
            item.employeeId === selected.id &&
            item.year === year,
        )
        .sort((a, b) => a.leaveName.localeCompare(b.leaveName))
    : [];
  const findOwned = (id: string | undefined) =>
    id
      ? store.leaveBalances.find(
          (item) => item.id === id && item.companyId === company,
        )
      : undefined;
  const editing = canEdit ? findOwned(query.edit) : undefined;
  const deleting = canDelete ? findOwned(query.delete) : undefined;
  const personOf = (row: LeaveBalance) =>
    people.find((item) => item.id === row.employeeId);

  const view = new URLSearchParams({ year });
  if (selected) view.set("employee", selected.id);
  const viewHref = `/app/leave?${view.toString()}`;
  const back = (
    <>
      <input type="hidden" name="backYear" value={year} />
      <input type="hidden" name="backEmployee" value={selected?.id ?? ""} />
    </>
  );
  // After a refused save the form shows what the person typed.
  const draft = {
    employeeId: query.employeeId ?? selected?.id ?? "",
    leaveName: query.leaveName ?? "",
    broughtForward:
      query.broughtForward ?? String(editing?.broughtForward ?? 0),
    yearCount: query.yearCount ?? String(editing?.yearCount ?? 0),
    balance: query.balance ?? String(editing?.balance ?? 0),
  };
  const encash = store.encashments.filter((item) => item.companyId === company);

  return (
    <>
      <PageHeader
        title="Leave register"
        lede="Brought forward, this year, and balance for each leave name in the leave policy. Days are recorded as typed. Accrual and use are not calculated."
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />

      {deleting ? (
        <section className="panel form-measure" aria-labelledby="delete-title">
          <h2 id="delete-title">
            Delete {deleting.leaveName} for{" "}
            {personOf(deleting)?.name ?? "this employee"} in {deleting.year}?
          </h2>
          <p className="help">
            The row is removed from the register. Carry forward from{" "}
            {deleting.year} will no longer copy it. This cannot be undone.
          </p>
          <form action={removeBalance} className="row-actions">
            <input type="hidden" name="id" value={deleting.id} />
            {back}
            <button type="submit">Delete row</button>
            <Link className="button quiet" href={viewHref}>
              Keep row
            </Link>
          </form>
        </section>
      ) : null}

      {editing ? (
        <section className="panel form-measure" aria-labelledby="edit-title">
          <h2 id="edit-title">
            Edit {editing.leaveName} for{" "}
            {personOf(editing)?.name ?? "this employee"} in {editing.year}
          </h2>
          <form action={saveBalance}>
            <input type="hidden" name="id" value={editing.id} />
            {back}
            <p className="help">
              The employee, year, and leave name stay the same. Delete the row
              and add it again to change them.
            </p>
            {COUNTS.map(([name, label]) => (
              <label key={name}>
                <span>{label} (days)</span>
                <input
                  name={name}
                  inputMode="decimal"
                  defaultValue={draft[name]}
                  required
                />
              </label>
            ))}
            <div className="row-actions">
              <button type="submit">Save changes</button>
              <Link className="button quiet" href={viewHref}>
                Cancel
              </Link>
            </div>
          </form>
        </section>
      ) : null}

      {canAdd && !editing ? (
        leaveNames.length === 0 ? (
          <Empty
            title="Add a leave policy before entering balances. The register has one column group per leave name in the policy."
            href="/app/leave-policy"
            label="Open leave policy"
          />
        ) : people.length === 0 ? (
          <Empty
            title="Add an employee before entering balances."
            href="/app/employees/new"
            label="Add employee"
          />
        ) : (
          <div className="grid-2">
            <section className="panel" aria-labelledby="add-title">
              <h2 id="add-title">Add balance</h2>
              <form action={saveBalance}>
                {back}
                <label>
                  <span>Employee</span>
                  <select
                    name="employeeId"
                    defaultValue={draft.employeeId}
                    required
                  >
                    {people.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.code} · {employee.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Year</span>
                  <input
                    name="year"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    defaultValue={year}
                    required
                  />
                </label>
                <label>
                  <span>Leave</span>
                  <select
                    name="leaveName"
                    defaultValue={draft.leaveName}
                    required
                  >
                    {leaveNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                {COUNTS.map(([name, label]) => (
                  <label key={name}>
                    <span>{label} (days)</span>
                    <input
                      name={name}
                      inputMode="decimal"
                      defaultValue={draft[name]}
                      required
                    />
                  </label>
                ))}
                <button type="submit">Add balance</button>
              </form>
            </section>
            <section className="panel" aria-labelledby="carry-title">
              <h2 id="carry-title">Carry forward</h2>
              <p className="help">
                Copies each balance of the year into the next year as brought
                forward. Rows already in the next year are left as they are, so
                running it again adds nothing.
              </p>
              <form action={runCarryForward}>
                <label>
                  <span>From year</span>
                  <select name="fromYear" defaultValue={year} required>
                    {years.map((item) => (
                      <option key={item} value={item}>
                        {item} to {Number(item) + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Carry forward</button>
              </form>
            </section>
          </div>
        )
      ) : null}

      <section aria-labelledby="register-title">
        <h2 id="register-title">Register for {year}</h2>
        <search>
          <form className="row-actions" action="/app/leave">
            <label>
              <span>Year</span>
              <select name="year" defaultValue={year}>
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="quiet">
              Show
            </button>
          </form>
        </search>
        {duplicates.length > 0 ? (
          <p className="flash danger" role="alert">
            {duplicates.length}{" "}
            {duplicates.length === 1 ? "row repeats" : "rows repeat"} an
            employee and leave name already in {year}, probably from an earlier
            carry forward. The register shows the first row. Open the employee
            to delete the extra rows.
          </p>
        ) : null}
        {unlisted.size > 0 ? (
          <p className="help">
            {[...unlisted].join(", ")} {unlisted.size === 1 ? "is" : "are"} not
            in the leave policy. Add a policy for{" "}
            {unlisted.size === 1 ? "it" : "them"} or delete those rows.
          </p>
        ) : null}

        {lines.length === 0 ? (
          <Empty
            title={`No leave balances are recorded for ${year}.${canAdd && leaveNames.length > 0 ? " Add one with the form above, or carry forward the previous year." : ""}`}
          />
        ) : (
          <div className="table-wrap stack-table">
            <table>
              <caption className="sr-only">
                Leave register for {year}, days by leave name
              </caption>
              <thead>
                <tr>
                  <th scope="col" rowSpan={2}>
                    Employee
                  </th>
                  {columns.map((name) => (
                    <th key={name} scope="colgroup" colSpan={3} className="num">
                      {name}
                      {unlisted.has(name) ? " (not in policy)" : ""}
                    </th>
                  ))}
                </tr>
                <tr>
                  {columns.flatMap((name) =>
                    COUNTS.map(([key, label]) => (
                      <th key={`${name}-${key}`} scope="col" className="num">
                        {label}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.employeeId}>
                    <th scope="row" data-label="Employee">
                      <Link
                        href={`/app/leave?year=${year}&employee=${line.employeeId}`}
                        aria-label={`Open ${line.name}, ${line.code}, leave rows for ${year}`}
                      >
                        {line.code} · {line.name}
                      </Link>
                    </th>
                    {columns.flatMap((name) =>
                      COUNTS.map(([key, label]) => (
                        <td
                          key={`${name}-${key}`}
                          className="num"
                          data-label={`${name} · ${label}`}
                        >
                          <Days value={line.byLeave.get(name)?.[key]} />
                        </td>
                      )),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected ? (
        <section aria-labelledby="employee-title">
          <h2 id="employee-title">
            {selected.code} · {selected.name}, {year}
          </h2>
          {selectedRows.length === 0 ? (
            <Empty title={`${selected.name} has no leave rows for ${year}.`} />
          ) : (
            <div className="table-wrap stack-table">
              <table>
                <caption className="sr-only">
                  Leave rows for {selected.name} in {year}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Leave</th>
                    {COUNTS.map(([key, label]) => (
                      <th key={key} scope="col" className="num">
                        {label}
                      </th>
                    ))}
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRows.map((row) => {
                    const repeated = duplicates.includes(row);
                    return (
                      <tr key={row.id}>
                        <td data-label="Leave">
                          {row.leaveName}
                          {repeated ? (
                            <>
                              {" "}
                              <span className="pill critical">Repeated</span>
                            </>
                          ) : null}
                        </td>
                        {COUNTS.map(([key, label]) => (
                          <td key={key} className="num" data-label={label}>
                            <Days value={row[key]} />
                          </td>
                        ))}
                        <td data-label="Actions">
                          <div className="row-actions">
                            {canEdit ? (
                              <Link
                                className="button quiet"
                                href={`${viewHref}&edit=${row.id}`}
                                aria-label={`Edit ${row.leaveName} for ${selected.name}`}
                              >
                                Edit
                              </Link>
                            ) : null}
                            {canDelete ? (
                              <Link
                                className="button quiet"
                                href={`${viewHref}&delete=${row.id}`}
                                aria-label={`Delete ${row.leaveName} for ${selected.name}`}
                              >
                                Delete
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p>
            <Link className="button quiet" href={`/app/leave?year=${year}`}>
              Close {selected.name}
            </Link>
          </p>
        </section>
      ) : null}

      <section aria-labelledby="encash-title">
        <h2 id="encash-title">Encashment</h2>
        <form className="panel form-measure" action={addLeave}>
          <input type="hidden" name="kind" value="encash" />
          <label>
            <span>Employee</span>
            <select name="employeeId">
              {people.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Leave</span>
            <input name="leaveName" required />
          </label>
          <label>
            <span>Amount (rupees)</span>
            <input name="amount" inputMode="decimal" required />
          </label>
          <label>
            <span>Used</span>
            <input name="used" defaultValue="0" />
          </label>
          <label>
            <span>Cashed</span>
            <input name="cashed" defaultValue="0" />
          </label>
          <button type="submit">Save encashment</button>
        </form>
        <ul>
          {encash.map((row) => (
            <li key={row.id}>
              {people.find((item) => item.id === row.employeeId)?.name} ·{" "}
              {row.leaveName} · <Money paise={row.amountPaise} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
