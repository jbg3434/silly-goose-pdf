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
  feather: "#FFF8E8",
  featherWarm: "#F4E5C8",
  shade: "#D8C49D",
  navy: "#172B3A",
  teal: "#168F88",
  tealDark: "#0E6E68",
  amber: "#E7A63B",
  amberDark: "#B97A16",
  mouth: "#642E35",
  tongue: "#E99698",
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
      ? "M78 48 q-8 -25 8 -15 q-1 -27 11 -8 q10 -28 13 2 q17 -21 12 10 q16 -11 7 14"
      : "M83 46 q-6 -18 9 -10 q2 -22 11 -5 q12 -17 12 5 q15 -9 9 11";

  const pupil = (cx: number, cy: number) => {
    if (pose === "sleepy")
      return `<path d="M${cx - 10} ${cy} q10 7 20 0" fill="none" stroke="${C.navy}" stroke-width="3.5" stroke-linecap="round"/>`;
    const dx = pose === "sideeye" ? 6 : pose === "alarmed" ? 0 : 1;
    const r = pose === "alarmed" ? 3.5 : 6.5;
    return `<circle cx="${cx + dx}" cy="${cy + 2}" r="${r}" fill="${C.navy}"/>
      <circle cx="${cx + dx + 2.3}" cy="${cy - 0.5}" r="2" fill="#fff"/>`;
  };
  const eye = (cx: number, cy: number, rx: number, ry: number, rotation: number) =>
    `<g transform="rotate(${rotation} ${cx} ${cy})">
      <ellipse cx="${cx}" cy="${cy + 1}" rx="${rx + 1.8}" ry="${ry + 2}" fill="${C.shade}" opacity=".55"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fffdf7" stroke="${C.navy}" stroke-width="2.5"/>
    </g>${
      pose === "sideeye"
        ? `<path d="M${cx - rx + 1} ${cy - 4} q${rx} -5 ${rx * 2 - 2} 0" fill="${C.featherWarm}" stroke="${C.navy}" stroke-width="3" stroke-linecap="round"/>`
        : ""
    }${pupil(cx, cy)}`;

  const beak = open
    ? `<path d="M116 74 q30 -10 50 4 q-16 9 -48 8 z" fill="${C.amber}" stroke="${C.amberDark}" stroke-width="2.8" stroke-linejoin="round"/>
       <path d="M117 87 q25 2 43 17 q-25 7 -44 -7 z" fill="${C.amber}" stroke="${C.amberDark}" stroke-width="2.8" stroke-linejoin="round"/>
       <path d="M120 85 q22 2 37 13 q-19 3 -38 -4 z" fill="${C.mouth}" stroke="${C.mouth}" stroke-width="5" stroke-linejoin="round"/>
       <path d="M134 96 q8 -2 14 3" fill="none" stroke="${C.tongue}" stroke-width="4" stroke-linecap="round"/>
       <ellipse cx="148" cy="76" rx="2.2" ry="1.4" fill="${C.amberDark}"/>`
    : `<path d="M115 76 q34 -9 54 4 q-14 13 -51 11 q-8 -5 -3 -15 z" fill="${C.amber}" stroke="${C.amberDark}" stroke-width="2.8" stroke-linejoin="round"/>
       <path d="M119 85 q23 3 45 -2" fill="none" stroke="${C.amberDark}" stroke-width="2.3" stroke-linecap="round"/>
       <ellipse cx="149" cy="77" rx="2.1" ry="1.4" fill="${C.amberDark}"/>`;

  const wingL = wingsUp
    ? `<g class="gus-wing-l" style="transform-origin:63px 150px">
        <path d="M68 154 q-28 -12 -39 -34 q-12 -22 -10 -42 q13 27 24 28 q-8 -23 1 -34 q8 28 19 32 q-2 -24 8 -30 q5 34 15 50 z" fill="${C.featherWarm}" stroke="${ink}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M34 109 q16 19 34 26" fill="none" stroke="${C.shade}" stroke-width="3" stroke-linecap="round"/>
      </g>`
    : `<path d="M59 143 q-11 31 3 49 q12 14 29 7 q-15 -10 -10 -27 q5 -17 0 -30 z" fill="${C.featherWarm}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
       <path d="M64 180 q9 8 18 5 M63 190 q8 6 16 4" fill="none" stroke="${C.shade}" stroke-width="2.7" stroke-linecap="round"/>`;
  const wingR = wingsUp
    ? `<g class="gus-wing-r" style="transform-origin:137px 150px">
        <path d="M132 154 q28 -12 39 -34 q12 -22 10 -42 q-13 27 -24 28 q8 -23 -1 -34 q-8 28 -19 32 q2 -24 -8 -30 q-5 34 -15 50 z" fill="${C.featherWarm}" stroke="${ink}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M166 109 q-16 19 -34 26" fill="none" stroke="${C.shade}" stroke-width="3" stroke-linecap="round"/>
      </g>`
    : `<path d="M141 143 q11 31 -3 49 q-12 14 -29 7 q15 -10 10 -27 q-5 -17 0 -30 z" fill="${C.featherWarm}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
       <path d="M136 180 q-9 8 -18 5 M137 190 q-8 6 -16 4" fill="none" stroke="${C.shade}" stroke-width="2.7" stroke-linecap="round"/>`;

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
  <filter id="${id}-felt" x="-15%" y="-15%" width="130%" height="130%">
    <feTurbulence type="fractalNoise" baseFrequency=".055 .45" numOctaves="3" seed="7" result="fibers"/>
    <feDisplacementMap in="SourceGraphic" in2="fibers" scale="1.7" xChannelSelector="R" yChannelSelector="G" result="rough"/>
    <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="11" result="grain"/>
    <feComposite in="grain" in2="SourceAlpha" operator="in" result="cloth"/>
    <feColorMatrix in="cloth" values="0 0 0 0 .27 0 0 0 0 .22 0 0 0 0 .15 0 0 0 .16 0" result="clothTint"/>
    <feBlend in="rough" in2="clothTint" mode="multiply"/>
  </filter>
  <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="${C.navy}" flood-opacity=".22"/>
  </filter>
  <linearGradient id="${id}-belly" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.feather}"/>
    <stop offset="1" stop-color="${C.featherWarm}"/>
  </linearGradient>
