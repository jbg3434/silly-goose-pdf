import { NextRequest, NextResponse } from "next/server";

const PASSWORD = process.env.SITE_PASSWORD ?? "";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const next = String(form.get("next") ?? "/");
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (form.get("password") !== PASSWORD) {
    const url = new URL("/pw", req.url);
    url.searchParams.set("wrong", "1");
    url.searchParams.set("next", target);
    return NextResponse.redirect(url, 303);
  }
  const res = NextResponse.redirect(new URL(target, req.url), 303);
  res.cookies.set("sgm_auth", PASSWORD, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
