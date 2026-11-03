import Link from "next/link";
import { compactInr } from "../domain/format";

/** Series colors come from the design tokens in globals.css. */
export const SERIES = {
  blue: "var(--chart-1)",
  teal: "var(--chart-2)",
  amber: "var(--chart-3)",
  rust: "var(--chart-4)",
  slate: "var(--chart-5)",
  steel: "var(--chart-6)",
};

/** Colors for each deduction part, shared by every chart that names one. */
export const PART_COLORS: Record<string, string> = {
  net: SERIES.teal,
  pf: SERIES.blue,
  esi: SERIES.steel,
  pt: SERIES.amber,
  loan: SERIES.rust,
  other: SERIES.slate,
  adjustment: "#8a5a2b",
};

export function Meter({
  value,
  max,
  label,
  tone,
}: {
  value: number;
  max: number;
  label: string;
  tone?: "positive" | "attention";
}) {
  const pct =
    max <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="meter">
      <div
        className="bar-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label}
      >
        <div
          className={tone ? `bar-fill ${tone}` : "bar-fill"}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="section-note figures">{label}</span>
    </div>
  );
}

export function Legend({
  items,
}: {
  items: { name: string; color: string }[];
}) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.name}>
          <span className="swatch" style={{ background: item.color }} />
          {item.name}
        </li>
      ))}
    </ul>
  );
}

