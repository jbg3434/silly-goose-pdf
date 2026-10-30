import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

const STORAGE_ROOT = path.resolve(process.cwd(), process.env.ARTIFACT_ROOT ?? "../../storage");
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  odt: "application/vnd.oasis.opendocument.text",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Serves an immutable artifact and refuses to serve bytes that do not match the recorded SHA-256.
export async function GET(req: Request, { params }: { params: { artifactId: string } }) {
  const requestId = randomUUID();
  const { rows } = await pool.query<{ path: string; format: string; sha256: string }>(
    "SELECT path, format, sha256 FROM artifacts WHERE artifact_id = $1",
    [params.artifactId],
  );
  const a = rows[0];
  if (!a) return Response.json({ error: "artifact_not_found", request_id: requestId }, { status: 404 });
  const file = path.resolve(STORAGE_ROOT, a.path);
  if (!file.startsWith(STORAGE_ROOT + path.sep)) {
    return Response.json({ error: "invalid_artifact_path", request_id: requestId }, { status: 500 });
  }
  let bytes: Buffer;
  try {
    bytes = await readFile(file);
  } catch {
    return Response.json({ error: "artifact_missing_on_disk", request_id: requestId }, { status: 410 });
  }
  if (createHash("sha256").update(bytes).digest("hex") !== a.sha256) {
    return Response.json({ error: "checksum_mismatch", request_id: requestId }, { status: 409 });
  }
  const inline = new URL(req.url).searchParams.get("inline") === "1" && a.format === "pdf";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": TYPES[a.format] ?? "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${path.basename(file)}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"${a.sha256}"`,
      "X-Artifact-SHA256": a.sha256,
      "X-Request-Id": requestId,
    },
  });
}
