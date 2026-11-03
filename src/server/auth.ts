import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { todayInKolkata } from "../domain/dashboard";
import { type Action, can } from "./access";
import type { Menu, Role } from "./model";
import { readStore } from "./store";
import { roleFor, sessionCurrent } from "./users";

/** Cookie payload. The role is not stored; each request reads it from the membership. */
type SessionCookie = {
  userId: string;
  companyId: string;
  version: number;
};

export type Session = SessionCookie & {
  username: string;
  role: Role | null;
};

const SESSION = "mp_session";
const PERIOD = "mp_period";
const LAST_COMPANY = "mp_company";

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

function secret(): string | null {
  return process.env.AUTH_SECRET || null;
}

function sign(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

export function authEnv(): {
  configured: boolean;
  username: string;
  password: string;
} {
  const username = process.env.AUTH_USERNAME ?? "";
  const password = process.env.AUTH_PASSWORD ?? "";
  return {
    configured: Boolean(secret() && username && password),
    username,
    password,
  };
}

export async function currentSession(): Promise<Session | null> {
  const key = secret();
  if (!key) return null;
  const raw = (await cookies()).get(SESSION)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(body, key);
  if (!safeEqual(sig, expected)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as SessionCookie;
    if (!parsed.userId || typeof parsed.version !== "number") return null;
    if (typeof parsed.companyId !== "string") return null;
    const store = readStore();
    const user = store.users.find((item) => item.id === parsed.userId);
    if (!sessionCurrent(user, parsed.version) || !user) return null;
    return {
      userId: user.id,
      username: user.username,
      companyId: parsed.companyId,
      version: parsed.version,
      role: parsed.companyId ? roleFor(store, user.id, parsed.companyId) : null,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await currentSession();
  if (!session) redirect("/");
  return session;
}

/**
 * The session for a workspace page. The company must be one this login belongs
 * to, and the role needs the right on the menu. A role without it is sent to
 * the dashboard with a message, so a page never reads data it may not show.
 */
export async function requireView(
  menu: Menu,
  action: Action = "view",
): Promise<Session> {
  const session = await requireSession();
  if (!session.companyId) redirect("/companies");
  if (!session.role) {
    redirect("/companies?error=That+company+is+not+open+for+this+login");
  }
  const store = readStore();
  if (!can(session.role, store.rights, menu, action)) {
    redirect("/app?error=You+do+not+have+permission+to+open+that+page");
  }
  return session;
}

export async function writeSession(session: SessionCookie): Promise<void> {
  const key = secret();
  if (!key) throw new Error("AUTH_SECRET is not set");
  const body = Buffer.from(
    JSON.stringify({
      userId: session.userId,
      companyId: session.companyId,
      version: session.version,
    }),
  ).toString("base64url");
  const jar = await cookies();
  jar.set(SESSION, `${body}.${sign(body, key)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION);
}

/** The month the person last chose, or the current month in India. */
export async function currentPeriod(): Promise<string> {
  const saved = (await cookies()).get(PERIOD)?.value;
  if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
  return todayInKolkata().slice(0, 7);
}

/**
 * Remembers which company this login opened last, so the next sign-in goes
 * straight to it. The value is only a hint: it is checked against the
 * membership list every time it is read.
 */
export async function rememberCompany(
  userId: string,
  companyId: string,
): Promise<void> {
  (await cookies()).set(LAST_COMPANY, `${userId}:${companyId}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

/** The company this login opened last, or null. Another login's hint is ignored. */
export async function lastCompany(userId: string): Promise<string | null> {
  const raw = (await cookies()).get(LAST_COMPANY)?.value ?? "";
  const cut = raw.indexOf(":");
  if (cut <= 0 || raw.slice(0, cut) !== userId) return null;
  return raw.slice(cut + 1) || null;
}

export async function writePeriod(period: string): Promise<void> {
  (await cookies()).set(PERIOD, period, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
