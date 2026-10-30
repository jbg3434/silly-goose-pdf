import { NextResponse } from "next/server";
import { MODES, type Mode, ScopeError, search } from "@/lib/search";

export const dynamic = "force-dynamic";

type Body = {
  query?: unknown; mode?: unknown; k?: unknown; product_id?: unknown; states?: unknown; edition?: unknown;
  document_id?: unknown; section_id?: unknown; all_editions?: unknown;
};

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (typeof body.query !== "string" || !body.query.trim()) return NextResponse.json({ error: "query is required" }, { status: 400 });
  const mode = (body.mode ?? "hybrid") as Mode;
  if (!MODES.includes(mode)) return NextResponse.json({ error: `mode must be one of ${MODES.join(", ")}` }, { status: 400 });
  if (body.states !== undefined && !(Array.isArray(body.states) && body.states.every((s) => typeof s === "string"))) {
    return NextResponse.json({ error: "states must be an array of state codes" }, { status: 400 });
  }
  if (body.edition !== undefined && typeof body.edition !== "number") return NextResponse.json({ error: "edition must be a number" }, { status: 400 });
  try {
    const res = await search(
      body.query,
      {
        product_id: str(body.product_id),
        states: body.states as string[] | undefined,
        edition: body.edition as number | undefined,
        document_id: str(body.document_id),
        section_id: str(body.section_id),
        all_editions: body.all_editions === true,
      },
      { mode, k: typeof body.k === "number" ? body.k : 10 },
    );
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof ScopeError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
