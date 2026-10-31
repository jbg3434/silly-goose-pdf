import { NextRequest, NextResponse } from "next/server";
import { listDocuments, type LibraryFilters, SORTS } from "@/lib/queries";

export const dynamic = "force-dynamic";

// GET /api/v1/documents?q=&product=PU&state=WA&edition=current&format=&approval=&status=&sort=&page=
// Filtered, paginated document list for the library/browse surfaces.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const edition = sp.get("edition") ?? "current";
  const filters: LibraryFilters = {
    q: sp.get("q") || undefined,
    product: sp.getAll("product"),
    state: sp.getAll("state").map((s) => s.toUpperCase()),
    edition: edition === "all" || edition === "current" ? edition : ["1", "2"].includes(edition) ? (edition as "1" | "2") : "current",
    format: sp.get("format") || undefined,
    approval: sp.get("approval") || undefined,
    status: sp.get("status") || undefined,
    sort: (Object.keys(SORTS) as (keyof typeof SORTS)[]).includes(sp.get("sort") as keyof typeof SORTS)
      ? (sp.get("sort") as keyof typeof SORTS)
      : "product",
    page: Math.max(1, Number(sp.get("page")) || 1),
  };
  const res = await listDocuments(filters);
  return NextResponse.json({
    documents: res.rows,
    total: res.total,
    page: res.page,
    page_size: res.pageSize,
    applied_scope: filters,
  });
}
