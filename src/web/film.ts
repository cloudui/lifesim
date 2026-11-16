// The film: a handful of scenes about two people. One place, dialogue and silence, no narration.
//
// The opposite of a caption. Nothing here says what happened or how anyone feels; a line appears
// with the speaker's face, there is a pause, the other one answers or does not. Pauses are part
// of the script, and the scene keeps moving (water, lights, a drink) while nothing is said.
// Between scenes the years pass as a single card. Scripts are written by hand per life
// (scenes.ts and the files in scenes/).

import { drawFace, FACE_H, FACE_W } from './faces';
import { drawInsert, INSERT_W } from './inserts';
import { drawGlyph, drawPerson, GLYPHS, lookFor, portrait, portraitOf, type Look } from './pixel';
import type { Film, FilmScene, Mood, Side, Stance, Step } from './scenes';
import { drawBack, drawFront, soundOf, stageOf, standInFront, type Stage } from './sets';
import * as sound from './sound';
import type { Ctx } from './types';

export interface FilmPlayer {
  active(): boolean;
  /**
   * Play these scenes in order, starting at `from`. `review` shows the file and line being played.
   * `film` is the cast of a film written from scratch; without it the scenes are about the life on screen.
   */
  start(scenes: FilmScene[], from?: number, review?: boolean, film?: Film): void;
  stop(): void;
  frame(dt: number): void;
  next(): void;
  toggleSound(): void;
  /** Review: move by lines (±1) or by scenes (±1). */
  jump(lines: number, scenes: number): void;
  resize(): void;
}

/** Characters of dialogue typed per second. Slower than reading speed on purpose. */
const TYPE_RATE = 24;

type G = CanvasRenderingContext2D;
interface Actor {
  key: string;
  mode: Stance | 'walking';
  /** Where they are and where they are going, in pixels from the middle of the set. */
  off: number;
  to: number;
  home: number;
  /** Walking off: they are gone when they arrive. */
  leaving: boolean;
  face: Side | null;
  bottle: boolean;
  sip: number;
  emote: { glyph: string; t0: number; s: number } | null;
  hold: string;
  slump: boolean;
}
/** Someone in a scene, from the simulated life or from a film's own cast. */
interface Person { id: number; name: string; look: Look; born: number; scale: number; voice: number }

