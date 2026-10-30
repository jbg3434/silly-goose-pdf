// Gus the Goose — editable master. Every pose, the icon, and light/dark exports are rendered from here.
export const GUS_POSES = ["idle", "honk", "flap", "celebrate", "sideeye", "sleepy", "alarmed"] as const;
export type GusPose = (typeof GUS_POSES)[number];
export type GusTheme = "light" | "dark";

export const GUS_POSE_LABELS: Record<GusPose, string> = {
  idle: "Gus standing by, looking smug",
  honk: "Gus honking with beak wide open",
  flap: "Gus flapping both wings",
  celebrate: "Gus celebrating a found citation",
  sideeye: "Gus giving a suspicious side-eye",
  sleepy: "Gus dozing while something processes",
  alarmed: "Gus alarmed, feathers on end",
};

const C = {
  ivory: "#F8F5EC",
  feather: "#FFFDF6",
  shade: "#E3DCC8",
  navy: "#172B3A",
  teal: "#168F88",
  tealDark: "#0E6E68",
  amber: "#E7A63B",
  amberDark: "#B97A16",
  slate: "#53616A",
};

type Opts = { pose?: GusPose; theme?: GusTheme; id?: string; title?: string };

export function gusSvg({ pose = "idle", theme = "light", id = "gus", title }: Opts = {}): string {
  const ink = theme === "dark" ? C.ivory : C.navy;
  const open = pose === "honk" || pose === "alarmed" || pose === "celebrate";
  const wingsUp = pose === "flap" || pose === "celebrate" || pose === "alarmed";
  const tilt = pose === "sideeye" ? -6 : pose === "honk" ? 8 : pose === "sleepy" ? 10 : 0;
  const label = title ?? GUS_POSE_LABELS[pose];

  const tufts =
    pose === "alarmed"
      ? "M84 44 l-6 -22 l12 14 l2 -24 l8 22 l8 -24 l2 26 l12 -18 l-4 24"
      : "M88 44 l-4 -14 l10 9 l4 -16 l6 15 l8 -12 l-1 15";

  const pupil = (cx: number, cy: number) => {
    if (pose === "sleepy") return `<path d="M${cx - 9} ${cy} q9 6 18 0" fill="none" stroke="${C.navy}" stroke-width="3" stroke-linecap="round"/>`;
    const dx = pose === "sideeye" ? 5 : 0;
    const r = pose === "alarmed" ? 3 : 6;
    return `<circle cx="${cx + dx}" cy="${cy + 1}" r="${r}" fill="${C.navy}"/><circle cx="${cx + dx + 2}" cy="${cy - 2}" r="1.8" fill="#fff"/>`;
  };
  const eye = (cx: number, cy: number, r: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${C.navy}" stroke-width="2.5"/>${
      pose === "sideeye" ? `<path d="M${cx - r} ${cy - 3} h${r * 2}" stroke="${C.navy}" stroke-width="3"/><path d="M${cx - r + 1} ${cy - 4} a${r} ${r} 0 0 1 ${2 * r - 2} 0 z" fill="${C.shade}"/>` : ""
    }${pupil(cx, cy)}`;

  const beak = open
    ? `<path d="M118 70 q34 -8 46 4 q-20 6 -46 6 z" fill="${C.amber}" stroke="${C.amberDark}" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="M118 84 q26 4 40 16 q-24 2 -40 -8 z" fill="${C.amber}" stroke="${C.amberDark}" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="M122 80 q16 4 28 10" fill="none" stroke="#7A2E2E" stroke-width="5" stroke-linecap="round"/>`
    : `<path d="M118 72 q36 -6 50 8 q-14 10 -50 8 z" fill="${C.amber}" stroke="${C.amberDark}" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="M120 80 q20 1 44 1" fill="none" stroke="${C.amberDark}" stroke-width="2"/>
       <circle cx="146" cy="74" r="1.6" fill="${C.amberDark}"/>`;

  const wingL = wingsUp
    ? `<g class="gus-wing-l" style="transform-origin:62px 150px"><path d="M66 150 q-44 -20 -52 -64 q22 18 30 14 q-6 -18 2 -30 q12 30 34 50 z" fill="${C.feather}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/></g>`
    : `<path d="M60 148 q-6 34 30 46 q-18 -20 -10 -46 z" fill="${C.shade}" stroke="${ink}" stroke-width="2.5"/>`;
  const wingR = wingsUp
    ? `<g class="gus-wing-r" style="transform-origin:138px 150px"><path d="M134 150 q44 -20 52 -64 q-22 18 -30 14 q6 -18 -2 -30 q-12 30 -34 50 z" fill="${C.feather}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/></g>`
    : `<path d="M140 148 q6 34 -30 46 q18 -20 10 -46 z" fill="${C.shade}" stroke="${ink}" stroke-width="2.5"/>`;

  const extras =
    pose === "celebrate"
      ? `<g><rect x="20" y="30" width="7" height="7" fill="${C.amber}" transform="rotate(20 23 33)"/><rect x="170" y="40" width="7" height="7" fill="${C.teal}" transform="rotate(-15 173 43)"/><circle cx="38" cy="14" r="4" fill="${C.teal}"/><circle cx="160" cy="16" r="4" fill="${C.amber}"/><rect x="184" y="100" width="6" height="6" fill="${C.amber}"/></g>`
      : pose === "sleepy"
        ? `<g fill="${ink}" font-family="Georgia,serif" font-weight="700"><text x="150" y="40" font-size="18">z</text><text x="166" y="24" font-size="13">z</text></g>`
        : pose === "alarmed"
          ? `<g stroke="${C.amber}" stroke-width="4" stroke-linecap="round"><path d="M30 60 l-12 -8"/><path d="M28 78 l-16 0"/><path d="M176 52 l10 -10"/></g>`
          : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 230" role="img" aria-label="${label}"><title>${label}</title>
<defs>
  <filter id="${id}-felt" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2"/>
  </filter>
</defs>
<g filter="url(#${id}-felt)">
  <ellipse cx="100" cy="222" rx="54" ry="6" fill="${C.navy}" opacity="0.15"/>
  <path d="M84 206 l-10 14 h22 z M116 206 l-6 14 h22 z" fill="${C.amber}" stroke="${C.amberDark}" stroke-width="2" stroke-linejoin="round"/>
  ${wingL}${wingR}
  <path d="M100 118 c-44 0 -58 34 -54 58 c4 26 30 36 54 36 c26 0 52 -10 54 -36 c2 -24 -10 -58 -54 -58 z" fill="${C.feather}" stroke="${ink}" stroke-width="3"/>
  <path d="M70 176 q6 8 14 2 M96 186 q6 8 14 2 M122 176 q6 8 14 2" fill="none" stroke="${C.shade}" stroke-width="3" stroke-linecap="round"/>
  <g transform="rotate(${tilt} 100 120)">
    <path d="M86 128 c-8 -24 -8 -46 0 -64 l26 2 c-4 20 -2 40 6 62 z" fill="${C.feather}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M78 116 q22 14 46 0 l4 14 q-26 12 -54 0 z" fill="${C.teal}" stroke="${C.tealDark}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M96 128 l-6 22 l14 -8 l6 12 l4 -24 z" fill="${C.teal}" stroke="${C.tealDark}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M82 122 q20 9 40 0" fill="none" stroke="${C.ivory}" stroke-width="1.5" stroke-dasharray="3 3"/>
    <path d="${tufts}" fill="${C.feather}" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="100" cy="72" r="34" fill="${C.feather}" stroke="${ink}" stroke-width="3"/>
    ${eye(90, 64, 13)}${eye(116, 62, 12)}
    ${beak}
    <circle cx="80" cy="86" r="5" fill="${C.amber}" opacity="0.35"/>
  </g>
  ${extras}
</g>
</svg>`;
}

/** Simplified icon: head, eyes, beak, neckerchief hint. Readable at 16px; no texture filter. */
export function gusIconSvg(theme: GusTheme = "light"): string {
  const bg = theme === "dark" ? C.ivory : C.navy;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Gus the Goose icon"><title>Gus the Goose icon</title>
<rect width="64" height="64" rx="14" fill="${bg}"/>
<path d="M14 54 q18 8 36 0 l-2 -8 q-16 6 -32 0 z" fill="${C.teal}"/>
<path d="M20 20 l-2 -10 l7 6 l3 -10 l4 10 l6 -8 v10" fill="${C.feather}"/>
<circle cx="30" cy="32" r="17" fill="${C.feather}"/>
<circle cx="25" cy="28" r="6" fill="#fff" stroke="${C.navy}" stroke-width="1.5"/><circle cx="26" cy="29" r="3" fill="${C.navy}"/>
<circle cx="37" cy="27" r="5" fill="#fff" stroke="${C.navy}" stroke-width="1.5"/><circle cx="38" cy="28" r="2.5" fill="${C.navy}"/>
<path d="M40 33 q14 -4 20 4 q-8 6 -20 4 z" fill="${C.amber}" stroke="${C.amberDark}" stroke-width="1.2"/>
</svg>`;
}
