import type { LeavePolicy, Store } from "./model.ts";

export class LeavePolicyError extends Error {}

export type LeavePolicyInput = {
  cadre: string;
  name: string;
  duration: string;
  ratio: string;
};

export const LEAVE_POLICY_FIELDS = [
  "cadre",
  "name",
  "duration",
  "ratio",
] as const satisfies readonly (keyof LeavePolicyInput)[];

const LIMIT = 40;

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Duration and ratio are recorded as typed. The reference does not show how
 * either one turns into days, so nothing here calculates leave (DEC-004).
 */
function validate(
  store: Store,
  companyId: string,
  input: LeavePolicyInput,
  selfId: string | null,
): Omit<LeavePolicy, "id" | "companyId"> {
  const cadre = input.cadre.trim();
  const name = input.name.trim();
  const duration = input.duration.trim();
  const ratio = input.ratio.trim();
  if (!cadre) throw new LeavePolicyError("Enter the pay cadre.");
  if (!name) throw new LeavePolicyError("Enter the leave name.");
  for (const [label, value] of [
    ["Pay cadre", cadre],
    ["Leave name", name],
    ["Duration", duration],
    ["Ratio", ratio],
  ] as const) {
    if (value.length > LIMIT) {
      throw new LeavePolicyError(
        `${label} must be ${LIMIT} characters or fewer.`,
      );
    }
  }
  const clash = store.leavePolicies.some(
    (item) =>
      item.companyId === companyId &&
      item.id !== selfId &&
      same(item.cadre, cadre) &&
      same(item.name, name),
  );
  if (clash) {
    throw new LeavePolicyError(
      `${name} already has a policy for the ${cadre} cadre.`,
    );
  }
  return { cadre, name, duration, ratio };
}

function owned(store: Store, companyId: string, id: string): LeavePolicy {
  const policy = store.leavePolicies.find(
    (item) => item.id === id && item.companyId === companyId,
  );
  if (!policy) throw new LeavePolicyError("Policy not found.");
  return policy;
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

/** Policies in this company, other than `selfId`, that carry the leave name. */
function otherPoliciesNamed(
  store: Store,
  companyId: string,
  name: string,
  selfId: string,
): number {
  return store.leavePolicies.filter(
    (item) =>
      item.companyId === companyId &&
      item.id !== selfId &&
      same(item.name, name),
  ).length;
}

/** Register balances and encashments in this company that use the leave name. */
export function leaveRecordsUsing(
  store: Store,
  companyId: string,
  name: string,
): number {
  return (
    store.leaveBalances.filter(
      (item) => item.companyId === companyId && same(item.leaveName, name),
    ).length +
    store.encashments.filter(
      (item) => item.companyId === companyId && same(item.leaveName, name),
    ).length
  );
}

/**
 * Records for a leave name stay while at least one cadre still has a policy
 * for it. Deleting the last policy for a name that has records is refused.
 */
export function recordsBlockingDelete(
  store: Store,
  companyId: string,
  policy: LeavePolicy,
): number {
  if (otherPoliciesNamed(store, companyId, policy.name, policy.id) > 0)
    return 0;
  return leaveRecordsUsing(store, companyId, policy.name);
}

export function addLeavePolicy(
  store: Store,
  companyId: string,
  actor: string,
  input: LeavePolicyInput,
  newId: () => string,
): LeavePolicy {
  const checked = validate(store, companyId, input, null);
  const policy: LeavePolicy = { id: newId(), companyId, ...checked };
  store.leavePolicies.push(policy);
  record(
    store,
    companyId,
    actor,
    `Added leave policy ${policy.name} for ${policy.cadre}`,
    newId,
  );
  return policy;
}

/**
 * Register and encashment rows keep the leave name as text. When a rename
 * changes the only policy that carries a name, those rows follow it. When
 * another cadre still has a policy for the old name, the rows stay as they are.
 */
export function updateLeavePolicy(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  input: LeavePolicyInput,
  newId: () => string,
): LeavePolicy {
  const policy = owned(store, companyId, id);
  const checked = validate(store, companyId, input, id);
  const previous = policy.name;
  let moved = 0;
  if (
    !same(previous, checked.name) &&
    otherPoliciesNamed(store, companyId, previous, id) === 0
  ) {
    for (const row of [...store.leaveBalances, ...store.encashments]) {
      if (row.companyId === companyId && same(row.leaveName, previous)) {
        row.leaveName = checked.name;
        moved += 1;
      }
    }
  }
  Object.assign(policy, checked);
  record(
    store,
    companyId,
    actor,
    previous === checked.name
      ? `Edited leave policy ${policy.name} for ${policy.cadre}`
      : `Renamed leave ${previous} to ${policy.name} for ${policy.cadre} (${moved} ${moved === 1 ? "record" : "records"})`,
    newId,
  );
  return policy;
}

export function deleteLeavePolicy(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  newId: () => string,
): void {
  const policy = owned(store, companyId, id);
  const used = recordsBlockingDelete(store, companyId, policy);
  if (used > 0) {
    throw new LeavePolicyError(
      `${policy.name} has ${used} register or encashment ${used === 1 ? "record" : "records"} and no other cadre has a policy for it, so it cannot be deleted while those records exist.`,
    );
  }
  store.leavePolicies = store.leavePolicies.filter((item) => item.id !== id);
  record(
    store,
    companyId,
    actor,
    `Deleted leave policy ${policy.name} for ${policy.cadre}`,
    newId,
  );
}
