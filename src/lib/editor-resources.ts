import { userQuery } from "./database";
import { getContentPage } from "./content-listing";
import { parseContentFilters, CONTENT_PAGE_SIZE } from "./content-filters";
import { getMediaPage } from "./media-listing";
import { parseMediaFilters, MEDIA_PAGE_SIZE } from "./media-filters";
import { assetUrl } from "./storage";
import {
  assetItem,
  type PickerItem,
  type PickerPage,
  type PickerQuery,
} from "./picker-types";
import type { Asset, Locale } from "./types";

async function entryItems(
  userId: string,
  spaceId: string,
  ids: string[],
  locale: Locale,
): Promise<PickerItem[]> {
  if (!ids.length) return [];
  const rows = await userQuery<{
    id: string;
    detail: string;
    titles: Record<Locale, unknown>;
  }>(
    userId,
    `
    select e.id,t.name as detail,jsonb_build_object(
      'es',coalesce(nullif(e.translations->'es'->k.key,'null'::jsonb),e.shared->k.key),
      'gl',coalesce(nullif(e.translations->'gl'->k.key,'null'::jsonb),e.shared->k.key)) as titles
    from entries e join content_types t on t.id=e.content_type_id and t.space_id=e.space_id
    cross join lateral (
      select coalesce((select f->>'key' from jsonb_array_elements(t.fields) with ordinality as f(f,n)
        where f->>'key'='title' or f->>'type'='short_text'
        order by (f->>'key'='title') desc,n limit 1),'title') as key
    ) k where e.space_id=$1 and e.id=any($2::uuid[])
  `,
    [spaceId, ids],
  );
  const items = rows.map((row) => {
    const title = (v: unknown) =>
      typeof v === "string" && v ? v : "Sin título";
    const titles = { es: title(row.titles.es), gl: title(row.titles.gl) };
    return { id: row.id, label: titles[locale], detail: row.detail, titles };
  });
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}
export async function getResourcePage(
  userId: string,
  spaceId: string,
  query: PickerQuery,
): Promise<PickerPage> {
  if (query.kind === "entry") {
    const result = await getContentPage(
      userId,
      spaceId,
      parseContentFilters({
        q: query.q,
        locale: query.locale,
        page: String(query.page),
        sort: "name",
      }),
      query.exclude,
    );
    return {
      items: await entryItems(
        userId,
        spaceId,
        result.items.map((item) => item.id),
        query.locale,
      ),
      total: result.total,
      page: result.page,
      pageSize: CONTENT_PAGE_SIZE,
    };
  }
  const result = await getMediaPage(
    userId,
    spaceId,
    parseMediaFilters({
      q: query.q,
      locale: query.locale,
      page: String(query.page),
      kind: query.kind === "image" ? "image" : "",
      sort: "name",
    }),
  );
  return {
    items: result.items.map((asset) =>
      assetItem({ ...asset, url: assetUrl(asset) }),
    ),
    total: result.total,
    page: result.page,
    pageSize: MEDIA_PAGE_SIZE,
  };
}
/** Load only resources already used by this draft, including images in both locales. */
export async function getLinkedResources(
  userId: string,
  spaceId: string,
  entryId?: string,
) {
  if (!entryId)
    return { assets: [] as Asset[], entryChoices: [] as PickerItem[] };
  const [assets, links] = await Promise.all([
    userQuery<Asset>(
      userId,
      `select a.id,a.space_id,a.path,a.name,a.mime,a.size,a.alt,a.description
      from assets a join asset_links l on l.asset_id=a.id and l.space_id=a.space_id
      where l.space_id=$1 and l.entry_id=$2`,
      [spaceId, entryId],
    ),
    userQuery<{ id: string }>(
      userId,
      "select target_id as id from entry_links where space_id=$1 and source_id=$2",
      [spaceId, entryId],
    ),
  ]);
  return {
    assets: assets.map((asset) => ({ ...asset, url: assetUrl(asset) })),
    entryChoices: await entryItems(
      userId,
      spaceId,
      links.map((link) => link.id),
      "es",
    ),
  };
}
