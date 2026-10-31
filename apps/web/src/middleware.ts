import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, gateEnabled, verifySession } from "./lib/auth";

export async function middleware(req: NextRequest) {
  // Gate is only active when a server-side secret is configured.
  if (!gateEnabled()) return NextResponse.next();
  const { pathname } = req.nextUrl;
  // Let through the unlock page/API and anything that looks like a static file.
  if (
    pathname === "/pw" ||
    pathname.startsWith("/api/pw") ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    return NextResponse.next();
  }
  if (await verifySession(req.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();
  // API clients get a 401 rather than an HTML redirect.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/pw";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
