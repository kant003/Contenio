# Contenio · plan y estado

Directorio de trabajo: `/Users/angel/workspaceNextJs/contenio`.
Remoto: `https://github.com/kant003/Contenio.git`.

## Stack actualizado

Next.js App Router, TypeScript, Tailwind, Tiptap y PostgreSQL. Producción: Neon Postgres integrado en Vercel, Blob privado y Better Auth para las sesiones. Desarrollo: PostgreSQL estándar y almacenamiento local privado. Se ha sustituido Supabase en código, dependencias, migraciones y pruebas.

| Hito | Entrega                                                                    | Estado                                                                           |
| ---- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1    | Login, espacios aislados y páginas ES/GL con persistencia                  | Implementado y probado con PostgreSQL local                                      |
| 2    | Administración de clientes y editores, recuperación y cambio de contraseña | Implementado y probado con correo local; SMTP de producción pendiente            |
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

## Avance: listado con consultas paginadas en PostgreSQL

- Hasta 12 resúmenes por página; búsqueda literal por título/slug, modelo, estado del idioma y ordenación estable.
- Filtros, ES/GL, orden y página en la URL. Recargar, compartir y volver atrás mantienen la selección; abrir o crear una entrada conserva el idioma.
- Indicador de búsqueda, limpieza de filtros y páginas fuera de rango resueltas sin errores. Los contadores globales del espacio permanecen separados del número de resultados.
- Modelos y Ajustes ya no consultan entradas, publicaciones ni archivos; el listado no envía sus cuerpos o snapshots al navegador.
- 8 pruebas unitarias, 41 comprobaciones de integración existentes y 22 nuevas, más 6 pruebas Playwright sobre producción local: todo correcto. Tipos, ESLint y build correctos.

La paginación de la biblioteca y de los selectores del editor se ha completado en los avances posteriores. La recuperación de cuenta se ha verificado en el avance posterior con el buzón local. La conexión y validación real de Neon/Blob continúa pendiente del acceso a Vercel.

## Avance: biblioteca de archivos con búsqueda y paginación

- Consulta PostgreSQL con RLS: hasta 12 archivos por página, búsqueda literal por nombre y metadatos del idioma elegido, filtros de imágenes/PDF y ordenación por nombre, tamaño o fecha de subida.
- Parámetros en la URL para recargar, compartir y volver atrás conservando filtros, idioma y página. Las URLs privadas se firman solo para los archivos visibles.
- Contadores y tamaño total de los archivos registrados en el espacio, independientes de los resultados filtrados. No representan el consumo completo de Blob, que también puede incluir objetos huérfanos.
- El diálogo se abre en el idioma del listado. Guardar los metadatos actualiza la búsqueda; eliminar el último resultado resuelve la página automáticamente.
- Las subidas vuelven a los recientes conservando el idioma para que ningún filtro anterior las oculte. El selector se reinicia tras un error y permite reintentar.
- Revisado en escritorio y móvil; selectores móviles distribuidos en dos columnas.
- Verificación: 10 pruebas unitarias, 85 comprobaciones de integración (41 + 22 + 22), 8 pruebas Playwright sobre producción local, tipos, ESLint y build correctos.

Este avance no cambia el esquema ni requiere nuevas migraciones. No se han creado recursos remotos ni realizado push. Neon, Blob y correo de producción siguen pendientes de conexión y validación con los accesos de Vercel.

## Avance: selectores paginados dentro del editor

- Los campos de archivo, referencias simples/múltiples y las imágenes de Tiptap abren un selector con búsqueda y hasta 12 recursos por página. La búsqueda respeta ES/GL y el espacio activo; el selector de imágenes excluye PDF.
- La selección múltiple permanece al cambiar de página o buscar. Confirmar aplica los cambios; Cancelar o Escape los descarta. Es posible vaciar la selección completa y quitar elementos desde el campo.
- Abrir una entrada carga únicamente su contenido, sus publicaciones y sus recursos vinculados. Las referencias se presentan mediante etiquetas traducibles, sin cargar los cuerpos de las entradas relacionadas.
- Nuevo endpoint interno de lectura con sesión verificada, RLS, validación de filtros y respuestas privadas sin caché. No utiliza claves públicas de lectura ni permite consultar otros espacios.
- Las búsquedas no disparan guardados ni cambian la URL del editor. Los fallos de consulta admiten reintento y se cancelan peticiones anteriores para evitar respuestas atrasadas.
- Corregida la restauración del foco en los diálogos al cerrar; comprobada la visualización en móvil.
- Verificación: 12 pruebas unitarias; 103 comprobaciones de integración (41 + 22 + 22 + 18); 10 pruebas Playwright sobre producción local. Tipos, ESLint y build correctos.

Sin nuevas dependencias ni cambios de esquema. El código y las pruebas están preparados para la integración con Neon/Blob; la validación real en Vercel sigue pendiente del acceso externo. La recuperación y el cambio de contraseña se han verificado en el avance posterior con el buzón de pruebas.

## Avance: recuperación de cuenta y cambio de contraseña

