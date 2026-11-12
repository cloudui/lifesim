// The weekly loop. Every rule here applies to every agent; the protagonist
// ("ego") is only the camera that decides which events get written down.

import { CLUBS, CTX_LIST, type Ctx } from './activities';
import { DEFAULT_PARAMS, type Params } from './params';
import { compat } from './people';
import { rand } from './rng';
import { DEFAULT_CITIES, generateWorld, type Agent, type CityConfig, type EgoOverrides, type Venue, type World } from './world';

export interface Tie {
  a: number;
  b: number;
  /**
   * Depth in [0, 1] as of week `last`: how much the two matter to each other. Built slowly,
   * only by chosen time together, and fades over years.
   */
  d: number;
  /**
   * Contact in [0, 1] as of week `last`: how much they have seen of each other lately.
   * Any interaction raises it and it fades within months.
   */
  k: number;
  /** Week of the last interaction of any kind. */
  last: number;
  met: number;
  /** Venue where they met, or -1. */
  venue: number;
  ctx: Ctx;
  /** The model's chance that this pair met in that particular week. */
  p: number;
  n: number;
  /** Highest closeness the tie ever reached. */
  peak: number;
  /** Highest depth the tie ever reached. */
  dp: number;
  kin: boolean;
  /** Who introduced them, or -1. */
  via: number;
  /** Compatibility of the pair when they met, 0 to 1. */
  c: number;
}

export interface Mutual {
  id: number;
  /** How the new person knows the mutual friend. */
  ctx: Ctx;
  /** The mutual friend lives in a different city from where the meeting happened. */
  away: boolean;
  /** How strong the protagonist's tie to the mutual friend was at the time. */
  s: number;
}

export type SimEvent =
  | { t: 'met'; week: number; other: number; venue: number; ctx: Ctx; p: number; via: number; nearMisses: number; mutuals: Mutual[]; city: number }
  | { t: 'reunion'; week: number; other: number; venue: number; ctx: Ctx; gap: number; prevPeak: number; city: number }
  | { t: 'move'; week: number; who: number; from: number; to: number; s: number; egoCity: number; left: number }
  | { t: 'job'; week: number; from: number; to: number; via: number }
  | { t: 'visit'; week: number; city: number }
  | { t: 'level'; week: number; other: number; from: number; to: number }
  | { t: 'friendsMet'; week: number; a: number; b: number; venue: number; ctx: Ctx; via: number; sa: number; sb: number }
  | { t: 'hobby'; week: number; from: number; to: number; via: number }
  | { t: 'club'; week: number; venue: number; via: number }
  | { t: 'partner'; week: number; other: number }
  | { t: 'breakup'; week: number; other: number; weeks: number };

export interface Snapshot {
  week: number;
  city: number;
  /** [person, closeness, depth] for everyone the protagonist currently knows. */
  nodes: [number, number, number][];
  /** [a, b, strength] friendships among those people. */
  edges: [number, number, number][];
}

export interface LifeOptions {
  seed: number;
  years?: number;
  burnInYears?: number;
  startYear?: number;
  cities?: CityConfig[];
  params?: Partial<Params>;
  ego?: EgoOverrides;
}

export interface StartProfile {
  city: number;
  work: number;
  clubs: number[];
  hobbies: number[];
  age: number;
  /** Partner when the story starts, or -1. */
  partner: number;
}

export interface LifeResult {
  seed: number;
  startYear: number;
  years: number;
  params: Params;
  world: World;
  ego: number;
  start: StartProfile;
  events: SimEvent[];
  /** Flat rows of [week, person, venue, ctxIndex] for every interaction the protagonist had. */
  contacts: number[];
  snapshots: Snapshot[];
  /** Everyone the protagonist has ever known, with closeness and depth as of the final week. */
  ties: Map<number, Tie & { now: number; depthNow: number }>;
  sim: Sim;
}

// Purposes for keyed random draws. Never renumber; only append.
const R = {
  MOVE: 1, DEST: 2, JOB: 3, WORK_PICK: 4, REFER: 5, VISIT: 6, VISIT_WHO: 7, WORK: 8, CLUB: 9, JOIN: 10,
  JOIN_PICK: 11, DRIFT: 12, DRIFT_PICK: 13, HOST: 14, SIZE: 15, INVITE: 16, ACCEPT: 17, INTRO: 18, SOLO: 19,
  HANG: 20, MIX: 21, MIX_ACC: 22, FAMILY: 23, CALL: 24, CALL_PICK: 25, SPARK: 26, ORDER: 27, REFER_PICK: 28,
  JOIN_FOLLOW: 29, DRIFT_FOLLOW: 30, AWAY_HANG: 31, PARTNER: 32, PLUS_ONE: 33, MSG: 34, MSG_PICK: 35, BREAKUP: 36,
} as const;

const CTX_INDEX: Record<Ctx, number> = Object.fromEntries(CTX_LIST.map((c, i) => [c, i])) as Record<Ctx, number>;
const LN2 = Math.LN2;

export class Sim {
  readonly world: World;
  readonly P: Params;
  readonly seed: number;
  readonly startYear: number;
  readonly ego: number;
  week: number;
  /** adj[a] maps each person a knows to the shared Tie object. */
  adj: Map<number, Tie>[];
  // Packed per-agent cache of non-trivial ties (who, strength, week met, kin), refreshed
  // every 8 weeks on a stagger. Hot loops read these flat arrays instead of chasing Tie objects.
  fo: number[][];
  fs: number[][];
  fm: number[][];
  fk: boolean[][];
  events: SimEvent[] = [];
  contacts: number[] = [];
  snapshots: Snapshot[] = [];
  /** Couples formed and couples that broke up, across the whole world, since logging started. */
  couplesFormed = 0;
  breakups = 0;

