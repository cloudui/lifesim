/// <reference types="vite/client" />
// Scenes written by hand.
//
// There are two kinds of film, and both use the same script format (scenes/README.md):
//
//   for a simulated life   The simulation supplies the facts (who these two are, what has just
//                          happened); the dialogue is authored for that life. A scene names the
//                          seed and person it was written for, and is only offered while they
//                          still match, because a new simulation rule changes every life.
//   written from scratch   A folder in scenes/ with a `cast` file: real or invented people with
//                          hand-picked looks, and scenes that name the film instead of a seed.
//                          Nothing in it comes from the simulation.
//
// Scripts are plain files so the words can be edited without touching code.

import type { Look } from './pixel';

export type Stance = 'sitting' | 'standing' | 'away';
export type Side = 'left' | 'right';
/** The face in the dialogue box for one line. */
export type Mood = 'flat' | 'smile' | 'sad' | 'open' | 'shut';

export type Step = { line: number; flag?: string } & (
  /** A place and a time, alone on the screen. */
  | { t: 'title'; text: string; sub?: string; hold: number }
  /** A line of text over the scene as it goes dark. Used to close a scene. */
  | { t: 'card'; text: string; hold: number }
  /** Nothing is said. The scene keeps running for `s` seconds. */
  | { t: 'pause'; s: number }
  /** `off` is someone who is not on screen: a voice from inside, or on a phone. `as` borrows another person's voice. */
  | { t: 'say'; who: string; off?: 'voice' | 'phone'; text: string; after?: number; mood?: Mood; as?: string }
  /** `wait` false lets the script carry on while they walk. */
  | { t: 'enter'; who: string; from: Side | 'door'; to: number | null; wait: boolean }
  | { t: 'leave'; who: string; to: Side | 'door'; wait: boolean }
  | { t: 'walk'; who: string; x: number; wait: boolean }
  | { t: 'sit'; who: string }
  | { t: 'stand'; who: string }
  | { t: 'face'; who: string; dir: Side | 'door' | 'auto' }
  /** A small sign over someone's head for a few seconds: z, dots, bang, ask, note, ring, heart. */
  | { t: 'emote'; who: string; glyph: string; s: number }
  /** Something in their hand: phone, racket, cup, or none to put it away. */
  | { t: 'hold'; who: string; item: string }
  /** Sitting up, or slumped forward with their head down. */
  | { t: 'pose'; who: string; pose: string }
  /** A close-up over the scene for a few seconds: shoes, receipt, photo, cake. */
  | { t: 'show'; name: string; s: number; who?: string }
  | { t: 'give' }
  | { t: 'drink'; who: string }
  /** The last words of the film, alone on the screen. {seen} and {led} are filled in for a simulated life. */
  | { t: 'end'; text: string }
);

export interface Place { who: string; stance: Stance; x: number | null }

export interface FilmScene {
  file: string;
  name: string;
  /** A simulated life: its seed and the other person. -1 for a film written from scratch. */
  seed: number;
  other: number;
  otherName: string;
  /** A film written from scratch: its folder name. */
  film: string;
  set: string;
  /** night, dusk, morning and so on, for the sets that have more than one. */
  time: string;
  week: number;
  /** The year, for a film written from scratch. */
  year: number;
  city: number | null;
  /** Who is in the scene and where they start, in drawing order. x is pixels from the middle of the set. */
  places: Place[];
  props: string[];
  /** What people are wearing in this scene, where it differs from their usual: key -> look fields. */
  wear: Record<string, Partial<Look>>;
  /** Music under the scene: warm, quiet, late, none, or the name of a file in public/music. */
  music: string;
  status: string;
  notes: string;
  steps: Step[];
  /** The ending of a film written from scratch: a line, then what goes when the person is taken away. */
  endLine: string;
  gone: { name: string; note: string }[];
}

export interface CastMember { key: string; name: string; born: number; look: Look; scale: number; voice: number }
export interface Film {
  id: string;
  title: string;
  about: string;
  /** The key of the person the film is told from. */
  you: string;
  city: number;
  cast: Map<string, CastMember>;
  scenes: FilmScene[];
}

const STYLES: Record<string, number> = { short: 0, long: 1, bun: 2, cropped: 3, swoop: 4, spiky: 5, mop: 6, mullet: 7, fringe: 8, flat: 9, wavy: 10 };

/** "shirt=#fff shorts=yes tall=1" -> look fields. */
function lookFields(text: string): Partial<Look> & { born?: number; scale?: number; voice?: number } {
  const out: Record<string, unknown> = {};
  for (const part of text.split(/\s+/)) {
    const [k, v] = part.split('=');
    if (!k || v === undefined) continue;
    if (k === 'style') out.hairStyle = STYLES[v] ?? 0;
    else if (k === 'shorts') out.shorts = v === 'yes';
    else if (k === 'tall' || k === 'born' || k === 'scale' || k === 'voice') out[k] = Number(v);
    else if (k === 'jacket' && v === 'none') out.jacket = undefined;
    else if (k === 'glasses' && v === 'none') out.glasses = undefined;
    else if (k === 'heavy' || k === 'big') out[k === 'heavy' ? 'heavyGlasses' : 'big'] = v === 'yes';
    else out[k] = v;
  }
  return out;
}

