import { describe, expect, it } from "vitest";
import { entryPreview } from "../src/lib/entry-preview";
import type { ContentType, Entry, Publication } from "../src/lib/types";
const type = {
  fields: [
    {
      key: "title",
      name: "Título",
      type: "short_text",
      localized: true,
      active: true,
    },
    {
      key: "count",
      name: "Cantidad",
      type: "number",
      localized: false,
      active: true,
    },
    {
      key: "visible",
      name: "Visible",
      type: "boolean",
      localized: false,
      active: true,
    },
    {
      key: "legacy",
      name: "Anterior",
      type: "long_text",
      localized: false,
      active: false,
    },
  ],
} as ContentType;
const entry = {
  id: "entry",
  shared: { count: 0, visible: false, legacy: "Conservado" },
  translations: { es: { title: "Borrador" }, gl: { title: "Galego" } },
} as unknown as Entry;
const publication = {
  id: "publication",
  type_key: "page",
  slug: "publicado",
  published_at: "2026-11-03T08:00:00.000Z",
  entry_id: "entry",
  locale: "es",
  fields: { title: "Publicado", count: 5, visible: true, legacy: "Histórico" },
} as Publication;
describe("vista previa de borradores y publicaciones", () => {
  it("conserva exactamente el snapshot, incluidos campos desactivados", () => {
    const before = JSON.stringify(publication);
    const result = entryPreview(entry, type, [publication], "es", "published");
    expect(result.fields).toBe(publication.fields);
    expect(result.definitions.find((f) => f.key === "legacy")?.active).toBe(
      false,
    );
    expect(JSON.stringify(publication)).toBe(before);
  });
  it("usa el borrador actual y sus campos activos sin mezclar otro idioma", () => {
    const result = entryPreview(entry, type, [publication], "gl", "draft");
    expect(result.fields).toEqual({
      title: "Galego",
      count: 0,
      visible: false,
    });
    expect(result.definitions.map((f) => f.key)).not.toContain("legacy");
    expect(entry.shared.legacy).toBe("Conservado");
  });
  it("no sustituye una publicación ausente por otro idioma ni otra entrada", () => {
    expect(
      entryPreview(entry, type, [publication], "gl", "published").fields,
    ).toBeNull();
    expect(
      entryPreview(
        entry,
        type,
        [{ ...publication, entry_id: "other" }],
        "es",
        "published",
      ).fields,
    ).toBeNull();
    expect(entryPreview(entry, type, [], "es", "published").changed).toEqual(
      [],
    );
  });
  it("detecta cambios, adiciones y retiradas sin depender del orden de claves", () => {
    const current = {
      ...entry,
      shared: { ...entry.shared, missing: null },
      translations: { ...entry.translations, es: { title: "Publicado" } },
    };
    const result = entryPreview(current, type, [publication], "es", "draft");
    expect(result.changed.map((f) => f.key)).toEqual([
      "count",
      "visible",
      "legacy",
    ]);
    const equivalent = {
      ...publication,
      fields: { visible: false, title: "Publicado", count: 0 },
    };
    expect(
      entryPreview(current, type, [equivalent], "es", "published").changed,
    ).toEqual([]);
    const missing = {
      ...equivalent,
      fields: { ...equivalent.fields, extra: null },
    };
    const preview = entryPreview(current, type, [missing], "es", "published");
    expect(preview.changed).toEqual([{ key: "extra", name: "extra" }]);
    expect(preview.definitions.find((f) => f.key === "extra")?.name).toBe(
      "extra",
    );
  });
});
