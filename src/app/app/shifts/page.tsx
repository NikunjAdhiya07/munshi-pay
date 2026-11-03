import Link from "next/link";
import { Empty, Flash, Origin, PageHeader } from "../../../components/ui";
import { can } from "../../../server/access";
import { removeShift, saveShift } from "../../../server/actions";
import { requireView } from "../../../server/auth";
import { employeesOnShift, type ShiftInput } from "../../../server/shifts";
import { readStore } from "../../../server/store";

type Query = Partial<Record<keyof ShiftInput, string>> & {
  notice?: string;
  error?: string;
  edit?: string;
  delete?: string;
};

const dash = (value: string | undefined) => (value ? value : "Not set");

function span(from: string | undefined, to: string | undefined) {
  return from && to ? `${from}–${to}` : "Not set";
}

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const session = await requireView("masters");
  const query = await searchParams;
  const store = readStore();
  const company = session.companyId;
  const canAdd = can(session.role, store.rights, "masters", "add");
  const canEdit = can(session.role, store.rights, "masters", "edit");
  const canDelete = can(session.role, store.rights, "masters", "delete");
  const shifts = store.shifts.filter((item) => item.companyId === company);
  const editing = query.edit
    ? shifts.find((item) => item.id === query.edit)
    : undefined;
  const deleting = query.delete
    ? shifts.find((item) => item.id === query.delete)
    : undefined;
  const deletingCount = deleting
    ? employeesOnShift(store, company, deleting.name)
    : 0;

  // After a refused save the form shows what the person typed.
  const saved = (field: keyof ShiftInput): string =>
    editing
      ? ((editing as Record<string, string | undefined>)[field] ?? "")
      : "";
  const draft = (field: keyof ShiftInput): string =>
    query[field] ?? saved(field);
  const showForm = editing ? canEdit : canAdd;

  return (
    <>
      <PageHeader
        title="Shift master"
        lede="Shifts with clock times and hours. The employee Other tab picks a shift from this list."
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />

      {deleting ? (
        <section className="panel form-measure" aria-labelledby="delete-title">
          <h2 id="delete-title">Delete shift {deleting.name}?</h2>
          {deletingCount > 0 ? (
            <p className="help">
              {deleting.name} is used by {deletingCount}{" "}
              {deletingCount === 1 ? "employee" : "employees"}, so it cannot be
              deleted. Change those employees first.
            </p>
          ) : (
            <>
              <p className="help">
                The shift is removed from the list. This cannot be undone.
              </p>
              <form action={removeShift} className="row-actions">
                <input type="hidden" name="id" value={deleting.id} />
                <button type="submit">Delete shift</button>
                <Link className="button quiet" href="/app/shifts">
                  Keep shift
                </Link>
              </form>
            </>
          )}
        </section>
      ) : null}

      {showForm ? (
        <section className="panel form-measure" aria-labelledby="form-title">
          <h2 id="form-title">
            {editing ? `Edit ${editing.name}` : "Add shift"}
          </h2>
          <form action={saveShift}>
            {editing ? (
              <input type="hidden" name="id" value={editing.id} />
            ) : null}
            <label>
              <span>Shift name</span>
              <input
                name="name"
                defaultValue={draft("name")}
                maxLength={40}
                required
              />
            </label>
            <label>
              <span>In time</span>
              <input name="inTime" type="time" defaultValue={draft("inTime")} />
            </label>
            <label>
              <span>Out time</span>
              <input
                name="outTime"
                type="time"
                defaultValue={draft("outTime")}
              />
            </label>
            <label>
              <span>In time 2</span>
              <input
                name="inTime2"
                type="time"
                defaultValue={draft("inTime2")}
              />
            </label>
            <label>
              <span>Out time 2</span>
              <input
                name="outTime2"
                type="time"
                defaultValue={draft("outTime2")}
              />
            </label>
            <p className="help">
              A shift can end after midnight. Fill both times of a pair or
              neither.
            </p>
            <label>
              <span>Total hours</span>
              <input
                name="hours"
                inputMode="decimal"
                defaultValue={draft("hours")}
              />
            </label>
            <label>
              <span>Present hours</span>
              <input
                name="presentHours"
                inputMode="decimal"
                defaultValue={draft("presentHours")}
              />
            </label>
            <label>
              <span>Half-day hours</span>
              <input
                name="halfDayHours"
                inputMode="decimal"
                defaultValue={draft("halfDayHours")}
              />
            </label>
            <label>
              <span>Night-off shift</span>
              <input
                name="nightOffShift"
                maxLength={30}
                defaultValue={draft("nightOffShift")}
              />
            </label>
            <label>
              <span>Night-duty punch</span>
              <input
                name="nightDutyPunch"
                maxLength={30}
                defaultValue={draft("nightDutyPunch")}
              />
            </label>
            <p className="help">
              Hours are between 0 and 24. Night-off shift and night-duty punch
              are recorded as typed. The muster and payroll do not use any of
              these fields yet.
            </p>
            <div className="row-actions">
              <button type="submit">
                {editing ? "Save changes" : "Add shift"}
              </button>
              {editing ? (
                <Link className="button quiet" href="/app/shifts">
                  Cancel
                </Link>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      <section aria-labelledby="list-title">
        <h2 id="list-title">Shifts</h2>
        {shifts.length === 0 ? (
          <Empty
            title={`No shifts are set for this company.${canAdd ? " Add one with the form above." : ""}`}
          />
        ) : (
          <div className="table-wrap stack-table">
            <table>
              <caption className="sr-only">Shifts</caption>
              <thead>
                <tr>
                  <th scope="col">Shift</th>
                  <th scope="col">In to out</th>
                  <th scope="col">In 2 to out 2</th>
                  <th scope="col" className="num">
                    Total hours
                  </th>
                  <th scope="col" className="num">
                    Present hours
                  </th>
                  <th scope="col" className="num">
                    Half-day hours
                  </th>
                  <th scope="col">Night-off shift</th>
                  <th scope="col">Night-duty punch</th>
                  <th scope="col" className="num">
                    Employees
                  </th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((item) => {
                  const used = employeesOnShift(store, company, item.name);
                  return (
                    <tr key={item.id}>
                      <td data-label="Shift">{item.name}</td>
                      <td className="figures" data-label="In to out">
                        {span(item.inTime, item.outTime)}
                      </td>
                      <td className="figures" data-label="In 2 to out 2">
                        {span(item.inTime2, item.outTime2)}
                      </td>
                      <td className="num figures" data-label="Total hours">
                        {dash(item.hours)}
                      </td>
                      <td className="num figures" data-label="Present hours">
                        {dash(item.presentHours)}
                      </td>
                      <td className="num figures" data-label="Half-day hours">
                        {dash(item.halfDayHours)}
                      </td>
                      <td data-label="Night-off shift">
                        {dash(item.nightOffShift)}
                      </td>
                      <td data-label="Night-duty punch">
                        {dash(item.nightDutyPunch)}
                      </td>
                      <td className="num figures" data-label="Employees">
                        {used}
                      </td>
                      <td data-label="Actions">
                        <div className="row-actions">
                          {canEdit ? (
                            <Link
                              className="button quiet"
                              href={`/app/shifts?edit=${item.id}`}
                              aria-label={`Edit ${item.name}`}
                            >
                              Edit
                            </Link>
                          ) : null}
                          {canDelete && used === 0 ? (
                            <Link
                              className="button quiet"
                              href={`/app/shifts?delete=${item.id}`}
                              aria-label={`Delete ${item.name}`}
                            >
                              Delete
                            </Link>
                          ) : null}
                          {used > 0 ? (
                            <span className="help">
                              In use, cannot be deleted
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
