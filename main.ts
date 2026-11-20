// SUNSET PRESS — the entry program (Node 22, standard library only).
// It hands the app in: copy app/ and screenshots/ from beside this file to
// the output directory, write /output/dossier.json with the vendored make.fun
// library, then prove the hand-in is sound: rebuild the dossier from the
// output itself and refuse to finish unless the two byte streams match, and
// print every output file with its size so a bad copy is visible at once.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const ENTRY_NAME = 'sunset-press';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

/** Every file under a directory, paths relative to it, in code-unit order. */
function listFiles(dir, base = '') {
  const found = [];
  for (const entry of readdirSync(join(dir, base), { withFileTypes: true })) {
    const rel = base === '' ? entry.name : `${base}/${entry.name}`;
    if (entry.isDirectory()) found.push(...listFiles(dir, rel));
    else if (entry.isFile()) found.push(rel);
  }
  return found.sort();
}

/** A screenshot over its byte cap fails the gate, so fail here first. */
function checkShotSizes(dir) {
  const cap = DOSSIER_CAPS.screenshots.max_bytes;
  for (const rel of listFiles(dir)) {
    const bytes = statSync(join(dir, rel)).size;
    if (bytes > cap) {
      throw new Error(`screenshots/${rel} is ${bytes} bytes, over the ${cap} byte cap: re-export it smaller`);
    }
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The dossier, written once from the output directory.
const dossier = buildDossier(out, DOSSIER_CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);

// Verification, new in this program: build the dossier a second time from
// the finished output and compare bytes. A copy that lost a file, a
// screenshot over its cap or a non-deterministic dossier fails here, loudly,
// instead of reaching the scorer.
const rebuilt = buildDossier(out, DOSSIER_CAPS);
if (Buffer.compare(Buffer.from(dossier), Buffer.from(rebuilt)) !== 0) {
  throw new Error('dossier.json is not what buildDossier writes from the output: refusing to hand in');
}

// A manifest of everything handed in, so the run log shows the entry's shape.
const manifest = listFiles(out).map((rel) => {
  const bytes = statSync(join(out, rel)).size;
  return `${rel} (${bytes} bytes)`;
});
const shotCount = listFiles(join(out, 'screenshots')).length;
if (shotCount < 3 || shotCount > 4) {
  throw new Error(`screenshots/ holds ${shotCount} images: the entry needs 3 or 4`);
}
checkShotSizes(join(out, 'screenshots'));
console.log(`${ENTRY_NAME}: ${manifest.length} files handed in`);
for (const line of manifest) console.log(`  ${line}`);
console.log(`dossier.json verified: ${dossier.length} bytes, identical on rebuild`);
