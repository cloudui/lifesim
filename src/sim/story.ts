// The story editor: cuts a finished life down to a dozen or so beats that read as one contained
// story. Pure function of the LifeResult, like highlights and arcs.
//
// It mixes three kinds of beat:
//   turning points  moves, getting together, falling out, a death. Rare and consequential.
//   texture         the family table each December, a standing night out with a friend. Not rare
//                   at all; they are what makes it feel like a life, and they show change by
//                   repeating.
//   facts           arithmetic on the log, shown as a card between scenes.
// "Contained" is a rule. The story is about one person: whoever has the most turns in their story
// with you (a separation and a return, a falling-out, turning up in a bad week, becoming your
// partner), not simply whoever was closest. The family, and a partner who is not that person, are
// a second thread underneath. Everyone else is described, not named. It opens on the family table.
//
// Closeness has to be shown before a turn can matter, so the one person also gets small moments:
// a few scenes from the early years, a long talk, the week they turned up. Those events are read
// from the log; the specifics in them come from the detail library (details.ts).

import { CLUBS, CTX_LIST } from './activities';
import { findArcs, type Arc } from './arcs';
import { details } from './details';
import { formatOdds } from './highlights';
import { clickReasons, descriptor, kinWord } from './people';
import type { LifeResult, SimEvent } from './sim';

/** The scene template a beat would be staged with. */
export type StoryScene =
  | 'table' | 'meet' | 'ritual' | 'move' | 'together' | 'breakup' | 'fallout' | 'makeup'
  | 'reunion' | 'goodbye' | 'last' | 'nudge' | 'fact' | 'end'
  // Scenes for the one person the story is about.
  | 'early' | 'talk' | 'showup' | 'gap' | 'visit' | 'without';

export interface StoryBeat {
  week: number;
  age: number;
  year: number;
  scene: StoryScene;
  /** turn, texture or fact: which kind of importance put it in. */
  kind: 'turn' | 'texture' | 'fact';
  /** A short heading, e.g. "December 2041" or "Hopleaf Bar". */
  title: string;
  /** One to three short sentences, present tense. */
  text: string;
  /** Named people in the beat. */
  people: number[];
  venue: number;
  /** Importance. Required beats are 99. */
  weight: number;
  /** Everyone to draw besides the protagonist. */
  stage: number[];
  /** Empty chairs at the table: family who have died by now. */
  empty: number;
  /** The city the protagonist lives in, and for a move the one they left (otherwise -1). */
  city: number;
  from: number;
  /** work, club, bar, cafe or park when the beat happens at a venue, otherwise ''. */
  place: string;
  /** For a beat about living apart: the city the other person is in, otherwise -1. */
  otherCity: number;
}

export interface StoryLead {
  id: number;
  name: string;
  /** "partner", "childhood friend", "pub quiz", ... */
  tag: string;
  /** The one person the story is about. A partner who is not that person is listed after them. */
  main: boolean;
  /** How their part of the story ends. */
  ending: 'together' | 'split' | 'close' | 'friends' | 'faded' | 'rift' | 'died';
}

export interface Story {
  leads: StoryLead[];
  beats: StoryBeat[];
  /** Beats that were candidates and did not make the cut, best first. For tuning the editor. */
  cut: { week: number; scene: StoryScene; weight: number; note: string }[];
}

export interface StoryOptions {
  /** Most beats the story may have. */
  budget?: number;
  /** Rename one lead, e.g. to a real friend's name. `lead` counts from 0 in the order of `leads`; 0 is the main one. */
  rename?: { lead: number; name: string };
}

const IN_PERSON = CTX_LIST.map((c) => c !== 'call' && c !== 'message');
const WORK = CTX_LIST.indexOf('work');

interface Cand {
  week: number;
  /** Sort order within a week. */
  order: number;
  scene: StoryScene;
  kind: StoryBeat['kind'];
  weight: number;
  required: boolean;
  /** Which lead it belongs to, or -1. */
  lead: number;
  venue: number;
  people: number[];
  note: string;
  /** Beats compete for places within their group; by default the scene. */
  group: string;
  stage?: number[];
  empty?: number;
  from?: number;
  otherCity?: number;
  /** A flashback: the week the beat's age and year are taken from, when it is not `week`. */
  at?: number;
  /** Two candidates with the same key tell the same event; only one may be chosen. */
  key?: string;
  /** Written only once the cut is final, in order, so first mentions can introduce people. */
  tell: () => { title: string; text: string };
}

