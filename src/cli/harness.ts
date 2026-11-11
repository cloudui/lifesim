// Runs many lives and prints aggregate numbers, to check the model is roughly human.
//   npm run harness -- [--n 24] [--years 40] [--from 1] [--jobs 8] [--set hlMin=40 --set invitePow=1.5]
// --set overrides any number in src/sim/params.ts for this run (levels: --set levels=0.05,0.18,0.4,0.65).
// Lives run in parallel child processes.

import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { findHighlights } from '../sim/highlights';
import { runLife } from '../sim/sim';
import { computeStats, countCircle, type CircleCounts } from '../sim/stats';

function num(name: string, dflt: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : dflt;
}

const KEYS: (keyof CircleCounts)[] = ['inner', 'close', 'friend', 'acquaintance'];
const TYPES = ['met', 'smallWorld', 'nearMiss', 'reunion', 'friendsMet', 'introduced', 'fade', 'rekindle', 'friendMoved', 'friendArrived', 'hobby', 'breakup'];

interface Row {
  seconds: number;
  ego: CircleCounts;
  /** Per-agent cumulative circle counts for everyone in the world at the end. */
  pop: Record<string, number[]>;
  totals: Record<string, number | null>;
  highlights: Record<string, number>;
}

function oneLife(seed: number, years: number, params: Record<string, number | number[]>): Row {
  const t0 = Date.now();
  const life = runLife({ seed, years, params });
  const seconds = (Date.now() - t0) / 1000;
  const st = computeStats(life);
  const pop: Record<string, number[]> = { inner: [], close: [], friend: [], acquaintance: [] };
  const { sim } = life;
  for (let a = 0; a < sim.adj.length; a++) {
    const strengths: number[] = [];
    for (const t of sim.adj[a].values()) if (!t.kin) strengths.push(sim.cur(t));
    const c = countCircle(strengths, life.params.levels);
    for (const k of KEYS) pop[k].push(c[k]);
  }
  const young = life.world.agents.filter((a) => a.grewUpHere);
  const youngPartnered = young.filter((a) => a.partner >= 0).length / young.length;
  const highlights: Record<string, number> = {};
  for (const h of findHighlights(life)) highlights[h.type] = (highlights[h.type] ?? 0) + 1;
  return {
    seconds, ego: st.avgCircle, pop, highlights,
    totals: {
      'people met': st.metDuringLife,
      'became friends': st.becameFriends,
      'became close': st.becameClose,
      'became inner circle': st.becameInner,
      moves: st.moves,
      'job changes': st.jobs,
      'family trips': st.familyVisits,
      'age when partnered': st.partneredAt,
      'ever partnered (share of lives)': st.partneredAt === null ? 0 : 1,
      'younger generation partnered (share)': youngPartnered,
      'breakups (protagonist)': st.breakups,
      'world: breakups per couple formed (share)': st.worldCouples ? st.worldBreakups / st.worldCouples : null,
      'friends kept 2y after a move': st.moveRetention,
      'median friendship length (y)': st.medianFriendshipYears,
      'convenience friends (share of friends)': st.convenienceShare,
      'deep friends, close on depth alone': st.avgDeep,
    },
  };
}

if (process.argv.includes('--worker')) {
  process.on('message', (m: { seed: number; years: number; params: Record<string, number | number[]> } | 'done') => {
    if (m === 'done') process.exit(0);
    process.send!(oneLife(m.seed, m.years, m.params));
  });
} else {
  const n = num('n', 24);
  const years = num('years', 40);
  const from = num('from', 1);
  const jobs = Math.max(1, Math.min(n, num('jobs', Math.max(1, cpus().length - 2))));
  const params: Record<string, number | number[]> = {};
  process.argv.forEach((a, i) => {
    if (a !== '--set') return;
    const [k, v] = process.argv[i + 1].split('=');
    params[k] = v.includes(',') ? v.split(',').map(Number) : Number(v);
  });
  if (Object.keys(params).length) console.log('overrides:', JSON.stringify(params));
  const queue = Array.from({ length: n }, (_, i) => from + i);
  const rows: Row[] = [];
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: jobs }, () =>
      new Promise<void>((resolve, reject) => {
        const child = fork(fileURLToPath(import.meta.url), ['--worker']);
        const next = () => {
          const seed = queue.shift();
          if (seed === undefined) {
            child.send('done');
            resolve();
          } else child.send({ seed, years, params });
        };
        child.on('message', (row: Row) => {
          rows.push(row);
          process.stderr.write('.');
          next();
        });
        child.on('error', reject);
        next();
      }),
    ),
  );
  process.stderr.write('\n');
  report(rows, n, years, from, (Date.now() - t0) / 1000);
}

function report(rows: Row[], n: number, years: number, from: number, wall: number): void {
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const pct = (xs: number[], q: number) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN;
  };
  const line = (label: string, xs: number[], digits = 1) =>
    console.log(
      `  ${label.padEnd(34)} mean ${mean(xs).toFixed(digits).padStart(7)}   p10 ${pct(xs, 0.1).toFixed(digits).padStart(7)}` +
        `   median ${pct(xs, 0.5).toFixed(digits).padStart(7)}   p90 ${pct(xs, 0.9).toFixed(digits).padStart(7)}`,
    );
  console.log(
    `\n${n} lives of ${years} years (seeds ${from}..${from + n - 1}), ` +
      `${mean(rows.map((r) => r.seconds)).toFixed(1)}s per life, ${wall.toFixed(0)}s total\n`,
  );
  console.log('Circle sizes, everyone in the world at the end (cumulative, family excluded). Rough human targets: 5 / 15 / 50 / 150');
  for (const k of KEYS) line(`${k} or closer`, rows.flatMap((r) => r.pop[k]));
  console.log('\nProtagonist circle sizes, averaged over their life');
  for (const k of KEYS) line(`${k} or closer`, rows.map((r) => r.ego[k]));
  console.log('\nProtagonist life totals');
  for (const k of Object.keys(rows[0].totals)) {
    const xs = rows.map((r) => r.totals[k]).filter((x): x is number => x !== null && !Number.isNaN(x));
    line(k, xs, k.includes('kept') || k.includes('share') ? 2 : 1);
  }
  console.log('\nHighlights per life, by type');
  for (const k of TYPES) line(k, rows.map((r) => r.highlights[k] ?? 0));
  console.log('');
}
