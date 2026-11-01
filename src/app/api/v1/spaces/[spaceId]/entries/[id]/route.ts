import { z } from "zod";
import {
  apiGuard,
  apiResult,
  entryResponse,
  json,
  ApiError,
} from "@/lib/delivery";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ spaceId: string; id: string }> },
) {
  return apiResult(async () => {
    const { spaceId, id } = await params;
    z.uuid().parse(id);
    const db = await apiGuard(request, spaceId),
      locale = z
        .enum(["es", "gl"])
        .parse(new URL(request.url).searchParams.get("locale") ?? "es");
    const { rows } = await db.query(
      "select entry_id,type_key,locale,fields,published_at from current_publications where space_id=$1 and entry_id=$2 and locale=$3",
      [spaceId, id, locale],
    );
    if (!rows[0])
      throw new ApiError(404, "No existe una publicación en ese idioma");
    return json(entryResponse(rows[0]));
  });
}