  /** Week each agent's current relationship status began: when they got together, or when they became single. */
  private since: Int32Array;
  private att: number[][];
  private loc: Int32Array;
  private outCount: Uint8Array;
  private lastMove: Int32Array;
  private logging = false;
  private tick = 0;
  private yr = 0;
  private copresence = new Map<number, number>();
  private egoLevel = new Map<number, number>();
  private egoVenues: number[] = [];
  // Scratch arrays reused across calls.
  private cand: number[] = [];
  private wts: number[] = [];
  private str: number[] = [];

  constructor(world: World, seed: number, params: Params, startYear: number, startWeek: number) {
    this.world = world;
    this.P = params;
    this.seed = seed;
    this.startYear = startYear;
    this.ego = world.ego;
    this.week = startWeek;
    const N = world.agents.length;
    this.adj = Array.from({ length: N }, () => new Map<number, Tie>());
    this.fo = Array.from({ length: N }, () => []);
    this.fs = Array.from({ length: N }, () => []);
    this.fm = Array.from({ length: N }, () => []);
    this.fk = Array.from({ length: N }, () => []);
    this.att = world.venues.map(() => []);
    this.loc = new Int32Array(N);
    this.outCount = new Uint8Array(N);
    this.lastMove = new Int32Array(N).fill(-1e6);
    this.since = new Int32Array(N).fill(-1e6);
    // Couples who exist when the world is generated have been together for a long time.
    for (const a of world.agents) if (a.partner >= 0) this.since[a.id] = startWeek - 1040;
    for (const t of world.seedTies) {
      const tie: Tie = {
        // Family and childhood friends start as depth with no recent contact.
        a: t.a, b: t.b, d: t.s, k: 0, last: startWeek, met: Math.min(t.met, startWeek), venue: -1, ctx: t.ctx,
        p: 1, n: 0, peak: t.s, dp: t.s, kin: t.kin, via: -1, c: compat(world.agents[t.a], world.agents[t.b]),
      };
      this.adj[t.a].set(t.b, tie);
      this.adj[t.b].set(t.a, tie);
    }
    this.refreshFriends();
  }

  // ---------------------------------------------------------------- helpers

  private r(purpose: number, a: number, k = 0): number {
    return rand(this.seed, purpose, this.week, a, k);
  }

  year(week = this.week): number {
    return this.startYear + Math.floor(week / 52);
  }

  /** Half-life of a tie's depth in weeks: longer for deeper and longer-held ties, very long for family. */
  private depthHalfLife(t: Tie): number {
    const P = this.P;
    if (t.kin) return P.hlKin;
    const known = 1 + (P.hlPerYear * (t.last - t.met)) / 52;
    return (P.hlMin + (P.hlMax - P.hlMin) * t.dp ** P.hlPow) * (known > P.hlAgeMax ? P.hlAgeMax : known);
  }

  /** Current depth of a tie, after decay since its last interaction. */
  depth(t: Tie): number {
    const gap = this.week - t.last;
    return gap <= 0 || t.d === 0 ? t.d : t.d * Math.exp((-LN2 * gap) / this.depthHalfLife(t));
  }

  /** Current contact of a tie, after decay since its last interaction. */
  contact(t: Tie): number {
    const gap = this.week - t.last;
    return gap <= 0 ? t.k : t.k * Math.exp((-LN2 * gap) / this.P.hlContact);
  }

  /**
   * Current closeness of a tie: depth, plus recent contact filling part of what is left.
   * Circles, invitations and everything else that asks "how close are they" read this.
   */
  cur(t: Tie): number {
    const d = this.depth(t);
    return d + (1 - d) * this.contact(t);
  }

  /** Bring a tie's stored depth and contact up to this week. */
  private settle(t: Tie): void {
    if (this.week <= t.last) return;
    t.d = this.depth(t);
    t.k = this.contact(t);
    t.last = this.week;
  }

  levelOf(s: number): number {
    const L = this.P.levels;
    return s >= L[3] ? 4 : s >= L[2] ? 3 : s >= L[1] ? 2 : s >= L[0] ? 1 : 0;
  }

  /** Openness to new people and places: 1 at 25 or younger, falling with age. */
  private openness(a: Agent): number {
    const x = 1 - (this.yr - a.birthYear - 25) * this.P.ageOpenSlope;
    return x > 1 ? 1 : x < this.P.ageOpenMin ? this.P.ageOpenMin : x;
  }

  /** How often someone goes out, relative to a 25-year-old. */
  private activity(a: Agent): number {
    const x = 1 - (this.yr - a.birthYear - 25) * this.P.ageActiveSlope;
    return x > 1 ? 1 : x < this.P.ageActiveMin ? this.P.ageActiveMin : x;
  }

  /** How readily two strangers get talking: extraversion, openness at their age, and how well they fit. */
  private social(a: Agent, b: Agent): number {
    const e = ((0.3 + 0.7 * a.ext) * (0.3 + 0.7 * b.ext)) / 0.4225;
    // People mostly fall into conversation with others near their own age.
    const age = 0.25 + 0.75 * Math.exp(-Math.abs(a.birthYear - b.birthYear) / 12);
    return e * age * this.openness(a) * this.openness(b) * (0.2 + compat(a, b));
  }

  private maxOut(a: Agent): number {
    return 1 + Math.round(2 * a.ext);
  }

  private exploreProb(a: Agent): number {
    if (a.haunts.length === 0) return 1;
    return Math.min(1, ((this.P.exploreBase + this.P.exploreNovelty * a.novelty) * this.openness(a)) / Math.sqrt(a.haunts.length));
  }

