import { storeAsset } from "../../src/lib/storage";
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

test.describe("listado con filtros y paginación del servidor", () => {
  let listingSpace: string;
  test.beforeAll(async () => {
    listingSpace = await rpc(process.env.ADMIN_ID!, "create_space", {
      p_name: "Biblioteca de prueba",
      p_slug: `listado-e2e-${randomUUID()}`,
    });
    await rpc(process.env.ADMIN_ID!, "set_member", {
      p_space: listingSpace,
      p_email: process.env.EDITOR_EMAIL,
    });
    const { rows } = await pool().query(
      "select id from content_types where space_id=$1",
      [listingSpace],
    );
    for (let i = 1; i <= 17; i++) {
      const number = String(i).padStart(2, "0");
      const entry = await rpc(process.env.ADMIN_ID!, "save_entry", {
        p_space: listingSpace,
        p_type: rows[0].id,
        p_id: null,
        p_version: 0,
        p_shared: {},
        p_translations: {
          es: {
            title: `Artículo ${number}`,
            slug: `articulo-${number}`,
            body: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "CUERPO_QUE_NO_DEBE_VIAJAR_EN_EL_LISTADO",
                    },
                  ],
                },
              ],
            },
          },
          gl: {
            title: `Artigo ${number}`,
            slug: `artigo-${number}`,
            body: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Contido de proba" }],
                },
              ],
            },
          },
        },
      });
      if (i <= 2)
        await rpc(process.env.ADMIN_ID!, "publish_entry", {
          p_space: listingSpace,
          p_id: entry.id,
          p_locale: "gl",
          p_version: entry.version,
        });
    }
  });
  test.afterAll(async () => {
    await cleanSpaces(listingSpace ? [listingSpace] : []);
  });

  test("mantiene filtros, idioma y página al recargar, volver y abrir el editor", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`/spaces/${listingSpace}/content?locale=gl&sort=name`);
    await expect(page.locator(".entry-table tbody tr")).toHaveCount(12);
    await expect(page.locator(".pagination")).toContainText(
      "1–12 de 17 entradas",
    );
    const html = await (await page.request.get(page.url())).text();
    expect(html).not.toContain("CUERPO_QUE_NO_DEBE_VIAJAR_EN_EL_LISTADO");
    await page.getByRole("button", { name: "Página siguiente" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator(".entry-table tbody tr")).toHaveCount(5);
    await page.getByLabel("Estado", { exact: true }).selectOption("draft");
    await expect(page).toHaveURL(/status=draft/);
    expect(new URL(page.url()).searchParams.has("page")).toBe(false);
    await expect(page.locator(".pagination")).toContainText(
      "1–12 de 15 entradas",
    );
    await page.getByRole("button", { name: "Página siguiente" }).click();
    await expect(page.locator(".entry-table tbody tr")).toHaveCount(3);
    await page.reload();
    await expect(page.getByLabel("Estado", { exact: true })).toHaveValue(
      "draft",
    );
    await expect(page.getByLabel("Idioma del listado")).toHaveValue("gl");
    await expect(page.locator(".pagination")).toContainText(
      "13–15 de 15 entradas",
    );
    await page.goBack();
    await expect(page.locator(".pagination")).toContainText(
      "1–12 de 15 entradas",
    );
    await page.getByLabel("Buscar contenido").fill("Artigo 17");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page.locator(".entry-table tbody tr")).toHaveCount(1);
    await page
      .getByRole("link", { name: "Editar Artigo 17", exact: true })
      .click();
    await expect(page).toHaveURL(/locale=gl/);
    await expect(page.locator("#field-title")).toHaveValue("Artigo 17");
    await page.goBack();
    await expect(page.getByLabel("Buscar contenido")).toHaveValue("Artigo 17");
    await page.getByRole("link", { name: "Limpiar filtros" }).click();
    await expect(page.locator(".pagination")).toContainText(
      "1–12 de 17 entradas",
    );
    await expect(page.getByLabel("Idioma del listado")).toHaveValue("gl");
  });

  test("resuelve páginas fuera de rango y ofrece salida a búsquedas vacías", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`/spaces/${listingSpace}/content?page=999999`);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator(".entry-table tbody tr")).toHaveCount(5);
    await page.getByLabel("Buscar contenido").fill("No existe esta entrada");
    await page.getByLabel("Buscar contenido").press("Enter");
    await expect(
      page.getByRole("heading", { name: "No encontramos ese contenido" }),
    ).toBeVisible();
    await expect(page.locator(".pagination")).toContainText("Sin entradas");
    await expect(
      page.getByRole("button", { name: "Página siguiente" }),
    ).toBeDisabled();
    await page.getByRole("link", { name: "Limpiar filtros" }).click();
    await expect(page.locator(".entry-table tbody tr")).toHaveCount(12);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });
});

