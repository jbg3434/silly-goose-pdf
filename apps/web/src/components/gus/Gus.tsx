"use client";

import { useState } from "react";
import { gusSvg, type GusPose } from "@/brand/gus";
import { useGus, type GusCue } from "./GusProvider";

const POSE_ANIMATION: Partial<Record<GusPose, string>> = {
  honk: "animate-honk",
  alarmed: "animate-honk",
  celebrate: "animate-pop",
};

type Props = {
  pose?: GusPose;
  size?: number;
  className?: string;
  /** Decorative instances are hidden from assistive tech. */
  decorative?: boolean;
  /** When set, clicking Gus plays this reaction. */
  reaction?: { pose: GusPose; cue: GusCue };
  /** Companion instances obey the "Hide Gus" preference; brand-sheet instances do not. */
  companion?: boolean;
  idleBob?: boolean;
};

export function Gus({ pose = "idle", size = 160, className = "", decorative, reaction, companion = true, idleBob }: Props) {
  const { hidden, reducedMotion, cue } = useGus();
  const [active, setActive] = useState<GusPose | null>(null);
  if (companion && hidden) return null;

  const shown = active ?? pose;
  const anim = reducedMotion ? "" : (POSE_ANIMATION[shown] ?? (idleBob ? "animate-bob" : ""));
  const svg = gusSvg({ pose: shown, id: `gus-${Math.abs(hash(className + size + shown))}` });
  const art = (
    <span
      className={`block ${anim} ${shown === "flap" || shown === "celebrate" ? "gus-flapping" : ""}`}
      style={{ width: size, height: (size * 230) / 200 }}
      aria-hidden={decorative || undefined}
      dangerouslySetInnerHTML={{ __html: decorative ? svg.replace('role="img"', 'aria-hidden="true"') : svg }}
    />
  );

  if (!reaction) return <span className={`inline-block ${className}`}>{art}</span>;
  return (
    <button
      type="button"
      className={`inline-block rounded-2xl ${className}`}
      aria-label={`Poke Gus (${reaction.cue.replace("-", " ")})`}
      onClick={() => {
        setActive(reaction.pose);
        cue(reaction.cue);
        setTimeout(() => setActive(null), 1400);
      }}
    >
      {art}
    </button>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
