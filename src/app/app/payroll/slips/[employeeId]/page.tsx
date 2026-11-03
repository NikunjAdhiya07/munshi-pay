import Link from "next/link";
import { PrintButton } from "../../../../../components/print-button";
import { SlipSheet } from "../../../../../components/slip";
import {
  Missing,
  Origin,
  PageHeader,
  periodLabel,
} from "../../../../../components/ui";
import { currentPeriod, requireView } from "../../../../../server/auth";
import { buildSlip } from "../../../../../server/slips";
import { originLabel, readStore } from "../../../../../server/store";

export default async function SlipPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const session = await requireView("payroll");
  const period = await currentPeriod();
  const { employeeId } = await params;
  const store = readStore();
  const slip = buildSlip(store, session.companyId, period, employeeId);
  if (!slip) {
    return (
      <Missing
        title={`No payable salary slip for this employee in ${periodLabel(period)}.`}
        href="/app/payroll/slips"
        label="Back to salary slips"
      />
    );
  }
  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Salary slip"
          lede={`${slip.employee.name} · ${periodLabel(period)}`}
          action={<PrintButton label="Print or save as PDF" />}
        />
        <Origin />
        <p>
          <Link href="/app/payroll/slips">All salary slips</Link>
        </p>
      </div>
      <SlipSheet slip={slip} origin={originLabel(store)} />
    </>
  );
}
