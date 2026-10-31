import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, gateEnabled, verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/v1/session — is the demo gate armed, and is this client authenticated?
export async function GET(req: NextRequest) {
  const authenticated = gateEnabled() && (await verifySession(req.cookies.get(AUTH_COOKIE)?.value));
  return NextResponse.json({ gate_enabled: gateEnabled(), authenticated });
}
