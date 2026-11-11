import { describe, expect, it } from 'vitest';
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
});
