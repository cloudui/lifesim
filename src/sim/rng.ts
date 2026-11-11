// Keyed randomness. Every draw in the weekly loop is a pure function of
// (seed, purpose, week, agent, index) instead of the next value from one shared
// stream. Adding a new rule therefore never shifts the draws of existing rules,
// and a life replays exactly from its seed.

function mix(h: number, k: number): number {
  k = Math.imul(k, 0xcc9e2d51);
  k = (k << 15) | (k >>> 17);
  k = Math.imul(k, 0x1b873593);
  h ^= k;
  h = (h << 13) | (h >>> 19);
  return (Math.imul(h, 5) + 0xe6546b64) | 0;
}

function fmix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hashInt(seed: number, a: number, b: number, c: number, d: number): number {
  return fmix(mix(mix(mix(mix(seed | 0, a), b), c), d));
}

/** Uniform float in [0, 1) keyed by the five integers. */
export function rand(seed: number, a: number, b: number, c: number, d: number): number {
  return hashInt(seed, a, b, c, d) / 4294967296;
}

/** Sequential stream (mulberry32). Used only for one-off world generation. */
export class Stream {
  private s: number;
  constructor(seed: number, purpose: number) {
    this.s = hashInt(seed, purpose, 0x9e3779b9, 0, 0);
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }
}
