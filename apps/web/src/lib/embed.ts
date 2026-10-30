import type { FeatureExtractionPipeline } from "@huggingface/transformers";

// Embedding provider adapter. The default runs BAAI bge-small-en-v1.5 locally (384 dims, no API key).
export const EMBEDDING_MODEL = process.env.SGM_EMBEDDING_MODEL ?? "Xenova/bge-small-en-v1.5";
export const EMBEDDING_ID = `${EMBEDDING_MODEL}@q8-cls`;
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

let extractor: Promise<FeatureExtractionPipeline> | null = null;

function load() {
  extractor ??= import("@huggingface/transformers").then(({ pipeline }) => {
    const make = pipeline as unknown as (task: string, model: string, opts: object) => Promise<FeatureExtractionPipeline>;
    return make("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" });
  });
  return extractor;
}

export async function embed(texts: string[]): Promise<number[][]> {
  const fe = await load();
  const out = await fe(texts, { pooling: "cls", normalize: true });
  return out.tolist() as number[][];
}

export async function embedQuery(q: string): Promise<number[]> {
  return (await embed([QUERY_PREFIX + q]))[0];
}

export const toVector = (v: number[]) => `[${v.map((x) => x.toFixed(6)).join(",")}]`;