export function createFilm(root: HTMLElement, ctx: Ctx, on: { done(): void; without(): void }): FilmPlayer {
  root.innerHTML = `
    <canvas class="pixel-canvas"></canvas>
    <div class="film-title"><div class="film-title-text"></div><div class="film-title-sub"></div></div>
    <button class="film-skip" type="button" title="Leave the film">Leave ▸▸</button>
    <button class="film-sound" type="button" title="Sound on or off (M)"></button>
    <div class="film-scrub" title="Jump to a scene"></div>
    <div class="film-hint">it plays by itself · space or click to go sooner</div>
    <div class="film-review" hidden></div>
    <div class="film-box" hidden>
      <div class="film-face"></div>
      <div class="film-words"><div class="film-name"></div><div class="film-line"></div></div>
    </div>
    <div class="film-end" hidden>
      <div class="film-without-line"></div>
      <div class="film-without"></div>
      <div class="film-end-text"></div>
      <div class="film-actions">
        <button class="again" type="button">↺ Watch again</button>
        <button class="see big" type="button">See the life without them ▶</button>
        <button class="back" type="button">Back</button>
      </div>
    </div>`;
  const canvas = root.querySelector('canvas')!;
  const g = canvas.getContext('2d')!;
  const titleEl = root.querySelector<HTMLElement>('.film-title')!;
  const box = root.querySelector<HTMLElement>('.film-box')!;
  const face = root.querySelector<HTMLElement>('.film-face')!;
  const nameEl = root.querySelector<HTMLElement>('.film-name')!;
  const lineEl = root.querySelector<HTMLElement>('.film-line')!;
  const endEl = root.querySelector<HTMLElement>('.film-end')!;
  const reviewEl = root.querySelector<HTMLElement>('.film-review')!;
  const withoutEl = root.querySelector<HTMLElement>('.film-without')!;
  const withoutLine = root.querySelector<HTMLElement>('.film-without-line')!;
  const endText = root.querySelector<HTMLElement>('.film-end-text')!;
  const endActions = root.querySelector<HTMLElement>('.film-actions')!;
  const seeBtn = root.querySelector<HTMLElement>('.see')!;
  /** "Without them": when each card appears and goes, in seconds from the start of the ending. */
  let without: { el: HTMLElement; on: number; off: number }[] = [];
  let withoutTimes = { take: 0, last: 0 };
  let faceCanvas: HTMLCanvasElement | null = null;
  let faceMood: Mood = 'flat';
  let faceWho = '';
  const soundBtn = root.querySelector<HTMLElement>('.film-sound')!;
  const ICON = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z"/>';
  const showSound = () => {
    soundBtn.innerHTML = sound.isMuted()
      ? `${ICON}<path d="M11 6l4 4m0-4l-4 4" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>`
      : `${ICON}<path d="M11 5.5c1.2 1.4 1.2 3.6 0 5M12.8 3.8c2.2 2.4 2.2 6 0 8.4" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>`;
    soundBtn.setAttribute('aria-label', sound.isMuted() ? 'Sound is off' : 'Sound is on');
  };
  const scrubEl = root.querySelector<HTMLElement>('.film-scrub')!;
  showSound();
  soundBtn.addEventListener('click', () => { sound.unlock(); sound.setMuted(!sound.isMuted()); showSound(); });
  const scratch = document.createElement('canvas');
  scratch.width = 48;
  scratch.height = 56;
  const sg = scratch.getContext('2d')!;

  let W = 320;
  let H = 180;
  let list: FilmScene[] = [];
  /** The cast of a film written from scratch, or null when the scenes are about the life on screen. */
  let film: Film | null = null;
  let si = 0;
  let scene: FilmScene | null = null;
  let on_ = false;
  let review = false;
  let i = 0;
  /** Seconds into the current step, and into the scene. */
  let t = 0;
  let clock = 0;
  let typed = -1;
  let faceKey = '';
  let actors: Actor[] = [];
  let speaking: string | null = null;
  /** 0 to 1: the scene going to black, at the end of a scene or under the last words. */
  let veil = 0;
  /** After the last step of a scene: fading out, then the card for the years between scenes. */
  let after: 'none' | 'fade' | 'between' = 'none';
  let afterT = 0;
  /** 0 to 1: the picture coming up out of black, which waits until the title card has gone. */
  let shown = 0;
  /** A close-up over the scene. */
  let insert: { name: string; t0: number; s: number; who?: string } | null = null;

  const view = () => ctx.view();
  /** The person the film is told from, and the one it is about. */
  const youKey = () => (film ? film.you : 'YOU');
  const themKey = () => (film ? scene!.otherName.toUpperCase() : 'THEM');
  const yearNow = () => (film ? scene!.year : ctx.yearOf(scene!.week));
  const cityNow = () => (film ? scene!.city ?? film.city : ctx.cityAt(view().data.ego.cities, Math.max(0, scene!.week)));
  function person(key: string): Person {
    const wear = scene?.wear[key] ?? {};
    if (film) {
      const m = film.cast.get(key);
      if (m) return { id: [...film.cast.keys()].indexOf(key) + 1, name: m.name, look: { ...m.look, ...wear }, born: m.born, scale: m.scale, voice: m.voice };
      return { id: 99, name: key, look: { ...lookFor(7), ...wear }, born: 2000, scale: 1, voice: 220 };
    }
    const d = view().data;
    if (key === 'YOU') return { id: d.ego.id, name: d.ego.name.split(' ')[0], look: { ...lookFor(d.ego.id), ...wear }, born: d.ego.born, scale: 1, voice: 196 };
    const p = view().people.get(scene!.other);
    return { id: scene!.other, name: (p?.name ?? scene!.otherName).split(' ')[0], look: { ...lookFor(scene!.other), ...wear }, born: p?.born ?? 2000, scale: 1, voice: 262 };
  }
  const ageOf = (p: Person) => yearNow() - p.born;
  const greyOf = (p: Person) => Math.min(1, Math.max(0, (ageOf(p) - 45) / 22));
  /** Children are the same sprites, smaller. */
  const sizeOf = (p: Person) => (ageOf(p) < 13 ? 0.72 : ageOf(p) < 16 ? 0.86 : 1) * p.scale;
  const actorOf = (key: string): Actor | undefined => actors.find((a) => a.key === key);

  function resize(): void {
    const cw = root.clientWidth || window.innerWidth;
    const ch = root.clientHeight || window.innerHeight;
    const scale = Math.max(2, Math.round(Math.min(ch / 170, cw / 300)));
    W = Math.ceil(cw / scale);
    H = Math.ceil(ch / scale);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${H * scale}px`;
    g.imageSmoothingEnabled = false;
  }

  const stage = (): Stage => stageOf(scene!.set, W, H);
  const edge = (st: Stage, side: Side | 'door'): number => (side === 'left' ? -(st.cx + 14) : side === 'right' ? W - st.cx + 16 : st.door);

  // ------------------------------------------------------------------ the script

  function showReview(): void {
    reviewEl.hidden = !review;
    if (!review || !scene) return;
    const s = scene.steps[i];
    reviewEl.innerHTML = '';
    const where = document.createElement('div');
    where.textContent = `${scene.file}:${s?.line ?? 0} · ${si + 1} of ${list.length} · ${scene.status}`;
    reviewEl.append(where);
    for (const note of [scene.notes, s?.flag ? `FLAG: ${s.flag}` : '']) {
      if (!note) continue;
      const n = document.createElement('div');
      n.className = note.startsWith('FLAG') ? 'flag' : 'note';
      n.textContent = note;
      reviewEl.append(n);
    }
    const keys = document.createElement('div');
    keys.className = 'note';
    keys.textContent = '← → lines · [ ] scenes';
    reviewEl.append(keys);
  }

  /** What a step does to the people in the scene. `now` skips the walking, for jumping about in review. */
  function act(s: Step, st: Stage, now: boolean): void {
    if (s.t === 'give') { const y = actorOf(youKey()); if (y) y.bottle = true; return; }
    if (s.t === 'show') { if (!now) insert = { name: s.name, t0: clock, s: s.s, who: s.who }; return; }
    if (s.t !== 'enter' && s.t !== 'leave' && s.t !== 'walk' && s.t !== 'sit' && s.t !== 'stand' && s.t !== 'face' && s.t !== 'emote' && s.t !== 'drink' && s.t !== 'hold' && s.t !== 'pose') return;
    const a = actorOf(s.who);
    if (!a) return;
    if (s.t === 'enter') {
      a.to = s.to ?? a.home;
      a.off = now ? a.to : edge(st, s.from);
      a.mode = now ? 'standing' : 'walking';
      a.leaving = false;
    } else if (s.t === 'leave') {
      a.to = edge(st, s.to);
      a.leaving = !now;
      a.mode = now ? 'away' : 'walking';
    } else if (s.t === 'walk') {
      a.to = s.x;
      a.home = s.x;
      if (now) a.off = s.x; else a.mode = 'walking';
      a.leaving = false;
    } else if (s.t === 'sit') a.mode = 'sitting';
    else if (s.t === 'stand') a.mode = 'standing';
    else if (s.t === 'face') a.face = s.dir === 'auto' || s.dir === 'door' ? null : s.dir;
    else if (s.t === 'emote') { if (!now) a.emote = { glyph: s.glyph, t0: clock, s: s.s }; }
    else if (s.t === 'drink') { if (!now) a.sip = clock; }
    else if (s.t === 'hold') a.hold = s.item === 'none' ? '' : s.item;
    else if (s.t === 'pose') a.slump = s.pose === 'slump';
  }

  function begin(k: number): void {
    i = k;
    t = 0;
    typed = -1;
    const s = scene!.steps[i];
    const st = stage();
    speaking = s.t === 'say' && !s.off ? s.who : null;
    box.hidden = s.t !== 'say';
    titleEl.classList.toggle('on', s.t === 'title' || s.t === 'card');
    titleEl.classList.toggle('card', s.t === 'card');
    if (s.t === 'title' || s.t === 'card') {
      titleEl.querySelector('.film-title-text')!.textContent = s.text;
      titleEl.querySelector('.film-title-sub')!.textContent = s.t === 'title' ? s.sub ?? '' : '';
    } else if (s.t === 'say') {
      const key = s.off ? 'off' : `${s.who}${si}`;
      faceMood = s.mood ?? 'flat';
      if (faceKey !== key) {
        faceKey = key;
        faceCanvas = s.off ? null : faceFor();
        faceWho = s.off ? '' : s.who;
        face.replaceChildren(...(faceCanvas ? [faceCanvas] : []));
      }
      paintFace();
      box.classList.toggle('you', s.who === youKey() && !s.off);
      box.classList.toggle('voice', !!s.off);
      nameEl.textContent = s.off === 'phone' ? `${s.who} · on the phone` : s.off ? `${s.who} · from inside` : person(s.who).name;
      lineEl.textContent = '';
    } else if (s.t === 'end') {
      if (film) endFilm(s.text); else endLife(s.text);
      endText.classList.remove('on');
      endActions.classList.remove('on');
      endEl.hidden = false;
    } else act(s, st, false);
    showReview();
    showScrub();
  }

  function card(el: HTMLCanvasElement | null, name: string, note: string, main: boolean): HTMLElement {
    const c = document.createElement('div');
    c.className = `film-card${main ? ' main' : ''}${el ? '' : ' thing'}`;
    const label = document.createElement('span');
    label.innerHTML = `<b></b><small></small>`;
    label.querySelector('b')!.textContent = name;
    label.querySelector('small')!.textContent = note;
    c.append(...(el ? [el] : []), label);
    return c;
  }
  function schedule(cards: HTMLElement[], line: string): void {
    without = cards.map((el, k) => ({ el, on: 2.2 + k * 0.5, off: 0 }));
    const take = 2.2 + cards.length * 0.5 + 4.5;
    without.forEach((c, k) => { c.off = take + 1.2 + k * 1.3; });
    withoutTimes = { take, last: take + 1.2 + cards.length * 1.3 + 1.5 };
    withoutEl.replaceChildren(...cards);
    withoutLine.textContent = line;
    withoutLine.className = 'film-without-line';
  }
  /** Without them, for a simulated life: the one person and everyone who reached you through them, and then not. */
  function endLife(text: string): void {
    const d = view().data;
    const name = person('THEM').name;
    const ids = d.story.beats.find((x) => x.scene === 'without')?.stage ?? [scene!.other];
    const seen = d.arcs.people.find((p) => p.id === scene!.other)?.seen ?? 0;
    const friends = d.people.filter((p) => !p.kin && p.peak >= d.levels[1]).length;
    const led = Math.max(0, ids.length - 1);
    schedule(
      ids.map((id, k) => {
        const arc = d.arcs.people.find((p) => p.id === id);
        return card(portrait(id, k === 0 ? 5 : 4), (view().people.get(id)?.name ?? '').split(' ')[0], k === 0 ? `seen ${seen.toLocaleString('en-US')} times` : `${arc?.tag ?? ''} · seen ${arc?.seen ?? 0}`, k === 0);
      }),
      led > 0
        ? `${friends} people were your friend at some point. ${led === 1 ? 'One' : led} of them reached you through ${name}.`
        : `${friends} people were your friend at some point. ${name} was one.`,
    );
    endText.textContent = text.replace('{seen}', seen.toLocaleString('en-US')).replace('{led}', String(led));
    seeBtn.hidden = false;
  }
  /** Without them, for a film written from scratch: the list is in the script (GONE lines). */
  function endFilm(text: string): void {
    const them = person(themKey());
    schedule(
      [
        card(portraitOf(them.look, 5, greyOf(them)), them.name, '', true),
        ...scene!.gone.map((x) => {
          const m = film!.cast.get(x.name.toUpperCase());
          return card(m ? portraitOf(m.look, 4) : null, x.name, x.note, false);
        }),
      ],
      scene!.endLine,
    );
    endText.textContent = text;
    seeBtn.hidden = true;
  }

  /** A face for the dialogue box: a larger portrait of the same person, at the age they are. */
  function faceFor(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = FACE_W;
    c.height = FACE_H;
    c.style.width = `${FACE_W * 4}px`;
    c.style.height = `${FACE_H * 4}px`;
    c.style.imageRendering = 'pixelated';
    return c;
  }
  /** Redraw the face: its expression, a blink now and then, and the mouth moving while the line is typed. */
  function paintFace(): void {
    if (!faceCanvas || !faceWho) return;
    const p = person(faceWho);
    const s = scene!.steps[i];
    const typing = s.t === 'say' && t * TYPE_RATE < s.text.length;
    drawFace(faceCanvas.getContext('2d')!, p.look, {
      mood: faceMood,
      blink: (clock + p.id * 0.37) % 4.2 < 0.14,
      talking: typing && Math.floor(clock * 7) % 2 === 0,
      grey: greyOf(p),
    });
  }

  /** The bar along the bottom: one piece per scene, filled as far as the film has got. */
  function buildScrub(): void {
    scrubEl.replaceChildren(...list.map((sc, k) => {
      const seg = document.createElement('i');
      seg.style.flexGrow = String(Math.max(4, sc.steps.length));
      seg.title = `${k + 1}. ${sc.name}`;
      seg.append(document.createElement('b'));
      return seg;
    }));
  }
  function showScrub(): void {
    [...scrubEl.children].forEach((seg, k) => {
      const fill = seg.firstElementChild as HTMLElement;
      fill.style.width = `${k < si ? 100 : k > si ? 0 : (100 * (i + 1)) / scene!.steps.length}%`;
      seg.classList.toggle('now', k === si);
    });
  }
  /** Go to a step of a scene, with everyone where the script would have them by then. */
  function seek(k: number, to: number): void {
    titleEl.classList.remove('on');
    open(Math.min(list.length - 1, Math.max(0, k)));
    const target = Math.min(scene!.steps.length - 1, Math.max(0, to));
    if (target === 0) return;
    clock = 3;
    shown = 1;
    const st = stage();
    for (let n = 0; n < target; n++) act(scene!.steps[n], st, true);
    begin(target);
  }
  function scrubTo(ev: PointerEvent): void {
    const segs = [...scrubEl.children] as HTMLElement[];
    const k = segs.findIndex((seg) => { const r = seg.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right; });
    if (k < 0) return;
    const r = segs[k].getBoundingClientRect();
    const to = Math.floor(((ev.clientX - r.left) / r.width) * list[k].steps.length);
    if (k !== si || to !== i) seek(k, to);
  }
  scrubEl.addEventListener('pointerdown', (ev) => { sound.unlock(); scrubEl.setPointerCapture(ev.pointerId); scrubTo(ev); });
  scrubEl.addEventListener('pointermove', (ev) => { if (ev.buttons & 1) scrubTo(ev); });

  function open(k: number): void {
    si = k;
    scene = list[si];
    const st = (() => { resize(); return stage(); })();
    clock = 0;
    veil = 0;
    shown = 0;
    insert = null;
    after = 'none';
    faceKey = '';
    sound.ambience(soundOf(scene.set, scene.time));
    sound.music(scene.music || (film ? 'warm' : 'none'));
    endEl.hidden = true;
    titleEl.classList.remove('card');
    const bottles = scene.props.includes('bottles');
    const awayAtStart = scene.places.find((p) => p.who === 'THEM')?.stance === 'away';
    actors = scene.places.map((p) => {
      const home = p.x ?? st.spots[p.who] ?? 0;
      // Someone who walks in with two bottles hands one over; someone already sitting has their own.
      const bottle = bottles && (p.who === 'THEM' || (p.stance !== 'away' && !awayAtStart));
      return { key: p.who, mode: p.stance, off: home, to: home, home, leaving: false, face: null, bottle, sip: -9, emote: null, hold: '', slump: false };
    });
    begin(0);
  }

  const step = (): Step => scene!.steps[i];
  const lineDone = () => {
    const s = step();
    return s.t !== 'say' || t * TYPE_RATE >= s.text.length;
  };
  const moving = (s: Step): boolean => (s.t === 'enter' || s.t === 'leave' || s.t === 'walk') && s.wait && actorOf(s.who)?.mode === 'walking';
  function advance(): void {
    if (i < scene!.steps.length - 1) begin(i + 1);
    else if (step().t !== 'end' && after === 'none') {
      // The scene is over: to black, then the years between, then the next one.
      after = 'fade';
      afterT = 0;
      box.hidden = true;
      speaking = null;
    }
  }
  /** Space or a click: finish the line being typed, or move on. A pause can be cut short too. */
  function next(): void {
    if (after === 'between') { afterT = 99; return; }
    if (after !== 'none') return;
    const s = step();
    if (s.t === 'end') { t = Math.max(t, withoutTimes.last + 3); return; }
    if (s.t === 'say' && !lineDone()) { t = s.text.length / TYPE_RATE + 0.01; return; }
    if (moving(s)) return;
    advance();
  }

  /** The card between two scenes of a simulated life: how long passed, and how often the two saw each other in it. */
  function between(): { text: string; sub: string } {
    const a = list[si];
    const b = list[si + 1];
    const yrs = ctx.yearOf(b.week) - ctx.yearOf(a.week);
    const num = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
    const text = `${num[yrs] ?? yrs} year${yrs === 1 ? '' : 's'}`;
    const weeks = view().data.arcs.people.find((p) => p.id === a.other)?.seenAt;
    if (!weeks || a.week < 0) return { text, sub: '' };
    const c = weeks.filter((w) => w > a.week && w < b.week).length;
    const name = person('THEM').name;
    return { text, sub: c === 0 ? `You and ${name} do not see each other once.` : `You and ${name} see each other ${c === 1 ? 'once' : `${c} times`}.` };
  }

  // ------------------------------------------------------------------ people

  /** Which way someone looks: where they are walking, where they were told to, at whoever is speaking, or at the nearest person. */
  function facing(a: Actor): Side {
    if (a.mode === 'walking') return a.to >= a.off ? 'right' : 'left';
    if (a.face) return a.face;
    const others = actors.filter((b) => b !== a && b.mode !== 'away');
    const talker = speaking && speaking !== a.key ? others.find((b) => b.key === speaking) : undefined;
    const target = talker ?? others.sort((p, q) => Math.abs(p.off - a.off) - Math.abs(q.off - a.off))[0];
    if (!target) return a.key === youKey() ? 'left' : 'right';
    return target.off >= a.off ? 'right' : 'left';
  }

  /** Draw one person at their place: sitting on the set's edge, or on their feet. */
  function actor(a: Actor, st: Stage): void {
    if (a.mode === 'away') return;
    const p = person(a.key);
    const lk = p.look;
    const s = sizeOf(p);
    const x = st.cx + a.off;
    const left = facing(a) === 'left';
    const k = left ? 0 : 1;
    sg.clearRect(0, 0, 48, 56);
    // In the scratch canvas the hip of someone sitting, or the feet of someone standing, is at (24, 40).
    if (a.mode === 'sitting') {
      const breathe = Math.sin(clock * 0.9 + p.id * 2) > 0.96 ? 1 : 0;
      sg.save();
      sg.beginPath();
      sg.rect(0, 0, 48, 40);
      sg.clip();
      // Slumped: forward and down, head on the desk.
      drawPerson(sg, 24 + (a.slump ? (left ? -3 : 3) : 0), 47 - breathe + (a.slump ? 5 : 0), lk, { pose: 'stand', frame: 0, outfit: 'casual', grey: greyOf(p), flip: left });
      sg.restore();
      if (st.legs > 0) {
        const hang = scene!.set === 'pier' || scene!.set === 'steps';
        const len = Math.round(st.legs / s);
        if (hang) {
          // On an edge, facing out: legs straight down, one of them swinging.
          const swing = Math.sin(clock * 1.3 + k * 1.7) > 0.7 ? 1 : 0;
          const leg = (lx: number, n: number) => {
            sg.fillStyle = lk.pants;
            sg.fillRect(lx, 40, 2, n);
            if (lk.shorts) { sg.fillStyle = lk.skin; sg.fillRect(lx, 42, 2, n - 2); }
            sg.fillStyle = lk.shoes ?? '#15151a';
            sg.fillRect(lx, 40 + n, 3, 1);
          };
          leg(21, len);
          leg(25 + (k ? swing : 0), len - (k ? 0 : swing));
        } else {
          // On a seat, from the side: thighs forward, knees bent, feet on the floor.
          const d = left ? -1 : 1;
          const knee = d > 0 ? 29 : 17;
          const shinOf = (kx: number, dim: boolean) => {
            sg.fillStyle = lk.shorts ? lk.skin : lk.pants;
            sg.fillRect(kx, 40, 2, len);
            sg.fillStyle = lk.shoes ?? '#15151a';
            sg.fillRect(d > 0 ? kx : kx - 1, 40 + len, 3, 1);
            if (dim) { sg.fillStyle = 'rgba(0,0,0,0.3)'; sg.fillRect(kx - 1, 40, 4, len + 1); }
          };
          shinOf(knee - d * 3, true);
          sg.fillStyle = lk.pants;
          sg.fillRect(d > 0 ? 23 : 17, 37, 8, 3);
          shinOf(knee, false);
        }
      }
      if (a.bottle) {
        const up = clock - a.sip >= 0 && clock - a.sip < 1.6;
        sg.fillStyle = '#4f8a63';
        if (up) {
          sg.fillRect(k === 0 ? 19 : 27, 25, 2, 4);
          sg.fillStyle = lk.skin;
          sg.fillRect(k === 0 ? 18 : 28, 29, 2, 2);
        } else {
          const bx = k === 0 ? 16 : 30;
          sg.fillRect(bx, 35, 2, 4);
          sg.fillRect(bx, 33, 1, 2);
        }
      }
      held(a, left, 33);
      g.drawImage(scratch, 0, 0, 48, 56, Math.round(x - 24 * s), Math.round(st.seatY - 40 * s), Math.round(48 * s), Math.round(56 * s));
    } else {
      drawPerson(sg, 24, 40, lk, { pose: a.mode === 'walking' ? 'walk' : 'stand', frame: Math.floor(clock * 6), outfit: 'casual', grey: greyOf(p), flip: left });
      if (a.bottle && a.key === 'THEM') {
        sg.fillStyle = '#4f8a63';
        sg.fillRect(29, 31, 2, 4);
        sg.fillRect(32, 31, 2, 4);
      }
      held(a, left, 27);
      g.drawImage(scratch, 0, 0, 48, 56, Math.round(x - 24 * s), Math.round(st.standY - 40 * s), Math.round(48 * s), Math.round(56 * s));
    }
  }
  /** Something in the front hand, drawn on the scratch canvas at hand height `y`. */
  function held(a: Actor, left: boolean, y: number): void {
    if (!a.hold) return;
    const d = left ? -1 : 1;
    const hx = 24 + d * 7;
    if (a.hold === 'phone') {
      sg.fillStyle = '#15151a';
      sg.fillRect(hx, y - 2, 2, 4);
      sg.fillStyle = Math.floor(clock * 2) % 5 ? '#9fd0e6' : '#cfe9f5';
      sg.fillRect(hx + (d > 0 ? 0 : 1), y - 1, 1, 2);
    } else if (a.hold === 'racket') {
      sg.fillStyle = '#2a2d33';
      sg.fillRect(hx, y - 3, 1, 7);
      sg.fillStyle = '#c44536';
      sg.fillRect(hx - 2, y - 11, 5, 8);
      sg.fillStyle = '#e9e2d2';
      sg.fillRect(hx - 1, y - 10, 3, 6);
    } else if (a.hold === 'cup') {
      sg.fillStyle = '#c44536';
      sg.fillRect(hx, y, 2, 3);
    }
  }
  /** The top of someone's head on the canvas. */
  function headTop(a: Actor, st: Stage): number {
    const p = person(a.key);
    const s = sizeOf(p);
    const hs = p.look.hairStyle;
    const hair = hs === 6 ? 3 : hs === 8 ? 2 : hs === 5 || hs === 7 || hs === 9 ? 1 : 0;
    return Math.round((a.mode === 'sitting' ? st.seatY - 15 * s : st.standY - 22 * s) - (p.look.tall ?? 0) - hair);
  }

  function draw(): void {
    const st = stage();
    const env = { g, W, H, clock, time: scene!.time, props: scene!.props, city: cityNow() };
    drawBack(scene!.set, env, st);
    const late = standInFront(scene!.set);
    for (const a of actors) if (!late || a.mode === 'sitting') actor(a, st);
    drawFront(scene!.set, env, st);
    if (late) for (const a of actors) if (a.mode !== 'sitting') actor(a, st);

    for (const a of actors) {
      if (a.mode === 'away') continue;
      const x = Math.round(st.cx + a.off);
      const top = headTop(a, st);
      // A sign over someone's head: it rises a little and fades.
      if (a.emote) {
        const age = clock - a.emote.t0;
        if (age > a.emote.s) a.emote = null;
        else if (GLYPHS[a.emote.glyph]) {
          const rows = GLYPHS[a.emote.glyph];
          const fade = Math.min(1, age * 4, (a.emote.s - age) * 2);
          const rise = a.emote.glyph === 'z' ? ((age * 5) % 12) : Math.min(3, age * 6);
          const c = `rgba(244,241,222,${0.95 * fade})`;
          drawGlyph(g, a.emote.glyph, x + 4 + (a.emote.glyph === 'z' ? Math.round(rise / 3) : -Math.floor(rows[0].length / 2) - 4), top - rows.length - 3 - Math.round(rise), c);
          if (a.emote.glyph === 'z' && age > 1.1) drawGlyph(g, 'z', x + 9 + Math.round((((age - 1.1) * 5) % 12) / 3), top - 12 - Math.round(((age - 1.1) * 5) % 12), `rgba(244,241,222,${0.6 * fade})`);
        }
      }
      // Breath in the cold.
      if (scene!.props.includes('breath') && a.mode !== 'walking') {
        const ph = (clock * 0.45 + person(a.key).id * 0.31) % 1;
        if (ph < 0.35) {
          const dir = facing(a) === 'left' ? -1 : 1;
          drawGlyph(g, 'puff', x + dir * (5 + Math.round(ph * 12)) - 2, top + 6 - Math.round(ph * 8), `rgba(230,236,244,${0.45 * (1 - ph / 0.35)})`);
        }
      }
    }
    // A small mark over whoever is speaking, so the face in the box has a body in the scene.
    const sp = speaking ? actorOf(speaking) : undefined;
    if (sp && sp.mode !== 'away') {
      const x = Math.round(st.cx + sp.off);
      const top = headTop(sp, st) - 5;
      g.fillStyle = 'rgba(244,241,222,0.85)';
      g.fillRect(x - 2, top, 5, 1);
      g.fillRect(x - 1, top + 1, 3, 1);
      g.fillRect(x, top + 2, 1, 1);
    }
    // Dark at the edges, and in and out of black.
    for (let k = 0; k < 18; k += 2) {
      g.fillStyle = `rgba(4,6,12,${0.3 * (1 - k / 18)})`;
      g.fillRect(k, 0, 2, H);
      g.fillRect(W - k - 2, 0, 2, H);
    }
    if (insert) {
      const age = clock - insert.t0;
      if (age > insert.s) insert = null;
      else drawInsert(g, insert.name, Math.round(W / 2 - INSERT_W / 2), 12, clock, Math.min(1, age * 3, (insert.s - age) * 2), insert.who ? { ...person(insert.who).look, glasses: undefined } : undefined);
    }
    const v = Math.max(1 - shown, veil);
    if (v > 0) {
      g.fillStyle = `rgba(4,6,12,${v})`;
      g.fillRect(0, 0, W, H);
    }
  }

  function frame(dt: number): void {
    if (!on_ || !scene) return;
    t += dt;
    clock += dt;
    // Everyone who is walking keeps walking, whatever the script is doing.
    const speed = film ? 30 : 17;
    for (const a of actors) {
      if (a.mode !== 'walking') continue;
      const dir = a.to >= a.off ? 1 : -1;
      a.off += dir * dt * speed;
      if ((a.to - a.off) * dir <= 0) { a.off = a.to; a.mode = a.leaving ? 'away' : 'standing'; a.leaving = false; }
    }
    if (after === 'fade') {
      afterT += dt;
      veil = Math.min(1, Math.max(veil, afterT / 2.2));
      if (afterT >= 2.2) {
        titleEl.classList.remove('on');
        if (si >= list.length - 1) { leave(); return; }
        if (film) { open(si + 1); return; }
        after = 'between';
        afterT = 0;
        const b = between();
        titleEl.classList.remove('card');
        titleEl.querySelector('.film-title-text')!.textContent = b.text;
        titleEl.querySelector('.film-title-sub')!.textContent = b.sub;
        titleEl.classList.add('on');
      }
    } else if (after === 'between') {
      afterT += dt;
      if (afterT >= 5) {
        titleEl.classList.remove('on');
        open(si + 1);
        return;
      }
    } else {
      const s = step();
      // The picture stays black behind a title card, and comes up once it has gone.
      shown = s.t === 'title' ? 0 : Math.min(1, shown + dt / 2);
      if (s.t === 'card') veil = Math.min(0.86, veil + dt * 0.7);
      else if (s.t !== 'end' && veil > 0) veil = Math.max(0, veil - dt * 0.8);
      if (s.t === 'title' || s.t === 'card') { if (t >= s.hold) advance(); }
      else if (s.t === 'pause') { if (t >= s.s) advance(); }
      else if (s.t === 'enter' || s.t === 'leave' || s.t === 'walk') { if (!moving(s)) advance(); }
      else if (s.t === 'sit' || s.t === 'stand' || s.t === 'give') { if (t >= (film ? 0.7 : 1.2)) advance(); }
      else if (s.t === 'drink' || s.t === 'face' || s.t === 'emote' || s.t === 'hold' || s.t === 'pose' || s.t === 'show') advance();
      else if (s.t === 'say') {
        const n = Math.min(s.text.length, Math.floor(t * TYPE_RATE));
        if (n !== typed) {
          if (n > 0) {
            const voice = s.off ? film?.cast.get(s.who.toUpperCase())?.voice ?? 147 : person(s.as ?? s.who).voice;
            sound.blip(voice, s.text[n - 1], !!s.off);
          }
          typed = n;
          lineEl.textContent = s.text.slice(0, n);
        }
        paintFace();
        // A line stays up long enough to read twice, then the quiet after it.
        const read = s.text.length / TYPE_RATE + Math.max(1.4, s.text.split(' ').length * 0.3) + (s.after ?? 1);
        if (t >= read) advance();
      } else if (s.t === 'end') {
        veil = Math.min(0.92, veil + dt * 0.7);
        withoutLine.classList.toggle('on', t > 1 && t < withoutTimes.last);
        for (const c of without) {
          c.el.classList.toggle('on', t >= c.on);
          c.el.classList.toggle('gone', t >= c.off);
        }
        if (t >= withoutTimes.take && t < withoutTimes.last) withoutLine.textContent = `Take ${person(themKey()).name} away.`;
        endText.classList.toggle('on', t >= withoutTimes.last);
        endActions.classList.toggle('on', t >= withoutTimes.last + 2.5);
      }
    }
    draw();
  }

  root.addEventListener('click', (ev) => {
    sound.unlock();
    if ((ev.target as HTMLElement).closest('button, .film-scrub')) return;
    next();
  });
  function leave(): void {
    sound.quiet();
    on_ = false;
    root.hidden = true;
    titleEl.classList.remove('on');
    on.done();
  }
  root.querySelector('.film-skip')!.addEventListener('click', leave);
  root.querySelector('.back')!.addEventListener('click', leave);
  seeBtn.addEventListener('click', () => { sound.quiet(); on_ = false; root.hidden = true; titleEl.classList.remove('on'); on.without(); });
  root.querySelector('.again')!.addEventListener('click', () => open(0));

  return {
    active: () => on_,
    start(scenes, from = 0, rev = false, cast) {
      if (!scenes.length) return;
      // Starting from a button is a click, which is what lets the browser play sound.
      sound.unlock();
      list = scenes;
      film = cast ?? null;
      review = rev;
      on_ = true;
      root.hidden = false;
      titleEl.classList.remove('on');
      buildScrub();
      open(Math.min(scenes.length - 1, Math.max(0, from)));
    },
    stop() { sound.quiet(); on_ = false; root.hidden = true; },
    frame,
    next() { sound.unlock(); next(); },
    toggleSound() { sound.unlock(); sound.setMuted(!sound.isMuted()); showSound(); },
    jump(lines, scenes) {
      if (!on_ || !scene) return;
      if (scenes) seek(si + scenes, 0);
      else seek(si, i + lines);
    },
    resize: () => { if (on_) resize(); },
  };
}
