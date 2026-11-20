import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

// The performance budget of plan.md §11, measured from Vite's build manifest:
//  - STARTUP JavaScript: what the app loads before it can show anything: the entry (index.html -> src/main.tsx) and
//    the App chunk it imports at once, plus everything those two import statically. At most 170 kB gzip.
//  - every other (lazily loaded) chunk, on its own: at most 100 kB gzip.
const STARTUP_LIMIT = 170 * 1000;
const CHUNK_LIMIT = 100 * 1000;
const DIST = 'dist';
const STARTUP_ROOTS = ['index.html', 'src/app/App.tsx'];

interface ManifestEntry {
  file: string;
  imports?: string[];
}
const manifest = JSON.parse(await readFile(`${DIST}/.vite/manifest.json`, 'utf8')) as Record<
  string,
  ManifestEntry
>;

const startup = new Set<string>();
function addWithImports(key: string): void {
  const entry = manifest[key];
  if (!entry || startup.has(entry.file)) return;
  startup.add(entry.file);
  for (const imported of entry.imports ?? []) addWithImports(imported);
}
for (const root of STARTUP_ROOTS) addWithImports(root);

const gzipSize = async (file: string): Promise<number> =>
  gzipSync(await readFile(`${DIST}/${file}`)).length;
const kb = (bytes: number): string => `${(bytes / 1000).toFixed(1)} kB`;

let failed = false;
let startupTotal = 0;
for (const file of startup) startupTotal += await gzipSize(file);
console.log(
  `Startup JavaScript (${startup.size} files): ${kb(startupTotal)} of ${kb(STARTUP_LIMIT)}`,
);
if (startupTotal > STARTUP_LIMIT) failed = true;

const lazy = new Set(
  Object.values(manifest)
    .map((entry) => entry.file)
    .filter((file) => file.endsWith('.js') && !startup.has(file)),
);
for (const file of lazy) {
  const size = await gzipSize(file);
  const over = size > CHUNK_LIMIT;
  console.log(`  lazy ${file}: ${kb(size)}${over ? `  OVER ${kb(CHUNK_LIMIT)}` : ''}`);
  if (over) failed = true;
}
if (failed) {
  console.error('Bundle size budget exceeded (plan.md §11).');
  process.exitCode = 1;
}
