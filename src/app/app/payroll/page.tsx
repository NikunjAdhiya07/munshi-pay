import Link from "next/link";
import {
  Empty,
  Flash,
  Money,
  Origin,
  PageHeader,
  periodLabel,
  RunStatus,
} from "../../../components/ui";
import { runPayroll } from "../../../server/actions";
import { currentPeriod, requireView } from "../../../server/auth";
import { readStore } from "../../../server/store";

const fixFor: Record<string, string> = {
  "empty-rate": "salary",
  "empty-category": "salary",
  "left-employee": "profile",
  "esi-above-limit": "profile",
};

export default async function ProcessPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requireView("payroll");
  const period = await currentPeriod();
  const query = await searchParams;
  const store = readStore();
  const locked = store.locks.some(
    (item) => item.companyId === session.companyId && item.period === period,
  );
  const run = store.runs.find(
    (item) => item.companyId === session.companyId && item.period === period,
  );
  const people = store.employees.filter(
    (item) => item.companyId === session.companyId,
  );
  const exceptions =
    run?.lines.flatMap((line) =>
      line.exceptions.map((exception) => ({
        ...exception,
        employeeId: line.employeeId,
        name:
          people.find((item) => item.id === line.employeeId)?.name ??
          line.employeeId,
      })),
    ) ?? [];
  const critical = exceptions.filter((item) => item.severity === "critical");
  const warnings = exceptions.filter((item) => item.severity === "warning");

  return (
    <>
      <PageHeader
        title="Process salary"
        lede={periodLabel(period)}
        action={
          <div className="top-controls">
            <RunStatus status={locked ? "locked" : (run?.status ?? null)} />
            <form action={runPayroll}>
              <button type="submit" disabled={locked}>
                Process salary
              </button>
            </form>
          </div>
        }
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />
      {run ? (
        <div className="stats">
          <div className="stat">
            <span>Critical</span>
            <strong>{critical.length}</strong>
          </div>
          <div className="stat">
            <span>Warnings</span>
            <strong>{warnings.length}</strong>
          </div>
          <div className="stat">
            <span>Payable lines</span>
            <strong>{run.lines.filter((line) => line.payable).length}</strong>
          </div>
        </div>
      ) : null}
      {exceptions.length === 0 ? (
        <Empty
          title={
            run
              ? "No exceptions for this month."
              : "Process the month to see payroll exceptions."
          }
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Problem</th>
                <th>Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((item) => (
                <tr key={`${item.employeeId}-${item.code}`}>
                  <td>{item.name}</td>
                  <td className={`status ${item.severity}`}>{item.code}</td>
                  <td>{item.reason}</td>
                  <td>
                    <Link
                      href={`/app/employees/${item.employeeId}?tab=${fixFor[item.code] ?? "profile"}`}
                    >
                      Open record
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="cards">
        {exceptions.map((item) => (
          <Link
            key={`${item.employeeId}-${item.code}-card`}
            className="card-row"
            href={`/app/employees/${item.employeeId}?tab=${fixFor[item.code] ?? "profile"}`}
          >
            <strong>{item.name}</strong>
            <div className={`status ${item.severity}`}>{item.reason}</div>
          </Link>
        ))}
      </div>
      {run ? (
        <p>
          Payable net{" "}
          <Money
            paise={run.lines
              .filter((line) => line.payable)
              .reduce((sum, line) => sum + line.netPaise, 0)}
          />
          . <Link href="/app/payroll/entry">Review salary entry</Link>
        </p>
      ) : null}
    </>
  );
}
