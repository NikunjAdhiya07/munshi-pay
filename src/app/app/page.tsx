import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarList,
  Columns,
  Donut,
  Meter,
  PART_COLORS,
  PairBars,
  SERIES,
  Sparkline,
} from "../../components/charts";
import {
  BandChart,
  DeductionExplorer,
  GrossToNet,
  TrendExplorer,
} from "../../components/dash-charts";
import { DataTable, type TableRow } from "../../components/data-table";
import { Icon, type IconName } from "../../components/icons";
import {
  Empty,
  Flash,
  Kpi,
  Money,
  Origin,
  periodLabel,
  RunStatus,
} from "../../components/ui";
import {
  EVENT_KINDS,
  filterDashboardPeople,
  isActive,
  pendingCounts,
  todayInKolkata,
} from "../../domain/dashboard";
import {
  deductionBreakdown,
  departmentRollup,
  type MonthFigures,
  payBands,
  payrollInsights,
  type StatLine,
  toStatLine,
  totalsOf,
  waterfall,
} from "../../domain/dashboardStats";
import { changeLabel, changePercent, compactInr } from "../../domain/format";
import { formatInr } from "../../domain/money";
import { can, canExport } from "../../server/access";
import { setPeriod } from "../../server/actions";
import { currentPeriod, requireSession } from "../../server/auth";
import type { Employee, Menu } from "../../server/model";
import { readStore } from "../../server/store";

export const metadata = { title: "Dashboard" };