</defs>
<g filter="url(#${id}-shadow)">
  <ellipse cx="100" cy="222" rx="54" ry="6" fill="${C.navy}" opacity="0.15"/>
  <g filter="url(#${id}-felt)">
    <path d="M83 205 q-2 7 -12 15 h27 q-2 -10 -5 -16 z M113 204 q2 8 -5 16 h28 q-5 -10 -13 -17 z" fill="${C.amber}" stroke="${C.amberDark}" stroke-width="2.5" stroke-linejoin="round"/>
    ${wingL}${wingR}
    <path d="M100 116 c-38 -2 -58 25 -57 58 c1 29 23 42 55 42 c34 1 58 -12 59 -42 c1 -31 -17 -56 -57 -58 z" fill="url(#${id}-belly)" stroke="${ink}" stroke-width="3.4"/>
    <ellipse cx="101" cy="174" rx="35" ry="30" fill="${C.feather}" opacity=".58" stroke="${C.shade}" stroke-width="2" stroke-dasharray="2.5 5"/>
    <path d="M72 181 q8 8 16 1 M93 194 q8 7 16 0 M117 181 q8 8 16 0" fill="none" stroke="${C.shade}" stroke-width="3" stroke-linecap="round"/>
    <path d="M53 165 q-5 5 0 10 M148 163 q6 5 1 11" fill="none" stroke="${C.navy}" stroke-width="1.5" opacity=".55"/>
    <g transform="rotate(${tilt} 100 120)">
      <path d="M83 130 c-5 -25 -5 -46 2 -65 q12 -8 29 1 c-5 21 -3 43 7 63 q-18 10 -38 1 z" fill="${C.featherWarm}" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round"/>
      <path d="M76 117 q24 14 50 0 l4 14 q-28 13 -58 0 z" fill="${C.teal}" stroke="${C.tealDark}" stroke-width="2.8" stroke-linejoin="round"/>
      <path d="M95 130 l-5 22 l14 -9 l8 13 l3 -27 z" fill="${C.teal}" stroke="${C.tealDark}" stroke-width="2.8" stroke-linejoin="round"/>
      <path d="M80 123 q22 10 46 0" fill="none" stroke="${C.ivory}" stroke-width="1.7" stroke-dasharray="2.5 4"/>
      <path d="${tufts}" fill="${C.featherWarm}" stroke="${ink}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M71 72 q1 -27 25 -35 q28 -8 43 13 q14 20 1 42 q-13 21 -43 18 q-25 -3 -27 -25 q-1 -7 1 -13 z" fill="${C.feather}" stroke="${ink}" stroke-width="3.4"/>
      <path d="M75 78 q-4 17 12 26" fill="none" stroke="${C.shade}" stroke-width="5" stroke-linecap="round" opacity=".65"/>
      <path d="M80 55 q9 -9 19 -5 M108 49 q11 -5 21 4" fill="none" stroke="${C.navy}" stroke-width="2.6" stroke-linecap="round"/>
      ${eye(91, 67, 13.5, 15.5, -7)}${eye(117, 65, 12.5, 14.5, 7)}
      ${beak}
      <ellipse cx="80" cy="89" rx="7" ry="4.5" fill="${C.amber}" opacity=".28"/>
      <path d="M73 96 q8 5 15 1" fill="none" stroke="${C.shade}" stroke-width="2" stroke-linecap="round"/>
    </g>
