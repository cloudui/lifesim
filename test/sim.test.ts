import { describe, expect, it } from 'vitest';
import { findArcs } from '../src/sim/arcs';
import { findHighlights } from '../src/sim/highlights';
import { runLife, type LifeOptions } from '../src/sim/sim';

const small: Omit<LifeOptions, 'seed'> = {
  years: 4,
  burnInYears: 1,
  cities: [
    { name: 'A', pop: 150 },
    { name: 'B', pop: 120 },
    { name: 'C', pop: 100 },
  ],
};

const fingerprint = (seed: number) => {
  const life = runLife({ seed, ...small });
  return JSON.stringify({ events: life.events, contacts: life.contacts, snapshots: life.snapshots });
};

describe('life simulation', () => {
  it('replays exactly from the same seed', () => {
    expect(fingerprint(11)).toEqual(fingerprint(11));
  });

  it('gives a different life for a different seed', () => {
    expect(fingerprint(11)).not.toEqual(fingerprint(12));
  });

  it('keeps tie strengths and probabilities in range', () => {
    const life = runLife({ seed: 3, ...small });
    expect(life.ties.size).toBeGreaterThan(5);
    for (const t of life.ties.values()) {
      expect(t.now).toBeGreaterThanOrEqual(0);
      expect(t.peak).toBeLessThanOrEqual(1);
      // Closeness is depth plus some share of what is left, so it can never be below depth.
      expect(t.depthNow).toBeGreaterThanOrEqual(0);
      expect(t.depthNow).toBeLessThanOrEqual(t.now + 1e-9);
      expect(t.dp).toBeLessThanOrEqual(1);
      expect(t.k).toBeLessThanOrEqual(1);
      expect(t.p).toBeGreaterThan(0);
      expect(t.p).toBeLessThanOrEqual(1);
    }
  });

  it('keeps membership lists consistent with agents', () => {
    const { world } = runLife({ seed: 5, ...small });
    for (const a of world.agents) {
      if (a.died >= 0) continue;
      expect(world.venues[a.work].members).toContain(a.id);
      expect(world.venues[a.work].city).toBe(a.city);
      for (const c of a.clubs) {
        expect(world.venues[c].members).toContain(a.id);
        expect(world.venues[c].city).toBe(a.city);
      }
    }
  });

  it('applies protagonist trait overrides', () => {
    const life = runLife({ seed: 5, ...small, ego: { ext: 0.95, hobbies: ['run'] } });
    expect(life.world.agents[life.ego].ext).toBe(0.95);
    expect(life.start.hobbies).toHaveLength(1);
  });

  it('produces highlights with text', () => {
    const hs = findHighlights(runLife({ seed: 9, ...small, years: 8 }));
    for (const h of hs) expect(h.text.length).toBeGreaterThan(10);
  });

  it('retells a life as a cast of people, each with a beginning and an ending', () => {
    const life = runLife({ seed: 3, ...small });
    const arcs = findArcs(life);
    expect(arcs.cast.length).toBeGreaterThan(2);
    expect(new Set(arcs.cast.map((a) => a.id)).size).toBe(arcs.cast.length);
    for (const a of arcs.cast) {
      expect(life.ties.has(a.id)).toBe(true);
      expect(a.beats.length).toBeGreaterThanOrEqual(2);
      for (const b of a.beats) expect(b.text).not.toMatch(/undefined|NaN/);
    }
    expect(JSON.stringify(findArcs(runLife({ seed: 3, ...small })).cast)).toEqual(JSON.stringify(arcs.cast));
  });

  it('what if: leaving out one meeting changes nothing before it', () => {
    const base = runLife({ seed: 3, ...small });
    const met = base.events.find((e) => e.t === 'met' && e.week > 20);
    if (!met || met.t !== 'met') throw new Error('expected a meeting to undo');
    const alt = runLife({ seed: 3, ...small, skipMeeting: { week: met.week, other: met.other } });
    const upTo = (l: typeof base) => JSON.stringify(l.events.filter((e) => e.week < met.week));
    expect(upTo(alt)).toEqual(upTo(base));
    expect(alt.events.some((e) => e.t === 'met' && e.other === met.other && e.week === met.week)).toBe(false);
  });

  it('falling out stops two people seeing each other until they make up', () => {
    const life = runLife({ seed: 3, ...small, years: 6, params: { fightRate: 0.2, mendRate: 0.3, deathRate: 0 } });
    const fights = life.events.filter((e) => e.t === 'fight');
    const mends = life.events.filter((e) => e.t === 'mend');
    expect(fights.length).toBeGreaterThan(0);
    expect(mends.length).toBeGreaterThan(0);
    for (const f of fights) {
      if (f.t !== 'fight') continue;
      const mend = mends.find((m) => m.t === 'mend' && m.other === f.other && m.week > f.week);
      const until = mend ? mend.week : Infinity;
      for (let i = 0; i < life.contacts.length; i += 4) {
        const w = life.contacts[i];
        if (life.contacts[i + 1] === f.other && w > f.week && w < until) throw new Error(`saw ${f.other} in week ${w} during a rift`);
      }
    }
  });

  it('the dead take no further part, and the protagonist outlives the story', () => {
    const life = runLife({ seed: 3, ...small, years: 6, params: { deathRate: 40 } });
    const { agents, venues } = life.world;
    const deaths = life.events.filter((e) => e.t === 'death');
    expect(deaths.length).toBeGreaterThan(5);
    expect(agents[life.ego].died).toBe(-1);
    for (const a of agents) {
      if (a.died < 0) {
        if (a.partner >= 0) expect(agents[a.partner].died).toBe(-1);
        for (const f of a.family) expect(agents[f].died).toBe(-1);
        continue;
      }
      for (const v of venues) expect(v.members.includes(a.id)).toBe(false);
      for (let i = 0; i < life.contacts.length; i += 4) {
        if (life.contacts[i + 1] === a.id && life.contacts[i] > a.died) throw new Error(`met ${a.id} after they died`);
      }
      for (const s of life.snapshots) if (s.week > a.died) expect(s.nodes.some((n) => n[0] === a.id)).toBe(false);
    }
  });

  it('is unchanged by the ending rules when they are switched off', () => {
    const off = { fightRate: 0, apartFade: 1, deathRate: 0 };
    const life = runLife({ seed: 11, ...small, params: off });
    expect(life.events.some((e) => e.t === 'fight' || e.t === 'mend' || e.t === 'death')).toBe(false);
    const again = runLife({ seed: 11, ...small, params: off });
    expect(JSON.stringify(again.events)).toEqual(JSON.stringify(life.events));
  });
});
