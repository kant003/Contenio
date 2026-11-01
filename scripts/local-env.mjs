import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env.local")) {
  console.log("Se conserva .env.local existente.");
  process.exit(0);
}
const password = randomBytes(24).toString("hex");
writeFileSync(
  ".env.local",
  `DATABASE_URL=postgresql://contenio:${password}@127.0.0.1:55432/contenio\nBETTER_AUTH_SECRET=${randomBytes(48).toString("hex")}\nBETTER_AUTH_URL=http://localhost:3100\nNEXT_PUBLIC_SITE_URL=http://localhost:3100\nSMTP_HOST=127.0.0.1\nSMTP_PORT=51025\nMAIL_FROM=Contenio <acceso@contenio.local>\nSTORAGE_DRIVER=local\nCONTENT_API_URL=http://localhost:3100/api/v1\n`,
  { mode: 0o600 },
);
writeFileSync(".env", `LOCAL_DATABASE_PASSWORD=${password}\n`, { mode: 0o600 });
console.log(
  "Entorno local generado. Secretos aleatorios en archivos ignorados por Git.",
);
