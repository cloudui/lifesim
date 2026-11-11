// Turns a finished life's event log into scored, human-readable moments.
// Pure function of the LifeResult; views and the console reel both read this.

import { CLUBS, type Ctx } from './activities';
import { clickReasons, descriptor } from './people';
import type { LifeResult, Tie } from './sim';

export type HighlightType =
  | 'move' | 'job' | 'met' | 'smallWorld' | 'nearMiss' | 'reunion' | 'friendsMet' | 'introduced'
  | 'fade' | 'rekindle' | 'friendMoved' | 'friendArrived' | 'hobby' | 'partner' | 'breakup';

export interface Highlight {
  week: number;
  type: HighlightType;
  /** Higher is more worth showing. Roughly 0 to 15. */
  score: number;
  text: string;
  people: number[];
  /** Life events that anchor the timeline and are always shown. */
  scaffold: boolean;
  /** Venue where it happened, if any. */
  venue?: number;
}

export const LEVEL_NAMES = ['stranger', 'acquaintance', 'friend', 'close friend', 'inner circle'];

export function formatOdds(p: number): string {
  if (p >= 0.5) return 'better than even odds';
  const n = 1 / p;
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return `about a 1-in-${(Math.round(n / mag) * mag).toLocaleString('en-US')} chance`;
}

