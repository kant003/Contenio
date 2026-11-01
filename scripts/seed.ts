import { existsSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { pool, cmsDb } from "../src/lib/database";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
if (
  !process.env.DATABASE_URL ||
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error("Seed permitido únicamente en PostgreSQL local");
const db = pool(),
  fixture: Record<string, string> = {};
try {
  for (const [prefix, email] of [
    ["ADMIN", "admin@contenio.local"],
    ["EDITOR", "editor@contenio.local"],
    ["OTHER", "otro@contenio.local"],
  ]) {
    const { rows } = await db.query('select id from "user" where email=$1', [
      email,
    ]);
    const id = rows[0]?.id ?? randomUUID(),
      known = process.env[`${prefix}_PASSWORD`],
      password = known ?? randomBytes(24).toString("base64url");
    const client = await db.connect();
    try {
      await client.query("begin");
      if (!rows.length)
        await client.query(
          'insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,$2,$3,true,now(),now())',
          [id, email.split("@")[0], email],
        );
      if (!rows.length || !known) {
        const hash = await hashPassword(password);
        const updated = await client.query(
          'update account set password=$1,"updatedAt"=now() where "userId"=$2 and "providerId"=\'credential\'',
          [hash, id],
        );
        if (!updated.rowCount)
          await client.query(
            'insert into account(id,"accountId","providerId","userId",password,"createdAt","updatedAt") values($1,$2,\'credential\',$2,$3,now(),now())',
            [randomUUID(), id, hash],
          );
      }
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
    fixture[`${prefix}_EMAIL`] = email;
    fixture[`${prefix}_PASSWORD`] = password;
    fixture[`${prefix}_ID`] = id;
  }
  const save = () =>
    writeFileSync(
      ".env.test.local",
      Object.entries(fixture)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n",
      { mode: 0o600 },
    );
  save();
  await db.query(
    "insert into platform_admins(user_id) values($1) on conflict do nothing",
    [fixture.ADMIN_ID],
  );
  const cms = cmsDb(fixture.ADMIN_ID);
  const call = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await cms.rpc(name, args);
    if (error) throw error;
    return data;
  };
  for (const [label, name, slug, editor] of [
    ["A", "Estudio Norte", "estudio-norte", "EDITOR"],
    ["B", "Casa Botánica", "casa-botanica", "OTHER"],
  ]) {
    const { rows } = await db.query("select id from spaces where slug=$1", [
      slug,
    ]);
    const space =
      rows[0]?.id ??
      (await call("create_space", { p_name: name, p_slug: slug }));
    fixture[`SPACE_${label}`] = space;
    save();
    await call("set_member", {
      p_space: space,
      p_email: fixture[`${editor}_EMAIL`],
    });
    const { rows: models } = await db.query(
      "select id from content_types where space_id=$1 and key='page'",
      [space],
    );
    const type = models[0].id;
    fixture[`TYPE_${label}`] = type;
    save();
    const { rows: count } = await db.query(
      "select count(*)::int n from entries where space_id=$1",
      [space],
    );
    if (count[0].n) continue;
    const titles =
      label === "A"
        ? [
            "Una forma diferente de crear",
            "Sobre nosotros",
            "Nuestro proceso creativo",
            "Preguntas frecuentes",
            "Contacto y colaboraciones",
            "La próxima gran idea",
          ]
        : ["Bienvenido a Casa Botánica"];
    for (const [i, title] of titles.entries()) {
      const slug =
        label === "A"
          ? [
              "inicio",
              "sobre-nosotros",
              "proceso",
              "preguntas-frecuentes",
              "contacto",
              "proxima-idea",
            ][i]
          : "inicio";
      const body = (text: string) => ({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Un espacio para las ideas que merecen ser compartidas. Contenido de demostración propio, listo para editar.",
              },
            ],
          },
        ],
      });
      const entry = await call("save_entry", {
        p_space: space,
        p_type: type,
        p_id: null,
        p_version: 0,
        p_shared: {},
        p_translations: {
          es: {
            title,
            slug,
            body: body("Las buenas ideas encuentran su lugar."),
          },
          gl: {
            title: i === 0 ? "Un xeito diferente de crear" : title,
            slug,
            body: body("As boas ideas atopan o seu lugar."),
          },
        },
      });
      if (i < 3)
        await call("publish_entry", {
          p_space: space,
          p_id: entry.id,
          p_locale: "es",
          p_version: entry.version,
        });
    }
  }
  console.log(
    "Dos clientes, un administrador y dos editores preparados en PostgreSQL local. Credenciales aleatorias en .env.test.local, fuera de Git.",
  );
} finally {
  await db.end();
}
