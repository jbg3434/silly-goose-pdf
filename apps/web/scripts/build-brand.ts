import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { GUS_POSES, gusIconSvg, gusSvg } from "../src/brand/gus";

const out = path.resolve(__dirname, "../public/brand");
mkdirSync(out, { recursive: true });
for (const theme of ["light", "dark"] as const) {
  for (const pose of GUS_POSES) {
    writeFileSync(path.join(out, `gus-${pose}-${theme}.svg`), gusSvg({ pose, theme, id: `gus-${pose}` }));
  }
  writeFileSync(path.join(out, `gus-icon-${theme}.svg`), gusIconSvg(theme));
}
writeFileSync(path.resolve(__dirname, "../src/app/icon.svg"), gusIconSvg("light"));
console.log(`wrote ${GUS_POSES.length * 2 + 2} brand SVGs to ${out}`);
