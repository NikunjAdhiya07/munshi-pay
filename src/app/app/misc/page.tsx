import Link from "next/link";
import { Empty, Flash, Origin, PageHeader } from "../../../components/ui";
import { can } from "../../../server/access";
import { removeMisc, saveMisc } from "../../../server/actions";
import { requireView } from "../../../server/auth";
import {
  employeeCountUsing,
  isMiscType,
  MISC_LABEL,
  MISC_TYPES,
} from "../../../server/misc";
import { readStore } from "../../../server/store";

type Query = {
  notice?: string;
  error?: string;
  edit?: string;
  delete?: string;
  type?: string;
  description?: string;
};

export default async function MiscPage({
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
  const items = store.misc.filter((item) => item.companyId === company);
  const editing = query.edit
    ? items.find((item) => item.id === query.edit)
    : undefined;
  const deleting = query.delete
    ? items.find((item) => item.id === query.delete)
    : undefined;
  const deletingCount = deleting
    ? employeeCountUsing(store, company, deleting)
    : 0;

  // After a refused save the form shows what the person typed.
  const draftType =
    editing?.type ?? (isMiscType(query.type ?? "") ? query.type : "department");
  const draftDescription = query.description ?? editing?.description ?? "";
  const showForm = editing ? canEdit : canAdd;

  return (
    <>
      <PageHeader
        title="Misc. entry"
        lede="Departments, designations, and banks. The employee forms pick from these lists."
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />

      {deleting ? (
        <section className="panel form-measure" aria-labelledby="delete-title">
          <h2 id="delete-title">
            Delete {MISC_LABEL[deleting.type].toLowerCase()}{" "}
            {deleting.description}?
          </h2>
          {deletingCount > 0 ? (
            <p className="help">
              {deleting.description} is used by {deletingCount}{" "}
              {deletingCount === 1 ? "employee" : "employees"}, so it cannot be
              deleted. Change those employees first.
            </p>
          ) : (
            <>
              <p className="help">
                The entry is removed from the list. This cannot be undone.
              </p>
              <form action={removeMisc} className="row-actions">
                <input type="hidden" name="id" value={deleting.id} />
                <button type="submit">Delete entry</button>
                <Link className="button quiet" href="/app/misc">
                  Keep entry
                </Link>
              </form>
            </>
          )}
        </section>
      ) : null}

      {showForm ? (
        <section className="panel form-measure" aria-labelledby="form-title">
          <h2 id="form-title">
            {editing
              ? `Edit ${MISC_LABEL[editing.type].toLowerCase()}`
              : "Add entry"}
          </h2>
          <form action={saveMisc}>
            {editing ? (
              <>
                <input type="hidden" name="id" value={editing.id} />
                <input type="hidden" name="type" value={editing.type} />
                <p className="help">
                  Type: {MISC_LABEL[editing.type]}. Renaming also updates the
                  employees who have this{" "}
                  {MISC_LABEL[editing.type].toLowerCase()}.
                </p>
              </>
            ) : (
              <label>
                <span>Type</span>
                <select name="type" defaultValue={draftType} required>
                  {MISC_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {MISC_LABEL[type]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span>Description</span>
              <input
                name="description"
                defaultValue={draftDescription}
                maxLength={60}
                required
              />
            </label>
            <div className="row-actions">
              <button type="submit">
                {editing ? "Save changes" : "Add entry"}
              </button>
              {editing ? (
                <Link className="button quiet" href="/app/misc">
                  Cancel
                </Link>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      {MISC_TYPES.map((type) => {
        const rows = items.filter((item) => item.type === type);
        const label = MISC_LABEL[type];
        return (
          <section key={type} aria-labelledby={`${type}-title`}>
            <h2 id={`${type}-title`}>{label} list</h2>
            {rows.length === 0 ? (
              <Empty
                title={`No ${label.toLowerCase()} entries for this company.${canAdd ? " Add one with the form above." : ""}`}
              />
            ) : (
              <div className="table-wrap stack-table">
                <table>
                  <caption className="sr-only">{label} list</caption>
                  <thead>
                    <tr>
                      <th scope="col">Description</th>
                      <th scope="col" className="num">
                        Employees
                      </th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => {
                      const used = employeeCountUsing(store, company, item);
                      return (
                        <tr key={item.id}>
                          <td data-label="Description">{item.description}</td>
                          <td className="num figures" data-label="Employees">
                            {used}
                          </td>
                          <td data-label="Actions">
                            <div className="row-actions">
                              {canEdit ? (
                                <Link
                                  className="button quiet"
                                  href={`/app/misc?edit=${item.id}`}
                                  aria-label={`Edit ${item.description}`}
                                >
                                  Edit
                                </Link>
                              ) : null}
                              {canDelete && used === 0 ? (
                                <Link
                                  className="button quiet"
                                  href={`/app/misc?delete=${item.id}`}
                                  aria-label={`Delete ${item.description}`}
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
        );
      })}
    </>
  );
}
