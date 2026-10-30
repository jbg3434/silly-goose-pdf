"use client";

import { useGus } from "./GusProvider";

export function GusControls() {
  const { muted, setMuted, hidden, setHidden, motion, setMotion, dark, setDark, cue } = useGus();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Gus and display preferences">
      <button
        type="button"
        className="btn-secondary px-3 py-1.5"
        aria-pressed={!muted}
        onClick={() => {
          setMuted(!muted);
          if (muted) cue("honk", "Sound on. Gus honks.");
        }}
      >
        <SpeakerIcon muted={muted} />
        {muted ? "Sound off" : "Sound on"}
      </button>
      <button type="button" className="btn-secondary px-3 py-1.5" aria-pressed={hidden} onClick={() => setHidden(!hidden)}>
        {hidden ? "Show Gus" : "Hide Gus"}
      </button>
      <label className="sr-only" htmlFor="motion-pref">
        Motion
      </label>
      <select
        id="motion-pref"
        className="field py-1.5"
        value={motion}
        onChange={(e) => setMotion(e.target.value as typeof motion)}
      >
        <option value="system">Motion: system</option>
        <option value="reduced">Motion: reduced</option>
        <option value="full">Motion: full</option>
      </select>
      <button type="button" className="btn-secondary px-3 py-1.5" aria-pressed={dark} onClick={() => setDark(!dark)}>
        {dark ? "Light mode" : "Dark mode"}
      </button>
    </div>
  );
}

export function GusCaption() {
  const { caption } = useGus();
  if (!caption) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-40 max-w-xs rounded-lg bg-navy px-3 py-2 text-sm text-ivory shadow-lg" aria-hidden>
      <span className="font-semibold text-amber">Caption:</span> {caption}
    </div>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" />
      {muted ? <path d="m22 9-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
    </svg>
  );
}
