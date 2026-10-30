import { Gus } from "@/components/gus/Gus";

export const metadata = { title: "Gus in the Community" };

const EPISODES = [
  {
    slug: "story-time",
    title: "Library Story Time",
    blurb: "Gus was invited to read a picture book. He did not read the picture book.",
  },
  {
    slug: "first-pitch",
    title: "Little League Ceremonial First Pitch",
    blurb: "A ceremonial first pitch, minus the pitch. Both dugouts are still empty.",
  },
  {
    slug: "ribbon-cutting",
    title: "Farmers Market Ribbon Cutting",
    blurb: "Gus was handed oversized scissors. The ribbon did not survive. The tomatoes are fine.",
  },
];

export default function Community() {
  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center gap-6">
        <Gus pose="sideeye" size={120} decorative />
        <div className="max-w-2xl">
          <h1 className="font-serif text-3xl md:text-4xl">Gus in the Community</h1>
          <p className="mt-2 muted">
            Our full-size mascot loves meeting the public. The public has mixed feelings. These are staged, fictional cartoon clips
            starring an invented mascot. Nobody was hurt, and nothing here is insurance advice.
          </p>
        </div>
      </div>
      <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {EPISODES.map((ep, i) => (
          <li key={ep.slug} className="card overflow-hidden">
            <video
              className="aspect-video w-full bg-navy"
              controls
              muted
              playsInline
              preload="none"
              poster={`/videos/gus-${ep.slug}.jpg`}
              aria-describedby={`ep-${ep.slug}-desc`}
            >
              <source src={`/videos/gus-${ep.slug}.mp4`} type="video/mp4" />
              <track kind="captions" src={`/videos/gus-${ep.slug}.vtt`} srcLang="en" label="English" default />
              Your browser cannot play this video.
            </video>
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal">Episode {i + 1}</p>
              <h2 className="mt-1 font-semibold">{ep.title}</h2>
              <p id={`ep-${ep.slug}-desc`} className="mt-1 text-sm muted">
                {ep.blurb} Silent clip with captions.
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs muted">
        Gus appears at community events at the discretion of Silly Goose Mutual&apos;s fictional events team, which has asked him
        to stay in the parking lot next time.
      </p>
    </div>
  );
}
