import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, gateEnabled, issueSession, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Basic per-IP rate limiting for password attempts (10 fails / 15 min).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const fails = new Map<string, { count: number; reset: number }>();

function rateLimited(req: NextRequest): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const rec = fails.get(ip);
  if (!rec || rec.reset <= now) {
    fails.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  rec.count++;
  return rec.count > MAX_FAILS;
}

// Redirect base: behind Render's proxy req.url carries the internal host
// (localhost:PORT). Prefer the public forwarded host when present.
function external(req: NextRequest, path: string): URL {
  const host = req.headers.get("x-forwarded-host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    return new URL(path, `${proto}://${host.split(",")[0].trim()}`);
  }
  return new URL(path, req.url);
}

function wantsJson(req: NextRequest): boolean {
  return (req.headers.get("accept") ?? "").includes("application/json");
}

function cookieOpts(req: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")) === "https",
    path: "/",
  };
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await req.json().catch(() => ({})) : await req.formData();
  const password = String(isJson ? (body as { password?: string }).password ?? "" : (body as FormData).get("password") ?? "");
  const next = String(isJson ? "/" : (body as FormData).get("next") ?? "/");
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!gateEnabled()) {
    return wantsJson(req)
      ? NextResponse.json({ error: "gate not configured" }, { status: 503 })
      : NextResponse.redirect(external(req, "/pw?nogate=1"), 303);
  }
  if (rateLimited(req)) {
    return wantsJson(req)
      ? NextResponse.json({ error: "too many attempts" }, { status: 429 })
      : NextResponse.redirect(external(req, "/pw?rate=1"), 303);
  }
  if (!(await verifyPassword(password))) {
    if (wantsJson(req)) return NextResponse.json({ error: "invalid password" }, { status: 401 });
    const url = external(req, "/pw");
    url.searchParams.set("wrong", "1");
    url.searchParams.set("next", target);
    return NextResponse.redirect(url, 303);
  }
  const token = await issueSession();
  const res = wantsJson(req)
    ? NextResponse.json({ ok: true, session: token, expiresInMs: 8 * 60 * 60 * 1000 })
    : NextResponse.redirect(external(req, target), 303);
  res.cookies.set(AUTH_COOKIE, token, { ...cookieOpts(req), maxAge: 8 * 60 * 60 });
  return res;
}

// Browser sign-out link target: GET /api/pw?logout=1
export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get("logout") !== "1") {
    return NextResponse.redirect(external(req, "/pw"), 303);
  }
  const res = NextResponse.redirect(external(req, "/pw"), 303);
  res.cookies.set(AUTH_COOKIE, "", { ...cookieOpts(req), maxAge: 0 });
  return res;
}

// Logout: clear the session cookie.
export async function DELETE(req: NextRequest) {
  const res = wantsJson(req)
    ? NextResponse.json({ ok: true })
    : NextResponse.redirect(external(req, "/pw"), 303);
  res.cookies.set(AUTH_COOKIE, "", { ...cookieOpts(req), maxAge: 0 });
  return res;
}
