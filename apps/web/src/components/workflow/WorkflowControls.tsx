"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLE_LABELS = { editor: "Product editor", reviewer: "Underwriting reviewer", compliance: "Compliance", publisher: "Publisher" } as const;
const ACTION_LABELS: Record<string, string> = {
  internal_review: "Send to internal review", ready_for_filing: "Mark ready for filing", submitted: "Submit (simulated filing)",
  approved: "Record simulated approval", rejected: "Reject", withdrawn: "Withdraw",
};

async function post(url: string, body?: BodyInit, json = true) {
  const res = await fetch(url, { method: "POST", body, headers: json && body ? { "content-type": "application/json" } : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Request failed (${data.error ?? res.status}). Request ID ${data.request_id ?? "unknown"}.`);
  return data;
}

export function RoleSwitcher({ role }: { role: string }) {
  const router = useRouter();
  return (
    <label className="mt-2 block text-sm">
      <span className="sr-only">Switch demo role</span>
      <select
        className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
        value={role}
        onChange={async (e) => {
          await post("/api/role", JSON.stringify({ role: e.target.value }));
          router.refresh();
        }}
      >
        {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </label>
  );
}

export function TransitionButtons({ revisionId, targets, canPublish }: { revisionId: string; targets: string[]; canPublish: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {targets.map((to) => (
          <button key={to} type="button" disabled={busy} className={to === "rejected" || to === "withdrawn" ? "btn-secondary" : "btn-primary"}
            onClick={() => act(() => post(`/api/revisions/${revisionId}/transition`, JSON.stringify({ to })))}>
            {ACTION_LABELS[to] ?? to}
          </button>
        ))}
        {canPublish && (
          <button type="button" disabled={busy} className="btn-primary" onClick={() => act(() => post(`/api/revisions/${revisionId}/publish`))}>
            Publish as current edition
          </button>
        )}
      </div>
      {busy && <p className="mt-2 text-sm muted" role="status">Working…</p>}
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}

export function UploadForm({ lineageId }: { lineageId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          await post(`/api/lineages/${lineageId}/revisions`, form, false);
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm">
        <span className="sr-only">ODT or DOCX file</span>
        <input name="file" type="file" required accept=".odt,.docx" className="block w-full text-sm" />
      </label>
      <button type="submit" disabled={busy} className="btn-primary">{busy ? "Converting and comparing…" : "Upload draft"}</button>
      {busy && <p className="text-sm muted" role="status">This takes up to a minute while LibreOffice renders the draft.</p>}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </form>
  );
}
