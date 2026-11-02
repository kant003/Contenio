import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool, userQuery } from "../src/lib/database";
import { getContentPage } from "../src/lib/content-listing";
import {
  CONTENT_PAGE_SIZE,
  contentStatuses,
  parseContentFilters,
} from "../src/lib/content-filters";
import { statusOf, titleOf } from "../src/lib/utils";
import type { ContentType, Entry, Publication } from "../src/lib/types";
import { rpc, cleanSpaces } from "./helpers";
process.loadEnvFile(".env.local");
process.loadEnvFile(".env.test.local");
assert(
  ["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ),
  "Solo base local",
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
  for (const name of ["Listado", "Otro cliente"])
    spaces.push(
      await rpc(admin, "create_space", {
        p_name: name,
        p_slug: `listado-${randomUUID()}`,
      }),
    );
  const [space, other] = spaces;
  await rpc(admin, "set_member", {
    p_space: space,
    p_email: process.env.EDITOR_EMAIL,
  });
  const types = await userQuery<ContentType>(
    admin,
    "select * from content_types where space_id=any($1::uuid[])",
    [spaces],
  );
  const model = types.find((t) => t.space_id === space)!,
    otherModel = types.find((t) => t.space_id === other)!;
  const save = async (s: string, type: string, title: string, gl = title) =>
    rpc(admin, "save_entry", {
      p_space: s,
      p_type: type,
      p_id: null,
      p_version: 0,
      p_shared: {},
      p_translations: {
        es: {
          title,
          slug: randomUUID(),
          body: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "CUERPO_NO_INCLUIDO_EN_LISTADO_" + "x".repeat(5000),
                  },
                ],
              },
            ],
          },
        },
        gl: {
          title: gl,
          slug: randomUUID(),
          body: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Contido" }],
              },
            ],
          },
        },
      },
    });
  for (let i = 1; i <= 26; i++) {
    const entry = await save(
      space,
      model.id,
      i === 26 ? "Oferta 50%_a" : `Artículo ${String(i).padStart(2, "0")}`,
      `Artigo ${String(i).padStart(2, "0")}`,
    );
    if (i <= 18)
      await rpc(admin, "publish_entry", {
        p_space: space,
        p_id: entry.id,
        p_locale: "es",
        p_version: entry.version,
      });
    if (i <= 6)
      await rpc(admin, "publish_entry", {
        p_space: space,
        p_id: entry.id,
        p_locale: "gl",
        p_version: entry.version,
      });
    if (i <= 6)
      await rpc(admin, "save_entry", {
        p_space: space,
        p_type: model.id,
        p_id: entry.id,
        p_version: entry.version,
        p_shared: entry.shared,
        p_translations: {
          ...entry.translations,
          es: {
            ...entry.translations.es,
            title: `Artículo ${String(i).padStart(2, "0")} editado`,
          },
        },
      });
  }
  await save(other, otherModel.id, "Secreto de otro cliente");
  const sharedType = await rpc(admin, "save_content_type", {
    p_space: space,
    p_id: null,
    p_key: "shared",
    p_name: "Ficha",
    p_description: "",
    p_fields: [
      {
        key: "name",
        name: "Nombre",
        type: "short_text",
        localized: false,
        active: true,
        required: true,
        help: "",
      },
    ],
  });
  for (let i = 0; i < 3; i++)
    await rpc(admin, "save_entry", {
      p_space: space,
      p_type: sharedType,
      p_id: null,
      p_version: 0,
      p_shared: { name: "Ficha compartida" },
      p_translations: { es: {}, gl: {} },
    });
  const read = (
    params: Record<string, string> = {},
    user = editor,
    s = space,
  ) => getContentPage(user, s, parseContentFilters(params));
  const first = await read({ sort: "name" });
  check(
    first.total === 29 && first.items.length === CONTENT_PAGE_SIZE,
    "Página limitada y total real",
  );
  check(
    first.stats.total === 29 &&
      first.stats.published === 18 &&
      first.stats.drafts === 11,
    "Contadores del espacio completo",
  );
  const second = await read({ sort: "name", page: "2" }),
    third = await read({ sort: "name", page: "3" });
  const ids = [...first.items, ...second.items, ...third.items].map(
    (e) => e.id,
  );
  check(
    ids.length === 29 && new Set(ids).size === 29,
    "Sin duplicados ni pérdidas entre páginas",
  );
  check(
    (await read({ page: "999999" })).page === 3,
    "Acota páginas fuera de rango",
  );
  check(
    (await read({ status: "changed" })).total === 6,
    "Cambios pendientes en ES",
  );
  check(
    (await read({ status: "published" })).total === 12,
    "Publicados sin cambios en ES",
  );
  check((await read({ status: "draft" })).total === 11, "Borradores en ES");
  check(
    (await read({ locale: "gl", status: "published" })).total === 6,
    "Publicaciones independientes en GL",
  );
  check(
    (await read({ locale: "gl", status: "changed" })).total === 0,
    "Editar ES no altera estado GL",
  );
  check(
    (await read({ q: "ARTIGO 17", locale: "gl" })).total === 1,
    "Busca en idioma seleccionado sin distinguir mayúsculas",
  );
  check(
    (await read({ q: "Artigo 17", locale: "es" })).total === 0,
    "No sustituye títulos por otro idioma",
  );
  check(
    (await read({ q: "%_a" })).total === 1,
    "Porcentaje y guion bajo se buscan literalmente",
  );
  check(
    (await read({ q: "' OR true --" })).total === 0,
    "Consulta parametrizada",
  );
  check(
    (await read({ q: "Ficha", type: sharedType, locale: "gl" })).total === 3,
    "Título compartido y filtro por modelo",
  );
  const slug = first.items[0].slug;
  check((await read({ q: slug })).total === 1, "Búsqueda por slug");
  const empty = await read({ q: "inexistente", page: "999" });
  check(
    empty.total === 0 &&
      empty.page === 1 &&
      empty.items.length === 0 &&
      empty.stats.total === 29,
    "Vacío conserva estadísticas globales",
  );
  check(
    (await read({ type: otherModel.id })).total === 0,
    "Modelo de otro cliente no entrega contenido",
  );
  check(
    (await read({}, editor, other)).stats.total === 0,
    "RLS incluso con identificador de espacio manipulado",
  );
  check(
    (await read({}, "", space)).total === 0,
    "Sin identidad no hay resultados",
  );
  check(
    !JSON.stringify(first).includes("CUERPO_NO_INCLUIDO") &&
      !first.items.some((e) => "translations" in e || "fields" in e),
    "Solo resúmenes, sin cuerpos ni snapshots",
  );
  const entries = await userQuery<Entry>(
    editor,
    "select * from entries where space_id=$1",
    [space],
  );
  const models = await userQuery<ContentType>(
    editor,
    "select * from content_types where space_id=$1",
    [space],
  );
  const pubs = await userQuery<Publication>(
    editor,
    "select * from current_publications where space_id=$1",
    [space],
  );
  for (const locale of ["es", "gl"] as const) {
    for (let page = 1; page <= 3; page++) {
      const result = await read({ locale, page: String(page) });
      assert(
        result.items.every((item) => {
          const entry = entries.find((e) => e.id === item.id)!,
            type = models.find((t) => t.id === entry.content_type_id)!;
          return (
            item.title === titleOf(entry, type, locale) &&
            contentStatuses[item.status] === statusOf(entry, type, pubs, locale)
          );
        }),
        "Estados y títulos coinciden con el editor",
      );
    }
    checks++;
  }
  console.log(
    `Listado PostgreSQL: ${checks} comprobaciones superadas de paginación, filtros, idiomas y aislamiento.`,
  );
} finally {
  await cleanSpaces(spaces);
  await pool().end();
}
