import Link from "next/link";
import { Flash, Origin, PageHeader } from "../../../components/ui";
import { imports } from "../../../domain/import";
import { requireView } from "../../../server/auth";

export default async function ImportIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireView("import");
  const query = await searchParams;
  return (
    <>
      <PageHeader
        title="Import Excel"
        lede="Upload a sample-shaped workbook. A file is stored only when every row is accepted, and only for this company."
      />
      <Flash error={query.error} />
      <Origin />
      <div className="table-wrap">
        <table>
          <caption>Imports</caption>
          <thead>
            <tr>
              <th scope="col">Import</th>
              <th scope="col">Sample</th>
            </tr>
          </thead>
          <tbody>
            {imports.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/app/import/${item.id}`}>{item.title}</Link>
                </td>
                <td>
                  <a href={`/app/import/sample?kind=${item.id}`}>Download</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cards">
        {imports.map((item) => (
          <div key={item.id} className="card-row">
            <Link href={`/app/import/${item.id}`}>
              <strong>{item.title}</strong>
            </Link>
            <a href={`/app/import/sample?kind=${item.id}`}>Download sample</a>
          </div>
        ))}
      </div>
    </>
  );
}
