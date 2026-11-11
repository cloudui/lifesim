// A finished life as plain JSON. This is the only thing the browser views read.

import { CLUBS, type Ctx } from './activities';
import { findHighlights, selectReel, type Highlight } from './highlights';
import { descriptor } from './people';
import type { LifeResult } from './sim';
import { computeStats, type LifeStats } from './stats';

export interface PersonExport {
  id: number;
  name: string;
  born: number;
  /** Most pronounced trait, e.g. "a homebody". */
  trait: string;
  hobbies: string[];
  kin: boolean;
  /** Week they met the protagonist; negative means before the story starts. */
  met: number;
  ctx: Ctx;
  /** Where they met, or null. */
  venue: string | null;
  /** Name of whoever introduced them, or null. */
  via: string | null;
  /** The model's chance they met in that particular week. */
  p: number;
  peak: number;
  compat: number;
  /** [week, city] each time their home city changes, starting at week 0. */
  cities: [number, number][];
}

export interface SnapshotExport {
  week: number;
  /** [person, strength x 100] for everyone the protagonist knows at this point. */
  nodes: [number, number][];
  /** Friendships between two of the protagonist's friends. */
  edges: [number, number][];
}

export interface LifeExport {
  seed: number;
  startYear: number;
  years: number;
  /** Strength thresholds: acquaintance, friend, close friend, inner circle. */
  levels: number[];
  cities: string[];
  ego: {
    id: number;
    name: string;
    born: number;
    hometown: number;
    trait: string;
    ext: number;
    novelty: number;
    hobbies: string[];
    cities: [number, number][];
    /** Partner's id, or -1. `partnerWeek` is null if they were together before the story started. */
    partner: number;
    partnerWeek: number | null;
  };
  people: PersonExport[];
  highlights: Highlight[];
  snapshots: SnapshotExport[];
  stats: LifeStats;
}

export function exportLife(life: LifeResult, top = 90): LifeExport {
  const { world, events, ties, params } = life;
  const { agents, venues } = world;
  const me = agents[life.ego];

  // Rebuild each person's home city over time from the logged moves.
  const movesBy = new Map<number, { week: number; from: number; to: number }[]>();
  for (const e of events) {
    if (e.t !== 'move') continue;
    let list = movesBy.get(e.who);
    if (!list) movesBy.set(e.who, (list = []));
    list.push({ week: e.week, from: e.from, to: e.to });
  }
  const cityTimeline = (id: number): [number, number][] => {
    const moves = movesBy.get(id) ?? [];
    const out: [number, number][] = [[0, moves.length ? moves[0].from : agents[id].city]];
    for (const m of moves) out.push([m.week, m.to]);
    return out;
  };

  const people: PersonExport[] = [];
  for (const [id, t] of ties) {
    const a = agents[id];
    people.push({
      id, name: a.name, born: a.birthYear, trait: descriptor(a), hobbies: a.hobbies.map((h) => CLUBS[h].hobby),
      kin: t.kin, met: t.met, ctx: t.ctx, venue: t.venue >= 0 ? venues[t.venue].name : null,
      via: t.via >= 0 ? agents[t.via].name : null, p: t.p, peak: Math.round(t.peak * 100) / 100,
      compat: Math.round(t.c * 100) / 100, cities: cityTimeline(id),
    });
  }

  const L = params.levels;
  const snapshots: SnapshotExport[] = life.snapshots.map((s) => {
    const friendly = new Set(s.nodes.filter(([, x]) => x >= L[1]).map(([o]) => o));
    return {
      week: s.week,
      nodes: s.nodes.map(([o, x]) => [o, Math.round(x * 100)] as [number, number]),
      edges: s.edges.filter(([a, b]) => friendly.has(a) && friendly.has(b)).map(([a, b]) => [a, b] as [number, number]),
    };
  });

  const partnerEvent = events.find((e) => e.t === 'partner');
  return {
    seed: life.seed, startYear: life.startYear, years: life.years, levels: L,
    cities: world.cities.map((c) => c.name),
    ego: {
      id: me.id, name: me.name, born: me.birthYear, hometown: me.hometown, trait: descriptor(me), ext: me.ext,
      novelty: me.novelty, hobbies: life.start.hobbies.map((h) => CLUBS[h].hobby), cities: cityTimeline(me.id),
      partner: me.partner, partnerWeek: partnerEvent ? partnerEvent.week : null,
    },
    people,
    highlights: selectReel(findHighlights(life), top),
    snapshots,
    stats: computeStats(life),
  };
}
