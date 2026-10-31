// API client for the Silly Goose Mutual mobile app.
// Synthetic demo content — not an insurance contract or coverage advice.
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const BASE_URL: string =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  "http://localhost:3100";

const TOKEN_KEY = "sgm_session";

export async function getSession(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function login(password: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE_URL}/api/pw`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = (await res.json()) as { ok?: boolean; session?: string; error?: string };
  if (res.ok && data.session) {
    await SecureStore.setItemAsync(TOKEN_KEY, data.session);
    return { ok: true };
  }
  return { ok: false, error: data.error ?? `HTTP ${res.status}` };
}

export async function logout(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getSession();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(token ? { Cookie: `sgm_auth=${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) throw new ApiError("authentication required", 401);
  if (!res.ok) throw new ApiError((body as { error?: string }).error ?? `HTTP ${res.status}`, res.status);
  return body as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type SessionInfo = { gate_enabled: boolean; authenticated: boolean };
export const sessionInfo = () => call<SessionInfo>("/api/v1/session");

export type Product = { id: string; family: string; display_name: string; code: string; summary: string };
export type State = { code: string; name: string };
export type Catalog = {
  products: Product[];
  states: State[];
  stats: { documents: number; products: number; states: number; with_pdf: number };
};
export const catalog = () => call<Catalog>("/api/v1/catalog");

export type DocumentRow = {
  document_id: string;
  product_id: string;
  family: string;
  display_name: string;
  state: string;
  state_name: string;
  edition_number: number;
  effective_date: string;
  source_format: string;
  approval_state: string;
  publication_state: string;
  page_count: number | null;
  index_state: string | null;
};
export type DocumentList = { documents: DocumentRow[]; total: number; page: number; page_size: number };
export const documents = (params: Record<string, string | string[] | undefined>) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    for (const item of Array.isArray(v) ? v : [v]) qs.append(k, item);
  }
  return call<DocumentList>(`/api/v1/documents?${qs}`);
};

export type Artifact = { artifact_id: string; role: string; format: string; sha256: string };
export type DocumentDetail = {
  document: DocumentRow & { summary?: string };
  lineage: { document_id: string; edition_number: number }[];
  artifacts: Artifact[];
  approvals: { stage: string; actor: string; timestamp: string }[];
  differences: { topic: string; baseline: string; replacement_value: string | null; edition: number }[];
};
export const documentDetail = (id: string) =>
  call<DocumentDetail>(`/api/v1/documents/${encodeURIComponent(id)}`);

export type SearchHit = {
  chunk_id: string;
  document_id: string;
  product_id: string;
  state: string;
  edition_number: number;
  is_current: boolean;
  section_id: string;
  section_title: string;
  kind: string;
  page_start: number;
  page_end: number;
  fact_ids: string[];
  artifact_sha256: string;
  text: string;
  score: number;
};
export type SearchResponse = {
  run_id: string | null;
  query: string;
  mode: string;
  scope: { product_id?: string; states?: string[]; edition?: number; document_id?: string; editions: string };
  coverage: { documents_in_scope: number; documents_indexed: number; not_indexed: { document_id: string; state: string; error: string | null }[] };
  results: SearchHit[];
  latency_ms: number;
};
export const search = (body: {
  query: string;
  mode?: string;
  product_id?: string;
  states?: string[];
  edition?: number;
  document_id?: string;
  k?: number;
}) =>
  call<SearchResponse>("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export type GuideBlock = {
  block_id: string;
  section_id: string;
  section_title: string;
  sort_order: number;
  kind: "heading" | "term" | "table" | "prose" | "footnote" | "callout";
  content: {
    number?: string; title?: string; topic?: string; statement?: string;
    value?: string; unit?: string; conditions?: string[];
    overridden?: boolean; footnotes?: string[];
    caption?: string; columns?: string[]; rows?: string[][];
  };
  fact_ids: string[];
  page_start: number | null;
  page_end: number | null;
  review_state: string;
};
export type BlocksResponse = { document_id: string; blocks: GuideBlock[] };
export const documentBlocks = (id: string) =>
  call<BlocksResponse>(`/api/v1/documents/${encodeURIComponent(id)}/blocks`);

export const pdfUrl = (artifactId: string) => `${BASE_URL}/api/artifacts/${artifactId}`;
export { BASE_URL };
