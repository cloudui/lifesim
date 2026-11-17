// A life written by hand, turned into the file the tabs read.
//
//   npm run handlife                      reads src/web/scenes/blue-shoes/life.json, writes public/lives/<as>.json
//   npm run handlife -- --life some.json
//
// Nothing is simulated. The hand-written file lists people with a closeness curve, the lines of
// their story, and the moments worth showing; this fills in what the views need around that
// (quarterly snapshots, how often people saw each other, counts) so the life can be explored
// like a simulated one. It is for a feel, not for accuracy.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { ArcExport, LifeExport, PersonExport, SnapshotExport, VenueExport } from '../sim/export';
import type { Highlight } from '../sim/highlights';
import type { StoryBeat, StoryLead } from '../sim/story';

type Pt = [number, number];
interface HandPerson {
  name: string; born: number; trait: string; tag: string; label?: string; kin?: string; role?: ArcExport['role']; shape?: string;
  met?: number; ctx?: PersonExport['ctx']; venue?: string; via?: string; p?: number; partner?: number; main?: boolean; cast?: boolean; look?: string;
  cities: Pt[]; curve: Pt[]; group: string[]; visits?: number[]; beats: [number, string][];
}
interface HandLife {
  as: number; startYear: number; years: number; cities: string[];
  ego: { name: string; born: number; hometown: number; trait: string; ext: number; novelty: number; hobbies: string[]; cities: Pt[]; jobs: number };
  venues: { name: string; kind: VenueExport['kind']; city: number }[];
  people: HandPerson[];
  threads: string[];
  moments: [number, Highlight['type'], string, string[], boolean, string | null, number?][];
  story: [number, StoryBeat['scene'], StoryBeat['kind'], string, string, string[]][];
}

const i = process.argv.indexOf('--life');
const src = JSON.parse(readFileSync(i >= 0 ? process.argv[i + 1] : 'src/web/scenes/blue-shoes/life.json', 'utf8')) as HandLife;
const LEVELS = [0.05, 0.18, 0.4, 0.62];
const weeks = src.years * 52;
const wk = (year: number) => Math.max(0, Math.min(weeks, Math.round((year - src.startYear) * 52)));
const yr = (w: number) => src.startYear + w / 52;
/** A value on a line through the points, flat before the first and after the last. */
function at(curve: Pt[], year: number): number {
  if (year < curve[0][0]) return 0;
  for (let k = 1; k < curve.length; k++) {
    const [x0, y0] = curve[k - 1];
    const [x1, y1] = curve[k];
    if (year <= x1) return y0 + ((y1 - y0) * (year - x0)) / Math.max(1e-6, x1 - x0);
  }
  return curve[curve.length - 1][1];
}
const cityAt = (tl: Pt[], year: number) => tl.filter(([y]) => y <= year).pop()?.[1] ?? tl[0][1];

const EGO = 1;
const ids = new Map(src.people.map((p, k) => [p.name, k + 2]));
const idOf = (name: string) => { const id = ids.get(name); if (id === undefined) throw new Error(`no such person: ${name}`); return id; };
const venues: VenueExport[] = src.venues.map((v, k) => ({ id: k, ...v }));
const venueOf = (name: string | null | undefined) => venues.find((v) => v.name === name)?.id;

const people: PersonExport[] = src.people.map((p) => {
  const peak = Math.max(...p.curve.map(([, y]) => y));
  return {
    id: idOf(p.name), name: p.name, born: p.born, trait: p.trait, hobbies: [], kin: !!p.kin,
    met: p.kin ? -(src.startYear - src.ego.born) * 52 : Math.round(((p.met ?? src.startYear) - src.startYear) * 52),
    ctx: p.kin ? 'family' : p.ctx ?? 'hangout', venue: p.venue ?? null, via: p.via ?? null, p: p.kin ? 1 : p.p ?? 0.05,
    peak, depth: peak * 0.85, compat: 0.5 + peak * 0.4,
    cities: p.cities.map(([y, c]): [number, number] => [wk(y), c]), died: null,
    ...(p.look ? { look: p.look } : {}),
  };
});

