# Payroll visual tokens

Use these values. They are defined once as CSS variables at the top of `src/app/globals.css`; use the variable, not the hex. Do not introduce a second palette.

## Color

| Role | Value | Use |
| --- | --- | --- |
| Ink | `#0F172A` | Primary text |
| Ink muted | `#5B6679` | Secondary text |
| Background | `#F3F5FA` | App background |
| Surface | `#FFFFFF` | Tables, dialogs, form panels, cards |
| Line | `#E2E6EF` (strong `#CBD2E0`) | Borders, row dividers |
| Accent | `#2F55D4` | Primary action, active nav, links |
| Accent hover and pressed | `#2545B0`, `#1D3A98` | Primary hover and pressed |
| Accent soft | `#EAEFFD` | Selected rows, icon tiles, info banners |
| Navigation | `#0B1226` | Sidebar and the sign-in brand panel |
| Positive | `#067647` (soft `#E7F6EE`) | Locked, paid, balanced |
| Attention | `#B54708` (soft `#FEF3E2`) | In review, pending, warning |
| Danger | `#B42318` (soft `#FEECEB`) | Failed validation, critical exception, destructive |
| Chart series | `--chart-1` to `--chart-6` | Charts only, never for status |

Positive is for completed payroll states, not for decoration. A month that is processed but has exceptions uses Attention, not Danger. Status is never carried by color alone: it also has a word, and a pill has a dot.

Body text on Background or Surface must meet WCAG AA. Muted ink is for secondary text at 13px or larger; do not use it for critical figures.

## Type

- UI: IBM Plex Sans (400, 500, 600, 700), loaded in `src/app/layout.tsx` as `--font-sans`. Fall back to Segoe UI, then sans-serif.
- Figures and identifiers: IBM Plex Mono as `--font-mono`, with `font-variant-numeric: tabular-nums`. Money in tables and cards is right-aligned.
- Two families maximum.
- Page title 26px, semibold. Section title 16px, semibold. Body 14px. Meta 12–13px.
- Do not set product UI in a display serif.
- Exact money uses `formatInr` or `Money`. `compactInr` (₹1.4L) is for chart labels only and is never the only place a figure appears.

## Space and radius

4px base: 4, 8, 12, 16, 24, 32.

- Control height: 40px default, 44px on touch layouts.
- Radius: 6px small, 10px controls, 14px panels, cards, and dialogs. Avatars may be circular.
- Shadows are soft and light: `--shadow-xs` on cards, `--shadow-md` on menus, popovers, and dialogs.

## Shell

- Desktop: fixed left navigation, 268px, navigation color, with the company box, grouped items with icons, and the active item marked. Below 1024px it becomes a drawer opened from the top bar.
- Top bar (64px) holds breadcrumbs, the payroll month stepper, the company switcher, and the account menu.
- Content is at most 1400px wide. Form panels are at most 820px; a long profile form uses sections in a responsive grid instead of one long column.
- Sign-in is a split screen: brand panel and form. The brand panel states only things the product does.

## Components

- Buttons: primary, `.quiet`, `.ghost`, `.danger`, and `.sm`. A button in a pending submit shows a spinner through `data-pending`.
- Tables sort and filter. A large list uses `DataTable`; the employees list keeps its server-side sort, search, and pager. On a phone a table becomes stacked cards with each value labelled.
- Feedback: a toast for success (dismisses after 7 seconds) and for errors (stays until dismissed), never a bare paragraph.
- Destructive actions use a confirmation dialog. A panel with `aria-labelledby="delete-title"` or the `.confirm` class becomes a modal alert dialog with focus held inside, the page behind inert, and Escape taking the cancel link.
- Empty states say what is missing and carry one clear next step, not one per panel.
- A sensitive identifier (account, PAN, TAN, Aadhaar) shows masked and keeps its saved value when submitted as shown.
- Not-found and error screens use `StatusCard`.
