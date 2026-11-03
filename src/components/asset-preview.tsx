import NextImage from "next/image";
import type { Asset, Locale } from "@/lib/types";

export function AssetPreview({
  id,
  assets,
  locale,
}: {
  id: string;
  assets: Asset[];
  locale: Locale;
}) {
  if (!id) return null;
  const asset = assets.find((a) => a.id === id);
  return asset?.url ? (
    <div className="asset-preview">
      {asset.mime.startsWith("image/") ? (
        <NextImage
          unoptimized
          width={1000}
          height={600}
          src={asset.url}
          alt={asset.alt[locale] ?? ""}
        />
      ) : (
        <a href={asset.url} target="_blank" rel="noreferrer">
          {asset.name}
        </a>
      )}
    </div>
  ) : (
    <p className="muted">Archivo no disponible</p>
  );
}
