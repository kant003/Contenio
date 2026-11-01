import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { get, put, del, head } from "@vercel/blob";
import type { Asset } from "./types";
const root = join(process.cwd(), ".data", "uploads");
function local() {
  if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error("Configura un almacén privado de Vercel Blob");
  return process.env.STORAGE_DRIVER === "local" && !process.env.VERCEL;
}
function mac(space: string, id: string, expires: number) {
  if (!process.env.BETTER_AUTH_SECRET)
    throw new Error("Falta el secreto de servidor");
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET)
    .update(`asset:${space}:${id}:${expires}`)
    .digest("hex");
}
export function assetUrl(asset: Pick<Asset, "id" | "space_id">) {
  const expires = Math.floor(Date.now() / 1000) + 900;
  return `${process.env.BETTER_AUTH_URL ?? "http://localhost:3100"}/files/${asset.space_id}/${asset.id}?expires=${expires}&signature=${mac(asset.space_id, asset.id, expires)}`;
}
export function validAssetToken(
  space: string,
  id: string,
  expires: string | null,
  signature: string | null,
) {
  if (
    !expires ||
    !signature ||
    !/^\d{10}$/.test(expires) ||
    !/^\w{64}$/.test(signature) ||
    Number(expires) < Math.floor(Date.now() / 1000)
  )
    return false;
  const expected = mac(space, id, Number(expires));
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
export async function storeAsset(
  space: string,
  id: string,
  bytes: Uint8Array,
  mime: string,
) {
  const path = `${space}/${id}`;
  if (local()) {
    await mkdir(join(root, space), { recursive: true });
    await writeFile(join(root, path), bytes, { flag: "wx" });
    return null;
  }
  const blob = await put(path, Buffer.from(bytes), {
    access: "private",
    contentType: mime,
    addRandomSuffix: false,
    allowOverwrite: false,
  });
  return blob.url;
}
export async function readAsset(
  asset: Asset & { storage_url?: string | null },
) {
  if (asset.storage_url) {
    const result = await get(asset.storage_url, {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200)
      throw new Error("Archivo no disponible");
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  }
  if (!local()) throw new Error("Archivo no disponible");
  return new Uint8Array(await readFile(join(root, asset.path)));
}
export async function removeAssetObject(
  asset: Pick<Asset, "path"> & { storage_url?: string | null },
) {
  if (asset.storage_url) await del(asset.storage_url);
  else if (local()) await unlink(join(root, asset.path));
  else throw new Error("Almacenamiento no configurado");
}
export async function inspectBlob(space: string, id: string, url: string) {
  const blob = await head(url);
  if (
    blob.pathname !== `${space}/${id}` ||
    blob.size > 10485760 ||
    blob.size < 1
  )
    throw new Error("Archivo inválido para este espacio");
  const result = await get(url, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200)
    throw new Error("Archivo no disponible");
  return {
    bytes: new Uint8Array(await new Response(result.stream).arrayBuffer()),
    size: blob.size,
    mime: blob.contentType,
  };
}
