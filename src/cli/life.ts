// Runs one life and prints its highlight reel.
//   npm run life -- --seed 7 [--years 40] [--top 30] [--ext 0.9] [--novelty 0.5] [--circle 0.5] [--hobbies run,games]

import { CLUBS } from '../sim/activities';
import { findHighlights, LEVEL_NAMES, selectReel, formatOdds } from '../sim/highlights';
import { descriptor } from '../sim/people';
import { runLife } from '../sim/sim';
import { computeStats, type CircleCounts } from '../sim/stats';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const num = (name: string): number | undefined => (arg(name) === undefined ? undefined : Number(arg(name)));

const seed = num('seed') ?? 1;
const top = num('top') ?? 30;
const t0 = Date.now();
const life = runLife({
  seed,
  years: num('years'),
  ego: { ext: num('ext'), novelty: num('novelty'), circleSeed: num('circle'), hobbies: arg('hobbies')?.split(',') },
});
const ms = Date.now() - t0;

const { world, start } = life;
const me = world.agents[life.ego];
const stats = computeStats(life);
const city = (c: number) => world.cities[c].name;
const describe = (x: number, low: string, mid: string, high: string) => (x < 0.35 ? low : x < 0.65 ? mid : high);
const circle = (c: CircleCounts) =>
  `${c.inner} inner circle, ${c.close - c.inner} close friends, ${c.friend - c.close} friends, ${c.acquaintance - c.friend} acquaintances`;

console.log(`\n══ The life of ${me.name} ══  (seed ${seed}, ${life.years} years, simulated in ${(ms / 1000).toFixed(1)}s)\n`);
console.log(
  `Born ${me.birthYear} in ${city(me.hometown)}. In ${life.startYear}, aged ${start.age}, living in ${city(start.city)} ` +
    `and working at ${world.venues[start.work].name}.`,
);
console.log(
  `${describe(me.ext, 'Introverted', 'Somewhere between introvert and extravert', 'Extraverted')} (${me.ext.toFixed(2)}), ` +
    `${describe(me.novelty, 'sticks to familiar places', 'sometimes tries new places', 'always trying new places')} (${me.novelty.toFixed(2)}). ` +
    `${descriptor(me)[0].toUpperCase()}${descriptor(me).slice(1)}. Into ${start.hobbies.map((h) => CLUBS[h].hobby).join(', ')}.`,
);
if (start.clubs.length) console.log(`Member of ${start.clubs.map((c) => world.venues[c].name).join(', ')}.`);
console.log(`Family: ${me.family.filter((f) => f !== me.partner).map((f) => world.agents[f].name).join(', ')}.`);
console.log(`Starts out with ${circle(stats.startCircle)}.\n`);

const reel = selectReel(findHighlights(life), top);
let lastYear = -1;
for (const h of reel) {
  const year = life.startYear + Math.floor(h.week / 52);
  if (year !== lastYear) {
    console.log(`\n${year} · age ${year - me.birthYear}`);
    lastYear = year;
  }
  const dots = h.scaffold ? '◆  ' : h.score >= 9 ? '●●●' : h.score >= 6 ? '●● ' : '●  ';
  console.log(`  ${dots} ${h.text}`);
}

console.log(`\n── In ${life.years} years ──`);
console.log(
  `Met ${stats.metDuringLife} new people. ${stats.becameFriends} became friends, ${stats.becameClose} close friends, ` +
    `${stats.becameInner} inner circle.`,
);
console.log(`Moved ${stats.moves} times, changed jobs ${stats.jobs} times, made ${stats.familyVisits} trips to see family.`);
if (stats.partneredAt !== null) console.log(`First got together with someone at ${stats.partneredAt}.`);
else if (life.start.partner >= 0) console.log(`Already with ${world.agents[life.start.partner].name} when the story starts.`);
else console.log('Never found a partner.');
if (stats.breakups) console.log(`Went through ${stats.breakups} breakup${stats.breakups === 1 ? '' : 's'}.`);
console.log(me.partner >= 0 ? `Ends the story with ${world.agents[me.partner].name}.` : 'Ends the story single.');
console.log(`Typical circle: ${circle(roundCircle(stats.avgCircle))}.`);
console.log(`Ends with ${circle(stats.endCircle)}, living in ${city(me.city)}.`);

const best = [...life.ties.entries()]
  .filter(([, t]) => !t.kin)
  .sort((a, b) => b[1].peak - a[1].peak)
  .slice(0, 5);
console.log('\nClosest people over the whole life:');
for (const [o, t] of best) {
  const odds = t.met >= 0 ? `, ${formatOdds(t.p)} the week you met` : '';
  const year = life.startYear + Math.floor(t.met / 52);
  console.log(
    `  ${world.agents[o].name}: met ${year} (${t.ctx}${odds}), peaked as ${LEVEL_NAMES[life.sim.levelOf(t.peak)]}, ` +
      `now ${LEVEL_NAMES[life.sim.levelOf(t.now)]}`,
  );
}
console.log('');

function roundCircle(c: CircleCounts): CircleCounts {
  return { inner: Math.round(c.inner), close: Math.round(c.close), friend: Math.round(c.friend), acquaintance: Math.round(c.acquaintance) };
}