  private pickHangout(a: Agent, city: number, k: number): number {
    const all = this.world.hangoutsByCity[city];
    const u = this.r(R.HANG, a.id, k);
    if (city !== a.city || u < this.exploreProb(a)) {
      return all[Math.floor(this.r(R.HANG, a.id, k + 100) * all.length)];
    }
    let total = 0;
    for (const h of a.haunts) total += h.n;
    let x = this.r(R.HANG, a.id, k + 200) * total;
    for (const h of a.haunts) {
      x -= h.n;
      if (x <= 0) return h.v;
    }
    return a.haunts[a.haunts.length - 1].v;
  }

  private bumpHaunt(a: Agent, v: number): void {
    if (this.world.venues[v].city !== a.city) return;
    for (const h of a.haunts) {
      if (h.v === v) {
        h.n++;
        return;
      }
    }
    a.haunts.push({ v, n: 1 });
    if (a.haunts.length > this.P.maxHaunts) {
      let worst = 0;
      for (let i = 1; i < a.haunts.length - 1; i++) if (a.haunts[i].n < a.haunts[worst].n) worst = i;
      a.haunts.splice(worst, 1);
    }
  }

  /** The model's rough chance that this agent is at this venue in a given week. */
  private presence(a: Agent, ven: Venue): number {
    const P = this.P;
    if (ven.kind === 'work') return P.workAttend;
    if (ven.kind === 'club') return CLUBS[ven.hobby].attend;
    const nH = this.world.hangoutsByCity[ven.city].length;
    if (ven.city !== a.city) return (P.visitRate * 0.7) / nH;
    const pe = this.exploreProb(a);
    let total = 0;
    let here = 0;
    for (const h of a.haunts) {
      total += h.n;
      if (h.v === ven.id) here = h.n;
    }
    const pv = pe / nH + (total > 0 ? ((1 - pe) * here) / total : 0);
    const visits = P.soloBase + P.soloExt * a.ext + P.soloSecond * a.ext + P.hostBase + P.hostExt * a.ext;
    return Math.min(1, visits * pv);
  }

  private addAtt(v: number, id: number): void {
    const list = this.att[v];
    if (this.world.venues[v].kind === 'hangout' && list.includes(id)) return;
    list.push(id);
    if (id === this.ego && !this.egoVenues.includes(v)) this.egoVenues.push(v);
  }

  private removeMember(v: number, id: number): void {
    const m = this.world.venues[v].members;
    const i = m.indexOf(id);
    if (i >= 0) m.splice(i, 1);
  }

  // ------------------------------------------------------------ interaction

  /** Two people actually spend time together. Creates the tie if it is new. */
  private interact(a: number, b: number, ctx: Ctx, venue: number, p: number, via: number): void {
    const P = this.P;
    const w = this.week;
    const egoInvolved = a === this.ego || b === this.ego;
    let tie = this.adj[a].get(b);
    let isNew = false;
    if (!tie) {
      isNew = true;
      const A = this.world.agents[a];
      const B = this.world.agents[b];
      const c = compat(A, B);
      const spark = P.sparkMax * this.r(R.SPARK, a, b) ** P.sparkPow * Math.min(1.5, c / 0.3);
      // A first impression counts as depth: a few first meetings matter straight away.
      tie = { a, b, d: spark, k: 0, last: w, met: w, venue, ctx, p, n: 0, peak: 0, dp: spark, kin: false, via, c };
      this.adj[a].set(b, tie);
      this.adj[b].set(a, tie);
    } else {
      if (this.logging && egoInvolved && !tie.kin && ctx !== 'call' && ctx !== 'message' && w - tie.last >= P.reunionGap) {
        this.events.push({
          t: 'reunion', week: w, other: a === this.ego ? b : a, venue, ctx, gap: w - tie.last, prevPeak: tie.peak,
          city: this.loc[this.ego],
        });
      }
      this.settle(tie);
    }
    // Every context raises contact towards its own ceiling. Only chosen time together and
    // family time build depth; a call can restore depth that has faded but cannot add new depth.
    let gain: number;
    let cap: number;
    switch (ctx) {
      case 'work': gain = P.workGain; cap = P.workCap; break;
      case 'club': { const c = CLUBS[this.world.venues[venue].hobby]; gain = c.gain; cap = c.cap; break; }
      case 'hangout': gain = P.hangGain; cap = P.hangCap; break;
      case 'outing': {
        gain = P.outingGain;
        cap = P.outingContact;
        // Old friends pick up where they left off, then keep building up to what their fit allows.
        if (tie.d < tie.dp) tie.d += P.rekindle * (tie.dp - tie.d);
        const dcap = Math.min(P.depthMax, P.capBase + P.capCompat * tie.c);
        if (tie.d < dcap) tie.d += P.depthGain * (dcap - tie.d);
        break;
      }
      case 'family':
        gain = P.familyGain;
        cap = P.familyContact;
        if (tie.d < P.familyCap) tie.d += P.familyGain * (P.familyCap - tie.d);
        break;
      case 'message':
        gain = P.msgGain;
        cap = P.msgCap;
        if (tie.d < tie.dp) tie.d += P.msgHold * (tie.dp - tie.d);
        break;
      default:
        gain = P.callGain;
        cap = P.callCap;
        if (tie.d < tie.dp) tie.d += P.callHold * (tie.dp - tie.d);
    }
    if (tie.k < cap) tie.k += gain * (cap - tie.k);
    tie.last = w;
    tie.n++;
    if (tie.d > tie.dp) tie.dp = tie.d;
    const s = tie.d + (1 - tie.d) * tie.k;
    if (s > tie.peak) tie.peak = s;
    if (isNew) {
      if (s >= P.cacheMin) {
        this.fo[a].push(b); this.fs[a].push(s); this.fm[a].push(w); this.fk[a].push(false);
        this.fo[b].push(a); this.fs[b].push(s); this.fm[b].push(w); this.fk[b].push(false);
      }
      if (this.logging) this.onMet(tie);
    }
    if (this.logging && egoInvolved && ctx !== 'message') {
      this.contacts.push(w, a === this.ego ? b : a, venue, CTX_INDEX[ctx]);
    }
  }

