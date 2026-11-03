"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Icon } from "./icons";

const NavContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

/**
 * The shell frame. On a phone or tablet the side menu is a drawer. It closes
 * when a page opens, when the backdrop is pressed, and on Escape.
 */
export function AppFrame({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the drawer whenever the page changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <NavContext.Provider value={{ open, setOpen }}>
      <div className="app" data-nav={open ? "open" : "closed"}>
        <aside
          id="app-sidebar"
          className="sidebar"
          aria-label="Application menu"
        >
          {sidebar}
          <button
            type="button"
            className="nav-close quiet"
            onClick={() => setOpen(false)}
          >
            Close menu
          </button>
        </aside>
        <div
          className="scrim"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
        <div className="workspace">{children}</div>
      </div>
    </NavContext.Provider>
  );
}

export function MenuButton() {
  const { open, setOpen } = useContext(NavContext);
  return (
    <button
      type="button"
      className="menu-open quiet"
      aria-controls="app-sidebar"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    >
      <Icon name="menu" size={20} />
      <span className="sr-only">Menu</span>
    </button>
  );
}