${extras}
  </g>
</g>
</svg>`;
}

/** Simplified puppet head: readable at 16px without the full felt filter. */
export function gusIconSvg(theme: GusTheme = "light"): string {
  const bg = theme === "dark" ? C.ivory : C.navy;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Gus the Goose icon"><title>Gus the Goose icon</title>
<rect width="64" height="64" rx="14" fill="${bg}"/>
<path d="M12 55 q20 8 39 -1 l-3 -9 q-15 7 -32 0 z" fill="${C.teal}" stroke="${C.tealDark}" stroke-width="1.2"/>
<path d="M18 21 q-3 -11 7 -6 q2 -13 8 -3 q8 -10 8 4 q8 -5 5 6" fill="${C.featherWarm}" stroke="${C.navy}" stroke-width="1.8" stroke-linecap="round"/>
<path d="M14 33 q0 -17 17 -20 q18 -3 24 12 q5 14 -7 24 q-11 9 -25 3 q-10 -5 -9 -19 z" fill="${C.feather}" stroke="${C.navy}" stroke-width="2"/>
<ellipse cx="27" cy="29" rx="7" ry="8" fill="#fffdf7" stroke="${C.navy}" stroke-width="1.5"/><circle cx="29" cy="31" r="3.2" fill="${C.navy}"/><circle cx="30" cy="29.5" r="1" fill="#fff"/>
<ellipse cx="40" cy="28" rx="6.5" ry="7.5" fill="#fffdf7" stroke="${C.navy}" stroke-width="1.5"/><circle cx="42" cy="30" r="3" fill="${C.navy}"/><circle cx="43" cy="28.5" r="1" fill="#fff"/>
<path d="M42 35 q13 -4 19 3 q-7 8 -19 6 q-5 -5 0 -9 z" fill="${C.amber}" stroke="${C.amberDark}" stroke-width="1.6"/>
<path d="M18 42 q5 4 10 1" fill="none" stroke="${C.shade}" stroke-width="2" stroke-linecap="round"/>
</svg>`;
}