export function findHighlights(life: LifeResult): Highlight[] {
  const { world, ties, events, params } = life;
  const { agents, venues, cities } = world;
  const L = params.levels;
  const levelOf = (s: number) => (s >= L[3] ? 4 : s >= L[2] ? 3 : s >= L[1] ? 2 : s >= L[0] ? 1 : 0);
  const name = (id: number) => agents[id].name;
  const vname = (v: number) => (v >= 0 ? venues[v].name : 'somewhere');
  const out: Highlight[] = [];
  const me = agents[life.ego];
  /** First mention of someone new: "Maya Okafor (27, a homebody)". */
  const intro = (id: number, week: number) =>
    `${name(id)} (${life.startYear + Math.floor(week / 52) - agents[id].birthYear}, ${descriptor(agents[id])})`;
  const metHow = (t: Tie): string => {
    switch (t.ctx) {
      case 'childhood': return 'growing up';
      case 'work': return `at work, at ${vname(t.venue)}`;
      case 'club': return `at ${vname(t.venue)}`;
      case 'hangout': return `by chance at ${vname(t.venue)}`;
      case 'outing': return t.via >= 0 ? `through ${name(t.via)}` : 'through friends';
      default: return 'a long time ago';
    }
  };

  // Completes the sentence "You know <name> ...".
  const origin = (t: Tie, other: number): string => {
    switch (t.ctx) {
      case 'family': return 'as family';
      case 'childhood': return `from growing up in ${cities[agents[other].hometown].name}`;
      case 'work': return `from work at ${vname(t.venue)}`;
      case 'club': return `from ${vname(t.venue)}`;
      case 'hangout': return `from a chance meeting at ${vname(t.venue)}`;
      case 'outing':
        if (t.via >= 0 && t.via === me.partner) return `through your partner ${name(t.via)}`;
        return t.via >= 0 ? `through ${name(t.via)}` : 'through friends';
      default: return 'from way back';
    }
  };
  const theyKnow = (ctx: Ctx): string => {
    switch (ctx) {
      case 'family': return "they're family";
      case 'childhood': return 'they grew up together';
      case 'work': return 'they met at work';
      case 'club': return 'they met through a club';
      default: return 'they met through friends';
    }
  };

  // Busy people cross paths with everyone, so a near miss has to stand out for this particular life.
  const misses = events.flatMap((e) => (e.t === 'met' ? [e.nearMisses] : [])).sort((a, b) => a - b);
  const nearMissBar = Math.max(20, misses.length ? misses[Math.floor(misses.length * 0.97)] : 0);

  // Drifting apart from a former partner is covered by the breakup itself.
  const partners = new Set<number>(life.start.partner >= 0 ? [life.start.partner] : []);
  for (const e of events) if (e.t === 'partner') partners.add(e.other);

  const faded = new Set<number>();
  const wasClose = new Set<number>();

  for (const e of events) {
    switch (e.t) {
      case 'move': {
        if (e.who === life.ego) {
          const left = e.left > 0 ? `, leaving ${e.left} friend${e.left === 1 ? '' : 's'} behind` : '';
          out.push({
            week: e.week, type: 'move', score: 6, scaffold: true, people: [],
            text: `Moved from ${cities[e.from].name} to ${cities[e.to].name}${left}.`,
          });
        } else if (e.to === e.egoCity && e.s >= L[1]) {
          out.push({
            week: e.week, type: 'friendArrived', score: 3.5 + e.s * 3, scaffold: false, people: [e.who],
            text: `${name(e.who)} moved to ${cities[e.to].name}, the city you live in.`,
          });
        } else if (e.from === e.egoCity && e.s >= L[2]) {
          out.push({
            week: e.week, type: 'friendMoved', score: 2 + e.s * 3, scaffold: false, people: [e.who],
            text: `Your ${ties.get(e.who)?.kin ? 'relative' : levelOf(e.s) === 4 ? 'inner-circle friend' : LEVEL_NAMES[levelOf(e.s)]} ${name(e.who)} moved away to ${cities[e.to].name}.`,
          });
        }
        break;
      }
      case 'job': {
        const via = e.via >= 0 ? `, on ${name(e.via)}'s recommendation` : '';
        out.push({
          week: e.week, type: 'job', score: 3, scaffold: true, people: e.via >= 0 ? [e.via] : [],
          text: `Started a new job at ${vname(e.to)}${via}.`,
        });
        break;
      }
      case 'hobby': {
        const via = e.via >= 0 ? `, thanks to ${name(e.via)}` : '';
        out.push({
          week: e.week, type: 'hobby', score: 2.5, scaffold: false, people: e.via >= 0 ? [e.via] : [],
          text: `Gave up ${CLUBS[e.from].hobby} and got into ${CLUBS[e.to].hobby}${via}.`,
        });
        break;
      }
      case 'met': {
        const tie = ties.get(e.other);
        if (!tie) break;
        const peak = levelOf(tie.peak);
        const rarity = Math.min(4, Math.log10(1 / Math.max(e.p, 1e-9)));
        let text: string;
        const who = intro(e.other, e.week);
        if (e.ctx === 'work') text = `Met ${who}, a coworker at ${vname(e.venue)}.`;
        else if (e.ctx === 'club') text = `Met ${who} at ${vname(e.venue)}.`;
        else if (e.ctx === 'outing') text = `${e.via >= 0 ? name(e.via) : 'A friend'} introduced you to ${who} at ${vname(e.venue)}.`;
        else text = `Got talking to ${who}, a stranger at ${vname(e.venue)}.`;
        const outcome = peak === 4 ? 4 : peak === 3 ? 3 : peak === 2 ? 1 : 0;
        let score = outcome * (1 + rarity / 2);
        let type: HighlightType = 'met';
        if (outcome > 0 && e.p < 0.2) text += ` It was ${formatOdds(e.p)} that week.`;
        // A mutual friend only counts as a coincidence if nothing obvious explains it.
        const m = peak >= 2
          ? e.mutuals.find((x) => x.s >= L[2] && (x.away || x.ctx === 'family' || x.ctx === 'childhood'))
          : undefined;
        if (m) {
          score += 2.5 + (m.away ? 1.5 : 0) + rarity * 0.4;
          type = 'smallWorld';
          const where = m.away ? `, who lives in ${cities[agents[m.id].city].name}` : '';
          text += ` Small world: ${name(e.other).split(' ')[0]} already knew your ${ties.get(m.id)?.kin ? 'relative' : 'close friend'} ${name(m.id)}${where} (${theyKnow(m.ctx)}).`;
        }
        if (e.nearMisses >= nearMissBar && peak >= 3) {
          score += 1.5 + Math.min(1.5, Math.log2(e.nearMisses) / 3);
          if (type === 'met') type = 'nearMiss';
          text += ` You had crossed paths ${e.nearMisses} times before without ever speaking.`;
        }
        if (peak >= 3) {
          const why = clickReasons(me, agents[e.other]);
          text += why.length ? ` You clicked over ${why.join(' and ')}.` : tie.c < 0.3 ? ' An unlikely pair, on paper.' : ' You just got along.';
        }
        if (me.partner === e.other) text += ' Years later you got together.';
        else if (peak === 4) text += ' They ended up in your inner circle.';
        else if (peak === 3) text += ' They became a close friend.';
        else if (peak === 2) text += ' You became friends.';
        if (score >= 2.5) out.push({ week: e.week, type, score, text, people: [e.other], scaffold: false, venue: e.venue });
        break;
      }
      case 'reunion': {
        const tie = ties.get(e.other);
        if (!tie || e.prevPeak < L[2]) break;
        const yrs = Math.round(e.gap / 52);
        const how =
          e.ctx === 'hangout' ? `Ran into ${name(e.other)} at ${vname(e.venue)}`
          : e.ctx === 'outing' ? `Caught up with ${name(e.other)} at ${vname(e.venue)}`
          : e.ctx === 'work' ? `${name(e.other)} turned up at your workplace, ${vname(e.venue)}`
          : `${name(e.other)} turned up at ${vname(e.venue)}`;
        out.push({
          week: e.week, type: 'reunion', scaffold: false, people: [e.other], venue: e.venue,
          score: Math.min(3, e.gap / 156) + e.prevPeak * 7 + (e.ctx === 'outing' ? 0 : 1),
          text: `${how} in ${cities[e.city].name}, for the first time in ${yrs} years. You know them ${origin(tie, e.other)}.`,
        });
        break;
      }
      case 'friendsMet': {
        const ta = ties.get(e.a);
        const tb = ties.get(e.b);
        if (!ta || !tb || ta.kin || tb.kin) break;
        const different = ta.ctx !== tb.ctx || ta.venue !== tb.venue;
        // Only worth a mention when both are close to you and come from different parts of your life.
        if (!different || e.sa < L[2] || e.sb < L[2]) break;
        if (e.via === life.ego) {
          out.push({
            week: e.week, type: 'introduced', scaffold: false, people: [e.a, e.b], venue: e.venue,
            score: 1.5 + e.sa + e.sb + (different ? 1.5 : 0),
            text: `You introduced ${name(e.a)} and ${name(e.b)} to each other at ${vname(e.venue)}.`,
          });
        } else {
          const explain = different
            ? ` You know ${name(e.a).split(' ')[0]} ${origin(ta, e.a)} and ${name(e.b).split(' ')[0]} ${origin(tb, e.b)}.`
            : '';
          out.push({
            week: e.week, type: 'friendsMet', scaffold: false, people: [e.a, e.b], venue: e.venue,
            score: 2.5 + e.sa + e.sb + (different ? 2 : 0) + (e.ctx === 'outing' ? 0 : 1),
            text: `Two of your friends, ${name(e.a)} and ${name(e.b)}, met at ${vname(e.venue)} without you.${explain}`,
          });
        }
        break;
      }
      case 'partner': {
        const tie = ties.get(e.other);
        if (!tie) break;
        const odds = tie.met >= 0 && tie.p < 0.2 ? `, ${formatOdds(tie.p)} that week` : '';
        out.push({
          week: e.week, type: 'partner', score: 12, scaffold: true, people: [e.other],
          text: `You and ${name(e.other)} got together. You met in ${life.startYear + Math.floor(tie.met / 52)} ${metHow(tie)}${odds}.`,
        });
        break;
      }
      case 'breakup': {
        const years = Math.round(e.weeks / 52);
        const span = e.weeks >= 1040 ? 'many years' : years < 1 ? 'less than a year' : years === 1 ? 'a year' : `${years} years`;
        out.push({
          week: e.week, type: 'breakup', score: 9, scaffold: true, people: [e.other],
          text: `You and ${name(e.other)} went your separate ways after ${span} together.`,
        });
        break;
      }
      case 'level': {
        const tie = ties.get(e.other);
        if (!tie || tie.kin || partners.has(e.other)) break;
        if (e.to >= 3) {
          if (faded.has(e.other)) {
            faded.delete(e.other);
            out.push({
              week: e.week, type: 'rekindle', score: 5 + tie.peak * 2, scaffold: false, people: [e.other],
              text: `You and ${name(e.other)} grew close again after drifting apart.`,
            });
          }
          wasClose.add(e.other);
        } else if (e.to <= 1 && wasClose.has(e.other) && !faded.has(e.other)) {
          faded.add(e.other);
          wasClose.delete(e.other);
          out.push({
            week: e.week, type: 'fade', score: 2.5 + tie.peak * 3, scaffold: false, people: [e.other],
            text: `You and ${name(e.other)} drifted apart. You knew them ${origin(tie, e.other)}.`,
          });
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/** The moments worth printing: every life event plus the top-scoring others, in order. */
export function selectReel(all: Highlight[], top: number): Highlight[] {
  const rest = all.filter((h) => !h.scaffold).sort((a, b) => b.score - a.score).slice(0, top);
  return [...all.filter((h) => h.scaffold), ...rest].sort((a, b) => a.week - b.week || b.score - a.score);
}
