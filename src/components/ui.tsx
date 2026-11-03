import Link from "next/link";
import type { ReactNode } from "react";
import { formatInr } from "../domain/money";
import { dataOrigin, readStore } from "../server/store";
import { Icon, type IconName } from "./icons";

export { Flash } from "./flash";

export function PageHeader({
  title,
  lede,
  action,
  eyebrow,
}: {
  title: string;
  lede?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="page-head">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {lede ? <p>{lede}</p> : null}
      </div>
      {action ? <div className="head-actions">{action}</div> : null}
    </header>
  );
}

/** Says where the figures on a page come from. Mock pay is never shown as real. */
export function Origin() {
  if (dataOrigin(readStore()) === "demo") {
    return (
      <p className="origin demo">
        <Icon name="info" size={14} />
        Demo. Figures are the sample payroll until this company is saved.
      </p>
    );
  }
  return (
    <p className="origin">
      <Icon name="check-circle" size={14} />
      Figures are from this company's payroll store.
    </p>
  );
}

export function Missing({
  title,
  href,
  label,
}: {
  title: string;
  href: string;
  label: string;
}) {
  return (
    <div className="empty form-measure">
      <span className="empty-icon">
        <Icon name="inbox" size={22} />
      </span>
      <h1>{title}</h1>
      <p>
        <Link className="button" href={href}>
          {label}
        </Link>
      </p>
    </div>
  );
}

export function Money({ paise }: { paise: number }) {
  return <span className="figures">{formatInr(paise)}</span>;
}

export function RunStatus({ status }: { status: string | null }) {
  if (status === "locked") return <span className="pill ok">Locked</span>;
  if (status === "in-review")
    return <span className="pill warning">In review</span>;
  if (status === "calculated")
    return <span className="pill info">Calculated</span>;
  return <span className="pill">Not processed</span>;
}

/** An empty state names what is missing and offers the one action that fixes it. */
export function Empty({
  title,
  hint,
  href,
  label,
  icon = "inbox",
  compact = false,
}: {
  title: string;
  hint?: string;
  href?: string;
  label?: string;
  icon?: IconName;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "empty compact" : "empty"}>
      <span className="empty-icon">
        <Icon name={icon} size={compact ? 18 : 22} />
      </span>
      <p>{title}</p>
      {hint ? <p className="empty-hint">{hint}</p> : null}
      {href && label ? (
        <Link className="button" href={href}>
          {label}
        </Link>
      ) : null}
    </div>
  );
}

/** One figure with its label, period, and an optional comparison. */
export function Kpi({
  label,
  value,
  note,
  icon,
  tone,
  href,
  delta,
  muted,
  children,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  icon: IconName;
  tone?: "positive" | "attention" | "danger";
  href?: string;
  delta?: { text: string; direction: "up" | "down" | "flat"; versus: string };
  /** True when there is no figure yet; the dash is shown in a quiet color. */
  muted?: boolean;
  children?: ReactNode;
}) {
  const body = (
    <>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className={tone ? `kpi-icon ${tone}` : "kpi-icon"}>
          <Icon name={icon} size={18} />
        </span>
      </div>
      <div
        className={
          muted ? "kpi-value figures empty-value" : "kpi-value figures"
        }
      >
        {value}
      </div>
      <div className="kpi-foot">
        {delta ? (
          <>
            <span className="delta">
              {delta.direction === "up" ? (
                <Icon name="arrow-up" size={12} />
              ) : delta.direction === "down" ? (
                <Icon name="arrow-down" size={12} />
              ) : null}
              {delta.text}
            </span>
            <span>{delta.versus}</span>
          </>
        ) : null}
        {note ? <span>{note}</span> : null}
      </div>
      {children}
    </>
  );
  return href ? (
    <Link className="kpi" href={href}>
      {body}
    </Link>
  ) : (
    <article className="kpi">{body}</article>
  );
}

export function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
