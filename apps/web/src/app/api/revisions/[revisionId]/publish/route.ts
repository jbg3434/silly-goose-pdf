import { randomUUID } from "node:crypto";
import { currentActor } from "@/lib/actor";
import { publish, WorkflowError } from "@/lib/revisions";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { revisionId: string } }) {
  const requestId = randomUUID();
  const { role, actor } = currentActor();
  try {
    const documentId = await publish(params.revisionId, role, actor, requestId);
    return Response.json({ document_id: documentId, request_id: requestId });
  } catch (e) {
    if (e instanceof WorkflowError) return Response.json({ error: e.code, message: e.message, request_id: requestId }, { status: e.status });
    console.error(requestId, e);
    return Response.json({ error: "internal_error", request_id: requestId }, { status: 500 });
  }
}
