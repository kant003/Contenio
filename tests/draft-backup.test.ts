import { expect, it } from "vitest";
import { serializeDraftBackup } from "../src/lib/draft-backup";
import type { ContentType, Entry } from "../src/lib/types";
const type = {
  id: "model",
  key: "page",
  name: "Página",
  fields: [{ key: "title", active: true }],
  secret: "not-exported",
} as unknown as ContentType;
const draft = {
  shared: { enabled: false, amount: 0, legacy: "Conservar" },
  translations: {
    es: {
      title: "España",
      body: {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: "image-id" } }],
      },
    },
    gl: { title: "Galicia" },
  },
  session: "private-session",
  assets: [{ url: "signed-url" }],
} as unknown as Entry;
it("conserva ambos idiomas, campos compartidos y la versión base sin exportar la sesión", () => {
  const copy = JSON.parse(
    serializeDraftBackup(
      { spaceId: "space", entryId: "entry", baseVersion: 3, type, draft },
      "2026-11-08T12:00:00.000Z",
    ),
  );
  expect(copy).toMatchObject({
    format: "contenio.draft",
    formatVersion: 1,
    baseVersion: 3,
    spaceId: "space",
    entryId: "entry",
    exportedAt: "2026-11-08T12:00:00.000Z",
  });
  expect(copy.shared).toEqual(draft.shared);
  expect(copy.translations).toEqual(draft.translations);
  expect(copy.contentType.fields).toEqual(type.fields);
  expect(JSON.stringify(copy)).not.toMatch(
    /private-session|signed-url|not-exported/,
  );
});
it("admite entradas nuevas y conserva la copia cuando se sigue editando", () => {
  const copy = JSON.parse(
    serializeDraftBackup({ spaceId: "space", baseVersion: 0, type, draft }),
  );
  expect(copy.entryId).toBeNull();
  copy.translations.es.title = "Texto modificado en la copia";
  expect(draft.translations.es.title).toBe("España");
});
