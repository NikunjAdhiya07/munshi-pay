import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty, Flash, Origin, PageHeader } from "../../../../components/ui";
import { canCommit, displayCell, findImport } from "../../../../domain/import";
import { can } from "../../../../server/access";
import { saveImport, stageImport } from "../../../../server/actions";
import { requireView } from "../../../../server/auth";
import { loadPreview } from "../../../../server/import";
import { readStore } from "../../../../server/store";

export default async function ImportKindPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ preview?: string; notice?: string; error?: string }>;
}) {
  const session = await requireView("import");
  const { kind } = await params;
  const query = await searchParams;
  const definition = findImport(kind);
  if (!definition) notFound();
  const store = readStore();
  const allowAdd = can(session.role, store.rights, "import", "add");
  const preview = query.preview
    ? await loadPreview(query.preview, session.companyId)
    : null;
  const saved = store.imports.filter(
    (item) =>
      item.companyId === session.companyId && item.kind === definition.id,
  );
  const accepted =
    preview?.review.state === "rows"
      ? preview.review.rows.filter((row) => row.status === "accepted").length
      : 0;
  const rejected =
    preview?.review.state === "rows"
      ? preview.review.rows.length - accepted
      : 0;

  return (
    <>
      <PageHeader
        title={definition.title}
        lede="Nothing is written until every row is accepted. Stored rows stay in this company and do not create payroll records yet."
        action={
          <Link className="button quiet" href="/app/import">
            All imports
          </Link>
        }
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />
      <p>
        <a href={`/app/import/sample?kind=${definition.id}`}>Download sample</a>
      </p>
      {allowAdd ? (
        <form
          className="panel form-measure"
          action={stageImport}
          encType="multipart/form-data"
        >
          <input type="hidden" name="kind" value={definition.id} />
          <label>
            <span>Workbook</span>
            <input
              name="file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
            />
          </label>
          <p className="section-note">.xlsx files up to 1 MB.</p>
          <button type="submit">Preview</button>
        </form>
      ) : (
        <p className="section-note">
          You can download the sample. Uploading needs the add right.
        </p>
      )}
      {query.preview && !preview ? (
        <Empty title="That preview is not available for this company." />
      ) : null}
      {preview?.review.state === "file" ? (
        <Empty title={preview.review.message} />
      ) : null}
      {preview?.review.state === "rows" ? (
        <section className="panel">
          <h2>Preview</h2>
          <p className="section-note">
            {accepted} accepted, {rejected} rejected.{" "}
            {canCommit(preview.review)
              ? "Saving writes every row or none."
              : "Fix the rejected rows and upload the file again. Nothing has been saved."}
          </p>
          <div className="table-wrap stack-table">
            <table>
              <caption>
                {accepted} accepted, {rejected} rejected
              </caption>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reason</th>
                  {definition.columns.map((column) => (
                    <th key={column.key} scope="col">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.review.rows.map((row) => (
                  <tr key={row.number}>
                    <td className="figures" data-label="Row">
                      {row.number}
                    </td>
                    <td data-label="Status">
                      <span
                        className={
                          row.status === "accepted" ? "pill ok" : "pill warning"
                        }
                      >
                        {row.status === "accepted" ? "Accepted" : "Rejected"}
                      </span>
                    </td>
                    <td data-label="Reason">{row.reason || "—"}</td>
                    {definition.columns.map((column) => (
                      <td key={column.key} data-label={column.label}>
                        {displayCell(
                          row.values[column.key] ?? "",
                          Boolean(column.sensitive),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allowAdd && canCommit(preview.review) ? (
            <form action={saveImport}>
              <input type="hidden" name="kind" value={definition.id} />
              <input type="hidden" name="preview" value={query.preview} />
              <button type="submit">Save import</button>
            </form>
          ) : null}
        </section>
      ) : null}
      <section className="panel">
        <h2>Saved for this company</h2>
        {saved.length === 0 ? (
          <p className="section-note">
            No file has been saved for this import.
          </p>
        ) : (
          <div className="table-wrap stack-table">
            <table>
              <caption>Saved {definition.title} files</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">By</th>
                  <th scope="col">Rows</th>
                </tr>
              </thead>
              <tbody>
                {saved.map((item) => (
                  <tr key={item.id}>
                    <td data-label="When">{item.at}</td>
                    <td data-label="By">{item.actor}</td>
                    <td className="num" data-label="Rows">
                      {item.rows.length}
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