  private onMet(tie: Tie): void {
    const ego = this.ego;
    const L = this.P.levels;
    const venues = this.world.venues;
    const agents = this.world.agents;
    if (tie.a === ego || tie.b === ego) {
      const other = tie.a === ego ? tie.b : tie.a;
      const mutuals: Mutual[] = [];
      if (tie.ctx !== 'outing') {
        const theirs = this.adj[other];
        const found: { m: Mutual; w: number }[] = [];
        for (const [x, mine] of this.adj[ego]) {
          if (x === other) continue;
          const t2 = theirs.get(x);
          if (!t2) continue;
          const s1 = this.cur(mine);
          const s2 = this.cur(t2);
          if (s1 < L[1] || s2 < L[1]) continue;
          // A shared coworker or clubmate at this same venue is expected, not a coincidence.
          if (tie.venue >= 0 && venues[tie.venue].kind !== 'hangout' && venues[tie.venue].members.includes(x)) continue;
          found.push({ m: { id: x, ctx: t2.ctx, away: agents[x].city !== this.loc[ego], s: s1 }, w: s1 * s2 });
        }
        found.sort((p, q) => q.w - p.w);
        for (const f of found.slice(0, 3)) mutuals.push(f.m);
      }
      this.events.push({
        t: 'met', week: this.week, other, venue: tie.venue, ctx: tie.ctx, p: tie.p, via: tie.via,
        nearMisses: this.copresence.get(other) ?? 0, mutuals, city: this.loc[ego],
      });
      return;
    }
    // Two of the protagonist's friends meeting each other.
    const ta = this.adj[ego].get(tie.a);
    if (!ta) return;
    const tb = this.adj[ego].get(tie.b);
    if (!tb) return;
    const sa = this.cur(ta);
    const sb = this.cur(tb);
    if (sa < L[1] || sb < L[1]) return;
    if (tie.venue >= 0 && tie.ctx !== 'outing' && tie.ctx !== 'hangout') {
      const e = agents[ego];
      if (e.work === tie.venue || e.clubs.includes(tie.venue)) return;
    }
    this.events.push({ t: 'friendsMet', week: this.week, a: tie.a, b: tie.b, venue: tie.venue, ctx: tie.ctx, via: tie.via, sa, sb });
  }

  // ------------------------------------------------------------ life events

  private pickWork(a: Agent, city: number, exclude: number): { v: number; via: number } {
    const P = this.P;
    const venues = this.world.venues;
    const agents = this.world.agents;
    if (this.r(R.REFER, a.id) < P.referral) {
      const cand: number[] = [];
      const fo = this.fo[a.id];
      const fs = this.fs[a.id];
      for (let i = 0; i < fo.length; i++) {
        const o = agents[fo[i]];
        if (o.city === city && o.work !== exclude && o.work !== a.work && fs[i] >= P.levels[1]) cand.push(o.id);
      }
      if (cand.length) {
        const via = cand[Math.floor(this.r(R.REFER_PICK, a.id) * cand.length)];
        return { v: agents[via].work, via };
      }
    }
    const list = this.world.workByCity[city];
    let total = 0;
    for (const v of list) if (v !== exclude) total += Math.max(0.5, venues[v].cap - venues[v].members.length);
    let u = this.r(R.WORK_PICK, a.id) * total;
    let pick = -1;
    for (const v of list) {
      if (v === exclude) continue;
      pick = v;
      u -= Math.max(0.5, venues[v].cap - venues[v].members.length);
      if (u <= 0) break;
    }
    return { v: pick < 0 ? list[0] : pick, via: -1 };
  }

  private relocate(a: Agent, dest: number): void {
    const from = a.city;
    if (from === dest) return;
    const ego = this.ego;
    let left = 0;
    let s = 0;
    if (this.logging) {
      if (a.id === ego) {
        for (const [o, t] of this.adj[ego]) {
          if (!t.kin && this.world.agents[o].city === from && this.cur(t) >= this.P.levels[1]) left++;
        }
      } else {
        const t = this.adj[ego].get(a.id);
        if (t) s = this.cur(t);
      }
    }
    this.removeMember(a.work, a.id);
    for (const c of a.clubs) this.removeMember(c, a.id);
    a.clubs = [];
    a.haunts = [];
    a.city = dest;
    this.lastMove[a.id] = this.week;
    a.work = this.pickWork(a, dest, -1).v;
    this.world.venues[a.work].members.push(a.id);
    if (this.logging) {
      this.events.push({ t: 'move', week: this.week, who: a.id, from, to: dest, s, egoCity: this.world.agents[ego].city, left });
    }
  }

  private pickDestination(a: Agent): number {
    const P = this.P;
    const nC = this.world.cities.length;
    const w = new Array<number>(nC).fill(1);
    w[a.hometown] += P.homePull;
    const fo = this.fo[a.id];
    const fs = this.fs[a.id];
    for (let i = 0; i < fo.length; i++) w[this.world.agents[fo[i]].city] += P.friendPull * fs[i];
    w[a.city] = 0;
    let total = 0;
    for (const x of w) total += x;
    let u = this.r(R.DEST, a.id) * total;
    for (let c = 0; c < nC; c++) {
      u -= w[c];
      if (u <= 0 && w[c] > 0) return c;
    }
    return a.city === 0 ? 1 : 0;
  }

