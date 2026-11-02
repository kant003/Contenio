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
- Modelos configurables con campos compartidos o traducidos al español/gallego.
- Texto, editor enriquecido, números, booleanos, fechas, archivos y referencias.
- Autoguardado, guardado manual y control de conflictos. Ctrl/Cmd+S guarda.
- Publicaciones inmutables e independientes por idioma; editar borradores no cambia la web.
- Imágenes JPEG, PNG, WebP, AVIF y PDF de hasta 10 MiB, con URLs firmadas de 15 minutos.
- API de lectura por espacio; claves revocables de las que solo se almacena el hash.

## Crear cuentas

En desarrollo se crean con `db:seed`. Para crear una cuenta administrada en otro entorno, establece `NEW_USER_EMAIL` y `NEW_USER_PASSWORD` en el entorno del proceso y ejecuta `npm run db:create-user`. No pases contraseñas como argumentos ni las guardes en Git. `NEW_USER_ADMIN=true` crea el primer administrador global; después se asignan editores por email desde Ajustes.

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

Las pruebas usan exclusivamente PostgreSQL local y datos sintéticos; Playwright utiliza una instalación de Google Chrome con perfil aislado. Los tests comprueban RLS, API, conflictos, URLs firmadas, editor bilingüe y formularios dinámicos.

## Seguridad y arquitectura

La conexión PostgreSQL solo existe en el servidor. Las sesiones se validan con Better Auth. Cada consulta del CMS ejecuta una transacción con la identidad verificada y el rol `contenio_app` sin login; ese rol no puede leer contraseñas, sesiones ni hashes de claves, ni escribir directamente en las tablas. Las funciones SQL validan el espacio, los tipos de campo, las relaciones y las versiones.

La API usa una conexión privilegiada únicamente después de validar la clave de lectura y filtra todas las consultas por el espacio correspondiente. Los archivos están protegidos mediante firmas HMAC con caducidad y almacenamiento privado. Una URL ya emitida puede seguir funcionando hasta 15 minutos después de retirar una publicación; las nuevas peticiones a la API se rechazan inmediatamente.

En Vercel los archivos se suben directamente a Blob con autorización por espacio para respetar su límite de tamaño de las peticiones a funciones. Antes de registrarlos se verifica su contenido real. Una subida interrumpida antes de registrarse puede dejar un objeto huérfano que requiere limpieza.

El listado busca por título o slug y filtra por modelo, estado e idioma desde PostgreSQL. Entrega hasta 12 resúmenes por página, sin cargar cuerpos enriquecidos ni snapshots en el navegador. Los filtros, el orden y la página se conservan en la URL; el editor se abre en el idioma seleccionado. Las estadísticas muestran el total del espacio y el contador del listado muestra los resultados filtrados.

Escribe una búsqueda y pulsa Buscar o Enter. Cambiar un selector aplica los filtros y vuelve a la primera página. «Limpiar filtros» conserva el idioma y el orden. La API también filtra y pagina en PostgreSQL. Los selectores de referencias del editor y la biblioteca de archivos aún cargan todas las opciones autorizadas; su paginación queda para un próximo avance.

## Despliegue

[Configuración de Neon, Blob y Vercel](docs/DEPLOYMENT.md). El código está preparado, pero no se han creado recursos cloud ni se ha desplegado: falta conectar tu cuenta y sus variables.

[Plan y estado de los hitos](docs/PLAN.md).
