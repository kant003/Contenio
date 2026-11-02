import {
  test as base,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { Pool } from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { hashPassword } from "better-auth/crypto";
const origin = "http://localhost:3100",
  mailpit = "http://127.0.0.1:58025";
const local =
  process.env.DATABASE_URL &&
  ["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  ) &&
  ["localhost", "127.0.0.1"].includes(process.env.SMTP_HOST ?? "") &&
  process.env.SMTP_PORT === "51025";
const database = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
interface Account {
  id: string;
  email: string;
  password: string;
  seen: Set<string>;
}
async function messages(email: string) {
  const response = await fetch(
    `${mailpit}/api/v1/search?${new URLSearchParams({ query: `to:${email}`, limit: "100" })}`,
  );
  if (!response.ok) throw new Error("El buzón local no está disponible");
  const data = (await response.json()) as {
    messages: { ID: string; To: { Address: string }[] }[];
  };
  return data.messages.filter((message) =>
    message.To.some((recipient) => recipient.Address === email),
  );
}
async function resetLink(account: Account) {
  let id = "";
  await expect
    .poll(async () => {
      id =
        (await messages(account.email)).find(
          (message) => !account.seen.has(message.ID),
        )?.ID ?? "";
      return Boolean(id);
    })
    .toBe(true);
  account.seen.add(id);
  const message = (await (
    await fetch(`${mailpit}/api/v1/message/${encodeURIComponent(id)}`)
  ).json()) as { Text: string; Subject: string };
  expect(message.Subject).toBe("Recupera tu acceso a Contenio");
  expect(message.Text).toContain("30 minutos");
  const raw = message.Text.match(/https?:\/\/\S+/)?.[0];
  if (!raw)
    throw new Error("El correo local no contiene el enlace de recuperación");
  const url = new URL(raw);
  expect(url.origin).toBe(origin);
  expect(url.pathname.startsWith("/api/auth/reset-password/")).toBe(true);
  return url;
}
const test = base.extend<{ account: Account }>({
  account: async ({ request }, provideAccount) => {
    expect((await request.get(`${mailpit}/api/v1/info`)).ok()).toBe(true);
    const account = {
      id: randomUUID(),
      email: `auth-${randomUUID()}@contenio.local`,
      password: randomBytes(24).toString("base64url"),
      seen: new Set<string>(),
    };
    const client = await database.connect();
    try {
      await client.query("begin");
      await client.query(
        'insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,\'Cuenta de prueba\',$2,true,now(),now())',
        [account.id, account.email],
      );
      await client.query(
        'insert into account(id,"accountId","providerId","userId",password,"createdAt","updatedAt") values($1,$2,\'credential\',$2,$3,now(),now())',
        [randomUUID(), account.id, await hashPassword(account.password)],
      );
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
    try {
      await provideAccount(account);
    } finally {
      const owned = await messages(account.email);
      const ids = owned.map((message) => message.ID);
      if (ids.length)
        await fetch(`${mailpit}/api/v1/messages`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ IDs: ids }),
        });
      await database.query("delete from verification where value=$1", [
        account.id,
      ]);
      await database.query('delete from session where "userId"=$1', [
        account.id,
      ]);
      await database.query('delete from account where "userId"=$1', [
        account.id,
      ]);
      await database.query('delete from "user" where id=$1', [account.id]);
    }
  },
});
test.skip(
  !local,
  "Las pruebas de recuperación solo usan PostgreSQL y SMTP locales",
);
test.afterAll(async () => {
  await database.end();
});
// Respect the real HTTP login limit; never disable it or treat 429 as a bad password.
async function signIn(
  request: APIRequestContext,
  account: Account,
  password = account.password,
) {
  const send = () =>
    request.post(`${origin}/api/auth/sign-in/email`, {
      data: { email: account.email, password },
      headers: { Origin: origin },
    });
  let response = await send();
  if (response.status() === 429) {
    const seconds = Number(response.headers()["x-retry-after"]);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(10);
    await delay((seconds + 0.1) * 1000);
    response = await send();
  }
  return response;
}
async function login(
  page: Page,
  account: Account,
  password = account.password,
) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page).toHaveURL(/\/spaces$/);
}
async function requestRecovery(page: Page, account: Account) {
  await page.goto("/forgot-password");
  await page
    .getByLabel("Email", { exact: true })
    .fill(account.email.toUpperCase());
  await page
    .getByRole("button", { name: "Enviar enlace", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Si la cuenta existe");
  return resetLink(account);
}

test("recupera por correo, rechaza reutilización y cierra las sesiones anteriores", async ({
  page,
  browser,
  account,
}) => {
  const first = await browser.newContext({ baseURL: origin }),
    second = await browser.newContext({ baseURL: origin });
  try {
    for (const context of [first, second])
      expect((await signIn(context.request, account)).ok()).toBe(true);
    const link = await requestRecovery(page, account);
    const generic = await page.getByRole("status").textContent();
    const unknown = `unknown-${randomUUID()}@contenio.local`;
    await page.getByLabel("Email", { exact: true }).fill(unknown);
    await page
      .getByRole("button", { name: "Enviar enlace", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(generic!);
    expect(await messages(unknown)).toHaveLength(0);
    await page.goto(link.href);
    await expect(
      page.getByRole("heading", { name: "Una nueva contraseña." }),
    ).toBeVisible();
    const response = await page.request.get(page.url());
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    const password = randomBytes(24).toString("base64url");
    await page.getByLabel("Nueva contraseña", { exact: true }).fill(password);
    await page
      .getByLabel("Repite la contraseña", { exact: true })
      .fill(randomBytes(24).toString("base64url"));
    await page
      .getByRole("button", { name: "Actualizar contraseña", exact: true })
      .click();
    await expect(
      page.getByText("Las contraseñas no coinciden.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Nueva contraseña", { exact: true }),
    ).toHaveValue(password);
    expect(
      await (await first.request.get("/api/auth/get-session")).json(),
    ).not.toBeNull();
    await page
      .getByLabel("Repite la contraseña", { exact: true })
      .fill(password);
    await page
      .getByRole("button", { name: "Actualizar contraseña", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Contraseña actualizada",
    );
    await expect(
      page.getByRole("button", { name: "Actualizar contraseña", exact: true }),
    ).toHaveCount(0);
    for (const context of [first, second])
      expect(
        await (await context.request.get("/api/auth/get-session")).json(),
      ).toBeNull();
    await page.goto(link.href);
    await expect(
      page.getByRole("heading", { name: "Este enlace ya no es válido." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Solicitar otro enlace" }),
    ).toHaveAttribute("href", "/forgot-password");
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "No hemos podido iniciar sesión" }),
    ).toBeVisible();
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
    await expect(page).toHaveURL(/\/spaces$/);
  } finally {
    await first.close();
    await second.close();
  }
});

test("explica enlaces caducados al abrirlos o mientras se completa el formulario", async ({
  page,
  account,
}) => {
  const link = await requestRecovery(page, account);
  const token = link.pathname.split("/").at(-1)!;
  const { rows } = await database.query(
    'select "expiresAt" from verification where identifier=$1',
    [`reset-password:${token}`],
  );
  const remaining = new Date(rows[0].expiresAt).getTime() - Date.now();
  expect(remaining).toBeGreaterThan(29 * 60 * 1000);
  expect(remaining).toBeLessThanOrEqual(30 * 60 * 1000);
  await database.query(
    "update verification set \"expiresAt\"=now()-interval '1 minute' where identifier=$1",
    [`reset-password:${token}`],
  );
  await page.goto(link.href);
  await expect(
    page.getByRole("heading", { name: "Este enlace ya no es válido." }),
  ).toBeVisible();
  const fresh = await requestRecovery(page, account);
  await page.goto(fresh.href);
  await expect(
    page.getByLabel("Nueva contraseña", { exact: true }),
  ).toBeVisible();
  await database.query(
    "update verification set \"expiresAt\"=now()-interval '1 minute' where identifier=$1",
    [`reset-password:${fresh.pathname.split("/").at(-1)}`],
  );
  const password = randomBytes(24).toString("base64url");
  await page.getByLabel("Nueva contraseña", { exact: true }).fill(password);
  await page.getByLabel("Repite la contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Actualizar contraseña", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Este enlace ya no es válido." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: test.info().outputPath("recuperacion-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Solicitar otro enlace" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await login(page, account);
});

test("permite cambiar desde Mi cuenta y conserva solo la sesión actual", async ({
  page,
  browser,
  account,
}) => {
  const other = await browser.newContext({ baseURL: origin });
  try {
    expect((await signIn(other.request, account)).ok()).toBe(true);
    await login(page, account);
    await page.getByRole("link", { name: "Mi cuenta", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByLabel("Contraseña actual", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: test.info().outputPath("mi-cuenta-mobile.png"),
      fullPage: true,
    });
    const password = randomBytes(24).toString("base64url");
    await page
      .getByLabel("Contraseña actual", { exact: true })
      .fill(randomBytes(24).toString("base64url"));
    await page.getByLabel("Nueva contraseña", { exact: true }).fill(password);
    await page
      .getByLabel("Repite la contraseña", { exact: true })
      .fill(password);
    await page
      .getByRole("button", { name: "Actualizar contraseña", exact: true })
      .click();
    await expect(
      page.getByText("Revisa tu contraseña actual.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Contraseña actual", { exact: true }),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByLabel("Nueva contraseña", { exact: true }),
    ).toHaveValue(password);
    expect(
      await (await other.request.get("/api/auth/get-session")).json(),
    ).not.toBeNull();
    await page
      .getByLabel("Contraseña actual", { exact: true })
      .fill(account.password);
    await page
      .getByRole("button", { name: "Actualizar contraseña", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Tu sesión sigue abierta",
    );
    expect(
      await (await page.request.get("/api/auth/get-session")).json(),
    ).not.toBeNull();
    expect(
      await (await other.request.get("/api/auth/get-session")).json(),
    ).toBeNull();
    await page.getByRole("link", { name: "Volver a mis espacios" }).click();
    await expect(page).toHaveURL(/\/spaces$/);
    const rejected = await signIn(other.request, account);
    expect(rejected.status()).toBe(401);
    const accepted = await signIn(other.request, account, password);
    expect(accepted.ok()).toBe(true);
  } finally {
    await other.close();
  }
});

test("consume el enlace una sola vez ante dos peticiones simultáneas", async ({
  page,
  request,
  account,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
  const link = await requestRecovery(page, account);
  const token = link.pathname.split("/").at(-1)!;
  const passwords = [
    randomBytes(24).toString("base64url"),
    randomBytes(24).toString("base64url"),
  ];
  const responses = await Promise.all(
    passwords.map((newPassword) =>
      request.post(`${origin}/api/auth/reset-password`, {
        data: { token, newPassword },
        headers: { Origin: origin },
      }),
    ),
  );
  expect(responses.map((response) => response.status()).sort()).toEqual([
    200, 400,
  ]);
  const winner = responses.findIndex((response) => response.ok());
  const success = await signIn(request, account, passwords[winner]);
  expect(success.ok()).toBe(true);
  const failed = await signIn(request, account, passwords[1 - winner]);
  expect(failed.status()).toBe(401);
});
