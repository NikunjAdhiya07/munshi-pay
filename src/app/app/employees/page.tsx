import Link from "next/link";
import { Empty, Flash, Origin, PageHeader } from "../../../components/ui";
import {
  eventKind,
  eventLabel,
  filterDashboardPeople,
  pendingField,
  pendingLabel,
  todayInKolkata,
} from "../../../domain/dashboard";
import {
  employment,
  matchesEmployment,
  pageOf,
  pageSize,
  type SortKey,
  sortDir,
  sortEmployees,
  sortKey,
} from "../../../domain/employees";
import { can, canExport } from "../../../server/access";
import { removeEmployee } from "../../../server/actions";
import { requireView } from "../../../server/auth";
import { readStore } from "../../../server/store";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "department", label: "Department" },
  { key: "designation", label: "Designation" },
  { key: "birthDate", label: "Birth date" },
  { key: "joinDate", label: "Join date" },
  { key: "leftDate", label: "Left date" },
  { key: "uan", label: "UAN" },
  { key: "pfNumber", label: "PF number" },
  { key: "esiNumber", label: "ESI number" },
];

function listQuery(params: {
  q?: string;
  page?: number;
  missing?: string;
  event?: string;
  status?: string;
  sort?: string;
  dir?: string;
  size?: number;
  kind?: string;
  confirm?: string;
}): string {
  const search = new URLSearchParams();
  if (params.kind) search.set("kind", params.kind);
  if (params.q) search.set("q", params.q);
  if (params.missing) search.set("missing", params.missing);
  if (params.event) search.set("event", params.event);
  if (params.status && params.status !== "all")
    search.set("status", params.status);
  if (params.sort && params.sort !== "code") search.set("sort", params.sort);
  if (params.dir === "desc") search.set("dir", params.dir);
  if (params.size && params.size !== 10)
    search.set("size", String(params.size));
  if (params.page && params.page > 1) search.set("page", String(params.page));
  if (params.confirm) search.set("confirm", params.confirm);
  const text = search.toString();
  return text ? `?${text}` : "";
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    missing?: string;
    event?: string;
    status?: string;
    sort?: string;
    dir?: string;
    size?: string;
    confirm?: string;
    notice?: string;
    error?: string;
  }>;
}) {
  const session = await requireView("employees");
  const query = await searchParams;
  const q = (query.q ?? "").toLowerCase();
  const page = Math.max(1, Number(query.page ?? "1") || 1);
  const missing = pendingField(query.missing);
  const event = eventKind(query.event);
  const status = employment(query.status);
  const key = sortKey(query.sort);
  const dir = sortDir(query.dir);
  const size = pageSize(query.size);
  const today = todayInKolkata();
  const store = readStore();
  const allowDelete = can(session.role, store.rights, "employees", "delete");
  const allowExport = canExport(session.role, store.rights, "employees");
  const companyPeople = store.employees.filter(
    (item) => item.companyId === session.companyId,
  );
  const people = sortEmployees(
    filterDashboardPeople(companyPeople, session.companyId, today, {
      missing,
      event,
    })
      .filter((item) => matchesEmployment(item, status, today))
      .filter((item) =>
        `${item.code} ${item.name} ${item.department}`
          .toLowerCase()
          .includes(q),
      ),
    key,
    dir,
  );
  const filterLabel = missing
    ? `Missing ${pendingLabel(missing)}`
    : event
      ? eventLabel(event)
      : "";
  const slice = pageOf(people, page, size);
  const pages = Math.max(1, Math.ceil(people.length / size));
  const queryBase = {
    q: query.q,
    missing: missing ?? undefined,
    event: event ?? undefined,
    status,
    sort: key,
    dir,
    size,
  };
  const pendingDelete = companyPeople.find((item) => item.id === query.confirm);
  const inRun = pendingDelete
    ? store.runs.some(
        (run) =>
          run.companyId === session.companyId &&
          run.lines.some((line) => line.employeeId === pendingDelete.id),
      )
    : false;

  return (
    <>
      <PageHeader
        title="Employees"
        lede={
          filterLabel
            ? `${people.length} employees · ${filterLabel}`
            : `${people.length} records in this company.`
        }
        action={
          <Link className="button" href="/app/employees/new">
            Add employee
          </Link>
        }
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />
      {pendingDelete && allowDelete ? (
        <form
          className="panel form-measure"
          action={removeEmployee}
          aria-labelledby="delete-title"
        >
          <h2 id="delete-title">Delete {pendingDelete.name}</h2>
          <input type="hidden" name="id" value={pendingDelete.id} />
          {inRun ? (
            <p>
              {pendingDelete.name} is in a processed payroll. Set the left date
              on the profile instead of deleting the record.
            </p>
          ) : (
            <>
              <p>
                This removes {pendingDelete.name} ({pendingDelete.code}) and the
                muster, loans, deductions, and leave rows for that person. A
                processed payroll cannot be deleted this way.
              </p>
              <label>
                <span>Type {pendingDelete.code} to confirm</span>
                <input name="code" autoComplete="off" />
              </label>
              <button type="submit" className="danger">
                Delete employee
              </button>
            </>
          )}
          <p>
            <Link
              href={`/app/employees${listQuery({ ...queryBase, page })}`}
              className="button quiet"
            >
              Cancel
            </Link>{" "}
            <Link href={`/app/employees/${pendingDelete.id}`}>
              Open the profile
            </Link>
          </p>
        </form>
      ) : null}
      <div className="row-actions">
        <form>
          <label>
            <span>Search</span>
            <input
              name="q"
              defaultValue={query.q ?? ""}
              placeholder="Code, name, department"
            />
          </label>
          <label>
            <span>Employment</span>
            <select name="status" defaultValue={status}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="left">Left</option>
            </select>
          </label>
          <label>
            <span>Rows</span>
            <select name="size" defaultValue={String(size)}>
              {[10, 25, 50, 100, 500].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {missing ? (
            <input type="hidden" name="missing" value={missing} />
          ) : null}
          {event ? <input type="hidden" name="event" value={event} /> : null}
          {key !== "code" ? (
            <input type="hidden" name="sort" value={key} />
          ) : null}
          {dir === "desc" ? (
            <input type="hidden" name="dir" value="desc" />
          ) : null}
          <button type="submit" className="quiet">
            Search
          </button>
        </form>
        {allowExport ? (
          <a
            className="button quiet"
            href={`/app/export${listQuery({
              kind: "employees",
              q: query.q,
              missing: missing ?? undefined,
              event: event ?? undefined,
              status,
            })}`}
          >
            Export
          </a>
        ) : null}
      </div>
      {filterLabel ? (
        <p className="section-note">
          {filterLabel}.{" "}
          <Link href="/app/employees">Show everyone in this company</Link>
        </p>
      ) : null}
      {slice.length === 0 ? (
        <Empty
          title={
            companyPeople.length === 0
              ? "No employees match. Add an employee to start a payroll record."
              : filterLabel
                ? `No employees match ${filterLabel}.`
                : "No employees match that search."
          }
          href={
            companyPeople.length === 0 ? "/app/employees/new" : "/app/employees"
          }
          label={companyPeople.length === 0 ? "Add employee" : "Show everyone"}
        />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <caption>{filterLabel || "Employees in this company"}</caption>
              <thead>
                <tr>
                  {COLUMNS.map((column) => {
                    const nextDir =
                      key === column.key && dir === "asc" ? "desc" : "asc";
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={
                          key === column.key
                            ? dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <Link
                          href={`/app/employees${listQuery({
                            ...queryBase,
                            sort: column.key,
                            dir: nextDir,
                            page: 1,
                          })}`}
                        >
                          {column.label}
                        </Link>
                      </th>
                    );
                  })}
                  {allowDelete ? (
                    <th scope="col" className="end">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {slice.map((employee) => (
                  <tr key={employee.id}>
                    <td className="figures">{employee.code}</td>
                    <td>
                      <Link href={`/app/employees/${employee.id}`}>
                        {employee.name}
                      </Link>
                    </td>
                    <td>{employee.department}</td>
                    <td>{employee.designation}</td>
                    <td>{employee.birthDate || "—"}</td>
                    <td>{employee.joinDate}</td>
                    <td>{employee.leftDate || "—"}</td>
                    <td className="figures">{employee.uan || "—"}</td>
                    <td className="figures">{employee.pfNumber || "—"}</td>
                    <td className="figures">{employee.esiNumber || "—"}</td>
                    {allowDelete ? (
                      <td className="end">
                        <Link
                          className="danger-link"
                          href={`/app/employees${listQuery({
                            ...queryBase,
                            page,
                            confirm: employee.id,
                          })}`}
                        >
                          Delete
                        </Link>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cards">
            {slice.map((employee) => (
              <div key={employee.id} className="card-row">
                <Link href={`/app/employees/${employee.id}`}>
                  <strong>{employee.name}</strong>
                  <div className="figures">{employee.code}</div>
                  <div>
                    {employee.department} ·{" "}
                    {employee.leftDate ? `Left ${employee.leftDate}` : "Active"}
                  </div>
                  <div>
                    UAN {employee.uan || "—"} · PF {employee.pfNumber || "—"} ·
                    ESI {employee.esiNumber || "—"}
                  </div>
                </Link>
                {allowDelete ? (
                  <Link
                    href={`/app/employees${listQuery({
                      ...queryBase,
                      page,
                      confirm: employee.id,
                    })}`}
                  >
                    Delete {employee.code}
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}
      <nav className="pager" aria-label="Employee pages">
        <span>
          Page {page} of {pages} · {people.length}{" "}
          {people.length === 1 ? "employee" : "employees"}
        </span>
        <span className="pager-controls">
          {page > 1 ? (
            <Link
              className="button quiet sm"
              href={`/app/employees${listQuery({ ...queryBase, page: page - 1 })}`}
            >
              Previous
            </Link>
          ) : null}
          {page < pages ? (
            <Link
              className="button quiet sm"
              href={`/app/employees${listQuery({ ...queryBase, page: page + 1 })}`}
            >
              Next
            </Link>
          ) : null}
        </span>
      </nav>
    </>
  );
}
