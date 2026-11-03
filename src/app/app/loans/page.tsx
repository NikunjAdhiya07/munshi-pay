import Link from "next/link";
import {
  Empty,
  Flash,
  Money,
  Origin,
  PageHeader,
} from "../../../components/ui";
import { can } from "../../../server/access";
import { removeLoan, saveLoan } from "../../../server/actions";
import { requireView } from "../../../server/auth";
import type { Loan } from "../../../server/model";
import { readStore } from "../../../server/store";

type Query = {
  notice?: string;
  error?: string;
  edit?: string;
  delete?: string;
  employeeId?: string;
  date?: string;
  amount?: string;
  installment?: string;
  received?: string;
};

function typed(paise: number): string {
  const whole = Math.floor(paise / 100);
  const part = paise % 100;
  return part === 0
    ? String(whole)
    : `${whole}.${String(part).padStart(2, "0")}`;
}

function openingPaise(loan: Loan): number {
  const posted = (loan.posts ?? []).reduce((sum, post) => sum + post.paise, 0);
  return Math.max(0, loan.receivedPaise - posted);
}

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const session = await requireView("loans");
  const query = await searchParams;
  const store = readStore();
  const company = session.companyId;
  const canAdd = can(session.role, store.rights, "loans", "add");
  const canEdit = can(session.role, store.rights, "loans", "edit");
  const canDelete = can(session.role, store.rights, "loans", "delete");
  const people = store.employees
    .filter((item) => item.companyId === company)
    .sort((a, b) => a.code.localeCompare(b.code));
  const loans = store.loans
    .filter((item) => item.companyId === company)
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const person = (id: string) => people.find((item) => item.id === id);
  const editing = query.edit
    ? loans.find((item) => item.id === query.edit)
    : undefined;
  const deleting =
    query.delete && canDelete
      ? loans.find((item) => item.id === query.delete)
      : undefined;
  const draft = {
    employeeId: query.employeeId ?? editing?.employeeId ?? people[0]?.id ?? "",
    date: query.date ?? editing?.date ?? "",
    amount: query.amount ?? (editing ? typed(editing.amountPaise) : ""),
    installment:
      query.installment ?? (editing ? typed(editing.installmentPaise) : ""),
    received: query.received ?? (editing ? typed(openingPaise(editing)) : "0"),
  };
  const showForm = editing ? canEdit : canAdd;

  return (
    <>
      <PageHeader
        title="Loans"
        lede="The monthly installment is deducted when salary is processed, up to the remaining balance. Cash received and installments paid change when that month is locked, and come back if the month is unlocked."
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />

      {deleting ? (
        <section
          className="panel form-measure"
          aria-labelledby="loan-delete-title"
        >
          <h2 id="loan-delete-title">
            Delete the loan for{" "}
            {person(deleting.employeeId)?.code ?? "this employee"} dated{" "}
            {deleting.date}?
          </h2>
          <p className="help">
            Open months will no longer deduct this installment. Locked months
            keep the deduction already calculated. This cannot be undone.
          </p>
          <form action={removeLoan} className="row-actions">
            <input type="hidden" name="id" value={deleting.id} />
            <button type="submit">Delete loan</button>
            <Link className="button quiet" href="/app/loans">
              Keep loan
            </Link>
          </form>
        </section>
      ) : null}

      {showForm && people.length > 0 ? (
        <form className="panel form-measure" action={saveLoan}>
          <h2>{editing ? `Edit loan dated ${editing.date}` : "Add loan"}</h2>
          {editing ? (
            <input type="hidden" name="id" value={editing.id} />
          ) : null}
          <label>
            <span>Employee</span>
            <select name="employeeId" defaultValue={draft.employeeId} required>
              {people.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.code} · {employee.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input name="date" type="date" defaultValue={draft.date} required />
          </label>
          <label>
            <span>Loan amount (rupees)</span>
            <input
              name="amount"
              inputMode="decimal"
              defaultValue={draft.amount}
              required
            />
          </label>
          <label>
            <span>Monthly installment (rupees)</span>
            <input
              name="installment"
              inputMode="decimal"
              defaultValue={draft.installment}
              required
            />
          </label>
          <label>
            <span>Cash already received (rupees)</span>
            <input
              name="received"
              inputMode="decimal"
              defaultValue={draft.received}
              aria-describedby="loan-received-help"
            />
          </label>
          <p id="loan-received-help" className="help">
            Cash received before installments from locked months. Those
            installments are added when the month is locked.
          </p>
          <div className="row-actions">
            <button type="submit">
              {editing ? "Save changes" : "Save loan"}
            </button>
            {editing ? (
              <Link className="button quiet" href="/app/loans">
                Cancel
              </Link>
            ) : null}
          </div>
        </form>
      ) : null}

      {loans.length === 0 ? (
        <Empty
          title={
            people.length === 0
              ? "Add an employee before recording a loan."
              : `No loans are recorded for this company.${canAdd ? " Add one with the form above." : ""}`
          }
        />
      ) : (
        <div className="table-wrap stack-table">
          <table>
            <caption className="sr-only">Loans</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Code</th>
                <th scope="col">Name</th>
                <th scope="col" className="num">
                  Amount
                </th>
                <th scope="col" className="num">
                  Installment
                </th>
                <th scope="col" className="num">
                  Cash received
                </th>
                <th scope="col" className="num">
                  Installments paid
                </th>
                <th scope="col" className="num">
                  Balance
                </th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => {
                const employee = person(loan.employeeId);
                const posted = (loan.posts ?? []).length > 0;
                return (
                  <tr key={loan.id}>
                    <td className="figures" data-label="Date">
                      {loan.date}
                    </td>
                    <td data-label="Code">{employee?.code ?? "Unknown"}</td>
                    <td data-label="Name">
                      {employee?.name ?? "Unknown employee"}
                    </td>
                    <td className="num" data-label="Amount">
                      <Money paise={loan.amountPaise} />
                    </td>
                    <td className="num" data-label="Installment">
                      <Money paise={loan.installmentPaise} />
                    </td>
                    <td className="num" data-label="Cash received">
                      <Money paise={loan.receivedPaise} />
                    </td>
                    <td className="num" data-label="Installments paid">
                      {loan.paidInstallments ?? 0}
                    </td>
                    <td className="num" data-label="Balance">
                      <Money
                        paise={Math.max(
                          0,
                          loan.amountPaise - loan.receivedPaise,
                        )}
                      />
                    </td>
                    <td data-label="Actions">
                      <div className="row-actions">
                        {canEdit ? (
                          <Link
                            className="button quiet"
                            href={`/app/loans?edit=${loan.id}`}
                            aria-label={`Edit loan for ${employee?.code ?? "employee"} dated ${loan.date}`}
                          >
                            Edit
                          </Link>
                        ) : null}
                        {posted ? (
                          <span>Installments posted</span>
                        ) : canDelete ? (
                          <Link
                            className="button quiet"
                            href={`/app/loans?delete=${loan.id}`}
                            aria-label={`Delete loan for ${employee?.code ?? "employee"} dated ${loan.date}`}
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
    </>
  );
}
