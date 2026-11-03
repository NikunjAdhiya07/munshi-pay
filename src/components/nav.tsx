"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "./icons";
import { currentNavItem, navGroups } from "./nav-paths";

/** `visible` is the paths this role may open. Items it may not open are left out. */
export function SideNav({ visible }: { visible: string[] }) {
  const pathname = usePathname();
  const active = currentNavItem(pathname)?.href ?? null;
  const shown = new Set(visible);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  return (
    <nav aria-label="Primary">
      {navGroups.map((group) => {
        const items = group.items.filter((item) => shown.has(item.href));
        if (items.length === 0) return null;
        const single = group.items.length === 1 && group.label === "Overview";
        // A group holding the current page is never collapsed.
        const hasActive = items.some((item) => item.href === active);
        const isOpen = hasActive || !collapsed.includes(group.label);
        const listId = `nav-${group.label.toLowerCase()}`;
        return (
          <div className="nav-group" key={group.label}>
            {single ? null : (
              <button
                type="button"
                className="nav-heading"
                aria-expanded={isOpen}
                aria-controls={listId}
                onClick={() =>
                  setCollapsed((list) =>
                    list.includes(group.label)
                      ? list.filter((name) => name !== group.label)
                      : [...list, group.label],
                  )
                }
              >
                {group.label}
                <Icon name="chevron-down" size={14} />
              </button>
            )}
            <div className="nav-list" id={listId} hidden={!isOpen}>
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-item"
                  aria-current={item.href === active ? "page" : undefined}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
