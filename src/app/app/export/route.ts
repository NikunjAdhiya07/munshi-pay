import {
  eventKind,
  filterDashboardPeople,
  pendingField,
  todayInKolkata,
} from "../../../domain/dashboard";
import { employment, matchesEmployment } from "../../../domain/employees";
import { isPeriod, reportBySlug } from "../../../domain/reports";
import { canExport, canViewReport } from "../../../server/access";
import { currentPeriod, currentSession } from "../../../server/auth";
import { buildReport, reportCsv } from "../../../server/reports";
import { readStore } from "../../../server/store";

export async function GET(request: Request): Promise<Response> {
  const session = await currentSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const store = readStore();
  const period = await currentPeriod();
  const menu =
    kind === "employees"
      ? "employees"
      : kind === "register"
        ? "payroll"
        : kind === "report"
          ? "reports"
          : null;
  if (!menu) return new Response("Unknown export", { status: 400 });
  if (!canExport(session.role, store.rights, menu)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (kind === "register" || kind === "report") {
    const slug =
      kind === "register" ? "salary-register" : url.searchParams.get("slug");
    const report = reportBySlug(slug ?? "");
    if (!report) return new Response("Unknown report", { status: 404 });
    if (
      kind === "report" &&
      !canViewReport(session.role, store.rights, report.group)
    ) {
      return new Response("Forbidden", { status: 403 });
    }
    const month = url.searchParams.get("month") ?? period;
    if (!isPeriod(month)) {
      return new Response("Month must be YYYY-MM", { status: 400 });
    }
    const table = buildReport(store, session.companyId, month, report.slug);
    if (table.columns.length === 0) {
      return new Response(table.note ?? "Nothing to download", { status: 404 });
    }
    return csvResponse(reportCsv(table), `${report.slug}-${month}`);
  }
  const people = store.employees.filter(
    (item) => item.companyId === session.companyId,
  );
  let csv = "";
  if (kind === "employees") {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const today = todayInKolkata();
    const status = employment(url.searchParams.get("status") ?? undefined);
    const listed = filterDashboardPeople(people, session.companyId, today, {
      missing: pendingField(url.searchParams.get("missing") ?? undefined),
      event: eventKind(url.searchParams.get("event") ?? undefined),
    }).filter((item) => matchesEmployment(item, status, today));
    csv = [
      "Code,Name,Department,Designation,Birth date,Join date,Left date,UAN,PF number,ESI number",
    ]
      .concat(
        listed
          .filter((item) =>
            `${item.code} ${item.name} ${item.department}`
              .toLowerCase()
              .includes(q),
          )
          .map((item) =>
            [
              item.code,
              item.name,
              item.department,
              item.designation,
              item.birthDate,
              item.joinDate,
              item.leftDate,
              item.uan,
              item.pfNumber,
              item.esiNumber,
            ]
              .map(cell)
              .join(","),
          ),
      )
      .join("\n");
  } else {
    return new Response("Unknown export", { status: 400 });
  }
  return csvResponse(csv, kind ?? "export");
}

function csvResponse(csv: string, name: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function cell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
