import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import nodemailer from "nodemailer";
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
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        if (!process.env.SMTP_HOST)
          throw new Error("Configura SMTP para recuperar contraseñas");
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
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
          text: `Abre este enlace para elegir una contraseña nueva:\n\n${url}\n\nSi no lo solicitaste, puedes ignorar este correo.`,
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
