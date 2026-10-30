"use client";

import { useGus, type GusCue } from "@/components/gus/GusProvider";

export function CuePlayer({ cue: name }: { cue: GusCue }) {
  const { cue, muted } = useGus();
  return (
    <button type="button" className="btn-secondary w-full capitalize" onClick={() => cue(name)}>
      {muted ? "Show caption" : "Play"}: {name.replace("-", " ")}
    </button>
  );
}