export function tellStory(life: LifeResult, opt: StoryOptions = {}): Story {
  const budget = opt.budget ?? 16;
  const { world, ties, events, contacts, snapshots, params } = life;
  const { agents, venues, cities } = world;
  const L = params.levels;
  const ego = life.ego;
  const me = agents[ego];
  const endWeek = life.years * 52;
  const arcs = findArcs(life);
  const arcOf = new Map<number, Arc>(arcs.everyone.map((a) => [a.id, a]));

  const rename = new Map<number, string>();
  const first = (id: number) => rename.get(id) ?? agents[id].name.split(' ')[0];
  const full = (id: number) => rename.get(id) ?? agents[id].name;
  const year = (w: number) => life.startYear + Math.floor(w / 52);
  const age = (w: number) => life.start.age + Math.floor(Math.min(w, endWeek - 1) / 52);
  const ageOf = (id: number, w: number) => year(w) - agents[id].birthYear;
  const vname = (v: number) => (v >= 0 ? venues[v].name : 'somewhere');
  const n = (x: number) => x.toLocaleString('en-US');
  const times = (x: number) => (x === 1 ? 'once' : x === 2 ? 'twice' : `${n(x)} times`);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const years = (weeks: number) => {
    const y = Math.round(weeks / 52);
    return y < 1 ? 'less than a year' : y === 1 ? 'a year' : `${y} years`;
  };
  /** "the 3 years", "the year", "the months": for "in ___ you live apart". */
  const stretch = (weeks: number) => {
    const y = Math.round(weeks / 52);
    return y < 1 ? 'the months' : y === 1 ? 'the year' : `the ${y} years`;
  };
  const more = (x: number) => (x === 1 ? 'once more' : x === 2 ? 'twice more' : `${n(x)} more times`);
  const odds = (p: number) => formatOdds(p).replace('about a 1-in-', '1 in ').replace(' chance', '');
  const rhythm = (count: number, weeks: number) => {
    const per = count / Math.max(0.5, weeks / 52);
    return per >= 35 ? 'most weeks' : per >= 18 ? 'every couple of weeks' : per >= 9 ? 'about once a month' : per >= 4 ? 'every couple of months' : per >= 2 ? 'a few times a year' : 'now and then';
  };

  // ---------------------------------------------------------------- what the log says

  interface Seen {
    weeks: number[];
    /** venue -> in-person rows there that were not work. */
    places: Map<number, number[]>;
    work: number;
    lastVenue: number;
  }
  const seen = new Map<number, Seen>();
  /** Weeks with a call or a message, per person. */
  const remote = new Map<number, number[]>();
  for (let i = 0; i < contacts.length; i += 4) {
    const c = contacts[i + 3];
    const w = contacts[i];
    const o = contacts[i + 1];
    if (!IN_PERSON[c]) {
      const r = remote.get(o);
      if (!r) remote.set(o, [w]);
      else if (r[r.length - 1] !== w) r.push(w);
      continue;
    }
    const v = contacts[i + 2];
    let s = seen.get(o);
    if (!s) seen.set(o, (s = { weeks: [], places: new Map(), work: 0, lastVenue: -1 }));
    if (s.weeks[s.weeks.length - 1] !== w) s.weeks.push(w);
    if (v >= 0) s.lastVenue = v;
    if (c === WORK) s.work++;
    else if (v >= 0) {
      const p = s.places.get(v);
      if (p) p.push(w); else s.places.set(v, [w]);
    }
  }
  const seenBetween = (id: number, from: number, to: number) => {
    const s = seen.get(id);
    if (!s) return 0;
    let c = 0;
    for (const w of s.weeks) if (w > from && w <= to) c++;
    return c;
  };
  const remoteBetween = (id: number, from: number, to: number) => (remote.get(id) ?? []).filter((w) => w > from && w <= to).length;
  /** The longest stretch without seeing each other that ended with seeing each other again. */
  const longestGap = (id: number): { from: number; to: number } | null => {
    const ws = seen.get(id)?.weeks ?? [];
    let best: { from: number; to: number } | null = null;
    for (let i = 1; i < ws.length; i++) {
      if (ws[i] - ws[i - 1] >= 156 && (!best || ws[i] - ws[i - 1] > best.to - best.from)) best = { from: ws[i - 1], to: ws[i] };
    }
    return best;
  };

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
  const goneAt = (id: number) => (agents[id].died >= 0 ? agents[id].died : Infinity);
  /** After the two end up in different cities at `from`: the week they next share one, or the end. */
  const apartUntil = (id: number, from: number): number => {
    const ws = [...(moves.get(id) ?? []), ...(moves.get(ego) ?? [])].map((e) => e.week).filter((w) => w > from).sort((a, b) => a - b);
    const end = Math.min(endWeek, goneAt(id));
    for (const w of ws) if (w < end && cityAt(id, w) === cityAt(ego, w)) return w;
    return end;
  };

  const series = new Map<number, Float32Array>();
  snapshots.forEach((snap, i) => {
    for (const [o, s] of snap.nodes) {
      let arr = series.get(o);
      if (!arr) series.set(o, (arr = new Float32Array(snapshots.length)));
      arr[i] = s;
    }
  });
  const depthOf = (id: number): Float32Array => {
    const arr = new Float32Array(snapshots.length);
    snapshots.forEach((snap, i) => {
      const node = snap.nodes.find((x) => x[0] === id);
      if (node) arr[i] = node[2];
    });
    return arr;
  };
  const closeAt = (id: number, w: number) => {
    const arr = series.get(id);
    return arr ? arr[Math.min(arr.length - 1, Math.max(0, Math.round(w / 13)))] : 0;
  };

  // Partners of the protagonist, and of the family they grew up in.
  const spans: { id: number; from: number; to: number; how: 'split' | 'died' | '' }[] = [];
  if (life.start.partner >= 0) spans.push({ id: life.start.partner, from: 0, to: -1, how: '' });
  const kinSpans = new Map<number, { other: number; from: number; to: number }[]>();
  for (const e of events) {
    if (e.t === 'partner') spans.push({ id: e.other, from: e.week, to: -1, how: '' });
    else if (e.t === 'breakup' || (e.t === 'death' && e.partner)) {
      const other = e.t === 'breakup' ? e.other : e.who;
      const sp = [...spans].reverse().find((p) => p.id === other && p.to < 0);
      if (sp) { sp.to = e.week; sp.how = e.t === 'breakup' ? 'split' : 'died'; }
    } else if (e.t === 'kinCouple') {
      let l = kinSpans.get(e.who);
      if (!l) kinSpans.set(e.who, (l = []));
      l.push({ other: e.other, from: e.week, to: -1 });
    } else if (e.t === 'kinSplit') {
      const sp = kinSpans.get(e.who)?.find((p) => p.other === e.other && p.to < 0);
      if (sp) sp.to = e.week;
    }
  }
  const partnerAt = (w: number) => spans.find((p) => w >= p.from && (p.to < 0 || w < p.to));
  const kinPartnerAt = (f: number, w: number): number => {
    const sp = kinSpans.get(f)?.find((p) => w >= p.from && (p.to < 0 || w < p.to));
    return sp && goneAt(sp.other) > w ? sp.other : -1;
  };

  // The family the protagonist grew up in.
  const family: number[] = [];
  for (const [o, t] of ties) if (t.ctx === 'family') family.push(o);
  family.sort((a, b) => agents[a].birthYear - agents[b].birthYear);
  const parents = family.filter((f) => me.birthYear - agents[f].birthYear >= 16 && !agents[f].grewUpHere);
  const isParent = (f: number) => parents.includes(f);
  const word = (f: number) => kinWord(me, agents[f]);
  /** "Mom", or "your older brother Leo" the first time and "Leo" after that. */
  const named = new Set<number>();
  const kin = (f: number, capital = false): string => {
    let s: string;
    // Two dads or two moms go by their names as well.
    const twin = isParent(f) && parents.some((p) => p !== f && word(p) === word(f));
    if (twin) s = named.has(f) ? first(f) : `your ${word(f)} ${first(f)}`;
    else if (isParent(f)) s = capital || named.has(f) ? cap(word(f)) : `your ${word(f)}`;
    else if (named.has(f)) s = first(f);
    else s = `your ${word(f)} ${first(f)}`;
    named.add(f);
    return capital ? cap(s) : s;
  };

  // ---------------------------------------------------------------- the leads

  const leadSpan = [...spans].sort((a, b) => ((b.to < 0 ? endWeek : b.to) - b.from) - ((a.to < 0 ? endWeek : a.to) - a.from))[0];
  const partnerLead = leadSpan?.id ?? -1;
  const chainOf = (id: number): number[] => {
    const chain = [id];
    let cur = id;
    while (chain.length < 8) {
      const p = arcs.parent.get(cur);
      if (p === undefined || p < 0 || chain.includes(p)) break;
      chain.push(p);
      cur = p;
    }
    return chain;
  };
  const partnerChain = partnerLead >= 0 ? chainOf(partnerLead).slice(1) : [];
  const mended = new Set<number>();
  const turnCount = new Map<number, number>();
  for (const e of events) {
    if (e.t === 'mend') mended.add(e.other);
    if (e.t === 'fight' || e.t === 'mend' || (e.t === 'reunion' && e.gap >= 156)) turnCount.set(e.other, (turnCount.get(e.other) ?? 0) + 1);
  }

  const endingOf = (id: number): StoryLead['ending'] => {
    const t = ties.get(id)!;
    if (id === partnerLead && leadSpan.to < 0) return 'together';
    if (t.gone >= 0) return 'died';
    if (id === partnerLead) return 'split';
    if (t.rift >= 0) return 'rift';
    if (t.now >= L[2]) return 'close';
    const s = seen.get(id);
    const since = s && s.weeks.length ? endWeek - s.weeks[s.weeks.length - 1] : endWeek;
    return since >= 260 || t.now < L[1] ? 'faded' : 'friends';
  };
  const kept = (id: number) => ['close', 'friends', 'together'].includes(endingOf(id));

  // Being there, both ways round: one entry for each hard stretch in which one of you came to the other.
  type Support = Extract<SimEvent, { t: 'support' }>;
  const supportOf = (id: number, mine: boolean): Support[] => {
    const out: Support[] = [];
    for (const e of events) {
      if (e.t !== 'support' || (mine ? e.who !== ego || e.other !== id : e.who !== id || e.other !== ego)) continue;
      const prev = out[out.length - 1];
      if (prev && prev.lost === e.lost && e.week - prev.week < 26) { if (e.far) out[out.length - 1] = { ...prev, far: true }; continue; }
      out.push(e);
    }
    return out;
  };
  const showUps = (id: number) => supportOf(id, true);
  const fights = new Map<number, number>();
  for (const e of events) if (e.t === 'fight') fights.set(e.other, (fights.get(e.other) ?? 0) + 1);

  // One person. Closeness over the years gets someone considered; what picks them is how much
  // happens between the two of you.
  const egoFirst = me.name.split(' ')[0];
  const kinNames = family.map((f) => agents[f].name.split(' ')[0]);
  const pool = arcs.everyone.filter((a) => a.role !== 'family' && (a.id === partnerLead || (ties.get(a.id)!.peak >= L[2] && a.seen >= 20)));
  const topScore = Math.max(1e-9, ...pool.map((a) => a.score));
  const drama = (a: Arc): number => {
    const t = ties.get(a.id)!;
    let d = Math.min(2, fights.get(a.id) ?? 0) + (mended.has(a.id) ? 1 : 0);
    if (longestGap(a.id)) d += 1.2;
    d += Math.min(2, showUps(a.id).length) * 0.6 + Math.min(1, supportOf(a.id, false).length) * 0.6;
    // A friend for years who becomes a partner is the longest arc there is.
    if (a.id === partnerLead) d += leadSpan.from - Math.max(0, t.met) >= 104 ? 1.6 : 0.6;
    d += Math.min(1.2, a.ledTo.length * 0.2);
    if (a.last - Math.max(0, a.met) >= 780) d += 0.5;
    return d;
  };
  let one = -1;
  let oneScore = 0;
  for (const a of pool) {
    const t = ties.get(a.id)!;
    const name = a.name.split(' ')[0];
    // A lead who shares a first name with you or your family cannot be told apart in a caption.
    if (a.id !== partnerLead && (name === egoFirst || kinNames.includes(name))) continue;
    let s = (0.35 + a.score / topScore) * (1 + drama(a));
    // Known before the story as an adult: there is no beginning to show.
    if (t.met < 0 && t.ctx !== 'childhood' && life.start.age + t.met / 52 >= 18) s *= 0.6;
    // Met on screen but hardly seen at first: nothing to earn the rest with.
    if (t.met >= 0 && seenBetween(a.id, t.met, t.met + 104) < 6) s *= 0.6;
    if (s > oneScore) { oneScore = s; one = a.id; }
  }
  const leadIds = [...(one >= 0 ? [one] : []), ...(partnerLead >= 0 && partnerLead !== one ? [partnerLead] : [])];
  const isLead = (id: number) => leadIds.includes(id);
  if (opt.rename && leadIds[opt.rename.lead] !== undefined) rename.set(leadIds[opt.rename.lead], opt.rename.name);

  /** A person who is not a lead is described, not named. */
  const refer = (id: number): string => {
    if (isLead(id)) return first(id);
    if (family.includes(id)) return kin(id);
    const t = ties.get(id);
    if (!t) return 'a friend';
    switch (t.ctx) {
      case 'work': return 'a friend from work';
      case 'club': return t.venue >= 0 ? `a friend from ${vname(t.venue)}` : 'a friend';
      case 'childhood': return 'a friend from growing up';
      default: return 'a friend';
    }
  };

  // ---------------------------------------------------------------- candidates

  const cands: Cand[] = [];
  const add = (c: Partial<Cand> & Pick<Cand, 'week' | 'scene' | 'kind' | 'tell'>) =>
    cands.push({ order: 5, weight: 99, required: false, lead: -1, venue: -1, people: [], note: '', group: c.scene, ...c });

  // --- The family table. It opens the story, comes back in the Decembers when it has changed,
  // and closes it.
  interface Table { y: number; week: number; present: number[]; plus: number[]; partner: number; away: number[]; travelled: boolean }
  const tableAt = (y: number, week: number): Table => {
    const present: number[] = [];
    const away: number[] = [];
    for (const f of family) {
      if (goneAt(f) <= week) continue;
      const here = cityAt(f, week) === cityAt(ego, week) || (week > 0 && seenBetween(f, week - 5, week + 2) > 0);
      (here ? present : away).push(f);
    }
    const plus = present.map((f) => kinPartnerAt(f, week)).filter((p) => p >= 0 && !family.includes(p));
    const sp = partnerAt(week);
    const travelled = present.length > 0 && present.every((f) => cityAt(f, week) !== cityAt(ego, week));
    return { y, week, present, plus, partner: sp && sp.from < week && goneAt(sp.id) > week ? sp.id : -1, away, travelled };
  };
  const opening = tableAt(0, 0);
  const tables: Table[] = [];
  for (let y = 0; y < life.years; y++) tables.push(tableAt(y, y * 52 + 50));
  const tableChange = (prev: Table, cur: Table) => {
    const died = family.filter((f) => goneAt(f) > prev.week && goneAt(f) <= cur.week);
    const newPlus = cur.plus.filter((p) => !prev.plus.includes(p));
    const newPartner = cur.partner >= 0 && cur.partner !== prev.partner ? cur.partner : -1;
    const alone = cur.present.length === 0 && prev.present.length > 0;
    const flew = cur.travelled && !prev.travelled;
    const weight = died.length * 3 + newPlus.length * 2 + (newPartner >= 0 ? 3 : 0) + (alone ? 2.5 : 0) + (flew ? 1.5 : 0);
    return { died, newPlus, newPartner, alone, flew, weight };
  };
  const onStage = (t: Table) => [...t.present, ...t.plus, ...(t.partner >= 0 ? [t.partner] : [])];
  const chairs = (t: Table) => family.filter((f) => goneAt(f) <= t.week).length;
  let lastTable: Table = opening;
  const tellTable = (t: Table, where: 'open' | 'mid' | 'close') => () => {
    const here = cities[cityAt(ego, t.week)].name;
    const parts: string[] = [];
    if (where === 'open') {
      parts.push(`You're ${age(t.week)}.`);
      parts.push(t.present.length ? `At the table: ${list(t.present.map((f) => kin(f)))}.` : 'You already live on your own.');
      for (const f of t.away) parts.push(`${cap(kin(f))} ${t.present.length ? 'has already left for' : 'is in'} ${cities[cityAt(f, t.week)].name}.`);
      t.plus.forEach((p) => named.add(p));
      lastTable = t;
      return { title: `${here}, ${year(t.week)}`, text: parts.join(' ') };
    }
    const ch = tableChange(lastTable, t);
    lastTable = t;
    if (where === 'close') parts.push(`You're ${age(t.week)}.`);
    for (const f of ch.died) parts.push(isParent(f) ? `${kin(f, true)}'s chair is empty.` : `${kin(f, true)} died in ${year(goneAt(f))}.`);
    const living = family.filter((f) => goneAt(f) > t.week);
    if (t.present.length === 0) {
      if (living.length) {
        parts.push(`${cap(list(living.map((f) => kin(f))))} ${living.length === 1 ? 'is' : 'are'} far away this year.`);
        parts.push(t.partner >= 0 && isLead(t.partner) ? `It is you and ${first(t.partner)}.` : 'You spend it without them.');
      } else {
        parts.push('Nobody from the table you grew up at is left.');
        if (t.partner >= 0 && isLead(t.partner)) parts.push(`It is you and ${first(t.partner)}.`);
      }
      return { title: `December ${year(t.week)}`, text: parts.join(' ') };
    }
    const news = parts.length;
    if (ch.newPartner >= 0) parts.push(isLead(ch.newPartner) ? `It is ${first(ch.newPartner)}'s first time at the table.` : 'You have brought someone home.');
    for (const p of ch.newPlus) {
      const f = t.present.find((x) => kinPartnerAt(x, t.week) === p);
      if (f === undefined) continue;
      parts.push(`${kin(f, true)} has brought ${first(p)}.`);
      named.add(p);
    }
    if (where === 'close' || parts.length === news) {
      const who = [...t.present.map((f) => kin(f)), ...t.plus.map(first), ...(t.partner >= 0 && isLead(t.partner) ? [first(t.partner)] : [])];
      parts.push(`At the table: ${list(who)}.`);
    }
    if (t.travelled) parts.splice(where === 'close' ? 1 : 0, 0, `You travel to ${cities[cityAt(t.present[0], t.week)].name} for it.`);
    return { title: `December ${year(t.week)}`, text: parts.join(' ') };
  };
  add({ week: 0, order: 0, scene: 'table', kind: 'texture', required: true, people: opening.present, stage: onStage(opening), note: 'opening table', tell: tellTable(opening, 'open') });
  {
    const lastT = tables[tables.length - 1];
    add({ week: lastT.week, order: 8, scene: 'table', kind: 'texture', required: true, people: lastT.present, stage: onStage(lastT), empty: chairs(lastT), note: 'closing table', tell: tellTable(lastT, 'close') });
    // Texture is scored by how much the same scene has changed since it was last worth showing.
    let ref = opening;
    for (let i = 0; i < tables.length - 6; i++) {
      const ch = tableChange(ref, tables[i]);
      if (ch.weight < 2.5 || tables[i].week - ref.week < 150) continue;
      ref = tables[i];
      add({
        week: tables[i].week, order: 8, scene: 'table', kind: 'texture', weight: Math.min(8, 4 + ch.weight), people: tables[i].present, stage: onStage(tables[i]), empty: chairs(tables[i]),
        note: `table changed: ${ch.died.length} died, ${ch.newPlus.length + (ch.newPartner >= 0 ? 1 : 0)} new${ch.alone ? ', alone' : ''}${ch.flew ? ', travelled' : ''}`,
        tell: tellTable(tables[i], 'mid'),
      });
    }
  }

  // --- Each lead: a beginning, a standing night out, turns, an ending.
  const metEvent = new Map<number, Extract<SimEvent, { t: 'met' }>>();
  for (const e of events) if (e.t === 'met') metEvent.set(e.other, e);

  const foreshadow = (id: number): string => {
    const a = arcOf.get(id)!;
    const end = endingOf(id);
    const who = first(id);
    if (id === partnerLead) {
      const gap = leadSpan.from - Math.max(0, a.met);
      return gap >= 78 ? `You don't know it yet, but in ${years(gap)} you two will be together.` : '';
    }
    if (mended.has(id)) return 'You will lose each other once, and find each other again.';
    if (end === 'rift') return 'It will not always be this easy.';
    if (end === 'close') return `At ${age(endWeek)} you will still be calling ${who}.`;
    if (end === 'faded' && a.closeFrom >= 0 && a.closeTo - a.closeFrom >= 104) return `For the next ${years(a.closeTo - Math.max(0, a.met))}, ${who} is one of your people.`;
    return '';
  };

  /** The longest stretch of going to one place together without a gap of more than twenty weeks. */
  const bestRun = (weeks: number[]) => {
    let best = { n: 0, first: 0, last: 0 };
    let start = 0;
    for (let i = 1; i <= weeks.length; i++) {
      if (i === weeks.length || weeks[i] - weeks[i - 1] > 20) {
        if (i - start > best.n) best = { n: i - start, first: weeks[start], last: weeks[i - 1] };
        start = i;
      }
    }
    return best;
  };

  // Something of yours they end up with when one of you moves. Once it has been shown it can come back.
  let keepsakeOut = false;
  let keepsakeGiven = false;
  // Set once the cut is final: whether the long silence has its own card.
  let gapShown: { from: number; to: number } | null = null;

  leadIds.forEach((id, li) => {
    const main = li === 0;
    const t = ties.get(id)!;
    const a = arcOf.get(id)!;
    const s = seen.get(id);
    const met = metEvent.get(id);
    const end = endingOf(id);
    const who = () => first(id);
    const intro = (w: number) => `${full(id)}, ${ageOf(id, w)}, ${descriptor(agents[id])}`;
    // Details are looked up by name at the moment a caption is written, so a rename reaches them.
    const D = details({ seed: life.seed, id, name: first(id), myHobbies: me.hobbies, theirHobbies: agents[id].hobbies });
    const becamePartner = id === partnerLead;
    const partnerFrom = becamePartner ? leadSpan.from : Infinity;

    // --- Beginning. The main person is met on screen, or in a flashback, and then earned with a
    // few small moments. A partner who is not the main person is introduced when you get together.
    if (main && !met) {
      const knownAge = life.start.age + Math.floor(t.met / 52);
      const kid = t.ctx === 'childhood' || knownAge < 18;
      if (t.ctx !== 'childhood' && t.venue >= 0) {
        add({
          week: 1, at: t.met, order: 1, scene: 'meet', kind: 'turn', required: true, lead: li, people: [id], venue: t.venue, note: `flashback: met at ${knownAge}, p=${t.p.toPrecision(2)}`,
          tell: () => ({
            title: `${vname(t.venue)}, ${year(t.met)}`,
            text: [`You are ${knownAge}. ${D.firstWords(t.ctx === 'club' ? 'club' : 'hangout')}`, `That is ${full(id)}.`, t.p < 0.025 ? `The chance you were both there that week: ${odds(t.p)}.` : ''].filter(Boolean).join(' '),
          }),
        });
      }
      add({
        week: 1, at: t.ctx === 'childhood' ? -260 : Math.round(t.met / 2), order: 2, scene: 'early', kind: 'texture', required: true, lead: li, people: [id], note: `early, ${kid ? 'kids' : 'adults'}`,
        tell: () => {
          const lines = t.ctx === 'childhood' ? [`${intro(0)}. You have known each other as long as you can remember.`] : t.venue >= 0 ? [] : [`${intro(0)}. You have known each other since you were ${knownAge}.`];
          lines.push(...(kid ? D.childhood(3) : D.early(t.ctx, 3)));
          lines.push(foreshadow(id));
          return { title: kid ? 'Growing up' : `Before ${year(0)}`, text: lines.filter(Boolean).join(' ') };
        },
      });
    } else if (main && met) {
      add({
        week: met.week, order: 3, scene: 'meet', kind: 'turn', required: true, lead: li, people: [id], venue: met.venue, note: `intro ${a.tag}, p=${met.p.toPrecision(2)}, misses=${met.nearMisses}`,
        tell: () => {
          const lines: string[] = [];
          if (met.ctx === 'outing') lines.push(`${cap(met.via >= 0 ? refer(met.via) : 'a friend')} brings someone along: ${intro(met.week)}.`, D.firstWords('outing'));
          else lines.push(D.firstWords(met.ctx), `That is ${intro(met.week)}.`);
          if (met.nearMisses >= 20) lines.push(`You had been in the same room ${met.nearMisses} times without speaking.`);
          if (met.p < 0.025) lines.push(`The chance you would meet that week: ${odds(met.p)}.`);
          return { title: `${vname(met.venue)}, ${year(met.week)}`, text: lines.filter(Boolean).join(' ') };
        },
      });
      const firstYears = seenBetween(id, met.week, met.week + 104);
      if (firstYears >= 6) {
        add({
          week: met.week + 40, order: 4, scene: 'early', kind: 'texture', required: true, lead: li, people: [id], note: `early: ${firstYears} times in two years`,
          tell: () => {
            const why = clickReasons(me, agents[id]);
            const lines = [...D.early(met.ctx, 2), `In the first two years you see each other ${times(firstYears)}.`];
            if (why.length) lines.push(`What you have in common: ${why[0]}.`);
            lines.push(foreshadow(id));
            return { title: `${year(met.week + 40)}`, text: lines.filter(Boolean).join(' ') };
          },
        });
      }
    }

    // --- A standing night out: the place the two of you kept going back to.
    let ritual: { v: number; n: number; first: number; last: number; after: number } | null = null;
    for (const [v, weeks] of s?.places ?? []) {
      const run = bestRun(weeks);
      if (run.n >= 12 && run.last - run.first >= 52 && run.n / ((run.last - run.first) / 52) >= 4 && (!ritual || run.n > ritual.n)) ritual = { v, ...run, after: weeks.filter((w) => w > run.last).length };
    }
    if (main && ritual) {
      const r = ritual;
      const span = r.last - r.first;
      const ongoing = r.last >= endWeek - 26;
      add({
        week: Math.round(r.first + Math.min(span * 0.4, 104)), order: 4, scene: 'ritual', kind: 'texture', lead: li, people: [id], venue: r.v,
        // Texture is scored by how often it recurred and for how long, and it counts for more when it later stops.
        weight: 4.5 + Math.min(2, Math.log10(r.n)) + Math.min(1.5, span / 260) + (!ongoing && r.after <= 2 ? 1 : 0),
        note: `ritual ${vname(r.v)} x${r.n} over ${years(span)}, ${r.after} after`,
        tell: () => ({
          title: vname(r.v),
          text: `You and ${who()}, ${rhythm(r.n, span)}, from ${year(r.first)} to ${ongoing ? 'now' : year(r.last)}. ${venues[r.v].kind !== 'hangout' ? 'You arrive together and leave together.' : venues[r.v].name.endsWith('Park') ? 'The same bench when you can get it.' : 'The same table when you can get it.'}` +
            (ongoing || r.after > 5 ? '' : r.after === 0 ? ' After that you never go there together again.' : ` After ${year(r.last)} you go back ${r.after === 1 ? 'once' : r.after === 2 ? 'twice' : `${r.after} times`}.`),
        }),
      });
    }

    if (main) {
      // --- A long talk: the season the two of you got much closer.
      const depth = depthOf(id);
      let bi = -1;
      let jump = 0;
      const from = Math.ceil((Math.max(0, t.met) + 26) / 13);
      for (let i = from; i + 2 < depth.length; i++) {
        const w = snapshots[i].week;
        if (Math.abs(w - partnerFrom) < 78) continue;
        const d = depth[i + 2] - depth[i];
        if (d > jump) { jump = d; bi = i; }
      }
      if (bi >= 0 && jump >= 0.06) {
        const w = snapshots[bi + 1].week;
        let venue = -1;
        let most = 0;
        for (const [v, weeks] of s?.places ?? []) {
          const c = weeks.filter((x) => Math.abs(x - w) <= 20).length;
          if (c > most) { most = c; venue = v; }
        }
        add({
          week: w, order: 5, scene: 'talk', kind: 'texture', lead: li, people: [id], venue, weight: Math.min(8.5, 6 + jump * 12), note: `talk: depth +${jump.toFixed(2)} in half a year`,
          tell: () => ({
            title: venue >= 0 ? `${vname(venue)}, ${year(w)}` : `${year(w)}`,
            text: `${D.talk()}${closeAt(id, w + 26) >= L[2] ? ` From here on ${who()} is one of the first people you tell things to.` : ''}`,
          }),
        });
      }

      // --- The weeks that were hard, when this person came. And the ones where you went to them.
      for (const h of showUps(id)) {
        const before = s ? [...s.weeks].reverse().find((w) => w < h.week) : undefined;
        const gap = before === undefined ? 0 : h.week - before;
        const living = partnerAt(h.week)?.id === id;
        const death = h.why !== 'breakup';
        add({
          week: h.week, order: 6, scene: 'showup', kind: 'turn', lead: li, people: family.includes(h.lost) ? [id, h.lost] : [id], stage: [id],
          weight: (death ? 8 : 7) + (gap >= 104 ? 1 : 0) + (h.far ? 1 : 0) - (living ? 1.5 : 0), key: `hard${h.lost}`, note: `came after ${h.why}${h.far ? ', travelled' : ''}${gap >= 104 ? `, first time in ${years(gap)}` : ''}`,
          tell: () => {
            const f = h.lost;
            const what = h.why === 'breakup' ? `You and ${isLead(f) ? first(f) : 'the person you were with'} split.`
              : h.why === 'widowed' ? `${isLead(f) ? first(f) : 'Your partner'} dies.`
              : `${cap(isParent(f) ? `your ${word(f)}${parents.some((p) => p !== f && word(p) === word(f)) ? `, ${first(f)},` : ''}` : kin(f))} dies, aged ${ageOf(f, goneAt(f))}.`;
            return { title: `${year(h.week)}`, text: `${what} ${gap >= 104 ? `You have not seen ${who()} in ${years(gap)}. ` : ''}${h.far ? `${who()} gets on a plane. ` : ''}${D.showUp(death ? 'death' : 'breakup')}` };
          },
        });
      }
      for (const h of supportOf(id, false)) {
        const them = agents[id];
        const lost = agents[h.lost];
        add({
          week: h.week, order: 6, scene: 'showup', kind: 'turn', lead: li, people: [id], stage: [id], group: 'youCame',
          weight: (h.why === 'breakup' ? 6 : 7) + (h.far ? 1.5 : 0), note: `you came after their ${h.why}${h.far ? ', travelled' : ''}`,
          tell: () => {
            const what = h.why === 'breakup' ? `${who()} and ${lost.name.split(' ')[0]} split.`
              : h.why === 'widowed' ? `${who()}'s partner, ${lost.name.split(' ')[0]}, dies.`
              : `${who()}'s ${kinWord(them, lost)} dies.`;
            return { title: `${year(h.week)}`, text: `${what} ${h.far ? 'You get on a plane. ' : ''}${D.youShowUp()}` };
          },
        });
      }

      // --- The long silence, as a card about this one person.
      const g = longestGap(id);
      if (g && s) {
        const len = g.to - g.from;
        const before = s.weeks.filter((w) => w <= g.from).length;
        const firstYear = remoteBetween(id, g.from, g.from + 52);
        const lastYear = remoteBetween(id, g.to - 52, g.to);
        add({
          week: Math.round(g.from + len * 0.5), order: 7, scene: 'gap', kind: 'fact', group: 'gap', lead: li, people: [id], weight: 7 + Math.min(1.5, len / 520), otherCity: cityAt(id, Math.round(g.from + len * 0.5)),
          note: `gap ${years(len)}, seen ${before} before, remote ${firstYear}→${lastYear}`,
          tell: () => ({
            title: `${year(g.from)} to ${year(g.to)}`,
            text: (t.met < 0 && g.from < 260 ? `You grew up seeing ${who()} all the time.` : `${t.met < 0 ? `Between ${life.start.age} and ${age(g.from)}` : `Before ${year(g.from)}`} you had seen ${who()} ${times(before)}.`) + ` In the ${years(len)} after ${year(g.from)}, not once.` +
              (firstYear >= 4 && lastYear * 2 <= firstYear ? ` The first year you call or write ${times(firstYear)}. The last, ${lastYear ? times(lastYear) : 'not at all'}.` : ''),
          }),
        });
      }

      // --- A trip to see each other while living apart.
      {
        let apartSince = -1;
        for (const w of s?.weeks ?? []) {
          const apart = cityAt(id, w) !== cityAt(ego, w);
          if (!apart) { apartSince = -1; continue; }
          if (apartSince < 0) {
            const lastTogether = [...(s?.weeks ?? [])].reverse().find((x) => x < w && cityAt(id, x) === cityAt(ego, x));
            apartSince = lastTogether ?? -1;
            if (lastTogether === undefined || w - lastTogether < 40 || closeAt(id, w) < L[1]) continue;
            const theyCame = !events.some((e) => e.t === 'visit' && Math.abs(e.week - w) <= 1 && e.city === cityAt(id, w));
            add({
              week: w, order: 5, scene: 'visit', kind: 'turn', lead: li, people: [id], weight: 5.5 + Math.min(1.5, (w - lastTogether) / 156), key: events.some((x) => x.t === 'support' && Math.abs(x.week - w) <= 1 && (x.other === id || x.who === id)) ? `sup${w}` : undefined, note: `visit, ${theyCame ? 'they came' : 'you went'}, after ${years(w - lastTogether)}`,
              tell: () => ({ title: `${cities[theyCame ? cityAt(ego, w) : cityAt(id, w)].name}, ${year(w)}`, text: `${D.visit(theyCame)} It is the first time in ${w - lastTogether >= 78 ? years(w - lastTogether) : 'months'}.` }),
            });
          }
        }
      }

      // --- Without them: everyone who reached you through this person.
      if (a.ledTo.length >= 3) {
        const led = [...a.ledTo].sort((x, y) => (ties.get(x)?.met ?? 0) - (ties.get(y)?.met ?? 0));
        const byScore = [...a.ledTo].sort((x, y) => (arcOf.get(y)?.score ?? 0) - (arcOf.get(x)?.score ?? 0)).slice(0, 2);
        const mets = led.map((x) => Math.max(0, ties.get(x)?.met ?? 0));
        const after = partnerLead >= 0 && leadSpan.from > 0 && (becamePartner || led.includes(partnerLead)) ? leadSpan.from + 30 : 0;
        const when = Math.min(endWeek - 60, Math.max(after, mets[Math.floor(mets.length * 0.7)] + 26));
        add({
          week: when, order: 7, scene: 'without', kind: 'fact', group: 'without', required: true, lead: li, people: [id], stage: [id, ...led.slice(0, 16)], note: `led to ${led.length}`,
          tell: () => ({
            title: `Without ${who()}`,
            text: `No ${list(byScore.map((x) => agents[x].name.split(' ')[0])).replace(' and ', ', and no ')}. ${n(led.length)} of the people in your life reached you through ${who()}: someone ${who()} brought along, and then the people they brought.` +
              (t.venue >= 0 && t.p < 0.2 && t.ctx !== 'childhood' ? ` All of it from one week at ${vname(t.venue)}.` : ''),
          }),
        });
      }
    }

    // --- Turns.
    for (const e of events) {
      if (!main) break;
      if (e.t === 'fight' && e.other === id) {
        const mend = events.find((x) => x.t === 'mend' && x.other === id && x.week > e.week);
        add({
          week: e.week, order: 5, scene: 'fallout', kind: 'turn', lead: li, people: [id], venue: e.venue, weight: 7.5 + e.s * 3, required: !mend && end === 'rift',
          note: `fight s=${e.s.toFixed(2)}`,
          tell: () => ({
            title: `${year(e.week)}`,
            text: `${D.fight()} ` +
              (mend && mend.t === 'mend' ? `You and ${who()} do not speak for ${years(mend.gap)}.` : `You have known each other ${t.met < 0 ? 'most of your lives' : years(e.week - t.met)}. You and ${who()} never speak again.`),
          }),
        });
      } else if (e.t === 'mend' && e.other === id) {
        add({
          week: e.week, order: 5, scene: 'makeup', kind: 'turn', lead: li, people: [id], weight: 8.5, note: 'mend',
          tell: () => ({ title: `${year(e.week)}`, text: `${D.mend()} It has been ${years(e.gap)}. You and ${who()} pick up where you left off, more or less.` }),
        });
      } else if (e.t === 'reunion' && e.other === id && e.gap >= 156 && e.prevPeak >= L[1] && !events.some((x) => x.t === 'support' && x.week === e.week && (x.other === id || x.who === id))) {
        add({
          week: e.week, order: 5, scene: 'reunion', kind: 'turn', lead: li, people: [id], venue: e.venue, weight: 7 + Math.min(2.5, e.gap / 260), note: `reunion gap ${years(e.gap)}`,
          tell: () => {
            const back = keepsakeOut ? ` ${who()} still has ${D.keepsake()}.` : '';
            keepsakeOut = false;
            return {
              title: `${vname(e.venue)}, ${year(e.week)}`,
              text: `${e.ctx === 'outing' ? `You and ${who()} make a plan and keep it` : `You run into ${who()}`}, in ${cities[e.city].name}. ${gapShown && Math.abs(gapShown.to - e.week) <= 4 ? `The first time since ${year(gapShown.from)}.` : `It has been ${years(e.gap)}.`} ${D.reunion()}${back}`,
            };
          },
        });
      } else if (e.t === 'move' && e.who === id && e.from === e.egoCity && closeAt(id, e.week) >= L[1] && !(becamePartner && partnerAt(e.week)?.id === id)) {
        const until = apartUntil(id, e.week);
        // A move only matters if it keeps you apart for a while.
        if (until - e.week < 130) continue;
        const c = seenBetween(id, e.week, until);
        const forGood = until >= Math.min(endWeek, goneAt(id));
        add({
          week: e.week, order: 5, scene: 'move', kind: 'turn', group: 'leadMove', lead: li, people: [id], weight: 5.5 + closeAt(id, e.week) * 3 + Math.min(1.5, (until - e.week) / 520), note: `lead moved away for ${years(until - e.week)}, seen ${c}`,
          tell: () => {
            const gift = keepsakeGiven ? 'You help with the boxes.' : `You help with the boxes, and ${who()} leaves with ${D.keepsake()}.`;
            keepsakeOut = keepsakeGiven = true;
            const inGap = gapShown && gapShown.from < until && gapShown.to > e.week;
            return {
              title: `${year(e.week)}`,
              text: `${who()} moves to ${cities[e.to].name}. ${gift}` +
                (inGap && c <= 2 ? '' : forGood ? (c ? ` You see each other ${more(c)}.` : ' You never see each other again.') : ` In ${stretch(until - e.week)} you live apart you see each other ${c ? times(c) : 'not once'}.`),
            };
          },
        });
      } else if ((e.t === 'hobby' || e.t === 'club' || e.t === 'job') && e.via === id) {
        add({
          week: e.week, order: 5, scene: 'nudge', kind: 'turn', lead: li, people: [id], weight: 5.5, venue: e.t === 'club' ? e.venue : e.t === 'job' ? e.to : -1, note: `via lead: ${e.t}`,
          tell: () => ({
            title: `${year(e.week)}`,
            text: e.t === 'hobby' ? `${who()} gets you into ${CLUBS[e.to].hobby}. You give up ${CLUBS[e.from].hobby} without much of a fight.`
              : e.t === 'club' ? `${who()} brings you along to ${vname(e.venue)}. You keep going back.`
              : `${who()} hears about a job at ${vname((e as Extract<SimEvent, { t: 'job' }>).to)} and puts your name in.`,
          }),
        });
      }
    }

    // --- Getting together, and how a partnership ends.
    if (becamePartner && leadSpan.from > 0) {
      add({
        week: leadSpan.from, order: 6, scene: 'together', kind: 'turn', required: true, lead: li, people: [id], note: 'together',
        tell: () => {
          const known = leadSpan.from - t.met;
          if (!main) {
            const from = t.ctx === 'work' ? 'from work' : t.ctx === 'club' && t.venue >= 0 ? `from ${vname(t.venue)}` : t.via >= 0 && isLead(t.via) ? `a friend of ${first(t.via)}'s` : '';
            return { title: `${year(leadSpan.from)}`, text: `You get together with ${intro(leadSpan.from)}${from ? `, ${from}` : ''}. You have known each other ${years(known)}.` };
          }
          const lines = [D.together(), `You and ${who()} are together, ${t.ctx === 'childhood' ? 'after knowing each other all your lives' : `${years(known)} after ${t.venue >= 0 ? vname(t.venue) : 'you met'}`}.`];
          if (known >= 260) lines.push('Everyone else saw it coming.');
          return { title: `${year(leadSpan.from)}`, text: lines.join(' ') };
        },
      });
    }
    if (becamePartner && end === 'split') {
      add({
        week: leadSpan.to, order: 6, scene: 'breakup', kind: 'turn', required: true, lead: li, people: [id], note: 'breakup',
        tell: () => {
          const after = seenBetween(id, leadSpan.to, endWeek);
          return { title: `${year(leadSpan.to)}`, text: `After ${years(leadSpan.to - leadSpan.from)} together, you and ${who()} go your separate ways. ${after ? `You see each other ${more(after)}.` : 'You never see each other again.'}` };
        },
      });
    }
    if (end === 'died') {
      add({
        week: t.gone, order: 6, scene: 'goodbye', kind: 'turn', required: true, lead: li, people: [id], note: 'lead died',
        tell: () => {
          const lastYear = seenBetween(id, t.gone - 52, t.gone);
          const total = s?.weeks.length ?? 0;
          return { title: `${year(t.gone)}`, text: `${who()} dies, aged ${ageOf(id, t.gone)}. ${lastYear ? `You saw each other ${times(lastYear)} in that last year` : 'You had not seen each other in over a year'}${main && total >= 20 ? `, and ${times(total)} in all.` : '.'}` };
        },
      });
    }
    if (main && end === 'faded' && s && s.weeks.length) {
      const last = s.weeks[s.weeks.length - 1];
      add({
        week: last, order: 6, scene: 'last', kind: 'turn', required: true, lead: li, people: [id], venue: s.lastVenue, note: 'last time',
        tell: () => {
          const total = s.weeks.length;
          const most = s.weeks[Math.floor(total * 0.9)];
          const early = most < last - 260 ? ` Nine in ten of them were before you turned ${age(most) + 1}.` : '';
          return {
            title: `${vname(s.lastVenue)}, ${year(last)}`,
            text: `The last time you see ${who()}. Neither of you knows it. You say you should do this more often. You had seen each other ${times(total)}.${early}`,
          };
        },
      });
    }
  });

  // --- The protagonist's own moves, with what they leave behind.
  const egoMoves = moves.get(ego) ?? [];
  let leftHome = false;
  egoMoves.forEach((m, i) => {
    const sp = partnerAt(m.week);
    const staying = leadIds.slice(0, 1).filter((id) => id !== sp?.id && goneAt(id) > m.week && cityAt(id, m.week - 1) === m.from && cityAt(id, m.week + 1) !== m.to && closeAt(id, m.week) >= L[1] && apartUntil(id, m.week) - m.week >= 104);
    const leavingParents = leftHome ? [] : parents.filter((p) => goneAt(p) > m.week && cityAt(p, m.week) === m.from);
    if (leavingParents.length) leftHome = true;
    const joining = leadIds.slice(0, 1).filter((id) => id !== sp?.id && goneAt(id) > m.week && cityAt(id, m.week - 1) === m.to && closeAt(id, m.week) >= L[1]);
    add({
      week: m.week, order: 2, scene: 'move', kind: 'turn', group: 'egoMove', people: staying, from: m.from, required: i === 0 && leavingParents.length > 0 && m.week < 520,
      weight: 4 + (i === 0 ? 1.5 : 0) + Math.min(2, staying.length) * 1.5 + (leavingParents.length ? 1.5 : 0) + Math.min(1, joining.length),
      note: `ego move ${cities[m.from].name}→${cities[m.to].name}, leaves ${staying.length} leads, ${leavingParents.length} parents`,
      tell: () => {
        const lines = [`At ${age(m.week)} you leave ${cities[m.from].name} for ${cities[m.to].name}${sp && isLead(sp.id) ? ` with ${first(sp.id)}` : ''}.`];
        if (staying.length === 1) {
          const id = staying[0];
          const until = apartUntil(id, m.week);
          const c = seenBetween(id, m.week, until);
          const forGood = until >= Math.min(endWeek, goneAt(id));
          if (id === leadIds[0] && !keepsakeGiven) {
            keepsakeOut = keepsakeGiven = true;
            lines.push(`${first(id)} helps you pack and leaves with ${details({ seed: life.seed, id, name: first(id), myHobbies: [], theirHobbies: [] }).keepsake()}.`);
          }
          if (gapShown && gapShown.from < until && gapShown.to > m.week && c <= 2) lines.push(`${first(id)} stays.`);
          else lines.push(`${first(id)} stays. ${forGood ? (c ? `You will see each other ${more(c)}.` : 'You will not see each other again.') : `In ${stretch(until - m.week)} you live apart you see each other ${c ? times(c) : 'not once'}.`}`);
        } else if (staying.length > 1) lines.push(`${list(staying.map(first))} stay behind.`);
        if (leavingParents.length) {
          const until = Math.min(...leavingParents.map((p) => apartUntil(p, m.week)));
          const weeksSeen = new Set<number>();
          for (const p of leavingParents) for (const w of seen.get(p)?.weeks ?? []) if (w > m.week && w <= until) weeksSeen.add(w);
          const whom = leavingParents.length === 2 ? 'your parents' : `your ${word(leavingParents[0])}`;
          const forGood = leavingParents.every((p) => until >= Math.min(endWeek, goneAt(p)));
          if (forGood) lines.push(`Home is a trip now. You will see ${whom} ${more(weeksSeen.size)}.`);
          else if (until - m.week >= 104) lines.push(`Home is a trip now. In ${stretch(until - m.week)} you are away you see ${whom} ${times(weeksSeen.size)}.`);
        }
        if (joining.length === 1) lines.push(`${first(joining[0])} is already there.`);
        return { title: `${year(m.week)}`, text: lines.join(' ') };
      },
    });
  });

  // --- Other partners, unnamed: they are part of the life but not of this story.
  for (const sp of spans) {
    if (sp.id === partnerLead || sp.from <= 0) continue;
    const len = (sp.to < 0 ? endWeek : sp.to) - sp.from;
    add({
      week: sp.from, order: 6, scene: 'together', kind: 'turn', group: 'otherPartner', weight: 4.5 + Math.min(3, len / 260), note: `other partner, ${years(len)}`,
      tell: () => ({
        title: `${year(sp.from)}`,
        text: `At ${age(sp.from)} you get together with ${isLead(sp.id) ? first(sp.id) : refer(sp.id).replace(/^a friend/, 'someone')}. ` +
          (sp.how === 'split' ? `It lasts ${years(len)}.` : sp.how === 'died' ? `You have ${years(len)} together.` : `You are still together at ${age(endWeek)}.`),
      }),
    });
  }

  // --- Deaths in the family.
  for (const f of family) {
    const w = goneAt(f);
    if (w >= endWeek) continue;
    const firstParent = isParent(f) && parents.every((p) => goneAt(p) >= w);
    add({
      week: w, order: 6, scene: 'goodbye', kind: 'turn', group: 'kinDeath', people: [f], weight: isParent(f) ? (firstParent ? 8 : 6) : 6.5, key: `hard${f}`, note: `death of ${word(f)}`,
      tell: () => {
        const lastYear = seenBetween(f, w - 52, w);
        const total = seen.get(f)?.weeks.length ?? 0;
        const them = !isParent(f) ? 'each other' : word(f) === 'mom' ? 'her' : 'him';
        return {
          title: `${year(w)}`,
          text: `${cap(isParent(f) ? `your ${word(f)}` : kin(f))}${isParent(f) ? `, ${first(f)},` : ''} dies, aged ${ageOf(f, w)}. You saw ${them} ${lastYear ? times(lastYear) : 'not once'} in that last year` +
            (total >= 20 ? `, and ${times(total)} since you were ${life.start.age}.` : '.'),
        };
      },
    });
  }

  // --- Facts: arithmetic on the log.
  // Half of all the time with your parents is over early.
  {
    const weeksSeen = new Set<number>();
    for (const p of parents) for (const w of seen.get(p)?.weeks ?? []) weeksSeen.add(w);
    const all = [...weeksSeen].sort((x, y) => x - y);
    if (all.length >= 40) {
      const half = all[Math.floor(all.length / 2)];
      const lastSeen = all[all.length - 1];
      const halfAge = age(half);
      // Only a surprise if the second half takes much longer than the first.
      if (lastSeen - half >= 2 * half && halfAge <= 36) {
        add({
          week: half, order: 7, scene: 'fact', kind: 'fact', group: 'factParents', weight: halfAge <= 26 ? 8 : halfAge <= 31 ? 7 : 6, note: `parents half at ${halfAge}`,
          tell: () => ({
            title: `Age ${halfAge}`,
            text: `Half of all the days you will spend with your parents after ${life.start.age} are already behind you. The other half takes ${years(lastSeen - half)}.`,
          }),
        });
      }
    }
  }
  // ---------------------------------------------------------------- the cut

  const placeOf = (v: number): string => {
    if (v < 0) return '';
    const ven = venues[v];
    return ven.kind !== 'hangout' ? ven.kind : ven.name.endsWith('Park') ? 'park' : ven.name.endsWith('Café') ? 'cafe' : 'bar';
  };

  // Each kind of beat has a ceiling, so no one kind can crowd out the rest: importance is only
  // compared within a kind. One fact and one standing night out go in first if there are any.
  const CAP: Record<string, number> = {
    table: 2, ritual: 1, fact: 1, egoMove: 2, leadMove: 2, kinDeath: 2, otherPartner: 1, fallout: 2, makeup: 2, reunion: 2, nudge: 1,
    talk: 1, showup: 2, youCame: 1, visit: 1, gap: 1, without: 1,
  };
  const groupOf = (c: Cand) => (c.scene === 'fact' ? 'fact' : c.group);
  const chosen = cands.filter((c) => c.required);
  const cut: Cand[] = [];
  const perLead = new Map<number, number>();
  const room = () => chosen.length < budget - 1;
  const fits = (c: Cand): boolean => {
    const g = groupOf(c);
    if (chosen.filter((x) => !x.required && groupOf(x) === g).length >= (CAP[g] ?? 2)) return false;
    if (c.key && chosen.some((x) => x.key === c.key)) return false;
    if (c.lead > 0) return false;
    if (c.lead >= 0 && chosen.some((x) => x.lead === c.lead && x.scene === c.scene && (c.scene === 'move' || c.scene === 'ritual' || Math.abs(x.week - c.week) < 104))) return false;
    // Not three things in one year, and not the same December twice.
    if (c.kind !== 'fact' && chosen.filter((x) => Math.abs(x.week - c.week) < 40 && x.kind !== 'fact').length >= 2) return false;
    if (c.scene === 'table' && chosen.some((x) => x.scene === 'table' && Math.abs(x.week - c.week) < 156)) return false;
    if (c.kind === 'fact' && chosen.some((x) => x.kind === 'fact' && Math.abs(x.week - c.week) < 78)) return false;
    return c.weight >= 4.5;
  };
  const take = (c: Cand) => {
    chosen.push(c);
    if (c.lead >= 0) perLead.set(c.lead, (perLead.get(c.lead) ?? 0) + 1);
  };
  const optional = cands.filter((c) => !c.required).sort((a, b) => b.weight - a.weight);
  for (const c of optional) {
    if (chosen.includes(c)) continue;
    if (room() && fits(c)) take(c);
    else cut.push(c);
  }
  chosen.sort((a, b) => a.week - b.week || a.order - b.order);
  if (chosen.some((c) => c.scene === 'gap') && leadIds.length) gapShown = longestGap(leadIds[0]);

  const beats: StoryBeat[] = [];
  for (const c of chosen) {
    const { title, text } = c.tell();
    if (!text) continue;
    beats.push({
      week: c.week, age: age(c.at ?? c.week), year: year(c.at ?? c.week), scene: c.scene, kind: c.kind, title, text, people: c.people, venue: c.venue,
      weight: c.required ? 99 : Math.round(c.weight * 10) / 10, stage: c.stage ?? c.people, empty: c.empty ?? 0,
      city: cityAt(ego, c.at ?? c.week), from: c.from ?? -1, place: placeOf(c.venue), otherCity: c.otherCity ?? -1,
    });
  }

  // --- The end card: where the one person is now, and the door to everyone else.
  {
    const lines: string[] = [];
    const id = leadIds[0];
    if (id !== undefined) {
      const t = ties.get(id)!;
      const total = seen.get(id)?.weeks.length ?? 0;
      const end = endingOf(id);
      const since = t.met < 0 ? life.start.age + Math.floor(t.met / 52) : age(t.met);
      const known = t.ctx === 'childhood' ? 'all your life' : `since you were ${since}`;
      if (end === 'together') lines.push(`You and ${first(id)}: ${years(endWeek - leadSpan.from)} together, and you have known each other ${known}.`);
      else if (end === 'close') lines.push(`${first(id)} is still ${t.now >= L[3] ? 'one of your closest people' : 'a close friend'}. You have known each other ${known}, and seen each other ${times(total)}.`);
      else if (end === 'friends') lines.push(`You and ${first(id)} still see each other ${rhythm(seenBetween(id, endWeek - 260, endWeek), 260)}.`);
      else if (end === 'died') lines.push(`${first(id)} has been gone ${years(endWeek - t.gone)}. You knew each other ${t.ctx === 'childhood' ? 'all your life' : `from the age of ${since}`}, and saw each other ${times(total)}.`);
      else {
        const lastSeen = seen.get(id)?.weeks.slice(-1)[0] ?? 0;
        lines.push(endWeek - lastSeen >= 78 ? `You have not seen ${first(id)} in ${years(endWeek - lastSeen)}. You saw each other ${times(total)}.` : `You and ${first(id)} still cross paths. You have seen each other ${times(total)}.`);
      }
    }
    let metN = 0;
    for (const t of ties.values()) if (t.met >= 0 && t.ctx !== 'family') metN++;
    lines.push(id !== undefined ? `In ${life.years} years you met ${n(metN)} people. This was one of them.` : `In ${life.years} years you met ${n(metN)} people.`);
    beats.push({ week: endWeek, age: age(endWeek), year: year(endWeek - 1), scene: 'end', kind: 'fact', title: `${me.name.split(' ')[0]}, ${age(endWeek)}`, text: lines.join(' '), people: leadIds, venue: -1, weight: 99,
      stage: leadIds.filter((x) => ['together', 'close', 'friends'].includes(endingOf(x))), empty: 0, city: cityAt(ego, endWeek), from: -1, place: '', otherCity: -1,
    });
  }

  return {
    leads: leadIds.map((id, i) => ({ id, name: full(id), tag: arcOf.get(id)!.tag, main: i === 0, ending: endingOf(id) })),
    beats,
    cut: cut.slice(0, 12).map((c) => ({ week: c.week, scene: c.scene, weight: Math.round(c.weight * 10) / 10, note: c.note })),
  };
}