// Every quarter: how close everyone is, and which of them know each other.
const snapshots: SnapshotExport[] = [];
for (let w = 0; w <= weeks; w += 13) {
  const here = src.people.map((p) => ({ p, c: at(p.curve, yr(w)) })).filter((x) => x.c >= 0.03);
  const nodes = here.map(({ p, c }): [number, number, number] => [idOf(p.name), Math.round(c * 100), Math.round(c * 85)]);
  const edges: [number, number][] = [];
  for (let a = 0; a < here.length; a++) for (let b = a + 1; b < here.length; b++) {
    if (here[a].c >= LEVELS[1] && here[b].c >= LEVELS[1] && here[a].p.group.some((g) => here[b].p.group.includes(g))) edges.push([idOf(here[a].p.name), idOf(here[b].p.name)]);
  }
  snapshots.push({ week: w, nodes, edges });
}

// How often two people saw each other: often when close and in the same city, rarely otherwise, and a lot during a visit.
const arcs: ArcExport[] = src.people.map((p) => {
  const seenAt: number[] = [];
  let due = 0.5;
  for (let w = Math.max(0, wk(p.met ?? src.startYear)); w < weeks; w++) {
    const y = yr(w);
    const c = at(p.curve, y);
    const same = cityAt(p.cities, y) === cityAt(src.ego.cities, y);
    const visiting = (p.visits ?? []).some((v) => Math.abs(v - y) < 0.03);
    due += visiting ? 3 : same ? c * c * (p.kin ? 2.2 : 1.0) : c * (p.kin ? 0.09 : 0.03);
    while (due >= 1) { seenAt.push(w); due -= 1; }
  }
  const close = snapshots.filter((s) => (s.nodes.find((n) => n[0] === idOf(p.name))?.[1] ?? 0) >= LEVELS[2] * 100).map((s) => s.week);
  return {
    id: idOf(p.name), role: p.kin ? 'family' : p.role ?? 'chance', label: p.kin ?? p.label ?? '', tag: p.tag, seenAt,
    shape: p.kin ? '' : p.shape ?? '', cast: !!p.cast, closeFrom: close[0] ?? -1, closeTo: close[close.length - 1] ?? -1,
    seen: seenAt.length, last: seenAt[seenAt.length - 1] ?? -1, beats: p.beats.map(([y, text]) => ({ week: wk(y), text })),
  };
});
arcs.sort((a, b) => Number(b.cast) - Number(a.cast) || b.seen - a.seen);

const highlights: Highlight[] = src.moments.map(([y, type, text, names, scaffold, venue, score]) => ({
  week: wk(y), type, score: score ?? (scaffold ? 8 : 6), text, people: names.map(idOf), scaffold, ...(venueOf(venue) !== undefined ? { venue: venueOf(venue) } : {}),
})).sort((a, b) => a.week - b.week);

const egoCities = src.ego.cities.map(([y, c]): [number, number] => [wk(y), c]);
const partners = src.people.filter((p) => p.partner).map((p) => ({ id: idOf(p.name), from: wk(p.partner!), to: null }));
const leads: StoryLead[] = [
  ...src.people.filter((p) => p.main).map((p): StoryLead => ({ id: idOf(p.name), name: p.name, tag: p.tag, main: true, ending: 'close' })),
  ...src.people.filter((p) => p.partner && !p.main).map((p): StoryLead => ({ id: idOf(p.name), name: p.name, tag: p.tag, main: false, ending: 'together' })),
];
const beats: StoryBeat[] = src.story.map(([y, scene, kind, title, text, names], k) => {
  const prev = k > 0 ? cityAt(src.ego.cities, src.story[k - 1][0]) : -1;
  const city = cityAt(src.ego.cities, y);
  return {
    week: wk(y), age: Math.floor(y) - src.ego.born, year: Math.floor(y), scene, kind, title, text, people: names.map(idOf), venue: -1,
    weight: kind === 'turn' ? 9 : 6, stage: names.map(idOf), empty: 0, city, from: scene === 'move' ? prev : -1, place: '', otherCity: scene === 'gap' ? 1 : -1,
  };
});

