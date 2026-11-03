---
name: responsive-mobile-ux
description: Adapts Munshi Pay layouts across phone, tablet, and desktop without crushing data tables. Use when building or reviewing responsive layout, navigation, tables, dialogs, charts, or touch targets.
version: 0.1.0
updated: 2026-10-06
---

# Responsive payroll UX

Check every changed screen at 320, 375, 390, 430, 768, 1024, 1280, and 1440+. Mobile is a first layout, not a squeezed desktop.

## Breakpoint intent

| Width | Layout |
| --- | --- |
| 320–430 | One column. Bottom or top nav for primary sections. No persistent sidebar. |
| 768–1023 | Sidebar collapses to icons with names in a tooltip or drawer. Two-column only when both columns remain readable. |
| 1024+ | Full sidebar. Tables show priority columns. |
| 1440+ | Do not stretch form fields across the viewport. Keep the form measure. |

## Tables

- Do not fit 15 columns into a phone width.
- Desktop: horizontal scroll with a sticky first column when the table is wider than the pane.
- Column priority is declared per table: primary (always), secondary (from 768px), tertiary (from 1280px).
- Below 768px, use a stacked record list: name, status, the one money figure that matters, then a detail action.
- The mobile list and the desktop table must read the same records and the same filters.

## Touch, dialogs, charts

- Interactive targets are at least 44px on touch layouts. Desktop compact rows may be 36px if the hit target is still 44px or a row click opens the record.
- Dialogs become full-screen sheets under 768px. The close action stays visible. Focus is trapped.
- Charts keep their axis labels. If a chart cannot be read at 320px, show the same numbers as a short table under it.
- Filters that sit in a toolbar on desktop move into a single "Filters" sheet on small screens, with the active count visible.

## Navigation

- Primary nav items stay the same across widths. Do not invent a different information architecture for mobile.
- The company and payroll period remain visible. They collapse into one summary line, not into a hidden menu only.
