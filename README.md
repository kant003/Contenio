# Contenio

CMS para varios clientes con **Next.js, TypeScript, Tailwind, Tiptap y PostgreSQL**. En producción: **Neon Postgres integrado en Vercel**, archivos privados en **Vercel Blob** y login con **Better Auth**. No utiliza Supabase.

El código de este proyecto se mantiene en `/Users/angel/workspaceNextJs/contenio`, con remoto `https://github.com/kant003/Contenio.git`.

## Arranque local

Necesitas Node 24 (`.nvmrc`), npm y Docker. El entorno local usa PostgreSQL estándar; no necesita cuentas en proveedores externos.

```sh
npm ci
npm run db:env
npm run db:start
npm run db:migrate
npm run db:seed
npm run dev
```

Abre http://localhost:3100. El seed crea un administrador, dos clientes y un editor por cliente. Las contraseñas son aleatorias y se guardan solo en `.env.test.local`, ignorado por Git. No se copia contenido ni credenciales de Contentful.

El buzón de pruebas para recuperar contraseñas está en http://localhost:58025. Los archivos privados locales se guardan en `.data/uploads`, fuera de Git. En Vercel se utiliza Blob privado, nunca el disco temporal de una función.

`db:migrate` crea el esquema de Better Auth y aplica las migraciones SQL versionadas con checksum y bloqueo de concurrencia. `db:seed` es idempotente y solo acepta una base local. No hay comandos que borren automáticamente una base remota.

## Funciones

- Espacios aislados mediante permisos de servidor y Row Level Security en PostgreSQL.
- Sin registro abierto. Administrador global y editores asignados por espacio.
- «Mi cuenta» para cambiar la contraseña y recuperación por correo con enlaces de un solo uso.
- Modelos configurables con campos compartidos o traducidos al español/gallego.
- Texto, editor enriquecido, números, booleanos, fechas, archivos y referencias.
- Autoguardado, guardado manual y control de conflictos. Ctrl/Cmd+S guarda.
- Publicaciones inmutables e independientes por idioma; editar borradores no cambia la web.
- Vista previa y JSON con selector Borrador/Publicado y resumen de campos con cambios.
- Imágenes JPEG, PNG, WebP, AVIF y PDF de hasta 10 MiB, con URLs firmadas de 15 minutos.
- API de lectura por espacio; claves revocables de las que solo se almacena el hash.

## Crear cuentas

En desarrollo se crean con `db:seed`. Para crear una cuenta administrada en otro entorno, establece `NEW_USER_EMAIL` y `NEW_USER_PASSWORD` en el entorno del proceso y ejecuta `npm run db:create-user`. No pases contraseñas como argumentos ni las guardes en Git. `NEW_USER_ADMIN=true` crea el primer administrador global; después se asignan editores por email desde Ajustes.

## Recuperar el acceso y cambiar la contraseña

«¿Has olvidado tu contraseña?» envía un enlace válido durante 30 minutos. La respuesta no confirma si una dirección está registrada. Un enlace caducado, utilizado o incompleto permite solicitar otro; también se comprueba su validez al enviar el formulario.

Desde **Mi cuenta**, disponible en la pantalla de espacios y dentro del panel, puedes cambiar la contraseña confirmando la actual. Las nuevas contraseñas tienen entre 12 y 128 caracteres y deben repetirse. Los errores se muestran junto a cada campo sin borrar lo escrito.

Recuperar la cuenta cierra todas las sesiones anteriores. Cambiar la contraseña desde Mi cuenta mantiene la sesión actual y cierra las demás. En desarrollo los correos llegan exclusivamente al buzón local Mailpit; en producción debes configurar las variables SMTP descritas en la guía de despliegue.

## API y web de ejemplo

Documentación en `/docs` y [docs/API.md](docs/API.md). Para el consumidor de ejemplo configura en variables del servidor:

```dotenv
CONTENT_API_URL=http://localhost:3100/api/v1
CONTENT_SPACE_ID=identificador-del-espacio
CONTENT_READ_KEY=clave-generada-en-ajustes
```

Publica una Página con slug `inicio` y abre `/demo/es/inicio`. Un idioma sin publicar devuelve 404. La clave de lectura no llega al navegador.

## Pruebas

