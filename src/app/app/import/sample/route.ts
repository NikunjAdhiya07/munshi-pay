import { findImport } from "../../../../domain/import";
import { can } from "../../../../server/access";
import { currentSession } from "../../../../server/auth";
import { readStore } from "../../../../server/store";
import { sampleSheet } from "../../../../server/xlsx";

export async function GET(request: Request): Promise<Response> {
  const session = await currentSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const store = readStore();
  if (!can(session.role, store.rights, "import", "view")) {
    return new Response("Forbidden", { status: 403 });
  }
  const kind = new URL(request.url).searchParams.get("kind") ?? "";
  const definition = findImport(kind);
  if (!definition) return new Response("Not found", { status: 404 });
  const bytes = await sampleSheet(
    definition.columns.map((column) => column.label),
  );
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${definition.id}.xlsx"`,
    },
  });
}
