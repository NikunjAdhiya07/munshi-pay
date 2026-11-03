import Link from "next/link";
import { Empty, Flash, Origin, PageHeader } from "../../../components/ui";
import { can } from "../../../server/access";
import { removeCategory, saveCategory } from "../../../server/actions";
import { requireView } from "../../../server/auth";
import { salaryRowsUsing } from "../../../server/categories";
import type { Category } from "../../../server/model";
import { readStore } from "../../../server/store";

type Query = {
  notice?: string;
  error?: string;
  edit?: string;
  delete?: string;
  name?: string;
  structure?: string;
  basic?: string;
  da?: string;
};

const STRUCTURE_LABEL = { gross: "Gross", ctc: "CTC" } as const;

function remainder(category: Category): number {
  return (
    Math.round((100 - category.basicPercent - category.daPercent) * 100) / 100
  );
}

export default async function PercentagesPage({
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
  const categories = store.categories.filter(
    (item) => item.companyId === company,
  );
  const editing = query.edit
    ? categories.find((item) => item.id === query.edit)
    : undefined;
  const deleting = query.delete
    ? categories.find((item) => item.id === query.delete)
    : undefined;
  const usedBy = new Map(
    categories.map((item) => [
      item.id,
      salaryRowsUsing(store, company, item.id),
    ]),
  );

  // After a refused save the form shows what the person typed.
  const draftStructure =
    editing?.structure ?? (query.structure === "ctc" ? "ctc" : "gross");
  const draft = {
    name: query.name ?? editing?.name ?? "",
    basic: query.basic ?? String(editing?.basicPercent ?? 50),
    da: query.da ?? String(editing?.daPercent ?? 20),
  };
  const showForm = editing ? canEdit : canAdd;

  return (
    <>
      <PageHeader
        title="Set percentage"
        lede="Basic and DA are percents of the stored gross. The remainder of gross is stored as Other."
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />

      {deleting ? (
        <section className="panel form-measure" aria-labelledby="delete-title">
          <h2 id="delete-title">
            Delete {STRUCTURE_LABEL[deleting.structure]} category{" "}
            {deleting.name}?
          </h2>
          <p className="help">
            The category and its percents are removed from this company. This
            cannot be undone. Employees cannot be given this category again
            unless you add it back.
          </p>
          <form action={removeCategory} className="row-actions">
            <input type="hidden" name="id" value={deleting.id} />
            <button type="submit">Delete category</button>
            <Link className="button quiet" href="/app/percentages">
              Keep category
            </Link>
          </form>
        </section>
      ) : null}

      {showForm ? (
        <section className="panel form-measure" aria-labelledby="form-title">
          <h2 id="form-title">
            {editing ? `Edit ${editing.name}` : "Add category"}
          </h2>
          <form action={saveCategory}>
            {editing ? (
              <input type="hidden" name="id" value={editing.id} />
            ) : null}
            <label>
              <span>Name</span>
              <input
                name="name"
                defaultValue={draft.name}
                maxLength={60}
                required
              />
            </label>
            {editing ? (
              <>
                <input
                  type="hidden"
                  name="structure"
                  value={editing.structure}
                />
                <p className="help">
                  List: {STRUCTURE_LABEL[editing.structure]}. A category cannot
                  move between lists. Add a new one instead.
                </p>
              </>
            ) : (
              <label>
                <span>List</span>
                <select name="structure" defaultValue={draftStructure}>
                  <option value="gross">Gross</option>
                  <option value="ctc">CTC</option>
                </select>
              </label>
            )}
            <label>
              <span>Basic %</span>
              <input
                name="basicPercent"
                inputMode="decimal"
                defaultValue={draft.basic}
                required
              />
            </label>
            <label>
              <span>DA %</span>
              <input
                name="daPercent"
                inputMode="decimal"
                defaultValue={draft.da}
                required
              />
            </label>
            <p className="help">Basic plus DA cannot be above 100.</p>
            <div className="row-actions">
              <button type="submit">
                {editing ? "Save changes" : "Add category"}
              </button>
              {editing ? (
                <Link className="button quiet" href="/app/percentages">
                  Cancel
                </Link>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      {(["gross", "ctc"] as const).map((structure) => {
        const rows = categories.filter((item) => item.structure === structure);
        const label = STRUCTURE_LABEL[structure];
        return (
          <section key={structure} aria-labelledby={`${structure}-title`}>
            <h2 id={`${structure}-title`}>{label} categories</h2>
            {structure === "ctc" ? (
              <p className="help">
                The split for CTC categories is not confirmed yet. Payroll
                splits them the same way as Gross until it is.
              </p>
            ) : null}
            {rows.length === 0 ? (
              <Empty
                title={`No ${label} categories are set for this company.${canAdd ? " Add one with the form above." : ""}`}
              />
            ) : (
              <div className="table-wrap stack-table">
                <table>
                  <caption className="sr-only">{label} categories</caption>
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col" className="num">
                        Basic
                      </th>
                      <th scope="col" className="num">
                        DA
                      </th>
                      <th scope="col" className="num">
                        Other (remainder)
                      </th>
                      <th scope="col" className="num">
                        Salary rows
                      </th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => {
                      const used = usedBy.get(item.id) ?? 0;
                      return (
                        <tr key={item.id}>
                          <td data-label="Category">{item.name}</td>
                          <td className="num figures" data-label="Basic">
                            {item.basicPercent}%
                          </td>
                          <td className="num figures" data-label="DA">
                            {item.daPercent}%
                          </td>
                          <td className="num figures" data-label="Other">
                            {remainder(item)}%
                          </td>
                          <td className="num figures" data-label="Salary rows">
                            {used}
                          </td>
                          <td data-label="Actions">
                            <div className="row-actions">
                              {canEdit ? (
                                <Link
                                  className="button quiet"
                                  href={`/app/percentages?edit=${item.id}`}
                                  aria-label={`Edit ${item.name}`}
                                >
                                  Edit
                                </Link>
                              ) : null}
                              {canDelete && used === 0 ? (
                                <Link
                                  className="button quiet"
                                  href={`/app/percentages?delete=${item.id}`}
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
        );
      })}
    </>
  );
}
