import { logout, setPeriod, switchCompany } from "../server/actions";
import type { Company } from "../server/model";
import { AppFrame, MenuButton } from "./app-frame";
import {
  CompanySwitcher,
  Crumbs,
  MenuLink,
  PeriodSwitcher,
  UserMenu,
} from "./chrome";
import { BrandMark } from "./icons";
import { SideNav } from "./nav";
import { periodLabel } from "./ui";

export function Shell({
  companies,
  companyId,
  period,
  username,
  role,
  visible,
  children,
}: {
  companies: Company[];
  companyId: string;
  period: string;
  username: string;
  role: string;
  visible: string[];
  children: React.ReactNode;
}) {
  const company = companies.find((item) => item.id === companyId);
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <AppFrame
      sidebar={
        <>
          <div className="sidebar-brand">
            <BrandMark size={38} />
            <div>
              <strong>Munshi Pay</strong>
              <span>Payroll workspace</span>
            </div>
          </div>
          <div className="sidebar-company">
            <small>Company</small>
            <strong>{company?.name ?? "Company"}</strong>
          </div>
          <SideNav visible={visible} />
          <div className="sidebar-foot">
            Signed in as {username} · {roleLabel}
          </div>
        </>
      }
    >
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-start">
          <MenuButton />
          <Crumbs company={company?.name ?? "Company"} />
        </div>
        <div className="topbar-end">
          <PeriodSwitcher
            period={period}
            label={periodLabel(period)}
            action={setPeriod}
          />
          <CompanySwitcher
            companies={companies.map((item) => ({
              id: item.id,
              name: item.name,
              shortName: item.shortName,
              state: item.state,
            }))}
            currentId={companyId}
            action={switchCompany}
          />
        </div>
        <div className="topbar-user">
          <UserMenu username={username} role={roleLabel} logout={logout}>
            {companies.length > 1 ? (
              <MenuLink href="/companies" icon="swap">
                All companies
              </MenuLink>
            ) : null}
          </UserMenu>
        </div>
      </header>
      <main className="content" id="main" tabIndex={-1}>
        {children}
      </main>
    </AppFrame>
  );
}
