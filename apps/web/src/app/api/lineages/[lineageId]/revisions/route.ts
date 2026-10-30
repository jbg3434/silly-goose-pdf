import { randomUUID } from "node:crypto";
import { currentActor } from "@/lib/actor";
import { createRevision, WorkflowError } from "@/lib/revisions";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { lineageId: string } }) {
  const requestId = randomUUID();
  const { role, actor } = currentActor();
  try {
    if (role !== "editor") throw new WorkflowError("forbidden_role", "Only the editor role can upload a draft revision.", 403);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new WorkflowError("missing_file", "Attach an ODT or DOCX file.");
    const revisionId = await createRevision(params.lineageId, file.name, Buffer.from(await file.arrayBuffer()), actor, requestId);
    return Response.json({ revision_id: revisionId, request_id: requestId }, { status: 201 });
  } catch (e) {
    if (e instanceof WorkflowError) return Response.json({ error: e.code, message: e.message, request_id: requestId }, { status: e.status });
    console.error(requestId, e);
    return Response.json({ error: "conversion_failed", message: "The file could not be converted or analyzed.", request_id: requestId }, { status: 422 });
  }
}
