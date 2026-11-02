# Despliegue con Vercel, Neon Postgres y Blob

Vercel aloja la aplicación Next.js. PostgreSQL se aprovisiona con la integración nativa de **Neon** desde el Marketplace de Vercel; no se usa la antigua Vercel Postgres ni Supabase. Blob guarda los archivos privados. Better Auth almacena usuarios y sesiones en el mismo PostgreSQL.

## Configuración

1. Importa `kant003/Contenio` en Vercel (Next.js, Node 24). Este paso aún no se ha ejecutado.
2. En Storage / Marketplace, añade Neon Postgres y conéctalo al proyecto. Configura `DATABASE_URL` con su conexión pooled y, para migraciones, `DATABASE_URL_UNPOOLED` cuando esté disponible. Sitúa base y funciones en una región europea próxima.
3. Mantén bases o ramas independientes para Production y Preview. Nunca conectar previews a la base de clientes.
4. Crea un almacén **privado** de Vercel Blob y conecta `BLOB_READ_WRITE_TOKEN`. Establece `NEXT_PUBLIC_BLOB_UPLOADS=true` para habilitar las subidas directas autorizadas de hasta 10 MiB. Separa también los archivos de desarrollo y producción.
5. Genera un `BETTER_AUTH_SECRET` de alta entropía (mínimo 32 caracteres), y define `BETTER_AUTH_URL` y `NEXT_PUBLIC_SITE_URL` con el dominio HTTPS exacto. No crear secretos con prefijo NEXT_PUBLIC_.
6. Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` y `MAIL_FROM` para los correos de recuperación. No habilites el registro público. Los enlaces de recuperación duran 30 minutos y usan el dominio de `BETTER_AUTH_URL`; confirma la entrega real y las URLs HTTPS antes de habilitar el acceso a clientes.
7. Aplica `npm run db:migrate` con las variables del entorno correcto, antes del primer arranque de producción. El usuario migrador necesita crear el rol `contenio_app`, otorgárselo y crear tablas y funciones. La integración Neon estándar permite administrar roles; si se usa un usuario de base restringido, el administrador debe preparar ese rol y los permisos primero.
8. Crea el primer administrador con `db:create-user`, usando variables de entorno temporales `NEW_USER_EMAIL`, `NEW_USER_PASSWORD` y `NEW_USER_ADMIN=true`. No incluyas contraseñas en argumentos, documentación ni commits.
9. Crea los espacios y las cuentas editoras. Asigna cada editor desde Ajustes y genera una clave por web consumidora.
10. Verifica login/logout, recuperación (enlace caducado y de un solo uso), cambio desde Mi cuenta y cierre de otras sesiones, ES/GL, aislamiento entre dos clientes, subidas pequeñas y mayores de 4.5 MiB, publicación, API y revocación en el dominio definitivo.

## Operación

- Ejecuta tipos, lint, pruebas y build antes de desplegar. Los tests automatizados nunca se ejecutan contra una base remota.
- Revisa registros de Vercel y Neon sin registrar contraseñas, tokens ni claves completas. Better Auth conserva sus límites de peticiones en PostgreSQL.
- Conserva copias de la base y de los objetos de Blob. Confirma las opciones de recuperación del plan contratado y prueba la restauración en otro entorno.
- Para una incidencia de código, vuelve al despliegue anterior en Vercel. Esto no revierte migraciones; los cambios de esquema deben mantenerse compatibles o acompañarse de una nueva migración.
- No edites migraciones ya aplicadas: sus checksums se verifican antes de continuar. Prueba primero en una rama de desarrollo de Neon.
- Revisa subidas huérfanas si el navegador falla tras subir a Blob y antes de registrar el archivo. No borres objetos referenciados por borradores o historial publicado.
- Una URL firmada ya emitida dura hasta 15 minutos. Revocar claves impide nuevas lecturas inmediatamente.

## Pendiente de acceso externo

No se han creado bases Neon, almacenes Blob, dominios ni despliegues remotos. Los pasos cloud se completarán cuando estén disponibles los accesos de Vercel. Para uso comercial con clientes hay que elegir un plan de alojamiento apropiado.

Referencias: [Postgres en Vercel](https://vercel.com/docs/postgres), [almacenamiento de Vercel](https://vercel.com/docs/storage), [Better Auth con Next.js](https://better-auth.com/docs/integrations/next).
