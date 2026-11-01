import { cmsDb, pool } from "../src/lib/database";
import { removeAssetObject } from "../src/lib/storage";
import type { Asset } from "../src/lib/types";
export async function rpc(
  userId: string,
  name: string,
  args: Record<string, unknown> = {},
) {
  const { data, error } = await cmsDb(userId).rpc(name, args);
  if (error) throw error;
  return data;
}
export async function cleanSpaces(spaces: string[]) {
  if (!spaces.length) return;
  const db = pool();
  const { rows: assets } = await db.query<Asset>(
    "select * from assets where space_id=any($1::uuid[])",
    [spaces],
  );
  for (const asset of assets) {
    try {
      await removeAssetObject(asset);
    } catch {
      /* Failed test may have left only metadata. */
    }
  }
  for (const table of [
    "publication_heads",
    "publication_asset_links",
    "publication_entry_links",
    "publications",
    "entry_links",
    "asset_links",
    "entries",
    "assets",
    "api_keys",
    "memberships",
    "content_types",
    "spaces",
  ]) {
    await db.query(
      `delete from ${table} where ${table === "spaces" ? "id" : "space_id"}=any($1::uuid[])`,
      [spaces],
    );
  }
}
