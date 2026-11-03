import { parseRupeeText } from "../domain/money.ts";
import type { PtSlab, Store } from "./model.ts";

export class SlabError extends Error {}

export type SlabInput = {
  asOn: string;
  state: string;
  lower: string;
  upper: string;
  amount: string;
};

const STATE_LIMIT = 60;

/** Parses rupees typed by a person into paise without going through a float. */
export function parseRupees(raw: string, label: string): number {
  if (raw.trim() === "") throw new SlabError(`Enter the ${label}.`);
  const paise = parseRupeeText(raw);
  if (paise === null) {
    throw new SlabError(
      `${label} must be an amount in rupees with at most two decimals.`,
    );
  }
  return paise;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function sameState(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function validate(input: SlabInput): Omit<PtSlab, "id" | "companyId"> {
  const asOn = input.asOn.trim();
  if (!validDate(asOn)) throw new SlabError("Enter the as-on date.");
  const state = input.state.trim();
  if (!state) throw new SlabError("Enter the state.");
  if (state.length > STATE_LIMIT) {
    throw new SlabError(`State must be ${STATE_LIMIT} characters or fewer.`);
  }
  const lowerPaise = parseRupees(input.lower, "lower limit");
  const upperPaise = parseRupees(input.upper, "upper limit");
  if (upperPaise < lowerPaise) {
    throw new SlabError("Upper limit cannot be below the lower limit.");
  }
  const amountPaise = parseRupees(input.amount, "PT amount");
  return { asOn, state, lowerPaise, upperPaise, amountPaise };
}

function owned(store: Store, companyId: string, id: string): PtSlab {
  const slab = store.slabs.find(
    (item) => item.id === id && item.companyId === companyId,
  );
  if (!slab) throw new SlabError("Slab not found.");
  return slab;
}

/** Audit text names the slab by state and date. Amounts are not logged. */
function record(
  store: Store,
  companyId: string,
  actor: string,
  verb: string,
  slab: PtSlab,
  newId: () => string,
): void {
  store.audit.unshift({
    id: `audit-${newId()}`,
    at: new Date().toISOString(),
    actor,
    action: `${verb} PT slab ${slab.state} as on ${slab.asOn}`,
    companyId,
  });
}

export function addSlab(
  store: Store,
  companyId: string,
  actor: string,
  input: SlabInput,
  newId: () => string,
): PtSlab {
  const slab: PtSlab = { id: newId(), companyId, ...validate(input) };
  store.slabs.push(slab);
  record(store, companyId, actor, "Added", slab, newId);
  return slab;
}

/**
 * Locked months keep their stored PT because a locked period cannot be
 * processed again, so edits only reach months that are still open.
 */
export function updateSlab(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  input: SlabInput,
  newId: () => string,
): PtSlab {
  const slab = owned(store, companyId, id);
  Object.assign(slab, validate(input));
  record(store, companyId, actor, "Edited", slab, newId);
  return slab;
}

export function deleteSlab(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  newId: () => string,
): void {
  const slab = owned(store, companyId, id);
  store.slabs = store.slabs.filter((item) => item.id !== id);
  record(store, companyId, actor, "Deleted", slab, newId);
}

/**
 * The slab set in force on a date is the one with the latest as-on date that
 * is not after it. Older sets for the same state are superseded.
 */
export function slabsInForce(
  store: Store,
  companyId: string,
  state: string,
  onDate: string,
): PtSlab[] {
  const candidates = store.slabs.filter(
    (slab) =>
      slab.companyId === companyId &&
      sameState(slab.state, state) &&
      slab.asOn <= onDate,
  );
  const latest = candidates.reduce(
    (max, slab) => (slab.asOn > max ? slab.asOn : max),
    "",
  );
  return candidates.filter((slab) => slab.asOn === latest);
}

/**
 * PT for a month gross. Zero unless exactly one slab in force contains the
 * gross. Which slab wins an overlap is not decided yet (T-210).
 */
export function ptFor(
  store: Store,
  companyId: string,
  state: string,
  grossPaise: number,
  onDate: string,
): number {
  const matches = slabsInForce(store, companyId, state, onDate).filter(
    (slab) => grossPaise >= slab.lowerPaise && grossPaise <= slab.upperPaise,
  );
  return matches.length === 1 ? matches[0].amountPaise : 0;
}

/** Ids of slabs whose range overlaps another slab for the same state and as-on date. */
export function overlappingSlabs(store: Store, companyId: string): Set<string> {
  const slabs = store.slabs.filter((slab) => slab.companyId === companyId);
  const ids = new Set<string>();
  for (const [index, a] of slabs.entries()) {
    for (const b of slabs.slice(index + 1)) {
      if (
        a.asOn === b.asOn &&
        sameState(a.state, b.state) &&
        a.lowerPaise <= b.upperPaise &&
        b.lowerPaise <= a.upperPaise
      ) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
}
