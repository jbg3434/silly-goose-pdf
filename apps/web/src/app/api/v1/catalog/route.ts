import { NextResponse } from "next/server";
import { corpusStats, listProducts, listStates } from "@/lib/queries";

export const dynamic = "force-dynamic";

// GET /api/v1/catalog — products, states, and corpus stats for filter UIs.
export async function GET() {
  const [products, states, stats] = await Promise.all([listProducts(), listStates(), corpusStats()]);
  return NextResponse.json({ products, states, stats });
}
