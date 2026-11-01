import { z } from "zod";
import { pool } from "@/lib/database";
import { validAssetToken, readAsset } from "@/lib/storage";
import type { Asset } from "@/lib/types";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ spaceId: string; id: string }> },
) {
  const { spaceId, id } = await params;
  const q = new URL(request.url).searchParams;
  if (
    !z.uuid().safeParse(spaceId).success ||
    !z.uuid().safeParse(id).success ||
    !validAssetToken(spaceId, id, q.get("expires"), q.get("signature"))
  )
    return new Response("Enlace inválido o caducado", { status: 404 });
  const { rows } = await pool().query<Asset>(
    "select * from assets where id=$1 and space_id=$2",
    [id, spaceId],
  );
  if (!rows[0]) return new Response("Archivo no disponible", { status: 404 });
  try {
    return new Response(Buffer.from(await readAsset(rows[0])), {
      headers: {
        "Content-Type": rows[0].mime,
        "Content-Length": String(rows[0].size),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition":
          rows[0].mime === "application/pdf" ? "attachment" : "inline",
      },
    });
  } catch {
    return new Response("Archivo no disponible", { status: 404 });
  }
}
