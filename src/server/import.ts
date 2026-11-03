import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  canCommit,
  findImport,
  type Review,
  reviewSheet,
} from "../domain/import.ts";
import type { Store } from "./model.ts";
import { readSheet } from "./xlsx.ts";

export class ImportError extends Error {}

type PreviewMeta = {
  id: string;
  companyId: string;
  actor: string;
  kind: string;
};

export function importDir(): string {
  return process.env.IMPORT_DIR ?? path.join(process.cwd(), "data", "imports");
}

function metaPath(id: string): string {
  return path.join(importDir(), `${id}.json`);
}

function filePath(id: string): string {
  return path.join(importDir(), `${id}.xlsx`);
}

function safeId(id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new ImportError("That preview is not available.");
  return id;
}

export function isXlsx(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export async function reviewUpload(
  kind: string,
  bytes: Buffer,
): Promise<Review> {
  const definition = findImport(kind);
  if (!definition) throw new ImportError("That import is not available.");
  if (!isXlsx(bytes)) throw new ImportError("Upload an .xlsx file.");
  let rows: Awaited<ReturnType<typeof readSheet>>;
  try {
    rows = await readSheet(bytes);
  } catch {
    throw new ImportError("The workbook could not be read.");
  }
  return reviewSheet(definition, rows);
}

export async function savePreview(input: {
  companyId: string;
  actor: string;
  kind: string;
  bytes: Buffer;
}): Promise<string> {
  const id = randomUUID();
  fs.mkdirSync(importDir(), { recursive: true });
  const meta: PreviewMeta = {
    id,
    companyId: input.companyId,
    actor: input.actor,
    kind: input.kind,
  };
  fs.writeFileSync(metaPath(id), JSON.stringify(meta));
  fs.writeFileSync(filePath(id), input.bytes);
  return id;
}

export function readPreviewMeta(
  id: string,
  companyId: string,
): PreviewMeta | null {
  let safe: string;
  try {
    safe = safeId(id);
  } catch {
    return null;
  }
  const file = metaPath(safe);
  if (!fs.existsSync(file)) return null;
  const meta = JSON.parse(fs.readFileSync(file, "utf8")) as PreviewMeta;
  if (meta.companyId !== companyId) return null;
  return meta;
}

export async function loadPreview(
  id: string,
  companyId: string,
): Promise<{
  meta: PreviewMeta;
  review: Review;
} | null> {
  const meta = readPreviewMeta(id, companyId);
  if (!meta) return null;
  const bytes = fs.readFileSync(filePath(meta.id));
  const review = await reviewUpload(meta.kind, bytes);
  return { meta, review };
}

export async function commitPreview(
  store: Store,
  id: string,
  companyId: string,
  actor: string,
): Promise<number> {
  const loaded = await loadPreview(id, companyId);
  if (!loaded) throw new ImportError("That preview is not available.");
  if (!canCommit(loaded.review) || loaded.review.state !== "rows") {
    throw new ImportError("Save is available only when every row is accepted.");
  }
  const definition = findImport(loaded.meta.kind);
  if (!definition) throw new ImportError("That import is not available.");
  const rows = loaded.review.rows.map((row) => row.values);
  store.imports ??= [];
  store.imports.push({
    id: randomUUID(),
    companyId,
    kind: definition.id,
    rows,
    at: new Date().toISOString(),
    actor,
  });
  store.audit.unshift({
    id: randomUUID(),
    at: new Date().toISOString(),
    actor,
    action: `Imported ${definition.title} (${rows.length} rows)`,
    companyId,
  });
  fs.rmSync(metaPath(loaded.meta.id), { force: true });
  fs.rmSync(filePath(loaded.meta.id), { force: true });
  return rows.length;
}
