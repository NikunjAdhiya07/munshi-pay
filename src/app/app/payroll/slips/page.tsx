import Link from "next/link";
import {
  Empty,
  Money,
  Origin,
  PageHeader,
  periodLabel,
} from "../../../../components/ui";
import { currentPeriod, requireView } from "../../../../server/auth";
import { buildSlips } from "../../../../server/slips";
import { readStore } from "../../../../server/store";

export default async function SlipsPage() {
  const session = await requireView("payroll");
  const period = await currentPeriod();
  const store = readStore();
  const slips = buildSlips(store, session.companyId, period, null);
  return (
    <>
      <PageHeader
        title="Salary slips"
        lede={periodLabel(period)}
        action={
          slips.length > 0 ? (
            <a className="button" href="/app/payroll/slips/print?all=1">
              Print all slips
            </a>
          ) : undefined
        }
      />
      <Origin />
      {slips.length === 0 ? (
        <Empty
          title={`Process ${periodLabel(period)} to open slips.`}
          href="/app/payroll"
          label="Process salary"
        />
      ) : (
        <form action="/app/payroll/slips/print" method="get">
          <div className="table-wrap stack-table">
            <table>
              <caption className="sr-only">
                Salary slips for {periodLabel(period)}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Print</th>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col" className="num">
                    Net pay
                  </th>
                  <th scope="col">Slip</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((slip) => (
                  <tr key={slip.employeeId}>
                    <td data-label="Print">
                      <label className="check">
                        <input
                          type="checkbox"
                          name="e"
                          value={slip.employeeId}
                        />
                        <span className="sr-only">
                          Print the slip for {slip.employee.name}
                        </span>
                      </label>
                    </td>
                    <td className="figures" data-label="Code">
                      {slip.employee.code}
                    </td>
                    <td data-label="Name">{slip.employee.name}</td>
                    <td className="num" data-label="Net pay">
                      <Money paise={slip.netPaise} />
                    </td>
                    <td data-label="Slip">
                      <Link
                        href={`/app/payroll/slips/${slip.employeeId}`}
                        aria-label={`Open the slip for ${slip.employee.name}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="help">
            Tick the employees to print, then print the selected slips. Print
            all slips prints everyone for the month.
          </p>
          <p>
            <button type="submit">Print selected slips</button>
          </p>
        </form>
      )}
    </>
  );
}
