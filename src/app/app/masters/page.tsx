import Link from "next/link";
import {
  Empty,
  Flash,
  Money,
  Origin,
  PageHeader,
  periodLabel,
} from "../../../components/ui";
import { formatInr } from "../../../domain/money";
import { can } from "../../../server/access";
import { removeSlab, saveSlab } from "../../../server/actions";
import { currentPeriod, requireView } from "../../../server/auth";
import type { PtSlab } from "../../../server/model";
import { periodEnd } from "../../../server/payroll";
import { overlappingSlabs, slabsInForce } from "../../../server/slabs";
import { readStore } from "../../../server/store";

type Query = {
  notice?: string;
  error?: string;
  editSlab?: string;
  deleteSlab?: string;
  asOn?: string;
  state?: string;
  lower?: string;
  upper?: string;
  amount?: string;
};

const rupees = (paise: number) => formatInr(paise);

/** Paise as the plain rupee text a person would type, such as 1250.50. */
function typed(paise: number): string {
  const whole = Math.floor(paise / 100);
  const part = paise % 100;
  return part === 0
    ? String(whole)
    : `${whole}.${String(part).padStart(2, "0")}`;
}

export default async function MastersPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const session = await requireView("masters");
  const period = await currentPeriod();
  const query = await searchParams;
  const store = readStore();
  const company = session.companyId;
  const companyRecord = store.companies.find((item) => item.id === company);
  const canAdd = can(session.role, store.rights, "masters", "add");
  const canEdit = can(session.role, store.rights, "masters", "edit");
  const canDelete = can(session.role, store.rights, "masters", "delete");
  const slabs = store.slabs
    .filter((item) => item.companyId === company)
    .sort(
      (a, b) =>
        a.state.localeCompare(b.state) ||
        b.asOn.localeCompare(a.asOn) ||
        a.lowerPaise - b.lowerPaise,
    );
  const overlaps = overlappingSlabs(store, company);
  const end = periodEnd(period);
  const inForce = new Set(
    slabsInForce(store, company, companyRecord?.state ?? "", end).map(
      (item) => item.id,
    ),
  );
  const companyState = (companyRecord?.state ?? "").trim().toLowerCase();
  const statusOf = (slab: PtSlab): Status => {
    if (slab.state.trim().toLowerCase() !== companyState) return "other-state";
    if (inForce.has(slab.id)) return "in-force";
    return slab.asOn > end ? "later" : "replaced";
  };

  const editingSlab = query.editSlab
    ? slabs.find((item) => item.id === query.editSlab)
    : undefined;
  const deletingSlab =
    query.deleteSlab && canDelete
      ? slabs.find((item) => item.id === query.deleteSlab)
      : undefined;
  // After a refused save the form shows what the person typed.
  const slabDraft = {
    asOn: query.asOn ?? editingSlab?.asOn ?? "",
    state: query.state ?? editingSlab?.state ?? companyRecord?.state ?? "",
    lower: query.lower ?? (editingSlab ? typed(editingSlab.lowerPaise) : ""),
    upper: query.upper ?? (editingSlab ? typed(editingSlab.upperPaise) : ""),
    amount: query.amount ?? (editingSlab ? typed(editingSlab.amountPaise) : ""),
  };
  const showSlabForm = editingSlab ? canEdit : canAdd;

  return (
    <>
      <PageHeader
        title="Lists and rules"
        lede="Professional-tax slabs. Category percents are under Set percentage, departments, designations, and banks under Misc. entry, holidays under Holiday entry, and shifts under Shift master."
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />

      <section aria-labelledby="pt-title">
        <h2 id="pt-title">Professional tax slabs</h2>
        <p className="help">
          {companyRecord?.professionalTax
            ? `PT is charged from ${companyRecord.state} slabs. Each month uses the slab set with the latest as-on date on or before the month end, compared with the month gross.`
            : "Professional tax is off for this company, so these slabs are not charged. Turn it on under Company."}
        </p>

        {overlaps.size > 0 ? (
          <p className="flash danger" role="alert">
            {overlaps.size} slabs overlap another slab for the same state and
            as-on date. A gross inside an overlap gets no PT until the rule for
            overlapping slabs is confirmed. Edit the ranges so they do not
            overlap.
          </p>
        ) : null}

        {deletingSlab ? (
          <section
            className="panel form-measure"
            aria-labelledby="slab-delete-title"
          >
            <h3 id="slab-delete-title">
              Delete the {deletingSlab.state} slab as on {deletingSlab.asOn},{" "}
              {rupees(deletingSlab.lowerPaise)} to{" "}
              {rupees(deletingSlab.upperPaise)}?
            </h3>
            <p className="help">
              Months that are still open will no longer charge this slab when
              they are processed. Locked months keep the PT already calculated.
              This cannot be undone.
            </p>
            <form action={removeSlab} className="row-actions">
              <input type="hidden" name="id" value={deletingSlab.id} />
              <button type="submit">Delete slab</button>
              <Link className="button quiet" href="/app/masters#pt-title">
                Keep slab
              </Link>
            </form>
          </section>
        ) : null}

        {showSlabForm ? (
          <section
            className="panel form-measure"
            aria-labelledby="slab-form-title"
          >
            <h3 id="slab-form-title">
              {editingSlab
                ? `Edit ${editingSlab.state} slab as on ${editingSlab.asOn}`
                : "Add slab"}
            </h3>
            <form action={saveSlab}>
              {editingSlab ? (
                <input type="hidden" name="id" value={editingSlab.id} />
              ) : null}
              <label>
                <span>As on</span>
                <input
                  name="asOn"
                  type="date"
                  defaultValue={slabDraft.asOn}
                  required
                />
              </label>
              <label>
                <span>State</span>
                <input
                  name="state"
                  list="pt-states"
                  maxLength={60}
                  defaultValue={slabDraft.state}
                  required
                />
                <datalist id="pt-states">
                  {companyRecord ? (
                    <option value={companyRecord.state} />
                  ) : null}
                </datalist>
              </label>
              <label>
                <span>Lower limit (rupees)</span>
                <input
                  name="lower"
                  inputMode="decimal"
                  defaultValue={slabDraft.lower}
                  required
                />
              </label>
              <label>
                <span>Upper limit (rupees)</span>
                <input
                  name="upper"
                  inputMode="decimal"
                  defaultValue={slabDraft.upper}
                  required
                />
              </label>
              <label>
                <span>PT amount (rupees)</span>
                <input
                  name="amount"
                  inputMode="decimal"
                  defaultValue={slabDraft.amount}
                  required
                />
              </label>
              <p className="help">
                Both limits are included. A gross equal to the upper limit is in
                this slab.
              </p>
              <div className="row-actions">
                <button type="submit">
                  {editingSlab ? "Save changes" : "Add slab"}
                </button>
                {editingSlab ? (
                  <Link className="button quiet" href="/app/masters#pt-title">
                    Cancel
                  </Link>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}

        {slabs.length === 0 ? (
          <Empty
            title={`No professional tax slabs are set for this company.${canAdd ? " Add one with the form above." : ""}`}
          />
        ) : (
          <div className="table-wrap stack-table">
            <table>
              <caption className="sr-only">Professional tax slabs</caption>
              <thead>
                <tr>
                  <th scope="col">State</th>
                  <th scope="col">As on</th>
                  <th scope="col" className="num">
                    Lower limit
                  </th>
                  <th scope="col" className="num">
                    Upper limit
                  </th>
                  <th scope="col" className="num">
                    PT
                  </th>
                  <th scope="col">Status for {periodLabel(period)}</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {slabs.map((item) => (
                  <tr key={item.id}>
                    <td data-label="State">{item.state}</td>
                    <td className="figures" data-label="As on">
                      {item.asOn || "Not set"}
                    </td>
                    <td className="num" data-label="Lower limit">
                      <Money paise={item.lowerPaise} />
                    </td>
                    <td className="num" data-label="Upper limit">
                      <Money paise={item.upperPaise} />
                    </td>
                    <td className="num" data-label="PT">
                      <Money paise={item.amountPaise} />
                    </td>
                    <td data-label="Status">
                      <SlabStatus status={statusOf(item)} />
                      {overlaps.has(item.id) ? (
                        <>
                          {" "}
                          <span className="pill critical">Overlaps</span>
                        </>
                      ) : null}
                    </td>
                    <td data-label="Actions">
                      <div className="row-actions">
                        {canEdit ? (
                          <Link
                            className="button quiet"
                            href={`/app/masters?editSlab=${item.id}#pt-title`}
                            aria-label={`Edit ${item.state} slab as on ${item.asOn}, ${rupees(item.lowerPaise)} to ${rupees(item.upperPaise)}`}
                          >
                            Edit
                          </Link>
                        ) : null}
                        {canDelete ? (
                          <Link
                            className="button quiet"
                            href={`/app/masters?deleteSlab=${item.id}#pt-title`}
                            aria-label={`Delete ${item.state} slab as on ${item.asOn}, ${rupees(item.lowerPaise)} to ${rupees(item.upperPaise)}`}
                          >
                            Delete
                          </Link>
                        ) : null}
                      </div>
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

type Status = "in-force" | "replaced" | "later" | "other-state";

function SlabStatus({ status }: { status: Status }) {
  if (status === "in-force") return <span className="pill ok">In force</span>;
  if (status === "replaced") return <span className="pill">Replaced</span>;
  if (status === "later") return <span className="pill">Not yet in force</span>;
  return <span className="pill">Other state</span>;
}
