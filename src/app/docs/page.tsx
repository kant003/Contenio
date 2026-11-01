import Link from "next/link";
import { ArrowLeft, Code2, Layers3 } from "lucide-react";
export default function Docs() {
  return (
    <main className="docs-page">
      <Link href="/spaces" className="brand">
        <span className="brand-mark">
          <Layers3 size={21} />
        </span>
        contenio.
      </Link>
      <Link href="/spaces" className="back-link">
        <ArrowLeft size={15} />
        Volver a mis espacios
      </Link>
      <span className="eyebrow">PARA CONECTAR TUS IDEAS</span>
      <h1>Una API. Todas tus webs.</h1>
      <p>
        Consulta únicamente contenido publicado, con una clave de lectura de tu
        espacio.
      </p>
      <section className="content-panel docs-section">
        <Code2 size={24} />
        <h2>Primeros pasos</h2>
        <ol>
          <li>Publica una entrada en español o gallego.</li>
          <li>Crea una clave en Ajustes → Claves de lectura.</li>
          <li>Consulta la API desde el servidor de tu web.</li>
        </ol>
        <pre>{`const response = await fetch(
  process.env.CONTENT_API_URL + "/spaces/" + spaceId + "/entries?type=page&locale=es",
  {
    headers: { Authorization: "Bearer " + process.env.CONTENT_READ_KEY },
    cache: "no-store"
  }
);
if (!response.ok) throw new Error("Contenido no disponible");
const { items, total } = await response.json();`}</pre>
        <p>
          Guarda la clave en variables del servidor. No uses prefijos
          NEXT_PUBLIC_ ni la incluyas en código del navegador.
        </p>
      </section>
      <section className="content-panel docs-section">
        <h2>Rutas disponibles</h2>
        <div className="api-route">
          <b>GET</b>
          <code>/api/v1/spaces/{"{spaceId}"}/entries</code>
        </div>
        <p>
          Filtros: <code>type</code>, <code>locale</code> (es por defecto o gl),{" "}
          <code>slug</code>, <code>limit</code> (20 por defecto, máximo 100),{" "}
          <code>offset</code> (0 por defecto). Devuelve items, total, limit y
          offset.
        </p>
        <div className="api-route">
          <b>GET</b>
          <code>
            /api/v1/spaces/{"{spaceId}"}/entries/{"{id}"}?locale=es
          </code>
        </div>
        <p>
          Devuelve id, type, locale, fields y publishedAt. Un idioma sin
          publicar devuelve 404; no se sustituye automáticamente por otro.
        </p>
        <div className="api-route">
          <b>GET</b>
          <code>
            /api/v1/spaces/{"{spaceId}"}/assets/{"{id}"}
          </code>
        </div>
        <p>
          Devuelve metadatos y una URL temporal de 15 minutos. Solo están
          disponibles los archivos utilizados por una publicación actual. Las
          referencias a otras entradas se entregan como identificadores, sin
          expansión automática.
        </p>
        <h3>Respuestas de error</h3>
        <p>
          400: parámetros inválidos · 401: clave inválida o revocada · 404:
          publicación o archivo no disponible · 503: servicio temporalmente no
          disponible.
        </p>
      </section>
      <p className="muted">
        La web de ejemplo está en /demo/es/tu-slug. Requiere CONTENT_API_URL,
        CONTENT_SPACE_ID y CONTENT_READ_KEY en el servidor.
      </p>
    </main>
  );
}