/** Shows its content only when the role may view that data. */
function Gate({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) {
  return show ? children : null;
}

function periodEnd(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(last).padStart(2, "0")}`;
}

function latestSalary(employee: Employee, period: string) {
  const end = periodEnd(period);
  return employee.salaryRows
    .filter((row) => row.asOn <= end)
    .sort((a, b) => b.asOn.localeCompare(a.asOn))[0];
}

function shortPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

type Alert = {
  tone: "critical" | "warning" | "info";
  text: string;
  href: string;
};

const TONE_ICON: Record<Alert["tone"], IconName> = {
  critical: "alert",
  warning: "alert",
  info: "info",
};

const INSIGHT_ICON = {
  positive: "check-circle",
  info: "info",
  attention: "alert",
} as const;

const ATTENDANCE_COLORS = [
  SERIES.blue,
  SERIES.teal,
  SERIES.amber,
  SERIES.rust,
  SERIES.slate,
];

const UNASSIGNED = "Unassigned";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; dept?: string }>;
}) {
  const session = await requireSession();
  if (!session.companyId) redirect("/companies");
  const period = await currentPeriod();
  const query = await searchParams;
  const store = readStore();
  // Every member may open the dashboard. Each section needs its own view right.
  const allowed = (menu: Menu) => can(session.role, store.rights, menu, "view");
  const viewPay = allowed("payroll");
  const viewEmployees = allowed("employees");
  const viewMuster = allowed("muster");
  const viewLeave = allowed("leave");
  const viewLoans = viewPay && allowed("loans");
  const viewMasters = allowed("masters");
  const viewControl = allowed("control");
  const month = periodLabel(period);
  const end = periodEnd(period);
  const company = store.companies.find((item) => item.id === session.companyId);

  // The department filter narrows every figure that belongs to a person.
  const everyone = viewEmployees
    ? store.employees.filter((item) => item.companyId === session.companyId)
    : [];
  const departmentOf = (item: Employee) => item.department || UNASSIGNED;
  const departmentNames = [...new Set(everyone.map(departmentOf))].sort(
    (a, b) => a.localeCompare(b),
  );
  const dept =
    query.dept && departmentNames.includes(query.dept) ? query.dept : null;
  const people = dept
    ? everyone.filter((item) => departmentOf(item) === dept)
    : everyone;
  const scopeIds = new Set(people.map((item) => item.id));
  const inScope = (employeeId: string) => !dept || scopeIds.has(employeeId);

  const active = people.filter((item) => !item.leftDate || item.leftDate > end);
  const inactive = people.length - active.length;
  const run = viewPay
    ? store.runs.find(
        (item) =>
          item.companyId === session.companyId && item.period === period,
      )
    : undefined;
  const locked =
    viewPay &&
    store.locks.some(
      (item) => item.companyId === session.companyId && item.period === period,
    );
  const runLines = run?.lines.filter((line) => inScope(line.employeeId)) ?? [];
  const personFor = (employeeId: string) =>
    everyone.find((item) => item.id === employeeId);
  const toStat = (line: (typeof runLines)[number]): StatLine => {
    const person = personFor(line.employeeId);
    return toStatLine(line, {
      name: person?.name ?? line.employeeId,
      code: person?.code ?? "",
      department: person ? departmentOf(person) : UNASSIGNED,
    });
  };
  const payable = runLines.filter((line) => line.payable);
  const stat = payable.map(toStat);
  const totals = totalsOf(stat);
  const { gross, deductions, net } = totals;
  // Company-wide lines feed the department chart, which stays whole so a
  // bar can be chosen from it while a filter is on.
  const allStat = (run?.lines ?? []).filter((l) => l.payable).map(toStat);
  const departmentPay = departmentRollup(allStat);
  const parts = deductionBreakdown(stat);
  const steps = waterfall(stat);
  const exceptions = runLines.flatMap((line) =>
    line.exceptions.map((exception) => ({
      ...exception,
      employeeId: line.employeeId,
      name: personFor(line.employeeId)?.name ?? line.employeeId,
    })),
  );
  const critical = exceptions.filter((item) => item.severity === "critical");
  const warnings = exceptions.filter((item) => item.severity === "warning");
  const muster = viewMuster
    ? store.muster.filter(
        (item) =>
          item.companyId === session.companyId &&
          item.period === period &&
          inScope(item.employeeId),
      )
    : [];
  const missingMuster = active.filter(
    (item) => !muster.some((row) => row.employeeId === item.id),
  );
  const missingPay = active.filter((item) => {
    const row = latestSalary(item, period);
    return !row || row.grossPaise <= 0 || !row.categoryId;
  });
  const balances = viewLeave
    ? store.leaveBalances.filter(
        (item) =>
          item.companyId === session.companyId && inScope(item.employeeId),
      )
    : [];
  const leaveDays = balances.reduce((sum, row) => sum + row.balance, 0);
  const loans = allowed("loans")
    ? store.loans.filter(
        (item) =>
          item.companyId === session.companyId && inScope(item.employeeId),
      )
    : [];
  const loanBalance = loans.reduce(
    (sum, item) => sum + Math.max(0, item.amountPaise - item.receivedPaise),
    0,
  );
  const loanDue = loans.reduce((sum, item) => {
    const balance = item.amountPaise - item.receivedPaise;
    if (balance <= 0) return sum;
    return sum + Math.min(item.installmentPaise, balance);
  }, 0);
  const otherDeductions = allowed("deductions")
    ? store.deductions.filter(
        (item) =>
          item.companyId === session.companyId &&
          item.period === period &&
          inScope(item.employeeId),
      )
    : [];
  const otherDeductionPaise = otherDeductions.reduce(
    (sum, item) => sum + item.amountPaise,
    0,
  );
  const activity = viewControl
    ? store.audit
        .filter(
          (item, at, all) =>
            item.companyId === session.companyId &&
            all.findIndex((other) => other.id === item.id) === at,
        )
        .slice(0, 6)
    : [];
  const months: MonthFigures[] = (viewPay ? store.runs : [])
    .filter((item) => item.companyId === session.companyId)
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((item) => {
      const lines = item.lines.filter(
        (line) => line.payable && inScope(line.employeeId),
      );
      const sum = (pick: (line: (typeof lines)[number]) => number) =>
        lines.reduce((total, line) => total + pick(line), 0);
      return {
        period: item.period,
        status: item.status,
        payable: lines.length,
        gross: sum((line) => line.grossPaise),
        deductions: sum((line) => line.deductionPaise),
        net: sum((line) => line.netPaise),
      };
    });
  // The comparison month is the latest processed month before this one.
  const previous = [...months].reverse().find((item) => item.period < period);
  const strength = new Map<string, { active: number; inactive: number }>();
  for (const person of everyone) {
    const name = departmentOf(person);
    const current = strength.get(name) ?? { active: 0, inactive: 0 };
    if (!person.leftDate || person.leftDate > end) current.active += 1;
    else current.inactive += 1;
    strength.set(name, current);
  }
  const strengthRows = [...strength.entries()].sort(
    (a, b) => b[1].active + b[1].inactive - (a[1].active + a[1].inactive),
  );
  const payRows: TableRow[] = stat.map((line) => ({
    id: line.employeeId,
    cells: {
      code: <span className="figures">{line.code || "—"}</span>,
      name: (
        <Link href={`/app/payroll/slips/${line.employeeId}`}>{line.name}</Link>
      ),
      department: line.department,
      gross: <Money paise={line.grossPaise} />,
      deductions: <Money paise={line.deductionPaise} />,
      net: <Money paise={line.netPaise} />,
    },
    sort: {
      code: line.code,
      name: line.name,
      department: line.department,
      gross: line.grossPaise,
      deductions: line.deductionPaise,
      net: line.netPaise,
    },
    search: `${line.code} ${line.name} ${line.department}`,
    facets: { department: line.department },
  }));
  const attendanceParts = [
    {
      name: "Paid",
      short: "Paid",
      value: muster.reduce((sum, row) => sum + row.paidDays, 0),
    },
    {
      name: "Week off",
      short: "Off",
      value: muster.reduce((sum, row) => sum + row.weekOff, 0),
    },
    {
      name: "Holiday",
      short: "Holiday",
      value: muster.reduce((sum, row) => sum + row.publicHoliday, 0),
    },
    {
      name: "Comp off",
      short: "Comp",
      value: muster.reduce((sum, row) => sum + row.compOff, 0),
    },
    {
      name: "On duty",
      short: "Duty",
      value: muster.reduce((sum, row) => sum + row.onDuty, 0),
    },
  ];
  const paidDays = attendanceParts[0].value;
  const leaveByName = new Map<string, { rows: number; days: number }>();
  for (const row of balances) {
    const current = leaveByName.get(row.leaveName) ?? { rows: 0, days: 0 };
    leaveByName.set(row.leaveName, {
      rows: current.rows + 1,
      days: current.days + row.balance,
    });
  }
  const leaveRows = [...leaveByName.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const today = todayInKolkata();
  const pending = pendingCounts(people, session.companyId, today);
  const events = EVENT_KINDS.map((kind) => {
    const list = filterDashboardPeople(people, session.companyId, today, {
      event: kind.id,
    });
    return { id: kind.id, label: kind.label, list };
  });
  const pendingOpen = pending.reduce((sum, row) => sum + row.count, 0);
  const eventsOpen = events.reduce((sum, row) => sum + row.list.length, 0);
  const activeToday = people.filter((item) => isActive(item, today)).length;
  const holidays = (viewMasters ? store.holidays : [])
    .filter(
      (item) =>
        item.companyId === session.companyId && item.date.startsWith(period),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const held = runLines.length - payable.length;

  // Everything that needs the person's attention, most urgent first.
  const alerts: Alert[] = [];
  if (viewPay && critical.length > 0) {
    alerts.push({
      tone: "critical",
      text: `${critical.length} critical payroll ${critical.length === 1 ? "exception" : "exceptions"} to resolve before paying.`,
      href: "/app/payroll",
    });
  }
  if (viewPay && !run) {
    alerts.push({
      tone: "warning",
      text: `${month} has not been processed.`,
      href: "/app/payroll",
    });
  }
  if (allowed("company") && company && company.pfEmployeePercent == null) {
    alerts.push({
      tone: "warning",
      text: "PF percent is not configured, so PF on a processed month is zero.",
      href: "/app/company/profile",
    });
  }
  if (allowed("company") && company && company.esiEmployeePercent == null) {
    alerts.push({
      tone: "warning",
      text: "ESI percent is not configured, so ESI on a processed month is zero.",
      href: "/app/company/profile",
    });
  }
  if (viewMuster && missingMuster.length > 0) {
    alerts.push({
      tone: "warning",
      text: `${missingMuster.length} active ${missingMuster.length === 1 ? "employee has" : "employees have"} no muster for ${month}.`,
      href: "/app/muster",
    });
  }
  if (viewEmployees && missingPay.length > 0) {
    alerts.push({
      tone: "warning",
      text: `${missingPay.length} active ${missingPay.length === 1 ? "employee is" : "employees are"} missing a salary rate or category.`,
      href: "/app/employees",
    });
  }
  if (viewPay && warnings.length > 0) {
    alerts.push({
      tone: "warning",
      text: `${warnings.length} payroll ${warnings.length === 1 ? "warning" : "warnings"} to review.`,
      href: "/app/payroll",
    });
  }
  if (viewEmployees) {
    for (const row of pending) {
      if (row.count === 0) continue;
      const bank = row.id === "salary-bank" || row.id === "pf-bank";
      alerts.push({
        tone: bank ? "warning" : "info",
        text: bank
          ? `${row.count} active ${row.count === 1 ? "employee has" : "employees have"} incomplete ${row.label.toLowerCase()} details.`
          : `${row.count} active ${row.count === 1 ? "employee has" : "employees have"} no ${row.label}.`,
        href: `/app/employees?missing=${row.id}`,
      });
    }
  }
  if (viewPay && viewControl && run && !locked && critical.length === 0) {
    alerts.push({
      tone: "info",
      text: `Lock ${month} when the register is final.`,
      href: "/app/control",
    });
  }

  const primary = !run
    ? { href: "/app/payroll", label: "Process salary" }
    : critical.length > 0
      ? { href: "/app/payroll", label: "Review exceptions" }
      : { href: "/app/payroll/register", label: "Open register" };

  // Each step is listed only to a role that may view what it counts.
  const peopleStep = {
    name: "Employees",
    done: people.length > 0,
    detail: `${people.length} on record`,
  };
  const musterStep = {
    name: "Muster",
    done: active.length > 0 && missingMuster.length === 0,
    detail:
      active.length === 0
        ? "No active employees"
        : `${muster.length} of ${active.length} active`,
  };
  const payrollSteps = [
    {
      name: "Processed",
      done: Boolean(run),
      detail: run
        ? locked
          ? "Locked"
          : run.status === "in-review"
            ? "In review"
            : "Calculated"
        : "Not processed",
    },
    {
      name: "Exceptions cleared",
      done: Boolean(run) && critical.length === 0,
      detail: run ? `${critical.length} critical` : "Waiting on process",
    },
    {
      name: "Locked",
      done: locked,
      detail: locked ? "Period is locked" : "Period is open",
    },
  ];
  const checklist = [
    ...(viewEmployees ? [peopleStep] : []),
    ...(viewMuster ? [musterStep] : []),
    ...(viewPay ? payrollSteps : []),
  ];
  const stepsDone = checklist.filter((step) => step.done).length;

  const versus = previous ? `vs ${shortPeriod(previous.period)}` : "";
  const delta = (current: number, before: number | undefined) => {
    const percent = changePercent(current, before);
    if (percent === null) return undefined;
    return {
      text: changeLabel(percent),
      direction:
        percent > 0
          ? ("up" as const)
          : percent < 0
            ? ("down" as const)
            : ("flat" as const),
      versus,
    };
  };
  const averageNet = totals.people > 0 ? Math.round(net / totals.people) : 0;
  const previousAverage =
    previous && previous.payable > 0
      ? Math.round(previous.net / previous.payable)
      : undefined;
  const trendOn = months.length >= 2;
  const spark = (pick: (item: MonthFigures) => number) =>
    trendOn ? months.slice(-8).map(pick) : [];

  const insights = run
    ? payrollInsights({
        lines: stat,
        totals,
        parts,
        departments: departmentRollup(stat),
        previous,
        previousLabel: previous ? periodLabel(previous.period) : undefined,
        held,
        activeCount: active.length,
        musterCount: viewMuster ? muster.length : null,
        monthLabel: month,
        pfConfigured: !allowed("company") || company?.pfEmployeePercent != null,
        esiConfigured:
          !allowed("company") || company?.esiEmployeePercent != null,
      })
    : [];
  const bands = payBands(stat, (line) => line.netPaise);
  const slipBase = viewPay ? "/app/payroll/slips" : null;
  const deptLink = (name: string) => `/app?dept=${encodeURIComponent(name)}`;
  const scopeNote = dept ? ` · ${dept}` : "";

  const quick: {
    href: string;
    label: string;
    hint: string;
    icon: IconName;
    show: boolean;
    primary?: boolean;
  }[] = [
    {
      href: "/app/payroll",
      label: locked ? "Open payroll" : "Process salary",
      hint: locked ? `${month} is locked` : `Run ${month}`,
      icon: "wallet",
      show: viewPay,
      primary: !run,
    },
    {
      href: "/app/employees/new",
      label: "Add employee",
      hint: "Create a new record",
      icon: "user-plus",
      show: can(session.role, store.rights, "employees", "add"),
    },
    {
      href: "/app/import",
      label: "Import Excel",
      hint: "Upload a workbook",
      icon: "upload",
      show: allowed("import"),
    },
    {
      href: "/app/payroll/summary",
      label: "Salary summary",
      hint: `Totals for ${month}`,
      icon: "summary",
      show: viewPay,
    },
    {
      href: "/app/muster",
      label: "Monthly muster",
      hint: "Record attendance",
      icon: "calendar-check",
      show: viewMuster,
    },
    {
      href: "/app/payroll/slips",
      label: "Salary slips",
      hint: "View and print",
      icon: "receipt",
      show: viewPay,
    },
    {
      href: "/app/exports",
      label: "Export Excel",
      hint: "Download data",
      icon: "download",
      show: canExport(session.role, store.rights, "export"),
    },
    {
      href: "/app/reports",
      label: "Reports",
      hint: "Registers and statements",
      icon: "file",
      show: allowed("reports"),
    },
  ];
  const quickShown = quick.filter((item) => item.show).slice(0, 8);

  return (
    <div className="dash">
      <header className="command">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>
            {company?.name ?? "Company"}{" "}
            <span className="command-month">{month}</span>
          </h1>
          <Origin />
        </div>
        <div className="command-actions">
          {viewPay ? (
            <>
              <RunStatus status={locked ? "locked" : (run?.status ?? null)} />
              <Link className="button" href={primary.href}>
                <Icon name={run ? "arrow-right" : "wallet"} size={16} />
                {primary.label}
              </Link>
            </>
          ) : null}
        </div>
      </header>
      <Flash notice={query.notice} error={query.error} />

      {departmentNames.length > 1 ? (
        <nav
          className="filter-bar"
          aria-label="Filter the dashboard by department"
        >
          <span className="filter-label">
            <Icon name="company" size={14} /> Department
          </span>
          <Link
            className="dept-chip"
            href="/app"
            aria-current={dept ? undefined : "true"}
          >
            All
            <span className="chip-count">{everyone.length}</span>
          </Link>
          {departmentNames.map((name) => (
            <Link
              key={name}
              className="dept-chip"
              href={deptLink(name)}
              aria-current={dept === name ? "true" : undefined}
            >
              {name}
              <span className="chip-count">
                {everyone.filter((item) => departmentOf(item) === name).length}
              </span>
            </Link>
          ))}
        </nav>
      ) : null}

      <Gate show={viewPay}>
        {run ? (
          <p
            className={
              locked
                ? "banner positive"
                : critical.length
                  ? "banner attention"
                  : "banner"
            }
          >
            <Icon name={locked ? "lock" : "check-circle"} size={18} />
            <span>
              <strong>
                {month} is {locked ? "locked" : "processed"}
                {dept ? ` for ${dept}` : ""}.
              </strong>{" "}
              {payable.length} payable {payable.length === 1 ? "line" : "lines"}
              {held > 0 ? `, ${held} held for exceptions` : ""}.
            </span>
          </p>
        ) : (
          <p className="banner attention">
            <Icon name="info" size={18} />
            <span>
              <strong>{month} has not been processed.</strong> Gross,
              deductions, and net are not available until you process salary.
            </span>
            <Link className="button sm" href="/app/payroll">
              Process salary
            </Link>
          </p>
        )}
      </Gate>

      <section className="kpi-grid" aria-label={`Key figures for ${month}`}>
        <Gate show={viewEmployees}>
          <Kpi
            label="Employees"
            icon="users"
            href="/app/employees"
            value={active.length}
            note={
              viewPay && run
                ? `${payable.length} paid${held > 0 ? ` · ${held} held` : ""} of ${people.length} on record`
                : inactive > 0
                  ? `${inactive} left · ${people.length} on record`
                  : `${people.length} on record`
            }
          />
        </Gate>
        <Gate show={viewPay}>
          <Kpi
            label="Gross salary"
            icon="trend"
            value={run ? <Money paise={gross} /> : "—"}
            muted={!run}
            delta={run ? delta(gross, previous?.gross) : undefined}
            note={
              run
                ? delta(gross, previous?.gross)
                  ? undefined
                  : month
                : `Not processed for ${month}`
            }
          >
            <Sparkline values={spark((m) => m.gross)} color={SERIES.blue} />
          </Kpi>
          <Kpi
            label="Total deductions"
            icon="minus"
            tone="attention"
            value={run ? <Money paise={deductions} /> : "—"}
            muted={!run}
            delta={run ? delta(deductions, previous?.deductions) : undefined}
            note={
              run
                ? delta(deductions, previous?.deductions)
                  ? undefined
                  : month
                : `Not processed for ${month}`
            }
          >
            <Sparkline
              values={spark((m) => m.deductions)}
              color={SERIES.amber}
            />
          </Kpi>
          <Kpi
            label="Net salary"
            icon="wallet"
            tone="positive"
            value={run ? <Money paise={net} /> : "—"}
            muted={!run}
            delta={run ? delta(net, previous?.net) : undefined}
            note={
              run
                ? delta(net, previous?.net)
                  ? undefined
                  : month
                : `Not processed for ${month}`
            }
          >
            <Sparkline values={spark((m) => m.net)} color={SERIES.teal} />
          </Kpi>
          <Kpi
            label="Average net pay"
            icon="summary"
            value={
              run && totals.people > 0 ? <Money paise={averageNet} /> : "—"
            }
            muted={!run || totals.people === 0}
            delta={
              run && totals.people > 0
                ? delta(averageNet, previousAverage)
                : undefined
            }
            note={
              run
                ? `Per paid employee${scopeNote}`
                : `Not processed for ${month}`
            }
          />
        </Gate>
      </section>

      <div className="dash-grid dash-split">
        <Gate show={viewPay}>
          <section className="panel" aria-labelledby="g2n-title">
            <div className="panel-head">
              <div>
                <h2 id="g2n-title">Gross to net</h2>
                <p>
                  {run
                    ? `Where ${formatInr(gross)} of gross pay goes, ${month}${scopeNote}`
                    : month}
                </p>
              </div>
              <Link className="panel-link" href="/app/payroll/summary">
                Summary <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            {run && totals.people > 0 ? (
              <GrossToNet steps={steps} />
            ) : run ? (
              <Empty
                compact
                icon="wallet"
                title={`No payable lines for ${month}${scopeNote}.`}
                hint="Lines with a critical exception are held until it is resolved."
              />
            ) : (
              <Empty
                icon="wallet"
                title={`Process ${month} to see gross, deductions, and net.`}
                href="/app/payroll"
                label="Process salary"
              />
            )}
          </section>
        </Gate>

        <section
          className={alerts.length > 0 ? "panel attention-panel" : "panel"}
          aria-labelledby="attention-title"
        >
          <div className="panel-head">
            <div>
              <h2 id="attention-title">Needs attention</h2>
              <p>
                {alerts.length > 0
                  ? `${alerts.length} ${alerts.length === 1 ? "item" : "items"} for ${month}`
                  : `Nothing is waiting on ${month}`}
              </p>
            </div>
          </div>
          {alerts.length === 0 ? (
            <p className="all-clear">
              <Icon name="check-circle" size={20} />
              All clear. No open alerts for {month}.
            </p>
          ) : (
            <ul className="attention-list">
              {alerts.map((item) => (
                <li key={item.text}>
                  <Link
                    className={`attention-item ${item.tone}`}
                    href={item.href}
                  >
                    <Icon name={TONE_ICON[item.tone]} size={18} />
                    <span>{item.text}</span>
                    <Icon name="chevron-right" size={16} className="go" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Gate show={viewPay && (trendOn || insights.length > 0)}>
        <div className={trendOn ? "dash-grid dash-split" : "dash-grid"}>
          {trendOn ? (
            <section className="panel" aria-labelledby="trend-title">
              <div className="panel-head">
                <div>
                  <h2 id="trend-title">Payroll trend</h2>
                  <p>
                    {months.length} processed months{scopeNote}. Hover a month
                    for its figures and select it to open it.
                  </p>
                </div>
                <Link className="panel-link" href="/app/payroll/register">
                  Register <Icon name="arrow-right" size={14} />
                </Link>
              </div>
              <TrendExplorer
                current={period}
                onSelect={setPeriod}
                months={months.map((item) => ({
                  period: item.period,
                  label: shortPeriod(item.period),
                  longLabel: periodLabel(item.period),
                  gross: item.gross,
                  deductions: item.deductions,
                  net: item.net,
                  payable: item.payable,
                }))}
              />
            </section>
          ) : null}
          {insights.length > 0 || !trendOn ? (
            <section className="panel" aria-labelledby="insights-title">
              <div className="panel-head">
                <div>
                  <h2 id="insights-title">What the numbers say</h2>
                  <p>Worked out from the processed lines{scopeNote}</p>
                </div>
              </div>
              <ul className={trendOn ? "insights" : "insights wide"}>
                {insights.map((item) => (
                  <li key={item.text} className={`insight ${item.tone}`}>
                    <Icon name={INSIGHT_ICON[item.tone]} size={16} />
                    <span>
                      {item.text}
                      {item.href ? (
                        <>
                          {" "}
                          <Link href={item.href}>Open</Link>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
                {!trendOn ? (
                  <li className="insight info">
                    <Icon name="trend" size={16} />
                    <span>
                      {months.length === 1
                        ? `${periodLabel(months[0].period)} is the only processed month, so there is nothing to compare yet.`
                        : "No month is processed yet."}{" "}
                      A month-by-month trend appears once a second month is
                      processed. <Link href="/app/payroll">Open payroll</Link>
                    </span>
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}
        </div>
      </Gate>

      <div className="dash-grid dash-halves">
        <Gate show={viewPay}>
          <section className="panel" aria-labelledby="deduction-title">
            <div className="panel-head">
              <div>
                <h2 id="deduction-title">Where deductions go</h2>
                <p>{run ? `Payable lines, ${month}${scopeNote}` : month}</p>
              </div>
            </div>
            {run && deductions > 0 ? (
              <DeductionExplorer
                total={deductions}
                slipBase={slipBase}
                segments={parts.map((part) => ({
                  key: part.key,
                  name: part.name,
                  paise: part.paise,
                  color: PART_COLORS[part.key],
                  people: part.people,
                  note:
                    (part.key === "pf" && company?.pfEmployeePercent == null) ||
                    (part.key === "esi" && company?.esiEmployeePercent == null)
                      ? "Percent not set"
                      : part.key === "pt" && !company?.professionalTax
                        ? "Switched off"
                        : undefined,
                }))}
              />
            ) : run ? (
              <Empty
                compact
                icon="pie"
                title="No deductions on payable lines this month."
                hint="PF and ESI stay at zero until their percents are set under Company."
              />
            ) : (
              <Empty
                compact
                icon="pie"
                title="The deduction split appears after processing."
              />
            )}
          </section>
        </Gate>

        <Gate show={viewPay}>
          <section className="panel" aria-labelledby="dist-title">
            <div className="panel-head">
              <div>
                <h2 id="dist-title">
                  {bands ? "Net pay distribution" : "Pay by employee"}
                </h2>
                <p>
                  {run
                    ? bands
                      ? `${totals.people} paid employees grouped by net pay`
                      : "Net pay against gross for each paid employee"
                    : month}
                </p>
              </div>
            </div>
            {!run || stat.length === 0 ? (
              <Empty
                compact
                icon="table"
                title={
                  run
                    ? `No payable lines for ${month}${scopeNote}.`
                    : "Individual pay appears after this month is processed."
                }
              />
            ) : bands ? (
              <BandChart bands={bands} slipBase={slipBase} noun="Net pay" />
            ) : (
              <PairBars
                outer="Gross"
                inner="Net"
                rows={[...stat]
                  .sort((a, b) => b.netPaise - a.netPaise)
                  .map((line) => ({
                    id: line.employeeId,
                    name: line.name,
                    href: `/app/payroll/slips/${line.employeeId}`,
                    outer: line.grossPaise,
                    inner: line.netPaise,
                    tip: `${line.name}: net ${formatInr(line.netPaise)} of ${formatInr(line.grossPaise)} gross`,
                  }))}
              />
            )}
          </section>
        </Gate>
      </div>

      <div className="dash-grid dash-thirds">
        <Gate show={viewPay}>
          <section className="panel" aria-labelledby="dept-title">
            <div className="panel-head">
              <div>
                <h2 id="dept-title">Net pay by department</h2>
                <p>
                  {run
                    ? departmentPay.length > 1
                      ? "Select a department to filter the dashboard"
                      : `Payable lines, ${month}`
                    : month}
                </p>
              </div>
            </div>
            {departmentPay.length === 0 ? (
              <Empty
                compact
                icon="company"
                title="Department pay appears after this month is processed."
              />
            ) : (
              <BarList
                rows={departmentPay.map((row) => ({
                  name: row.name,
                  value: row.net,
                  label: `${compactInr(row.net)} · ${row.people}`,
                  href: viewEmployees ? deptLink(row.name) : undefined,
                  active: dept === row.name,
                  tip: `${row.name}: ${row.people} paid · gross ${formatInr(row.gross)} · net ${formatInr(row.net)} · average ${formatInr(row.averageNet)}`,
                }))}
              />
            )}
          </section>
        </Gate>

        <Gate show={viewPay}>
          <section className="panel" aria-labelledby="mix-title">
            <div className="panel-head">
              <div>
                <h2 id="mix-title">Salary mix</h2>
                <p>
                  {run ? `Gross split by earning, ${month}${scopeNote}` : month}
                </p>
              </div>
            </div>
            {run && gross > 0 ? (
              <Donut
                center={compactInr(gross)}
                caption="gross"
                format={formatInr}
                label={`Gross of ${formatInr(gross)} for ${month}: basic ${formatInr(totals.basic)}, DA ${formatInr(totals.da)}, other ${formatInr(totals.otherEarning)}.`}
                segments={[
                  { name: "Basic", value: totals.basic, color: SERIES.blue },
                  { name: "DA", value: totals.da, color: SERIES.teal },
                  {
                    name: "Other earnings",
                    value: totals.otherEarning,
                    color: SERIES.amber,
                  },
                ]}
              />
            ) : (
              <Empty
                compact
                icon="pie"
                title={
                  run
                    ? "No gross pay on payable lines."
                    : "The salary mix appears after processing."
                }
              />
            )}
          </section>
        </Gate>

        <Gate show={viewEmployees}>
          <section className="panel" aria-labelledby="strength-title">
            <div className="panel-head">
              <div>
                <h2 id="strength-title">Employee status</h2>
                <p>
                  As on {month}
                  {scopeNote}
                </p>
              </div>
              <Link className="panel-link" href="/app/employees">
                View all <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            {people.length === 0 ? (
              <Empty
                compact
                icon="users"
                title="No employees are on record for this company."
                href="/app/employees/new"
                label="Add employee"
              />
            ) : (
              <>
                <Donut
                  center={String(people.length)}
                  caption="employees"
                  label={`${active.length} active and ${inactive} inactive employees.`}
                  segments={[
                    {
                      name: "Active",
                      value: active.length,
                      color: SERIES.blue,
                    },
                    { name: "Left", value: inactive, color: SERIES.slate },
                  ]}
                />
                {strengthRows.length > 0 ? (
                  <div style={{ marginTop: "var(--space-4)" }}>
                    <BarList
                      rows={strengthRows.map(([name, row]) => ({
                        name,
                        value: row.active + row.inactive,
                        label: `${row.active + row.inactive}`,
                        href: deptLink(name),
                        active: dept === name,
                        tip: `${name}: ${row.active} active, ${row.inactive} left`,
                      }))}
                    />
                  </div>
                ) : null}
              </>
            )}
          </section>
        </Gate>
      </div>

      <div className="dash-grid dash-halves">
        <section className="panel" aria-labelledby="quick-title">
          <div className="panel-head">
            <div>
              <h2 id="quick-title">Quick actions</h2>
              <p>Frequently used payroll tasks</p>
            </div>
          </div>
          {quickShown.length === 0 ? (
            <p className="section-note">
              Your role has no actions on this dashboard.
            </p>
          ) : (
            <div className="quick-grid">
              {quickShown.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={item.primary ? "quick primary" : "quick"}
                >
                  <span className="kpi-icon">
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span>
                    {item.label}
                    <small>{item.hint}</small>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <Gate show={checklist.length > 0}>
          <section className="panel" aria-labelledby="checklist-title">
            <div className="panel-head">
              <div>
                <h2 id="checklist-title">Payroll checklist</h2>
                <p>{month}</p>
              </div>
              <span className="pill info">
                {stepsDone}/{checklist.length}
              </span>
            </div>
            <Meter
              value={stepsDone}
              max={checklist.length}
              tone={stepsDone === checklist.length ? "positive" : undefined}
              label={`${stepsDone} of ${checklist.length} complete`}
            />
            <ul className="steps">
              {checklist.map((step) => (
                <li key={step.name}>
                  <span className={step.done ? "step-mark done" : "step-mark"}>
                    <Icon name={step.done ? "check" : "clock"} size={13} />
                  </span>
                  <span>
                    {step.name}
                    <span className="sr-only">
                      {step.done ? ", done" : ", open"}
                    </span>
                  </span>
                  <span className="section-note">{step.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        </Gate>
      </div>

      <div className="dash-grid dash-thirds">
        <Gate show={viewMuster}>
          <section className="panel" aria-labelledby="attendance-title">
            <div className="panel-head">
              <div>
                <h2 id="attendance-title">Attendance</h2>
                <p>
                  Muster day totals for {month}
                  {scopeNote}
                </p>
              </div>
              <Link className="panel-link" href="/app/muster">
                Open <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            {muster.length === 0 ? (
              <Empty
                compact
                icon="calendar-check"
                title={`No muster is saved for ${month}.`}
                href="/app/muster"
                label="Open muster"
              />
            ) : (
              <>
                <Meter
                  value={muster.length}
                  max={Math.max(active.length, 1)}
                  tone={missingMuster.length === 0 ? "positive" : "attention"}
                  label={`${muster.length} of ${active.length} active employees have a muster · ${paidDays} paid days`}
                />
                <Columns
                  label={`Muster day counts for ${month}. Paid days ${paidDays}.`}
                  rows={attendanceParts.map((part, index) => ({
                    name: part.short,
                    value: part.value,
                    color: ATTENDANCE_COLORS[index % ATTENDANCE_COLORS.length],
                  }))}
                />
                {missingMuster.length > 0 ? (
                  <p className="section-note">
                    Still missing:{" "}
                    {missingMuster.map((item) => item.name).join(", ")}.
                  </p>
                ) : null}
              </>
            )}
          </section>
        </Gate>

        <Gate show={viewEmployees}>
          <section className="panel" aria-labelledby="pending-title">
            <div className="panel-head">
              <div>
                <h2 id="pending-title">Pending employee data</h2>
                <p>
                  Active employees with a blank field. Salary bank and PF bank
                  each need a bank name, IFSC, and account.
                </p>
              </div>
            </div>
            {people.length === 0 ? (
              <Empty
                compact
                icon="users"
                title="No employees are on record for this company."
                href="/app/employees/new"
                label="Add employee"
              />
            ) : (
              <>
                <ul className="count-list">
                  {pending.map((row) => (
                    <li key={row.id}>
                      <Link href={`/app/employees?missing=${row.id}`}>
                        <span>{row.label}</span>
                        <span
                          className={
                            row.count > 0
                              ? "count-pill warning"
                              : "count-pill ok"
                          }
                        >
                          {row.count}
                          <span className="sr-only">
                            {" "}
                            {row.count === 1 ? "employee" : "employees"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="section-note">
                  {pendingOpen === 0
                    ? "No active employee is missing these fields."
                    : `${activeToday} active ${activeToday === 1 ? "employee" : "employees"} on ${today}.`}
                </p>
              </>
            )}
          </section>
        </Gate>

        <Gate show={viewEmployees}>
          <section className="panel" aria-labelledby="events-title">
            <div className="panel-head">
              <div>
                <h2 id="events-title">Upcoming events</h2>
                <p>
                  Birthdays, joinings, and leavers in a 30-day window around
                  today.
                </p>
              </div>
            </div>
            {people.length === 0 ? (
              <Empty
                compact
                icon="gift"
                title="Events appear after employees are on record."
              />
            ) : (
              <>
                <ul className="count-list">
                  {events.map((row) => (
                    <li key={row.id}>
                      <Link href={`/app/employees?event=${row.id}`}>
                        <span>
                          {row.label}
                          {row.list.length > 0 ? (
                            <small
                              className="muted"
                              style={{ display: "block", fontSize: "12px" }}
                            >
                              {row.list
                                .slice(0, 3)
                                .map((person) => person.name)
                                .join(", ")}
                              {row.list.length > 3
                                ? ` +${row.list.length - 3} more`
                                : ""}
                            </small>
                          ) : null}
                        </span>
                        <span className="count-pill">
                          {row.list.length}
                          <span className="sr-only">
                            {" "}
                            {row.list.length === 1 ? "employee" : "employees"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {eventsOpen === 0 ? (
                  <p className="section-note">Nothing falls in this window.</p>
                ) : null}
              </>
            )}
          </section>
        </Gate>
      </div>

      <div className="dash-grid dash-halves">
        <Gate show={viewLeave}>
          <section className="panel" aria-labelledby="leave-title">
            <div className="panel-head">
              <div>
                <h2 id="leave-title">Leave balances</h2>
                <p>
                  {balances.length === 0
                    ? "No balances recorded"
                    : `${leaveDays} days remaining across ${balances.length} ${balances.length === 1 ? "balance" : "balances"}`}
                </p>
              </div>
              <Link className="panel-link" href="/app/leave">
                Open <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            {balances.length === 0 ? (
              <Empty
                compact
                icon="leave"
                title="No leave balances are recorded for this company."
                href="/app/leave"
                label="Open leave"
              />
            ) : (
              <BarList
                rows={leaveRows.map(([name, row]) => ({
                  name,
                  value: Math.max(row.days, 0),
                  label: `${row.days} days`,
                }))}
              />
            )}
          </section>
        </Gate>

        <Gate show={viewLoans}>
          <section className="panel" aria-labelledby="loans-title">
            <div className="panel-head">
              <div>
                <h2 id="loans-title">Loans and other deductions</h2>
                <p>
                  {loans.length} {loans.length === 1 ? "loan" : "loans"} · other
                  deductions saved for {month}:{" "}
                  <Money paise={otherDeductionPaise} />
                </p>
              </div>
              <Link className="panel-link" href="/app/loans">
                Open <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            {loans.length === 0 ? (
              <Empty
                compact
                icon="loan"
                title="No loans are recorded for this company."
                href="/app/loans"
                label="Open loans"
              />
            ) : (
              <BarList
                tone="attention"
                rows={[
                  {
                    name: "Outstanding",
                    value: loanBalance,
                    label: formatInr(loanBalance),
                  },
                  {
                    name: "Due this month",
                    value: loanDue,
                    label: formatInr(loanDue),
                  },
                ]}
              />
            )}
          </section>
        </Gate>
      </div>

      <div className="dash-grid">
        <Gate show={viewPay}>
          <section className="panel dash-wide" aria-labelledby="lines-title">
            <div className="panel-head">
              <div>
                <h2 id="lines-title">Payable lines</h2>
                <p>Gross, deductions, and net for each employee in {month}</p>
              </div>
              <Link className="panel-link" href="/app/payroll/register">
                Full register <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            {payRows.length === 0 ? (
              <Empty
                compact
                icon="table"
                title="Individual net pay appears after this month is processed."
              />
            ) : (
              <DataTable
                caption={`Payable lines for ${month}`}
                noun="employees"
                searchLabel="Search employees"
                facet={{ key: "department", label: "Departments" }}
                defaultSort={{ key: "net", dir: "desc" }}
                columns={[
                  { key: "code", label: "Code", sortable: true },
                  { key: "name", label: "Employee", sortable: true },
                  { key: "department", label: "Department", sortable: true },
                  {
                    key: "gross",
                    label: "Gross",
                    numeric: true,
                    sortable: true,
                  },
                  {
                    key: "deductions",
                    label: "Deductions",
                    numeric: true,
                    sortable: true,
                  },
                  { key: "net", label: "Net", numeric: true, sortable: true },
                ]}
                rows={payRows}
                totalsLabel="Total"
                totals={{
                  gross: <Money paise={gross} />,
                  deductions: <Money paise={deductions} />,
                  net: <Money paise={net} />,
                }}
              />
            )}
          </section>
        </Gate>

        <Gate show={viewPay}>
          <section className="panel dash-wide" aria-labelledby="months-title">
            <div className="panel-head">
              <div>
                <h2 id="months-title">Processed months</h2>
                <p>
                  Every month with a saved payroll run. Select a month to open
                  it.
                </p>
              </div>
            </div>
            {months.length === 0 ? (
              <Empty
                compact
                icon="calendar"
                title="No processed months are on record yet."
              />
            ) : (
              <DataTable
                caption="Processed months"
                noun="months"
                searchable={false}
                defaultSort={{ key: "period", dir: "desc" }}
                columns={[
                  { key: "month", label: "Month", sortable: true },
                  { key: "status", label: "Status" },
                  {
                    key: "payable",
                    label: "Payable",
                    numeric: true,
                    sortable: true,
                  },
                  {
                    key: "gross",
                    label: "Gross",
                    numeric: true,
                    sortable: true,
                  },
                  {
                    key: "deductions",
                    label: "Deductions",
                    numeric: true,
                    sortable: true,
                  },
                  { key: "net", label: "Net", numeric: true, sortable: true },
                ]}
                rows={months.map((item) => ({
                  id: item.period,
                  cells: {
                    month:
                      item.period === period ? (
                        <strong>{periodLabel(item.period)} · showing</strong>
                      ) : (
                        <form action={setPeriod}>
                          <input
                            type="hidden"
                            name="period"
                            value={item.period}
                          />
                          <input type="hidden" name="from" value="/app" />
                          <button type="submit" className="link-button">
                            {periodLabel(item.period)}
                          </button>
                        </form>
                      ),
                    status: (
                      <RunStatus
                        status={
                          store.locks.some(
                            (lock) =>
                              lock.companyId === session.companyId &&
                              lock.period === item.period,
                          )
                            ? "locked"
                            : item.status
                        }
                      />
                    ),
                    payable: item.payable,
                    gross: <Money paise={item.gross} />,
                    deductions: <Money paise={item.deductions} />,
                    net: <Money paise={item.net} />,
                  },
                  sort: {
                    month: item.period,
                    period: item.period,
                    payable: item.payable,
                    gross: item.gross,
                    deductions: item.deductions,
                    net: item.net,
                  },
                }))}
              />
            )}
          </section>
        </Gate>

        <Gate show={viewPay}>
          <section
            className="panel dash-wide"
            aria-labelledby="exceptions-title"
          >
            <div className="panel-head">
              <div>
                <h2 id="exceptions-title">Payroll exceptions</h2>
                <p>
                  {run
                    ? `${critical.length} critical, ${warnings.length} ${warnings.length === 1 ? "warning" : "warnings"}`
                    : month}
                </p>
              </div>
              <Link className="panel-link" href="/app/payroll">
                Review <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            {!run ? (
              <Empty
                compact
                icon="shield"
                title={`Process ${month} to see payroll exceptions.`}
              />
            ) : exceptions.length === 0 ? (
              <p className="all-clear">
                <Icon name="check-circle" size={20} />
                This payroll has no exceptions.
              </p>
            ) : (
              <div className="table-wrap stack-table">
                <table>
                  <caption className="sr-only">
                    {critical.length} critical, {warnings.length} warnings
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Employee</th>
                      <th scope="col">Severity</th>
                      <th scope="col">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.map((item) => (
                      <tr key={`${item.employeeId}-${item.code}`}>
                        <td data-label="Employee">
                          <Link href={`/app/employees/${item.employeeId}`}>
                            {item.name}
                          </Link>
                        </td>
                        <td data-label="Severity">
                          <span className={`pill ${item.severity}`}>
                            {item.severity === "critical"
                              ? "Critical"
                              : "Warning"}
                          </span>
                        </td>
                        <td data-label="Reason">{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </Gate>
      </div>

      <div className="dash-grid dash-halves">
        <Gate show={viewMasters}>
          <section className="panel" aria-labelledby="holidays-title">
            <div className="panel-head">
              <div>
                <h2 id="holidays-title">Holidays in {month}</h2>
                <p>From the holiday entry list</p>
              </div>
              <Link className="panel-link" href="/app/holidays">
                Open <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            {holidays.length === 0 ? (
              <Empty
                compact
                icon="calendar"
                title={`No holidays are saved for ${month}.`}
                href="/app/holidays"
                label="Add a holiday"
              />
            ) : (
              <ul className="task-list">
                {holidays.map((holiday) => (
                  <li key={holiday.id}>
                    <span>{holiday.description}</span>
                    <span className="section-note">
                      {holiday.date}
                      {holiday.date >= today ? " · Upcoming" : " · Passed"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Gate>

        <Gate show={viewControl}>
          <section className="panel" aria-labelledby="activity-title">
            <div className="panel-head">
              <div>
                <h2 id="activity-title">Recent payroll activity</h2>
                <p>The latest actions recorded for this company</p>
              </div>
              <Link className="panel-link" href="/app/control">
                Audit <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            {activity.length === 0 ? (
              <Empty
                compact
                icon="clock"
                title="No payroll actions have been recorded yet."
              />
            ) : (
              <ul className="activity-list timeline">
                {activity.map((item) => (
                  <li key={item.id}>
                    <span className="timeline-dot" aria-hidden="true" />
                    <span style={{ flex: 1 }}>
                      {item.action}
                      <small
                        className="muted"
                        style={{ display: "block", fontSize: "12px" }}
                      >
                        {item.actor} · {when(item.at)}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Gate>
      </div>
    </div>
  );
}