  private lifeEvents(a: Agent): void {
    const P = this.P;
    const age = this.yr - a.birthYear;
    const moveRate = age < 30 ? P.moveYoung : age < 45 ? P.moveMid : P.moveOld;
    const settled = this.week - this.lastMove[a.id] >= P.moveCooldown;
    if (settled && this.world.cities.length > 1 && this.r(R.MOVE, a.id) < moveRate / 52) {
      const dest = this.pickDestination(a);
      this.relocate(a, dest);
      if (a.partner >= 0) this.relocate(this.world.agents[a.partner], dest);
      return;
    }
    const jobRate = age < 35 ? P.jobYoung : P.jobOld;
    if (this.r(R.JOB, a.id) < jobRate / 52) {
      const from = a.work;
      const next = this.pickWork(a, a.city, from);
      if (next.v === from) return;
      this.removeMember(from, a.id);
      a.work = next.v;
      this.world.venues[next.v].members.push(a.id);
      if (this.logging && a.id === this.ego) {
        this.events.push({ t: 'job', week: this.week, from, to: next.v, via: next.via });
      }
    }
  }

  private maybeVisitFamily(a: Agent): void {
    if (a.family.length === 0 || this.r(R.VISIT, a.id) >= this.P.visitRate) return;
    const agents = this.world.agents;
    const away: number[] = [];
    for (const f of a.family) if (agents[f].city !== a.city) away.push(f);
    if (!away.length) return;
    const f = away[Math.floor(this.r(R.VISIT_WHO, a.id) * away.length)];
    this.loc[a.id] = agents[f].city;
    if (this.logging && a.id === this.ego) this.events.push({ t: 'visit', week: this.week, city: agents[f].city });
  }

  // ---------------------------------------------------------------- routine

  private joinClub(a: Agent, h: number): void {
    const cands = this.world.clubsByCityHobby[a.city][h];
    const agents = this.world.agents;
    let pick = -1;
    let via = -1;
    if (this.r(R.JOIN_FOLLOW, a.id) < this.P.followFriend) {
      const fo = this.fo[a.id];
      const fs = this.fs[a.id];
      for (let i = 0; i < fo.length; i++) {
        const o = agents[fo[i]];
        if (o.city !== a.city) continue;
        const c = o.clubs.find((x) => cands.includes(x));
        if (c !== undefined && fs[i] >= this.P.levels[1]) {
          pick = c;
          via = o.id;
          break;
        }
      }
    }
    if (pick < 0) pick = cands[Math.floor(this.r(R.JOIN_PICK, a.id) * cands.length)];
    a.clubs.push(pick);
    this.world.venues[pick].members.push(a.id);
    if (this.logging && a.id === this.ego) this.events.push({ t: 'club', week: this.week, venue: pick, via });
  }

  private driftHobby(a: Agent): void {
    const agents = this.world.agents;
    const idx = Math.floor(this.r(R.DRIFT_PICK, a.id) * a.hobbies.length);
    const old = a.hobbies[idx];
    let next = -1;
    let via = -1;
    if (this.r(R.DRIFT_FOLLOW, a.id) < this.P.followFriend && this.fo[a.id].length) {
      const fl = this.fo[a.id];
      const i = Math.floor(this.r(R.DRIFT_PICK, a.id, 1) * fl.length);
      const o = agents[fl[i]];
      const h = o.hobbies[Math.floor(this.r(R.DRIFT_PICK, a.id, 2) * o.hobbies.length)];
      if (!a.hobbies.includes(h) && !this.fk[a.id][i] && this.fs[a.id][i] >= this.P.levels[1]) {
        next = h;
        via = o.id;
      }
    }
    if (next < 0) {
      const h = Math.floor(this.r(R.DRIFT_PICK, a.id, 3) * CLUBS.length);
      if (a.hobbies.includes(h)) return;
      next = h;
    }
    const venues = this.world.venues;
    a.clubs = a.clubs.filter((c) => {
      if (venues[c].hobby !== old) return true;
      this.removeMember(c, a.id);
      return false;
    });
    a.hobbies[idx] = next;
    a.hobbyMask = 0;
    for (const h of a.hobbies) a.hobbyMask |= 1 << h;
    if (this.logging && a.id === this.ego) this.events.push({ t: 'hobby', week: this.week, from: old, to: next, via });
  }

  private routine(a: Agent): void {
    const P = this.P;
    const venues = this.world.venues;
    if (this.yr - a.birthYear < P.retireAge && this.r(R.WORK, a.id) < P.workAttend) this.addAtt(a.work, a.id);
    for (const c of a.clubs) {
      if (this.r(R.CLUB, a.id, c) < CLUBS[venues[c].hobby].attend) this.addAtt(c, a.id);
    }
    // Look for a club for one hobby per week.
    const h = a.hobbies[(this.tick + a.id) % a.hobbies.length];
    if (!a.clubs.some((c) => venues[c].hobby === h) && this.r(R.JOIN, a.id) < P.clubJoin * (0.5 + a.ext)) {
      this.joinClub(a, h);
    }
    if (this.r(R.DRIFT, a.id) < P.hobbyDrift) this.driftHobby(a);
    if (a.partner < 0) this.seekPartner(a);
    else if (a.partner > a.id) this.maybeBreakUp(a);
  }

  /** A couple may split. Newer and less compatible couples are the most likely to. */
  private maybeBreakUp(a: Agent): void {
    const P = this.P;
    if (P.breakupRate <= 0) return;
    const b = this.world.agents[a.partner];
    const tie = this.adj[a.id].get(b.id);
    if (!tie) return;
    const weeks = this.week - this.since[a.id];
    const rate = P.breakupRate * 2 * (1 - tie.c) * Math.exp(-weeks / 52 / P.breakupSettle);
    if (this.r(R.BREAKUP, a.id) >= rate / 52) return;
    a.partner = -1;
    b.partner = -1;
    a.family.splice(a.family.indexOf(b.id), 1);
    b.family.splice(b.family.indexOf(a.id), 1);
    this.since[a.id] = this.since[b.id] = this.week;
    // They stop being family to each other, and most of what they had goes with it.
    this.settle(tie);
    tie.kin = false;
    tie.d *= P.breakupKeep;
    tie.k *= P.breakupKeep;
    tie.dp = tie.d;
    if (this.logging) {
      this.breakups++;
      if (a.id === this.ego || b.id === this.ego) {
        this.events.push({ t: 'breakup', week: this.week, other: a.id === this.ego ? b.id : a.id, weeks });
      }
    }
  }

