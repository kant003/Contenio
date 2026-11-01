"use client";
import NextImage from "next/image";
import { upload as uploadBlob } from "@vercel/blob/client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  ImageIcon,
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
import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/input";
import { Dialog } from "./ui/dialog";
export function Media({ space, assets }: { space: string; assets: Asset[] }) {
  const router = useRouter(),
    file = useRef<HTMLInputElement>(null),
    [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Asset | null>(null);
  const upload = (f: File) => {
    const data = new FormData();
    data.set("file", f);
    start(async () => {
      let r;
      try {
        if (process.env.NEXT_PUBLIC_BLOB_UPLOADS === "true") {
          const id = crypto.randomUUID();
          const blob = await uploadBlob(`${space}/${id}`, f, {
            access: "private",
            handleUploadUrl: "/api/uploads",
            clientPayload: JSON.stringify({ space, id }),
          });
          r = await completeAssetAction(space, id, blob.url, f.name);
        } else r = await uploadAction(space, data);
      } catch {
        setMessage("No se pudo subir el archivo. Inténtalo de nuevo.");
        return;
      }
      setMessage(r.error ?? "Archivo subido correctamente.");
      if (!r.error) router.refresh();
      if (file.current) file.current.value = "";
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
          {pending ? "Subiendo…" : "Subir archivo"}
        </Button>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
          className="sr-only"
          ref={file}
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
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="media-heading">
        <h2>
          Tu biblioteca <span className="count">{assets.length}</span>
        </h2>
        <div className="search-input">
          <Search size={16} />
          <input
            aria-label="Buscar archivos"
            placeholder="Buscar un archivo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="media-grid">
        {assets
          .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
          .map((a) => (
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
                    alt={a.alt.es ?? ""}
                  />
                ) : (
                  <FileText size={42} strokeWidth={1.3} />
                )}
                <span>{a.mime.split("/")[1].toUpperCase()}</span>
              </div>
              <div className="asset-card-info">
                <strong>{a.name}</strong>
                <span>
                  {(a.size / 1024).toFixed(1)} KB<span>·</span>Privado
                </span>
              </div>
            </button>
          ))}
      </div>
      {!assets.length && (
        <div className="empty">
          <ImageIcon size={30} />
          <h3>Una biblioteca por descubrir</h3>
          <p>
            Sube tu primera imagen o documento para reutilizarlo en tus
            contenidos.
          </p>
        </div>
      )}
      {selected && (
        <AssetDialog
          key={selected.id}
          space={space}
          asset={selected}
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
}: {
  space: string;
  asset: Asset;
  onClose: () => void;
}) {
  const router = useRouter(),
    [name, setName] = useState(asset.name),
    [alt, setAlt] = useState(asset.alt),
    [description, setDescription] = useState(asset.description),
    [locale, setLocale] = useState<Locale>("es"),
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
