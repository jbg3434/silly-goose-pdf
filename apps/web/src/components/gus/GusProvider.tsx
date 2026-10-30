"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { CUE_CAPTIONS, type GusCue } from "@/brand/cues";

export type { GusCue };

type MotionPref = "system" | "reduced" | "full";

type GusPrefs = { muted: boolean; hidden: boolean; motion: MotionPref; dark: boolean };

type GusContextValue = GusPrefs & {
  reducedMotion: boolean;
  setMuted: (v: boolean) => void;
  setHidden: (v: boolean) => void;
  setMotion: (v: MotionPref) => void;
  setDark: (v: boolean) => void;
  cue: (cue: GusCue, caption?: string) => void;
  caption: string | null;
};

const DEFAULTS: GusPrefs = { muted: true, hidden: false, motion: "system", dark: false };
const KEY = "sgm.gus.prefs.v1";
const GusContext = createContext<GusContextValue | null>(null);

export function GusProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<GusPrefs>(DEFAULTS);
  const [systemReduced, setSystemReduced] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const captionTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (stored) setPrefs({ ...DEFAULTS, ...stored });
    } catch {}
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const update = useCallback((patch: Partial<GusPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const reducedMotion = prefs.motion === "reduced" || (prefs.motion === "system" && systemReduced);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", prefs.dark);
    root.classList.toggle("reduce-motion", prefs.motion === "reduced");
    root.classList.toggle("motion-auto", prefs.motion === "system");
  }, [prefs.dark, prefs.motion]);

  const cue = useCallback(
    (name: GusCue, text?: string) => {
      setCaption(text ?? CUE_CAPTIONS[name]);
      clearTimeout(captionTimer.current);
      captionTimer.current = setTimeout(() => setCaption(null), 3500);
      if (prefs.muted) return;
      const audio = new Audio(`/sounds/${name}.wav`);
      audio.volume = 0.6;
      audio.play().catch(() => {});
    },
    [prefs.muted],
  );

  const value = useMemo<GusContextValue>(
    () => ({
      ...prefs,
      reducedMotion,
      setMuted: (muted) => update({ muted }),
      setHidden: (hidden) => update({ hidden }),
      setMotion: (motion) => update({ motion }),
      setDark: (dark) => update({ dark }),
      cue,
      caption,
    }),
    [prefs, reducedMotion, update, cue, caption],
  );

  return (
    <GusContext.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="sr-only">
        {caption}
      </div>
    </GusContext.Provider>
  );
}

export function useGus() {
  const ctx = useContext(GusContext);
  if (!ctx) throw new Error("useGus must be used inside GusProvider");
  return ctx;
}
