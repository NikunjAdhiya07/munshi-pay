"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { initials, shiftPeriod } from "../domain/format";
import { Icon } from "./icons";
import { currentNavItem } from "./nav-paths";

type FormAction = (form: FormData) => void | Promise<void>;

/** Open/close state for a dropdown: closes on outside press, Escape, or `closeOn` changing. */
function usePopover(closeOn: string) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close when the page or company changes
  useEffect(() => {
    setOpen(false);
  }, [closeOn]);

  useEffect(() => {
    if (!open) return;
    const onPress = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        root.current?.querySelector<HTMLElement>("[data-trigger]")?.focus();
      }
    };
    document.addEventListener("mousedown", onPress);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPress);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, root };
}

/** Company, then the page the person is on, so the current place is always named. */
export function Crumbs({ company }: { company: string }) {
  const pathname = usePathname();
  const item = currentNavItem(pathname);
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <span className="crumb-group">{company}</span>
      <Icon name="chevron-right" size={14} className="crumb-group" />
      {item && item.href !== "/app" ? (
        <>
          <span className="crumb-group">{item.group}</span>
          <Icon name="chevron-right" size={14} className="crumb-group" />
          <strong aria-current="page">{item.label}</strong>
        </>
      ) : (
        <strong aria-current="page">{item ? item.label : "Munshi Pay"}</strong>
      )}
    </nav>
  );
}

export type CompanyOption = {
  id: string;
  name: string;
  shortName: string;
  state: string;
};

