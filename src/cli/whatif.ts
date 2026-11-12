// "What if you had never met?" Runs a life, picks the meetings that mattered most, and runs
// the same life again with each one left out. Everything else is untouched: same seed, same
// world, same rules, so the two lives are identical up to that week.
//   npm run whatif -- --seed 7 [--n 2] [--years 40]

import { findArcs, type Arc, type ArcsResult } from '../sim/arcs';
import { formatOdds } from '../sim/highlights';
import { runLife, type LifeResult } from '../sim/sim';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const num = (name: string): number | undefined => (arg(name) === undefined ? undefined : Number(arg(name)));

const seed = num('seed') ?? 1;
const years = num('years');
const n = num('n') ?? 2;

const startAge = num('start-age');
const base = runLife({ seed, years, startAge });
const arcs = findArcs(base);
const { agents, cities, venues } = base.world;
const L = base.params.levels;
const year = (w: number) => base.startYear + Math.floor(w / 52);
const level = (s: number) => (s >= L[3] ? 'inner circle' : s >= L[2] ? 'a close friend' : s >= L[1] ? 'a friend' : 'an acquaintance');
const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** Partners during the story, in order. */
function partners(life: LifeResult): number[] {
  const out: number[] = life.start.partner >= 0 ? [life.start.partner] : [];
  for (const e of life.events) if (e.t === 'partner') out.push(e.other);
  return out;
}
const friendsOf = (a: ArcsResult) => a.cast.filter((x) => x.role !== 'family');

// The meetings worth undoing: people in the cast you met during the story, weighted by how
// much they mattered, how much came through them, and how unlikely the meeting was.
const weight = (a: Arc) => (a.score + a.ledTo.length * 2) * (1 + Math.min(4, Math.log10(1 / Math.max(a.odds ?? 0.5, 1e-9))));
const picks = arcs.cast.filter((a) => a.met >= 0).sort((a, b) => weight(b) - weight(a)).slice(0, n);

const me = agents[base.ego];
console.log(`\n══ What if? The life of ${me.name} ══  (seed ${seed}, ${base.years} years)\n`);
console.log(`In the life as it happened, the people who mattered were ${list(friendsOf(arcs).map((a) => a.name))}.`);
if (!picks.length) console.log('\nNobody in the cast was met during the story, so there is no meeting to undo.');

for (const pick of picks) {
  const odds = pick.odds !== null ? ` (${formatOdds(pick.odds)} that week)` : '';
  console.log(`\n── What if you had not met ${pick.name} in ${year(pick.met)}?${odds} ──`);
  const alt = runLife({ seed, years, startAge, skipMeeting: { week: pick.met, other: pick.id } });
  const altArcs = findArcs(alt);

  // Did you meet anyway?
  const t = alt.ties.get(pick.id);
  if (!t) console.log(`  You never meet ${pick.name}.`);
  else {
    const later = t.met - pick.met;
    const when = later < 8 ? `${later} week${later === 1 ? '' : 's'} later` : later < 78 ? `${Math.round(later / 4.3)} months later` : `${Math.round(later / 52)} years later`;
    const where = t.venue >= 0 ? ` at ${venues[t.venue].name}` : '';
    console.log(`  You meet anyway, ${when}${where}. This time ${pick.name.split(' ')[0]} becomes ${level(t.peak)} at most.`);
  }

  // The people who came through them.
  const lost = pick.ledTo.filter((x) => !alt.ties.has(x));
  if (pick.ledTo.length) {
    console.log(
      lost.length
        ? `  Of the ${pick.ledTo.length} friends who reached you through them, you never meet ${lost.length === pick.ledTo.length ? 'any' : lost.length}: ${list(lost.slice(0, 4).map((x) => agents[x].name))}${lost.length > 4 ? ' and others' : ''}.`
        : `  All ${pick.ledTo.length} of the friends who reached you through them still find their way to you.`,
    );
  }

  // Partner.
  const p0 = partners(base);
  const p1 = partners(alt);
  const names = (ids: number[]) => list(ids.map((x) => agents[x].name));
  if (p0.join() === p1.join()) console.log(p0.length ? `  Your partner is the same: ${names(p0)}.` : '  You are single in both lives.');
  else if (!p1.length) console.log(`  You never find a partner. In the life as it happened, it was ${names(p0)}.`);
  else if (!p0.length) console.log(`  You get together with ${names(p1)}. In the life as it happened, you stayed single.`);
  else console.log(`  Your partner is different: ${names(p1)} instead of ${names(p0)}.`);

  // Where you live.
  const c0 = cities[base.world.agents[base.ego].city].name;
  const c1 = cities[alt.world.agents[alt.ego].city].name;
  const m0 = base.events.filter((e) => e.t === 'move' && e.who === base.ego).length;
  const m1 = alt.events.filter((e) => e.t === 'move' && e.who === alt.ego).length;
  console.log(
    c0 === c1 && m0 === m1 ? `  You end up in ${c1} either way.`
      : c0 === c1 ? `  You still end up in ${c1}, after ${m1} move${m1 === 1 ? '' : 's'} instead of ${m0}.`
      : `  You end up in ${c1}, not ${c0}.`,
  );

  // The people who mattered: who is further from you in this version, and who is nearer.
  const lv = (x: number | undefined) => (x === undefined ? 0 : x >= L[3] ? 4 : x >= L[2] ? 3 : x >= L[1] ? 2 : 1);
  const before = friendsOf(arcs).filter((a) => a.id !== pick.id);
  const gone = before.filter((a) => lv(alt.ties.get(a.id)?.peak) < lv(base.ties.get(a.id)?.peak));
  const fresh = friendsOf(altArcs).filter((a) => lv(base.ties.get(a.id)?.peak) < lv(alt.ties.get(a.id)?.peak));
  console.log(`  Of the other ${before.length} people who mattered, ${before.length - gone.length} are as close as before.`);
  for (const a of gone) {
    const at = alt.ties.get(a.id);
    console.log(`    − ${a.name}: ${!at ? 'you never meet' : `${level(at.peak)} at most, not ${level(base.ties.get(a.id)!.peak)}`}.`);
  }
  for (const a of fresh) {
    const bt = base.ties.get(a.id);
    console.log(`    + ${a.name} (${a.label}) becomes ${level(alt.ties.get(a.id)!.peak)}: ${!bt ? 'someone you never met in the life as it happened' : `${level(bt.peak)} at most in the life as it happened`}.`);
  }
  let metBase = 0;
  let metAlt = 0;
  let shared = 0;
  for (const [o, x] of base.ties) if (x.met >= 0) { metBase++; if (alt.ties.has(o)) shared++; }
  for (const x of alt.ties.values()) if (x.met >= 0) metAlt++;
  console.log(`  You meet ${metAlt} people instead of ${metBase}. ${metBase - shared} people from the life as it happened are strangers here.`);
}
console.log('');
