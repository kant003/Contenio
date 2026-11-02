"use server";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { fileTypeFromBuffer } from "file-type";
import { session, adminSession } from "@/lib/session";
import { getAuth } from "@/lib/auth";
import { userQuery } from "@/lib/database";
import { authHeaders } from "@/lib/auth-headers";
import { storeAsset, removeAssetObject, inspectBlob } from "@/lib/storage";
import type { Asset } from "@/lib/types";
import type { Entry, Field, Locale, Result, Values } from "@/lib/types";
import {
  emailSchema,
  passwordsSchema,
  changePasswordSchema,
  authValidationError,
  type AuthState,
} from "@/lib/auth-validation";
const id = z.uuid();
async function result<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { data: await fn() };
  } catch (e) {
    unstable_rethrow(e);
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e && "message" in e
          ? String(e.message)
          : "No se pudo completar la operación";
    return {
      error: msg.includes("duplicate key")
        ? "Ya existe otro registro con ese identificador o slug."
        : msg,
    };
  }
}
export async function loginAction(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success)
    return {
      status: "error",
      message: "Revisa los campos indicados.",
      errors: { email: "Introduce un email válido." },
    };
  try {
    await getAuth().api.signInEmail({
      body: { email: email.data, password: String(form.get("password") ?? "") },
      headers: await authHeaders(),
    });
  } catch {
    return {
      status: "error",
      message: "No hemos podido iniciar sesión. Revisa tu email y contraseña.",
    };
  }
  redirect("/spaces");
}
export async function logoutAction() {
  await getAuth().api.signOut({ headers: await authHeaders() });
  redirect("/login");
}
export async function recoveryAction(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success)
    return {
      status: "error",
      message: "Revisa los campos indicados.",
      errors: { email: "Introduce un email válido." },
    };
  if (!process.env.SMTP_HOST)
    return {
      status: "error",
      message:
        "El correo de recuperación no está disponible. Inténtalo más tarde.",
    };
  try {
    await getAuth().api.requestPasswordReset({
      body: {
        email: email.data,
        redirectTo: `${getAuth().options.baseURL}/reset-password`,
      },
      headers: await authHeaders(),
    });
  } catch {
    return {
      status: "error",
      message: "No se pudo enviar el enlace. Inténtalo más tarde.",
    };
  }
  return {
    status: "success",
    message:
      "Si la cuenta existe, recibirás un enlace para recuperar el acceso.",
  };
}
function authErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "body" in error &&
    error.body &&
    typeof error.body === "object" &&
    "code" in error.body
  )
    return error.body.code;
}
export async function resetPasswordAction(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const values = passwordsSchema.safeParse(Object.fromEntries(form));
  if (!values.success) return authValidationError(values.error);
  const token = z.string().min(1).max(256).safeParse(form.get("resetToken"));
  if (!token.success)
    return {
      status: "error",
      message: "Este enlace ya no es válido. Solicita uno nuevo.",
      invalidLink: true,
    };
  try {
    await getAuth().api.resetPassword({
      body: { token: token.data, newPassword: values.data.password },
      headers: await authHeaders(),
    });
  } catch (error) {
    unstable_rethrow(error);
    if (
      ["INVALID_TOKEN", "USER_NOT_FOUND"].includes(String(authErrorCode(error)))
    )
      return {
        status: "error",
        message:
          "Este enlace ya no es válido o ha caducado. Solicita uno nuevo.",
        invalidLink: true,
      };
    return {
      status: "error",
      message: "No se pudo actualizar la contraseña. Inténtalo de nuevo.",
    };
  }
  return {
    status: "success",
    message:
      "Contraseña actualizada. Inicia sesión con tu nueva contraseña. Las sesiones anteriores se han cerrado.",
  };
}
export async function changePasswordAction(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  await session();
  const values = changePasswordSchema.safeParse(Object.fromEntries(form));
  if (!values.success) return authValidationError(values.error);
  try {
    await getAuth().api.changePassword({
      body: {
        currentPassword: values.data.currentPassword,
        newPassword: values.data.password,
        revokeOtherSessions: true,
      },
      headers: await authHeaders(),
    });
  } catch (error) {
    unstable_rethrow(error);
    if (authErrorCode(error) === "INVALID_PASSWORD")
      return {
        status: "error",
        message: "No se pudo cambiar la contraseña.",
        errors: { currentPassword: "Revisa tu contraseña actual." },
      };
    return {
      status: "error",
      message:
        "No se pudo cambiar la contraseña. Inténtalo de nuevo o solicita un enlace de recuperación.",
    };
  }
  return {
    status: "success",
    message:
      "Contraseña actualizada. Tu sesión sigue abierta y las demás sesiones se han cerrado.",
  };
}
export async function createSpaceAction(name: string, slug: string) {
  return result(async () => {
    const { db } = await adminSession();
    const { data, error } = await db.rpc("create_space", {
      p_name: z.string().trim().min(1).max(100).parse(name),
      p_slug: z
        .string()
        .regex(/^[a-z0-9][a-z0-9-]{1,79}$/)
        .parse(slug),
    });
    if (error) throw error;
    revalidatePath("/spaces");
    return String(data);
  });
}
export async function memberAction(
  space: string,
  email: string,
  remove = false,
) {
  return result(async () => {
    const { db } = await adminSession();
    const { error } = await db.rpc("set_member", {
      p_space: id.parse(space),
      p_email: z.email().parse(email),
      p_remove: remove,
    });
    if (error) throw error;
    revalidatePath(`/spaces/${space}/settings`);
  });
}
const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  name: z.string().trim().min(1).max(100),
  type: z.enum([
    "short_text",
    "long_text",
    "rich_text",
    "number",
    "boolean",
    "date",
    "asset",
    "reference",
    "references",
  ]),
  localized: z.boolean(),
  required: z.boolean(),
  active: z.boolean(),
  help: z.string().max(1000),
});
export async function saveModelAction(
  space: string,
  model: {
    id?: string;
    key: string;
    name: string;
    description: string;
    fields: Field[];
  },
) {
  return result(async () => {
    const { db } = await adminSession();
    const { data, error } = await db.rpc("save_content_type", {
      p_space: id.parse(space),
      p_id: model.id ? id.parse(model.id) : null,
      p_key: z
        .string()
        .regex(/^[a-z][a-z0-9_]{0,63}$/)
        .parse(model.key),
      p_name: z.string().trim().min(1).max(100).parse(model.name),
      p_description: z.string().max(2000).parse(model.description),
      p_fields: z.array(fieldSchema).min(1).max(64).parse(model.fields),
    });
    if (error) throw error;
    revalidatePath(`/spaces/${space}`, "layout");
    return String(data);
  });
}
export async function saveEntryAction(input: {
  space: string;
  type: string;
  id?: string;
  version?: number;
  shared: Values;
  translations: Record<Locale, Values>;
}) {
  return result(async () => {
    const { db } = await session();
    const { data, error } = await db.rpc("save_entry", {
      p_space: id.parse(input.space),
      p_type: id.parse(input.type),
      p_id: input.id ? id.parse(input.id) : null,
      p_version: input.version ?? 0,
      p_shared: input.shared,
      p_translations: input.translations,
    });
    if (error) throw error;
    revalidatePath(`/spaces/${input.space}/content`);
    return data as Entry;
  });
}
export async function publicationAction(
  space: string,
  entry: string,
  locale: Locale,
  version: number,
  remove = false,
) {
  return result(async () => {
    const { db } = await session();
    const { error } = await db.rpc(
      remove ? "unpublish_entry" : "publish_entry",
      {
        p_space: id.parse(space),
        p_id: id.parse(entry),
        p_locale: z.enum(["es", "gl"]).parse(locale),
        ...(!remove ? { p_version: version } : {}),
      },
    );
    if (error) throw error;
    revalidatePath(`/spaces/${space}`, "layout");
  });
}
export async function deleteEntryAction(space: string, entry: string) {
  return result(async () => {
    const { db } = await session();
    const { error } = await db.rpc("delete_entry", {
      p_space: id.parse(space),
      p_id: id.parse(entry),
    });
    if (error) throw error;
    revalidatePath(`/spaces/${space}/content`);
  });
}
const allowedMimes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "application/pdf",
];
export async function uploadAction(space: string, form: FormData) {
  return result(async () => {
    const { db } = await session();
    id.parse(space);
    const { data: allowed } = await db.rpc("can_access_space", { s: space });
    if (!allowed) throw new Error("No autorizado");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 10485760)
      throw new Error("Selecciona un archivo de hasta 10 MiB.");
    const bytes = new Uint8Array(await file.arrayBuffer()),
      detected = await fileTypeFromBuffer(bytes);
    if (!detected || !allowedMimes.includes(detected.mime))
      throw new Error("Solo se admiten JPEG, PNG, WebP, AVIF y PDF.");
    const assetId = randomUUID(),
      storageUrl = await storeAsset(space, assetId, bytes, detected.mime);
    const { error } = await db.rpc("register_asset", {
      p_space: space,
      p_id: assetId,
      p_name: file.name.slice(0, 255),
      p_mime: detected.mime,
      p_size: file.size,
      p_storage_url: storageUrl,
    });
    if (error) {
      await removeAssetObject({
        path: `${space}/${assetId}`,
        storage_url: storageUrl,
      });
      throw error;
    }
    revalidatePath(`/spaces/${space}`, "layout");
    return assetId;
  });
}
export async function completeAssetAction(
  space: string,
  assetId: string,
  url: string,
  name: string,
) {
  return result(async () => {
    const { db } = await session();
    id.parse(space);
    id.parse(assetId);
    const { data: allowed } = await db.rpc("can_access_space", { s: space });
    if (!allowed) throw new Error("No autorizado");
    const blob = await inspectBlob(space, assetId, url),
      detected = await fileTypeFromBuffer(blob.bytes);
    if (!detected || !allowedMimes.includes(detected.mime))
      throw new Error("Formato de archivo no permitido");
    const { error } = await db.rpc("register_asset", {
      p_space: space,
      p_id: assetId,
      p_name: z.string().min(1).max(255).parse(name),
      p_mime: detected.mime,
      p_size: blob.size,
      p_storage_url: url,
    });
    if (error) throw error;
    revalidatePath(`/spaces/${space}`, "layout");
    return assetId;
  });
}
export async function assetMetadataAction(
  space: string,
  asset: string,
  name: string,
  alt: Record<Locale, string>,
  description: Record<Locale, string>,
) {
  return result(async () => {
    const { db } = await session();
    const localized = z.object({
      es: z.string().max(2000),
      gl: z.string().max(2000),
    });
    const { error } = await db.rpc("update_asset", {
      p_space: id.parse(space),
      p_id: id.parse(asset),
      p_name: z.string().trim().min(1).max(255).parse(name),
      p_alt: localized.parse(alt),
      p_description: localized.parse(description),
    });
    if (error) throw error;
    revalidatePath(`/spaces/${space}`, "layout");
  });
}
export async function deleteAssetAction(space: string, asset: string) {
  return result(async () => {
    const { db, user } = await session();
    id.parse(space);
    id.parse(asset);
    const rows = await userQuery<Asset & { storage_url: string | null }>(
      user.id,
      "select * from assets where id=$1 and space_id=$2",
      [asset, space],
    );
    if (!rows[0]) throw new Error("Archivo no encontrado");
    const { error } = await db.rpc("delete_asset", {
      p_space: space,
      p_id: asset,
    });
    if (error) throw error;
    try {
      await removeAssetObject(rows[0]);
    } catch {
      throw new Error(
        "Metadatos eliminados; el archivo huérfano requiere limpieza del administrador.",
      );
    }
    revalidatePath(`/spaces/${space}`, "layout");
  });
}
export async function keyAction(space: string, name: string) {
  return result(async () => {
    const { db } = await adminSession();
    const key = `ct_${randomBytes(32).toString("hex")}`;
    const { error } = await db.rpc("create_read_key", {
      p_space: id.parse(space),
      p_name: z.string().trim().min(1).max(100).parse(name),
      p_prefix: key.slice(0, 11),
      p_hash: createHash("sha256").update(key).digest("hex"),
    });
    if (error) throw error;
    revalidatePath(`/spaces/${space}/settings`);
    return key;
  });
}
export async function revokeKeyAction(space: string, key: string) {
  return result(async () => {
    const { db } = await adminSession();
    const { error } = await db.rpc("revoke_read_key", {
      p_space: id.parse(space),
      p_id: id.parse(key),
    });
    if (error) throw error;
    revalidatePath(`/spaces/${space}/settings`);
  });
}
