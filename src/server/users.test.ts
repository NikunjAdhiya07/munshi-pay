import assert from "node:assert/strict";
import test from "node:test";
import { seedStore } from "./store.ts";
import {
  addUser,
  changePassword,
  companiesFor,
  landingCompany,
  memberOf,
  roleFor,
  sessionCurrent,
  signIn,
  UserError,
} from "./users.ts";

const env = {
  configured: true,
  username: "owner",
  password: "owner-password",
};
const now = Date.parse("2026-10-07T12:00:00Z");

test("the first environment sign-in creates an owner of every company", () => {
  const store = seedStore();
  const result = signIn(store, "owner", "owner-password", now, env);
  assert.equal(result.status, "ok");
  const user = store.users[0];
  assert.ok(user);
  assert.equal(user.accountOwner, true);
  assert.equal(user.passwordHash.includes("owner-password"), false);
  assert.deepEqual(
    companiesFor(store, user.id).map((company) => company.id),
    ["c1", "c2"],
  );
  assert.equal(roleFor(store, user.id, "c1"), "owner");
  assert.equal(
    signIn(store, "owner", "owner-password", now, {
      ...env,
      password: "changed-env-password",
    }).status,
    "ok",
  );
  assert.equal(
    signIn(store, "owner", "changed-env-password", now, env).status,
    "invalid",
  );
});

test("a viewer signs in as a viewer and only sees their companies", () => {
  const store = seedStore();
  addUser(store, {
    id: "u-view",
    username: "viewer",
    password: "viewer-password",
    memberships: [{ companyId: "c2", role: "viewer" }],
  });
  const result = signIn(store, "viewer", "viewer-password", now, env);
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.userId, "u-view");
  assert.equal(roleFor(store, "u-view", "c2"), "viewer");
  assert.equal(roleFor(store, "u-view", "c1"), null);
  assert.deepEqual(
    companiesFor(store, "u-view").map((company) => company.id),
    ["c2"],
  );
  assert.equal(memberOf(store, "u-view", "c2"), true);
  assert.equal(memberOf(store, "u-view", "c1"), false);
  assert.equal(memberOf(store, "u-view", "missing"), false);
});

test("eight failures lock the username until the window passes", () => {
  const store = seedStore();
  addUser(store, {
    id: "u1",
    username: "owner",
    password: "owner-password",
    memberships: [{ companyId: "c1", role: "owner" }],
  });
  for (let attempt = 0; attempt < 8; attempt++) {
    assert.equal(
      signIn(store, "owner", "wrong-password", now + attempt, env).status,
      "invalid",
    );
  }
  assert.equal(
    signIn(store, "owner", "owner-password", now + 8, env).status,
    "limited",
  );
  const restored = JSON.parse(JSON.stringify(store));
  assert.equal(
    signIn(restored, "owner", "owner-password", now + 9, env).status,
    "limited",
  );
  assert.equal(
    signIn(restored, "owner", "owner-password", now + 10 * 60 * 1000 + 1, env)
      .status,
    "ok",
  );
});

test("a password change ends the previous session and omits the password", () => {
  const store = seedStore();
  const user = addUser(store, {
    id: "u1",
    username: "owner",
    password: "owner-password",
    memberships: [{ companyId: "c1", role: "owner" }],
  });
  assert.equal(sessionCurrent(user, 1), true);
  changePassword(
    store,
    user.id,
    "owner-password",
    "next-password",
    "2026-10-07T12:00:00.000Z",
    "audit-1",
  );
  assert.equal(sessionCurrent(user, 1), false);
  assert.equal(sessionCurrent(user, 2), true);
  assert.equal(store.audit[0]?.action, "password-changed");
  const audit = JSON.stringify(store.audit);
  assert.equal(audit.includes("next-password"), false);
  assert.equal(audit.includes("owner-password"), false);
  assert.equal(signIn(store, "owner", "next-password", now, env).status, "ok");
  assert.throws(
    () =>
      changePassword(
        store,
        user.id,
        "owner-password",
        "another-password",
        "2026-10-07T12:01:00.000Z",
        "audit-2",
      ),
    UserError,
  );
});

test("sign-in is unconfigured when the store has no user and no environment login", () => {
  const store = seedStore();
  assert.equal(
    signIn(store, "owner", "owner-password", now, {
      configured: false,
      username: "",
      password: "",
    }).status,
    "unconfigured",
  );
});

test("sign-in lands on the remembered company, else the first by name, else none", () => {
  const store = seedStore();
  addUser(store, {
    id: "u-multi",
    username: "multi",
    password: "multi-password",
    memberships: [
      { companyId: "c1", role: "owner" },
      { companyId: "c2", role: "viewer" },
    ],
  });
  addUser(store, {
    id: "u-one",
    username: "single",
    password: "single-password",
    memberships: [{ companyId: "c2", role: "viewer" }],
  });
  addUser(store, {
    id: "u-none",
    username: "nobody",
    password: "nobody-password",
    memberships: [],
  });
  assert.equal(landingCompany(store, "u-multi", "c2")?.id, "c2");
  assert.equal(
    landingCompany(store, "u-multi", null)?.name,
    "Harbour Logistics",
  );
  assert.equal(landingCompany(store, "u-multi", "missing")?.id, "c2");
  assert.equal(landingCompany(store, "u-one", "c1")?.id, "c2");
  assert.equal(landingCompany(store, "u-none", "c1"), null);
  assert.equal(landingCompany(store, "unknown-user", null), null);
});