  /** A single person may get together with a close, compatible friend who is also single. */
  private seekPartner(a: Agent): void {
    const P = this.P;
    const age = this.yr - a.birthYear;
    if (age < P.partnerMinAge || age > P.partnerMaxAge || this.r(R.PARTNER, a.id) >= P.partnerSeek) return;
    if (this.week - this.since[a.id] < P.breakupCooldown) return;
    const agents = this.world.agents;
    const fo = this.fo[a.id];
    const fs = this.fs[a.id];
    const fk = this.fk[a.id];
    let best: Tie | undefined;
    let bestScore = 0;
    for (let i = 0; i < fo.length; i++) {
      if (fk[i] || fs[i] < P.levels[2]) continue;
      const o = agents[fo[i]];
      if (o.partner >= 0 || o.city !== a.city || this.yr - o.birthYear < P.partnerMinAge) continue;
      if (this.week - this.since[o.id] < P.breakupCooldown) continue;
      if (Math.abs(o.birthYear - a.birthYear) > P.partnerAgeGap) continue;
      const t = this.adj[a.id].get(o.id);
      if (!t || t.kin || t.c < P.partnerCompat) continue;
      if (fs[i] * t.c > bestScore) {
        bestScore = fs[i] * t.c;
        best = t;
      }
    }
    if (!best) return;
    const b = agents[best.a === a.id ? best.b : best.a];
    a.partner = b.id;
    b.partner = a.id;
    a.family.push(b.id);
    b.family.push(a.id);
    // A partner is treated as family from here on: slow decay, regular time together.
    this.settle(best);
    best.kin = true;
    this.since[a.id] = this.since[b.id] = this.week;
    if (this.logging) this.couplesFormed++;
    if (this.logging && (a.id === this.ego || b.id === this.ego)) {
      this.events.push({ t: 'partner', week: this.week, other: a.id === this.ego ? b.id : a.id });
    }
  }

