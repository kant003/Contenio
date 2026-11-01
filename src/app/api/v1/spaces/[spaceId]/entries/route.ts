import {
  apiGuard,
  apiResult,
  entryResponse,
  json,
  querySchema,
} from "@/lib/delivery";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> },
) {
  return apiResult(async () => {
    const { spaceId } = await params,
      db = await apiGuard(request, spaceId),
      q = querySchema.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
    const filter =
        "space_id=$1 and locale=$2 and ($3::text is null or type_key=$3) and ($4::text is null or slug=$4)",
      values = [spaceId, q.locale, q.type ?? null, q.slug ?? null];
    // A single statement keeps count and page consistent under concurrent publishing.
    const { rows } = await db.query(
      `with filtered as (select entry_id,type_key,locale,fields,published_at from current_publications where ${filter}) select (select count(*)::int from filtered) as total,coalesce((select jsonb_agg(r) from (select * from filtered order by published_at desc,entry_id limit $5 offset $6) r),'[]') as items`,
      [...values, q.limit, q.offset],
    );
    return json({
      items: rows[0].items.map(entryResponse),
      total: rows[0].total,
      limit: q.limit,
      offset: q.offset,
    });
  });
}
