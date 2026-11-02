import "server-only";
import { authHeaders } from "@/lib/auth-headers";
import { redirect } from "next/navigation";
import { configured, cmsDb } from "./database";
import { getAuth } from "./auth";
export async function session() {
  if (!configured()) redirect("/setup");
  const current = await getAuth().api.getSession({
    headers: await authHeaders(),
  });
  if (!current) redirect("/login");
  const db = cmsDb(current.user.id);
  const { data: admin, error } = await db.rpc("is_admin");
  if (error) throw error;
  return { db, user: current.user, isAdmin: admin === true };
}
export async function adminSession() {
  const s = await session();
  if (!s.isAdmin)
    throw new Error("Solo el administrador puede realizar esta acción");
  return s;
}
