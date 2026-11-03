import Link from "next/link";
import {
  Empty,
  Origin,
  PageHeader,
  periodLabel,
  RunStatus,
} from "../../../components/ui";
import { type ReportDef, reportGroups, reports } from "../../../domain/reports";
import { canViewReport } from "../../../server/access";
import { currentPeriod, requireView } from "../../../server/auth";
import { buildReport, runStatusFor } from "../../../server/reports";
import { originLabel, readStore } from "../../../server/store";

/** Run status for pay reports. The other sources have no run, so say so. */
function Status({
  report,
  runStatus,
  rows,
}: {
  report: ReportDef;
  runStatus: string | null;
  rows: number;
}) {
  if (report.source === "payroll") return <RunStatus status={runStatus} />;
  if (report.source === "none") return <span className="pill">No data</span>;
  return <span className="pill">{rows > 0 ? "Recorded" : "No rows"}</span>;
}

function monthNote(report: ReportDef, period: string): string {
  if (report.source === "payroll") return `Run for ${periodLabel(period)}`;
  if (report.source === "muster") return `Muster for ${periodLabel(period)}`;
  if (report.source === "leave") return "All years, not filtered by month";
  if (report.source === "leavers") return "All leavers, not filtered by month";
  return "No records are stored";
}

export default async function ReportsPage() {
  const session = await requireView("reports");
  const period = await currentPeriod();
  const store = readStore();
  const groups = reportGroups.filter((group) =>
    canViewReport(session.role, store.rights, group),
  );
  if (groups.length === 0) {
    return (
      <>
        <PageHeader title="Reports" />
        <Empty title="Your role cannot view reports." />
      </>
    );
  }
  const runStatus = runStatusFor(store, session.companyId, period);
  return (
    <>
      <PageHeader
        title="Reports"
        lede={`${periodLabel(period)}. Each report lists the saved rows for the month in the header. Statutory form layouts are not drawn until the filing rule is validated.`}
      />
      <Origin />
      {groups.map((group) => (
        <section key={group} className="panel">
          <h2>{group}</h2>
          <div className="table-wrap stack-table">
            <table>
              <caption className="sr-only">{group} reports</caption>
              <thead>
                <tr>
                  <th scope="col">Report</th>
                  <th scope="col">Rows from</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">
                    Rows
                  </th>
                  <th scope="col">Data</th>
                </tr>
              </thead>
              <tbody>
                {reports
                  .filter((report) => report.group === group)
                  .map((report) => {
                    const rows = buildReport(
                      store,
                      session.companyId,
                      period,
                      report.slug,
                    ).rows.length;
                    return (
                      <tr key={report.slug}>
                        <td data-label="Report">
                          <Link href={`/app/reports/${report.slug}`}>
                            {report.name}
                          </Link>
                        </td>
                        <td data-label="Rows from">
                          {monthNote(report, period)}
                        </td>
                        <td data-label="Status">
                          <Status
                            report={report}
                            runStatus={runStatus}
                            rows={rows}
                          />
                        </td>
                        <td className="num" data-label="Rows">
                          {rows}
                        </td>
                        <td data-label="Data">{originLabel(store)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
