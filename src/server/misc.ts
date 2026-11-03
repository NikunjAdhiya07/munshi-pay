import type { Employee, MiscItem, Store } from "./model.ts";

export class MiscError extends Error {}

export type MiscType = MiscItem["type"];

export const MISC_TYPES: readonly MiscType[] = [
  "department",
  "designation",
  "bank",
];

export const MISC_LABEL: Record<MiscType, string> = {
  department: "Department",
  designation: "Designation",
  bank: "Bank",
};

const DESCRIPTION_LIMIT = 60;

export function isMiscType(value: string): value is MiscType {
  return (MISC_TYPES as readonly string[]).includes(value);
}

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Employee fields that hold a value from each list. Employees store the text. */
type TextField = "department" | "designation" | "bankName" | "pfBankName";

function fieldsFor(type: MiscType): TextField[] {
  if (type === "department") return ["department"];
  if (type === "designation") return ["designation"];
  return ["bankName", "pfBankName"];
}

function employeesUsing(
  store: Store,
  companyId: string,
  type: MiscType,
  description: string,
): Employee[] {
  const fields = fieldsFor(type);
  return store.employees.filter(
    (employee) =>
      employee.companyId === companyId &&
      fields.some((field) => same(employee[field] ?? "", description)),
  );
}

/** Number of employees in this company that carry the entry's text. */
export function employeeCountUsing(
  store: Store,
  companyId: string,
  item: MiscItem,
): number {
  return employeesUsing(store, companyId, item.type, item.description).length;
}

function checkDescription(
  store: Store,
  companyId: string,
  type: MiscType,
  raw: string,
  selfId: string | null,
): string {
  const description = raw.trim();
  if (!description) throw new MiscError("Enter a description.");
  if (description.length > DESCRIPTION_LIMIT) {
    throw new MiscError(
      `Description must be ${DESCRIPTION_LIMIT} characters or fewer.`,
    );
  }
  const clash = store.misc.some(
    (item) =>
      item.companyId === companyId &&
      item.type === type &&
      item.id !== selfId &&
      same(item.description, description),
  );
  if (clash) {
    throw new MiscError(
      `${MISC_LABEL[type]} ${description} is already in the list.`,
    );
  }
  return description;
}

function owned(store: Store, companyId: string, id: string): MiscItem {
  const item = store.misc.find(
    (entry) => entry.id === id && entry.companyId === companyId,
  );
  if (!item) throw new MiscError("Entry not found.");
  return item;
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

export function addMisc(
  store: Store,
  companyId: string,
  actor: string,
  input: { type: string; description: string },
  newId: () => string,
): MiscItem {
  if (!isMiscType(input.type)) throw new MiscError("Choose a type.");
  const description = checkDescription(
    store,
    companyId,
    input.type,
    input.description,
    null,
  );
  const item: MiscItem = {
    id: newId(),
    companyId,
    type: input.type,
    description,
  };
  store.misc.push(item);
  record(
    store,
    companyId,
    actor,
    `Added ${item.type} ${item.description}`,
    newId,
  );
  return item;
}

/**
 * Employees keep the text of their department, designation, and bank, so a
 * rename moves every employee in the company that carried the old text. The
 * type of an entry cannot change.
 */
export function updateMisc(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  rawDescription: string,
  newId: () => string,
): MiscItem {
  const item = owned(store, companyId, id);
  const description = checkDescription(
    store,
    companyId,
    item.type,
    rawDescription,
    id,
  );
  const previous = item.description;
  const people = employeesUsing(store, companyId, item.type, previous);
  const fields = fieldsFor(item.type);
  for (const employee of people) {
    for (const field of fields) {
      if (same(employee[field] ?? "", previous)) {
        employee[field] = description;
      }
    }
  }
  item.description = description;
  record(
    store,
    companyId,
    actor,
    `Renamed ${item.type} ${previous} to ${description} (${people.length} ${people.length === 1 ? "employee" : "employees"})`,
    newId,
  );
  return item;
}

export function deleteMisc(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  newId: () => string,
): void {
  const item = owned(store, companyId, id);
  const used = employeeCountUsing(store, companyId, item);
  if (used > 0) {
    throw new MiscError(
      `${item.description} is used by ${used} ${used === 1 ? "employee" : "employees"}. Change those employees first.`,
    );
  }
  store.misc = store.misc.filter((entry) => entry.id !== id);
  record(
    store,
    companyId,
    actor,
    `Deleted ${item.type} ${item.description}`,
    newId,
  );
}

/**
 * Employee forms take a department, designation, or bank from the lists. An
 * employee that already holds older free text keeps it until it is changed.
 */
export function assertListed(
  store: Store,
  companyId: string,
  type: MiscType,
  value: string,
  current: string,
): void {
  const text = value.trim();
  if (!text || same(text, current)) return;
  const listed = store.misc.some(
    (item) =>
      item.companyId === companyId &&
      item.type === type &&
      same(item.description, text),
  );
  if (!listed) {
    throw new MiscError(
      `${MISC_LABEL[type]} ${text} is not in the list. Add it under Misc. entry first.`,
    );
  }
}
