// Retells a finished life as the handful of people who mattered, each with a beginning,
// a middle and an ending, instead of a list of meetings. Pure function of the LifeResult.
//
// This is an experiment (see docs/experience.md). It adds no rules to the simulation: every
// sentence is read off the event log, the contact rows and the quarterly snapshots.

import { CLUBS, CTX_LIST } from './activities';
import { formatOdds } from './highlights';
import { clickReasons, descriptor, kinWord } from './people';
import type { LifeResult, SimEvent } from './sim';

export type ArcRole = 'family' | 'partner' | 'childhood' | 'work' | 'club' | 'chance' | 'introduced';
export type ArcShape = 'constant' | 'season' | 'cooled' | 'slow' | 'cameBack' | 'late' | 'steady';

export interface ArcBeat {
  /** Week the beat belongs to; beats are in order. */
  week: number;
  text: string;
}

export interface Arc {
  id: number;
  name: string;
  role: ArcRole;
  shape: ArcShape;
  /** Short description of who they are to you, e.g. "met by chance" or "one of your parents". */
  label: string;
  /** Closeness added up over the years; what the cast is ranked by. */
  score: number;
  /** Week they first appear in the story (0 if you already knew them). */
  from: number;
  /** First and last week you were close friends or better, or -1. */
  closeFrom: number;
  closeTo: number;
  /** Times you saw each other in person during the story. */
  seen: number;
  /** Chance you met that week, if you met during the story and it was not a sure thing. */
  odds: number | null;
  /** Week you met, or -1 if you knew them before the story. */
  met: number;
  /** Week you last saw each other in person during the story, or -1. */
  last: number;
  /** Whether they are one of the people the story is about. */
  cast: boolean;
  /** What the catalog of everyone is sorted by: closeness over the years, with family counting for more. */
  relevance: number;
  /** People who reached you through them, directly or further down the chain, and became friends. */
  ledTo: number[];
  beats: ArcBeat[];
}

export interface Thread {
  /** The chain from the person back to its root, e.g. [partner, Diego, Axel]. */
  chain: number[];
  text: string;
}

export interface ArcsResult {
  /** The people the story is about, in order of appearance. */
  cast: Arc[];
  /** Everyone the protagonist ever knew, cast included, most relevant first. */
  everyone: Arc[];
  /** Chains of introductions worth telling: who led to whom. */
  threads: Thread[];
  /** People met during the story who are not in the cast. */
  others: number;
  /** For each person met during the story: who they reached you through, or -1. */
  parent: Map<number, number>;
}

const IN_PERSON = CTX_LIST.map((c) => c !== 'call' && c !== 'message');
const CALL = CTX_LIST.indexOf('call');

export interface ArcOptions {
  /** The cast is at least this large when the life has enough people in it. */
  min?: number;
  /** And never larger than this. Between the two, a friend joins only if they mattered enough. */
  max?: number;
}

