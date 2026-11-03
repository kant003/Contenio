"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Code2,
  Eye,
  Globe2,
  LoaderCircle,
  Save,
  Trash2,
} from "lucide-react";
import {
  saveEntryAction,
  publicationAction,
  deleteEntryAction,
} from "@/app/actions";
import type {
  Asset,
  ContentType,
  Entry,
  Json,
  Locale,
  Publication,
} from "@/lib/types";
import { statusOf, titleOf } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/input";
import { RichText } from "./rich-text";
import { EntryReadView } from "./entry-read-view";
import { AssetPreview } from "./asset-preview";
import type { PreviewSource } from "@/lib/entry-preview";
import { ResourceField } from "./resource-picker";
import { assetItem, mergeItems, type PickerItem } from "@/lib/picker-types";
import { hasContent } from "@/lib/content-validation";
export function EntryEditor({
  space,
  initial,
  type,
  assets: initialAssets,
  entryChoices: initialChoices,
  publications,
  initialLocale = "es",
}: {
  space: string;
  initial?: Entry;
  type: ContentType;
  assets: Asset[];
  entryChoices: PickerItem[];
  publications: Publication[];
  initialLocale?: Locale;
}) {
  const router = useRouter();
  const [previewSource, setPreviewSource] = useState<PreviewSource>("draft");
  const [assets, setAssets] = useState(initialAssets);
  const [entryChoices, setEntryChoices] = useState(initialChoices);
  const [draft, setDraft] = useState({
    shared: initial?.shared ?? {},
    translations: initial?.translations ?? { es: {}, gl: {} },
  });
  const [locale, setLocale] = useState<Locale>(initialLocale),
    [view, setView] = useState("edit"),
    [saving, setSaving] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      initial ? "Todos los cambios guardados" : "Nueva entrada",
    ),
    [error, setError] = useState(""),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [persistedId, setPersistedId] = useState(initial?.id),
    [hasConflict, setHasConflict] = useState(false);
  const latest = useRef(draft),
    saved = useRef(JSON.stringify(draft)),
    currentId = useRef(initial?.id),
    version = useRef(initial?.version ?? 0),
    flight = useRef<Promise<Entry | undefined> | null>(null),
    conflict = useRef(false);
  const selectLocale = (next: Locale) => {
    setLocale(next);
    const url = new URL(window.location.href);
    url.searchParams.set("locale", next);
    window.history.replaceState(null, "", url.pathname + url.search);
  };
  const update = (key: string, value: Json, localized: boolean) => {
    setFieldErrors((old) => ({ ...old, [key]: "" }));
    setMessage("Cambios pendientes de guardar");
    setDraft((old) => {
      const next = localized
        ? {
            ...old,
            translations: {
              ...old.translations,
              [locale]: { ...old.translations[locale], [key]: value },
            },
          }
        : { ...old, shared: { ...old.shared, [key]: value } };
      latest.current = next;
      return next;
    });
  };
  const persist = useCallback(
    async function persistDraft(): Promise<Entry | undefined> {
      if (conflict.current) return;
      if (flight.current) {
        await flight.current;
        return persistDraft();
      }
      if (currentId.current && saved.current === JSON.stringify(latest.current))
        return {
          ...initial,
          id: currentId.current,
          version: version.current,
          ...latest.current,
        } as Entry;
      const capture = latest.current,
        serialized = JSON.stringify(capture);
      setSaving(true);
      setError("");
      const task = (async () => {
        const r = await saveEntryAction({
          space,
          type: type.id,
          id: currentId.current,
          version: version.current,
          ...capture,
        });
        if (r.error) {
          setError(r.error);
          setMessage("No se ha guardado");
          if (r.error.includes("CONFLICT")) {
            conflict.current = true;
            setHasConflict(true);
          }
          return;
        }
        const entry = r.data!;
        currentId.current = entry.id;
        setPersistedId(entry.id);
        version.current = entry.version;
        saved.current = serialized;
        const caughtUp = serialized === JSON.stringify(latest.current);
        setMessage(
          caughtUp
            ? "Todos los cambios guardados"
            : "Cambios pendientes de guardar",
        );
        if (!initial && caughtUp)
          router.replace(
            `/spaces/${space}/content/${entry.id}?locale=${locale}`,
          );
        return entry;
      })();
      flight.current = task;
      try {
        return await task;
      } catch {
        setError(
          "No se pudo conectar. Tus cambios siguen en este editor; pulsa Guardar para reintentar.",
        );
        setMessage("Guardado pendiente");
        return undefined;
      } finally {
        flight.current = null;
        setSaving(false);
      }
    },
    [space, type.id, router, initial, locale],
  );
  useEffect(() => {
    if (
      saving ||
      !currentId.current ||
      error ||
      conflict.current ||
      JSON.stringify(draft) === saved.current
    )
      return;
    const timer = setTimeout(() => void persist(), 1400);
    return () => clearTimeout(timer);
  }, [draft, error, persist, saving, persistedId]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== saved.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void persist();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [persist]);
  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest("a");
      if (
        !link ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        link.target === "_blank" ||
        saved.current === JSON.stringify(latest.current)
      )
        return;
      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.href === window.location.href
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      void (async () => {
        let entry = await persist();
        if (!entry) return;
        while (saved.current !== JSON.stringify(latest.current)) {
          entry = await persist();
          if (!entry) return;
        }
        router.push(destination.pathname + destination.search);
      })();
    };
    document.addEventListener("click", navigate, true);
    return () => document.removeEventListener("click", navigate, true);
  }, [persist, router]);
  const current = {
    ...initial,
    id: persistedId ?? "",
    shared: draft.shared,
    translations: draft.translations,
  } as Entry;
  const status = statusOf(current, type, publications, locale);
  const publish = async (remove = false) => {
    if (!remove) {
      const errors: Record<string, string> = {};
      for (const f of type.fields.filter((f) => f.active && f.required)) {
        const v = (f.localized ? draft.translations[locale] : draft.shared)[
          f.key
        ];
        if (!hasContent(v, f.type))
          errors[f.key] = "Completa este campo antes de publicar.";
      }
      setFieldErrors(errors);
      if (Object.keys(errors).length) {
        setError("Revisa los campos obligatorios de este idioma.");
        return;
      }
    }
    setBusy(true);
    try {
      let e = await persist();
      if (!e) return;
      while (saved.current !== JSON.stringify(latest.current)) {
        e = await persist();
        if (!e) return;
      }
      const r = await publicationAction(space, e.id, locale, e.version, remove);
      if (r.error) setError(r.error);
      else {
        setMessage(remove ? "Publicación retirada" : "Contenido publicado");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Link
        href={`/spaces/${space}/content`}
        className="back-link"
        onClick={async (e) => {
          if (saved.current !== JSON.stringify(latest.current)) {
            e.preventDefault();
            if (await persist()) router.push(`/spaces/${space}/content`);
          }
        }}
      >
        <ArrowLeft size={15} />
        Todas las entradas
      </Link>
      <div className="page-heading editor-heading">
        <div>
          <span className="eyebrow">{type.name.toUpperCase()}</span>
          <h1>
            {titleOf(current, type, locale) === "Sin título"
              ? "Nueva entrada"
              : titleOf(current, type, locale)}
            <span className="accent">.</span>
          </h1>
        </div>
        <div className="row">
          <span className="save-indicator" role="status">
            {saving ? (
              <LoaderCircle size={14} className="spin" />
            ) : (
              <CheckCheck size={15} />
            )}{" "}
            {message}
          </span>
          <Button
            variant="outline"
            disabled={saving || busy || hasConflict}
            onClick={() => void persist()}
          >
            <Save size={16} />
            Guardar
          </Button>
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
          {hasConflict && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Recargar entrada
            </Button>
          )}
        </div>
      )}
      <div className="editor-layout">
        <section className="content-panel editor-panel">
          <div className="editor-tabs">
            <div className="row">
              {[
                { key: "edit", label: "Editor", icon: Save },
                { key: "preview", label: "Vista previa", icon: Eye },
                { key: "json", label: "JSON", icon: Code2 },
              ].map((v) => (
                <button
                  key={v.key}
                  className={view === v.key ? "selected" : ""}
                  onClick={() => setView(v.key)}
                >
                  <v.icon size={15} />
                  {v.label}
                </button>
              ))}
            </div>
            <div className="locale-switch" aria-label="Idioma de edición">
              <button
                aria-pressed={locale === "es"}
                onClick={() => selectLocale("es")}
              >
                ES
              </button>
              <button
                aria-pressed={locale === "gl"}
                onClick={() => selectLocale("gl")}
              >
                GL
              </button>
            </div>
          </div>
          <div className="editor-fields">
            {view === "json" || view === "preview" ? (
              <EntryReadView
                entry={current}
                type={type}
                publications={publications}
                locale={locale}
                source={previewSource}
                onSource={setPreviewSource}
                view={view}
                assets={assets}
                entryChoices={entryChoices}
              />
            ) : (
              type.fields
                .filter((f) => f.active)
                .map((f) => {
                  const value = (
                    f.localized ? draft.translations[locale] : draft.shared
                  )[f.key];
                  const set = (v: Json) => update(f.key, v, f.localized);
                  const inputId = `field-${f.key}`;
                  return (
                    <div className="field-group" key={`${locale}-${f.key}`}>
                      <div className="field-label">
                        <label htmlFor={inputId}>
                          {f.name}
                          {f.required && <span className="required"> *</span>}
                        </label>
                        <span className="field-locale">
                          {f.localized
                            ? locale === "es"
                              ? "ESPAÑOL"
                              : "GALEGO"
                            : "COMPARTIDO"}
                        </span>
                      </div>
                      {f.help && (
                        <p className="field-help" id={`${inputId}-help`}>
                          {f.help}
                        </p>
                      )}
                      {f.type === "rich_text" ? (
                        <RichText
                          label={f.name}
                          value={value}
                          onChange={set}
                          assets={assets}
                          space={space}
                          locale={locale}
                          onAssets={(incoming) =>
                            setAssets((current) =>
                              mergeItems(current, incoming),
                            )
                          }
                        />
                      ) : f.type === "long_text" ? (
                        <Textarea
                          id={inputId}
                          value={String(value ?? "")}
                          onChange={(e) => set(e.target.value)}
                        />
                      ) : f.type === "boolean" ? (
                        <label className="checkbox-label">
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={value === true}
                            onChange={(e) => set(e.target.checked)}
                          />
                          Activado
                        </label>
                      ) : f.type === "asset" ? (
                        <>
                          <ResourceField
                            id={inputId}
                            label={f.name}
                            space={space}
                            kind="asset"
                            locale={locale}
                            values={
                              typeof value === "string" && value ? [value] : []
                            }
                            items={assets.map(assetItem)}
                            onChange={(ids, chosen) => {
                              setAssets((current) =>
                                mergeItems(
                                  current,
                                  chosen.flatMap((item) =>
                                    item.asset ? [item.asset] : [],
                                  ),
                                ),
                              );
                              set(ids[0] ?? null);
                            }}
                          />
                          <AssetPreview
                            id={String(value ?? "")}
                            assets={assets}
                            locale={locale}
                          />
                        </>
                      ) : f.type === "reference" || f.type === "references" ? (
                        <ResourceField
                          id={inputId}
                          label={f.name}
                          space={space}
                          kind="entry"
                          locale={locale}
                          multiple={f.type === "references"}
                          exclude={persistedId}
                          values={
                            f.type === "references"
                              ? Array.isArray(value)
                                ? value.map(String)
                                : []
                              : typeof value === "string" && value
                                ? [value]
                                : []
                          }
                          items={entryChoices}
                          onChange={(ids, chosen) => {
                            setEntryChoices((current) =>
                              mergeItems(current, chosen),
                            );
                            set(
                              f.type === "references" ? ids : (ids[0] ?? null),
                            );
                          }}
                        />
                      ) : (
                        <Input
                          id={inputId}
                          aria-describedby={`${inputId}-help`}
                          aria-invalid={Boolean(fieldErrors[f.key])}
                          type={
                            f.type === "number"
                              ? "number"
                              : f.type === "date"
                                ? "date"
                                : "text"
                          }
                          step={f.type === "number" ? "any" : undefined}
                          maxLength={f.type === "short_text" ? 256 : undefined}
                          value={
                            typeof value === "string" ||
                            typeof value === "number"
                              ? value
                              : ""
                          }
                          onChange={(e) =>
                            set(
                              f.type === "number"
                                ? e.target.value === ""
                                  ? null
                                  : Number(e.target.value)
                                : e.target.value,
                            )
                          }
                        />
                      )}{" "}
                      {fieldErrors[f.key] && (
                        <p className="field-error" role="alert">
                          {fieldErrors[f.key]}
                        </p>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </section>
        <aside className="editor-aside">
          <section className="content-panel publish-card">
            <span className="eyebrow">PUBLICACIÓN</span>
            <h3>Todo listo para conectar.</h3>
            <div className="publish-status">
              <span>Estado · {locale.toUpperCase()}</span>
              <span
                className={`badge ${status === "Publicado" ? "published" : status === "Borrador" ? "draft" : "changed"}`}
              >
                <span />
                {status}
              </span>
            </div>
            <Button
              className="full"
              disabled={busy || saving || hasConflict}
              onClick={() => void publish()}
            >
              <Globe2 size={16} />
              {busy ? "Procesando…" : `Publicar en ${locale.toUpperCase()}`}
            </Button>
            {publications.some(
              (p) => p.entry_id === persistedId && p.locale === locale,
            ) && (
              <Button
                variant="ghost"
                className="full"
                disabled={busy || saving}
                onClick={() => void publish(true)}
              >
                Retirar publicación
              </Button>
            )}
            <p>
              Guardar conserva tu borrador. Solo publicar cambia lo que reciben
              tus webs.
            </p>
          </section>
          <section className="content-panel translation-card">
            <span className="eyebrow">IDIOMAS</span>
            {(["es", "gl"] as Locale[]).map((l) => (
              <button key={l} onClick={() => selectLocale(l)}>
                <span>{l === "es" ? "Español" : "Galego"}</span>
                {type.fields
                  .filter((f) => f.active && f.localized && f.required)
                  .every((f) =>
                    hasContent(draft.translations[l][f.key], f.type),
                  ) ? (
                  <Check size={15} />
                ) : (
                  <span className="muted">Pendiente</span>
                )}
              </button>
            ))}
          </section>
          {initial && (
            <Button
              variant="ghost"
              className="delete-entry"
              disabled={busy || saving}
              onClick={async () => {
                if (
                  !window.confirm(
                    "¿Eliminar este borrador? Esta acción no se puede deshacer.",
                  )
                )
                  return;
                setBusy(true);
                const r = await deleteEntryAction(space, initial.id);
                if (r.error) {
                  setError(r.error);
                  setBusy(false);
                } else router.push(`/spaces/${space}/content`);
              }}
            >
              <Trash2 size={14} />
              Eliminar entrada
            </Button>
          )}
        </aside>
      </div>
    </>
  );
}
