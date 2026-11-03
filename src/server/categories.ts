import { parsePercentText } from "../domain/money.ts";
import type { Category, Store } from "./model.ts";

export class CategoryError extends Error {}

export type CategoryInput = {
  name: string;
  structure: "gross" | "ctc";
  basicPercent: string;
  daPercent: string;
};

const NAME_LIMIT = 60;

/** Parses a percent typed by a person. Blank, negative, and over 100 are refused. */
export function parsePercent(raw: string, label: string): number {
  const value = raw.trim();
  if (value === "") throw new CategoryError(`Enter the ${label} percent.`);
  const percent = parsePercentText(value);
  if (percent !== null) return percent;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  const points = match
    ? Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"))
    : null;
  if (points !== null && (match?.[2]?.length ?? 0) <= 2 && points > 10_000) {
    throw new CategoryError(`${label} percent cannot be above 100.`);
  }
  throw new CategoryError(
    `${label} percent must be a number with at most two decimals.`,
  );
}

function validate(
  store: Store,
  companyId: string,
  input: CategoryInput,
  selfId: string | null,
): { name: string; basicPercent: number; daPercent: number } {
  const name = input.name.trim();
  if (!name) throw new CategoryError("Enter a category name.");
  if (name.length > NAME_LIMIT) {
    throw new CategoryError(
      `Category name must be ${NAME_LIMIT} characters or fewer.`,
    );
  }
  const basicPercent = parsePercent(input.basicPercent, "Basic");
  const daPercent = parsePercent(input.daPercent, "DA");
  // Rounding keeps decimal percents such as 12.1 + 87.9 from drifting past 100.
  if (Math.round((basicPercent + daPercent) * 100) > 10_000) {
    throw new CategoryError(
      "Basic and DA together cannot be above 100 percent. The remainder of gross is stored as Other.",
    );
  }
  const clash = store.categories.some(
    (item) =>
      item.companyId === companyId &&
      item.id !== selfId &&
      item.structure === input.structure &&
      item.name.toLowerCase() === name.toLowerCase(),
  );
  if (clash) {
    throw new CategoryError(
      `A ${input.structure === "ctc" ? "CTC" : "Gross"} category named ${name} already exists.`,
    );
  }
  return { name, basicPercent, daPercent };
}

function owned(store: Store, companyId: string, id: string): Category {
  const category = store.categories.find(
    (item) => item.id === id && item.companyId === companyId,
  );
  if (!category) throw new CategoryError("Category not found.");
  return category;
}

/** Number of salary rows in this company that point at the category. */
export function salaryRowsUsing(
  store: Store,
  companyId: string,
  categoryId: string,
): number {
  return store.employees
    .filter((employee) => employee.companyId === companyId)
    .reduce(
      (sum, employee) =>
        sum +
        employee.salaryRows.filter((row) => row.categoryId === categoryId)
          .length,
      0,
    );
}

function record(
  store: Store,
  companyId: string,
  actor: string,
  action: string,
  newId: () => string,
): void {
  store.audit.unshift({
    id: `audit-${newId()}`,
    at: new Date().toISOString(),
    actor,
    action,
    companyId,
  });
}

export function addCategory(
  store: Store,
  companyId: string,
  actor: string,
  input: CategoryInput,
  newId: () => string,
): Category {
  const checked = validate(store, companyId, input, null);
  const category: Category = {
    id: newId(),
    companyId,
    structure: input.structure,
    ...checked,
  };
  store.categories.push(category);
  record(store, companyId, actor, `Added category ${category.name}`, newId);
  return category;
}

/**
 * The list a category sits in cannot change, so a Gross category stays a Gross
 * category. Locked months keep their stored lines because a locked period
 * cannot be processed again, so edits only reach months that are still open.
 */
export function updateCategory(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  input: CategoryInput,
  newId: () => string,
): Category {
  const category = owned(store, companyId, id);
  const checked = validate(
    store,
    companyId,
    { ...input, structure: category.structure },
    id,
  );
  category.name = checked.name;
  category.basicPercent = checked.basicPercent;
  category.daPercent = checked.daPercent;
  record(store, companyId, actor, `Edited category ${category.name}`, newId);
  return category;
}

export function deleteCategory(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  newId: () => string,
): void {
  const category = owned(store, companyId, id);
  const used = salaryRowsUsing(store, companyId, id);
  if (used > 0) {
    throw new CategoryError(
      `${category.name} is used by ${used} salary ${used === 1 ? "row" : "rows"}. Move those rows to another category first.`,
    );
  }
  store.categories = store.categories.filter((item) => item.id !== id);
  record(store, companyId, actor, `Deleted category ${category.name}`, newId);
}
