import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("environment files are gitignored and editor defaults are set", () => {
  const ignore = fs.readFileSync(
    new URL("../.gitignore", import.meta.url),
    "utf8",
  );
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);

  const editor = fs.readFileSync(
    new URL("../.editorconfig", import.meta.url),
    "utf8",
  );
  assert.match(editor, /charset = utf-8/);
  assert.match(editor, /end_of_line = lf/);

  const attributes = fs.readFileSync(
    new URL("../.gitattributes", import.meta.url),
    "utf8",
  );
  assert.match(attributes, /eol=lf/);
});
