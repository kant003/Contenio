import { activeValues, sameValues } from "./utils";
import type { ContentType, Entry, Locale, Publication } from "./types";

export type PreviewSource = "draft" | "published";

/** Published fields are the exact snapshot, even if the model has since changed. */
export function entryPreview(
  entry: Entry,
  type: ContentType,
  publications: Publication[],
  locale: Locale,
  source: PreviewSource,
) {
  const publication = publications.find(
    (p) => p.entry_id === entry.id && p.locale === locale,
  );
  const draft = activeValues(entry, type, locale);
  const fields = source === "published" ? (publication?.fields ?? null) : draft;
  const keys =
    source === "published"
      ? [
          ...new Set([
            ...type.fields
              .filter((f) => Object.hasOwn(fields ?? {}, f.key))
              .map((f) => f.key),
            ...Object.keys(fields ?? {}),
          ]),
        ]
      : type.fields.filter((f) => f.active).map((f) => f.key);
  const definitions = keys.map(
    (key) =>
      type.fields.find((f) => f.key === key) ?? {
        key,
        name: key,
        type: "long_text" as const,
        active: false,
      },
  );
  const changed = publication
    ? [...new Set([...Object.keys(draft), ...Object.keys(publication.fields)])]
        .filter((key) => !sameValues(draft[key], publication.fields[key]))
        .map((key) => ({
          key,
          name: type.fields.find((f) => f.key === key)?.name ?? key,
        }))
    : [];
  return { fields, definitions, publication, changed };
}
