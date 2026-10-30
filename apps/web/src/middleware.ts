import { NextRequest, NextResponse } from "next/server";

const PASSWORD = process.env.SITE_PASSWORD ?? "gusthegoose";
const COOKIE = "sgm_auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Let through the unlock page/API and anything that looks like a static file.
  if (
    pathname === "/pw" ||
    pathname.startsWith("/api/pw") ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    return NextResponse.next();
  }
  if (req.cookies.get(COOKIE)?.value === PASSWORD) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/pw";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