export function CompanySwitcher({
  companies,
  currentId,
  action,
}: {
  companies: CompanyOption[];
  currentId: string;
  action: FormAction;
}) {
  const pathname = usePathname();
  const { open, setOpen, root } = usePopover(`${pathname}|${currentId}`);
  const [query, setQuery] = useState("");
  const listId = useId();
  const current = companies.find((item) => item.id === currentId);
  const needle = query.trim().toLowerCase();
  const shown = companies.filter(
    (item) =>
      !needle ||
      item.name.toLowerCase().includes(needle) ||
      item.shortName.toLowerCase().includes(needle) ||
      item.state.toLowerCase().includes(needle),
  );

  const label = (
    <>
      <span className="avatar">{initials(current?.name ?? "Company")}</span>
      <span className="chip-stack">
        <small>Company</small>
        <span className="chip-label">{current?.name ?? "Company"}</span>
      </span>
    </>
  );

  // One company: nothing to switch, so no menu is offered.
  if (companies.length <= 1) {
    return (
      <div className="chip-btn" style={{ cursor: "default" }}>
        {label}
      </div>
    );
  }

  return (
    <div className="menu" ref={root}>
      <button
        type="button"
        className="chip-btn"
        data-trigger
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
      >
        {label}
        <Icon name="chevron-down" size={16} />
      </button>
      {open ? (
        <div className="popover" id={listId}>
          <p className="popover-title">Switch company</p>
          {companies.length > 5 ? (
            <div className="menu-search">
              <input
                type="search"
                placeholder="Search companies"
                aria-label="Search companies"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                // biome-ignore lint/a11y/noAutofocus: the search box is the first thing wanted when the list is long
                autoFocus
              />
            </div>
          ) : null}
          <form action={action} className="popover-list">
            <input type="hidden" name="from" value={pathname} />
            {shown.map((item) =>
              item.id === currentId ? (
                <button
                  key={item.id}
                  type="button"
                  className="menu-item"
                  aria-current="true"
                  onClick={() => setOpen(false)}
                >
                  <span className="avatar">{initials(item.name)}</span>
                  <span className="menu-text">
                    <strong>{item.name}</strong>
                    <small>
                      {item.shortName} · {item.state || "No state"}
                    </small>
                  </span>
                  <Icon name="check" size={16} label="Current company" />
                </button>
              ) : (
                <button
                  key={item.id}
                  type="submit"
                  name="companyId"
                  value={item.id}
                  className="menu-item"
                >
                  <span className="avatar">{initials(item.name)}</span>
                  <span className="menu-text">
                    <strong>{item.name}</strong>
                    <small>
                      {item.shortName} · {item.state || "No state"}
                    </small>
                  </span>
                </button>
              ),
            )}
            {shown.length === 0 ? (
              <p className="popover-empty">No company matches “{query}”.</p>
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function PeriodSwitcher({
  period,
  label,
  action,
}: {
  period: string;
  label: string;
  action: FormAction;
}) {
  const pathname = usePathname();
  const { open, setOpen, root } = usePopover(`${pathname}|${period}`);
  const previous = shiftPeriod(period, -1);
  const next = shiftPeriod(period, 1);
  const recent = Array.from({ length: 6 }, (_, index) =>
    shiftPeriod(period, index - 3),
  ).filter((item): item is string => Boolean(item));
  const monthName = (value: string) =>
    new Intl.DateTimeFormat("en-IN", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}-01T00:00:00Z`));

  return (
    <div className="period menu" ref={root}>
      {previous ? (
        <form action={action}>
          <input type="hidden" name="from" value={pathname} />
          <input type="hidden" name="period" value={previous} />
          <button
            type="submit"
            className="period-step quiet"
            aria-label={`Previous month, ${monthName(previous)}`}
          >
            <Icon name="chevron-left" size={18} />
          </button>
        </form>
      ) : null}
      <div className="period-pick">
        <button
          type="button"
          className="chip-btn"
          data-trigger
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon name="calendar" size={16} />
          <span className="chip-stack">
            <small>Payroll month</small>
            <span className="period-text">{label}</span>
          </span>
        </button>
        {open ? (
          <div className="popover narrow">
            <p className="popover-title">Payroll month</p>
            <form action={action} className="menu-search">
              <input type="hidden" name="from" value={pathname} />
              <input
                type="month"
                name="period"
                defaultValue={period}
                aria-label="Choose a month"
                onChange={(event) => {
                  if (event.target.value)
                    event.currentTarget.form?.requestSubmit();
                }}
              />
            </form>
            <div className="menu-sep" />
            {recent.map((item) => (
              <form action={action} key={item}>
                <input type="hidden" name="from" value={pathname} />
                <button
                  type="submit"
                  name="period"
                  value={item}
                  className="menu-item"
                  aria-current={item === period ? "true" : undefined}
                >
                  <span className="menu-text">
                    <strong>{monthName(item)}</strong>
                  </span>
                  {item === period ? <Icon name="check" size={16} /> : null}
                </button>
              </form>
            ))}
          </div>
        ) : null}
      </div>
      {next ? (
        <form action={action}>
          <input type="hidden" name="from" value={pathname} />
          <input type="hidden" name="period" value={next} />
          <button
            type="submit"
            className="period-step quiet"
            aria-label={`Next month, ${monthName(next)}`}
          >
            <Icon name="chevron-right" size={18} />
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function UserMenu({
  username,
  role,
  logout,
  children,
}: {
  username: string;
  role: string;
  logout: FormAction;
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const { open, setOpen, root } = usePopover(pathname);
  return (
    <div className="menu" ref={root}>
      <button
        type="button"
        className="chip-btn"
        data-trigger
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Account menu for ${username}`}
        onClick={() => setOpen(!open)}
      >
        <span className="avatar round">{initials(username)}</span>
      </button>
      {open ? (
        <div className="popover narrow">
          <div className="menu-item" style={{ cursor: "default" }}>
            <span className="avatar round lg">{initials(username)}</span>
            <span className="menu-text">
              <strong>{username}</strong>
              <small>{role}</small>
            </span>
          </div>
          <div className="menu-sep" />
          {children}
          <form action={logout}>
            <button type="submit" className="menu-item">
              <Icon name="log-out" size={18} />
              <span className="menu-text">
                <strong>Log out</strong>
              </span>
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="menu-item">
      <Icon name={icon} size={18} />
      <span className="menu-text">
        <strong>{children}</strong>
      </span>
    </Link>
  );
}