- Acceso visible a **Mi cuenta** desde los espacios y el panel. Cambio con contraseña actual, confirmación y errores accesibles junto al campo; conserva la sesión actual y cierra las demás.
- Recuperación por correo con enlaces de un solo uso válidos durante 30 minutos. Respuesta genérica para direcciones registradas o desconocidas; sin registro público.
- Pantalla explicativa para enlaces incompletos, caducados o utilizados, incluyendo caducidad mientras se completa el formulario. Restablecer la contraseña cierra todas las sesiones anteriores.
- Política compartida de 12–128 caracteres en formularios, servidor, Better Auth y creación de cuentas administradas. No se recortan las contraseñas.
- Corregida la lectura de cookies tras renovar una sesión en una acción del servidor, para que la confirmación permanezca visible. Páginas de acceso sin caché, sin referencia saliente y excluidas de indexación. Cabecera de acceso móvil sin texto cortado.
- Pruebas con cuentas desechables, correo local y limpieza limitada a sus propios mensajes: entrega real, normalización del email, confirmación incorrecta, expiración, consumo concurrente de un mismo enlace, credenciales anteriores/nuevas y revocación de sesiones. Los intentos HTTP respetan los límites de Better Auth.
- Verificación: 16 pruebas unitarias, 103 comprobaciones de integración y 14 pruebas Playwright sobre producción local. Tipos, ESLint y build correctos.

Sin nuevas dependencias ni migraciones. Correo probado con Mailpit local; SMTP, Neon y Blob de producción siguen pendientes de conexión y validación al disponer de los accesos externos. No se ha realizado push ni despliegue.

## Avance: comparar el borrador con su publicación · 3 de noviembre de 2026

- Selector **Borrador / Publicado** en Vista previa y JSON. Conserva la selección al cambiar de vista e idioma, muestra la fecha de publicación e identifica los campos con cambios. Consultarlo no guarda ni publica.
- El borrador muestra los cambios actuales del editor, incluso antes del primer guardado. La vista publicada conserva exactamente el snapshot del idioma, incluidos campos desactivados en el modelo actual; el JSON coincide con `fields` de la API.
- Sin publicación en el idioma seleccionado se muestra una explicación y acceso al borrador; no se sustituye por otro idioma. Publicar, republicar y retirar actualizan la vista con el resultado confirmado del servidor.
- La carga inicial incluye archivos del borrador y de las publicaciones actuales de la entrada, sin duplicados ni recursos únicamente históricos. Conserva RLS, el filtro por espacio y las URLs privadas; las referencias publicadas siguen siendo identificadores, sin expansión.
- Compartido el renderizado de archivos entre editor y vista previa. Valores cero y booleanos se muestran correctamente, y el texto largo conserva los saltos de línea. Navegación por teclado y vista móvil comprobadas.
- Verificación: 20 pruebas unitarias, 111 comprobaciones de integración (41 + 22 + 22 + 26) y 18 pruebas Playwright sobre producción local; tipos, ESLint y build correctos. Los casos nuevos comprueban archivos retirados del borrador, modelos cambiados, aislamiento, igualdad con la API, idiomas sin publicar y ausencia de guardados al cambiar de vista.

Sin dependencias ni migraciones nuevas. La conexión y comprobación de Neon, Blob y correo de producción siguen pendientes del acceso a Vercel. No se ha realizado push ni despliegue.

## Avance: recuperación del guardado y conflictos

- El guardado en curso comparte un resultado seguro con las acciones que esperan por él: un fallo de conexión conserva el borrador y cancela la navegación pendiente, sin rechazos de promesas sin tratar ni reintentos silenciosos.
- Al navegar con cambios pendientes se espera a la operación actual y se guardan también las últimas ediciones de ambos idiomas antes de salir. Eliminado el segundo manejador de guardado del enlace de vuelta al listado.
- Recuperación visible con reintento de guardado y copia JSON descargable: datos comunes, ES/GL, definición del modelo y versión base. La descarga no guarda ni publica, no contiene credenciales ni binarios y puede consultarse para copiar cambios manualmente.
- Confirmación accesible antes de descartar y recargar la versión del servidor, con cancelación y descarga de copia desde el diálogo. Los enlaces de descarga no activan el guardado previo a navegar.
- También se bloquean los conflictos detectados al publicar sin cambios locales. Una entrada con conflicto no permite guardar, publicar, retirar ni eliminar desde esa sesión hasta recargar; se conserva la publicación anterior.
- Verificación: 22 pruebas unitarias, 111 comprobaciones de integración y 22 pruebas Playwright sobre producción local; tipos, ESLint y build correctos. Casos nuevos: conexión interrumpida con navegación esperando, reintento y persistencia ES/GL, guardado lento con ediciones posteriores, dos sesiones concurrentes y publicación con versión antigua. Copias JSON y diálogo comprobados en navegador y móvil.

Sin migraciones, dependencias, push ni despliegue. Neon, Blob y SMTP de producción siguen pendientes del acceso a Vercel. Las copias son manuales y no añaden importación ni edición simultánea.
