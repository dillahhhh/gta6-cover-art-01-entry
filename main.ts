// SUNSET PRESS — entrypoint.
// Copies app/ and screenshots/ into the output directory and writes
// dossier.json describing the hand-in. Run:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cp, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root: string = path.dirname(fileURLToPath(import.meta.url));
const out: string = process.env.MAKEFUN_OUTPUT_DIR ?? "out";

async function listFiles(dir: string, base: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir)) {
    const full = path.join(dir, entry);
    const st = await stat(full);
    if (st.isDirectory()) found.push(...(await listFiles(full, base)));
    else found.push(path.relative(base, full));
  }
  return found.sort();
}

await mkdir(out, { recursive: true });
await cp(path.join(root, "app"), path.join(out, "app"), { recursive: true });
await cp(path.join(root, "screenshots"), path.join(out, "screenshots"), { recursive: true });

const appFiles = await listFiles(path.join(out, "app"), out);
const shotFiles = await listFiles(path.join(out, "screenshots"), out);

const dossier = {
  title: "SUNSET PRESS",
  competition: "gta6-cover-art-01",
  description:
    "One photo in. A full key-art poster out. A single-page web app that paints any photo into GTA-style cover art: one full-bleed painted hero, three slanted supporting panels, and a huge gold-to-pink wordmark. Exports exact-size PNGs at 1080x1080, 1080x1350 and 1920x1080. Fully offline.",
  sizes: [
    { name: "square", width: 1080, height: 1080 },
    { name: "portrait", width: 1080, height: 1350 },
    { name: "wide", width: 1920, height: 1080 },
  ],
  screenshots: shotFiles,
  files: [...appFiles, ...shotFiles],
  run: "node serve.ts  # serves app/ on http://localhost:8080",
};

await writeFile(path.join(out, "dossier.json"), JSON.stringify(dossier, null, 2) + "\n");
console.log("hand-in written to " + out + " (" + dossier.files.length + " files)");