export function findArcs(life: LifeResult, opt: ArcOptions = {}): ArcsResult {
  const min = opt.min ?? 7;
  const max = Math.max(min, opt.max ?? 14);
  const { world, ties, events, contacts, snapshots, params } = life;
  const { agents, venues, cities } = world;
  const L = params.levels;
  const ego = life.ego;
  const me = agents[ego];
  const endWeek = life.years * 52;
  const first = (id: number) => agents[id].name.split(' ')[0];
  const year = (w: number) => life.startYear + Math.floor(w / 52);
  const vname = (v: number) => (v >= 0 ? venues[v].name : 'somewhere');
  const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const list = (names: string[]) =>
    names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

  // --- Closeness of each person at each quarterly snapshot.
  const series = new Map<number, Float32Array>();
  snapshots.forEach((snap, i) => {
    for (const [o, s] of snap.nodes) {
      let arr = series.get(o);
      if (!arr) series.set(o, (arr = new Float32Array(snapshots.length)));
      arr[i] = s;
    }
  });
  const snapWeek = (i: number) => snapshots[i].week;

  // --- What the contact rows say about each person.
  interface Seen {
    n: number; calls: number; last: number; lastVenue: number; venues: Map<number, number>;
    /** In-person meetings per decade of the story. */
    decade: number[];
    weeks: number[];
  }
  const seen = new Map<number, Seen>();
  for (let i = 0; i < contacts.length; i += 4) {
    const w = contacts[i];
    const o = contacts[i + 1];
    const v = contacts[i + 2];
    const c = contacts[i + 3];
    let s = seen.get(o);
    if (!s) seen.set(o, (s = { n: 0, calls: 0, last: -1, lastVenue: -1, venues: new Map(), decade: [], weeks: [] }));
    if (c === CALL) s.calls++;
    if (!IN_PERSON[c]) continue;
    // Several rows in one week (work and a night out) still count as separate times together.
    s.n++;
    s.last = w;
    s.lastVenue = v;
    s.weeks.push(w);
    if (v >= 0) s.venues.set(v, (s.venues.get(v) ?? 0) + 1);
    const d = Math.floor(w / 520);
    s.decade[d] = (s.decade[d] ?? 0) + 1;
  }

  // --- Where everyone lived, from the move log (every move in the world is recorded).
  const moves = new Map<number, Extract<SimEvent, { t: 'move' }>[]>();
  for (const e of events) {
    if (e.t !== 'move') continue;
    let m = moves.get(e.who);
    if (!m) moves.set(e.who, (m = []));
    m.push(e);
  }
  const cityAt = (id: number, w: number): number => {
    const m = moves.get(id);
    if (!m) return agents[id].city;
    let c = m[0].from;
    for (const e of m) if (e.week <= w) c = e.to;
    return c;
  };

  /** After the two end up in different cities at `from`: the week they next share a city, or the end. */
  const apartUntil = (id: number, from: number): number => {
    const weeks = [...(moves.get(id) ?? []), ...(moves.get(ego) ?? [])].map((e) => e.week).filter((w) => w > from).sort((a, b) => a - b);
    for (const w of weeks) if (cityAt(id, w) === cityAt(ego, w)) return w;
    return endWeek;
  };

  // --- Partners over the story.
  const partnerSpans: { id: number; from: number; to: number }[] = [];
  if (life.start.partner >= 0) partnerSpans.push({ id: life.start.partner, from: -1, to: -1 });
  for (const e of events) {
    if (e.t === 'partner') partnerSpans.push({ id: e.other, from: e.week, to: -1 });
    if (e.t === 'breakup') {
      const span = [...partnerSpans].reverse().find((p) => p.id === e.other && p.to < 0);
      if (span) span.to = e.week;
    }
  }
  const partnerIds = new Set(partnerSpans.map((p) => p.id));

  // --- Who led to whom. A person reached you "through" someone if that someone introduced you,
  // or brought you into the club or job where you met.
  const broughtTo = new Map<number, { via: number; week: number }>();
  for (const e of events) {
    if (e.t === 'club' && e.via >= 0) broughtTo.set(e.venue, { via: e.via, week: e.week });
    if (e.t === 'job' && e.via >= 0) broughtTo.set(e.to, { via: e.via, week: e.week });
  }
  const parent = new Map<number, number>();
  for (const [o, t] of ties) {
    if (t.met < 0 || t.kin && !partnerIds.has(o)) continue;
    let via = t.via;
    if (via < 0 && (t.ctx === 'club' || t.ctx === 'work')) {
      const b = broughtTo.get(t.venue);
      if (b && b.week <= t.met && b.via !== o) via = b.via;
    }
    parent.set(o, via === ego ? -1 : via);
  }
  const chainOf = (id: number): number[] => {
    const chain = [id];
    let cur = id;
    while (chain.length < 12) {
      const p = parent.get(cur);
      if (p === undefined || p < 0 || chain.includes(p)) break;
      chain.push(p);
      cur = p;
    }
    return chain;
  };
  /** Everyone downstream of each person who became at least a friend. */
  const downstream = new Map<number, number[]>();
  for (const [o, t] of ties) {
    if (!parent.has(o) || t.peak < L[1]) continue;
    for (const up of chainOf(o).slice(1)) {
      let d = downstream.get(up);
      if (!d) downstream.set(up, (d = []));
      d.push(o);
    }
  }

  // --- Events grouped by person.
  const metEvent = new Map<number, Extract<SimEvent, { t: 'met' }>>();
  const byPerson = new Map<number, SimEvent[]>();
  const push = (id: number, e: SimEvent) => {
    let l = byPerson.get(id);
    if (!l) byPerson.set(id, (l = []));
    l.push(e);
  };
  const egoMoves: Extract<SimEvent, { t: 'move' }>[] = [];
  for (const e of events) {
    if (e.t === 'met') metEvent.set(e.other, e);
    else if (e.t === 'reunion' || e.t === 'level' || e.t === 'partner' || e.t === 'breakup') push(e.other, e);
    else if (e.t === 'move') {
      if (e.who === ego) egoMoves.push(e);
      else if (ties.has(e.who)) push(e.who, e);
    } else if ((e.t === 'job' || e.t === 'hobby' || e.t === 'club') && e.via >= 0) push(e.via, e);
  }

  // --- Score everyone and choose a cast with some variety in it.
  interface Cand { id: number; role: ArcRole; shape: ArcShape; score: number; closeFrom: number; closeTo: number }
  const shapeOf = (id: number): { shape: ArcShape; closeFrom: number; closeTo: number; score: number } => {
    const arr = series.get(id);
    let closeFrom = -1;
    let closeTo = -1;
    let score = 0;
    let closeQ = 0;
    let knownQ = 0;
    let cameBack = false;
    let apartQ = 0;
    let wasClose = false;
    if (arr) {
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        if (s >= L[0]) knownQ++;
        if (s >= L[1]) score += s / 4;
        if (s >= L[2]) {
          if (closeFrom < 0) closeFrom = snapWeek(i);
          closeTo = snapWeek(i);
          closeQ++;
          if (wasClose && apartQ >= 8) cameBack = true;
          wasClose = true;
          apartQ = 0;
        } else if (wasClose && s < L[1]) apartQ++;
      }
    }
    const endS = arr ? arr[arr.length - 1] : 0;
    const knownFrom = Math.max(0, ties.get(id)!.met);
    let shape: ArcShape = 'steady';
    if (cameBack) shape = 'cameBack';
    else if (closeQ > 0 && endS < L[1]) shape = 'season';
    else if (closeQ > 0 && endS < L[2] && endWeek - closeTo >= 156) shape = 'cooled';
    else if (closeFrom >= endWeek * 0.6 && endS >= L[2]) shape = 'late';
    else if (closeFrom - knownFrom >= 260 && endS >= L[2]) shape = 'slow';
    else if (closeQ > 0 && closeQ >= 0.6 * snapshots.length && endS >= L[1]) shape = 'constant';
    return { shape, closeFrom, closeTo, score };
  };
  const roleOf = (id: number): ArcRole => {
    const t = ties.get(id)!;
    if (partnerIds.has(id)) return 'partner';
    if (t.kin) return 'family';
    switch (t.ctx) {
      case 'childhood': return 'childhood';
      case 'work': return 'work';
      case 'club': return 'club';
      case 'outing': return 'introduced';
      default: return 'chance';
    }
  };

  const cands: Cand[] = [];
  for (const id of ties.keys()) cands.push({ id, role: roleOf(id), ...shapeOf(id) });

  const chosen: Cand[] = [];
  // Partners first, then the family you actually spent time with, then friends.
  const partners = cands.filter((c) => c.role === 'partner');
  chosen.push(...partners.slice(-3));
  const contactCount = (id: number) => (seen.get(id)?.n ?? 0) + (seen.get(id)?.calls ?? 0);
  const family = cands.filter((c) => c.role === 'family').sort((a, b) => contactCount(b.id) - contactCount(a.id));
  chosen.push(...family.slice(0, 3));
  const friends = cands.filter((c) => c.role !== 'family' && c.role !== 'partner' && c.score > 0);
  const minPeak = friends.filter((c) => ties.get(c.id)!.peak >= L[2]).length >= 4 ? L[2] : L[1];
  const pool = friends.filter((c) => ties.get(c.id)!.peak >= minPeak);
  let firstScore = -1;
  while (chosen.length < max && pool.length) {
    // Each repeat of a role or shape already in the cast costs a little, so the cast is not ten coworkers.
    let best = 0;
    let bestScore = -1;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      const sameRole = chosen.filter((x) => x.role === c.role).length;
      const sameShape = chosen.filter((x) => x.role !== 'family' && x.role !== 'partner' && x.shape === c.shape).length;
      const onScreen = ties.get(c.id)!.met >= 0 ? 1.4 : 1;
      const s = (c.score * onScreen + (downstream.get(c.id)?.length ?? 0)) * 0.75 ** sameRole * 0.6 ** sameShape;
      if (s > bestScore) { bestScore = s; best = i; }
    }
    if (firstScore < 0) firstScore = bestScore;
    // A quiet life gets a small cast; a full one gets more, but only people who compare with the first.
    if (chosen.length >= min && bestScore < 0.3 * firstScore) break;
    chosen.push(pool.splice(best, 1)[0]);
  }
  const castIds = new Set(chosen.map((c) => c.id));

  // --- Tell each arc.
  const ageOf = (id: number, w: number) => year(w) - agents[id].birthYear;
  const levelName = (s: number) => (s >= L[3] ? 'inner circle' : s >= L[2] ? 'close friend' : s >= L[1] ? 'friend' : 'acquaintance');
  const span = (weeks: number) => {
    const y = Math.round(weeks / 52);
    return y < 1 ? 'less than a year' : y === 1 ? 'a year' : `${y} years`;
  };

  const tell = (c: Cand): Arc => {
    const id = c.id;
    const t = ties.get(id)!;
    const who = first(id);
    const s = seen.get(id);
    /** What came of a move that put the two of you in different cities. */
    const apart = (from: number): string => {
      const until = apartUntil(id, from);
      const n = s ? s.weeks.filter((w) => w > from && w <= until).length : 0;
      if (until >= endWeek) return n ? ` You saw each other ${times(n)} after that.` : ' You never saw each other again.';
      const yrs = span(until - from);
      return n ? ` In the ${yrs} you lived apart you saw each other ${times(n)}.` : ` In the ${yrs} you lived apart you did not see each other once.`;
    };
    const beats: ArcBeat[] = [];
    const met = metEvent.get(id);
    const arr = series.get(id);
    const led = (downstream.get(id) ?? []).sort((a, b) => ties.get(b)!.peak - ties.get(a)!.peak);
    let label: string;
    const apartAtStart = cityAt(id, 0) !== cityAt(ego, 0)
      ? ` When the story starts ${who} lives in ${cities[cityAt(id, 0)].name} and you live in ${cities[cityAt(ego, 0)].name}.`
      : '';
    const together = (w: number) => partnerSpans.some((p) => p.id === id && w >= p.from && (p.to < 0 || w <= p.to));

    // Beginning.
    if (c.role === 'family') {
      label = `your ${kinWord(me, agents[id])}`;
      const where = cityAt(id, 0) === cityAt(ego, 0) ? `in ${cities[cityAt(id, 0)].name}, like you` : `in ${cities[cityAt(id, 0)].name}`;
      beats.push({ week: 0, text: `${who} is ${label}, ${ageOf(id, 0)} when the story starts and living ${where}.` });
    } else if (!met) {
      const yrs = Math.max(1, Math.round(-t.met / 52));
      if (t.ctx === 'childhood') {
        label = 'a friend from growing up';
        beats.push({ week: 0, text: `You and ${who} grew up together in ${cities[agents[id].hometown].name}. You have known each other as long as you can remember.${apartAtStart}` });
      } else {
        label = t.ctx === 'work' ? 'a friend from work' : t.ctx === 'club' ? `a friend from ${vname(t.venue)}` : 'an old friend';
        const how = t.ctx === 'work' ? `from work at ${vname(t.venue)}` : t.ctx === 'club' ? `from ${vname(t.venue)}` : t.ctx === 'outing' ? 'through friends' : 'from around town';
        beats.push({ week: 0, text: `You already know ${who} (${ageOf(id, 0)}, ${descriptor(agents[id])}) when the story starts: ${plural(yrs, 'year')}, ${how}.${apartAtStart}` });
      }
    } else {
      const intro = `${agents[id].name} (${ageOf(id, met.week)}, ${descriptor(agents[id])})`;
      let text: string;
      if (met.ctx === 'work') { label = 'met at work'; text = `In ${year(met.week)} you met ${intro}, a coworker at ${vname(met.venue)}.`; }
      else if (met.ctx === 'club') { label = `met at ${vname(met.venue)}`; text = `In ${year(met.week)} you met ${intro} at ${vname(met.venue)}.`; }
      else if (met.ctx === 'outing') {
        label = met.via >= 0 ? `introduced by ${first(met.via)}` : 'met through friends';
        text = `In ${year(met.week)} ${met.via >= 0 ? agents[met.via].name : 'a friend'} introduced you to ${intro} at ${vname(met.venue)}.`;
      } else { label = 'met by chance'; text = `In ${year(met.week)} you got talking to ${intro}, a stranger at ${vname(met.venue)}.`; }
      if (met.p < 0.2) text += ` It was ${formatOdds(met.p)} that week.`;
      if (met.nearMisses >= 20) text += ` You had been in the same room ${met.nearMisses} times before without speaking.`;
      const why = t.peak >= L[1] ? clickReasons(me, agents[id]) : [];
      if (why.length) text += ` You clicked over ${why.join(' and ')}.`;
      beats.push({ week: met.week, text });
    }

    // Growing close.
    if (c.role !== 'family' && c.closeFrom >= 0 && arr) {
      const startW = Math.max(0, t.met);
      let innerFrom = -1;
      for (let i = 0; i < arr.length; i++) if (arr[i] >= L[3]) { innerFrom = snapWeek(i); break; }
      if (c.closeFrom >= 26) {
        const quick = c.closeFrom - startW <= 39;
        let text = quick && t.met >= 0 ? 'Within months you were close friends' : `By ${year(c.closeFrom)} you were close friends`;
        if (innerFrom >= 0) text += innerFrom - c.closeFrom < 52 ? ', and soon one of the few people in your inner circle' : `, and by ${year(innerFrom)} one of the few people in your inner circle`;
        beats.push({ week: c.closeFrom, text: `${text}.` });
      } else if (t.met < 0) {
        beats.push({ week: 0, text: `You are ${innerFrom >= 0 && innerFrom < 26 ? 'in each other’s inner circle' : 'close friends'} from the first page.` });
      }
    }

    // Turns: moves, drifting, coming back, getting together, splitting up.
    const turns: ArcBeat[] = [];
    let wasClose = false;
    let faded = false;
    for (const e of byPerson.get(id) ?? []) {
      if (e.t === 'move') {
        if (together(e.week)) continue;
        const egoCity = cityAt(ego, e.week);
        const known = (arr && nearest(arr, e.week)) || 0;
        if (known < L[1] && c.role !== 'family') continue;
        if (e.from === egoCity) {
          turns.push({ week: e.week, text: `In ${year(e.week)} ${who} moved away to ${cities[e.to].name}.${apart(e.week)}` });
        } else if (e.to === egoCity) {
          turns.push({ week: e.week, text: `In ${year(e.week)} ${who} moved to ${cities[e.to].name}, where you were living.` });
        }
      } else if (e.t === 'level' && c.role !== 'family' && !partnerIds.has(id)) {
        if (e.to >= 3) {
          if (faded) turns.push({ week: e.week, text: `In ${year(e.week)} the two of you grew close again.` });
          faded = false;
          wasClose = true;
        } else if (e.to <= 1 && wasClose && !faded) {
          faded = true;
          turns.push({ week: e.week, text: `By ${year(e.week)} you had drifted apart.` });
        }
      } else if (e.t === 'reunion') {
        const yrs = Math.round(e.gap / 52);
        const how = e.ctx === 'hangout' ? `ran into ${who} at ${vname(e.venue)}` : e.ctx === 'outing' ? `caught up with ${who} at ${vname(e.venue)}` : `found ${who} at ${vname(e.venue)}`;
        turns.push({ week: e.week, text: `In ${year(e.week)} you ${how} in ${cities[e.city].name}, the first time in ${yrs} years.` });
      } else if (e.t === 'partner') {
        turns.push({ week: e.week, text: `In ${year(e.week)}, ${span(e.week - Math.max(0, t.met))} after ${t.met >= 0 ? 'you met' : 'the story began'}, you got together.` });
      } else if (e.t === 'breakup') {
        turns.push({ week: e.week, text: `In ${year(e.week)}, after ${span(e.weeks)} together, you went your separate ways.` });
      } else if (e.t === 'job') {
        turns.push({ week: e.week, text: `In ${year(e.week)} ${who} got you your job at ${vname(e.to)}.` });
      } else if (e.t === 'hobby') {
        turns.push({ week: e.week, text: `In ${year(e.week)} ${who} got you into ${CLUBS[e.to].hobby}.` });
      } else if (e.t === 'club') {
        turns.push({ week: e.week, text: `In ${year(e.week)} ${who} brought you along to ${vname(e.venue)}.` });
      }
    }
    for (const m of egoMoves) {
      const known = (arr && nearest(arr, m.week)) || 0;
      if ((known >= L[1] || c.role === 'family') && cityAt(id, m.week) === m.from) {
        turns.push({ week: m.week, text: `In ${year(m.week)} you moved to ${cities[m.to].name} and ${who} stayed in ${cities[m.from].name}.${apart(m.week)}` });
      }
    }
    turns.sort((a, b) => a.week - b.week);
    // A long life can pile up reunions and moves; keep the first few and the last.
    const kept = turns.length > 6 ? [...turns.slice(0, 4), ...turns.slice(-2)] : turns;

    // Middle: how much of each other you saw, and what they led to.
    const middle: string[] = [];
    const brief = c.role !== 'family' && (s?.n ?? 0) <= 2 && t.peak < L[1];
    if (s && s.n > 0 && c.role !== 'partner' && !brief) {
      const top = [...s.venues.entries()].sort((a, b) => b[1] - a[1])[0];
      const mostly = top && top[1] >= 5 && top[1] >= s.n * 0.25 ? `, more often at ${vname(top[0])} than anywhere else` : '';
      const calls = s.calls >= 10 ? `${mostly ? ',' : ''} and spoke on the phone ${s.calls} times` : '';
      const known = Math.round((endWeek - Math.max(0, t.met)) / 52);
      middle.push(`Over ${known >= life.years ? `the ${life.years}` : known} years you saw each other ${times(s.n)}${mostly}${calls}.`);
      if (c.role === 'family' && s.decade.length >= 2) {
        const a = s.decade[0] ?? 0;
        const z = s.decade[s.decade.length - 1] ?? 0;
        if (a > z * 1.5 && a >= 10) middle.push(`${a} of those were in the first ten years and ${z} in the last ten.`);
      }
    }
    if (led.length) {
      const direct = led.filter((x) => parent.get(x) === id);
      const names = led.slice(0, 2).map((x) => agents[x].name);
      const through = led.find((x) => partnerIds.has(x));
      let text = `${plural(led.length, 'friend')} reached you through ${who}`;
      text += led.length <= 2 ? `: ${list(names)}.` : `, ${list(names)} among them.`;
      if (through !== undefined && through !== id) {
        const hops = chainOf(through);
        text += hops[1] === id
          ? ` One of them was ${agents[through].name}, who became your partner.`
          : ` At the end of that chain was ${agents[through].name}, who became your partner.`;
      }
      if (direct.length || through !== undefined) middle.push(text);
    }

    // Ending.
    const nowS = t.now;
    const since = s && s.last >= 0 ? endWeek - s.last : endWeek;
    const elsewhere = agents[id].city !== me.city ? `, though ${who} lives in ${cities[agents[id].city].name}` : '';
    let ending: ArcBeat;
    if (brief && s && s.last >= 0) {
      ending = { week: s.last, text: s.n === 1 ? (met ? 'You only ever spoke that once.' : `You saw each other once, in ${year(s.last)}.`) : `You saw each other twice, the last time in ${year(s.last)}.` };
    } else if (brief) {
      ending = { week: beats[0].week, text: 'Your paths did not cross during the story.' };
    } else if (partnerIds.has(id) && me.partner === id) {
      const sp = partnerSpans.find((p) => p.id === id && p.to < 0)!;
      ending = { week: endWeek, text: sp.from >= 0 ? `At ${ageOf(ego, endWeek)} you are still together, ${span(endWeek - sp.from)} on.` : `At ${ageOf(ego, endWeek)} you are still together.` };
    } else if (since >= 260 && nowS < L[2] && s && s.last >= 0) {
      ending = { week: s.last, text: `The last time you saw each other was at ${vname(s.lastVenue)} in ${year(s.last)}. Neither of you knew it was the last time.` };
    } else if (nowS >= L[2]) {
      const recent = s ? s.weeks.filter((w) => w > endWeek - 104).length / 2 : 0;
      const often = recent >= 26 ? 'most weeks' : recent >= 6 ? 'most months' : recent >= 1 ? 'a few times a year' : 'rarely';
      ending = { week: endWeek, text: `At ${ageOf(ego, endWeek)} you still count ${who} as ${nowS >= L[3] ? 'inner circle' : c.role === 'family' ? 'close' : 'a close friend'}${elsewhere}. You see each other ${often}.` };
    } else if (since >= 260) {
      ending = { week: endWeek, text: `By the end you had not seen each other in ${span(since)}.` };
    } else if (c.shape === 'cooled') {
      ending = { week: endWeek, text: `At ${ageOf(ego, endWeek)} you are still friends, but not as close as you were.` };
    } else {
      ending = { week: endWeek, text: `At ${ageOf(ego, endWeek)} ${who} is ${nowS >= L[1] ? 'still a friend' : 'someone you still see now and then'}${elsewhere}.` };
    }

    const midWeek = c.closeFrom >= 0 ? c.closeFrom : beats[0].week;
    beats.push(...middle.map((text) => ({ week: midWeek, text })));
    // Keep turns that come before the ending; a move after the last meeting is noise.
    beats.push(...kept.filter((b) => b.week <= ending.week), ending);

    return {
      id, name: agents[id].name, role: c.role, shape: c.shape, label, score: c.score,
      from: Math.max(0, t.met), closeFrom: c.closeFrom, closeTo: c.closeTo, seen: s?.n ?? 0,
      odds: met && met.p < 0.5 ? met.p : null, met: t.met >= 0 && met ? t.met : -1, ledTo: led, beats,
      last: s?.last ?? -1, cast: castIds.has(id),
      relevance: c.score * (c.role === 'family' || c.role === 'partner' ? 1.5 : 1) + t.peak + Math.min(1, (s?.n ?? 0) / 1000),
    };

    function nearest(a: Float32Array, w: number): number {
      // Snapshots are quarterly from week 0.
      return a[Math.min(a.length - 1, Math.max(0, Math.round(w / 13)))];
    }
  };

  const everyone = cands.map(tell).sort((a, b) => b.relevance - a.relevance);
  const cast = everyone.filter((a) => a.cast).sort((a, b) => a.from - b.from || b.score - a.score);

  // --- Threads: the introductions that link the cast together.
  const threads: Thread[] = [];
  const seenChains = new Set<string>();
  for (const a of [...cast].sort((x, y) => y.score - x.score)) {
    const chain = chainOf(a.id);
    if (chain.length < 2) continue;
    const key = chain.join('>');
    if ([...seenChains].some((k) => k.endsWith(key) || k === key)) continue;
    seenChains.add(key);
    const root = chain[chain.length - 1];
    const rootMet = metEvent.get(root);
    const rootTie = ties.get(root);
    let origin: string;
    if (rootMet) {
      const where = rootMet.ctx === 'work' ? `a job at ${vname(rootMet.venue)}` : rootMet.ctx === 'club' ? vname(rootMet.venue) : rootMet.ctx === 'outing' ? `a night at ${vname(rootMet.venue)}` : `a chance meeting at ${vname(rootMet.venue)}`;
      origin = `${where} in ${year(rootMet.week)}${rootMet.p < 0.2 ? `, ${formatOdds(rootMet.p)} that week` : ''}`;
    } else if (rootTie?.kin) origin = 'your family';
    else if (rootTie?.ctx === 'childhood') origin = `growing up in ${cities[agents[root].hometown].name}`;
    else origin = 'before the story began';
    const down = downstream.get(root)?.length ?? 0;
    const parts = [rootMet ? `${agents[root].name} came into your life through ${origin}.` : `You know ${agents[root].name} from ${origin}.`];
    for (let i = chain.length - 2; i >= 0; i--) {
      const child = chain[i];
      const par = chain[i + 1];
      const ct = ties.get(child)!;
      parts.push(
        ct.via === par
          ? `${first(par)} introduced you to ${agents[child].name}${partnerIds.has(child) ? ', who became your partner' : ''}.`
          : `${first(par)} brought you to ${vname(ct.venue)}, where you met ${agents[child].name}${partnerIds.has(child) ? ', who became your partner' : ''}.`,
      );
    }
    if (down >= 3) parts.push(`In all, ${down} of your friends trace back to ${first(root)}.`);
    threads.push({ chain, text: parts.join(' ') });
  }

  let metCount = 0;
  for (const [o, t] of ties) if (t.met >= 0 && !castIds.has(o)) metCount++;
  return { cast, everyone, threads, others: metCount, parent };
}

export const SHAPE_NAMES: Record<ArcShape, string> = {
  constant: 'there the whole way',
  season: 'a season of your life',
  cooled: 'close once, friends now',
  slow: 'a slow burn',
  cameBack: 'lost and found',
  late: 'arrived late',
  steady: 'part of the picture',
};
