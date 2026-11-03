import { Flash, Origin, PageHeader, periodLabel } from "../../../components/ui";
import { can, MENU_LABELS } from "../../../server/access";
import { lockMonth, unlockMonth } from "../../../server/actions";
import { currentPeriod, requireView } from "../../../server/auth";
import type { Menu } from "../../../server/model";
import { readStore } from "../../../server/store";

export default async function ControlPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requireView("control");
  const period = await currentPeriod();
  const query = await searchParams;
  const store = readStore();
  const lock = store.locks.find(
    (item) => item.companyId === session.companyId && item.period === period,
  );
  const rights = store.rights.filter((item) => item.role === session.role);
  const allowed = lock
    ? can(session.role, store.rights, "control", "delete")
    : can(session.role, store.rights, "control", "edit");
  return (
    <>
      <PageHeader
        title="Locks and access"
        lede={
          lock
            ? `${periodLabel(period)} was locked by ${lock.lockedBy}.`
            : `${periodLabel(period)} is open.`
        }
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />
      {allowed ? (
        <form
          className="panel form-measure"
          action={lock ? unlockMonth : lockMonth}
        >
          <p>
            {lock
              ? "Unlocking allows salary processing and line edits again."
              : "Locking freezes salary processing, salary entry, and the muster period for this month."}
          </p>
          <label>
            <span>Type {lock ? "UNLOCK" : "LOCK"} to confirm</span>
            <input name="confirm" autoComplete="off" required />
          </label>
          <button type="submit">
            {lock ? "Unlock period" : "Lock period"}
          </button>
        </form>
      ) : (
        <p className="panel form-measure">
          {lock
            ? "Unlocking a month needs the delete right on Locks and access."
            : "Locking a month needs the edit right on Locks and access."}
        </p>
      )}
      <section className="panel">
        <h2>Your menu rights</h2>
        <div className="table-wrap stack-table">
          <table>
            <thead>
              <tr>
                <th>Menu</th>
                <th>View</th>
                <th>Add</th>
                <th>Edit</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {rights.map((right) => (
                <tr key={right.menu}>
                  <td data-label="Menu">
                    {MENU_LABELS[right.menu as Menu] ?? right.menu}
                  </td>
                  <td data-label="View">{right.view ? "Yes" : "No"}</td>
                  <td data-label="Add">{right.add ? "Yes" : "No"}</td>
                  <td data-label="Edit">{right.edit ? "Yes" : "No"}</td>
                  <td data-label="Delete">{right.delete ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Audit</h2>
        <ul className="activity-list">
          {store.audit
            .filter((item) => item.companyId === session.companyId)
            .slice(0, 10)
            .map((item) => (
              <li key={item.id}>
                {item.at} · {item.actor} · {item.action}
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}
