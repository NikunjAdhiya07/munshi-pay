import Link from "next/link";
import {
  Empty,
  Flash,
  Origin,
  PageHeader,
  periodLabel,
} from "../../../components/ui";
import { can } from "../../../server/access";
import { removeHoliday, saveHoliday } from "../../../server/actions";
import { currentPeriod, requireView } from "../../../server/auth";
import {
  holidaysInPeriod,
  holidayYears,
  searchHolidays,
} from "../../../server/holidays";
import { readStore } from "../../../server/store";

type Query = {
  notice?: string;
  error?: string;
  delete?: string;
  q?: string;
  filterYear?: string;
  date?: string;
  year?: string;
  description?: string;
};

function weekday(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const session = await requireView("masters");
  const period = await currentPeriod();
  const query = await searchParams;
  const store = readStore();
  const company = session.companyId;
  const canAdd = can(session.role, store.rights, "masters", "add");
  const canDelete = can(session.role, store.rights, "masters", "delete");
  const years = holidayYears(store, company);
  const filterYear = /^\d{4}$/.test(query.filterYear ?? "")
    ? query.filterYear
    : undefined;
  const text = query.q?.trim() ?? "";
  const all = searchHolidays(store, company, {});
  const rows = searchHolidays(store, company, { year: filterYear, text });
  const deleting =
    query.delete && canDelete
      ? all.find((item) => item.id === query.delete)
      : undefined;
  const inMonth = holidaysInPeriod(store, company, period);
  // After a refused save the form shows what the person typed.
  const draft = {
    date: query.date ?? "",
    year: query.year ?? period.slice(0, 4),
    description: query.description ?? "",
  };

  return (
    <>
      <PageHeader
        title="Holiday entry"
        lede={`Company holidays. ${periodLabel(period)} has ${inMonth} listed ${inMonth === 1 ? "holiday" : "holidays"}, which the monthly muster uses as the starting public-holiday count.`}
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />

      {deleting ? (
        <section className="panel form-measure" aria-labelledby="delete-title">
          <h2 id="delete-title">
            Delete the holiday on {deleting.date}
            {deleting.description ? `, ${deleting.description}` : ""}?
          </h2>
          <p className="help">
            The date is removed from the list. Muster rows already saved keep
            their public-holiday count. This cannot be undone.
          </p>
          <form action={removeHoliday} className="row-actions">
            <input type="hidden" name="id" value={deleting.id} />
            <button type="submit">Delete holiday</button>
            <Link className="button quiet" href="/app/holidays">
              Keep holiday
            </Link>
          </form>
        </section>
      ) : null}

      {canAdd ? (
        <section className="panel form-measure" aria-labelledby="form-title">
          <h2 id="form-title">Add holiday</h2>
          <form action={saveHoliday}>
            <label>
              <span>Date</span>
              <input
                name="date"
                type="date"
                defaultValue={draft.date}
                required
              />
            </label>
            <label>
              <span>Year</span>
              <input
                name="year"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                defaultValue={draft.year}
                aria-describedby="year-help"
                required
              />
            </label>
            <p className="help" id="year-help">
              The holiday list the date belongs to, as four digits.
            </p>
            <label>
              <span>Description (optional)</span>
              <input
                name="description"
                maxLength={60}
                defaultValue={draft.description}
              />
            </label>
            <button type="submit">Add holiday</button>
          </form>
        </section>
      ) : null}

      <section aria-labelledby="list-title">
        <h2 id="list-title">Holiday list</h2>
        <search>
          <form className="row-actions" action="/app/holidays">
            <label>
              <span>Year</span>
              <select name="filterYear" defaultValue={filterYear ?? ""}>
                <option value="">All years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Search date or description</span>
              <input name="q" type="search" defaultValue={text} />
            </label>
            <button type="submit" className="quiet">
              Search
            </button>
            {filterYear || text ? (
              <Link className="button quiet" href="/app/holidays">
                Clear
              </Link>
            ) : null}
          </form>
        </search>

        {all.length === 0 ? (
          <Empty
            title={`No holidays are saved for this company.${canAdd ? " Add one with the form above." : ""}`}
          />
        ) : rows.length === 0 ? (
          <Empty title="No holidays match this search." />
        ) : (
          <div className="table-wrap stack-table">
            <table>
              <caption className="sr-only">
                Holiday list, {rows.length} of {all.length}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Day</th>
                  <th scope="col">Year</th>
                  <th scope="col">Description</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td className="figures" data-label="Date">
                      {item.date}
                    </td>
                    <td data-label="Day">{weekday(item.date)}</td>
                    <td className="figures" data-label="Year">
                      {item.year}
                    </td>
                    <td data-label="Description">
                      {item.description || "No description"}
                    </td>
                    <td data-label="Actions">
                      {canDelete ? (
                        <Link
                          className="button quiet"
                          href={`/app/holidays?delete=${item.id}`}
                          aria-label={`Delete holiday on ${item.date}`}
                        >
                          Delete
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
