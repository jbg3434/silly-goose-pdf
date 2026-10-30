// Chat-provider adapter for cited answers. Default: OpenCode Zen's OpenAI-compatible endpoint.
export const LLM_BASE_URL = process.env.SGM_LLM_BASE_URL ?? "https://opencode.ai/inference/openai/v1";
export const LLM_MODEL = process.env.SGM_LLM_MODEL ?? "claude-haiku-5-5";

export class LlmError extends Error {
  constructor(
    message: string,
    readonly kind: "no_key" | "funds" | "upstream" | "parse",
  ) {
    super(message);
  }
}

export const FREE_MODELS = ["claude-haiku-5-5", "big-pickle", "beam-free", "deepseek-v4.1-flash-free", "glm-5.3-flash-free", "mimo-v2.6-flash-free", "flint-40b-free", "nemotron-3.5-super-vl-free", "nemotron-3.5-lightning-free"];

export async function listModels(): Promise<string[]> {
  const key = process.env.OPENCODE_API_KEY ?? process.env.LLM_API_KEY;
  if (!key) return FREE_MODELS;
  const res = await fetch(`${LLM_BASE_URL.replace("/inference/openai/v1", "/zen/v1")}/models`, {
    headers: { authorization: `Bearer ${key}` },
  }).catch(() => null);
  if (!res?.ok) return FREE_MODELS;
  const body = await res.json().catch(() => null);
  const ids = (body?.data ?? []).map((m: { id: string }) => m.id);
  return ids.length ? ids : FREE_MODELS;
}

export async function chat(system: string, user: string, model?: string): Promise<string> {
  const key = process.env.OPENCODE_API_KEY ?? process.env.LLM_API_KEY;
  if (!key) throw new LlmError("No LLM API key configured (OPENCODE_API_KEY)", "no_key");
  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: model ?? LLM_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    const msg = String(body?.error?.message ?? `HTTP ${res.status}`);
    throw new LlmError(msg, /funds|limit/i.test(msg) ? "funds" : "upstream");
  }
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new LlmError("Empty response from provider", "parse");
  return text;
}
