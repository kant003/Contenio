import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { attachDatabasePool } from "@vercel/functions";
types.setTypeParser(1184, (value) => new Date(value).toISOString());
const globalDb = globalThis as unknown as { contenioPool?: Pool };
export function configured() {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
}
export function pool() {
  if (!process.env.DATABASE_URL)
    throw new Error("Falta DATABASE_URL. Conecta Neon Postgres desde Vercel.");
  if (!globalDb.contenioPool) {
    globalDb.contenioPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });
    if (process.env.VERCEL) attachDatabasePool(globalDb.contenioPool);
  }
  return globalDb.contenioPool;
}
export async function asUser<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
) {
  const client = await pool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.user_id',$1,true)", [userId]);
    await client.query("set local role contenio_app");
    const value = await fn(client);
    await client.query("commit");
    return value;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
export function userQuery<T extends QueryResultRow = QueryResultRow>(
  userId: string,
  sql: string,
  values: unknown[] = [],
) {
  return asUser(
    userId,
    async (client) => (await client.query<T>(sql, values)).rows,
  );
}
const procedures: Record<string, string[]> = {
  is_admin: [],
  can_access_space: ["s"],
  create_space: ["p_name", "p_slug"],
  set_member: ["p_space", "p_email", "p_remove"],
  list_members: ["p_space"],
  save_content_type: [
    "p_space",
    "p_id",
    "p_key",
    "p_name",
    "p_description",
    "p_fields",
  ],
  save_entry: [
    "p_space",
    "p_type",
    "p_id",
    "p_shared",
    "p_translations",
    "p_version",
  ],
  publish_entry: ["p_space", "p_id", "p_locale", "p_version"],
  unpublish_entry: ["p_space", "p_id", "p_locale"],
  delete_entry: ["p_space", "p_id"],
  register_asset: [
    "p_space",
    "p_id",
    "p_name",
    "p_mime",
    "p_size",
    "p_storage_url",
  ],
  update_asset: ["p_space", "p_id", "p_name", "p_alt", "p_description"],
  delete_asset: ["p_space", "p_id"],
  create_read_key: ["p_space", "p_name", "p_prefix", "p_hash"],
  revoke_read_key: ["p_space", "p_id"],
};
export function cmsDb(userId: string) {
  return {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      try {
        const keys = procedures[name];
        if (!keys || Object.keys(args).some((k) => !keys.includes(k)))
          throw new Error("Operación no permitida");
        const params = keys.filter((k) => k in args),
          values = params.map((k) =>
            typeof args[k] === "object" && args[k] !== null
              ? JSON.stringify(args[k])
              : args[k],
          );
        const call = `public.${name}(${params.map((k, i) => `${k} => $${i + 1}`).join(",")})`;
        const rows = await userQuery(
          userId,
          name === "list_members"
            ? `select * from ${call}`
            : name === "save_entry"
              ? `select to_jsonb(r) as result from ${call} r`
              : `select ${call} as result`,
          values,
        );
        return {
          data: name === "list_members" ? rows : rows[0]?.result,
          error: null,
        };
      } catch (e) {
        return {
          data: null,
          error: e instanceof Error ? e : new Error("Error de base de datos"),
        };
      }
    },
  };
}
