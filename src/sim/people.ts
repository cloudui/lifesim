// Who people are and how well two of them fit. Pure functions of agent data.

import { CLUBS } from './activities';
import type { Agent } from './world';

/** Personality axes, each stored as a number from -1 to 1 in Agent.pers. */
export const PERSONALITY = [
  { low: 'a dry sense of humour', high: 'a goofy sense of humour', bothLow: 'the same dry sense of humour', bothHigh: 'the same goofy sense of humour' },
  { low: 'a homebody', high: 'always up for an adventure', bothLow: 'both being homebodies', bothHigh: 'both being up for anything' },
  { low: 'a good listener', high: 'a big talker', bothLow: 'both being good listeners', bothHigh: 'both being big talkers' },
  { low: 'spontaneous', high: 'a planner', bothLow: 'both being spontaneous', bothHigh: 'both being planners' },
];

/**
 * Friendship index from 0 to 1: how well two people fit. Half personality
 * similarity, the rest closeness in age and shared hobbies. Typical strangers score
 * about 0.3; a great match scores 0.8 or more.
 */
export function compat(a: Agent, b: Agent): number {
  let d = 0;
  for (let i = 0; i < a.pers.length; i++) d += Math.abs(a.pers[i] - b.pers[i]);
  d /= a.pers.length;
  const similar = d >= 1 ? 0 : 1 - d;
  let shared = 0;
  for (let m = a.hobbyMask & b.hobbyMask; m; m &= m - 1) shared++;
  const age = Math.exp(-Math.abs(a.birthYear - b.birthYear) / 10);
  const c = 0.5 * similar + 0.2 * Math.min(shared, 2) * 0.5 + 0.3 * age;
  return c > 1 ? 1 : c;
}

/** The person's most pronounced trait, e.g. "a homebody". */
export function descriptor(a: Agent): string {
  let best = 0;
  for (let i = 1; i < a.pers.length; i++) if (Math.abs(a.pers[i]) > Math.abs(a.pers[best])) best = i;
  return a.pers[best] < 0 ? PERSONALITY[best].low : PERSONALITY[best].high;
}

/** Up to two things two people have in common, strongest first. Empty if nothing stands out. */
export function clickReasons(a: Agent, b: Agent): string[] {
  const out: { text: string; w: number }[] = [];
  const shared = a.hobbies.filter((h) => b.hobbies.includes(h));
  if (shared.length) out.push({ text: shared.map((h) => CLUBS[h].hobby).join(' and '), w: 0.6 + 0.2 * shared.length });
  for (let i = 0; i < a.pers.length; i++) {
    const x = a.pers[i];
    const y = b.pers[i];
    if (x * y <= 0 || Math.min(Math.abs(x), Math.abs(y)) < 0.35) continue;
    out.push({ text: x < 0 ? PERSONALITY[i].bothLow : PERSONALITY[i].bothHigh, w: Math.min(Math.abs(x), Math.abs(y)) });
  }
  return out.sort((p, q) => q.w - p.w).slice(0, 2).map((r) => r.text);
}
