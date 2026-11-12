// Runs one life and retells it as the people who mattered.
//   npm run people -- --seed 7 [--years 40] [--cast 10]   (--cast fixes the cast size; by default it is 7 to 14)

import { findArcs, SHAPE_NAMES, type ArcsResult } from '../sim/arcs';
import { runLife, type LifeResult } from '../sim/sim';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const num = (name: string): number | undefined => (arg(name) === undefined ? undefined : Number(arg(name)));

export function printPeople(life: LifeResult, arcs: ArcsResult): void {
  const me = life.world.agents[life.ego];
  const year = (w: number) => life.startYear + Math.floor(w / 52);
  console.log(`\n══ The people in ${me.name}'s life ══  (seed ${life.seed}, ${life.years} years)\n`);
  console.log(
    `Born ${me.birthYear} in ${life.world.cities[me.hometown].name}. The story runs from ${life.startYear}, aged ${life.start.age}, ` +
      `to ${life.startYear + life.years}, aged ${life.start.age + life.years}.`,
  );
  for (const a of arcs.cast) {
    const years =
      a.closeFrom >= 0 && a.role !== 'family' ? ` · close ${year(a.closeFrom)}${year(a.closeTo) > year(a.closeFrom) ? `–${year(a.closeTo)}` : ''}` : '';
    const shape = a.role === 'family' || a.role === 'partner' ? '' : ` · ${SHAPE_NAMES[a.shape]}`;
    console.log(`\n${a.name} · ${a.label}${shape}${years}`);
    for (const b of a.beats) console.log(`  ${b.text}`);
  }
  if (arcs.threads.length) {
    console.log('\n── How they reached you ──');
    for (const t of arcs.threads) console.log(`  ${t.text}`);
  }
  console.log(`\n── Everyone else ──`);
  console.log(`  You met ${arcs.others} other people along the way. These ${arcs.cast.length} are the ones the story is about.\n`);
}

if (process.argv[1]?.endsWith('people.ts')) {
  const seed = num('seed') ?? 1;
  const life = runLife({ seed, years: num('years') });
  const size = num('cast');
  printPeople(life, findArcs(life, size === undefined ? {} : { min: size, max: size }));
}
