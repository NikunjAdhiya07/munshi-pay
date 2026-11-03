import {
  Empty,
  Flash,
  Origin,
  PageHeader,
  periodLabel,
} from "../../../components/ui";
import { saveMuster } from "../../../server/actions";
import { currentPeriod, requireView } from "../../../server/auth";
import { holidaysInPeriod } from "../../../server/holidays";
import { isLocked } from "../../../server/payroll";
import { readStore } from "../../../server/store";

export default async function MusterPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requireView("muster");
  const period = await currentPeriod();
  const query = await searchParams;
  const store = readStore();
  const locked = isLocked(store, session.companyId, period);
  const listedHolidays = holidaysInPeriod(store, session.companyId, period);
  const people = store.employees.filter(
    (item) => item.companyId === session.companyId,
  );
  return (
    <>
      <PageHeader
        title="Monthly muster"
        lede={
          locked
            ? `${periodLabel(period)} is locked. Attendance cannot be edited.`
            : `${periodLabel(period)}. Paid days are used for per-day wages. Week off, public holiday, comp off, and on duty are stored. Public holiday starts at the ${listedHolidays} ${listedHolidays === 1 ? "date" : "dates"} in Holiday entry until a row is saved.`
        }
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />
      {people.length === 0 ? (
        <Empty
          title="Add an employee before entering attendance."
          href="/app/employees/new"
          label="Add employee"
        />
      ) : (
        <form action={saveMuster}>
          <fieldset className="plain-fieldset" disabled={locked}>
            <ul className="muster-list">
              {people.map((employee) => {
                const row = store.muster.find(
                  (item) =>
                    item.employeeId === employee.id && item.period === period,
                );
                return (
                  <li key={employee.id}>
                    <strong>{employee.name}</strong>
                    <span className="section-note figures">
                      {employee.code}
                    </span>
                    <div className="muster-fields">
                      <label>
                        <span>Paid days</span>
                        <input
                          name={`paid-${employee.id}`}
                          inputMode="decimal"
                          defaultValue={row?.paidDays ?? 0}
                        />
                      </label>
                      <label>
                        <span>Week off</span>
                        <input
                          name={`wo-${employee.id}`}
                          inputMode="decimal"
                          defaultValue={row?.weekOff ?? 0}
                        />
                      </label>
                      <label>
                        <span>Public holiday</span>
                        <input
                          name={`ph-${employee.id}`}
                          inputMode="decimal"
                          defaultValue={row?.publicHoliday ?? listedHolidays}
                        />
                      </label>
                      <label>
                        <span>Comp off</span>
                        <input
                          name={`cf-${employee.id}`}
                          inputMode="decimal"
                          defaultValue={row?.compOff ?? 0}
                        />
                      </label>
                      <label>
                        <span>On duty</span>
                        <input
                          name={`od-${employee.id}`}
                          inputMode="decimal"
                          defaultValue={row?.onDuty ?? 0}
                        />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p>
              <button type="submit">Save muster</button>
            </p>
          </fieldset>
        </form>
      )}
    </>
  );
}
