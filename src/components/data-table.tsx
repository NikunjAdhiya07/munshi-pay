"use client";

import { type ReactNode, useMemo, useState } from "react";
import { Icon } from "./icons";

export type Column = {
  key: string;
  label: string;
  numeric?: boolean;
  /** Sortable columns need a value in each row's `sort`. */
  sortable?: boolean;
};

export type TableRow = {
  id: string;
  cells: Record<string, ReactNode>;
  /** Plain values to sort by. Numbers sort as numbers, text sorts naturally. */
  sort?: Record<string, string | number>;
  /** Text the search box looks in. Falls back to the sort values. */
  search?: string;
  /** Values the filter list offers, such as a department. */
  facets?: Record<string, string>;
};

const SIZES = [10, 25, 50, 100];

/**
 * A table with a search box, sortable headers, an optional filter, and
 * pagination. The rows arrive already rendered from the server, so the
 * figures shown are exactly what the page computed; this component only
 * orders, narrows, and slices them. On a phone each row becomes a card.
 */
export function DataTable({
  caption,
  columns,
  rows,
  pageSize = 10,
  searchable = true,
  searchLabel = "Search",
  facet,
  totals,
  totalsLabel = "Total",
  defaultSort,
  empty,
  noun = "rows",
}: {
  caption: string;
  columns: Column[];
  rows: TableRow[];
  pageSize?: number;
  searchable?: boolean;
  searchLabel?: string;
  facet?: { key: string; label: string };
  /** Footer cells, keyed by column. Shown for every row, not just the page. */
  totals?: Record<string, ReactNode>;
  totalsLabel?: string;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  empty?: ReactNode;
  noun?: string;
}) {
  const [query, setQuery] = useState("");
  const [facetValue, setFacetValue] = useState("");
  const [sort, setSort] = useState(defaultSort ?? null);
  const [size, setSize] = useState(pageSize);
  const [page, setPage] = useState(1);

  const facetOptions = useMemo(() => {
    if (!facet) return [];
    return [
      ...new Set(rows.map((row) => row.facets?.[facet.key]).filter(Boolean)),
    ].sort((a, b) => String(a).localeCompare(String(b))) as string[];
  }, [rows, facet]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = rows.filter((row) => {
      if (facet && facetValue && row.facets?.[facet.key] !== facetValue) {
        return false;
      }
      if (!needle) return true;
      const text =
        row.search ??
        Object.values(row.sort ?? {})
          .join(" ")
          .toString();
      return text.toLowerCase().includes(needle);
    });
    if (sort) {
      const dir = sort.dir === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const left = a.sort?.[sort.key] ?? "";
        const right = b.sort?.[sort.key] ?? "";
        if (typeof left === "number" && typeof right === "number") {
          return (left - right) * dir;
        }
        return (
          String(left).localeCompare(String(right), "en", { numeric: true }) *
          dir
        );
      });
    }
    return list;
  }, [rows, query, facet, facetValue, sort]);

  const pages = Math.max(1, Math.ceil(visible.length / size));
  const current = Math.min(page, pages);
  const start = (current - 1) * size;
  const slice = visible.slice(start, start + size);
  const filtered = Boolean(query.trim() || facetValue);

  const sortBy = (key: string) => {
    setPage(1);
    setSort((now) => {
      if (!now || now.key !== key) return { key, dir: "asc" };
      if (now.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  return (
    <div className="dt">
      {searchable || facet ? (
        <div className="dt-bar">
          {searchable ? (
            <label className="dt-search">
              <span className="sr-only">{searchLabel}</span>
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder={`${searchLabel}…`}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          ) : null}
          {facet && facetOptions.length > 1 ? (
            <label>
              <span className="sr-only">{facet.label}</span>
              <select
                value={facetValue}
                onChange={(event) => {
                  setFacetValue(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All {facet.label.toLowerCase()}</option>
                {facetOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {filtered ? (
            <button
              type="button"
              className="ghost sm"
              onClick={() => {
                setQuery("");
                setFacetValue("");
                setPage(1);
              }}
            >
              Clear
            </button>
          ) : null}
          <span className="dt-count" aria-live="polite">
            {filtered
              ? `${visible.length} of ${rows.length} ${noun}`
              : `${rows.length} ${rows.length === 1 ? noun.replace(/s$/, "") : noun}`}
          </span>
        </div>
      ) : null}

      {rows.length > 0 && visible.length === 0 ? (
        <div className="empty compact">
          <span className="empty-icon">
            <Icon name="search" size={18} />
          </span>
          <p>No {noun} match that search or filter.</p>
          <button
            type="button"
            className="quiet sm"
            onClick={() => {
              setQuery("");
              setFacetValue("");
            }}
          >
            Clear search
          </button>
        </div>
      ) : rows.length === 0 ? (
        (empty ?? (
          <div className="empty compact">
            <p>Nothing to show yet.</p>
          </div>
        ))
      ) : (
        <div className="table-wrap stack-table" style={{ marginTop: 0 }}>
          <table>
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                {columns.map((column) => {
                  const active = sort?.key === column.key;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={column.numeric ? "num" : undefined}
                      aria-sort={
                        active
                          ? sort?.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : column.sortable
                            ? "none"
                            : undefined
                      }
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          className="dt-sort"
                          onClick={() => sortBy(column.key)}
                        >
                          {column.label}
                          <Icon
                            name={
                              active
                                ? sort?.dir === "asc"
                                  ? "arrow-up"
                                  : "arrow-down"
                                : "sort"
                            }
                            size={13}
                          />
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={column.numeric ? "num" : undefined}
                      data-label={column.label}
                    >
                      {row.cells[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {totals ? (
              <tfoot>
                <tr>
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={column.numeric ? "num" : undefined}
                      data-label={column.label}
                    >
                      {index === 0 && totals[column.key] === undefined
                        ? totalsLabel
                        : totals[column.key]}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}

      {visible.length > SIZES[0] || size !== pageSize ? (
        <div className="dt-pager">
          <span>
            Showing {visible.length === 0 ? 0 : start + 1}–
            {Math.min(start + size, visible.length)} of {visible.length}
          </span>
          <div className="pager-controls">
            <label>
              <span className="sr-only">Rows per page</span>
              <select
                value={size}
                onChange={(event) => {
                  setSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                {SIZES.map((item) => (
                  <option key={item} value={item}>
                    {item} per page
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="quiet sm"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              <Icon name="chevron-left" size={14} />
              Previous
            </button>
            <span className="figures">
              Page {current} of {pages}
            </span>
            <button
              type="button"
              className="quiet sm"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              Next
              <Icon name="chevron-right" size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
