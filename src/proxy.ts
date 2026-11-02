import { NextResponse, type NextRequest } from "next/server";
// Real authentication and authorization happen in session() and each server mutation.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  if (
    ["/reset-password", "/forgot-password", "/account", "/login"].includes(
      request.nextUrl.pathname,
    )
  ) {
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  if (
    !process.env.DATABASE_URL &&
    request.nextUrl.pathname.startsWith("/spaces")
  )
    return NextResponse.redirect(new URL("/setup", request.url));
  return response;
}
export const config = {
  matcher: [
    "/spaces/:path*",
    "/login",
    "/reset-password",
    "/forgot-password",
    "/account",
  ],
};
