// A simulated life with some of its people given names you know. For fun, not for accuracy:
// the life is whatever the simulation made; only the names (and the cities' names) are chosen.
//
//   npm run recast -- --scan 1-12 --cast src/web/scenes/blue-shoes/life.json     look for a life that fits
//   npm run recast -- --seed 4 --cast src/web/scenes/blue-shoes/life.json        write public/lives/<as>.json
//
// The cast file says who to name: the protagonist, their partner, the one person the story is
// about, and friends in order of how much they mattered. Names are changed before the life is
// told, so every caption, arc and highlight uses them.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { exportLife, type LifeExport } from '../sim/export';
import { runLife, type LifeResult } from '../sim/sim';
import type { CityConfig } from '../sim/world';

interface CastFile {
  /** The number the life is saved and opened under. */
  as: number;
  startYear: number;
  years?: number;
  cities: CityConfig[];
  /** The city the protagonist should grow up in and the one they should move to, by name; used by --scan. */
  from?: string;
  to?: string;
  hobbies?: string[];
  /** The year the named people were born, so that friends are the protagonist's age whatever the simulation gave them. */
  born?: number;
  ego: string;
  partner?: string;
  lead: string;
  /** If the story turns out to be about the partner: give the lead's name to the friend met nearest this year. */
  leadMet?: number;
  friends: string[];
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const cast = JSON.parse(readFileSync(arg('cast') ?? 'src/web/scenes/blue-shoes/life.json', 'utf8')) as CastFile;
const run = (seed: number): LifeResult => runLife({ seed, startYear: cast.startYear, years: cast.years, cities: cast.cities, ego: { hobbies: cast.hobbies } });

function summary(d: LifeExport): string {
  const yr = (w: number) => d.startYear + Math.floor(w / 52);
  const name = (id: number) => d.people.find((p) => p.id === id)?.name ?? '?';
  const moves = d.ego.cities.map(([w, c]) => `${yr(w)} ${d.cities[c]}`).join(' > ');
  const partners = d.ego.partners.map((p) => `${name(p.id)} ${p.from === null ? 'before' : yr(p.from)}${p.to === null ? '' : `-${yr(p.to)}`}`).join(', ') || 'none';
  const lead = d.story.leads.find((l) => l.main);
  return `${d.ego.name} | ${moves} | partner: ${partners} | lead: ${lead?.name} (${lead?.tag})`;
}

const scan = arg('scan');
if (scan) {
  const [a, b] = scan.split('-').map(Number);
  const only = arg('only') ? Number(arg('only')) : null;
  for (let seed = a; seed <= (b ?? a); seed++) {
    if (only !== null && seed !== only) continue;
    console.log(`seed ${seed}: ${summary(exportLife(run(seed)))}`);
  }
} else {
  const seed = Number(arg('seed') ?? 1);
  const life = run(seed);
  const first = exportLife(life);
  const agents = life.world.agents;
  // The protagonist's family takes the new surname with them.
  const oldLast = agents[life.ego].name.split(' ').slice(1).join(' ');
  const newLast = cast.ego.split(' ').slice(1).join(' ');
  for (const p of first.people) if (p.kin && agents[p.id].name.endsWith(` ${oldLast}`)) agents[p.id].name = `${agents[p.id].name.split(' ')[0]} ${newLast}`;
  agents[life.ego].name = cast.ego;
  const taken = new Set<number>([life.ego]);
  const give = (id: number | undefined, name: string | undefined) => {
    if (id === undefined || !name || taken.has(id)) return false;
    // A name you know never goes to someone who dies in the story.
    if (first.people.find((p) => p.id === id)?.died != null) return false;
    agents[id].name = name;
    if (cast.born) agents[id].birthYear = cast.born;
    taken.add(id);
    return true;
  };
  // The partner they were with longest, the one person the story is about, then friends by how much they mattered.
  const span = (p: { from: number | null; to: number | null }) => (p.to ?? first.years * 52) - (p.from ?? 0);
  const partner = [...first.ego.partners].sort((x, y) => span(y) - span(x))[0];
  give(partner?.id, cast.partner);
  const kin = new Set(first.people.filter((p) => p.kin).map((p) => p.id));
  const lead = first.story.leads.find((l) => l.main && !taken.has(l.id)) ?? first.story.leads.find((l) => !taken.has(l.id));
  if (!give(lead?.id, cast.lead)) {
    // The story is about the partner. The lead's name goes to a friend from the cast, met about when they should have been.
    const want = cast.leadMet ?? cast.startYear;
    const metYear = (id: number) => first.startYear + Math.floor((first.people.find((p) => p.id === id)?.met ?? 0) / 52);
    const seen = (id: number) => first.arcs.people.find((p) => p.id === id)?.seen ?? 0;
    const alive = (id: number) => first.people.find((p) => p.id === id)?.died == null;
    const pick = first.arcs.cast.filter((id) => !kin.has(id) && !taken.has(id) && alive(id)).sort((x, y) => Math.abs(metYear(x) - want) - Math.abs(metYear(y) - want) || seen(y) - seen(x))[0];
    give(pick, cast.lead);
  }
  const friends = [...first.arcs.cast, ...first.arcs.people.map((p) => p.id)].filter((id) => !kin.has(id));
  const names = [...cast.friends];
  for (const id of friends) {
    if (!names.length) break;
    if (give(id, names[0])) names.shift();
  }
  const data = exportLife(life);
  data.seed = cast.as;
  writeFileSync(`public/lives/${cast.as}.json`, JSON.stringify(data));
  console.log(`seed ${seed} as ${cast.as}: ${summary(data)}`);
  const index = readdirSync('public/lives')
    .filter((f) => /^\d+\.json$/.test(f))
    .map((f) => {
      const d = JSON.parse(readFileSync(`public/lives/${f}`, 'utf8')) as LifeExport;
      return { seed: d.seed, name: d.ego.name, born: d.ego.born, hometown: d.cities[d.ego.hometown] };
    })
    .sort((x, y) => x.seed - y.seed);
  writeFileSync('public/lives/index.json', JSON.stringify(index));
}
