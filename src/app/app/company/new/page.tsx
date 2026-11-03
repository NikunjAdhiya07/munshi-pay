import Link from "next/link";
import { CompanyFieldSections } from "../../../../components/company-fields";
import { Flash, PageHeader } from "../../../../components/ui";
import { addCompany } from "../../../../server/actions";
import { requireView } from "../../../../server/auth";
import { readStore } from "../../../../server/store";

type Query = Record<string, string | undefined>;

export default async function NewCompanyPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const session = await requireView("company", "add");
  const query = await searchParams;
  const store = readStore();
  const current = store.companies.find((item) => item.id === session.companyId);
  const kind = query.kind === "site" ? "site" : "company";
  // The company's own bank list is where its bank is picked from. A new
  // company has none yet, so offer the banks of the company it is created from.
  const banks = store.misc
    .filter(
      (item) => item.companyId === session.companyId && item.type === "bank",
    )
    .map((item) => item.description)
    .sort((a, b) => a.localeCompare(b));

  return (
    <>
      <PageHeader
        title={kind === "site" ? "Create site" : "Create company"}
        eyebrow="Companies"
        lede={
          kind === "site"
            ? `A site is a company record under ${current?.name ?? "this company"}. It holds the same details as a company.`
            : "A new company holds the same details as an edited one. It starts with no PF or ESI percent unless you type one. You keep the role you have here."
        }
      />
      <Flash notice={query.notice} error={query.error} />
      <form className="profile-form" action={addCompany}>
        <input type="hidden" name="kind" value={kind} />
        <CompanyFieldSections
          query={query.kind === kind || !query.kind ? query : {}}
          banks={banks}
        />
        <div className="save-bar">
          <p>
            The company number is assigned when you save. Nothing is created
            until then.
          </p>
          <span className="save-actions">
            <Link className="button quiet" href="/app/company">
              Cancel
            </Link>
            <button type="submit">
              {kind === "site" ? "Create site" : "Create company"}
            </button>
          </span>
        </div>
      </form>
    </>
  );
}
