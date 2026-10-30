import { NextResponse } from "next/server";
import { answer } from "@/lib/answers";
import { ScopeError } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { query?: unknown; product_id?: unknown; states?: unknown; edition?: unknown; document_id?: unknown; all_editions?: unknown; model?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (typeof body.query !== "string" || !body.query.trim()) return NextResponse.json({ error: "query is required" }, { status: 400 });
  try {
    const res = await answer(body.query, {
      product_id: typeof body.product_id === "string" ? body.product_id : undefined,
      states: Array.isArray(body.states) ? body.states.filter((s) => typeof s === "string") : undefined,
      edition: typeof body.edition === "number" ? body.edition : undefined,
      document_id: typeof body.document_id === "string" ? body.document_id : undefined,
      all_editions: body.all_editions === true,
    }, { model: typeof body.model === "string" && body.model ? body.model : undefined });
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof ScopeError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
