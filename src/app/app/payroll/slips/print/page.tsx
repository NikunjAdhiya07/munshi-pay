import Link from "next/link";
import { PrintButton } from "../../../../../components/print-button";
import { SlipSheet } from "../../../../../components/slip";
import {
  Empty,
  Origin,
  PageHeader,
  periodLabel,
} from "../../../../../components/ui";
import { currentPeriod, requireView } from "../../../../../server/auth";
import {
  buildSlips,
  MAX_SLIPS,
  parseSelection,
} from "../../../../../server/slips";
import { originLabel, readStore } from "../../../../../server/store";

type Query = { all?: string; e?: string | string[] };

export default async function PrintSlipsPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const session = await requireView("payroll");
  const period = await currentPeriod();
  const query = await searchParams;
  const store = readStore();
  // "all" prints everyone. Otherwise only the employees that were ticked.
  const everyone = query.all === "1";
  const chosen = parseSelection(query.e);
  const slips =
    everyone || chosen.length > 0
      ? buildSlips(store, session.companyId, period, everyone ? null : chosen)
      : [];

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Print salary slips"
          lede={`${periodLabel(period)} · ${slips.length} ${slips.length === 1 ? "slip" : "slips"}, one per page`}
          action={
            slips.length > 0 ? (
              <PrintButton label="Print or save as PDF" />
            ) : undefined
          }
        />
        <Origin />
        <p>
          <Link href="/app/payroll/slips">All salary slips</Link>
        </p>
        {everyone && slips.length === MAX_SLIPS ? (
          <p className="help">
            Only the first {MAX_SLIPS} slips are shown. Choose employees to
            print the rest.
          </p>
        ) : null}
        {slips.length === 0 ? (
          <Empty
            title={
              everyone || chosen.length > 0
                ? `No payable slips matched for ${periodLabel(period)}.`
                : "Choose at least one employee, or print all slips."
            }
            href="/app/payroll/slips"
            label="Back to salary slips"
          />
        ) : null}
      </div>
      {slips.map((slip) => (
        <SlipSheet
          key={slip.employeeId}
          slip={slip}
          origin={originLabel(store)}
        />
      ))}
    </>
  );
}
