import { BrandMark, Icon } from "../../components/icons";
import { Empty, Flash } from "../../components/ui";
import { initials } from "../../domain/format";
import { enterCompany, logout } from "../../server/actions";
import { requireSession } from "../../server/auth";
import { readStore } from "../../server/store";
import { companiesFor } from "../../server/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a company" };

/**
 * Not part of the normal sign-in path. Sign-in opens a company directly. This
 * page is where a login lands when it belongs to no company, when the company
 * it had is no longer open to it, or when the person asks for the full list.
 */
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; notice?: string }>;
}) {
  const session = await requireSession();
  const query = await searchParams;
  const q = (query.q ?? "").trim();
  const needle = q.toLowerCase();
  const open = companiesFor(readStore(), session.userId);
  const companies = open.filter((company) => {
    if (!needle) return true;
    return (
      company.name.toLowerCase().includes(needle) ||
      company.shortName.toLowerCase().includes(needle) ||
      company.state.toLowerCase().includes(needle)
    );
  });
  const none = open.length === 0;
  return (
    <div className="auth">
      <aside className="auth-aside">
        <div className="auth-logo">
          <BrandMark size={44} />
          Munshi Pay
        </div>
        <div>
          <h2>Choose a company to work in.</h2>
          <p>
            Each company has its own employees, attendance, and payroll. You can
            switch at any time from the top bar.
          </p>
        </div>
        <small>Signed in as {session.username}</small>
      </aside>
      <main className="auth-main">
        <section className="auth-card wide">
          <div className="brand-row">
            <BrandMark size={36} />
            Munshi Pay
          </div>
          <h1>Select company</h1>
          <p className="lede">
            Signed in as {session.username}. Choose a company to open its
            dashboard.
          </p>
          <Flash notice={query.notice} error={query.error} />
          {none ? null : (
            <form className="company-search" action="/companies" method="get">
              <label>
                <span className="sr-only">Search companies</span>
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search by name, short name, or state"
                />
              </label>
              <button type="submit" className="quiet">
                <Icon name="search" size={16} />
                Search
              </button>
            </form>
          )}
          {none ? (
            <Empty
              icon="company"
              title="This login is not a member of a company."
              hint="Ask the account owner to add you to a company, then sign in again."
            />
          ) : companies.length === 0 ? (
            <Empty
              icon="search"
              title="No company matches that search."
              href="/companies"
              label="Show all companies"
            />
          ) : (
            <div className="company-grid">
              {companies.map((company) => (
                <form
                  key={company.id}
                  className="company-card"
                  action={enterCompany}
                >
                  <input type="hidden" name="companyId" value={company.id} />
                  {q ? <input type="hidden" name="q" value={q} /> : null}
                  <button type="submit" className="quiet">
                    <span className="avatar lg">{initials(company.name)}</span>
                    <span className="menu-text">
                      <strong>{company.name}</strong>
                      <small>
                        {company.shortName}
                        {company.state ? ` · ${company.state}` : ""}
                      </small>
                    </span>
                    <Icon name="arrow-right" size={18} />
                  </button>
                </form>
              ))}
            </div>
          )}
          <form action={logout} style={{ marginTop: "var(--space-5)" }}>
            <button className="quiet" type="submit">
              <Icon name="log-out" size={16} />
              Log out
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
