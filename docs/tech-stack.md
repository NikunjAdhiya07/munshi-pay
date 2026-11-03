# Technology stack

Only selected or installed technologies are listed. "Selected" means a decision exists and the tool is not in the repo yet.

| Layer | Choice | Status |
| --- | --- | --- |
| Language | TypeScript 7 | Installed |
| Application | Next.js 16 App Router and React 19 | Installed. Foundation page only |
| Styling | Global CSS tokens from `skills/payroll-ui-ux/tokens.md`. Tailwind is selected for the design-system phase | Tokens installed on the foundation page. Tailwind not installed |
| Server shape | Modular monolith in the same app | Selected (DEC-002) |
| Database | PostgreSQL | Selected for production, not provisioned |
| Local store | JSON file `data/store.json` | Installed for development (DEC-010) |
| Payroll math | `src/domain/engine.ts` | Installed. Percents come from company settings |
| Schema and migrations | Drizzle | Selected for P4, not installed |
| Authentication | Server sessions and RBAC. Library chosen at P3 | Open |
| Money | Integer minor units | Accepted policy (DEC-003), not coded |
| Board and docs generation | Node.js script `board/generate.mjs` | Installed |
| Board tests | Node.js built-in test runner | Installed |
| UI components | Project components on the payroll tokens. Primitive library chosen with the shell | Open |
| Deployment | Not chosen | Open |
| Monitoring | Not chosen | Open |
| External payroll or filing APIs | None | Not used |
| Files | Bunny Storage zone, delivered by a Bunny CDN pull zone | Selected (DEC-011), not installed |
| Workbooks | ExcelJS | Installed for .xlsx import samples and parsing |

Configured agent names live in `board/state.json` under `models` and can be changed without editing the generator.
