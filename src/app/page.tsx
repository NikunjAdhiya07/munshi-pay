import { redirect } from "next/navigation";
import { BrandMark, Icon } from "../components/icons";
import { PasswordField } from "../components/password-field";
import { login } from "../server/actions";
import { currentSession } from "../server/auth";

export const metadata = { title: "Sign in" };

const POINTS = [
  { icon: "wallet", text: "Process a month and review every exception" },
  { icon: "company", text: "Each company's data stays in its own workspace" },
  { icon: "upload", text: "Import and export payroll data with Excel" },
  { icon: "lock", text: "Lock a finished month and keep an audit trail" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const session = await currentSession();
  if (session?.companyId) redirect("/app");
  if (session) redirect("/companies");
  const query = await searchParams;
  return (
    <div className="auth">
      <aside className="auth-aside">
        <div className="auth-logo">
          <BrandMark size={44} />
          Munshi Pay
        </div>
        <div>
          <h2>Payroll your team can trust.</h2>
          <p>
            Salary, attendance, deductions, and statutory registers for every
            company you manage, in one calm workspace.
          </p>
          <ul className="auth-points">
            {POINTS.map((point) => (
              <li key={point.text}>
                <Icon name={point.icon} size={18} />
                {point.text}
              </li>
            ))}
          </ul>
        </div>
        <small>Munshi Pay payroll platform</small>
      </aside>
      <main className="auth-main">
        <form className="auth-card" action={login}>
          <div className="brand-row">
            <BrandMark size={36} />
            Munshi Pay
          </div>
          <h1>Welcome back</h1>
          <p className="lede">Sign in to open your company dashboard.</p>
          {query.error ? (
            <p className="form-error" role="alert">
              <Icon name="alert" size={18} />
              {query.error}
            </p>
          ) : null}
          {query.notice ? (
            <p className="form-error ok" role="status">
              <Icon name="check-circle" size={18} />
              {query.notice}
            </p>
          ) : null}
          <label>
            <span>Username</span>
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </label>
          <PasswordField name="password" label="Password" />
          <button type="submit" className="block">
            Sign in
          </button>
          <p className="auth-foot">
            Trouble signing in? Ask the account owner to reset your password.
          </p>
        </form>
      </main>
    </div>
  );
}
