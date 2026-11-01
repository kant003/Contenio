import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "./database";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function apiGuard(request: Request, space: string) {
  if (!z.uuid().safeParse(space).success)
    throw new ApiError(400, "Identificador de espacio inválido");
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (ct_[a-f0-9]{64})$/)?.[1];
  if (!token)
    throw new ApiError(401, "Se requiere una clave de lectura válida");
  const db = pool();
  const { rows } = await db.query(
    "select id from api_keys where space_id=$1 and key_hash=$2 and revoked_at is null",
    [space, createHash("sha256").update(token).digest("hex")],
  );
  if (!rows[0]) throw new ApiError(401, "Clave inválida o revocada");
  return db;
}
export async function apiResult(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return json(
        {
          error: "Parámetros inválidos",
          details: e.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        400,
      );
    return json({ error: "El servicio de contenido no está disponible" }, 503);
  }
}
export const querySchema = z.object({
  locale: z.enum(["es", "gl"]).default("es"),
  type: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,63}$/)
    .optional(),
  slug: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});
export const publicColumns = "entry_id,type_key,locale,fields,published_at";
export function entryResponse(p: {
  entry_id: string;
  type_key: string;
  locale: string;
  fields: unknown;
  published_at: string;
}) {
  return {
    id: p.entry_id,
    type: p.type_key,
    locale: p.locale,
    fields: p.fields,
    publishedAt: p.published_at,
  };
}
