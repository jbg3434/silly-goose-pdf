import { cookies } from "next/headers";
import { ROLES } from "@/lib/revisions";

export async function POST(req: Request) {
  const { role } = await req.json().catch(() => ({}));
  if (!(ROLES as readonly string[]).includes(role)) return Response.json({ error: "invalid_role", message: "Unknown role." }, { status: 400 });
  cookies().set("sgm.role", role, { path: "/", sameSite: "lax", httpOnly: true });
  return Response.json({ role });
}
