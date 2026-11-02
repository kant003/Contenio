import { z } from "zod";
import { configured, userQuery } from "@/lib/database";
import { getAuth } from "@/lib/auth";
import { getResourcePage } from "@/lib/editor-resources";
import { pickerQuerySchema } from "@/lib/picker-types";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> },
) {
  if (!configured())
    return Response.json(
      { error: "Aplicación sin configurar" },
      { status: 503, headers },
    );
  const current = await getAuth().api.getSession({ headers: request.headers });
  if (!current)
    return Response.json(
      { error: "Inicia sesión para consultar recursos" },
      { status: 401, headers },
    );
  const { spaceId } = await params;
  if (!z.uuid().safeParse(spaceId).success)
    return Response.json(
      { error: "Espacio no encontrado" },
      { status: 404, headers },
    );
  const search = new URL(request.url).searchParams;
  const query = pickerQuerySchema.safeParse({
    kind: search.get("kind") ?? undefined,
    locale: search.get("locale") ?? undefined,
    q: search.get("q") ?? undefined,
    page: search.get("page") ?? undefined,
    exclude: search.get("exclude") ?? undefined,
  });
  if (!query.success)
    return Response.json(
      { error: "Filtros de búsqueda inválidos" },
      { status: 400, headers },
    );
  const spaces = await userQuery(
    current.user.id,
    "select id from spaces where id=$1",
    [spaceId],
  );
  if (!spaces.length)
    return Response.json(
      { error: "Espacio no encontrado" },
      { status: 404, headers },
    );
  try {
    return Response.json(
      await getResourcePage(current.user.id, spaceId, query.data),
      { headers },
    );
  } catch {
    return Response.json(
      { error: "No se pudo consultar la biblioteca" },
      { status: 500, headers },
    );
  }
}
