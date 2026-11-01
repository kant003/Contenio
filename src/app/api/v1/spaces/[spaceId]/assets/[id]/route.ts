import { z } from "zod";
import { apiGuard, apiResult, json, ApiError } from "@/lib/delivery";
import { assetUrl } from "@/lib/storage";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ spaceId: string; id: string }> },
) {
  return apiResult(async () => {
    const { spaceId, id } = await params;
    z.uuid().parse(id);
    const db = await apiGuard(request, spaceId);
    const { rows } = await db.query(
      "select public.delivery_asset($1,$2) as asset",
      [spaceId, id],
    );
    const asset = rows[0]?.asset;
    if (!asset) throw new ApiError(404, "Archivo no publicado");
    return json({
      id: asset.id,
      name: asset.name,
      mime: asset.mime,
      size: Number(asset.size),
      alt: asset.alt,
      description: asset.description,
      url: assetUrl(asset),
      expiresIn: 900,
    });
  });
}
