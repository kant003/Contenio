import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";
import { getAuth } from "../src/lib/auth";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  max: 1,
});
const client = await pool.connect();
try {
  await client.query("select pg_advisory_lock(73602841)");
  const authMigration = await getMigrations(getAuth().options);
  await authMigration.runMigrations();
  await client.query(
    "create table if not exists _migrations(name text primary key,checksum text not null,applied_at timestamptz not null default now())",
  );
  for (const name of (await readdir("db/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(`db/migrations/${name}`, "utf8"),
      checksum = createHash("sha256").update(sql).digest("hex");
    const { rows } = await client.query(
      "select checksum from _migrations where name=$1",
      [name],
    );
    if (rows.length) {
      if (rows[0].checksum !== checksum)
        throw new Error(`La migración ${name} ya aplicada ha cambiado`);
      continue;
    }
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into _migrations(name,checksum) values($1,$2)",
        [name, checksum],
      );
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
    console.log(`Migración aplicada: ${name}`);
  }
} finally {
  await client.query("select pg_advisory_unlock(73602841)");
  client.release();
  await pool.end();
}
const { pool: applicationPool } = await import("../src/lib/database");
await applicationPool().end();
