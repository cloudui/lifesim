// Runs lives and prints each as a short, contained story: a dozen or so beats.
//   npm run story -- --seed 7
//   npm run story -- --seeds 1-20 [--jobs 6] [--budget 15] [--cut] [--years 40] [--start-age 18]
//   npm run story -- --seed 7 --name Priya        (rename the person the story is about)
// --cut also lists the beats that did not make it. Several seeds run in parallel child processes.

import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runLife } from '../sim/sim';
import { tellStory } from '../sim/story';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const num = (name: string): number | undefined => (arg(name) === undefined ? undefined : Number(arg(name)));

interface Job { seed: number; years?: number; startAge?: number; budget?: number; cut: boolean; name?: string }

function wrap(text: string, width: number, indent: string): string {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + word.length + 1 > width) { out.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out.map((l) => indent + l).join('\n');
}

function render(job: Job): string {
  const life = runLife({ seed: job.seed, years: job.years, startAge: job.startAge });
  const me = life.world.agents[life.ego];
  const lines: string[] = [];
  const probe = tellStory(life, { budget: job.budget });
  // --name renames the person the story is about.
  const story = job.name && probe.leads.length ? tellStory(life, { budget: job.budget, rename: { lead: 0, name: job.name } }) : probe;
  lines.push('', `══ ${me.name} · seed ${life.seed} · ${life.world.cities[life.start.city].name} · ${life.start.age} to ${life.start.age + life.years} ══`);
  lines.push(`   About ${story.leads.map((l) => `${l.name} (${l.tag}, ${l.ending})${l.main ? '' : ' in the background'}`).join(', ') || 'nobody in particular'}`, '');
  for (const b of story.beats) {
    const mark = b.kind === 'fact' ? '◆' : b.kind === 'texture' ? '○' : '●';
    lines.push(`${String(b.age).padStart(3)} ${mark} ${b.title.toUpperCase()}   [${b.scene}${b.weight < 99 ? ` ${b.weight.toFixed(1)}` : ''}]`);
    lines.push(wrap(b.text, 92, '        '), '');
  }
  lines.push(`   ${story.beats.length} beats: ${story.beats.filter((b) => b.kind === 'turn').length} turning points ●, ${story.beats.filter((b) => b.kind === 'texture').length} texture ○, ${story.beats.filter((b) => b.kind === 'fact').length} facts ◆`);
  if (job.cut && story.cut.length) {
    lines.push('', '   Left out:');
    for (const c of story.cut) lines.push(`     ${String(life.start.age + Math.floor(c.week / 52)).padStart(3)}  ${c.weight.toFixed(1).padStart(4)}  ${c.scene.padEnd(8)} ${c.note}`);
  }
  return lines.join('\n');
}

if (process.argv.includes('--worker')) {
  process.on('message', (m: Job | 'done') => {
    if (m === 'done') process.exit(0);
    process.send!({ seed: m.seed, text: render(m) });
  });
} else {
  const spec = arg('seeds') ?? arg('seed') ?? '1';
  const seeds = spec.includes('-')
    ? Array.from({ length: Number(spec.split('-')[1]) - Number(spec.split('-')[0]) + 1 }, (_, i) => Number(spec.split('-')[0]) + i)
    : spec.split(',').map(Number);
  const base = { years: num('years'), startAge: num('start-age'), budget: num('budget'), cut: process.argv.includes('--cut'), name: arg('name') };
  if (seeds.length === 1) console.log(render({ seed: seeds[0], ...base }));
  else {
    const jobs = Math.max(1, Math.min(seeds.length, num('jobs') ?? Math.max(1, cpus().length - 2)));
    const queue = [...seeds];
    const done = new Map<number, string>();
    await Promise.all(
      Array.from({ length: jobs }, () =>
        new Promise<void>((resolve, reject) => {
          const child = fork(fileURLToPath(import.meta.url), ['--worker']);
          const next = () => {
            const seed = queue.shift();
            if (seed === undefined) { child.send('done'); resolve(); } else child.send({ seed, ...base });
          };
          child.on('message', (r: { seed: number; text: string }) => { done.set(r.seed, r.text); process.stderr.write('.'); next(); });
          child.on('error', reject);
          next();
        }),
      ),
    );
    process.stderr.write('\n');
    for (const seed of seeds) console.log(done.get(seed));
  }
}
