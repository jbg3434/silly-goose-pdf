import { GUS_POSES, GUS_POSE_LABELS } from "@/brand/gus";
import { Gus } from "@/components/gus/Gus";
import { CUE_CAPTIONS, type GusCue } from "@/brand/cues";
import { CuePlayer } from "./CuePlayer";

export const metadata = { title: "Meet Gus — brand and usage sheet" };

const SWATCHES = [
  ["Midnight navy", "#172B3A", "text-ivory"],
  ["Teal", "#168F88", "text-white"],
  ["Teal (text)", "#0E6E68", "text-white"],
  ["Warm ivory", "#F8F5EC", "text-navy"],
  ["Amber", "#E7A63B", "text-navy"],
  ["Slate", "#53616A", "text-white"],
] as const;

const PLACEMENT = [
  ["Landing page hero", "idle (bobs; click to honk)"],
  ["Catalog header", "sideeye, decorative"],
  ["Empty search / no results", "sideeye"],
  ["Processing / not yet generated", "sleepy"],
  ["Indexing finished", "flap + double-honk cue"],
  ["Citation found", "celebrate + celebrate cue"],
  ["Errors / not found", "alarmed"],
  ["Guide workspace", "small optional companion in the side panel, never over text"],
];

export default function Brand() {
  return (
    <div className="container-page py-10">
      <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <h1 className="font-serif text-4xl">Meet Gus the Goose</h1>
          <p className="mt-3 max-w-2xl text-lg muted">
            Gus is our original, comically obnoxious mascot: a handmade-puppet goose with wild tufts, oversized eyes, an amber beak,
            and a rumpled teal neckerchief. He makes the brand loud so the guides can stay calm.
          </p>
        </div>
        <Gus pose="celebrate" size={180} companion={false} reaction={{ pose: "flap", cue: "squawk" }} />
      </div>

      <section className="mt-12" aria-labelledby="poses-h">
        <h2 id="poses-h" className="font-serif text-2xl">
          Poses
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          {GUS_POSES.map((pose) => (
            <li key={pose} className="card flex flex-col items-center p-3 text-center">
              <Gus pose={pose} size={120} companion={false} decorative />
              <p className="mt-2 font-semibold capitalize">{pose}</p>
              <p className="text-xs muted">{GUS_POSE_LABELS[pose]}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="card flex items-center gap-4 bg-navy p-4" style={{ background: "#172B3A" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/gus-honk-dark.svg" alt="Gus honking, dark-background export" width={100} height={115} />
            <p className="text-sm text-ivory">Dark export: outlines switch to ivory for navy backgrounds.</p>
          </div>
          <div className="card flex items-center gap-4 p-4">
            {[64, 32, 16].map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s} src="/brand/gus-icon-light.svg" alt={`Gus icon at ${s} pixels`} width={s} height={s} />
            ))}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/gus-icon-dark.svg" alt="Gus icon, dark variant" width={64} height={64} />
            <p className="text-sm muted">Simplified icon for favicons and small UI. No texture, readable at 16px.</p>
          </div>
        </div>
        <p className="mt-3 text-sm muted">
          Master artwork: <code>apps/web/src/brand/gus.ts</code> (editable, parametric SVG). Exports in{" "}
          <code>/public/brand</code> are regenerated with <code>pnpm brand:build</code>.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="sounds-h">
        <h2 id="sounds-h" className="font-serif text-2xl">
          Sounds
        </h2>
        <p className="mt-2 max-w-3xl muted">
          All cues are original and synthesized. Sound starts muted and stays muted across navigation until you turn it on in the
          header. Every cue has a caption, shown on screen and announced to screen readers.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(CUE_CAPTIONS) as GusCue[]).map((c) => (
            <li key={c} className="card p-3">
              <CuePlayer cue={c} />
              <p className="mt-2 text-xs muted">Caption: “{CUE_CAPTIONS[c]}”</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-serif text-2xl">Placement</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="muted">
                <th className="py-1 pr-3 font-semibold">Surface</th>
                <th className="py-1 font-semibold">Pose / cue</th>
              </tr>
            </thead>
            <tbody>
              {PLACEMENT.map(([a, b]) => (
                <tr key={a} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="py-1.5 pr-3">{a}</td>
                  <td className="py-1.5">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <h2 className="font-serif text-2xl">Rules</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
            <li>No autoplay audio. Sound plays only after the user turns it on and only in response to an action or a completed task.</li>
            <li>Gus never overlaps guide text, citations, search results, or editing and approval controls.</li>
            <li>Animations are short and run once; only the hero idle bob repeats. Reduced motion stops all animation.</li>
            <li>“Hide Gus” removes companion appearances everywhere and persists across pages.</li>
            <li>Gus may announce that indexing finished or celebrate a found citation. He never implies he approved a document or determined coverage.</li>
            <li>Guide content and search results stay professional. Gus lives around the edges.</li>
            <li>Text on teal uses #0E6E68 or darker to meet WCAG 2.2 AA contrast.</li>
          </ul>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="color-h">
        <h2 id="color-h" className="font-serif text-2xl">
          Color and type
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SWATCHES.map(([name, hex, text]) => (
            <li key={hex} className={`rounded-xl border p-4 ${text}`} style={{ background: hex, borderColor: "var(--border)" }}>
              <p className="font-semibold">{name}</p>
              <p className="text-sm">{hex}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          <span className="font-serif text-2xl">Source Serif 4</span> for display headings,{" "}
          <span className="font-sans">Inter for UI and body text.</span>
        </p>
      </section>
    </div>
  );
}
