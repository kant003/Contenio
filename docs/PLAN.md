# Contenio · plan y estado

Directorio de trabajo: `/Users/angel/workspaceNextJs/contenio`.
Remoto: `https://github.com/kant003/Contenio.git`.

## Stack actualizado

Next.js App Router, TypeScript, Tailwind, Tiptap y PostgreSQL. Producción: Neon Postgres integrado en Vercel, Blob privado y Better Auth para las sesiones. Desarrollo: PostgreSQL estándar y almacenamiento local privado. Se ha sustituido Supabase en código, dependencias, migraciones y pruebas.

| Hito | Entrega                                                                    | Estado                                                                           |
| ---- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1    | Login, espacios aislados y páginas ES/GL con persistencia                  | Implementado y probado con PostgreSQL local                                      |
| 2    | Administración de clientes y editores, recuperación y cambio de contraseña | Implementado; SMTP de producción pendiente                                       |
| 3    | Modelos configurables y formularios dinámicos                              | Implementado                                                                     |
| 4    | Imágenes/PDF privados y referencias entre entradas                         | Implementado; conexión real a Blob pendiente                                     |
| 5    | Publicación por idioma, snapshots, autoguardado y conflictos               | Implementado                                                                     |
| 6    | API con claves por espacio y consumidor de ejemplo                         | Implementado                                                                     |
| 7    | Filtros, vista previa, accesibilidad y adaptación móvil                    | Implementado y comprobado en escritorio/móvil                                    |
| 8    | Neon y Blob integrados con Vercel                                          | Adaptadores y guía preparados; aprovisionamiento/despliegue pendientes de acceso |

## Criterios

- Los clientes no leen ni modifican contenido o archivos de otros espacios.
- Las sesiones se verifican en el servidor y las consultas del CMS usan RLS con contexto por transacción.
- Guardar no publica. ES y GL se publican de forma independiente, sin fallback automático.
- Solo el administrador gestiona espacios, modelos, accesos y claves. Los editores pueden publicar en los espacios asignados.
- Archivos de hasta 10 MiB. Referencias dentro del espacio y protección del contenido utilizado.
- API versionada que entrega publicaciones actuales con claves hash revocables.
- Sin IA, facturación, registro abierto, constructor visual, edición simultánea ni migración de Contentful.

Los cambios se comitean en ramas `codex/...`. No se hace push ni despliegue sin la autorización correspondiente. No se han copiado credenciales ni datos locales de la carpeta anterior.

## Validación local completada · 2 de noviembre de 2026

- Tipos, ESLint y compilación de producción correctos.
- 6 pruebas unitarias y 41 comprobaciones de integración superadas.
- 4 pruebas Playwright sobre la compilación de producción: rutas protegidas; creación, traducción ES/GL, imagen, publicación y API; aislamiento y vista móvil; modelos y asignación de accesos.
- Migraciones y seed ejecutados de nuevo sin duplicar datos.
- `npm ci --dry-run --ignore-scripts` confirma la coherencia del lockfile.
- Archivos de entorno y contenido subido excluidos de Git. No se ha hecho push.

La validación de Neon, Blob y SMTP en producción continúa pendiente: las pruebas locales no sustituyen esa comprobación tras conectar Vercel. La biblioteca local usa disco privado; el adaptador de Blob se comprobará contra un almacén privado real antes de desplegar para clientes.
