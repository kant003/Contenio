"use client";
import { useEffect, useId, useState, type FormEvent } from "react";
import NextImage from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import {
  itemLabel,
  mergeItems,
  type PickerItem,
  type PickerPage,
  type ResourceKind,
} from "@/lib/picker-types";
import { fileSize } from "@/lib/media-filters";
import type { Locale } from "@/lib/types";

interface PickerProps {
  space: string;
  kind: ResourceKind;
  locale: Locale;
  values: string[];
  items: PickerItem[];
  multiple?: boolean;
  exclude?: string;
  onConfirm: (ids: string[], items: PickerItem[]) => void;
  onClose: () => void;
}
export function ResourcePicker({
  space,
  kind,
  locale,
  values,
  items,
  multiple = false,
  exclude,
  onConfirm,
  onClose,
}: PickerProps) {
  const titleId = useId();
  const [filters, setFilters] = useState({ q: "", page: 1 });
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(values);
  const [known, setKnown] = useState(items);
  const [response, setResponse] = useState<{
    key: string;
    data: PickerPage;
  } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(
    null,
  );
  const search = new URLSearchParams({
    kind,
    locale,
    q: filters.q,
    page: String(filters.page),
  });
  if (exclude) search.set("exclude", exclude);
  const url = `/api/editor/spaces/${space}/choices?${search}`;
  const key = `${url}:${revision}`;
  const data = response?.key === key ? response.data : null;
  const failure = error?.key === key ? error.message : "";
  const pending = !data && !failure;
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const result = await fetch(url, {
          signal: abort.signal,
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!result.ok)
          throw new Error(
            result.status === 401
              ? "Tu sesión ha caducado. Vuelve a entrar para continuar."
              : "No se pudieron cargar los recursos. Inténtalo de nuevo.",
          );
        const page = (await result.json()) as PickerPage;
        if (!abort.signal.aborted) {
          setResponse({ key, data: page });
          setError(null);
          setKnown((current) => mergeItems(current, page.items));
        }
      } catch (e) {
        if (!abort.signal.aborted)
          setError({
            key,
            message:
              e instanceof Error
                ? e.message
                : "No se pudo conectar. Inténtalo de nuevo.",
          });
      }
    }
    void load();
    return () => abort.abort();
  }, [url, key]);
  const title =
    kind === "image"
      ? "Insertar imagen"
      : kind === "asset"
        ? "Seleccionar archivo"
        : multiple
          ? "Relacionar entradas"
          : "Relacionar una entrada";
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({
      q: String(new FormData(event.currentTarget).get("q") ?? "").trim(),
      page: 1,
    });
  };
  return (
    <Dialog titleId={titleId} onClose={onClose} className="resource-modal">
      <div className="row between">
        <div>
          <h2 id={titleId}>{title}</h2>
          <p className="muted">
            {locale === "gl" ? "Galego" : "Español"} · Recursos de este espacio
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Cerrar selector"
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </div>
      <form className="resource-search" onSubmit={submit}>
        <div className="search-input">
          <Search size={17} />
          <input
            type="search"
            name="q"
            aria-label="Buscar en el selector"
            placeholder={
              kind === "entry" ? "Título o slug…" : "Nombre o descripción…"
            }
            maxLength={256}
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Buscar
        </Button>
      </form>
      <div role="status" className="resource-status" aria-live="polite">
        {pending ? (
          <>
            <LoaderCircle size={15} className="spin" /> Buscando recursos…
          </>
        ) : data ? (
          `${data.total} resultados · ${selected.length} seleccionados`
        ) : (
          ""
        )}
      </div>
      {failure && (
        <div className="notice error">
          <p role="alert">{failure}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRevision((r) => r + 1)}
          >
            Reintentar
          </Button>
        </div>
      )}
      <div className="resource-results" aria-busy={pending}>
        {data?.items.map((item) => (
          <label
            key={item.id}
            className={`resource-option ${selected.includes(item.id) ? "selected" : ""}`}
          >
            <input
              type={multiple ? "checkbox" : "radio"}
              name={titleId}
              aria-label={`Seleccionar ${itemLabel(item, locale)}`}
              checked={selected.includes(item.id)}
              onChange={() =>
                setSelected((current) =>
                  multiple
                    ? current.includes(item.id)
                      ? current.filter((id) => id !== item.id)
                      : [...current, item.id]
                    : [item.id],
                )
              }
            />
            {item.asset?.mime.startsWith("image/") && item.asset.url ? (
              <NextImage
                unoptimized
                width={56}
                height={48}
                src={item.asset.url}
                alt=""
              />
            ) : (
              <span className="resource-file">
                <FileText size={24} />
              </span>
            )}
            <span className="resource-option-text">
              <strong>{itemLabel(item, locale)}</strong>
              <small>
                {item.asset
                  ? `${item.asset.mime.split("/")[1].toUpperCase()} · ${fileSize(item.asset.size)}`
                  : item.detail}
              </small>
            </span>
          </label>
        ))}
        {data && !data.total && (
          <div className="empty">
            <FileText size={28} />
            <h3>No encontramos recursos</h3>
            <p>Prueba con otro título o nombre.</p>
          </div>
        )}
      </div>
      {data && (
        <div className="pagination resource-pagination">
          <span>
            {data.total
              ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} de ${data.total}`
              : "Sin resultados"}
          </span>
          <div className="row">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Página anterior del selector"
              disabled={data.page === 1}
              onClick={() => setFilters((f) => ({ ...f, page: data.page - 1 }))}
            >
              <ChevronLeft size={16} />
            </Button>
            <span>
              {data.page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Página siguiente del selector"
              disabled={data.page * data.pageSize >= data.total}
              onClick={() => setFilters((f) => ({ ...f, page: data.page + 1 }))}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
      <div className="resource-footer">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={
            (!multiple && !selected.length) || pending || Boolean(failure)
          }
          onClick={() =>
            onConfirm(
              selected,
              selected.flatMap((id) => {
                const item = known.find((i) => i.id === id);
                return item ? [item] : [];
              }),
            )
          }
        >
          {multiple ? `Usar selección (${selected.length})` : "Usar selección"}
        </Button>
      </div>
    </Dialog>
  );
}

export function ResourceField({
  id,
  label,
  space,
  kind,
  locale,
  values,
  items,
  multiple = false,
  exclude,
  onChange,
}: {
  id: string;
  label: string;
  space: string;
  kind: "asset" | "entry";
  locale: Locale;
  values: string[];
  items: PickerItem[];
  multiple?: boolean;
  exclude?: string;
  onChange: PickerProps["onConfirm"];
}) {
  const [open, setOpen] = useState(false);
  const name = (value: string) => {
    const item = items.find((item) => item.id === value);
    return item
      ? itemLabel(item, locale)
      : kind === "asset"
        ? "Archivo no disponible"
        : "Entrada no disponible";
  };
  return (
    <div className="resource-field">
      {values.length > 0 && (
        <ul className="resource-selection" aria-label={`Selección de ${label}`}>
          {values.map((value) => (
            <li key={value}>
              <FileText size={16} />
              <span>{name(value)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar ${name(value)}`}
                onClick={() =>
                  onChange(
                    values.filter((id) => id !== value),
                    [],
                  )
                }
              >
                <X size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        id={id}
        variant="outline"
        aria-haspopup="dialog"
        aria-label={`Seleccionar ${label}`}
        onClick={() => setOpen(true)}
      >
        {multiple
          ? "Añadir entradas"
          : values.length
            ? "Cambiar selección"
            : kind === "asset"
              ? "Elegir archivo"
              : "Elegir entrada"}
      </Button>
      {open && (
        <ResourcePicker
          space={space}
          kind={kind}
          locale={locale}
          values={values}
          items={items}
          multiple={multiple}
          exclude={exclude}
          onClose={() => setOpen(false)}
          onConfirm={(ids, selected) => {
            onChange(ids, selected);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
