import { randomUUID } from "node:crypto";
import { currentActor } from "@/lib/actor";
import { transition, WorkflowError } from "@/lib/revisions";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { revisionId: string } }) {
  const requestId = randomUUID();
  const { role, actor } = currentActor();
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.to !== "string") throw new WorkflowError("missing_target", "Provide the target state in `to`.");
    await transition(params.revisionId, body.to, role, actor, typeof body.notes === "string" ? body.notes : null, requestId);
    return Response.json({ ok: true, request_id: requestId });
  } catch (e) {
    if (e instanceof WorkflowError) return Response.json({ error: e.code, message: e.message, request_id: requestId }, { status: e.status });
    console.error(requestId, e);
    return Response.json({ error: "internal_error", request_id: requestId }, { status: 500 });
  }
}
