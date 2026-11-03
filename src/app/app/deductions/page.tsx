import Link from "next/link";
import {
  Empty,
  Flash,
  Money,
  Origin,
  PageHeader,
  periodLabel,
} from "../../../components/ui";
import { formatInr } from "../../../domain/money";
import { can } from "../../../server/access";
import {
  addDeduction,
  removeDeduction,
  saveDeduction,
} from "../../../server/actions";
import { currentPeriod, requireView } from "../../../server/auth";
import {
  DEDUCTION_TYPES,
  listedType,
  searchDeductions,
} from "../../../server/deductions";
import { isLocked } from "../../../server/payroll";
import { readStore } from "../../../server/store";

type Query = {
  notice?: string;
  error?: string;
  period?: string;
  filterType?: string;
  edit?: string;
  delete?: string;
  employeeId?: string;
  type?: string;
  amount?: string;
};

function monthName(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** Paise as the plain rupee text a person would type, such as 1250.50. */
function typed(paise: number): string {
  const whole = Math.floor(paise / 100);
  const part = paise % 100;
  return part === 0
    ? String(whole)
    : `${whole}.${String(part).padStart(2, "0")}`;
}

function TypeOptions() {
  return DEDUCTION_TYPES.map((type) => (
    <option key={type} value={type}>
      {type}
    </option>
  ));
}

export default async function DeductionsPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const session = await requireView("deductions");
  const headerPeriod = await currentPeriod();
  const query = await searchParams;
  const store = readStore();
  const company = session.companyId;
  const canAdd = can(session.role, store.rights, "deductions", "add");
  const canEdit = can(session.role, store.rights, "deductions", "edit");
  const canDelete = can(session.role, store.rights, "deductions", "delete");
  const period = /^\d{4}-\d{2}$/.test(query.period ?? "")
    ? (query.period as string)
    : headerPeriod;
  const filterType = listedType(query.filterType ?? "") ?? undefined;
  const headerLocked = isLocked(store, company, headerPeriod);
  const viewLocked = isLocked(store, company, period);
  const people = store.employees
    .filter((item) => item.companyId === company)
    .sort((a, b) => a.code.localeCompare(b.code));
  const person = (id: string) => people.find((item) => item.id === id);
  const rows = searchDeductions(store, company, {
    period,
    type: filterType,
  });
  const total = rows.reduce((sum, row) => sum + row.amountPaise, 0);
  const editing =
    query.edit && canEdit
      ? store.deductions.find(
          (item) => item.id === query.edit && item.companyId === company,
        )
      : undefined;
  const deleting =
    query.delete && canDelete
      ? store.deductions.find(
          (item) => item.id === query.delete && item.companyId === company,
        )
      : undefined;
  const editingLocked = editing
    ? isLocked(store, company, editing.period)
    : false;
  const deletingLocked = deleting
    ? isLocked(store, company, deleting.period)
    : false;
  // After a refused save the form shows what the person typed.
  const draft = editing
    ? {
        type: query.type ?? listedType(editing.type) ?? "",
        amount: query.amount ?? typed(editing.amountPaise),
      }
    : {
        employeeId: query.employeeId ?? "",
        type: query.type ?? "",
        amount: query.amount ?? "",
      };
  const filterQuery = new URLSearchParams({ period });
  if (filterType) filterQuery.set("filterType", filterType);
  const listHref = `/app/deductions?${filterQuery.toString()}`;
  const back = (
    <>
      <input type="hidden" name="backPeriod" value={period} />
      <input type="hidden" name="backType" value={filterType ?? ""} />
    </>
  );

  return (
    <>
      <PageHeader
        title="Deduction entry"
        lede={
          headerLocked
            ? `${periodLabel(headerPeriod)} is locked. Deductions cannot be added for it.`
            : `One-time amounts. New deductions go to ${periodLabel(headerPeriod)} and reduce net pay when that month is processed. The type is a label and does not change the calculation.`
        }
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />

      {deleting ? (
        <section className="panel form-measure" aria-labelledby="delete-title">
          <h2 id="delete-title">
            Delete the {deleting.type} deduction for{" "}
            {person(deleting.employeeId)?.name ?? "this employee"} in{" "}
            {periodLabel(deleting.period)}?
          </h2>
          {deletingLocked ? (
            <p className="help">
              {periodLabel(deleting.period)} is locked, so this deduction cannot
              be deleted.
            </p>
          ) : (
            <>
              <p className="help">
                {formatInr(deleting.amountPaise)} is removed from other
                deductions the next time the month is processed. This cannot be
                undone.
              </p>
              <form action={removeDeduction} className="row-actions">
                <input type="hidden" name="id" value={deleting.id} />
                {back}
                <button type="submit">Delete deduction</button>
                <Link className="button quiet" href={listHref}>
                  Keep deduction
                </Link>
              </form>
            </>
          )}
        </section>
      ) : null}

      {editing ? (
        <section className="panel form-measure" aria-labelledby="edit-title">
          <h2 id="edit-title">
            Edit deduction for{" "}
            {person(editing.employeeId)?.name ?? "this employee"} in{" "}
            {periodLabel(editing.period)}
          </h2>
          <form action={saveDeduction}>
            <fieldset className="plain-fieldset" disabled={editingLocked}>
              <input type="hidden" name="id" value={editing.id} />
              {back}
              {editingLocked ? (
                <p className="help">
                  {periodLabel(editing.period)} is locked. This deduction cannot
                  be edited.
                </p>
              ) : (
                <p className="help">
                  The employee and month stay the same. Delete and add again to
                  change them.
                </p>
              )}
              <label>
                <span>Type</span>
                <select name="type" defaultValue={draft.type} required>
                  <option value="" disabled>
                    Choose a type
                  </option>
                  <TypeOptions />
                </select>
              </label>
              {listedType(editing.type) ? null : (
                <p className="help">
                  Saved as {editing.type}, which is not in the list. Choose a
                  listed type to save.
                </p>
              )}
              <label>
                <span>Amount (rupees)</span>
                <input
                  name="amount"
                  inputMode="decimal"
                  defaultValue={draft.amount}
                  required
                />
              </label>
              <div className="row-actions">
                <button type="submit">Save changes</button>
                <Link className="button quiet" href={listHref}>
                  Cancel
                </Link>
              </div>
            </fieldset>
          </form>
        </section>
      ) : null}

      {canAdd && !editing ? (
        people.length === 0 ? (
          <Empty
            title="Add an employee before entering deductions."
            href="/app/employees/new"
            label="Add employee"
          />
        ) : (
          <section className="panel form-measure" aria-labelledby="add-title">
            <h2 id="add-title">
              Add deduction for {periodLabel(headerPeriod)}
            </h2>
            <form action={addDeduction}>
              <fieldset className="plain-fieldset" disabled={headerLocked}>
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
                  <span>Type</span>
                  <select name="type" defaultValue={draft.type} required>
                    <option value="" disabled>
                      Choose a type
                    </option>
                    <TypeOptions />
                  </select>
                </label>
                <label>
                  <span>Amount (rupees)</span>
                  <input
                    name="amount"
                    inputMode="decimal"
                    defaultValue={draft.amount}
                    required
                  />
                </label>
                <button type="submit">Add deduction</button>
              </fieldset>
            </form>
          </section>
        )
      ) : null}

      <section aria-labelledby="list-title">
        <h2 id="list-title">Deductions for {periodLabel(period)}</h2>
        <search>
          <form className="row-actions" action="/app/deductions">
            <label>
              <span>Month</span>
              <input
                name="period"
                type="month"
                defaultValue={period}
                required
              />
            </label>
            <label>
              <span>Type</span>
              <select name="filterType" defaultValue={filterType ?? ""}>
                <option value="">All types</option>
                <TypeOptions />
              </select>
            </label>
            <button type="submit" className="quiet">
              Show
            </button>
          </form>
        </search>
        {viewLocked ? (
          <p className="help">
            {periodLabel(period)} is locked. Its deductions cannot be edited or
            deleted.
          </p>
        ) : null}

        {rows.length === 0 ? (
          <Empty
            title={`No ${filterType ? `${filterType} ` : ""}deductions are saved for ${periodLabel(period)}.`}
          />
        ) : (
          <div className="table-wrap stack-table">
            <table>
              <caption className="sr-only">
                Deductions for {periodLabel(period)}
                {filterType ? `, type ${filterType}` : ""}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Year</th>
                  <th scope="col">Emp. code</th>
                  <th scope="col">Emp. name</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const employee = person(row.employeeId);
                  const label = `${row.type} deduction for ${employee?.name ?? "employee"}`;
                  return (
                    <tr key={row.id}>
                      <td data-label="Month">{monthName(row.period)}</td>
                      <td className="figures" data-label="Year">
                        {row.period.slice(0, 4)}
                      </td>
                      <td className="figures" data-label="Emp. code">
                        {employee?.code}
                      </td>
                      <td data-label="Emp. name">{employee?.name}</td>
                      <td data-label="Type">
                        {row.type}
                        {listedType(row.type) ? null : (
                          <span className="help"> (not in list)</span>
                        )}
                      </td>
                      <td className="num" data-label="Amount">
                        <Money paise={row.amountPaise} />
                      </td>
                      <td data-label="Actions">
                        {viewLocked ? (
                          <span className="pill ok">Locked</span>
                        ) : (
                          <div className="row-actions">
                            {canEdit ? (
                              <Link
                                className="button quiet"
                                href={`${listHref}&edit=${row.id}`}
                                aria-label={`Edit ${label}`}
                              >
                                Edit
                              </Link>
                            ) : null}
                            {canDelete ? (
                              <Link
                                className="button quiet"
                                href={`${listHref}&delete=${row.id}`}
                                aria-label={`Delete ${label}`}
                              >
                                Delete
                              </Link>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={5}>
                    Total, {rows.length}{" "}
                    {rows.length === 1 ? "deduction" : "deductions"}
                  </th>
                  <td className="num">
                    <Money paise={total} />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
