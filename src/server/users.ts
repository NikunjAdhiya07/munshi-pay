import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { Company, Role, Store, User } from "./model.ts";

const KEYLEN = 32;
const SCRYPT = { N: 16_384, r: 8, p: 1 } as const;
const WINDOW_MS = 10 * 60 * 1000;
const LOCK_AFTER = 8;
const MIN_PASSWORD = 8;

export class UserError extends Error {}

export type SignInEnv = {
  configured: boolean;
  username: string;
  password: string;
};

export type SignInResult =
  | { status: "ok"; userId: string }
  | { status: "unconfigured" | "invalid" | "limited" };

let dummyHash: string | null = null;

function same(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/** scrypt hash. The stored text never contains the password. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, SCRYPT);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(
    password,
    Buffer.from(salt, "base64url"),
    KEYLEN,
    SCRYPT,
  );
  const expected = Buffer.from(hash, "base64url");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function placeholder(): string {
  dummyHash ??= hashPassword("not-a-real-password");
  return dummyHash;
}

function prune(store: Store, now: number): void {
  store.signInFailures = store.signInFailures.filter(
    (item) => now - item.at < WINDOW_MS,
  );
}

function failuresFor(store: Store, username: string): number {
  return store.signInFailures.filter((item) => item.username === username)
    .length;
}

function ownerFromEnv(store: Store, env: SignInEnv): User {
  return {
    id: randomUUID(),
    username: env.username,
    passwordHash: hashPassword(env.password),
    accountOwner: true,
    sessionVersion: 1,
    memberships: store.companies.map((company) => ({
      companyId: company.id,
      role: "owner" as const,
    })),
  };
}

/**
 * Checks the password against stored users. The first successful environment
 * login creates the account owner when the store has no users yet (DEC-018).
 * Eight failures in ten minutes lock that username. The caller must persist
 * the store, including failures.
 */
export function signIn(
  store: Store,
  username: string,
  password: string,
  now: number,
  env: SignInEnv,
): SignInResult {
  prune(store, now);
  if (store.users.length === 0) {
    if (!env.configured) return { status: "unconfigured" };
    if (!same(username, env.username) || !same(password, env.password)) {
      store.signInFailures.push({ username, at: now });
      return { status: "invalid" };
    }
    const user = ownerFromEnv(store, env);
    store.users.push(user);
    return { status: "ok", userId: user.id };
  }
  if (failuresFor(store, username) >= LOCK_AFTER) return { status: "limited" };
  const user = store.users.find((item) => same(item.username, username));
  const ok = user
    ? verifyPassword(password, user.passwordHash)
    : verifyPassword(password, placeholder());
  if (!user || !ok) {
    store.signInFailures.push({ username, at: now });
    return { status: "invalid" };
  }
  store.signInFailures = store.signInFailures.filter(
    (item) => item.username !== username,
  );
  return { status: "ok", userId: user.id };
}

export function addUser(
  store: Store,
  input: {
    id: string;
    username: string;
    password: string;
    accountOwner?: boolean;
    memberships: { companyId: string; role: Role }[];
  },
): User {
  const username = input.username.trim();
  if (!username) throw new UserError("Enter a username.");
  if (input.password.length < MIN_PASSWORD) {
    throw new UserError(
      `Password must be at least ${MIN_PASSWORD} characters.`,
    );
  }
  if (store.users.some((item) => same(item.username, username))) {
    throw new UserError("That username is already in use.");
  }
  const user: User = {
    id: input.id,
    username,
    passwordHash: hashPassword(input.password),
    accountOwner: input.accountOwner ?? false,
    sessionVersion: 1,
    memberships: input.memberships.map((item) => ({ ...item })),
  };
  store.users.push(user);
  return user;
}

/** Companies this user may open. Others are omitted even if they exist. */
export function companiesFor(store: Store, userId: string): Company[] {
  const user = store.users.find((item) => item.id === userId);
  if (!user) return [];
  const ids = new Set(user.memberships.map((item) => item.companyId));
  return store.companies.filter((company) => ids.has(company.id));
}

/**
 * The company to open right after sign-in. The one the person used last is
 * kept when they still belong to it. Otherwise it is the first company by name,
 * so a person with one company never sees a picker and a person with several
 * lands on a dashboard that has the company switcher. Null when the user
 * belongs to no company.
 */
export function landingCompany(
  store: Store,
  userId: string,
  preferredId: string | null | undefined,
): Company | null {
  const open = companiesFor(store, userId);
  const preferred = open.find((company) => company.id === preferredId);
  if (preferred) return preferred;
  return [...open].sort((a, b) => a.name.localeCompare(b.name))[0] ?? null;
}

/** Is this user a member of the company, and does the company exist? */
export function memberOf(
  store: Store,
  userId: string,
  companyId: string,
): boolean {
  return companiesFor(store, userId).some((item) => item.id === companyId);
}

export function roleFor(
  store: Store,
  userId: string,
  companyId: string,
): Role | null {
  const user = store.users.find((item) => item.id === userId);
  return (
    user?.memberships.find((item) => item.companyId === companyId)?.role ?? null
  );
}

export function sessionCurrent(
  user: User | undefined,
  version: number,
): boolean {
  return user !== undefined && user.sessionVersion === version;
}

/**
 * Replaces the password and ends every existing session for this user.
 * The audit entry names the action and never the password.
 */
export function changePassword(
  store: Store,
  userId: string,
  current: string,
  next: string,
  now: string,
  auditId: string,
): void {
  const user = store.users.find((item) => item.id === userId);
  if (!user) throw new UserError("User not found.");
  if (!verifyPassword(current, user.passwordHash)) {
    throw new UserError("The current password is incorrect.");
  }
  if (next.length < MIN_PASSWORD) {
    throw new UserError(
      `Password must be at least ${MIN_PASSWORD} characters.`,
    );
  }
  user.passwordHash = hashPassword(next);
  user.sessionVersion += 1;
  store.audit.push({
    id: auditId,
    at: now,
    actor: user.username,
    action: "password-changed",
    companyId: user.memberships[0]?.companyId ?? "",
  });
}
