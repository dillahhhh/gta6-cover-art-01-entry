// main.ts — SUNSET PRESS hand-in (Node 22, standard library only).
// The program copies the app and its screenshots into the output directory and
// writes the dossier the judge reads, using the kit's vendored library.
// Run locally with:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps for this competition: the dossier text cap shapes the
// bytes; the rest refuse an entry the scorer would refuse outright.
const DOSSIER = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function countTree(dir) {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) {
      const sub = countTree(path);
      files += sub.files;
      bytes += sub.bytes;
    } else if (name.isFile()) {
      files += 1;
      bytes += statSync(path).size;
    }
  }
  return { files, bytes };
}

function handIn() {
  mkdirSync(outDir, { recursive: true });

  // The app itself: every static file under app/ (index, modules, fonts, samples).
  const appDir = join(repoRoot, 'app');
  cpSync(appDir, join(outDir, 'app'), { recursive: true });
  const appCount = countTree(appDir);

  // The screenshots: the first by name is the cover the judge leads with.
  const shotsDir = join(outDir, 'screenshots');
  mkdirSync(shotsDir, { recursive: true });
  const shotsSrc = join(repoRoot, 'screenshots');
  let shotNames = [];
  if (existsSync(shotsSrc)) {
    cpSync(shotsSrc, shotsDir, { recursive: true });
    shotNames = readdirSync(shotsSrc).filter((n) => !n.startsWith('.')).sort();
  }

  writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, DOSSIER));
  console.log(
    `SUNSET PRESS handed in: app/ ${appCount.files} files (${appCount.bytes} bytes), ` +
    `screenshots ${shotNames.join(', ') || '(none)'}, dossier written.`,
  );
}

handIn();
