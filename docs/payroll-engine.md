# Payroll engine

`calculatePayroll` in `src/domain/engine.ts` is the only pay calculation.

Inputs are a salary base, a stored rate, paid days, category percents, configured PF and ESI percents, a professional-tax amount already chosen from slabs, loan installment, and other deductions.

Rules that are implemented:

- Monthly salary uses the stored gross. Per-day salary is rate times paid days.
- Basic and DA are category percents of that gross. Each percent of paise follows DEC-016: half a paisa rounds away from zero. The remainder is Other, so the three sum to gross.
- PF is the configured employee percent of basic or gross, capped only when a limit is stored and the mode is limited.
- ESI is the configured employee percent. If no percent is stored, the amount is zero.
- A wage base above the company ESI exception limit is a warning. The reference showed 21000, and that value is the seeded default.
- Missing rate, missing category, and a left employee are not payable.

PF, ESI, and professional-tax statutory formulas are not guessed. See the human-review item on the execution board.
