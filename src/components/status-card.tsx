import type { ReactNode } from "react";
import { BrandMark } from "./icons";

/**
 * A centred message for pages that cannot show payroll data: not found and
 * error screens. It uses plain markup so error boundaries can render it.
 */
export function StatusCard({
  code,
  title,
  children,
  actions,
  standalone = false,
}: {
  code: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  standalone?: boolean;
}) {
  const Tag = standalone ? "main" : "div";
  return (
    <Tag className={standalone ? "status-page" : "status-page inline"}>
      <section
        className="status-card"
        role="alert"
        aria-labelledby="status-title"
      >
        <BrandMark size={40} />
        <p className="status-code">{code}</p>
        <h1 id="status-title">{title}</h1>
        {children ? <p className="status-text">{children}</p> : null}
        {actions ? <div className="status-actions">{actions}</div> : null}
      </section>
    </Tag>
  );
}
