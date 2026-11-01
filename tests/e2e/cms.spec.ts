import { test, expect, type Page } from "@playwright/test";
import { pool } from "../../src/lib/database";
import { rpc, cleanSpaces } from "../helpers";
import { randomUUID } from "node:crypto";
const url = process.env.DATABASE_URL!;
const allowed =
  url && ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
test.skip(!allowed, "Solo PostgreSQL local");
let space: string;
let model: string;
const label = `Prueba E2E ${randomUUID().slice(0, 6)}`;
async function login(page: Page, prefix = "EDITOR") {
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env[`${prefix}_EMAIL`]!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env[`${prefix}_PASSWORD`]!);
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page).toHaveURL(/\/spaces$/);
  await expect(
    page.getByRole("heading", { name: "Tus espacios." }),
  ).toBeVisible();
}
test.beforeAll(async () => {
  space = await rpc(process.env.ADMIN_ID!, "create_space", {
    p_name: label,
    p_slug: `e2e-${randomUUID().slice(0, 8)}`,
  });
  await rpc(process.env.ADMIN_ID!, "set_member", {
    p_space: space,
    p_email: process.env.EDITOR_EMAIL,
  });
  const { rows } = await pool().query(
    "select id from content_types where space_id=$1",
    [space],
  );
  model = rows[0].id;
});
test.afterAll(async () => {
  await cleanSpaces(space ? [space] : []);
  await pool().end();
});
test("protege rutas sin sesión", async ({ page }) => {
  await page.goto(`/spaces/${space}/content`);
  await expect(page).toHaveURL(/\/login$/);
});
test("crear, traducir, subir imagen, publicar y consultar la API", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto(`/spaces/${space}/media`);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "prueba-e2e.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(
    page.getByRole("button", { name: /prueba-e2e.png/ }),
  ).toBeVisible();
  await page.goto(`/spaces/${space}/content/new?type=${model}`);
  await page.locator("#field-title").fill("Página de prueba");
  await page.locator("#field-slug").fill("pagina-prueba");
  await page
    .locator('.tiptap[aria-label="Contenido"]')
    .fill("Contenido en español.");
  const { rows: assets } = await pool().query(
    "select id from assets where space_id=$1",
    [space],
  );
  await page
    .getByLabel("Insertar imagen de la biblioteca")
    .selectOption(assets![0].id);
  await page.getByRole("button", { name: "GL", exact: true }).click();
  await page.locator("#field-title").fill("Páxina de proba");
  await page.locator("#field-slug").fill("paxina-proba");
  await page
    .locator('.tiptap[aria-label="Contenido"]')
    .fill("Contido en galego.");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page).toHaveURL(/\/content\/[a-f0-9-]{36}(\?locale=gl)?$/);
  const entryId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("button", { name: "Publicar en GL" }).click();
  await expect(page.locator(".publish-status .badge")).toHaveText("Publicado");
  await page.getByRole("button", { name: "ES", exact: true }).click();
  await expect(page.locator("#field-title")).toHaveValue("Página de prueba");
  await page.getByRole("button", { name: "Publicar en ES" }).click();
  await expect(page.locator(".publish-status .badge")).toHaveText("Publicado");
  await page.locator("#field-title").fill("Cambios todavía sin publicar");
  await expect(page.getByRole("status")).toContainText(
    "Todos los cambios guardados",
  );
  await expect(page.locator(".publish-status .badge")).toHaveText(
    "Cambios pendientes",
  );
  await page.reload();
  await expect(page.locator("#field-title")).toHaveValue(
    "Cambios todavía sin publicar",
  );
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await login(page, "ADMIN");
  await page.goto(`/spaces/${space}/settings`);
  await page.getByLabel("Nombre de la clave").fill("Prueba E2E");
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  const key = await page.getByTestId("new-api-key").textContent();
  expect(key).toMatch(/^ct_/);
  const response = await request.get(
    `/api/v1/spaces/${space}/entries/${entryId}?locale=es`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  expect(response.status()).toBe(200);
  expect((await response.json()).fields.title).toBe("Página de prueba");
  const gl = await request.get(
    `/api/v1/spaces/${space}/entries/${entryId}?locale=gl`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  expect((await gl.json()).fields.title).toBe("Páxina de proba");
  const asset = await request.get(
    `/api/v1/spaces/${space}/assets/${assets![0].id}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  expect(asset.status()).toBe(200);
});
test("editor no ve datos de otro cliente y el panel funciona en móvil", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/spaces/${process.env.SPACE_B}/content`);
  await expect(
    page.getByRole("heading", { name: "Este contenido no está disponible." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/spaces/${space}/content`);
  await expect(page.getByRole("heading", { name: "Contenido." })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("modelos dinámicos y gestión de accesos desde el panel", async ({
  page,
}) => {
  await login(page, "ADMIN");
  await page.goto(`/spaces/${space}/models`);
  await page.getByRole("button", { name: "Crear modelo", exact: true }).click();
  await page
    .locator(".model-basics")
    .getByLabel("Nombre", { exact: true })
    .fill("Noticia de prueba");
  await page
    .locator(".model-basics")
    .getByLabel("Identificador técnico")
    .fill("news");
  const field = page.locator(".schema-field").first();
  await field.getByLabel("Nombre", { exact: true }).fill("Título de noticia");
  await field.getByLabel("Identificador", { exact: true }).fill("title");
  await field.getByLabel("Obligatorio").check();
  await page.getByRole("button", { name: "Guardar modelo" }).click();
  await expect(
    page.getByRole("heading", { name: "Noticia de prueba", exact: true }),
  ).toBeVisible();
  const { rows: models } = await pool().query(
    "select id from content_types where space_id=$1 and key='news'",
    [space],
  );
  const model = models[0];
  await page.goto(`/spaces/${space}/content/new?type=${model!.id}`);
  await expect(
    page.getByLabel("Título de noticia", { exact: false }),
  ).toBeVisible();
  await page.goto(`/spaces/${space}/settings`);
  await page.getByLabel("Email del editor").fill(process.env.OTHER_EMAIL!);
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(page.locator(".member-list")).toContainText(
    process.env.OTHER_EMAIL!,
  );
  await page
    .getByRole("button", {
      name: `Retirar acceso a ${process.env.OTHER_EMAIL}`,
    })
    .click();
  await expect(page.locator(".member-list")).not.toContainText(
    process.env.OTHER_EMAIL!,
  );
});
