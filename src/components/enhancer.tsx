"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const DIALOG = '[aria-labelledby="delete-title"], .panel.confirm';

/**
 * Small, app-wide behavior that every screen shares:
 * - a submitted form button shows a spinner until the server answers;
 * - a confirmation panel behaves as a dialog: focus moves in and stays in,
 *   the page behind is inert, and Escape takes the cancel link.
 */
export function Enhancer() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  // Loading feedback on submit.
  useEffect(() => {
    const timers = new Set<number>();
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const submitter =
        event.submitter ??
        form.querySelector("button[type=submit], button:not([type])");
      if (!(submitter instanceof HTMLButtonElement)) return;
      if (submitter.closest(".popover, .period, .toast")) return;
      submitter.dataset.pending = "true";
      const timer = window.setTimeout(() => {
        delete submitter.dataset.pending;
        timers.delete(timer);
      }, 15000);
      timers.add(timer);
    };
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("submit", onSubmit);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  // A new page or query means the last submit was answered.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on every navigation
  useEffect(() => {
    for (const node of document.querySelectorAll("[data-pending]")) {
      delete (node as HTMLElement).dataset.pending;
    }
  }, [pathname, search]);

  // Confirmation panels.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-check on every navigation
  useEffect(() => {
    const dialog = document.querySelector<HTMLElement>(DIALOG);
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.tabIndex = -1;
    const behind = [
      ...document.querySelectorAll<HTMLElement>(".sidebar, .topbar"),
      ...document.querySelectorAll<HTMLElement>(".content > *"),
    ].filter((node) => node !== dialog && !node.contains(dialog));
    for (const node of behind) node.setAttribute("inert", "");

    const focusable = () =>
      [
        ...dialog.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea",
        ),
      ].filter((node) => node.offsetParent !== null);
    (
      dialog.querySelector<HTMLElement>("input:not([type=hidden])") ??
      focusable()[0] ??
      dialog
    ).focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const cancel =
          dialog.querySelector<HTMLAnchorElement>("a.quiet, a[href]");
        if (cancel) {
          event.preventDefault();
          cancel.click();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      for (const node of behind) node.removeAttribute("inert");
      opener?.focus?.();
    };
  }, [pathname, search]);

  return null;
}
