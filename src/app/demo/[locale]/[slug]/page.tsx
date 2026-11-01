import { notFound } from "next/navigation";
import { RichRenderer } from "@/components/rich-renderer";
import type { Asset, Json, Locale, Values } from "@/lib/types";
export const dynamic = "force-dynamic";
async function fetchContent(path: string) {
  return fetch(
    `${process.env.CONTENT_API_URL}/spaces/${process.env.CONTENT_SPACE_ID}/${path}`,
    {
      headers: { Authorization: `Bearer ${process.env.CONTENT_READ_KEY}` },
      cache: "no-store",
    },
  );
}
export default async function Demo({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!["es", "gl"].includes(locale)) notFound();
  if (
    !process.env.CONTENT_API_URL ||
    !process.env.CONTENT_SPACE_ID ||
    !process.env.CONTENT_READ_KEY
  )
    return (
      <main className="docs-page">
        <h1>Conecta la web de ejemplo</h1>
        <p>
          Configura CONTENT_API_URL, CONTENT_SPACE_ID y CONTENT_READ_KEY en las
          variables del servidor. La clave nunca se envía al navegador.
        </p>
      </main>
    );
  const response = await fetchContent(
    `entries?type=page&locale=${locale}&slug=${encodeURIComponent(slug)}`,
  );
  if (!response.ok) throw new Error("No se pudo consultar la API de contenido");
  const { items } = await response.json();
  if (!items.length) notFound();
  const entry = items[0] as { fields: Values; publishedAt: string };
  const ids = new Set<string>();
  const walk = (v: Json) => {
    if (v && typeof v === "object") {
      if (
        !Array.isArray(v) &&
        v.type === "image" &&
        v.attrs &&
        typeof v.attrs === "object" &&
        !Array.isArray(v.attrs) &&
        typeof v.attrs.assetId === "string"
      )
        ids.add(v.attrs.assetId);
      Object.values(v).forEach(walk);
    }
  };
  walk(entry.fields.body ?? null);
  const assets: Asset[] = [];
  for (const id of ids) {
    const r = await fetchContent(`assets/${id}`);
    if (r.ok) assets.push(await r.json());
  }
  return (
    <main className="consumer-page">
      <span className="eyebrow">
        PUBLICADO CON CONTENIO · {locale.toUpperCase()}
      </span>
      <h1>{String(entry.fields.title ?? "Página")}</h1>
      <RichRenderer
        value={entry.fields.body}
        assets={assets}
        locale={locale as Locale}
      />
      <footer>
        Este contenido se ha obtenido desde el servidor a través de la API de
        lectura.
      </footer>
    </main>
  );
}
