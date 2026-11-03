import type { ReactNode } from "react";

/**
 * One small stroke icon set so every screen draws from the same family.
 * Icons are decorative unless a `label` is given.
 */
const paths: Record<string, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="9" rx="1.8" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="1.8" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="1.8" />
      <rect x="3" y="15" width="7.5" height="6" rx="1.8" />
    </>
  ),
  company: (
    <>
      <path d="M4 21V5.5A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V21" />
      <path d="M15 10h3.5A1.5 1.5 0 0 1 20 11.5V21" />
      <path d="M2.5 21h19" />
      <path d="M8 8h3M8 12h3M8 16h3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
      <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6" />
      <path d="M18 14.8c2 .7 3.2 2.4 3.5 5.2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.7-4 3.8-6 8-6s7.3 2 8 6" />
    </>
  ),
  "user-plus": (
    <>
      <circle cx="9.5" cy="8" r="3.8" />
      <path d="M3 20c.7-3.7 3.3-5.8 6.5-5.8 1.4 0 2.6.4 3.6 1" />
      <path d="M18 14v6M15 17h6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </>
  ),
  percent: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l7.8 7.8a1 1 0 0 1 0 1.4l-7.4 7.4a1 1 0 0 1-1.4 0l-7.7-7.7a1 1 0 0 1-.7-.7Z" />
      <circle cx="8.2" cy="8.2" r="1.3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  "calendar-check": (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="m9 15 2.2 2.2L15.5 13" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v2" />
      <path d="M4 7.5v10A2.5 2.5 0 0 0 6.5 20H19a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 6.5" />
      <circle cx="16" cy="14.5" r="1.1" />
    </>
  ),
  rupee: (
    <>
      <path d="M7 5h10M7 9.5h10" />
      <path d="M7 5h2.5a4 4 0 0 1 0 8H7l8.5 7" />
    </>
  ),
  table: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M3.5 15h17M9.5 4.5v15" />
    </>
  ),
  summary: (
    <>
      <path d="M5 20V10M12 20V4M19 20v-7" />
      <path d="M3 20h18" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19.2 8.8a2 2 0 0 0 0-2.8l-1-1a2 2 0 0 0-2.8 0L4 16.5V20Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2.4-1.6L13.2 20.500 12 19.600 10.800 20.500 8.400 18.900 6 20.500Z" />
      <path d="M9 8.500h6M9 12h6" />
    </>
  ),
  loan: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.200" />
      <circle cx="12" cy="12" r="2.600" />
      <path d="M6.500 9.500v.1M17.500 14.500v.1" />
    </>
  ),
  minus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </>
  ),
  leave: (
    <>
      <path d="M5 19c0-7 5-13 14-14 0 9-6 14-13 14" />
      <path d="M5 19c2.500-4 5.500-6.500 9-8" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.500A1.500 1.500 0 0 1 6.500 3H19v15H6.500A1.500 1.500 0 0 0 5 19.500Z" />
      <path d="M5 19.500A1.500 1.500 0 0 0 6.500 21H19v-3" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l5 5v11.500a1.500 1.500 0 0 1-1.500 1.500h-11A1.500 1.500 0 0 1 5 19.500v-15A1.500 1.500 0 0 1 6.500 3" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.500 6v5.500c0 4.600 3.100 8 7.500 9.500 4.400-1.500 7.500-4.900 7.500-9.500V6Z" />
      <path d="m9 12 2.200 2.200L15.500 10" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.500" width="14" height="10" rx="2" />
      <path d="M8 10.500V8a4 4 0 0 1 8 0v2.500" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15Z" />
      <path d="M10 21a2.200 2.200 0 0 0 4 0" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.500 2.800 19.500h18.400Z" />
      <path d="M12 10v4.500M12 17.500v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.500M12 7.500v.1" />
    </>
  ),
  check: <path d="m5 12.500 4.500 4.500L19 7.500" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.200 2.700 2.700L16 9.500" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.500" />
      <path d="m16 16 4.500 4.500" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-up": <path d="m6 15 6-6 6 6" />,
  "chevron-left": <path d="m15 6-6 6 6 6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-up": <path d="M12 19V5M6 11l6-6 6 6" />,
  "arrow-down": <path d="M12 5v14M6 13l6 6 6-6" />,
  sort: (
    <>
      <path d="m8 9 4-4 4 4" />
      <path d="m8 15 4 4 4-4" />
    </>
  ),
  "log-out": (
    <>
      <path d="M10 4H6.500A1.500 1.500 0 0 0 5 5.500v13A1.500 1.500 0 0 0 6.500 20H10" />
      <path d="M15 8l4 4-4 4M19 12H9" />
    </>
  ),
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  pie: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9h-9Z" />
      <path d="M15 3.500A9 9 0 0 1 20.500 9H15Z" />
    </>
  ),
  gift: (
    <>
      <rect x="3.500" y="9" width="17" height="4" rx="1" />
      <path d="M5 13v7h14v-7M12 9v11" />
      <path d="M12 9c-2 0-4.500-.500-4.500-2.500S10 3.500 12 9Zm0 0c2 0 4.500-.500 4.500-2.500S14 3.500 12 9Z" />
    </>
  ),
  sparkle: (
    <path d="M12 3.500 13.800 9l5.700 1.800-5.700 1.800L12 18l-1.800-5.400-5.700-1.800L10.200 9Z" />
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.500-4M4 5v2.500h2.500" />
      <path d="M4 13a8 8 0 0 0 14.500 4M20 19v-2.500h-2.500" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V4h10v5" />
      <rect x="4" y="9" width="16" height="8" rx="2" />
      <path d="M7 14h10v6H7Z" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13.500 6.500 5h11L20 13.500" />
      <path d="M4 13.500V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5.500h-5l-1 2.500h-4l-1-2.500Z" />
    </>
  ),
  filter: <path d="M4 5h16l-6 8v6l-4-2v-4Z" />,
  more: (
    <>
      <circle cx="5.500" cy="12" r="1.200" />
      <circle cx="12" cy="12" r="1.200" />
      <circle cx="18.500" cy="12" r="1.200" />
    </>
  ),
  swap: (
    <>
      <path d="M7 4 3.500 7.500 7 11M3.500 7.500H17" />
      <path d="m17 13 3.500 3.500L17 20M20.500 16.500H7" />
    </>
  ),
};

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 18,
  label,
  className,
}: {
  name: IconName | string;
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `icon ${className}` : "icon"}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {paths[name] ?? paths.dashboard}
    </svg>
  );
}

/** The product mark: a rupee stroke inside a rounded tile. */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className="brand-mark"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" rx="11" fill="currentColor" />
      <path
        d="M12 12h16M12 17.500h16M14 12c7 0 9 4.500 5 8.500l-5 4.500 12 4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.600"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
