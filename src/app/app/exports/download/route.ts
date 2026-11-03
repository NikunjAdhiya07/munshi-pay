import { canExport } from "../../../../server/access";
import { currentPeriod, currentSession } from "../../../../server/auth";
import {
  buildExport,
  ExportError,
  findExport,
} from "../../../../server/exports";
import { readStore } from "../../../../server/store";
import { buildTableSheet } from "../../../../server/xlsx";

/** Back to the screen with the reason and the choices, so the form keeps them. */
function back(
  request: Request,
  slug: string,
  month: string | undefined,
  columns: string[],
  error: string,
): Response {
  const url = new URL("/app/exports", request.url);
  url.searchParams.set("error", error);
  url.searchParams.set("export", slug);
  if (month) url.searchParams.set("month", month.slice(0, 7));
  for (const column of columns.slice(0, 40)) {
    url.searchParams.append("col", column.slice(0, 40));
  }
  url.hash = slug;
  return Response.redirect(url, 303);
}

export async function GET(request: Request): Promise<Response> {
  const session = await currentSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const params = new URL(request.url).searchParams;
  const def = findExport(params.get("export") ?? "");
  if (!def) return new Response("Unknown export", { status: 404 });
  const store = readStore();
  if (!canExport(session.role, store.rights, def.menu)) {
    return new Response("Forbidden", { status: 403 });
  }
  const month = def.month
    ? params.get("month")?.trim() || (await currentPeriod())
    : undefined;
  const columns = params.getAll("col");
  let bytes: Buffer;
  try {
    const table = buildExport(store, session.companyId, def.slug, {
      month,
      columns,
    });
    bytes = await buildTableSheet(table);
  } catch (error) {
    if (!(error instanceof ExportError)) throw error;
    return back(request, def.slug, month, columns, error.message);
  }
  const name = month ? `${def.slug}-${month}` : def.slug;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
