// How close the protagonist and one person were across the life, as runs of the same circle.
// Used wherever a person is drawn as a strip: the timeline lanes and the cast cards.

import type { LifeExport } from '../sim/export';

export interface TierRun {
  from: number;
  to: number;
  /** 0 inner circle, 1 close friend, 2 friend, 3 acquaintance. Runs out of touch are left out. */
  tier: number;
}

export function tierAt(data: LifeExport, id: number, snap: number): number {
  const L = data.levels;
  const n = data.snapshots[snap].nodes.find((r) => r[0] === id);
  const s = n ? n[1] / 100 : 0;
  return s >= L[3] ? 0 : s >= L[2] ? 1 : s >= L[1] ? 2 : s >= L[0] ? 3 : 4;
}

export function tierRuns(data: LifeExport, id: number): TierRun[] {
  const snaps = data.snapshots;
  const total = data.years * 52;
  const out: TierRun[] = [];
  let start = 0;
  let tier = -1;
  const flush = (end: number) => {
    if (tier >= 0 && tier <= 3) out.push({ from: start, to: end, tier });
  };
  for (let i = 0; i < snaps.length; i++) {
    const t = tierAt(data, id, i);
    if (t === tier) continue;
    flush(snaps[i].week);
    start = snaps[i].week;
    tier = t;
  }
  flush(total);
  return out;
}