function parseCast(id: string, src: string): Film {
  const film: Film = { id, title: id, about: '', you: '', city: 0, cast: new Map(), scenes: [] };
  for (const raw of src.split('\n')) {
    const text = raw.trim();
    if (!text || text.startsWith('#')) continue;
    if (text.includes('|')) {
      const [key, name, rest] = text.split('|').map((x) => x.trim());
      const f = lookFields(rest ?? '');
      const { born = 2000, scale = 1, voice = 220, ...look } = f;
      film.cast.set(key.toUpperCase(), {
        key: key.toUpperCase(), name, born, scale, voice,
        look: { skin: '#eab98f', hair: '#1a1a22', hairStyle: 0, shirt: '#3d5a80', pants: '#2d3142', formal: 'suit', ...look },
      });
      continue;
    }
    const colon = text.indexOf(':');
    if (colon < 0) continue;
    const key = text.slice(0, colon);
    const v = text.slice(colon + 1).trim();
    if (key === 'title') film.title = v;
    else if (key === 'about') film.about = v;
    else if (key === 'you') film.you = v.toUpperCase();
    else if (key === 'city') film.city = Number(v) || 0;
  }
  return film;
}

function parse(file: string, src: string): FilmScene {
  const sc: FilmScene = {
    file, name: file, seed: -1, other: -1, otherName: '', film: '', set: 'pier', time: 'night', week: 0, year: 0, city: null,
    places: [], props: [], wear: {}, music: '', status: 'draft', notes: '', steps: [], endLine: '', gone: [],
  };
  let body = false;
  let flag: string | undefined;
  /** In a scene for a simulated life there are only two people: YOU, and the other one by any name. */
  const key = (w: string | undefined, fallback: string): string => {
    if (!w) return fallback;
    const up = w.toUpperCase();
    if (sc.film) return up;
    return up === 'YOU' ? 'YOU' : 'THEM';
  };
  src.split('\n').forEach((raw, k) => {
    const text = raw.trim();
    const line = k + 1;
    if (!text) { if (sc.seed >= 0 || sc.film) body = true; return; }
    const colon = text.indexOf(':');
    if (!body && colon > 0 && /^[a-z]+$/.test(text.slice(0, colon))) {
      const hk = text.slice(0, colon);
      const v = text.slice(colon + 1).trim();
      if (hk === 'name') sc.name = v;
      else if (hk === 'seed') sc.seed = Number(v);
      else if (hk === 'film') sc.film = v;
      else if (hk === 'with') {
        if (/^\d/.test(v)) { sc.other = Number(v.split(' ')[0]); sc.otherName = v.split(' ').slice(1).join(' '); }
        else sc.otherName = v;
      }
      else if (hk === 'set') { sc.set = v.split(' ')[0]; sc.time = v.split(' ')[1] ?? 'night'; }
      else if (hk === 'week') sc.week = Number(v);
      else if (hk === 'year') sc.year = Number(v);
      else if (hk === 'city') sc.city = Number(v);
      else if (hk === 'start' || hk === 'cast') {
        // "you sitting, them away" or "ERIC -12 sitting, JASON away": who, an optional place, and a stance.
        for (const part of v.split(',')) {
          const words = part.trim().split(/\s+/);
          const who = key(words[0], 'THEM');
          const stance = (words.find((w) => w === 'sitting' || w === 'standing' || w === 'away') ?? 'standing') as Stance;
          const at = words.slice(1).find((w) => /^[-+]?\d+$/.test(w));
          sc.places = sc.places.filter((p) => p.who !== who);
          sc.places.push({ who, stance, x: at === undefined ? null : Number(at) });
        }
      }
      else if (hk === 'props') sc.props = v.split(',').map((x) => x.trim()).filter(Boolean);
      else if (hk === 'wearing') sc.wear.THEM = { shirt: v };
      else if (hk === 'wear') for (const part of v.split(',')) { const [who, ...rest] = part.trim().split(/\s+/); sc.wear[who.toUpperCase()] = lookFields(rest.join(' ')); }
      else if (hk === 'music') sc.music = v;
      else if (hk === 'status') sc.status = v;
      else if (hk === 'notes') sc.notes = v;
      return;
    }
    body = true;
    const push = (s: Record<string, unknown>) => { sc.steps.push({ line, ...(flag ? { flag } : {}), ...s } as Step); flag = undefined; };
    let words = text.split(/\s+/);
    const head = words[0];
    // "&" at the end of a move: do not wait for it.
    const wait = words[words.length - 1] !== '&';
    if (!wait) words = words.slice(0, -1);
    const rest = text.slice(head.length).trim();
    const side = (fallback: Side): Side | 'door' => (words.includes('left') ? 'left' : words.includes('right') ? 'right' : words.includes('door') ? 'door' : fallback);
    const num = (): number | null => { const n = words.slice(1).find((w) => /^[-+]?\d+(\.\d+)?$/.test(w)); return n === undefined ? null : Number(n); };
    const who = (fallback: string): string => {
      const w = words[1];
      return w && !/^[-+]?\d/.test(w) && w !== 'left' && w !== 'right' && w !== 'door' ? key(w, fallback) : fallback;
    };
    if (head === 'FLAG') flag = rest;
    else if (head === 'TITLE') { const [a, b] = rest.split('|').map((x) => x.trim()); push({ t: 'title', text: a, sub: b, hold: 4 }); }
    else if (head === 'CARD') push({ t: 'card', text: rest, hold: 5 });
    else if (head === 'PAUSE') push({ t: 'pause', s: Number(rest) || 2 });
    else if (head === 'ENTER') push({ t: 'enter', who: who('THEM'), from: side('left'), to: num(), wait });
    else if (head === 'LEAVE') push({ t: 'leave', who: who('YOU'), to: side('right'), wait });
    else if (head === 'WALK') push({ t: 'walk', who: who('THEM'), x: num() ?? 0, wait });
    else if (head === 'SIT') push({ t: 'sit', who: who('THEM') });
    else if (head === 'STAND') push({ t: 'stand', who: who('THEM') });
    else if (head === 'FACE') push({ t: 'face', who: who('THEM'), dir: words.includes('auto') ? 'auto' : side('left') });
    else if (head === 'EMOTE') push({ t: 'emote', who: who('THEM'), glyph: words[2] ?? 'dots', s: Number(words[3]) || 2.5 });
    else if (head === 'HOLD') push({ t: 'hold', who: who('THEM'), item: words[2] ?? 'none' });
    else if (head === 'POSE') push({ t: 'pose', who: who('THEM'), pose: words[2] ?? 'up' });
    else if (head === 'SHOW') push({ t: 'show', name: words[1] ?? '', s: Number(words[2]) || 5, who: words[3]?.toUpperCase() });
    else if (head === 'GIVE') push({ t: 'give' });
    else if (head === 'DRINK') push({ t: 'drink', who: who('THEM') });
    else if (head === 'WITHOUT') sc.endLine = rest;
    else if (head === 'GONE') { const [a, b] = rest.split('|').map((x) => x.trim()); sc.gone.push({ name: a, note: b ?? '' }); }
    else if (head === 'END') push({ t: 'end', text: rest });
    else if (colon > 0) {
      // A spoken line: "YOU: ...", "KOFI: ...", "VOICE Dad: ..." or "PHONE Calvin: ...", with an optional
      // "[seconds]" of quiet after. "KOFI (smile): ..." sets the face; "ERIC (as JASON): ..." borrows a voice.
      let speaker = text.slice(0, colon);
      let mood: string | undefined;
      let as: string | undefined;
      const mm = /^(.*?)\s*\(([\w ]+)\)$/.exec(speaker);
      if (mm) {
        speaker = mm[1];
        if (mm[2].startsWith('as ')) { as = mm[2].slice(3).toUpperCase(); mood = 'smile'; } else mood = mm[2];
      }
      let said = text.slice(colon + 1).trim();
      let after: number | undefined;
      const m = /\s*\[([\d.]+)\]$/.exec(said);
      if (m) { after = Number(m[1]); said = said.slice(0, m.index); }
      if (speaker.startsWith('VOICE ')) push({ t: 'say', who: speaker.slice(6), off: 'voice', text: said, after });
      else if (speaker.startsWith('PHONE ')) push({ t: 'say', who: speaker.slice(6), off: 'phone', text: said, after });
      else push({ t: 'say', who: key(speaker, 'THEM'), text: said, after, mood, as });
    }
  });
  if (!sc.places.length) sc.places = [{ who: 'THEM', stance: 'away', x: null }, { who: 'YOU', stance: 'sitting', x: null }];
  // The person the film is told from is drawn last, in front.
  if (!sc.film) sc.places.sort((a, b) => (a.who === 'YOU' ? 1 : 0) - (b.who === 'YOU' ? 1 : 0));
  return sc;
}

const files = import.meta.glob('./scenes/**/*.scene', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const casts = import.meta.glob('./scenes/*/cast', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const ALL: FilmScene[] = Object.keys(files).sort().map((path) => parse(path.replace('./scenes/', ''), files[path]));
const FILMS: Film[] = Object.keys(casts).sort().map((path) => {
  const id = path.split('/')[2];
  const film = parseCast(id, casts[path]);
  film.scenes = ALL.filter((s) => s.film === id);
  return film;
});

/** The scenes written for this life, in order, if the life is still the one they were written for. */
export function scenesFor(seed: number, people: { id: number; name: string }[]): FilmScene[] {
  return ALL.filter((s) => {
    if (s.film || s.seed !== seed) return false;
    const p = people.find((x) => x.id === s.other);
    return !!p && p.name.split(' ')[0] === s.otherName;
  });
}

/** Films written from scratch, with their own cast. */
export function films(): Film[] {
  return FILMS.filter((f) => f.scenes.length > 0);
}
