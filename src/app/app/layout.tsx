import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Enhancer } from "../../components/enhancer";
import { navPaths } from "../../components/nav-paths";
import { Shell } from "../../components/shell";
import { viewablePaths } from "../../server/access";
import { currentPeriod, requireSession } from "../../server/auth";
import { readStore } from "../../server/store";
import { companiesFor } from "../../server/users";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  if (!session.companyId) redirect("/companies");
  const period = await currentPeriod();
  const store = readStore();
  // A company this login does not belong to is never opened, even by cookie.
  if (!session.role) {
    redirect("/companies?error=That+company+is+not+open+for+this+login");
  }
  return (
    <Shell
      companies={companiesFor(store, session.userId)}
      companyId={session.companyId}
      period={period}
      username={session.username}
      role={session.role}
      visible={viewablePaths(session.role, store.rights, navPaths)}
    >
      <Suspense fallback={null}>
        <Enhancer />
      </Suspense>
      {children}
    </Shell>
  );
}
