import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { newPasswordSchema, emailSchema } from "../src/lib/auth-validation";
import { pool } from "../src/lib/database";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const email = process.env.NEW_USER_EMAIL?.trim().toLowerCase(),
  password = process.env.NEW_USER_PASSWORD;
if (
  !email ||
  !password ||
  !emailSchema.safeParse(email).success ||
  !newPasswordSchema.safeParse(password).success
)
  throw new Error(
    "Define NEW_USER_EMAIL y NEW_USER_PASSWORD (entre 12 y 128 caracteres) en el entorno, nunca como argumentos.",
  );
const db = pool(),
  client = await db.connect();
try {
  await client.query("begin");
  const id = randomUUID();
  await client.query(
    'insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,$2,$3,true,now(),now())',
    [id, email.split("@")[0], email],
  );
  await client.query(
    'insert into account(id,"accountId","providerId","userId",password,"createdAt","updatedAt") values($1,$2,\'credential\',$2,$3,now(),now())',
    [randomUUID(), id, await hashPassword(password)],
  );
  if (process.env.NEW_USER_ADMIN === "true")
    await client.query("insert into platform_admins(user_id) values($1)", [id]);
  await client.query("commit");
  console.log("Cuenta creada. Añádela a un espacio desde Ajustes.");
} catch (e) {
  await client.query("rollback");
  throw e;
} finally {
  client.release();
  await db.end();
}
