// Simulates lives and writes them as JSON for the browser views.
//   npm run export -- --seeds 1,3,5 [--years 40] [--start-age 18]
// Files go to public/lives/<seed>.json, and public/lives/index.json lists what is there.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { exportLife, type LifeExport } from '../sim/export';
import { runLife } from '../sim/sim';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const seeds = (arg('seeds') ?? arg('seed') ?? '1').split(',').map(Number);
const years = arg('years') ? Number(arg('years')) : undefined;
const startAge = arg('start-age') ? Number(arg('start-age')) : undefined;
const dir = 'public/lives';
mkdirSync(dir, { recursive: true });

for (const seed of seeds) {
  const t0 = Date.now();
  const data = exportLife(runLife({ seed, years, startAge }));
  const json = JSON.stringify(data);
  writeFileSync(`${dir}/${seed}.json`, json);
  console.log(`seed ${seed}: ${data.ego.name}, ${(json.length / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

// Rebuild the index from whatever is on disk, so parallel runs do not clobber each other.
const index = readdirSync(dir)
  .filter((f) => /^\d+\.json$/.test(f))
  .map((f) => {
    const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as LifeExport;
    return { seed: d.seed, name: d.ego.name, born: d.ego.born, hometown: d.cities[d.ego.hometown] };
  })
  .sort((a, b) => a.seed - b.seed);
writeFileSync(`${dir}/index.json`, JSON.stringify(index));
