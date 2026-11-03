import {
  Empty,
  Flash,
  Money,
  Origin,
  PageHeader,
  periodLabel,
} from "../../../../components/ui";
import { plainRupees } from "../../../../domain/money";
import { saveLine } from "../../../../server/actions";
import { currentPeriod, requireView } from "../../../../server/auth";
import { readStore } from "../../../../server/store";

export default async function EntryPage({
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
  return (
    <>
      <PageHeader
        title="Salary entry"
        lede={
          locked
            ? `${periodLabel(period)} is locked. Lines cannot be edited.`
            : `${periodLabel(period)}. Adjust a payable line and the engine recalculates net.`
        }
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />
      {!run ? (
        <Empty
          title={`Process ${periodLabel(period)} before editing lines.`}
          href="/app/payroll"
          label="Process salary"
        />
      ) : null}
      <div className="table-wrap stack-table">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th className="num">Gross</th>
              <th className="num">Deductions</th>
              <th className="num">Net</th>
              <th>Adjustment</th>
            </tr>
          </thead>
          <tbody>
            {run?.lines
              .filter((line) => line.payable)
              .map((line) => {
                const person = people.find(
                  (item) => item.id === line.employeeId,
                );
                return (
                  <tr key={line.employeeId}>
                    <td data-label="Employee">{person?.name}</td>
                    <td className="num" data-label="Gross">
                      <Money paise={line.grossPaise} />
                    </td>
                    <td className="num" data-label="Deductions">
                      <Money paise={line.deductionPaise} />
                    </td>
                    <td className="num" data-label="Net">
                      <Money paise={line.netPaise} />
                    </td>
                    <td data-label="Adjustment">
                      <form action={saveLine} className="row-actions">
                        <input
                          type="hidden"
                          name="employeeId"
                          value={line.employeeId}
                        />
                        <input
                          name="earning"
                          aria-label={`Earning adjustment for ${person?.name}`}
                          defaultValue={plainRupees(
                            line.earningAdjustmentPaise,
                          )}
                          disabled={locked}
                        />
                        <input
                          name="deduction"
                          aria-label={`Deduction adjustment for ${person?.name}`}
                          defaultValue={plainRupees(
                            line.deductionAdjustmentPaise,
                          )}
                          disabled={locked}
                        />
                        <button type="submit" disabled={locked}>
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </>
  );
}
