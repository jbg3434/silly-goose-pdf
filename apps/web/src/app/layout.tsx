import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { GusProvider } from "@/components/gus/GusProvider";
import { GusCaption, GusControls } from "@/components/gus/GusControls";
import "./globals.css";

const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Silly Goose Mutual — Synthetic Product Guide Library", template: "%s · Silly Goose Mutual" },
  description: "A document-intelligence demo over 1,000 wholly synthetic insurance product guides. Not an insurer.",
};

const NAV = [
  { href: "/products", label: "Products" },
  { href: "/library", label: "Library" },
  { href: "/brand", label: "Meet Gus" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} motion-auto`}>
      <body className="flex min-h-screen flex-col">
        <GusProvider>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <div className="bg-amber px-4 py-1.5 text-center text-xs font-semibold text-navy" role="note">
            Synthetic demo content — not an insurance contract or coverage advice
          </div>
          <header className="border-b" style={{ borderColor: "var(--border)" }}>
            <div className="container-page flex flex-wrap items-center justify-between gap-4 py-4">
              <Link href="/" className="flex items-center gap-3 rounded" aria-label="Silly Goose Mutual home">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/gus-icon-light.svg" alt="" width={40} height={40} />
                <span className="font-serif text-xl font-semibold tracking-tight">
                  Silly Goose <span className="text-teal-700 dark:text-teal">Mutual</span>
                </span>
              </Link>
              <nav aria-label="Primary">
                <ul className="flex items-center gap-1">
                  {NAV.map((n) => (
                    <li key={n.href}>
                      <Link href={n.href} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-ivory-200 dark:hover:bg-navy-700">
                        {n.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <GusControls />
            </div>
          </header>
          <main id="main" className="flex-1">
            {children}
          </main>
          <footer className="mt-16 bg-navy text-ivory">
            <div className="container-page grid gap-6 py-10 text-sm md:grid-cols-3">
              <div>
                <p className="font-serif text-lg">Silly Goose Mutual</p>
                <p className="mt-2 text-slate-300">
                  A fictional mutual insurer created for a document-intelligence demo. Every company, form, rule, rate, limit,
                  and address here is invented.
                </p>
              </div>
              <div>
                <p className="font-semibold text-amber">Not insurance</p>
                <p className="mt-2 text-slate-300">
                  No quotes, binding, applications, or coverage advice. Filing and approval records are a{" "}
                  <strong>simulated DOI workflow</strong>.
                </p>
              </div>
              <div>
                <p className="font-semibold text-amber">Gus disclaimer</p>
                <p className="mt-2 text-slate-300">Gus is a goose. Gus has not approved any document or determined any coverage.</p>
              </div>
            </div>
          </footer>
          <GusCaption />
        </GusProvider>
      </body>
    </html>
  );
}
