// main.ts — SUNSET PRESS entrypoint (Node 22, erasable TypeScript).
//
// Copies app/ + screenshots/ from this repository to /output and writes
// /output/dossier.json with the kit's own buildDossier. No build, no
// install, no network. The scorer runs this same file and requires the
// dossier to equal what buildDossier writes from the handed-in app/.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repo = dirname(fileURLToPath(import.meta.url));
const out = '/output';

mkdirSync(join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(repo, 'app'), join(out, 'app'), { recursive: true });
cpSync(join(repo, 'screenshots'), join(out, 'screenshots'), { recursive: true });

writeFileSync(join(out, 'dossier.json'), buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
}));

console.log('SUNSET PRESS dossier written to /output/dossier.json');
