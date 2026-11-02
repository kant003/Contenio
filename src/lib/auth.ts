import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import nodemailer from "nodemailer";
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "./auth-validation";
import { pool } from "./database";
let instance: ReturnType<typeof createAuth> | undefined;
function createAuth() {
  if (!process.env.BETTER_AUTH_SECRET)
    throw new Error("Falta BETTER_AUTH_SECRET");
  return betterAuth({
    appName: "Contenio",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3100",
    secret: process.env.BETTER_AUTH_SECRET,
    database: pool(),
    advanced: { database: { generateId: () => randomUUID() } },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        if (!process.env.SMTP_HOST)
          throw new Error("Configura SMTP para recuperar contraseñas");
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 10000,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === "true",
          ...(process.env.SMTP_USER
            ? {
                auth: {
                  user: process.env.SMTP_USER,
                  pass: process.env.SMTP_PASSWORD,
                },
              }
            : {}),
        });
        await transport.sendMail({
          from: process.env.MAIL_FROM ?? "Contenio <acceso@contenio.local>",
          to: user.email,
          subject: "Recupera tu acceso a Contenio",
          text: `Abre este enlace para elegir una contraseña nueva:\n\n${url}\n\nEl enlace caduca en 30 minutos y solo puede utilizarse una vez.\n\nSi no lo solicitaste, puedes ignorar este correo.`,
        });
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: "database" },
    plugins: [nextCookies()],
  });
}
export function getAuth() {
  return (instance ??= createAuth());
}

/** Read only the validity of a reset capability; Better Auth consumes it atomically on submission. */
export async function hasActiveResetToken(token: string) {
  if (!token || token.length > 256) return false;
  const result = await pool().query(
    `select 1 from verification v join "user" u on u.id=v.value where v.identifier=$1 and v."expiresAt">now() limit 1`,
    [`reset-password:${token}`],
  );
  return result.rows.length > 0;
}
