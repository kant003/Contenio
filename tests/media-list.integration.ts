import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/lib/database";
import { getMediaPage } from "../src/lib/media-listing";
import { parseMediaFilters, MEDIA_PAGE_SIZE } from "../src/lib/media-filters";
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
const assets: string[] = [];
let checks = 0;
const check = (ok: unknown, message: string) => {
  assert(ok, message);
  checks++;
};
try {
  for (const name of ["Biblioteca", "Otro cliente"])
    spaces.push(
      await rpc(admin, "create_space", {
        p_name: name,
        p_slug: `media-${randomUUID()}`,
      }),
    );
  const [space, other] = spaces;
  await rpc(admin, "set_member", {
    p_space: space,
    p_email: process.env.EDITOR_EMAIL,
  });
  for (let i = 1; i <= 26; i++) {
    const id = randomUUID();
    assets.push(id);
    await rpc(admin, "register_asset", {
      p_space: space,
      p_id: id,
      p_name:
        i === 26 ? "Oferta 50%_a.pdf" : `Recurso ${String(i).padStart(2, "0")}`,
      p_mime: i % 3 === 0 ? "application/pdf" : "image/png",
      p_size: i * 1024,
    });
  }
  await rpc(admin, "update_asset", {
    p_space: space,
    p_id: assets[0],
    p_name: "Recurso 01",
    p_alt: { es: "Bosque español", gl: "Fraga galega" },
    p_description: {
      es: "Descripción española",
      gl: "Portada galega exclusiva",
    },
  });
  await rpc(admin, "register_asset", {
    p_space: other,
    p_id: randomUUID(),
    p_name: "Secreto de otro cliente",
    p_mime: "image/png",
    p_size: 99999,
  });
  const read = (
    params: Record<string, string> = {},
    user = editor,
    s = space,
  ) => getMediaPage(user, s, parseMediaFilters(params));
  const first = await read({ sort: "name" }),
    second = await read({ sort: "name", page: "2" }),
    third = await read({ sort: "name", page: "3" });
  check(
    first.total === 26 && first.items.length === MEDIA_PAGE_SIZE,
    "Solo una página de metadatos",
  );
  const ids = [...first.items, ...second.items, ...third.items].map(
    (a) => a.id,
  );
  check(
    ids.length === 26 && new Set(ids).size === 26,
    "Páginas sin duplicados ni pérdidas",
  );
  check(
    first.stats.total === 26 &&
      first.stats.images === 18 &&
      first.stats.pdfs === 8,
    "Estadísticas del espacio, no de la página",
  );
  check(
    first.stats.bytes === ((26 * 27) / 2) * 1024,
    "Suma el tamaño de todos los archivos del espacio",
  );
  const image = await read({ kind: "image" }),
    pdf = await read({ kind: "pdf" });
  check(
    image.total === 18 && image.items.every((a) => a.mime.startsWith("image/")),
    "Filtra imágenes por MIME, no por extensión",
  );
  check(
    pdf.total === 8 && pdf.items.every((a) => a.mime === "application/pdf"),
    "Filtro PDF",
  );
  check(
    (await read({ q: "PORTADA GALEGA", locale: "gl" })).total === 1,
    "Busca descripción traducida sin distinguir mayúsculas",
  );
  check(
    (await read({ q: "Portada galega", locale: "es" })).total === 0,
    "No busca en otro idioma automáticamente",
  );
  check(
    (await read({ q: "Fraga", locale: "gl" })).total === 1,
    "Busca texto alternativo traducido",
  );
  check(
    (await read({ q: "Fraga", locale: "es" })).total === 0,
    "Texto alternativo también respeta el idioma",
  );
  check(
    (await read({ q: "%_a" })).total === 1,
    "Busca caracteres de comodín literalmente",
  );
  check(
    (await read({ q: "' OR true --" })).total === 0,
    "Consulta parametrizada",
  );
  const large = await read({ sort: "size" });
  check(
    large.items[0].id === assets[25] &&
      large.items.every((a, i, items) => !i || items[i - 1].size >= a.size),
    "Orden de mayor a menor tamaño",
  );
  const recent = await read();
  check(recent.items[0].id === assets[25], "Orden de creación más reciente");
  const empty = await read({ q: "No existe", page: "999999" });
  check(
    !empty.total &&
      !empty.items.length &&
      empty.page === 1 &&
      empty.stats.total === 26,
    "Búsqueda vacía mantiene estadísticas y página válida",
  );
  check(
    (await read({ page: "999999" })).page === 3,
    "Acota páginas fuera de rango",
  );
  check(
    (await read({}, editor, other)).stats.total === 0,
    "RLS protege resultados y contadores de otro cliente",
  );
  check(
    (await read({}, "", space)).total === 0,
    "Sin identidad no hay archivos",
  );
  check(
    (await read({}, admin, other)).total === 1 && first.total === 26,
    "Incluso el administrador limita la consulta al espacio solicitado",
  );
  check(
    !first.items.some((a) => "storage_url" in a || "url" in a),
    "No devuelve direcciones internas ni firma archivos fuera de página",
  );
  await rpc(admin, "update_asset", {
    p_space: space,
    p_id: assets[0],
    p_name: "Renombrado",
    p_alt: { es: "", gl: "" },
    p_description: { es: "", gl: "" },
  });
  check(
    (await read({ q: "Renombrado" })).total === 1 &&
      (await read({ q: "Portada galega", locale: "gl" })).total === 0,
    "Metadatos guardados se reflejan en búsquedas",
  );
  // Remove the only item on the last page of a filtered result.
  await rpc(admin, "delete_asset", { p_space: space, p_id: assets[25] });
  check(
    (await read({ q: "%_a", page: "2" })).page === 1,
    "Eliminar el último resultado vuelve a una página válida",
  );
  console.log(
    `Biblioteca PostgreSQL: ${checks} comprobaciones superadas de filtros, metadatos, paginación y aislamiento.`,
  );
} finally {
  await cleanSpaces(spaces);
  await pool().end();
}
