import { entryPreview, type PreviewSource } from "@/lib/entry-preview";
import { dateLabel } from "@/lib/utils";
import { itemLabel, type PickerItem } from "@/lib/picker-types";
import type {
  Asset,
  ContentType,
  Entry,
  Locale,
  Publication,
} from "@/lib/types";
import { RichRenderer } from "./rich-renderer";
import { AssetPreview } from "./asset-preview";

export function EntryReadView({
  entry,
  type,
  publications,
  locale,
  source,
  onSource,
  view,
  assets,
  entryChoices,
}: {
  entry: Entry;
  type: ContentType;
  publications: Publication[];
  locale: Locale;
  source: PreviewSource;
  onSource: (source: PreviewSource) => void;
  view: "preview" | "json";
  assets: Asset[];
  entryChoices: PickerItem[];
}) {
  const { fields, definitions, publication, changed } = entryPreview(
    entry,
    type,
    publications,
    locale,
    source,
  );
  return (
    <div className="entry-read-view">
      <div className="preview-controls">
        <div
          className="preview-source"
          role="group"
          aria-label="Versión del contenido"
        >
          <button
            type="button"
            aria-pressed={source === "draft"}
            onClick={() => onSource("draft")}
          >
            Borrador
          </button>
          <button
            type="button"
            aria-pressed={source === "published"}
            onClick={() => onSource("published")}
          >
            Publicado
          </button>
        </div>
        <span className="field-locale">
          {locale === "es" ? "ESPAÑOL" : "GALEGO"}
        </span>
      </div>
      <div className="preview-context" aria-live="polite">
        <p>
          {source === "draft" ? (
            "Incluye los cambios de este editor, aunque todavía no estén guardados."
          ) : publication ? (
            <>
              Campos que entrega la API en {locale.toUpperCase()}. Publicado el{" "}
              <time dateTime={publication.published_at}>
                {dateLabel(publication.published_at)}
              </time>
              .
            </>
          ) : (
            `Todavía no hay publicación en ${locale.toUpperCase()}.`
          )}
        </p>
        {publication ? (
          changed.length ? (
            <p className="preview-changes">
              Cambios respecto a la publicación:{" "}
              <strong>{changed.map((f) => f.name).join(", ")}</strong>.
            </p>
          ) : (
            <p>El borrador coincide con esta publicación.</p>
          )
        ) : (
          <p>
            Guardar el borrador no lo publica. Cada idioma se publica por
            separado.
          </p>
        )}
      </div>
      {fields === null ? (
        <div className="preview-empty">
          <h3>Sin contenido publicado</h3>
          <p>
            Vuelve al borrador para revisarlo antes de publicar en{" "}
            {locale.toUpperCase()}.
          </p>
          <button
            type="button"
            className="button button-outline"
            onClick={() => onSource("draft")}
          >
            Ver borrador
          </button>
        </div>
      ) : view === "json" ? (
        <pre
          className="json-preview"
          aria-label={`JSON del ${source === "draft" ? "borrador" : "contenido publicado"}`}
        >
          {JSON.stringify(fields, null, 2)}
        </pre>
      ) : (
        <>
          {source === "published" && (
            <p className="preview-note">
              Las referencias se muestran por su identificador. Los archivos
              usan sus metadatos actuales.
            </p>
          )}
          <article
            className="entry-preview"
            aria-label={`Vista previa del ${source === "draft" ? "borrador" : "contenido publicado"}`}
          >
            {definitions.map((field) => {
              const value = fields[field.key];
              return (
                <section key={field.key}>
                  <small className="eyebrow">{field.name}</small>
                  {!field.active && (
                    <span className="preview-inactive">
                      Desactivado en el modelo actual
                    </span>
                  )}
                  {field.type === "rich_text" ? (
                    <RichRenderer
                      value={value}
                      assets={assets}
                      locale={locale}
                    />
                  ) : field.type === "asset" ? (
                    <AssetPreview
                      id={typeof value === "string" ? value : ""}
                      assets={assets}
                      locale={locale}
                    />
                  ) : field.type === "reference" ||
                    field.type === "references" ? (
                    <p className="preview-references">
                      {(Array.isArray(value)
                        ? value
                        : typeof value === "string" && value
                          ? [value]
                          : []
                      )
                        .map(String)
                        .map((id) => {
                          if (source === "published") return id;
                          const item = entryChoices.find(
                            (item) => item.id === id,
                          );
                          return item
                            ? itemLabel(item, locale)
                            : "Entrada no disponible";
                        })
                        .join(", ") || "—"}
                    </p>
                  ) : (
                    <p>
                      {value == null || value === ""
                        ? "—"
                        : typeof value === "boolean"
                          ? value
                            ? "Sí"
                            : "No"
                          : typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                    </p>
                  )}
                </section>
              );
            })}
            {!definitions.length && (
              <p className="muted">No hay campos para mostrar.</p>
            )}
          </article>
        </>
      )}
    </div>
  );
}
