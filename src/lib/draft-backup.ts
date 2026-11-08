import type { ContentType, Entry } from "./types";

/** Local copies include content and model fields, without session or resource metadata. */
export function serializeDraftBackup(
  {
    spaceId,
    entryId,
    baseVersion,
    type,
    draft,
  }: {
    spaceId: string;
    entryId?: string;
    baseVersion: number;
    type: ContentType;
    draft: Pick<Entry, "shared" | "translations">;
  },
  exportedAt = new Date().toISOString(),
) {
  return JSON.stringify(
    {
      format: "contenio.draft",
      formatVersion: 1,
      exportedAt,
      spaceId,
      entryId: entryId ?? null,
      baseVersion,
      contentType: {
        id: type.id,
        key: type.key,
        name: type.name,
        fields: type.fields,
      },
      shared: draft.shared,
      translations: draft.translations,
    },
    null,
    2,
  );
}