  /** Make plans: invite a few friends who are in town, favouring close and brand-new ones. */
  private hostOuting(h: Agent): void {
    const P = this.P;
    const id = h.id;
    const here = this.loc[id];
    const away = here !== h.city;
    if (this.outCount[id] >= this.maxOut(h)) return;
    const pHost = away ? P.hostAway : (P.hostBase + P.hostExt * h.ext) * this.activity(h);
    if (this.r(R.HOST, id) >= pHost) return;
    const cand = this.cand;
    const wts = this.wts;
    const str = this.str;
    cand.length = 0;
    wts.length = 0;
    str.length = 0;
    let W = 0;
    const fo = this.fo[id];
    const fs = this.fs[id];
    const fm = this.fm[id];
    const fk = this.fk[id];
    const loc = this.loc;
    for (let i = 0; i < fo.length; i++) {
      const o = fo[i];
      if (loc[o] !== here) continue;
      const s = fs[i];
      if (s < P.inviteMin) continue;
      let w = Math.max(s ** P.invitePow, 0.01);
      if (this.week - fm[i] < P.newWindow) w *= P.newBoost;
      if (fk[i]) w *= 0.3;
      cand.push(o);
      wts.push(w);
      str.push(s);
      W += w;
    }
    if (!cand.length) return;
    const W0 = W;
    const m = 1 + Math.floor(this.r(R.SIZE, id) * (1.5 + 2.5 * h.ext));
    const agents = this.world.agents;
    const group: number[] = [id];
    const probs: number[] = [pHost];
    for (let k = 0; k < m && W > 1e-9; k++) {
      let u = this.r(R.INVITE, id, k) * W;
      let idx = -1;
      for (let i = 0; i < cand.length; i++) {
        if (wts[i] <= 0) continue;
        idx = i;
        u -= wts[i];
        if (u <= 0) break;
      }
      if (idx < 0) break;
      const o = cand[idx];
      const pInvite = Math.min(1, (m * wts[idx]) / W0);
      W -= wts[idx];
      wts[idx] = 0;
      const pAccept = Math.min(1, P.acceptBase + P.acceptStrength * str[idx]);
      if (this.outCount[o] < this.maxOut(agents[o]) && this.r(R.ACCEPT, o, id) < pAccept) {
        group.push(o);
        probs.push(pInvite * pAccept);
      }
    }
    if (group.length < 2) return;
    // Partners often come along, which is how people get to know each other's friends.
    const bringer: number[] = group.map(() => -1);
    for (let i = 0, n = group.length; i < n; i++) {
      const p = agents[group[i]].partner;
      if (p < 0 || group.includes(p) || this.loc[p] !== here || this.outCount[p] >= this.maxOut(agents[p])) continue;
      if (this.r(R.PLUS_ONE, group[i], id) >= P.plusOne) continue;
      group.push(p);
      probs.push(probs[i] * P.plusOne);
      bringer.push(group[i]);
    }
    const v = this.pickHangout(h, here, 7);
    for (const g of group) {
      this.outCount[g]++;
      this.addAtt(v, g);
      this.bumpHaunt(agents[g], v);
    }
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (this.adj[a].has(b)) {
          this.interact(a, b, 'outing', v, 1, -1);
        } else if (this.r(R.INTRO, a, b) < Math.min(1, P.introChance * this.social(agents[a], agents[b]))) {
          const via = bringer[j] >= 0 ? bringer[j] : bringer[i] >= 0 ? bringer[i] : id;
          this.interact(a, b, 'outing', v, pHost * probs[i] * probs[j], via === a || via === b ? id : via);
        }
      }
    }
  }

  private soloOutings(a: Agent): void {
    const P = this.P;
    const id = a.id;
    const here = this.loc[id];
    if (here !== a.city) {
      if (this.r(R.AWAY_HANG, id) < 0.7) this.addAtt(this.pickHangout(a, here, 0), id);
      return;
    }
    const active = this.activity(a);
    if (this.r(R.SOLO, id, 0) < (P.soloBase + P.soloExt * a.ext) * active) {
      const v = this.pickHangout(a, here, 0);
      this.addAtt(v, id);
      this.bumpHaunt(a, v);
    }
    if (this.r(R.SOLO, id, 1) < P.soloSecond * a.ext * active) {
      const v = this.pickHangout(a, here, 1);
      this.addAtt(v, id);
      this.bumpHaunt(a, v);
    }
  }

  private mixVenue(ven: Venue): void {
    const list = this.att[ven.id];
    const n = list.length;
    if (n < 2) return;
    const P = this.P;
    const agents = this.world.agents;
    let tries: number;
    let open: number;
    let kb = P.knownBase;
    let kbias = P.knownBias;
    let ctx: Ctx;
    if (ven.kind === 'work') {
      tries = P.workTries;
      open = P.workOpen;
      ctx = 'work';
    } else if (ven.kind === 'club') {
      tries = CLUBS[ven.hobby].tries;
      open = CLUBS[ven.hobby].open;
      ctx = 'club';
    } else {
      tries = P.hangTries;
      open = P.hangOpen;
      kb = P.hangKnownBase;
      kbias = P.hangKnownBias;
      ctx = 'hangout';
    }
    for (let i = 0; i < n; i++) {
      const a = list[i];
      for (let t = 0; t < tries; t++) {
        const k = ven.id * 8 + t;
        let j = Math.floor(this.r(R.MIX, a, k) * (n - 1));
        if (j >= i) j++;
        const b = list[j];
        if (b === a) continue;
        const tie = this.adj[a].get(b);
        let acc = tie ? kb + kbias * this.cur(tie) : open * this.social(agents[a], agents[b]);
        if (acc > 1) acc = 1;
        if (this.r(R.MIX_ACC, a, k) >= acc) continue;
        let p = 1;
        if (!tie) {
          p = this.presence(agents[a], ven) * this.presence(agents[b], ven) * (1 - (1 - acc / (n - 1)) ** (2 * tries));
        }
        this.interact(a, b, ctx, ven.id, p, -1);
      }
    }
  }

  private familyTime(a: Agent): void {
    const id = a.id;
    for (const f of a.family) {
      if (f < id || this.loc[f] !== this.loc[id]) continue;
      const visiting = this.loc[id] !== a.city || this.loc[f] !== this.world.agents[f].city;
      if (visiting || f === a.partner || this.r(R.FAMILY, id, f) < this.P.familyDinner) this.interact(id, f, 'family', -1, 1, -1);
    }
  }

  private call(a: Agent): void {
    const P = this.P;
    const id = a.id;
    if (this.r(R.CALL, id) >= P.callBase + P.callExt * a.ext) return;
    const agents = this.world.agents;
    const cand = this.cand;
    const wts = this.wts;
    cand.length = 0;
    wts.length = 0;
    let W = 0;
    const fo = this.fo[id];
    const fs = this.fs[id];
    const fk = this.fk[id];
    for (let i = 0; i < fo.length; i++) {
      const o = fo[i];
      if (agents[o].city === a.city) continue;
      const s = fs[i];
      if (s < P.callMin) continue;
      const w = s * s * (fk[i] ? 0.5 : 1);
      cand.push(o);
      wts.push(w);
      W += w;
    }
    if (!cand.length) return;
    let u = this.r(R.CALL_PICK, id) * W;
    let pick = cand[cand.length - 1];
    for (let i = 0; i < cand.length; i++) {
      u -= wts[i];
      if (u <= 0) {
        pick = cand[i];
        break;
      }
    }
    this.interact(id, pick, 'call', -1, 1, -1);
  }

  /** Text a few of the people you are closest to, wherever they live. */
  private message(a: Agent): void {
    const P = this.P;
    const id = a.id;
    if (P.msgRate <= 0 || this.r(R.MSG, id) >= P.msgRate * (0.4 + 0.6 * a.ext)) return;
    const cand = this.cand;
    const wts = this.wts;
    cand.length = 0;
    wts.length = 0;
    let W = 0;
    const fo = this.fo[id];
    const fs = this.fs[id];
    for (let i = 0; i < fo.length; i++) {
      const s = fs[i];
      if (s < P.msgMin) continue;
      cand.push(fo[i]);
      wts.push(s * s);
      W += s * s;
    }
    for (let k = 0; k < P.msgCount && W > 1e-9; k++) {
      let u = this.r(R.MSG_PICK, id, k) * W;
      let idx = -1;
      for (let i = 0; i < cand.length; i++) {
        if (wts[i] <= 0) continue;
        idx = i;
        u -= wts[i];
        if (u <= 0) break;
      }
      if (idx < 0) break;
      W -= wts[idx];
      wts[idx] = 0;
      this.interact(id, cand[idx], 'message', -1, 1, -1);
    }
  }

  // ------------------------------------------------------------ bookkeeping

  private refreshAgent(a: number): void {
    const min = this.P.cacheMin;
    const fo = this.fo[a];
    const fs = this.fs[a];
    const fm = this.fm[a];
    const fk = this.fk[a];
    let n = 0;
    // forEach avoids allocating an entry array per tie, which matters here.
    this.adj[a].forEach((t, b) => {
      const s = this.cur(t);
      if (s < min) return;
      fo[n] = b;
      fs[n] = s;
      fm[n] = t.met;
      fk[n] = t.kin;
      n++;
    });
    fo.length = fs.length = fm.length = fk.length = n;
  }

  private refreshFriends(): void {
    for (let a = 0; a < this.adj.length; a++) this.refreshAgent(a);
  }

  /** Forget negligible ties between other people. The protagonist's ties are kept forever. */
  private prune(): void {
    const ego = this.ego;
    const below = this.P.pruneBelow;
    // Staggered: each agent's ties are swept once a year.
    for (let a = this.tick % 52; a < this.adj.length; a += 52) {
      if (a === ego) continue;
      const mine = this.adj[a];
      mine.forEach((t, b) => {
        if (b === ego || t.kin) return;
        if (this.cur(t) < below) {
          mine.delete(b);
          this.adj[b].delete(a);
        }
      });
    }
  }

  private checkEgoLevels(emit: boolean): void {
    const L = this.P.levels;
    for (const [o, t] of this.adj[this.ego]) {
      const s = this.cur(t);
      const prev = this.egoLevel.get(o) ?? 0;
      let lv = this.levelOf(s);
      // Hysteresis so a tie hovering on a threshold does not flap.
      if (lv < prev && s > L[prev - 1] * 0.8) lv = prev;
      if (lv === prev) continue;
      this.egoLevel.set(o, lv);
      if (emit) this.events.push({ t: 'level', week: this.week, other: o, from: prev, to: lv });
    }
  }

  private snapshot(): void {
    const L = this.P.levels;
    const nodes: [number, number, number][] = [];
    const set = new Set<number>();
    for (const [o, t] of this.adj[this.ego]) {
      const s = this.cur(t);
      if (s >= L[0]) {
        nodes.push([o, s, this.depth(t)]);
        set.add(o);
      }
    }
    const edges: [number, number, number][] = [];
    for (const [o] of nodes) {
      const fo = this.fo[o];
      const fs = this.fs[o];
      for (let i = 0; i < fo.length; i++) {
        const x = fo[i];
        if (x > o && set.has(x) && fs[i] >= L[1]) edges.push([o, x, fs[i]]);
      }
    }
    this.snapshots.push({ week: this.week, city: this.world.agents[this.ego].city, nodes, edges });
  }

  private trackNearMisses(): void {
    const mine = this.adj[this.ego];
    for (const v of this.egoVenues) {
      // Only open venues count: sharing an office or a club is not a near miss.
      if (this.world.venues[v].kind !== 'hangout') continue;
      for (const o of this.att[v]) {
        if (o !== this.ego && !mine.has(o)) this.copresence.set(o, (this.copresence.get(o) ?? 0) + 1);
      }
    }
  }

  // ------------------------------------------------------------------- loop

  step(): void {
    const { agents, venues } = this.world;
    const N = agents.length;
    for (const list of this.att) list.length = 0;
    this.outCount.fill(0);
    this.egoVenues.length = 0;
    this.yr = this.year();

    for (const a of agents) this.lifeEvents(a);
    for (const a of agents) this.loc[a.id] = a.city;
    for (const a of agents) this.maybeVisitFamily(a);
    for (const a of agents) if (this.loc[a.id] === a.city) this.routine(a);
    // Rotate who gets to make plans first so low ids are not favoured.
    const start = Math.floor(this.r(R.ORDER, 0) * N);
    for (let i = 0; i < N; i++) this.hostOuting(agents[(start + i) % N]);
    for (const a of agents) this.soloOutings(a);
    this.trackNearMisses();
    for (const ven of venues) this.mixVenue(ven);
    for (const a of agents) this.familyTime(a);
    for (const a of agents) this.call(a);
    for (const a of agents) this.message(a);

    this.tick++;
    for (let a = this.tick % 8; a < N; a += 8) this.refreshAgent(a);
    if (this.logging && this.tick % 4 === 0) this.checkEgoLevels(true);
    if (this.logging && this.tick % 13 === 0) this.snapshot();
    this.prune();
    this.week++;
  }

  /** Start recording the protagonist's life from the current week. */
  startLogging(): void {
    this.logging = true;
    this.refreshFriends();
    this.checkEgoLevels(false);
    this.snapshot();
  }

  finish(): void {
    this.refreshFriends();
    this.checkEgoLevels(true);
    this.snapshot();
  }
}

