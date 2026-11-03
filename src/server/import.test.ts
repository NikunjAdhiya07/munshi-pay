import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FILE_LIMIT_BYTES } from "../domain/import.ts";
import { can } from "./access.ts";
import {
  commitPreview,
  ImportError,
  reviewUpload,
  savePreview,
} from "./import.ts";
import { seedStore } from "./store.ts";
import { buildSheet, sampleSheet } from "./xlsx.ts";

test("a workbook is saved for one company only when every row is accepted", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "munshi-import-"));
  process.env.IMPORT_DIR = dir;
  const store = seedStore();
  assert.equal(can("viewer", store.rights, "import", "add"), false);
  assert.equal(can("owner", store.rights, "import", "add"), true);
  const good = await sampleSheet(["Code", "Name", "Join date"]);
  const bytes = await buildSheet([
    ["Code", "Name", "Join date"],
    ["E010", "Nila", "2024-04-01"],
    ["E011", "Ravi", "2024-05-01"],
  ]);

  const preview = await reviewUpload("employees", bytes);
  assert.equal(preview.state, "rows");
  const id = await savePreview({
    companyId: "c1",
    actor: "tester",
    kind: "employees",
    bytes,
  });
  const count = await commitPreview(store, id, "c1", "tester");
  assert.equal(count, 2);
  assert.equal(store.imports.length, 1);
  assert.equal(store.imports[0]?.companyId, "c1");
  assert.equal(store.imports[0]?.rows[0]?.name, "Nila");
  assert.equal(store.audit[0]?.action, "Imported Employees (2 rows)");
  assert.equal(JSON.stringify(store.audit).includes("Nila"), false);
  await assert.rejects(commitPreview(store, id, "c1", "tester"), ImportError);
  assert.equal(store.imports.length, 1);

  const other = await savePreview({
    companyId: "c1",
    actor: "tester",
    kind: "employees",
    bytes,
  });
  await assert.rejects(
    commitPreview(store, other, "c2", "tester"),
    ImportError,
  );
  assert.equal(store.imports.length, 1);

  const rejectedBytes = await buildSheet([
    ["Code", "Name", "Join date"],
    ["E012", "", "2024-04-01"],
  ]);
  const rejected = await reviewUpload("employees", rejectedBytes);
  assert.equal(rejected.state, "rows");
  if (rejected.state === "rows") {
    assert.equal(rejected.rows[0]?.status, "rejected");
  }
  const rejectedId = await savePreview({
    companyId: "c1",
    actor: "tester",
    kind: "employees",
    bytes: rejectedBytes,
  });
  const before = store.imports.length;
  const audits = store.audit.length;
  await assert.rejects(
    commitPreview(store, rejectedId, "c1", "tester"),
    ImportError,
  );
  assert.equal(store.imports.length, before);
  assert.equal(store.audit.length, audits);

  await assert.rejects(
    reviewUpload("employees", Buffer.from("not-a-zip")),
    ImportError,
  );
  await assert.rejects(reviewUpload("leave-flow", good), ImportError);
  assert.ok(FILE_LIMIT_BYTES > good.length);
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.IMPORT_DIR;
});
