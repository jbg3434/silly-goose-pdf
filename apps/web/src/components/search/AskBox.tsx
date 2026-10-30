"use client";
import { useState } from "react";
import { FREE_MODELS } from "@/lib/llm";

type Citation = { chunk_id: string; index: number };
type AnswerResp = {
  result:
    | { kind: "answer"; answer: string; citations: Citation[]; model: string }
    | { kind: "abstain"; reason: string }
    | { kind: "unavailable"; reason: string };
};

export function AskBox({ query, scope }: { query: string; scope: Record<string, unknown> }) {
  const [model, setModel] = useState(FREE_MODELS[0]);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [resp, setResp] = useState<AnswerResp["result"] | null>(null);

  async function ask() {
    setState("loading");
    setResp(null);
    try {
      const r = await fetch("/api/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, ...scope, model }),
      });
      const body = await r.json();
      setResp(body.result ?? { kind: "unavailable", reason: body.error ?? "Unexpected response" });
    } catch (e) {
      setResp({ kind: "unavailable", reason: e instanceof Error ? e.message : "Request failed" });
    }
    setState("done");
  }

  return (
    <div className="card p-4" aria-label="Cited answer">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={ask} disabled={state === "loading"} className="btn-primary text-sm">
          {state === "loading" ? "Asking…" : "Get a cited answer"}
        </button>
        <label className="text-xs muted">
          model{" "}
          <select value={model} onChange={(e) => setModel(e.target.value)} className="field text-xs">
            {FREE_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <span className="text-xs muted">Answers only cite the passages below; absent answers say so.</span>
      </div>
      {resp && (
        <div className="mt-3 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }} aria-live="polite">
          {resp.kind === "answer" && (
            <>
              <p>{resp.answer}</p>
              <p className="mt-2 text-xs muted">
                model {resp.model} · cites{" "}
                {resp.citations.map((c) => (
                  <a key={c.index} href={`#chunk-${c.chunk_id}`} className="link mr-1">[{c.index}]</a>
                ))}
              </p>
            </>
          )}
          {resp.kind === "abstain" && <p className="muted">No cited answer: {resp.reason}</p>}
          {resp.kind === "unavailable" && (
            <p className="muted">Cited answers unavailable right now ({resp.reason}). The passages below still answer within scope.</p>
          )}
        </div>
      )}
    </div>
  );
}
