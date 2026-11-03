import Link from "next/link";
import { Empty, Flash, Origin, PageHeader } from "../../../components/ui";
import { can } from "../../../server/access";
import { removeLeavePolicy, saveLeavePolicy } from "../../../server/actions";
import { requireView } from "../../../server/auth";
import {
  type LeavePolicyInput,
  recordsBlockingDelete,
} from "../../../server/leavePolicy";
import { readStore } from "../../../server/store";

type Query = Partial<Record<keyof LeavePolicyInput, string>> & {
  notice?: string;
  error?: string;
  edit?: string;
  delete?: string;
};

export default async function LeavePolicyPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const session = await requireView("leave");
  const query = await searchParams;
  const store = readStore();
  const company = session.companyId;
  const canAdd = can(session.role, store.rights, "leave", "add");
  const canEdit = can(session.role, store.rights, "leave", "edit");
  const canDelete = can(session.role, store.rights, "leave", "delete");
  const policies = store.leavePolicies
    .filter((item) => item.companyId === company)
    .sort(
      (a, b) => a.cadre.localeCompare(b.cadre) || a.name.localeCompare(b.name),
    );
  const editing = query.edit
    ? policies.find((item) => item.id === query.edit)
    : undefined;
  const deleting = query.delete
    ? policies.find((item) => item.id === query.delete)
    : undefined;
  const deletingBlocked = deleting
    ? recordsBlockingDelete(store, company, deleting)
    : 0;

  // After a refused save the form shows what the person typed.
  const draft = (field: keyof LeavePolicyInput): string =>
    query[field] ?? editing?.[field] ?? "";
  const showForm = editing ? canEdit : canAdd;

  return (
    <>
      <PageHeader
        title="Leave policy"
        lede="Leave names by pay cadre, with duration and ratio. They are recorded as typed. Nothing here calculates leave."
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />

      {deleting ? (
        <section className="panel form-measure" aria-labelledby="delete-title">
          <h2 id="delete-title">
            Delete {deleting.name} for the {deleting.cadre} cadre?
          </h2>
          {deletingBlocked > 0 ? (
            <p className="help">
              {deleting.name} has {deletingBlocked} register or encashment{" "}
              {deletingBlocked === 1 ? "record" : "records"} and no other cadre
              has a policy for it, so it cannot be deleted while those records
              exist.
            </p>
          ) : (
            <>
              <p className="help">
                The policy is removed from the list. Leave balances already
                recorded are not changed. This cannot be undone.
              </p>
              <form action={removeLeavePolicy} className="row-actions">
                <input type="hidden" name="id" value={deleting.id} />
                <button type="submit">Delete policy</button>
                <Link className="button quiet" href="/app/leave-policy">
                  Keep policy
                </Link>
              </form>
            </>
          )}
        </section>
      ) : null}

      {showForm ? (
        <section className="panel form-measure" aria-labelledby="form-title">
          <h2 id="form-title">
            {editing ? `Edit ${editing.name}` : "Add policy"}
          </h2>
          <form action={saveLeavePolicy}>
            {editing ? (
              <input type="hidden" name="id" value={editing.id} />
            ) : null}
            <label>
              <span>Pay cadre</span>
              <input
                name="cadre"
                defaultValue={draft("cadre")}
                maxLength={40}
                required
              />
            </label>
            <label>
              <span>Leave name</span>
              <input
                name="name"
                defaultValue={draft("name")}
                maxLength={40}
                required
              />
            </label>
            <label>
              <span>Leave duration</span>
              <input
                name="duration"
                defaultValue={draft("duration")}
                maxLength={40}
              />
            </label>
            <label>
              <span>Leave ratio</span>
              <input
                name="ratio"
                defaultValue={draft("ratio")}
                maxLength={40}
              />
            </label>
            <p className="help">
              Renaming the only policy for a leave name also renames it on the
              register and encashment records.
            </p>
            <div className="row-actions">
              <button type="submit">
                {editing ? "Save changes" : "Add policy"}
              </button>
              {editing ? (
                <Link className="button quiet" href="/app/leave-policy">
                  Cancel
                </Link>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      <section aria-labelledby="list-title">
        <h2 id="list-title">Policies</h2>
        {policies.length === 0 ? (
          <Empty
            title={`No leave policies are set for this company.${canAdd ? " Add one with the form above." : ""}`}
          />
        ) : (
          <div className="table-wrap stack-table">
            <table>
              <caption className="sr-only">Leave policies</caption>
              <thead>
                <tr>
                  <th scope="col">Pay cadre</th>
                  <th scope="col">Leave name</th>
                  <th scope="col">Leave duration</th>
                  <th scope="col">Leave ratio</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((item) => {
                  const blocked = recordsBlockingDelete(store, company, item);
                  return (
                    <tr key={item.id}>
                      <td data-label="Pay cadre">{item.cadre}</td>
                      <td data-label="Leave name">{item.name}</td>
                      <td data-label="Leave duration">
                        {item.duration || "Not set"}
                      </td>
                      <td data-label="Leave ratio">
                        {item.ratio || "Not set"}
                      </td>
                      <td data-label="Actions">
                        <div className="row-actions">
                          {canEdit ? (
                            <Link
                              className="button quiet"
                              href={`/app/leave-policy?edit=${item.id}`}
                              aria-label={`Edit ${item.name} for ${item.cadre}`}
                            >
                              Edit
                            </Link>
                          ) : null}
                          {canDelete && blocked === 0 ? (
                            <Link
                              className="button quiet"
                              href={`/app/leave-policy?delete=${item.id}`}
                              aria-label={`Delete ${item.name} for ${item.cadre}`}
                            >
                              Delete
                            </Link>
                          ) : null}
                          {blocked > 0 ? (
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
