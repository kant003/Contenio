import "server-only";
import { cookies, headers } from "next/headers";

/** Cookie rotations in a Server Action must also be visible in its subsequent render. */
export async function authHeaders() {
  const current = new Headers(await headers());
  current.set("cookie", (await cookies()).toString());
  return current;
}
