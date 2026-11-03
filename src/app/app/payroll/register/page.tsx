import Link from "next/link";
import {
  Empty,
  Money,
  Origin,
  PageHeader,
  periodLabel,
} from "../../../../components/ui";
import { canExport } from "../../../../server/access";
import { currentPeriod, requireView } from "../../../../server/auth";
import { readStore } from "../../../../server/store";

export default async function RegisterPage() {
  const session = await requireView("payroll");
  const period = await currentPeriod();
  const store = readStore();
  const run = store.runs.find(
    (item) => item.companyId === session.companyId && item.period === period,
  );
  const people = store.employees.filter(
    (item) => item.companyId === session.companyId,
  );
  const lines = run?.lines.filter((line) => line.payable) ?? [];
  return (
    <>
      <PageHeader
        title="Salary register"
        lede={periodLabel(period)}
        action={
          canExport(session.role, store.rights, "payroll") ? (
            <a className="button quiet" href="/app/export?kind=register">
              Export CSV
            </a>
          ) : undefined
        }
      />
      <Origin />
      {lines.length === 0 ? (
        <Empty
          title={`No payable lines for ${periodLabel(period)}.`}
          href="/app/payroll"
          label="Process salary"
        />
      ) : null}
      <div className="table-wrap stack-table">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th className="num">Basic</th>
              <th className="num">DA</th>
              <th className="num">Gross</th>
              <th className="num">PF</th>
              <th className="num">ESI</th>
              <th className="num">PT</th>
              <th className="num">Deductions</th>
              <th className="num">Net</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const person = people.find((item) => item.id === line.employeeId);
              return (
                <tr key={line.employeeId}>
                  <td className="figures" data-label="Code">
                    {person?.code}
                  </td>
                  <td data-label="Name">
                    <Link href={`/app/payroll/slips/${line.employeeId}`}>
                      {person?.name}
                    </Link>
                  </td>
                  <td className="num" data-label="Basic">
                    <Money paise={line.basicPaise} />
                  </td>
                  <td className="num" data-label="DA">
                    <Money paise={line.daPaise} />
                  </td>
                  <td className="num" data-label="Gross">
                    <Money paise={line.grossPaise} />
                  </td>
                  <td className="num" data-label="PF">
                    <Money paise={line.pfPaise} />
                  </td>
                  <td className="num" data-label="ESI">
                    <Money paise={line.esiPaise} />
                  </td>
                  <td className="num" data-label="PT">
                    <Money paise={line.ptPaise} />
                  </td>
                  <td className="num" data-label="Deductions">
                    <Money paise={line.deductionPaise} />
                  </td>
                  <td className="num" data-label="Net">
                    <Money paise={line.netPaise} />
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
