import type { Slip, SlipLine } from "../server/slips";
import { Money, periodLabel, RunStatus } from "./ui";

function Lines({
  title,
  lines,
  totalLabel,
  totalPaise,
}: {
  title: string;
  lines: SlipLine[];
  totalLabel: string;
  totalPaise: number;
}) {
  return (
    <table className="slip-table">
      <caption>{title}</caption>
      <tbody>
        {lines.map((item) => (
          <tr key={item.label}>
            <th scope="row">{item.label}</th>
            <td className="num">
              <Money paise={item.paise} />
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">{totalLabel}</th>
          <td className="num">
            <Money paise={totalPaise} />
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

/**
 * One salary slip. The same markup is shown on screen and printed, so what a
 * person reads is what they get on paper. Money is text, never an image.
 */
export function SlipSheet({ slip, origin }: { slip: Slip; origin: string }) {
  const headingId = `slip-${slip.employeeId}`;
  const fact = (label: string, value: string) => (
    <div>
      <dt>{label}</dt>
      <dd>{value || "Not set"}</dd>
    </div>
  );
  return (
    <article className="slip-sheet" aria-labelledby={headingId}>
      <header className="slip-head">
        <h2 id={headingId}>{slip.company.name}</h2>
        {slip.company.state ? <p>{slip.company.state}</p> : null}
        <p>Salary slip for {periodLabel(slip.period)}</p>
      </header>
      <dl className="slip-facts">
        {fact("Employee code", slip.employee.code)}
        {fact("Name", slip.employee.name)}
        {fact("Designation", slip.employee.designation)}
        {fact("Department", slip.employee.department)}
        {fact("Payment method", slip.paymentMethod)}
        {fact(
          "Paid days",
          slip.paidDays === null ? "Not recorded" : String(slip.paidDays),
        )}
      </dl>
      <div className="slip-columns">
        <Lines
          title="Earnings"
          lines={slip.earnings}
          totalLabel="Gross"
          totalPaise={slip.grossPaise}
        />
        <Lines
          title="Deductions"
          lines={slip.deductions}
          totalLabel="Total deductions"
          totalPaise={slip.totalDeductionsPaise}
        />
      </div>
      <p className="slip-net">
        <span>Net pay</span>
        <Money paise={slip.netPaise} />
      </p>
      <footer className="slip-foot">
        Payroll run: <RunStatus status={slip.runStatus} />. Data: {origin}.
      </footer>
    </article>
  );
}
