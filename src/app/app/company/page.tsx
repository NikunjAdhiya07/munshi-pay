import Link from "next/link";
import { Empty, Flash, Origin, PageHeader } from "../../../components/ui";
import { can } from "../../../server/access";
import { openCompany } from "../../../server/actions";
import { requireView } from "../../../server/auth";
import type { Company } from "../../../server/model";
import { readStore } from "../../../server/store";
import { companiesFor } from "../../../server/users";

type Query = { notice?: string; error?: string };

export default async function CompanyListPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const session = await requireView("company");
  const query = await searchParams;
  const store = readStore();
  const companies = companiesFor(store, session.userId);
  const canAdd = can(session.role, store.rights, "company", "add");
  return (
    <>
      <PageHeader
        title="Companies"
        lede="Companies and sites this login can open. Edit opens that company's payroll settings."
        action={
          canAdd ? (
            <>
              <Link className="button" href="/app/company/new">
                Create company
              </Link>
              <Link className="button quiet" href="/app/company/new?kind=site">
                Create site
              </Link>
            </>
          ) : null
        }
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />
      {companies.length === 0 ? (
        <Empty title="This login is not a member of a company." />
      ) : (
        <div className="table-wrap stack-table">
          <table>
            <caption className="sr-only">Companies this login can open</caption>
            <thead>
              <tr>
                <th scope="col">Company number</th>
                <th scope="col">Short name</th>
                <th scope="col">Name</th>
                <th scope="col">Location</th>
                <th scope="col">City</th>
                <th scope="col">State</th>
                <th scope="col">Kind</th>
                <th scope="col">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <CompanyRow key={company.id} company={company} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function CompanyRow({ company }: { company: Company }) {
  return (
    <tr>
      <td data-label="Company number">{company.number}</td>
      <td data-label="Short name">{company.shortName}</td>
      <td data-label="Name">{company.name}</td>
      <td data-label="Location">{company.location}</td>
      <td data-label="City">{company.city}</td>
      <td data-label="State">{company.state}</td>
      <td data-label="Kind">{company.parentId ? "Site" : "Company"}</td>
      <td data-label="Edit">
        <form action={openCompany}>
          <input type="hidden" name="companyId" value={company.id} />
          <button type="submit">Edit</button>
        </form>
      </td>
    </tr>
  );
}
