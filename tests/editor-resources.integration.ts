import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/lib/database";
import {
  getLinkedResources,
  getResourcePage,
} from "../src/lib/editor-resources";
import { pickerQuerySchema } from "../src/lib/picker-types";
import { rpc, cleanSpaces } from "./helpers";
process.loadEnvFile(".env.local");
process.loadEnvFile(".env.test.local");
assert(
  ["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ),
);
const admin = process.env.ADMIN_ID!,
  editor = process.env.EDITOR_ID!;
const spaces: string[] = [];
let checks = 0;
const check = (ok: unknown, message: string) => {
  assert(ok, message);
  checks++;
};
try {
  for (const name of ["Recursos", "Privado"])
    spaces.push(
      await rpc(admin, "create_space", {
        p_name: name,
        p_slug: `recursos-${randomUUID()}`,
      }),
    );
  const [space, other] = spaces;
  await rpc(admin, "set_member", {
    p_space: space,
    p_email: process.env.EDITOR_EMAIL,
  });
  const { rows: types } = await pool().query(
    "select * from content_types where space_id=any($1::uuid[])",
    [spaces],
  );
  const type = types.find((t) => t.space_id === space),
    foreignType = types.find((t) => t.space_id === other);
  const body = (text: string) => ({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  const entries: string[] = [];
  for (let i = 1; i <= 26; i++) {
    const entry = await rpc(admin, "save_entry", {
      p_space: space,
      p_type: type.id,
      p_id: null,
      p_version: 0,
      p_shared: {},
      p_translations: {
        es: {
          title: `Entrada ${String(i).padStart(2, "0")}`,
          slug: `entrada-${i}`,
          body: body("CUERPO_AJENO_QUE_NO_SE_CARGA"),
        },
        gl: {
          title: `Entrada galega ${String(i).padStart(2, "0")}`,
          slug: `entrada-gl-${i}`,
        },
      },
    });
    entries.push(entry.id);
  }
  const assets: string[] = [];
  for (let i = 0; i < 14; i++) {
    const id = randomUUID();
    assets.push(id);
    await rpc(admin, "register_asset", {
      p_space: space,
      p_id: id,
      p_name: `Recurso ${i}`,
      p_mime: i === 0 ? "application/pdf" : "image/png",
      p_size: 100,
    });
  }
  const fields = [
    ...type.fields,
    ...[
      { key: "related", name: "Relacionadas", type: "references" },
      { key: "cover", name: "Portada", type: "asset" },
    ].map((f) => ({
      ...f,
      localized: false,
      required: false,
      active: true,
      help: "",
    })),
  ];
  await rpc(admin, "save_content_type", {
    p_space: space,
    p_id: type.id,
    p_key: type.key,
    p_name: type.name,
    p_description: type.description,
    p_fields: fields,
  });
  const main = await rpc(admin, "save_entry", {
    p_space: space,
    p_type: type.id,
    p_id: null,
    p_version: 0,
    p_shared: { related: [entries[0], entries[25]], cover: assets[0] },
    p_translations: {
      es: {
        title: "Principal",
        slug: "principal",
        body: {
          type: "doc",
          content: [{ type: "image", attrs: { assetId: assets[1] } }],
        },
      },
      gl: {
        title: "Principal galega",
        body: {
          type: "doc",
          content: [{ type: "image", attrs: { assetId: assets[2] } }],
        },
      },
    },
  });
  const foreignAsset = randomUUID();
  await rpc(admin, "register_asset", {
    p_space: other,
    p_id: foreignAsset,
    p_name: "Imagen privada",
    p_mime: "image/png",
    p_size: 100,
  });
  const foreign = await rpc(admin, "save_entry", {
    p_space: other,
    p_type: foreignType.id,
    p_id: null,
    p_version: 0,
    p_shared: {},
    p_translations: {
      es: {
        title: "Secreto",
        slug: "secreto",
        body: {
          type: "doc",
          content: [{ type: "image", attrs: { assetId: foreignAsset } }],
        },
      },
      gl: {},
    },
  });
  const read = (query: Record<string, unknown>, user = editor, s = space) =>
    getResourcePage(user, s, pickerQuerySchema.parse(query));
  const first = await read({ kind: "entry", exclude: main.id }),
    second = await read({ kind: "entry", exclude: main.id, page: 2 }),
    third = await read({ kind: "entry", exclude: main.id, page: 3 });
  check(
    first.total === 26 && first.items.length === 12,
    "Página limitada y exclusión de la entrada actual",
  );
  check(
    new Set(
      [...first.items, ...second.items, ...third.items].map((item) => item.id),
    ).size === 26,
    "No pierde recursos entre páginas",
  );
  check(
    !JSON.stringify(first).includes("CUERPO_AJENO") &&
      !first.items.some((item) => "fields" in item || "translations" in item),
    "Resúmenes sin cuerpos de otras entradas",
  );
  const gl = await read({ kind: "entry", q: "galega 26", locale: "gl" });
  check(
    gl.items.length === 1 &&
      gl.items[0].titles?.es === "Entrada 26" &&
      gl.items[0].label === "Entrada galega 26",
    "Títulos de ambos idiomas sin cargar el contenido",
  );
  check(
    !(await read({ kind: "entry", q: "galega 26", locale: "es" })).total,
    "Sin fallback entre idiomas",
  );
  const image = await read({ kind: "image" }),
    all = await read({ kind: "asset" });
  check(
    image.total === 13 &&
      image.items.every((item) => item.asset?.mime.startsWith("image/")),
    "Selector de imágenes excluye PDF",
  );
  check(
    all.total === 14 &&
      all.items.some((item) => item.asset?.mime === "application/pdf"),
    "Campos de archivo admiten PDF",
  );
  check(
    all.items.every(
      (item) =>
        item.asset?.url?.includes("signature=") &&
        !("storage_url" in item.asset),
    ),
    "Enlaces privados firmados sin direcciones internas de Blob",
  );
  const linked = await getLinkedResources(editor, space, main.id);
  check(
    linked.assets.length === 3 &&
      linked.assets.every((asset) => assets.slice(0, 3).includes(asset.id)),
    "Solo carga archivos utilizados, incluidos los dos idiomas",
  );
  check(
    linked.entryChoices.length === 2 &&
      linked.entryChoices.some((item) => item.id === entries[25]),
    "Recupera etiquetas de selecciones fuera de la primera página",
  );
  check(
    !JSON.stringify(linked).includes("CUERPO_AJENO"),
    "Las referencias iniciales tampoco incluyen cuerpos",
  );
  check(
    (await getLinkedResources(editor, space)).assets.length === 0,
    "Entradas nuevas empiezan sin biblioteca completa",
  );
  check(
    !(await read({ kind: "entry" }, editor, other)).total,
    "RLS oculta resultados de otro cliente",
  );
  check(
    !(await getLinkedResources(editor, other, foreign.id)).assets.length,
    "Recursos iniciales respetan RLS",
  );
  check(
    (await getLinkedResources(admin, other, foreign.id)).assets.length === 1,
    "Comprueba el aislamiento con un archivo vinculado real en la base",
  );
  check(
    !(await read({ kind: "asset" }, "", space)).total,
    "Sin identidad no hay archivos",
  );
  check(
    (await read({ kind: "entry" }, admin, other)).total === 1,
    "Administrador sigue limitado al espacio solicitado",
  );
  check(
    (await read({ kind: "entry", exclude: main.id, page: 999999 })).page === 3,
    "Página fuera de rango resuelta",
  );
  console.log(
    `Selectores PostgreSQL: ${checks} comprobaciones superadas de recursos vinculados, búsquedas e aislamiento.`,
  );
} finally {
  await cleanSpaces(spaces);
  await pool().end();
}
