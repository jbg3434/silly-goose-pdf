// Demo-access gate: server-validated password hash + short-lived signed sessions.
// Synthetic demo content — not an insurance contract or coverage advice.
//
// Secrets (env only, never committed):
//   GUS_DEMO_PASSWORD_HASH  "sha256$<salt>$<hex sha256(salt + password)>"
//   SITE_PASSWORD           legacy plaintext fallback (deprecated)
// The session cookie is "<expiresAtMs>.<hmac>" — an HMAC-SHA256 of the expiry
// timestamp, keyed by the configured secret. The password itself is never
// stored in or sent to the client.

export const AUTH_COOKIE = "sgm_auth";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h session

const te = new TextEncoder();

function secret(): string {
  return process.env.GUS_DEMO_PASSWORD_HASH ?? process.env.SITE_PASSWORD ?? "";
}

export function gateEnabled(): boolean {
  return secret() !== "";
}

async function hmacHex(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", te.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, te.encode(msg));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(candidate: string): Promise<boolean> {
  const stored = process.env.GUS_DEMO_PASSWORD_HASH;
  if (stored) {
    const m = /^sha256\$(\S+)\$([0-9a-f]{64})$/i.exec(stored.trim());
    if (m) {
      const dig = await crypto.subtle.digest("SHA-256", te.encode(m[1] + candidate));
      const hex = Array.from(new Uint8Array(dig), (b) => b.toString(16).padStart(2, "0")).join("");
      return timingSafeEqualHex(hex, m[2].toLowerCase());
    }
  }
  const legacy = process.env.SITE_PASSWORD;
  return !!legacy && candidate === legacy;
}

export async function issueSession(now = Date.now()): Promise<string> {
  const exp = now + SESSION_TTL_MS;
  return `${exp}.${await hmacHex(secret(), `session:${exp}`)}`;
}

export async function verifySession(cookie: string | undefined, now = Date.now()): Promise<boolean> {
  if (!cookie) return false;
  const dot = cookie.lastIndexOf(".");
  if (dot < 0) return false;
  const exp = Number(cookie.slice(0, dot));
  if (!Number.isFinite(exp) || exp <= now) return false;
  const expected = await hmacHex(secret(), `session:${exp}`);
  return timingSafeEqualHex(cookie.slice(dot + 1), expected);
}
