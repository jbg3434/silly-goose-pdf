// Pre-download the embedding model into the build image's cache so the
// parallel index workers never race a download.
import { embed } from "../src/lib/embed";

async function main() {
  const v = await embed(["warmup"]);
  console.log(`embedding model ready (${v[0].length} dims)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