export function runLife(opt: LifeOptions): LifeResult {
  const years = opt.years ?? 40;
  const burnIn = opt.burnInYears ?? 5;
  const startYear = opt.startYear ?? 2026;
  const params: Params = { ...DEFAULT_PARAMS, ...opt.params };
  const world = generateWorld({ seed: opt.seed, startYear, cities: opt.cities ?? DEFAULT_CITIES, ego: opt.ego });
  const sim = new Sim(world, opt.seed, params, startYear, -burnIn * 52);
  // Burn-in: the same rules run for a few years so the starting network is not hand-made.
  while (sim.week < 0) sim.step();
  const e = world.agents[world.ego];
  const start: StartProfile = {
    city: e.city, work: e.work, clubs: [...e.clubs], hobbies: [...e.hobbies], age: startYear - e.birthYear, partner: e.partner,
  };
  sim.startLogging();
  for (let w = 0; w < years * 52; w++) sim.step();
  sim.finish();
  const ties = new Map<number, Tie & { now: number; depthNow: number }>();
  for (const [o, t] of sim.adj[world.ego]) ties.set(o, { ...t, now: sim.cur(t), depthNow: sim.depth(t) });
  return {
    seed: opt.seed, startYear, years, params, world, ego: world.ego, start,
    events: sim.events, contacts: sim.contacts, snapshots: sim.snapshots, ties, sim,
  };
}
