import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export type GuideBlock = {
  block_id: string;
  section_id: string;
  section_title: string;
  sort_order: number;
  kind: "heading" | "term" | "table" | "prose" | "footnote" | "callout";
  content: Record<string, unknown>;
  fact_ids: string[];
  page_start: number | null;
  page_end: number | null;
  review_state: string;
};

// GET /api/v1/documents/:id/blocks — website-like semantic guide content.
export async function GET(_req: Request, { params }: { params: { documentId: string } }) {
  const { rows } = await pool.query<GuideBlock>(
    `SELECT block_id, section_id, section_title, sort_order, kind, content, fact_ids,
            page_start, page_end, review_state
     FROM guide_blocks WHERE document_id = $1 ORDER BY sort_order`,
    [params.documentId],
  );
  if (!rows.length) return NextResponse.json({ error: "blocks_not_found" }, { status: 404 });
  return NextResponse.json({ document_id: params.documentId, blocks: rows });
}
