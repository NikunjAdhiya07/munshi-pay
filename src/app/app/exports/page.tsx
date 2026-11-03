import {
  Empty,
  Flash,
  Origin,
  PageHeader,
  periodLabel,
} from "../../../components/ui";
import { canExport } from "../../../server/access";
import { currentPeriod, requireView } from "../../../server/auth";
import {
  EMPLOYEE_COLUMNS,
  EXPORTS,
  type ExportDef,
  SALARY_COLUMNS,
} from "../../../server/exports";
import { readStore } from "../../../server/store";

type Query = {
  error?: string;
  export?: string;
  month?: string;
  col?: string | string[];
};

const DEFAULT_PICK: Record<string, string[]> = {
  "custom-employees": ["code", "name", "department", "designation"],
  "custom-salary": ["code", "name", "gross", "deduction", "net"],
};

function ExportForm({
  def,
  period,
  query,
}: {
  def: ExportDef;
  period: string;
  query: Query;
}) {
  const returned = query.export === def.slug;
  const month = returned && query.month ? query.month : period;
  const chosen = returned
    ? [query.col ?? []].flat()
    : (DEFAULT_PICK[def.slug] ?? []);
  const catalog =
    def.slug === "custom-salary" ? SALARY_COLUMNS : EMPLOYEE_COLUMNS;
  const titleId = `${def.slug}-title`;
  return (
    <form
      id={def.slug}
      className="panel"
      method="get"
      action="/app/exports/download"
      aria-labelledby={titleId}
    >
      <input type="hidden" name="export" value={def.slug} />
      <h2 id={titleId}>{def.title}</h2>
      <p className="help">{def.note}</p>
      {def.month ? (
        <label>
          <span>Month</span>
          <input
            name="month"
            type="month"
            defaultValue={month}
            required
            aria-describedby={`${def.slug}-month-help`}
          />
          <span className="help" id={`${def.slug}-month-help`}>
            Defaults to {periodLabel(period)}, the month in the header.
          </span>
        </label>
      ) : null}
      {def.custom ? (
        <fieldset className="plain-fieldset">
          <legend>Columns</legend>
          <div className="grid-2">
            {catalog.map((column) => (
              <label key={column.key} className="check">
                <input
                  type="checkbox"
                  name="col"
                  value={column.key}
                  defaultChecked={chosen.includes(column.key)}
                />
                {column.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <button type="submit">Download .xlsx</button>
    </form>
  );
}

export default async function ExportsPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const session = await requireView("export");
  const period = await currentPeriod();
  const query = await searchParams;
  const store = readStore();
  const allowed = EXPORTS.filter((def) =>
    canExport(session.role, store.rights, def.menu),
  );
  return (
    <>
      <PageHeader
        title="Export Excel"
        lede="Download this company's records as Excel workbooks. Amounts are in rupees with two decimals. Bank account, PAN, and Aadhaar numbers are not exported."
      />
      <Flash error={query.error} />
      <Origin />
      {allowed.length === 0 ? (
        <Empty title="Your role cannot export data." />
      ) : (
        <div className="grid-2">
          {allowed.map((def) => (
            <ExportForm
              key={def.slug}
              def={def}
              period={period}
              query={query}
            />
          ))}
        </div>
      )}
    </>
  );
}
