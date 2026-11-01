# API de lectura v1

Todas las rutas requieren `Authorization: Bearer <clave>` y devuelven `Cache-Control: private, no-store`. Usa claves desde el servidor, nunca en variables públicas. Cada clave está limitada a un espacio y puede revocarse.

## Entradas

`GET /api/v1/spaces/{spaceId}/entries`

Parámetros: `type` (identificador técnico), `locale` (`es` por defecto o `gl`), `slug`, `limit` (1–100, por defecto 20), `offset` (0–1000000, por defecto 0). Orden estable por fecha de publicación descendente e identificador.

```json
{
  "items": [
    {
      "id": "uuid",
      "type": "page",
      "locale": "es",
      "fields": {
        "title": "Inicio",
        "slug": "inicio",
        "body": { "type": "doc", "content": [] }
      },
      "publishedAt": "fecha ISO"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

`GET /api/v1/spaces/{spaceId}/entries/{id}?locale=es` devuelve una entrada con el mismo formato de los elementos de `items`. No incluye el borrador. Un idioma sin publicar devuelve 404. Las referencias son IDs y deben resolverse con otra consulta; no se expanden recursivamente.

## Archivos

`GET /api/v1/spaces/{spaceId}/assets/{id}` devuelve `id`, `name`, `mime`, `size`, `alt`, `description`, `url` y `expiresIn: 900`. Solo permite archivos referenciados por publicaciones actuales del espacio. Los nodos de imagen de Tiptap persisten `attrs.assetId`, nunca una URL firmada.

Las URLs ya emitidas duran hasta 15 minutos. Revocar una clave impide nuevas solicitudes, pero no revoca enlaces ya emitidos.

## Errores

400 parámetros inválidos; 401 clave ausente, inválida, de otro espacio o revocada; 404 publicación/archivo no disponible; 503 fallo de configuración o servicio. Las respuestas tienen `{ "error": "mensaje" }`; los errores de parámetros pueden incluir `details`.
