import { CompanyFieldSections } from "../../../../components/company-fields";
import { Flash, Missing, Origin, PageHeader } from "../../../../components/ui";
import { can } from "../../../../server/access";
import { saveCompany } from "../../../../server/actions";
import { requireView } from "../../../../server/auth";
import { readStore } from "../../../../server/store";

type Query = Record<string, string | undefined>;

export default async function CompanyProfilePage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const session = await requireView("company");
  const query = await searchParams;
  const store = readStore();
  const company = store.companies.find((item) => item.id === session.companyId);
  if (!company) {
    return (
      <Missing
        title="Company not found."
        href="/app/company"
        label="Back to companies"
      />
    );
  }
  const editable = can(session.role, store.rights, "company", "edit");
  const banks = store.misc
    .filter((item) => item.companyId === company.id && item.type === "bank")
    .map((item) => item.description)
    .sort((a, b) => a.localeCompare(b));

  return (
    <>
      <PageHeader
        title={company.name}
        eyebrow={`Company ${company.number} · ${company.shortName}`}
        lede="Company profile. Statutory percents stay empty until a rule is confirmed. Blank PF or ESI percent calculates as zero."
      />
      <Flash notice={query.notice} error={query.error} />
      <Origin />
      <form className="profile-form" action={saveCompany}>
        <CompanyFieldSections
          company={company}
          query={query}
          editable={editable}
          banks={banks}
        />
        {editable ? (
          <div className="save-bar">
            <p>Changes are saved to this company only.</p>
            <button type="submit">Save company profile</button>
          </div>
        ) : null}
      </form>
    </>
  );
}
