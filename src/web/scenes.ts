/// <reference types="vite/client" />
// Scenes written by hand for one particular simulated life.
//
// The simulation supplies the facts (who these two are, what has just happened, how long they
// have known each other); the dialogue is authored for that life and is not generated. Each scene
// is a plain script file in scenes/ (the format is in scenes/README.md) so the words can be
// edited without touching code. A scene names the life it was written for, and the page only
// offers it while that life still matches, because a new simulation rule changes every life.

export type Who = 'you' | 'them';
export type Stance = 'sitting' | 'standing' | 'away';

export type Step = { line: number; flag?: string } & (
  /** A place and a time, alone on the screen. */
  | { t: 'title'; text: string; sub?: string; hold: number }
  /** Nothing is said. The scene keeps running for `s` seconds. */
  | { t: 'pause'; s: number }
  /** `voice` is someone off screen, by name. */
  | { t: 'say'; who: Who | 'voice'; voice?: string; text: string; after?: number }
  | { t: 'enter' }
  | { t: 'sit' }
  | { t: 'give' }
  | { t: 'drink'; who: Who }
  | { t: 'leave'; who: Who }
  /** The last words of the film, alone on the screen. {seen} and {led} are filled in. */
  | { t: 'end'; text: string }
);

export interface FilmScene {
  file: string;
  name: string;
  seed: number;
  other: number;
  otherName: string;
  set: 'pier' | 'steps' | 'sofa';
  /** night, dusk or morning, for the sets that have more than one. */
  time: string;
  week: number;
  start: Record<Who, Stance>;
  props: string[];
  /** The other person's shirt colour, when the scene needs it. */
  wearing?: string;
  status: string;
  notes: string;
  steps: Step[];
}

function parse(file: string, src: string): FilmScene {
  const sc: FilmScene = {
    file, name: file, seed: -1, other: -1, otherName: '', set: 'pier', time: 'night', week: 0,
    start: { you: 'sitting', them: 'away' }, props: [], status: 'draft', notes: '', steps: [],
  };
  let body = false;
  let flag: string | undefined;
  src.split('\n').forEach((raw, k) => {
    const text = raw.trim();
    const line = k + 1;
    if (!text) { if (sc.seed >= 0) body = true; return; }
    const colon = text.indexOf(':');
    if (!body && colon > 0 && /^[a-z]+$/.test(text.slice(0, colon))) {
      const key = text.slice(0, colon);
      const v = text.slice(colon + 1).trim();
      if (key === 'name') sc.name = v;
      else if (key === 'seed') sc.seed = Number(v);
      else if (key === 'with') { sc.other = Number(v.split(' ')[0]); sc.otherName = v.split(' ').slice(1).join(' '); }
      else if (key === 'set') { sc.set = v.split(' ')[0] as FilmScene['set']; sc.time = v.split(' ')[1] ?? 'night'; }
      else if (key === 'week') sc.week = Number(v);
      else if (key === 'start') for (const part of v.split(',')) { const [w, st] = part.trim().split(' '); if (w === 'you' || w === 'them') sc.start[w] = st as Stance; }
      else if (key === 'props') sc.props = v.split(',').map((x) => x.trim()).filter(Boolean);
      else if (key === 'wearing') sc.wearing = v;
      else if (key === 'status') sc.status = v;
      else if (key === 'notes') sc.notes = v;
      return;
    }
    body = true;
    const push = (s: Record<string, unknown>) => { sc.steps.push({ line, ...(flag ? { flag } : {}), ...s } as Step); flag = undefined; };
    const [head, ...restWords] = text.split(' ');
    const rest = restWords.join(' ');
    if (head === 'FLAG') flag = rest;
    else if (head === 'TITLE') { const [a, b] = rest.split('|').map((x) => x.trim()); push({ t: 'title', text: a, sub: b, hold: 4 }); }
    else if (head === 'PAUSE') push({ t: 'pause', s: Number(rest) || 2 });
    else if (head === 'ENTER') push({ t: 'enter' });
    else if (head === 'SIT') push({ t: 'sit' });
    else if (head === 'GIVE') push({ t: 'give' });
    else if (head === 'DRINK') push({ t: 'drink', who: rest === 'you' ? 'you' : 'them' });
    else if (head === 'LEAVE') push({ t: 'leave', who: rest === 'them' ? 'them' : 'you' });
    else if (head === 'END') push({ t: 'end', text: rest });
    else if (colon > 0) {
      // A spoken line: "YOU: ...", "KOFI: ..." or "VOICE Dad: ...", with an optional "[seconds]" of quiet after.
      const speaker = text.slice(0, colon);
      let words = text.slice(colon + 1).trim();
      let after: number | undefined;
      const m = /\s*\[([\d.]+)\]$/.exec(words);
      if (m) { after = Number(m[1]); words = words.slice(0, m.index); }
      if (speaker.startsWith('VOICE ')) push({ t: 'say', who: 'voice', voice: speaker.slice(6), text: words, after });
      else push({ t: 'say', who: speaker === 'YOU' ? 'you' : 'them', text: words, after });
    }
  });
  return sc;
}

const files = import.meta.glob('./scenes/*.scene', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const ALL: FilmScene[] = Object.keys(files).sort().map((path) => parse(path.split('/').pop()!, files[path]));

/** The scenes written for this life, in order, if the life is still the one they were written for. */
export function scenesFor(seed: number, people: { id: number; name: string }[]): FilmScene[] {
  return ALL.filter((s) => {
    if (s.seed !== seed) return false;
    const p = people.find((x) => x.id === s.other);
    return !!p && p.name.split(' ')[0] === s.otherName;
  });
}