Con la base y el servidor locales iniciados:

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:e2e
npm run build
```

Las pruebas usan exclusivamente PostgreSQL local y datos sintéticos; Playwright utiliza una instalación de Google Chrome con perfil aislado. Los tests comprueban RLS, API, conflictos, URLs firmadas, editor bilingüe, formularios dinámicos y recuperación/cambio de contraseña. Las pruebas de correo usan cuentas desechables, SMTP local y Mailpit; no cambian las contraseñas del seed. Respetan los límites reales de acceso HTTP y eliminan únicamente los mensajes de sus propias cuentas.

## Seguridad y arquitectura

La conexión PostgreSQL solo existe en el servidor. Las sesiones se validan con Better Auth. Cada consulta del CMS ejecuta una transacción con la identidad verificada y el rol `contenio_app` sin login; ese rol no puede leer contraseñas, sesiones ni hashes de claves, ni escribir directamente en las tablas. Las funciones SQL validan el espacio, los tipos de campo, las relaciones y las versiones.

La API usa una conexión privilegiada únicamente después de validar la clave de lectura y filtra todas las consultas por el espacio correspondiente. Los archivos están protegidos mediante firmas HMAC con caducidad y almacenamiento privado. Una URL ya emitida puede seguir funcionando hasta 15 minutos después de retirar una publicación; las nuevas peticiones a la API se rechazan inmediatamente.

En Vercel los archivos se suben directamente a Blob con autorización por espacio para respetar su límite de tamaño de las peticiones a funciones. Antes de registrarlos se verifica su contenido real. Una subida interrumpida antes de registrarse puede dejar un objeto huérfano que requiere limpieza.

El listado busca por título o slug y filtra por modelo, estado e idioma desde PostgreSQL. Entrega hasta 12 resúmenes por página, sin cargar cuerpos enriquecidos ni snapshots en el navegador. Los filtros, el orden y la página se conservan en la URL; el editor se abre en el idioma seleccionado. Las estadísticas muestran el total del espacio y el contador del listado muestra los resultados filtrados.

Escribe una búsqueda y pulsa Buscar o Enter. Cambiar un selector aplica los filtros y vuelve a la primera página. «Limpiar filtros» conserva el idioma y el orden. La API también filtra y pagina en PostgreSQL. Los selectores del editor también buscan y paginan en el servidor.

La biblioteca de archivos también entrega hasta 12 recursos por página. Permite buscar por nombre, descripción y texto alternativo en el idioma elegido, filtrar imágenes/PDF y ordenar por nombre, tamaño o fecha de subida. Los filtros quedan en la URL y las estadísticas muestran cantidad y tamaño total de los archivos registrados en el espacio. Ese tamaño no incluye objetos huérfanos ni otros espacios y no sustituye la medición de consumo de Vercel Blob.

Al subir un archivo se vuelve a los recientes, conservando el idioma, para que los filtros anteriores no oculten la subida. El diálogo de metadatos se abre en el idioma seleccionado. Eliminar el último archivo de una página vuelve automáticamente a una página válida. Las URLs privadas se generan solo para los archivos de la página visible.

En el editor, los botones de archivos y relaciones abren un selector con búsqueda y hasta 12 resultados por página. Las relaciones múltiples conservan la selección al buscar o cambiar de página; «Usar selección» confirma los cambios y «Cancelar» o Escape los descartan. Puedes desmarcar todas las referencias para vaciar la lista. Las imágenes de Tiptap usan el mismo selector, mostrando solo imágenes.

La carga inicial del editor consulta únicamente la entrada abierta y los archivos utilizados por su borrador o sus publicaciones actuales, en ambos idiomas. No carga los archivos que solo aparecen en publicaciones históricas. Las etiquetas de las referencias del borrador se recuperan sin sus cuerpos. El endpoint interno `/api/editor/spaces/{spaceId}/choices` requiere una sesión de editor o administrador y permisos sobre el espacio; no acepta claves públicas de lectura. Sus respuestas son privadas y no se almacenan en caché. Las búsquedas se pueden reintentar sin modificar el borrador.

## Fallos de guardado y conflictos

Si falla la conexión al guardar, los cambios permanecen en el editor y **Reintentar guardado** permite enviarlos otra vez. La navegación interna espera al guardado en curso y guarda las ediciones posteriores antes de salir. Un fallo cancela esa navegación y mantiene el contenido disponible.

Si otra sesión ha guardado la misma entrada, el editor bloquea nuevos guardados y publicaciones con la versión antigua. **Descargar mis cambios** crea un JSON local con los campos compartidos, ES/GL, el modelo y la versión desde la que se estaba editando. La copia incluye identificadores de archivos y referencias; no incluye los archivos, las sesiones ni las claves de lectura.

**Recargar entrada** pide confirmar antes de descartar los cambios locales. Puedes cancelar o descargar la copia también desde ese diálogo. Tras recargar verás la versión del servidor y podrás consultar el JSON para copiar lo que necesites. La copia se descarga manualmente; no hay importación ni fusión automática.

## Revisar antes de publicar

En **Vista previa** y **JSON**, el selector **Borrador / Publicado** permite comparar el contenido del editor con la publicación del idioma elegido. El borrador incluye cambios todavía sin guardar; cambiar de vista o versión no guarda ni publica. El resumen identifica los campos que difieren, incluidos campos compartidos y desactivados después de publicar.

La vista publicada usa exactamente los campos de la publicación vigente cargada al abrir la entrada o al publicar/retirar desde el editor. Conserva los campos desactivados y las imágenes retiradas del borrador mientras sigan en esa publicación. Al cambiar de idioma mantiene la versión elegida; un idioma sin publicación muestra un estado vacío, sin recurrir al otro idioma. Republicar o retirar actualiza ambas vistas.

El JSON publicado contiene el objeto `fields` de la API. Las referencias siguen siendo identificadores, sin expansión; la vista visual utiliza los metadatos actuales de los archivos y los nombres actuales de los campos. Esta vista ayuda a revisar el contenido; la web consumidora controla su presentación final.

## Despliegue

[Configuración de Neon, Blob y Vercel](docs/DEPLOYMENT.md). El código está preparado, pero no se han creado recursos cloud ni se ha desplegado: falta conectar tu cuenta y sus variables.

[Plan y estado de los hitos](docs/PLAN.md).
