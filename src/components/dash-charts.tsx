"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import type {
  Contribution,
  PayBand,
  WaterfallStep,
} from "../domain/dashboardStats";
import { changeLabel, changePercent, compactInr } from "../domain/format";
import { formatInr } from "../domain/money";
import { PART_COLORS } from "./charts";
import { Icon } from "./icons";

/* ------------------------------------------------------------------ */
/* Month-by-month trend                                                */
/* ------------------------------------------------------------------ */

export type TrendMonth = {
  period: string;
  /** Short axis label, such as "Oct 26". */
  label: string;
  /** Full label for the tooltip, such as "October 2026". */
  longLabel: string;
  gross: number;
  deductions: number;
  net: number;
  payable: number;
};

const TREND_SERIES = [
  { key: "gross", name: "Gross", color: "var(--chart-1)" },
  { key: "deductions", name: "Deductions", color: "var(--chart-3)" },
  { key: "net", name: "Net", color: "var(--chart-2)" },
] as const;

type TrendKey = (typeof TREND_SERIES)[number]["key"];

/**
 * Gross, deductions, and net across processed months. Series can be switched
 * off, hovering or focusing a month shows its figures, and choosing a month
 * opens the dashboard on it.
 */
/** Round a step up to 1, 2 or 5 times a power of ten. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

export function TrendExplorer({
  months,
  current,
  onSelect,
}: {
  months: TrendMonth[];
  current: string;
  /** The same action the period switcher posts to. */
  onSelect: (form: FormData) => Promise<void>;
}) {
  const [off, setOff] = useState<TrendKey[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  const [pending, startTransition] = useTransition();
  const width = 640;
  const height = 300;
  const left = 54;
  const right = 14;
  const top = 16;
  const bottom = 12;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const slot = plotW / months.length;
  const x = (index: number) => left + slot * (index + 0.5);
  const visible = TREND_SERIES.filter((item) => !off.includes(item.key));
  const values = months.flatMap((month) =>
    visible.map((item) => month[item.key]),
  );
  const peak = Math.max(1, ...values);
  // From zero is the honest default. Fitting to the range lets small month
  // to month changes show, and the axis labels say where it starts.
  let lo = 0;
  const base = niceStep(peak / 4);
  let hi = base * 4;
  let ticks = [0, 1, 2, 3, 4].map((step) => step * base);
  if (zoom) {
    const min = Math.min(...values);
    const span = Math.max(peak - min, peak * 0.05, 1);
    const step = niceStep((span * 1.8) / 4);
    lo = Math.max(0, Math.floor((min - span * 0.4) / step) * step);
    hi = Math.max(lo + step, Math.ceil((peak + span * 0.4) / step) * step);
    ticks = [];
    for (let tick = lo; tick <= hi + 1; tick += step) ticks.push(tick);
  }
  const y = (value: number) =>
    top + plotH - ((value - lo) / Math.max(hi - lo, 1)) * plotH;
  const currentIndex = months.findIndex((month) => month.period === current);
  const shown = hover ?? null;
  const tipMonth = shown === null ? null : months[shown];
  const tipPrevious = shown !== null && shown > 0 ? months[shown - 1] : null;

  function choose(period: string) {
    if (period === current || pending) return;
    startTransition(async () => {
      const form = new FormData();
      form.set("period", period);
      form.set("from", "/app");
      await onSelect(form);
    });
  }

  function toggle(key: TrendKey) {
    setOff((list) => {
      if (list.includes(key)) return list.filter((item) => item !== key);
      // At least one series stays on, or the chart would be empty.
      return list.length >= TREND_SERIES.length - 1 ? list : [...list, key];
    });
  }

  return (
    <div className="explorer" data-busy={pending || undefined}>
      <ul className="legend-toggles" aria-label="Series">
        {TREND_SERIES.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className="legend-toggle"
              aria-pressed={!off.includes(item.key)}
              onClick={() => toggle(item.key)}
            >
              <span
                className="swatch"
                style={{ background: item.color }}
                aria-hidden="true"
              />
              {item.name}
            </button>
          </li>
        ))}
        <li className="legend-spacer">
          <button
            type="button"
            className="legend-toggle"
            aria-pressed={zoom}
            onClick={() => setZoom((value) => !value)}
          >
            Fit to range
          </button>
        </li>
      </ul>
      <div className="explorer-plot">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="chart"
          role="img"
          aria-label={`Gross, deductions, and net for ${months.length} processed months. Latest ${months[months.length - 1].longLabel}: gross ${formatInr(months[months.length - 1].gross)}, net ${formatInr(months[months.length - 1].net)}.`}
        >
          <title>Payroll trend by month</title>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className={tick === lo ? "axis" : "grid-line"}
                x1={left}
                x2={width - right}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text
                x={left - 8}
                y={y(tick) + 4}
                textAnchor="end"
                className="figures"
              >
                {compactInr(tick)}
              </text>
            </g>
          ))}
          {currentIndex >= 0 ? (
            <rect
              className="current-band"
              x={left + slot * currentIndex}
              y={top}
              width={slot}
              height={plotH}
              rx="8"
            />
          ) : null}
          {shown !== null ? (
            <line
              className="crosshair"
              x1={x(shown)}
              x2={x(shown)}
              y1={top}
              y2={top + plotH}
            />
          ) : null}
          {visible.map((item, seriesIndex) => {
            const coords = months.map((month, index) => ({
              x: x(index),
              y: y(month[item.key]),
            }));
            const path = coords
              .map(
                (c, index) =>
                  `${index === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`,
              )
              .join(" ");
            const area = `${path} L${coords[coords.length - 1].x.toFixed(1)} ${y(lo)} L${coords[0].x.toFixed(1)} ${y(lo)} Z`;
            return (
              <g key={item.key}>
                {seriesIndex === 0 ? (
                  <path d={area} fill={item.color} className="trend-area" />
                ) : null}
                <path
                  d={path}
                  pathLength={1}
                  className="trend-line"
                  fill="none"
                  stroke={item.color}
                />
                {coords.map((c, index) => (
                  <circle
                    key={months[index].period}
                    className={
                      shown === index || months[index].period === current
                        ? "dot active"
                        : "dot"
                    }
                    cx={c.x}
                    cy={c.y}
                    r={shown === index ? 6 : 4.5}
                    fill="var(--surface)"
                    stroke={item.color}
                    strokeWidth="2.5"
                  />
                ))}
              </g>
            );
          })}
          {months.map((month, index) => (
            // Pointer-only hit areas. The month buttons below do the same
            // job for keyboard and screen reader users.
            // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only convenience, the month buttons are the accessible control
            <rect
              key={month.period}
              x={left + slot * index}
              y={top}
              width={slot}
              height={plotH}
              fill="transparent"
              className={month.period === current ? "hit" : "hit pick"}
              onPointerEnter={() => setHover(index)}
              onPointerLeave={() => setHover(null)}
              onClick={() => choose(month.period)}
            />
          ))}
        </svg>
        {tipMonth ? (
          <div
            className="tip-card"
            role="status"
            style={{
              ["--x" as string]: `${(x(shown ?? 0) / width) * 100}%`,
            }}
          >
            <strong>{tipMonth.longLabel}</strong>
            <dl>
              {visible.map((item) => (
                <div key={item.key}>
                  <dt>
                    <span
                      className="swatch"
                      style={{ background: item.color }}
                      aria-hidden="true"
                    />
                    {item.name}
                  </dt>
                  <dd className="figures">{formatInr(tipMonth[item.key])}</dd>
                </div>
              ))}
            </dl>
            <p>
              {tipMonth.payable} paid{" "}
              {tipMonth.payable === 1 ? "line" : "lines"}
              {tipPrevious
                ? (() => {
                    const change = changePercent(tipMonth.net, tipPrevious.net);
                    return change === null
                      ? ""
                      : ` · net ${changeLabel(change)} on ${tipPrevious.label}`;
                  })()
                : ""}
            </p>
            {tipMonth.period !== current ? (
              <p className="tip-hint">Select to open this month</p>
            ) : (
              <p className="tip-hint">Showing this month</p>
            )}
          </div>
        ) : null}
      </div>
      <div
        className="month-chips"
        style={{
          marginLeft: `${(left / width) * 100}%`,
          marginRight: `${(right / width) * 100}%`,
          gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
        }}
      >
        {months.map((month, index) => (
          <button
            key={month.period}
            type="button"
            className="month-chip"
            aria-current={month.period === current ? "true" : undefined}
            aria-label={
              month.period === current
                ? `${month.longLabel}, showing now`
                : `Open ${month.longLabel}`
            }
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(index)}
            onBlur={() => setHover(null)}
            onClick={() => choose(month.period)}
          >
            {month.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gross to net                                                        */
/* ------------------------------------------------------------------ */

/**
 * One bar for the whole gross, split into net pay and each deduction, with
 * the bridge from gross down to net beside it. Hovering a row or a segment
 * lights up the other.
 */
export function GrossToNet({ steps }: { steps: WaterfallStep[] }) {
  const [active, setActive] = useState<string | null>(null);
  const gross = steps[0]?.paise ?? 0;
  const net = steps[steps.length - 1]?.paise ?? 0;
  const parts = steps.filter(
    (step) => step.kind !== "total" || step.key === "net",
  );
  const pct = (value: number) =>
    gross > 0 ? Math.max(0, (Math.abs(value) / gross) * 100) : 0;
  const ratio = gross > 0 ? (net / gross) * 100 : 0;
  return (
    <div className="g2n">
      <div className="g2n-head">
        <div>
          <span className="g2n-label">Net pay</span>
          <strong className="figures g2n-net">{formatInr(net)}</strong>
        </div>
        <div className="g2n-ratio">
          <strong className="figures">{ratio.toFixed(1)}%</strong>
          <span>of {formatInr(gross)} gross</span>
        </div>
      </div>
      <div
        className="g2n-bar"
        role="img"
        aria-label={`Gross ${formatInr(gross)} splits into net ${formatInr(net)} and ${parts.length - 1} deduction ${parts.length - 1 === 1 ? "part" : "parts"}.`}
        onPointerLeave={() => setActive(null)}
      >
        {parts.map((step) => (
          <span
            key={step.key}
            className={active === step.key ? "seg active" : "seg"}
            data-dim={active && active !== step.key ? "true" : undefined}
            style={{
              width: `${Math.max(pct(step.kind === "total" ? step.paise : step.paise), 0.8)}%`,
              background: PART_COLORS[step.key] ?? "var(--chart-5)",
            }}
            onPointerEnter={() => setActive(step.key)}
          />
        ))}
      </div>
      <table className="g2n-table">
        <caption className="sr-only">
          How gross pay becomes net pay, one step at a time
        </caption>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col" className="end">
              Amount
            </th>
            <th scope="col" className="end">
              Share of gross
            </th>
            <th scope="col" className="end hide-sm">
              Running total
            </th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <tr
              key={step.key}
              className={active === step.key ? "active" : undefined}
              onPointerEnter={() => setActive(step.key)}
              onPointerLeave={() => setActive(null)}
            >
              <th scope="row">
                <span
                  className="swatch"
                  aria-hidden="true"
                  style={{
                    background:
                      step.key === "gross"
                        ? "var(--ink)"
                        : (PART_COLORS[step.key] ?? "var(--chart-5)"),
                  }}
                />
                {step.kind === "minus"
                  ? "Less "
                  : step.kind === "plus"
                    ? "Add "
                    : ""}
                {step.name}
              </th>
              <td className="end figures">
                {step.kind === "total"
                  ? formatInr(step.paise)
                  : `${step.kind === "minus" ? "−" : "+"}${formatInr(Math.abs(step.paise))}`}
              </td>
              <td className="end figures">
                {step.kind === "total" && step.key === "gross"
                  ? "100%"
                  : `${pct(step.paise).toFixed(pct(step.paise) < 10 ? 2 : 1)}%`}
              </td>
              <td className="end figures hide-sm">{formatInr(step.to)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deduction split with drill-down                                     */
/* ------------------------------------------------------------------ */

export type DeductionSegment = {
  key: string;
  name: string;
  paise: number;
  color: string;
  /** Said under a part that is zero for a reason, such as an unset percent. */
  note?: string;
  people: Contribution[];
};

export function DeductionExplorer({
  segments,
  total,
  slipBase,
}: {
  segments: DeductionSegment[];
  total: number;
  slipBase: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const live = segments.filter((segment) => segment.paise > 0);
  let offset = 0;
  const focusKey = hover ?? selected;
  const focus = segments.find((segment) => segment.key === focusKey);
  const chosen = segments.find((segment) => segment.key === selected);
  const gap = live.length > 1 ? 1.5 : 0;
  return (
    <div className="explorer-donut">
      <div className="donut-wrap">
        <svg
          viewBox="0 0 120 120"
          className="donut"
          role="img"
          aria-label={`Deductions of ${formatInr(total)} by part.`}
        >
          <title>{`Deductions of ${formatInr(total)} by part`}</title>
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth="14"
          />
          {live.map((segment) => {
            const length = (segment.paise / total) * circumference;
            const dash = Math.max(length - gap, 0);
            const node = (
              // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only convenience, the legend buttons are the accessible control
              <circle
                key={segment.key}
                className={
                  focusKey === segment.key ? "seg-ring active" : "seg-ring"
                }
                data-dim={
                  focusKey && focusKey !== segment.key ? "true" : undefined
                }
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={focusKey === segment.key ? 17 : 14}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
                onPointerEnter={() => setHover(segment.key)}
                onPointerLeave={() => setHover(null)}
                onClick={() =>
                  setSelected((value) =>
                    value === segment.key ? null : segment.key,
                  )
                }
              />
            );
            offset += length;
            return node;
          })}
          <text
            className="figures center-value"
            x="60"
            y={focus ? 56 : 58}
            textAnchor="middle"
          >
            {compactInr(focus ? focus.paise : total)}
          </text>
          <text className="center-label" x="60" y="70" textAnchor="middle">
            {focus ? focus.name : "deducted"}
          </text>
          {focus && total > 0 ? (
            <text className="center-label" x="60" y="81" textAnchor="middle">
              {`${((focus.paise / total) * 100).toFixed(1)}% of total`}
            </text>
          ) : null}
        </svg>
        <ul className="legend rows">
          {segments.map((segment) => (
            <li key={segment.key}>
              <button
                type="button"
                className="legend-row"
                aria-pressed={selected === segment.key}
                disabled={segment.paise === 0}
                onClick={() =>
                  setSelected((value) =>
                    value === segment.key ? null : segment.key,
                  )
                }
                onPointerEnter={() => setHover(segment.key)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(segment.key)}
                onBlur={() => setHover(null)}
              >
                <span
                  className="swatch"
                  style={{
                    background:
                      segment.paise === 0
                        ? "var(--line-strong)"
                        : segment.color,
                  }}
                  aria-hidden="true"
                />
                <span className="legend-name">
                  {segment.name}
                  {segment.note && segment.paise === 0 ? (
                    <small>{segment.note}</small>
                  ) : null}
                </span>
                <strong className="figures">{formatInr(segment.paise)}</strong>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="drill" aria-live="polite">
        {chosen ? (
          <>
            <p className="drill-title">
              <strong>{chosen.name}</strong> comes from {chosen.people.length}{" "}
              {chosen.people.length === 1 ? "employee" : "employees"}
            </p>
            <ul className="drill-list">
              {chosen.people.slice(0, 5).map((person) => (
                <li key={person.employeeId}>
                  {slipBase ? (
                    <Link href={`${slipBase}/${person.employeeId}`}>
                      {person.name}
                    </Link>
                  ) : (
                    <span>{person.name}</span>
                  )}
                  <span className="figures">{formatInr(person.paise)}</span>
                </li>
              ))}
            </ul>
            {chosen.people.length > 5 ? (
              <p className="section-note">
                and {chosen.people.length - 5} more. The register lists every
                line.
              </p>
            ) : null}
          </>
        ) : (
          <p className="section-note">
            Select a part to see which employees it comes from.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pay distribution                                                    */
/* ------------------------------------------------------------------ */

export function BandChart({
  bands,
  slipBase,
  noun,
}: {
  bands: PayBand[];
  slipBase: string | null;
  noun: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const id = useId();
  const peak = Math.max(1, ...bands.map((band) => band.people.length));
  const chosen = selected === null ? null : bands[selected];
  return (
    <div className="bands">
      <fieldset className="band-plot">
        <legend className="sr-only">{noun} by band</legend>
        {bands.map((band, index) => {
          const count = band.people.length;
          return (
            <button
              key={band.fromPaise}
              type="button"
              className="band"
              aria-pressed={selected === index}
              aria-describedby={`${id}-${index}`}
              data-empty={count === 0 ? "true" : undefined}
              onClick={() => setSelected((v) => (v === index ? null : index))}
            >
              <span className="band-count figures">{count}</span>
              <span className="band-track">
                <span
                  className="band-fill"
                  style={{ height: `${(count / peak) * 100}%` }}
                />
              </span>
              <span className="band-label">{band.label}</span>
              <span id={`${id}-${index}`} className="sr-only">
                {count} {count === 1 ? "employee" : "employees"} between{" "}
                {formatInr(band.fromPaise)} and {formatInr(band.toPaise)}
              </span>
            </button>
          );
        })}
      </fieldset>
      <div className="drill" aria-live="polite">
        {chosen ? (
          chosen.people.length === 0 ? (
            <p className="section-note">No one is in {chosen.label}.</p>
          ) : (
            <ul className="drill-list">
              {chosen.people
                .slice()
                .sort((a, b) => b.paise - a.paise)
                .map((person) => (
                  <li key={person.employeeId}>
                    {slipBase ? (
                      <Link href={`${slipBase}/${person.employeeId}`}>
                        {person.name}
                      </Link>
                    ) : (
                      <span>{person.name}</span>
                    )}
                    <span className="figures">{formatInr(person.paise)}</span>
                  </li>
                ))}
            </ul>
          )
        ) : (
          <p className="section-note">Select a band to see who is in it.</p>
        )}
      </div>
    </div>
  );
}

/** A small icon-and-text link used under chart panels. */
export function DrillLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="panel-link" href={href}>
      {label} <Icon name="arrow-right" size={14} />
    </Link>
  );
}
