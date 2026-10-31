import { NextResponse } from "next/server";
import { getDocument, getGuideDetails } from "@/lib/queries";

export const dynamic = "force-dynamic";

// GET /api/v1/documents/:id — guide detail: metadata, lineage, artifacts,
// approval history, overrides, and the immutable PDF artifact with sha256.
export async function GET(_req: Request, { params }: { params: { documentId: string } }) {
  const res = await getDocument(params.documentId);
  if (!res) return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  const details = await getGuideDetails(res.doc.edition_id, res.doc.product_id, res.doc.state, res.doc.edition_number);
  return NextResponse.json({
    document: res.doc,
    lineage: res.lineage,
    artifacts: details.artifacts,
    approvals: details.approvals,
    differences: details.differences,
    image_only_pages: details.imageOnlyPages,
  });
}
