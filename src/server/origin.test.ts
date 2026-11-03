import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  dataOrigin,
  readStore,
  resetStoreCache,
  seedStore,
  updateStore,
} from "./store.ts";

test("the sample seed is demo and a saved or older store is the company", () => {
  assert.equal(dataOrigin(seedStore()), "demo");
  const saved = seedStore();
  saved.source = "company";
  assert.equal(dataOrigin(saved), "company");
  const legacy = seedStore();
  legacy.source = undefined;
  assert.equal(dataOrigin(legacy), "company");
});

test("the first save stops labeling the store as a demo", () => {
  const previous = process.env.STORE_PATH;
  const file = path.join(os.tmpdir(), `munshi-origin-${Date.now()}.json`);
  process.env.STORE_PATH = file;
  resetStoreCache();
  try {
    assert.equal(dataOrigin(readStore()), "demo");
    updateStore((store) => {
      store.companies[0].name = "Saved Company";
    });
    assert.equal(dataOrigin(readStore()), "company");
    assert.equal(readStore().companies[0].name, "Saved Company");
  } finally {
    fs.rmSync(file, { force: true });
    if (previous === undefined) delete process.env.STORE_PATH;
    else process.env.STORE_PATH = previous;
    resetStoreCache();
  }
});
