import { readFile } from "node:fs/promises";
import path from "node:path";
import { STORAGE_ROOT } from "@/lib/revisions";

export async function GET(_req: Request, { params }: { params: { revisionId: string; page: string } }) {
  if (!/^REV-[A-Z]{2}-[A-Z]{2}-[a-z0-9]+$/.test(params.revisionId) || !/^\d+$/.test(params.page)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  try {
    const bytes = await readFile(path.join(STORAGE_ROOT, "revisions", params.revisionId, "visual", `page-${params.page}.png`));
    return new Response(bytes, { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
  } catch {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
}
