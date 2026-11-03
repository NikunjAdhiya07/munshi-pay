"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

type Notice = { id: string; kind: "ok" | "danger"; text: string };

/**
 * Success and error messages appear as toasts, so a message never pushes the
 * page down. A success clears itself after a few seconds. An error stays until
 * it is closed, because the person may still be fixing the form it names.
 */
export function Flash({ notice, error }: { notice?: string; error?: string }) {
  const [closed, setClosed] = useState<string[]>([]);
  const notices: Notice[] = [];
  if (notice) notices.push({ id: `ok:${notice}`, kind: "ok", text: notice });
  if (error) notices.push({ id: `err:${error}`, kind: "danger", text: error });
  const open = notices.filter((item) => !closed.includes(item.id));

  const successId = notice ? `ok:${notice}` : null;
  useEffect(() => {
    if (!successId) return;
    const timer = window.setTimeout(
      () => setClosed((list) => [...list, successId]),
      7000,
    );
    return () => window.clearTimeout(timer);
  }, [successId]);

  if (open.length === 0) return null;
  return (
    <div className="toasts">
      {open.map((item) => (
        <div
          key={item.id}
          className={item.kind === "danger" ? "toast danger" : "toast"}
          role={item.kind === "danger" ? "alert" : "status"}
        >
          <span className="toast-icon">
            <Icon
              name={item.kind === "danger" ? "alert" : "check-circle"}
              size={20}
            />
          </span>
          <p>{item.text}</p>
          <button
            type="button"
            className="toast-close quiet"
            aria-label="Dismiss message"
            onClick={() => setClosed((list) => [...list, item.id])}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