// A world for the map: the people in the story, and a few hundred dots who are nobody in particular.
const population: [number, [number, number][]][] = [[EGO, egoCities], ...people.map((p): [number, [number, number][]] => [p.id, p.cities])];
for (let k = 0; k < 600; k++) population.push([1000 + k, [[0, k % 3]]]);

const friends = (s: SnapshotExport) => {
  const out = { inner: 0, close: 0, friend: 0, acquaintance: 0 };
  for (const [id, c] of s.nodes) {
    if (people.find((p) => p.id === id)?.kin) continue;
    if (c >= LEVELS[3] * 100) out.inner++;
    if (c >= LEVELS[2] * 100) out.close++;
    if (c >= LEVELS[1] * 100) out.friend++;
    if (c >= LEVELS[0] * 100) out.acquaintance++;
  }
  return out;
};
const circles = snapshots.map(friends);
const mean = (key: 'inner' | 'close' | 'friend' | 'acquaintance') => circles.reduce((s, c) => s + c[key], 0) / circles.length;
const others = people.filter((p) => !p.kin);

const data: LifeExport = {
  seed: src.as, startYear: src.startYear, years: src.years, levels: LEVELS, cities: src.cities,
  ego: { id: EGO, name: src.ego.name, born: src.ego.born, hometown: src.ego.hometown, trait: src.ego.trait, ext: src.ego.ext, novelty: src.ego.novelty, hobbies: src.ego.hobbies, cities: egoCities, partners },
  people, highlights,
  arcs: { cast: arcs.filter((a) => a.cast).map((a) => a.id).sort((a, b) => people.find((p) => p.id === a)!.met - people.find((p) => p.id === b)!.met), people: arcs, threads: src.threads },
  story: { leads, beats },
  venues, population, deaths: [], snapshots,
  stats: {
    metDuringLife: others.filter((p) => p.met >= 0).length, becameFriends: others.filter((p) => p.peak >= LEVELS[1]).length,
    becameClose: others.filter((p) => p.peak >= LEVELS[2]).length, becameInner: others.filter((p) => p.peak >= LEVELS[3]).length,
    moves: egoCities.length - 1, jobs: src.ego.jobs, familyVisits: arcs.filter((a) => a.role === 'family').reduce((s, a) => s + a.seen, 0),
    partneredAt: partners.length ? Math.floor(yr(partners[0].from)) - src.ego.born : null, breakups: 0, fights: 0, mends: 0, losses: 0,
    worldFights: 0, worldMends: 0, worldDeaths: 0, worldCouples: 0, worldBreakups: 0,
    avgCircle: { inner: mean('inner'), close: mean('close'), friend: mean('friend'), acquaintance: mean('acquaintance') },
    startCircle: circles[0], endCircle: circles[circles.length - 1], moveRetention: null, medianFriendshipYears: null, convenienceShare: 0.2, avgDeep: mean('close'),
  },
};
writeFileSync(`public/lives/${src.as}.json`, JSON.stringify(data));
const index = readdirSync('public/lives')
  .filter((f) => /^\d+\.json$/.test(f))
  .map((f) => {
    const d = JSON.parse(readFileSync(`public/lives/${f}`, 'utf8')) as LifeExport;
    return { seed: d.seed, name: d.ego.name, born: d.ego.born, hometown: d.cities[d.ego.hometown] };
  })
  .sort((a, b) => a.seed - b.seed);
writeFileSync('public/lives/index.json', JSON.stringify(index));
console.log(`${data.ego.name}: ${people.length} people, ${highlights.length} moments, ${beats.length} story beats -> public/lives/${src.as}.json`);
for (const a of arcs.filter((x) => x.cast)) console.log(`  ${people.find((p) => p.id === a.id)!.name}: seen ${a.seen}`);
