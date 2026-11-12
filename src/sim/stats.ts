// Summary numbers for one life. Used by the console reel and the tuning harness.

import type { LifeResult } from './sim';

export interface CircleCounts {
  /** Cumulative counts: inner circle, close or better, friend or better, acquaintance or better. */
  inner: number;
  close: number;
  friend: number;
  acquaintance: number;
}

export function countCircle(strengths: Iterable<number>, levels: number[]): CircleCounts {
  const c = { inner: 0, close: 0, friend: 0, acquaintance: 0 };
  for (const s of strengths) {
    if (s >= levels[0]) c.acquaintance++;
    if (s >= levels[1]) c.friend++;
    if (s >= levels[2]) c.close++;
    if (s >= levels[3]) c.inner++;
  }
  return c;
}

export interface LifeStats {
  metDuringLife: number;
  becameFriends: number;
  becameClose: number;
  becameInner: number;
  moves: number;
  jobs: number;
  familyVisits: number;
  /** Protagonist's age when they got together with a partner; null if they never did. */
  partneredAt: number | null;
  /** How many times the protagonist and a partner split up. */
  breakups: number;
  /** Fallings-out the protagonist had, and how many were made up. */
  fights: number;
  mends: number;
  /** Deaths among the protagonist's family, partner and friends. */
  losses: number;
  /** Across the whole world during the story. */
  worldFights: number;
  worldMends: number;
  worldDeaths: number;
  /** Across the whole world during the story: couples formed, and couples that split. */
  worldCouples: number;
  worldBreakups: number;
  /** Protagonist's circle (excluding family) averaged over the whole life. */
  avgCircle: CircleCounts;
  startCircle: CircleCounts;
  endCircle: CircleCounts;
  /** Share of friends in the old city who are still friends two years after a move; null if never moved. */
  moveRetention: number | null;
  /** Median years a friendship stayed at friend level or better; null if none ended. */
  medianFriendshipYears: number | null;
  /** Of the protagonist's friends, averaged over the life: the share with little depth, close only through regular contact. */
  convenienceShare: number;
  /** People outside the family whose depth alone, with no recent contact, would still make them a close friend. Averaged over the life. */
  avgDeep: number;
}

export function computeStats(life: LifeResult): LifeStats {
  const L = life.params.levels;
  // Read from the ties, not the family list: the list drops people when they die.
  const kin = new Set([...life.ties].filter(([, t]) => t.kin).map(([o]) => o));
  let metDuringLife = 0;
  let becameFriends = 0;
  let becameClose = 0;
  let becameInner = 0;
  for (const t of life.ties.values()) {
    if (t.kin || t.met < 0) continue;
    metDuringLife++;
    if (t.peak >= L[1]) becameFriends++;
    if (t.peak >= L[2]) becameClose++;
    if (t.peak >= L[3]) becameInner++;
  }

  const circles = life.snapshots.map((s) => countCircle(s.nodes.filter(([o]) => !kin.has(o)).map(([, x]) => x), L));
  const avg = (f: (c: CircleCounts) => number) => circles.reduce((a, c) => a + f(c), 0) / Math.max(1, circles.length);
  const avgCircle = {
    inner: avg((c) => c.inner), close: avg((c) => c.close), friend: avg((c) => c.friend), acquaintance: avg((c) => c.acquaintance),
  };

  let friendRows = 0;
  let shallowRows = 0;
  let deepRows = 0;
  for (const snap of life.snapshots) {
    for (const [o, x, d] of snap.nodes) {
      if (kin.has(o)) continue;
      if (d >= L[2]) deepRows++;
      if (x < L[1]) continue;
      friendRows++;
      if (d < L[1]) shallowRows++;
    }
  }

  let moves = 0;
  let jobs = 0;
  let familyVisits = 0;
  let partneredAt: number | null = null;
  let breakups = 0;
  let fights = 0;
  let mends = 0;
  let losses = 0;
  const kept: number[] = [];
  const friendSince = new Map<number, number>();
  const durations: number[] = [];
  for (const e of life.events) {
    if (e.t === 'job') jobs++;
    else if (e.t === 'visit') familyVisits++;
    else if (e.t === 'breakup') breakups++;
    else if (e.t === 'fight') fights++;
    else if (e.t === 'mend') mends++;
    else if (e.t === 'death' && (e.kin || e.partner || e.s >= L[1])) losses++;
    else if (e.t === 'partner' && partneredAt === null) partneredAt = life.startYear + Math.floor(e.week / 52) - life.world.agents[life.ego].birthYear;
    else if (e.t === 'move' && e.who === life.ego) {
      moves++;
      const before = [...life.snapshots].reverse().find((s) => s.week <= e.week);
      const after = life.snapshots.find((s) => s.week >= e.week + 104);
      if (before && after) {
        const friends = before.nodes.filter(([o, s]) => !kin.has(o) && s >= L[1] && life.world.agents[o].city !== e.to);
        if (friends.length) {
          const later = new Map(after.nodes.map(([o, x]) => [o, x] as [number, number]));
          kept.push(friends.filter(([o]) => (later.get(o) ?? 0) >= L[1]).length / friends.length);
        }
      }
    } else if (e.t === 'level' && !kin.has(e.other)) {
      if (e.to >= 2 && e.from < 2) friendSince.set(e.other, e.week);
      else if (e.to < 2 && e.from >= 2) {
        const since = friendSince.get(e.other);
        if (since !== undefined) durations.push((e.week - since) / 52);
        friendSince.delete(e.other);
      }
    }
  }
  durations.sort((a, b) => a - b);

  return {
    metDuringLife, becameFriends, becameClose, becameInner, moves, jobs, familyVisits, partneredAt, avgCircle,
    breakups, worldCouples: life.sim.couplesFormed, worldBreakups: life.sim.breakups,
    fights, mends, losses, worldFights: life.sim.fights, worldMends: life.sim.mends, worldDeaths: life.sim.deaths,
    startCircle: circles[0], endCircle: circles[circles.length - 1],
    moveRetention: kept.length ? kept.reduce((a, b) => a + b, 0) / kept.length : null,
    medianFriendshipYears: durations.length ? durations[Math.floor(durations.length / 2)] : null,
    convenienceShare: friendRows ? shallowRows / friendRows : 0,
    avgDeep: deepRows / Math.max(1, life.snapshots.length),
  };
}
