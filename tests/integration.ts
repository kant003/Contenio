import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { pool, cmsDb, userQuery, asUser } from "../src/lib/database";
import { storeAsset, validAssetToken } from "../src/lib/storage";
import { rpc, cleanSpaces } from "./helpers";
process.loadEnvFile(".env.local");
process.loadEnvFile(".env.test.local");
assert(
  ["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ),
);
const admin = process.env.ADMIN_ID!,
  editor = process.env.EDITOR_ID!,
  other = process.env.OTHER_ID!,
  spaces: string[] = [];
let checks = 0;
function check(value: unknown, message: string) {
  assert(value, message);
  checks++;
}
async function fails(
  user: string,
  name: string,
  args: Record<string, unknown>,
) {
  return Boolean((await cmsDb(user).rpc(name, args)).error);
}
const body = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
try {
  for (const name of ["a", "b"])
    spaces.push(
      await rpc(admin, "create_space", {
        p_name: `Test ${name}`,
        p_slug: `test-${name}-${randomUUID().slice(0, 8)}`,
      }),
    );
  const [a, b] = spaces;
  await rpc(admin, "set_member", {
    p_space: a,
    p_email: process.env.EDITOR_EMAIL,
  });
  await rpc(admin, "set_member", {
    p_space: b,
    p_email: process.env.OTHER_EMAIL,
  });
  const { rows: types } = await pool().query(
    "select * from content_types where space_id=any($1::uuid[])",
    [spaces],
  );
  const ta = types.find((t) => t.space_id === a),
    tb = types.find((t) => t.space_id === b);
  check(
    (await userQuery(editor, "select id from spaces where id=$1", [b]))
      .length === 0,
    "RLS oculta otro cliente",
  );
  check(
    (await userQuery("", "select id from entries")).length === 0,
    "Sin sesión no hay lectura",
  );
  await assert.rejects(() =>
    userQuery(
      editor,
      "insert into spaces(name,slug)values('No','no-autorizado')",
    ),
  );
  checks++;
  check(
    await fails(editor, "create_space", {
      p_name: "No",
      p_slug: "no-autorizado",
    }),
    "Editor no crea espacios",
  );
  check(
    await fails(editor, "set_member", {
      p_space: a,
      p_email: process.env.OTHER_EMAIL,
    }),
    "Editor no cambia permisos",
  );
  const args = {
    p_space: a,
    p_type: ta.id,
    p_id: null,
    p_version: 0,
    p_shared: {},
    p_translations: {
      es: { title: "Original", slug: "original", body: body("Texto español") },
      gl: { title: "Orixinal", slug: "orixinal", body: body("Texto galego") },
    },
  };
  check(
    await fails(editor, "save_entry", { ...args, p_space: b, p_type: tb.id }),
    "No guardar en otro cliente",
  );
  check(
    await fails(editor, "save_entry", { ...args, p_type: tb.id }),
    "Modelo no cruza clientes",
  );
  check(
    await fails(editor, "save_entry", { ...args, p_shared: { unknown: "x" } }),
    "Campos desconocidos rechazados",
  );
  check(
    await fails(editor, "save_entry", {
      ...args,
      p_translations: { es: { title: 123 }, gl: {} },
    }),
    "Tipos validados en PostgreSQL",
  );
  const entry = await rpc(editor, "save_entry", args),
    draft = await rpc(editor, "save_entry", {
      ...args,
      p_translations: { es: { title: "" }, gl: {} },
    });
  check(
    (await userQuery(other, "select * from entries where id=$1", [entry.id]))
      .length === 0,
    "RLS oculta entradas",
  );
  check(
    (
      await userQuery(editor, "select translations from entries where id=$1", [
        entry.id,
      ])
    )[0].translations.gl.title === "Orixinal",
    "Traducciones persistidas",
  );
  check(
    await fails(editor, "publish_entry", {
      p_space: a,
      p_id: draft.id,
      p_locale: "es",
      p_version: 1,
    }),
    "Validación de obligatorios",
  );
  check(
    await fails(editor, "publish_entry", {
      p_space: a,
      p_id: entry.id,
      p_locale: "es",
      p_version: null,
    }),
    "Versión obligatoria",
  );
  await rpc(editor, "publish_entry", {
    p_space: a,
    p_id: entry.id,
    p_locale: "es",
    p_version: 1,
  });
  const token = `ct_${randomBytes(32).toString("hex")}`;
  await rpc(admin, "create_read_key", {
    p_space: a,
    p_name: "Test",
    p_prefix: token.slice(0, 11),
    p_hash: createHash("sha256").update(token).digest("hex"),
  });
  await assert.rejects(() =>
    userQuery(editor, "select key_hash from api_keys"),
  );
  checks++;
  check(
    await fails(editor, "create_read_key", {
      p_space: a,
      p_name: "No",
      p_prefix: "no",
      p_hash: "a".repeat(64),
    }),
    "Editor no crea claves",
  );
  const base = `http://localhost:3100/api/v1/spaces/${a}`,
    get = (path: string, key = token) =>
      fetch(base + path, { headers: { Authorization: `Bearer ${key}` } });
  check((await fetch(base + "/entries")).status === 401, "API requiere clave");
  check(
    (
      await fetch(`http://localhost:3100/api/v1/spaces/${b}/entries`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status === 401,
    "Clave aislada por espacio",
  );
  check(
    (await get(`/entries/${entry.id}?locale=gl`)).status === 404,
    "Sin fallback de idioma",
  );
  for (const q of ["locale=fr", "limit=0", "offset=-1", "limit=101"])
    check((await get(`/entries?${q}`)).status === 400, `Validación ${q}`);
  const list = await get("/entries?type=page&slug=original&locale=es&limit=1"),
    data = await list.json();
  check(data.total === 1 && data.items.length === 1, "API filtra y pagina");
  check(
    list.headers.get("cache-control")?.includes("no-store"),
    "Sin caché privada",
  );
  const changed = await rpc(editor, "save_entry", {
    ...args,
    p_id: entry.id,
    p_version: 1,
    p_translations: {
      ...args.p_translations,
      es: { ...args.p_translations.es, title: "Pendiente" },
    },
  });
  check(
    (await (await get(`/entries/${entry.id}`)).json()).fields.title ===
      "Original",
    "El borrador no cambia lo publicado",
  );
  check(
    await fails(editor, "save_entry", {
      ...args,
      p_id: entry.id,
      p_version: 1,
    }),
    "Conflicto detectado",
  );
  await rpc(editor, "publish_entry", {
    p_space: a,
    p_id: entry.id,
    p_locale: "gl",
    p_version: changed.version,
  });
  check(
    (await (await get(`/entries/${entry.id}?locale=gl`)).json()).fields
      .title === "Orixinal",
    "Publicación independiente GL",
  );
  const asset = randomUUID(),
    bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
      "base64",
    ),
    storage = await storeAsset(a, asset, bytes, "image/png");
  await rpc(editor, "register_asset", {
    p_space: a,
    p_id: asset,
    p_name: "test.png",
    p_mime: "image/png",
    p_size: bytes.length,
    p_storage_url: storage,
  });
  check(
    (await userQuery(other, "select * from assets where id=$1", [asset]))
      .length === 0,
    "RLS de archivos",
  );
  check(
    (await get(`/assets/${asset}`)).status === 404,
    "No entrega archivo sin publicar",
  );
  const fields = [
    ...ta.fields,
    {
      key: "image",
      name: "Imagen",
      type: "asset",
      localized: false,
      required: false,
      active: true,
      help: "",
    },
    {
      key: "related",
      name: "Relaciones",
      type: "references",
      localized: false,
      required: false,
      active: true,
      help: "",
    },
  ];
  await rpc(admin, "save_content_type", {
    p_space: a,
    p_id: ta.id,
    p_key: "page",
    p_name: "Página",
    p_description: "",
    p_fields: fields,
  });
  const targetB = await rpc(other, "save_entry", {
    ...args,
    p_space: b,
    p_type: tb.id,
  });
  check(
    await fails(editor, "save_entry", {
      ...args,
      p_shared: { related: [targetB.id] },
    }),
    "Referencias aisladas",
  );
  const withAsset = await rpc(editor, "save_entry", {
    ...args,
    p_id: entry.id,
    p_version: changed.version,
    p_shared: { image: asset },
  });
  await rpc(editor, "publish_entry", {
    p_space: a,
    p_id: entry.id,
    p_locale: "es",
    p_version: withAsset.version,
  });
  const signed = await (await get(`/assets/${asset}`)).json();
  check(signed.expiresIn === 900, "URL temporal de 15 minutos");
  check(
    (await fetch(signed.url)).status === 200,
    "URL firmada permite lectura",
  );
  check(
    (await fetch(signed.url.replace(/signature=./, "signature=z"))).status ===
      404,
    "Firma alterada rechazada",
  );
  check(
    !validAssetToken(a, asset, "1000000000", "a".repeat(64)),
    "Firma caducada rechazada",
  );
  check(
    await fails(editor, "delete_asset", { p_space: a, p_id: asset }),
    "Protege archivos utilizados",
  );
  check(
    await fails(admin, "save_content_type", {
      p_space: a,
      p_id: ta.id,
      p_key: "page",
      p_name: "Página",
      p_description: "",
      p_fields: fields.filter((f) => f.key !== "title"),
    }),
    "Conserva campos utilizados",
  );
  await rpc(editor, "unpublish_entry", {
    p_space: a,
    p_id: entry.id,
    p_locale: "es",
  });
  check(
    (await get(`/entries/${entry.id}`)).status === 404,
    "Retirada de publicación",
  );
  check(
    (await get(`/assets/${asset}`)).status === 404,
    "Oculta archivo al retirar publicación",
  );
  const { rows: keys } = await pool().query(
    "select id from api_keys where space_id=$1",
    [a],
  );
  await rpc(admin, "revoke_read_key", { p_space: a, p_id: keys[0].id });
  check((await get("/entries")).status === 401, "Revocación inmediata");
  const registration = await fetch(
    "http://localhost:3100/api/auth/sign-up/email",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3100",
      },
      body: JSON.stringify({
        name: "No",
        email: `closed-${randomUUID()}@contenio.local`,
        password: randomBytes(24).toString("base64url"),
      }),
    },
  );
  check(!registration.ok, "Registro público cerrado");
  check(
    (await asUser(
      editor,
      async (c) =>
        (await c.query("select public.current_user_id() id")).rows[0].id,
    )) === editor,
    "Contexto de sesión en transacción",
  );
  console.log(
    `PostgreSQL/Neon: ${checks} comprobaciones superadas de RLS, publicación, archivos firmados y API.`,
  );
} finally {
  await cleanSpaces(spaces);
  await pool().end();
}
