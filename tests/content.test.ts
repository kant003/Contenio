import { parseContentFilters, contentHref } from "../src/lib/content-filters";
import { describe, it, expect } from "vitest";
import { hasContent } from "../src/lib/content-validation";
import {
  activeValues,
  sameValues,
  safeHref,
  slugify,
  statusOf,
} from "../src/lib/utils";
import type { ContentType, Entry, Publication } from "../src/lib/types";
const model = {
  fields: [
    { key: "title", active: true },
    { key: "legacy", active: false },
  ],
} as ContentType;
const entry = {
  id: "entry",
  shared: { legacy: "old" },
  translations: { es: { title: "Publicado" }, gl: { title: "Galego" } },
} as unknown as Entry;
const pub = {
  entry_id: "entry",
  locale: "es",
  fields: { title: "Publicado" },
} as unknown as Publication;
describe("publicación y traducciones", () => {
  it("distingue borrador, publicado y cambios pendientes por idioma", () => {
    expect(statusOf(entry, model, [pub], "es")).toBe("Publicado");
    expect(statusOf(entry, model, [pub], "gl")).toBe("Borrador");
    expect(
      statusOf(
        {
          ...entry,
          translations: { ...entry.translations, es: { title: "Editado" } },
        },
        model,
        [pub],
        "es",
      ),
    ).toBe("Cambios pendientes");
  });
  it("no entrega campos desactivados ni modifica el snapshot", () => {
    expect(activeValues(entry, model, "es")).toEqual({ title: "Publicado" });
    expect(pub.fields).toEqual({ title: "Publicado" });
  });
  it("compara objetos sin depender del orden de claves y conserva el orden de listas", () => {
    expect(sameValues({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(sameValues([1, 2], [2, 1])).toBe(false);
  });
});
describe("contenido seguro", () => {
  it("distingue valores vacíos de ceros, booleanos e imágenes válidas", () => {
    expect(hasContent(false, "boolean")).toBe(true);
    expect(hasContent(0, "number")).toBe(true);
    expect(hasContent("   ", "short_text")).toBe(false);
    expect(
      hasContent(
        { type: "doc", content: [{ type: "paragraph" }] },
        "rich_text",
      ),
    ).toBe(false);
    expect(
      hasContent(
        {
          type: "doc",
          content: [{ type: "image", attrs: { assetId: "uuid" } }],
        },
        "rich_text",
      ),
    ).toBe(true);
  });
  it("rechaza URLs ejecutables y conserva enlaces web y email", () => {
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("data:text/html,hello")).toBeUndefined();
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("mailto:a@example.com")).toBe("mailto:a@example.com");
  });
  it("normaliza identificadores legibles", () =>
    expect(slugify("  Unha páxina, aquí! ")).toBe("unha-paxina-aqui"));
});

describe("filtros del listado", () => {
  it("normaliza parámetros repetidos o manipulados y limita la búsqueda", () => {
    const filters = parseContentFilters({
      q: " " + "a".repeat(300),
      type: "invalido",
      status: "__proto__",
      locale: ["gl", "es"],
      sort: "sql",
      page: "999999999999999999",
    });
    expect(filters).toMatchObject({
      q: "a".repeat(256),
      type: "",
      status: "",
      locale: "gl",
      sort: "updated",
      page: 1,
    });
  });
  it("conserva filtros al compartir URL y codifica caracteres especiales", () => {
    const filters = parseContentFilters({
      q: "Páxina & 50%",
      locale: "gl",
      status: "changed",
      sort: "name",
      page: "3",
    });
    const url = new URL(contentHref("space", filters), "https://example.com");
    expect(parseContentFilters(Object.fromEntries(url.searchParams))).toEqual(
      filters,
    );
    expect(url.pathname).toBe("/spaces/space/content");
  });
});
