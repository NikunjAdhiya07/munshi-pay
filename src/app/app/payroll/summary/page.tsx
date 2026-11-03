import {
  Empty,
  Money,
  Origin,
  PageHeader,
  periodLabel,
  RunStatus,
} from "../../../../components/ui";
import { currentPeriod, requireView } from "../../../../server/auth";
import { readStore } from "../../../../server/store";

export default async function SummaryPage() {
  const session = await requireView("payroll");
  const period = await currentPeriod();
  const run = readStore().runs.find(
    (item) => item.companyId === session.companyId && item.period === period,
  );
  const lines = run?.lines.filter((line) => line.payable) ?? [];
  const sum = (pick: (line: (typeof lines)[number]) => number) =>
    lines.reduce((total, line) => total + pick(line), 0);
  const rows = [
    ["Strength", String(lines.length)],
    ["Basic", sum((line) => line.basicPaise)],
    ["DA", sum((line) => line.daPaise)],
    ["Other earnings", sum((line) => line.otherEarningPaise)],
    ["Gross", sum((line) => line.grossPaise)],
    ["PF", sum((line) => line.pfPaise)],
    ["ESI", sum((line) => line.esiPaise)],
    ["PT", sum((line) => line.ptPaise)],
    ["Other deductions", sum((line) => line.otherDeductionPaise)],
    ["Loan", sum((line) => line.loanPaise)],
    ["Deductions", sum((line) => line.deductionPaise)],
    ["Net", sum((line) => line.netPaise)],
  ] as const;
  return (
    <>
      <PageHeader
        title="Salary summary"
        lede={periodLabel(period)}
        action={<RunStatus status={run?.status ?? null} />}
      />
      <Origin />
      {!run ? (
        <Empty
          title={`${periodLabel(period)} has not been processed.`}
          href="/app/payroll"
          label="Process salary"
        />
      ) : (
        <div className="table-wrap stack-table">
          <table>
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <th data-label="Item">{label}</th>
                  <td className="num" data-label={label}>
                    {typeof value === "number" ? (
                      <Money paise={value} />
                    ) : (
                      value
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