test.describe("biblioteca paginada", () => {
  let mediaSpace: string;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    "base64",
  );
  test.beforeAll(async () => {
    mediaSpace = await rpc(process.env.ADMIN_ID!, "create_space", {
      p_name: "Biblioteca paginada",
      p_slug: `media-e2e-${randomUUID()}`,
    });
    await rpc(process.env.ADMIN_ID!, "set_member", {
      p_space: mediaSpace,
      p_email: process.env.EDITOR_EMAIL,
    });
    for (let i = 1; i <= 13; i++) {
      const id = randomUUID(),
        image = i <= 2,
        mime = image ? "image/png" : "application/pdf",
        name = `Recurso ${String(i).padStart(2, "0")}.${image ? "png" : "pdf"}`;
      const bytes = image ? png : Buffer.from("%PDF-1.7\n%%EOF");
      const url = await storeAsset(mediaSpace, id, bytes, mime);
      await rpc(process.env.ADMIN_ID!, "register_asset", {
        p_space: mediaSpace,
        p_id: id,
        p_name: name,
        p_mime: mime,
        p_size: bytes.length,
        p_storage_url: url,
      });
      if (i === 1)
        await rpc(process.env.ADMIN_ID!, "update_asset", {
          p_space: mediaSpace,
          p_id: id,
          p_name: name,
          p_alt: { es: "Bosque", gl: "Fraga" },
          p_description: {
            es: "Descripción española",
            gl: "Portada galega exclusiva",
          },
        });
    }
  });
  test.afterAll(async () => {
    await cleanSpaces(mediaSpace ? [mediaSpace] : []);
  });

  test("busca por metadatos traducidos y conserva filtros, página e idioma", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`/spaces/${mediaSpace}/media?locale=gl&sort=name`);
    await expect(page.locator(".asset-card")).toHaveCount(12);
    await expect(page.locator(".pagination")).toContainText(
      "1–12 de 13 archivos",
    );
    await page
      .getByRole("button", { name: "Página siguiente de archivos" })
      .click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator(".asset-card")).toHaveCount(1);
    await page.reload();
    await expect(page.locator(".pagination")).toContainText(
      "13–13 de 13 archivos",
    );
    await expect(page.getByLabel("Idioma de los archivos")).toHaveValue("gl");
    await page.getByLabel("Tipo de archivo").selectOption("image");
    await expect(page.locator(".asset-card")).toHaveCount(2);
    expect(new URL(page.url()).searchParams.has("page")).toBe(false);
    await page.getByLabel("Buscar archivos").fill("Portada galega");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page.locator(".asset-card")).toHaveCount(1);
    await page.getByRole("button", { name: /Recurso 01.png/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("combobox", { name: "Idioma", exact: true }),
    ).toHaveValue("gl");
    await dialog.getByLabel("Texto alternativo").fill("Texto alternativo GL");
    await dialog
      .getByRole("textbox", { name: "Descripción", exact: true })
      .fill("Descrición cambiada");
    await dialog
      .getByRole("combobox", { name: "Idioma", exact: true })
      .selectOption("es");
    await dialog.getByLabel("Texto alternativo").fill("Texto alternativo ES");
    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No encontramos esos archivos" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Limpiar filtros" }).click();
    await expect(page.locator(".asset-card")).toHaveCount(12);
    await page.getByRole("button", { name: /Recurso 01.png/ }).click();
    await expect(dialog.getByLabel("Texto alternativo")).toHaveValue(
      "Texto alternativo GL",
    );
    await dialog
      .getByRole("combobox", { name: "Idioma", exact: true })
      .selectOption("es");
    await expect(dialog.getByLabel("Texto alternativo")).toHaveValue(
      "Texto alternativo ES",
    );
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await page.goBack();
    await expect(page.getByLabel("Buscar archivos")).toHaveValue(
      "Portada galega",
    );
    await expect(page.getByLabel("Tipo de archivo")).toHaveValue("image");
  });

  test("elimina la última página y muestra las subidas aunque hubiera filtros", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`/spaces/${mediaSpace}/media?sort=name&page=2`);
    await expect(page.locator(".asset-card")).toHaveCount(1);
    await page.getByRole("button", { name: /Recurso 13.pdf/ }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator(".pagination")).toContainText(
      "1–12 de 12 archivos",
    );
    expect(new URL(page.url()).searchParams.has("page")).toBe(false);
    await page.goto(
      `/spaces/${mediaSpace}/media?q=inexistente&kind=pdf&locale=gl`,
    );
    await expect(
      page.getByRole("heading", { name: "No encontramos esos archivos" }),
    ).toBeVisible();
    await page.getByLabel("Seleccionar archivo").setInputFiles({
      name: "nueva-imagen.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(0),
    });
    await expect(
      page.getByRole("alert").filter({ hasText: "hasta 10 MiB" }),
    ).toBeVisible();
    await expect(page.getByLabel("Seleccionar archivo")).toHaveValue("");
    await page.getByLabel("Seleccionar archivo").setInputFiles({
      name: "nueva-imagen.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(page).toHaveURL(
      new RegExp(`/spaces/${mediaSpace}/media\\?locale=gl$`),
    );
    await expect(
      page.getByRole("button", { name: /nueva-imagen.png/ }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Archivo subido correctamente" }),
    ).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath("biblioteca-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: test.info().outputPath("biblioteca-mobile.png"),
      fullPage: true,
    });
  });
});
