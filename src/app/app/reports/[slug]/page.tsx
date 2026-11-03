import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Empty,
  Flash,
  Money,
  Origin,
  PageHeader,
  periodLabel,
  RunStatus,
} from "../../../../components/ui";
import { isIsoDate, isPeriod, reportBySlug } from "../../../../domain/reports";
import { canExport, canViewReport } from "../../../../server/access";
import { currentPeriod, requireView } from "../../../../server/auth";
import { buildReport, runStatusFor } from "../../../../server/reports";
import { originLabel, readStore } from "../../../../server/store";

type Query = { month?: string; paid?: string };

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Query>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const report = reportBySlug(slug);
  if (!report) notFound();
  const session = await requireView("reports");
  const headerPeriod = await currentPeriod();
  const store = readStore();
  if (!canViewReport(session.role, store.rights, report.group)) {
    return (
      <>
        <PageHeader title={report.name} />
        <Empty title={`Your role cannot view ${report.group} reports.`} />
      </>
    );
  }

  // The month filter overrides the header month for this view only.
  const monthTyped = query.month?.trim() ?? "";
  const monthValid = monthTyped === "" || isPeriod(monthTyped);
  const period =
    monthTyped !== "" && isPeriod(monthTyped) ? monthTyped : headerPeriod;
  const paidTyped = query.paid?.trim() ?? "";
  const paidValid = paidTyped === "" || isIsoDate(paidTyped);
  const isRegister = report.slug === "salary-register";
  const paidOn = isRegister && paidValid ? paidTyped : "";

  const table = buildReport(store, session.companyId, period, report.slug);
  const hasFile = table.columns.length > 0;
  const runStatus = runStatusFor(store, session.companyId, period);
  const downloadHref = `/app/export?kind=report&slug=${report.slug}&month=${period}`;
  // Pay slips open for the header month, so only link them when it matches.
  const slipLinks = report.source === "payroll" && period === headerPeriod;
  const error = !monthValid
    ? "Month must be written as YYYY-MM, such as 2026-10. Showing the header month instead."
    : !paidValid
      ? "Payment date must be a real date written as YYYY-MM-DD. It was not used."
      : undefined;

  return (
    <>
      <PageHeader
        title={report.name}
        lede={`${report.group} · ${periodLabel(period)}`}
        action={
          hasFile && canExport(session.role, store.rights, "reports") ? (
            <a className="button quiet" href={downloadHref}>
              Download CSV
            </a>
          ) : undefined
        }
      />
      <Flash error={error} />
      <Origin />
      <form className="panel form-measure" method="get">
        <h2>Filters</h2>
        <label>
          <span>Month</span>
          <input
            name="month"
            defaultValue={monthTyped || period}
            inputMode="numeric"
            placeholder="YYYY-MM"
            pattern="\d{4}-(0[1-9]|1[0-2])"
            autoComplete="off"
          />
        </label>
        {isRegister ? (
          <>
            <label>
              <span>Payment date</span>
              <input
                name="paid"
                defaultValue={paidTyped}
                inputMode="numeric"
                placeholder="YYYY-MM-DD"
                pattern="\d{4}-\d{2}-\d{2}"
                autoComplete="off"
              />
            </label>
            <p className="help">
              The payment date is shown with the register as typed. No payment
              is made or tracked.
            </p>
          </>
        ) : null}
        <p>
          <button type="submit">Apply filters</button>{" "}
          <Link className="button quiet" href={`/app/reports/${report.slug}`}>
            Reset
          </Link>
        </p>
      </form>
      <p className="help">
        {report.source === "payroll" ? (
          <>
            Run status: <RunStatus status={runStatus} />.{" "}
          </>
        ) : null}
        Data: {originLabel(store)}. {paidOn ? `Payment date ${paidOn}. ` : ""}
        Statutory stationery is withheld.
      </p>
      {table.note ? <p className="panel">{table.note}</p> : null}
      {hasFile && table.rows.length === 0 ? (
        report.source === "payroll" ? (
          <Empty
            title={`No payable lines for ${periodLabel(period)}.`}
            href="/app/payroll"
            label="Process salary"
          />
        ) : (
          <Empty title={`No rows for ${periodLabel(period)}.`} />
        )
      ) : null}
      {hasFile && table.rows.length > 0 ? (
        <div className="table-wrap stack-table">
          <table>
            <caption className="sr-only">
              {table.name}, {periodLabel(period)}
            </caption>
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th
                    key={column.label}
                    scope="col"
                    className={column.kind === "text" ? undefined : "num"}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={`${row.employeeId}|${row.cells.join("|")}`}>
                  {row.cells.map((cell, index) => {
                    const column = table.columns[index];
                    if (column.kind === "money") {
                      return (
                        <td
                          key={column.label}
                          className="num"
                          data-label={column.label}
                        >
                          <Money paise={Number(cell)} />
                        </td>
                      );
                    }
                    if (column.kind === "count") {
                      return (
                        <td
                          key={column.label}
                          className="num"
                          data-label={column.label}
                        >
                          {cell}
                        </td>
                      );
                    }
                    const link =
                      column.label === "Name" && row.employeeId
                        ? report.source === "leavers"
                          ? `/app/employees/${row.employeeId}`
                          : slipLinks
                            ? `/app/payroll/slips/${row.employeeId}`
                            : null
                        : null;
                    return (
                      <td key={column.label} data-label={column.label}>
                        {link ? <Link href={link}>{cell}</Link> : cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