export function Donut({
  segments,
  center,
  caption,
  label,
  format,
}: {
  segments: { name: string; value: number; color: string }[];
  center: string;
  caption?: string;
  label: string;
  format?: (value: number) => string;
}) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const show = format ?? ((value: number) => String(value));
  return (
    <div className="donut-wrap">
      <svg
        viewBox="0 0 120 120"
        className="donut"
        role="img"
        aria-label={label}
      >
        <title>{label}</title>
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth="14"
        />
        {total > 0
          ? segments
              .filter((segment) => segment.value > 0)
              .map((segment) => {
                const length = (segment.value / total) * circumference;
                const gap =
                  segments.filter((item) => item.value > 0).length > 1
                    ? 1.5
                    : 0;
                const node = (
                  <circle
                    key={segment.name}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="14"
                    strokeDasharray={`${Math.max(length - gap, 0)} ${circumference - Math.max(length - gap, 0)}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 60 60)"
                  >
                    <title>{`${segment.name}: ${show(segment.value)}`}</title>
                  </circle>
                );
                offset += length;
                return node;
              })
          : null}
        <text
          className="figures center-value"
          x="60"
          y={caption ? 58 : 64}
          textAnchor="middle"
        >
          {center}
        </text>
        {caption ? (
          <text className="center-label" x="60" y="72" textAnchor="middle">
            {caption}
          </text>
        ) : null}
      </svg>
      <ul className="legend">
        {segments.map((segment) => (
          <li key={segment.name}>
            <span
              className="swatch"
              style={{ background: segment.color }}
              aria-hidden="true"
            />
            <span>{segment.name}</span>
            <strong className="figures">{show(segment.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vertical bars with value labels. Used for a handful of categories. */
export function Columns({
  rows,
  label,
  format,
}: {
  rows: { name: string; value: number; color: string }[];
  label: string;
  format?: (value: number) => string;
}) {
  const width = 360;
  const height = 150;
  const top = 18;
  const max = Math.max(1, ...rows.map((row) => row.value));
  const gap = 18;
  const barWidth =
    rows.length === 0 ? 0 : (width - gap * (rows.length + 1)) / rows.length;
  const show = format ?? ((value: number) => String(value));
  return (
    <svg
      viewBox={`0 0 ${width} ${height + 26}`}
      className="chart"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {[0.5, 1].map((step) => (
        <line
          key={step}
          className="grid-line"
          x1="0"
          x2={width}
          y1={height - step * (height - top)}
          y2={height - step * (height - top)}
        />
      ))}
      <line className="axis" x1="0" y1={height} x2={width} y2={height} />
      {rows.map((row, index) => {
        const barHeight = (row.value / max) * (height - top);
        const x = gap + index * (barWidth + gap);
        const y = height - barHeight;
        return (
          <g key={row.name}>
            <rect
              className="bar"
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 0)}
              fill={row.color}
              rx="6"
            >
              <title>{`${row.name}: ${show(row.value)}`}</title>
            </rect>
            <text
              className="figures"
              x={x + barWidth / 2}
              y={Math.max(y - 6, 10)}
              textAnchor="middle"
              style={{ fill: "var(--ink)", fontWeight: 600 }}
            >
              {show(row.value)}
            </text>
            <text x={x + barWidth / 2} y={height + 18} textAnchor="middle">
              {row.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Money over months as lines with a soft fill under the first series.
 * Needs two or more points; the caller shows a note when it has fewer.
 */
export function TrendChart({
  points,
  series,
  label,
  money = true,
}: {
  points: { label: string; values: number[] }[];
  series: { name: string; color: string }[];
  label: string;
  money?: boolean;
}) {
  const width = 640;
  const height = 220;
  const left = money ? 52 : 34;
  const right = 16;
  const top = 14;
  const bottom = 30;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const peak = Math.max(1, ...points.flatMap((point) => point.values));
  const niceMax = niceCeil(peak);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((step) => step * niceMax);
  const x = (index: number) =>
    left +
    (points.length <= 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const y = (value: number) => top + plotH - (value / niceMax) * plotH;
  const fmt = (value: number) =>
    money ? compactInr(value) : String(Math.round(value));
  const every = Math.max(1, Math.ceil(points.length / 8));
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="chart"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            className={tick === 0 ? "axis" : "grid-line"}
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
            {fmt(tick)}
          </text>
        </g>
      ))}
      {series.map((item, seriesIndex) => {
        const coords = points.map((point, index) => ({
          x: x(index),
          y: y(point.values[seriesIndex] ?? 0),
        }));
        const path = coords
          .map(
            (c, index) =>
              `${index === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`,
          )
          .join(" ");
        const area = `${path} L${coords[coords.length - 1].x.toFixed(1)} ${y(0)} L${coords[0].x.toFixed(1)} ${y(0)} Z`;
        return (
          <g key={item.name}>
            {seriesIndex === 0 ? (
              <path d={area} fill={item.color} opacity="0.1" />
            ) : null}
            <path
              d={path}
              fill="none"
              stroke={item.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {coords.map((c, index) => (
              <circle
                key={points[index].label}
                className="dot"
                cx={c.x}
                cy={c.y}
                r="4.5"
                fill="var(--surface)"
                stroke={item.color}
                strokeWidth="2.5"
              >
                <title>{`${item.name}, ${points[index].label}: ${fmt(points[index].values[seriesIndex] ?? 0)}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      {points.map((point, index) =>
        index % every === 0 ? (
          <text
            key={point.label}
            x={x(index)}
            y={height - 8}
            textAnchor="middle"
          >
            {point.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Grouped vertical bars for a few months, each month showing every series. */
export function GroupedColumns({
  points,
  series,
  label,
}: {
  points: { label: string; values: number[] }[];
  series: { name: string; color: string }[];
  label: string;
}) {
  const width = 640;
  const height = 220;
  const left = 52;
  const right = 16;
  const top = 14;
  const bottom = 30;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const peak = Math.max(1, ...points.flatMap((point) => point.values));
  const niceMax = niceCeil(peak);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((step) => step * niceMax);
  const y = (value: number) => top + plotH - (value / niceMax) * plotH;
  const slot = plotW / Math.max(points.length, 1);
  const group = Math.min(slot * 0.7, 64 * series.length);
  const barW = group / series.length - 3;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="chart"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            className={tick === 0 ? "axis" : "grid-line"}
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
      {points.map((point, index) => {
        const start = left + slot * index + (slot - group) / 2;
        return (
          <g key={point.label}>
            {series.map((item, seriesIndex) => {
              const value = point.values[seriesIndex] ?? 0;
              return (
                <rect
                  key={item.name}
                  className="bar"
                  x={start + seriesIndex * (barW + 3)}
                  y={y(value)}
                  width={Math.max(barW, 2)}
                  height={Math.max(y(0) - y(value), 0)}
                  rx="4"
                  fill={item.color}
                >
                  <title>{`${item.name}, ${point.label}: ${compactInr(value)}`}</title>
                </rect>
              );
            })}
            <text
              x={left + slot * index + slot / 2}
              y={height - 8}
              textAnchor="middle"
            >
              {point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Horizontal bars. The numbers are also in the label column. A row with an
 * `href` is a link, so a bar can open the view behind it, and `active` marks
 * the one currently chosen.
 */
export function BarList({
  rows,
  tone,
}: {
  rows: {
    name: string;
    value: number;
    label: string;
    href?: string;
    active?: boolean;
    /** Shown on hover and keyboard focus. */
    tip?: string;
  }[];
  tone?: "positive" | "attention";
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="bar-list">
      {rows.map((row) => {
        const body = (
          <>
            <span title={row.name}>{row.name}</span>
            <div className="bar-track" aria-hidden="true">
              <div
                className={tone ? `bar-fill ${tone}` : "bar-fill"}
                style={{ width: `${Math.round((row.value / max) * 100)}%` }}
              />
            </div>
            <span className="figures">{row.label}</span>
          </>
        );
        return row.href ? (
          <Link
            className={row.active ? "bar-row link active" : "bar-row link"}
            href={row.href}
            key={row.name}
            data-tip={row.tip}
            aria-current={row.active ? "true" : undefined}
          >
            {body}
          </Link>
        ) : (
          <div className="bar-row" key={row.name} data-tip={row.tip}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Two bars per row on one scale: the larger figure faint, the smaller solid.
 * Used to set gross against net for each employee when there are too few
 * people for a histogram.
 */
export function PairBars({
  rows,
  outer,
  inner,
}: {
  rows: {
    id: string;
    name: string;
    href?: string;
    outer: number;
    inner: number;
    tip?: string;
  }[];
  outer: string;
  inner: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.outer));
  return (
    <div className="pair-bars">
      <ul className="chart-legend">
        <li>
          <span className="swatch faint" />
          {outer}
        </li>
        <li>
          <span className="swatch" style={{ background: SERIES.teal }} />
          {inner}
        </li>
      </ul>
      {rows.map((row) => {
        const body = (
          <>
            <span className="pair-name" title={row.name}>
              {row.name}
            </span>
            <span className="pair-track" aria-hidden="true">
              <span
                className="pair-outer"
                style={{ width: `${(row.outer / max) * 100}%` }}
              />
              <span
                className="pair-inner"
                style={{ width: `${(row.inner / max) * 100}%` }}
              />
            </span>
            <span className="pair-values figures">
              {compactInr(row.inner)}
              <small>of {compactInr(row.outer)}</small>
            </span>
          </>
        );
        return row.href ? (
          <Link
            className="pair-row link"
            href={row.href}
            key={row.id}
            data-tip={row.tip}
          >
            {body}
          </Link>
        ) : (
          <div className="pair-row" key={row.id} data-tip={row.tip}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** A tiny trend line with no axes. Decoration for a figure that is stated beside it. */
export function Sparkline({
  values,
  color = SERIES.blue,
}: {
  values: number[];
  color?: string;
}) {
  if (values.length < 2) return null;
  const width = 96;
  const height = 28;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const coords = values.map((value, index) => ({
    x: 3 + (index / (values.length - 1)) * (width - 6),
    y: height - 4 - ((value - low) / span) * (height - 8),
  }));
  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  return (
    <svg
      className="spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={path}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="spark-line"
      />
    </svg>
  );
}
/** Rounds a chart ceiling up to 1, 2, 2.5, 5, or 10 times a power of ten. */
export function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const unit = value / power;
  const step =
    unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return step * power;
}
