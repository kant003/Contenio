"use client";
import NextImage from "next/image";
import Link from "next/link";
import { upload as uploadBlob } from "@vercel/blob/client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  ImageIcon,
  LoaderCircle,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  uploadAction,
  completeAssetAction,
  deleteAssetAction,
  assetMetadataAction,
} from "@/app/actions";
import type { Asset, Locale } from "@/lib/types";
import {
  MEDIA_PAGE_SIZE,
  fileSize,
  mediaHref,
  parseMediaFilters,
  type MediaFilters,
  type MediaPage,
} from "@/lib/media-filters";
import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/input";
import { Dialog } from "./ui/dialog";
export function Media({
  space,
  result,
  filters,
}: {
  space: string;
  result: MediaPage;
  filters: MediaFilters;
}) {
  const router = useRouter(),
    file = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition(),
    [navigating, startNavigation] = useTransition();
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [selected, setSelected] = useState<Asset | null>(null);
  const { items, total, page, stats } = result;
  const pending = uploading || navigating;
  const pageCount = Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE));
  const navigate = (next: MediaFilters) =>
    startNavigation(() =>
      router.push(mediaHref(space, next), { scroll: false }),
    );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(
      parseMediaFilters(
        Object.fromEntries(
          [...new FormData(event.currentTarget)].map(([key, value]) => [
            key,
            String(value),
          ]),
        ),
      ),
    );
  };
  const upload = (f: File) => {
    if (!f.size || f.size > 10485760) {
      setNotice({
        text: "Selecciona un archivo de hasta 10 MiB.",
        error: true,
      });
      if (file.current) file.current.value = "";
      return;
    }
    setNotice(null);
    const data = new FormData();
    data.set("file", f);
    startUpload(async () => {
      try {
        let r;
        if (process.env.NEXT_PUBLIC_BLOB_UPLOADS === "true") {
          const id = crypto.randomUUID();
          const blob = await uploadBlob(`${space}/${id}`, f, {
            access: "private",
            handleUploadUrl: "/api/uploads",
            clientPayload: JSON.stringify({ space, id }),
          });
          r = await completeAssetAction(space, id, blob.url, f.name);
        } else r = await uploadAction(space, data);
        if (r.error) setNotice({ text: r.error, error: true });
        else {
          setNotice({
            text: "Archivo subido correctamente. Mostrando los archivos más recientes.",
            error: false,
          });
          const next = {
            ...filters,
            q: "",
            kind: "" as const,
            sort: "recent" as const,
            page: 1,
          };
          if (mediaHref(space, next) === mediaHref(space, filters))
            router.refresh();
          else navigate(next);
        }
      } catch {
        setNotice({
          text: "No se pudo subir el archivo. Inténtalo de nuevo.",
          error: true,
        });
      } finally {
        if (file.current) file.current.value = "";
      }
    });
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LOS DETALLES TAMBIÉN CUENTAN</span>
          <h1>
            Archivos<span className="accent">.</span>
          </h1>
          <p>Tu biblioteca de imágenes y documentos, siempre a mano.</p>
        </div>
        <Button disabled={pending} onClick={() => file.current?.click()}>
          <Upload size={17} />
          {uploading ? "Subiendo…" : "Subir archivo"}
        </Button>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
          className="sr-only"
          ref={file}
          disabled={pending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
          aria-label="Seleccionar archivo"
        />
      </div>
      <div
        className="upload-area"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f && !pending) upload(f);
        }}
      >
        <span className="stat-icon violet">
          <Upload size={22} />
        </span>
        <div>
          <strong>Arrastra aquí tu próximo recurso.</strong>
          <p>JPEG, PNG, WebP, AVIF o PDF · Hasta 10 MiB por archivo</p>
        </div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => file.current?.click()}
        >
          Elegir archivo
        </Button>
      </div>
      {notice && (
        <p
          role={notice.error ? "alert" : "status"}
          className={`notice ${notice.error ? "error" : ""}`}
        >
          {notice.text}
        </p>
      )}
      <section
        className="content-panel media-panel"
        aria-label="Biblioteca de archivos"
        aria-busy={pending}
      >
        <div className="panel-title">
          <div>
            <h2>
              Tu biblioteca <span className="count">{total}</span>
            </h2>
            <p>
              {stats.total} archivos en el espacio · {stats.images} imágenes ·{" "}
              {stats.pdfs} PDF · {fileSize(stats.bytes)}
            </p>
          </div>
          <div className="row" role="status" aria-live="polite">
            {navigating && <LoaderCircle size={14} className="spin" />}
            <small className="muted">
              {navigating
                ? "Buscando archivos…"
                : `${total} ${total === 1 ? "archivo encontrado" : "archivos encontrados"}`}
            </small>
          </div>
        </div>
        <form
          key={mediaHref(space, filters)}
          className="filters media-filters"
          method="get"
          action={`/spaces/${space}/media`}
          onSubmit={submit}
        >
          <div className="search-input">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              name="q"
              aria-label="Buscar archivos"
              placeholder="Nombre o descripción…"
              defaultValue={filters.q}
              maxLength={256}
              disabled={pending}
            />
          </div>
          <select
            name="kind"
            aria-label="Tipo de archivo"
            defaultValue={filters.kind}
            disabled={pending}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            <option value="">Todos los archivos</option>
            <option value="image">Imágenes</option>
            <option value="pdf">PDF</option>
          </select>
          <select
            name="locale"
            aria-label="Idioma de los archivos"
            defaultValue={filters.locale}
            disabled={pending}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            <option value="es">Español</option>
            <option value="gl">Galego</option>
          </select>
          <select
            name="sort"
            aria-label="Ordenar archivos"
            defaultValue={filters.sort}
            disabled={pending}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            <option value="recent">Más recientes</option>
            <option value="name">Nombre A–Z</option>
            <option value="size">Mayor tamaño</option>
          </select>
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            Buscar
          </Button>
        </form>
        {(filters.q || filters.kind) && (
          <div className="active-filters">
            <span>Filtros aplicados{filters.q ? ` · «${filters.q}»` : ""}</span>
            <Link
              href={mediaHref(space, { ...filters, q: "", kind: "", page: 1 })}
              prefetch={false}
              scroll={false}
            >
              Limpiar filtros
            </Link>
          </div>
        )}
        <div className="media-grid">
          {items.map((a) => (
            <button
              className="asset-card"
              key={a.id}
              onClick={() => setSelected(a)}
            >
              <div className="asset-thumb">
                {a.mime.startsWith("image/") && a.url ? (
                  <NextImage
                    unoptimized
                    width={1000}
                    height={600}
                    src={a.url}
                    alt={a.alt[filters.locale] ?? ""}
                  />
                ) : (
                  <FileText size={42} strokeWidth={1.3} />
                )}
                <span>{a.mime.split("/")[1].toUpperCase()}</span>
              </div>
              <div className="asset-card-info">
                <strong>{a.name}</strong>
                <span>
                  {fileSize(a.size)}
                  <span>·</span>Privado
                </span>
              </div>
            </button>
          ))}
        </div>
        {!items.length && (
          <div className="empty">
            <ImageIcon size={30} />
            <h3>
              {stats.total
                ? "No encontramos esos archivos"
                : "Una biblioteca por descubrir"}
            </h3>
            <p>
              {stats.total
                ? "Prueba con otro nombre, descripción o tipo de archivo."
                : "Sube tu primera imagen o documento para reutilizarlo en tus contenidos."}
            </p>
          </div>
        )}
        <div className="pagination">
          <span>
            {total
              ? `${(page - 1) * MEDIA_PAGE_SIZE + 1}–${Math.min(page * MEDIA_PAGE_SIZE, total)} de ${total} archivos`
              : "Sin archivos"}
          </span>
          <div className="row">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior de archivos"
              disabled={pending || page === 1}
              onClick={() => navigate({ ...filters, page: page - 1 })}
            >
              <ChevronLeft size={16} />
            </Button>
            <span>
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Página siguiente de archivos"
              disabled={pending || page >= pageCount}
              onClick={() => navigate({ ...filters, page: page + 1 })}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </section>
      {selected && (
        <AssetDialog
          key={selected.id}
          space={space}
          asset={selected}
          initialLocale={filters.locale}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function AssetDialog({
  space,
  asset,
  onClose,
  initialLocale,
}: {
  space: string;
  asset: Asset;
  onClose: () => void;
  initialLocale: Locale;
}) {
  const router = useRouter(),
    [name, setName] = useState(asset.name),
    [alt, setAlt] = useState(asset.alt),
    [description, setDescription] = useState(asset.description),
    [locale, setLocale] = useState<Locale>(initialLocale),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  return (
    <Dialog titleId="asset-title" onClose={onClose} className="asset-modal">
      <div className="row between">
        <h2 id="asset-title">Detalles del archivo</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X size={18} />
        </Button>
      </div>
      {asset.mime.startsWith("image/") && asset.url && (
        <NextImage
          unoptimized
          width={1000}
          height={600}
          className="asset-detail-preview"
          src={asset.url}
          alt={asset.alt[locale] ?? ""}
        />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await assetMetadataAction(
              space,
              asset.id,
              name,
              alt,
              description,
            );
            if (r.error) setError(r.error);
            else {
              router.refresh();
              onClose();
            }
          });
        }}
      >
        <label>
          Nombre
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label>
          Idioma
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            <option value="es">Español</option>
            <option value="gl">Galego</option>
          </select>
        </label>
        <label>
          Texto alternativo
          <Input
            value={alt[locale] ?? ""}
            onChange={(e) => setAlt({ ...alt, [locale]: e.target.value })}
          />
        </label>
        <label>
          Descripción
          <Textarea
            value={description[locale] ?? ""}
            onChange={(e) =>
              setDescription({ ...description, [locale]: e.target.value })
            }
          />
        </label>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <div className="row between">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm(
                  "¿Eliminar este archivo? Solo se eliminará si ningún contenido lo utiliza.",
                )
              )
                return;
              start(async () => {
                const r = await deleteAssetAction(space, asset.id);
                if (r.error) setError(r.error);
                else {
                  router.refresh();
                  onClose();
                }
              });
            }}
          >
            <Trash2 size={15} />
            Eliminar
          </Button>
          <Button disabled={pending}>
            <Save size={15} />
            Guardar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
