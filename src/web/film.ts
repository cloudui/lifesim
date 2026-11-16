// The film: a handful of scenes about two people. One place, dialogue and silence, no narration.
//
// The opposite of a caption. Nothing here says what happened or how anyone feels; a line appears
// with the speaker's face, there is a pause, the other one answers or does not. Pauses are part
// of the script, and the scene keeps moving (water, lights, a drink) while nothing is said.
// Between scenes the years pass as a single card. Scripts are written by hand per life
// (scenes.ts and the files in scenes/).

import { drawSkyline } from './backdrop';
import { drawPerson, hash, lookFor, mix, portrait, type Look } from './pixel';
import type { Mood } from './scenes';
import type { FilmScene, Stance, Step, Who } from './scenes';
import * as sound from './sound';
import type { Ctx } from './types';

export interface FilmPlayer {
  active(): boolean;
  /** Play these scenes in order, starting at `from`. `review` shows the file and line being played. */
  start(scenes: FilmScene[], from?: number, review?: boolean): void;
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
interface Actor { mode: Stance | 'walking' | 'leaving'; x: number; bottle: boolean; sip: number }
/** Where a set puts people: the edge they sit on, the ground they walk on, and how far legs hang. */
interface Stage { seatY: number; standY: number; legs: number; you: number; them: number }

export function createFilm(root: HTMLElement, ctx: Ctx, on: { done(): void; without(): void }): FilmPlayer {
  root.innerHTML = `
    <canvas class="pixel-canvas"></canvas>
    <div class="film-title"><div class="film-title-text"></div><div class="film-title-sub"></div></div>
    <button class="film-skip" type="button" title="Leave the film">Leave ▸▸</button>
    <button class="film-sound" type="button" title="Sound on or off (M)"></button>
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
  /** "Without them": when each card appears and goes, in seconds from the start of the ending. */
  let without: { el: HTMLElement; on: number; off: number }[] = [];
  let withoutTimes = { take: 0, last: 0 };
  let faceCanvas: HTMLCanvasElement | null = null;
  let faceMood: Mood = 'flat';
  let faceId = -1;
  const soundBtn = root.querySelector<HTMLElement>('.film-sound')!;
  const showSound = () => { soundBtn.textContent = sound.isMuted() ? 'Sound: off' : 'Sound: on'; };
  showSound();
  soundBtn.addEventListener('click', () => { sound.unlock(); sound.setMuted(!sound.isMuted()); showSound(); });
  const scratch = document.createElement('canvas');
  scratch.width = 48;
  scratch.height = 56;
  const sg = scratch.getContext('2d')!;

  let W = 320;
  let H = 180;
  let list: FilmScene[] = [];
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
  let you: Actor = { mode: 'sitting', x: 0, bottle: false, sip: -9 };
  let them: Actor = { mode: 'away', x: 0, bottle: false, sip: -9 };
  let speaking: Who | null = null;
  /** 0 to 1: the scene going to black, at the end of a scene or under the last words. */
  let veil = 0;
  /** After the last step of a scene: fading out, then the card for the years between scenes. */
  let after: 'none' | 'fade' | 'between' = 'none';
  let afterT = 0;

  const view = () => ctx.view();
  const egoId = () => view().data.ego.id;
  const idOf = (w: Who) => (w === 'you' ? egoId() : scene!.other);
  const nameOf = (w: Who) => (w === 'you' ? view().data.ego.name : view().people.get(scene!.other)?.name ?? scene!.otherName).split(' ')[0];
  const bornOf = (id: number) => (id === egoId() ? view().data.ego.born : view().people.get(id)?.born ?? 2000);
  const ageOf = (id: number) => ctx.yearOf(scene!.week) - bornOf(id);
  const greyOf = (id: number) => Math.min(1, Math.max(0, (ageOf(id) - 45) / 22));
  /** Children are the same sprites, smaller. */
  const sizeOf = (id: number) => (ageOf(id) < 13 ? 0.72 : ageOf(id) < 16 ? 0.86 : 1);
  const look = (id: number): Look => (scene && id === scene.other && scene.wearing ? { ...lookFor(id), shirt: scene.wearing } : lookFor(id));

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

  function stage(): Stage {
    if (scene!.set === 'steps') {
      const ground = Math.round(H * 0.74);
      const cx = Math.round(W * 0.5);
      return { seatY: ground - 18, standY: ground, legs: 7, you: cx + 9, them: cx - 11 };
    }
    if (scene!.set === 'sofa') {
      const floor = Math.round(H * 0.72);
      const cx = Math.round(W * 0.4);
      return { seatY: floor - 9, standY: floor, legs: 8, you: cx + 11, them: cx - 10 };
    }
    const deck = Math.round(H * 0.66);
    const x = Math.round(W * 0.54);
    return { seatY: deck, standY: deck - 4, legs: 8, you: x, them: x - 19 };
  }

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

  function begin(k: number): void {
    i = k;
    t = 0;
    typed = -1;
    const s = scene!.steps[i];
    const st = stage();
    speaking = s.t === 'say' && s.who !== 'voice' ? s.who : null;
    box.hidden = s.t !== 'say';
    titleEl.classList.toggle('on', s.t === 'title');
    if (s.t === 'title') {
      titleEl.querySelector('.film-title-text')!.textContent = s.text;
      titleEl.querySelector('.film-title-sub')!.textContent = s.sub ?? '';
    } else if (s.t === 'say') {
      const key = s.who === 'voice' ? `voice` : `${s.who}${si}`;
      faceMood = s.mood ?? 'flat';
      if (faceKey !== key) {
        faceKey = key;
        faceCanvas = s.who === 'voice' ? null : faceFor(idOf(s.who));
        faceId = s.who === 'voice' ? -1 : idOf(s.who);
        face.replaceChildren(...(faceCanvas ? [faceCanvas] : []));
      }
      paintFace();
      box.classList.toggle('you', s.who === 'you');
      box.classList.toggle('voice', s.who === 'voice');
      nameEl.textContent = s.who === 'voice' ? `${s.voice} · from inside` : nameOf(s.who);
      lineEl.textContent = '';
    } else if (s.t === 'enter') {
      them.mode = 'walking';
      them.x = -14;
    } else if (s.t === 'sit') { them.mode = 'sitting'; them.x = st.them; }
    else if (s.t === 'give') you.bottle = true;
    else if (s.t === 'drink') (s.who === 'you' ? you : them).sip = clock;
    else if (s.t === 'leave') { const a = s.who === 'you' ? you : them; a.mode = 'leaving'; }
    else if (s.t === 'end') {
      // Without them: the one person and everyone who reached you through them, and then not.
      const d = view().data;
      const name = nameOf('them');
      const ids = d.story.beats.find((x) => x.scene === 'without')?.stage ?? [scene!.other];
      const seen = d.arcs.people.find((p) => p.id === scene!.other)?.seen ?? 0;
      const friends = d.people.filter((p) => !p.kin && p.peak >= d.levels[1]).length;
      const led = Math.max(0, ids.length - 1);
      without = ids.map((id, k) => {
        const el = document.createElement('div');
        el.className = `film-card${k === 0 ? ' main' : ''}`;
        const arc = d.arcs.people.find((p) => p.id === id);
        const label = document.createElement('span');
        label.innerHTML = `<b></b><small></small>`;
        label.querySelector('b')!.textContent = (view().people.get(id)?.name ?? '').split(' ')[0];
        label.querySelector('small')!.textContent = k === 0 ? `seen ${seen.toLocaleString('en-US')} times` : `${arc?.tag ?? ''} · seen ${arc?.seen ?? 0}`;
        el.append(portrait(id, k === 0 ? 5 : 4), label);
        return { el, on: 2.2 + k * 0.5, off: 0 };
      });
      const take = 2.2 + ids.length * 0.5 + 4.5;
      without.forEach((c, k) => { c.off = take + 1.2 + k * 1.3; });
      withoutTimes = { take, last: take + 1.2 + ids.length * 1.3 + 1.5 };
      withoutEl.replaceChildren(...without.map((c) => c.el));
      withoutLine.textContent = led > 0
        ? `${friends} people were your friend at some point. ${led === 1 ? 'One' : led} of them reached you through ${name}.`
        : `${friends} people were your friend at some point. ${name} was one.`;
      withoutLine.className = 'film-without-line';
      endText.textContent = s.text.replace('{seen}', seen.toLocaleString('en-US')).replace('{led}', String(led));
      endText.classList.remove('on');
      endActions.classList.remove('on');
      endEl.hidden = false;
    }
    showReview();
  }

  /** A face for the dialogue box: the same sprite, in what they are wearing, at the age they are. */
  function faceFor(id: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 20;
    c.height = 26;
    c.style.width = '140px';
    c.style.height = '182px';
    c.style.imageRendering = 'pixelated';
    return c;
  }
  /** Redraw the face with its mood: a mouth, brows when sad, and a blink now and then. */
  function paintFace(): void {
    if (!faceCanvas || faceId < 0) return;
    const fg = faceCanvas.getContext('2d')!;
    const lk = look(faceId);
    fg.clearRect(0, 0, 20, 26);
    drawPerson(fg, 10, 25, lk, { pose: 'stand', frame: 0, outfit: 'casual', grey: greyOf(faceId) });
    const dark = mix(lk.skin, '#3a1f1a', 0.6);
    // The sprite's eyes are at (10, 7) and (12, 7); the chin is row 9.
    const blink = (clock + faceId * 0.37) % 4.2 < 0.14;
    if (blink || faceMood === 'shut') {
      fg.fillStyle = lk.skin;
      fg.fillRect(10, 7, 1, 1);
      fg.fillRect(12, 7, 1, 1);
      fg.fillStyle = dark;
      if (faceMood === 'shut') { fg.fillRect(10, 7, 1, 1); fg.fillRect(12, 7, 1, 1); }
    }
    fg.fillStyle = dark;
    if (faceMood === 'smile') {
      fg.fillRect(10, 9, 3, 1);
      fg.fillRect(12, 8, 1, 1);
    } else if (faceMood === 'sad') {
      fg.fillRect(11, 9, 1, 1);
      fg.fillStyle = mix(lk.skin, '#3a1f1a', 0.35);
      fg.fillRect(9, 6, 1, 1);
      fg.fillRect(12, 5, 1, 1);
    } else if (faceMood === 'open') fg.fillRect(11, 8, 2, 2);
    else fg.fillRect(11, 9, 2, 1);
  }

  function open(k: number): void {
    si = k;
    scene = list[si];
    const st = (() => { resize(); return stage(); })();
    clock = 0;
    veil = 0;
    after = 'none';
    faceKey = '';
    sound.ambience(scene.set === 'pier' ? 'water' : scene.set === 'sofa' ? 'room' : 'street');
    endEl.hidden = true;
    const bottles = scene.props.includes('bottles');
    const put = (w: Who, seat: number): Actor => ({ mode: scene!.start[w], x: seat, bottle: bottles && scene!.start[w] !== 'away' || (bottles && w === 'them'), sip: -9 });
    you = put('you', st.you);
    them = put('them', st.them);
    // Someone who walks in with two bottles hands one over; someone already sitting has their own.
    if (bottles && scene.start.them === 'away') you.bottle = false;
    begin(0);
  }

  const step = (): Step => scene!.steps[i];
  const lineDone = () => {
    const s = step();
    return s.t !== 'say' || t * TYPE_RATE >= s.text.length;
  };
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
    if (s.t === 'enter' || s.t === 'leave') return;
    advance();
  }

  /** The card between two scenes: how long passed, and how often the two saw each other in it. */
  function between(): { text: string; sub: string } {
    const a = list[si];
    const b = list[si + 1];
    const yrs = ctx.yearOf(b.week) - ctx.yearOf(a.week);
    const num = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
    const text = `${num[yrs] ?? yrs} year${yrs === 1 ? '' : 's'}`;
    const weeks = view().data.arcs.people.find((p) => p.id === a.other)?.seenAt;
    if (!weeks || a.week < 0) return { text, sub: '' };
    const c = weeks.filter((w) => w > a.week && w < b.week).length;
    const name = nameOf('them');
    return { text, sub: c === 0 ? `You and ${name} do not see each other once.` : `You and ${name} see each other ${c === 1 ? 'once' : `${c} times`}.` };
  }

  // ------------------------------------------------------------------ people

  /** Draw one of the two at their place: sitting on the set's edge, or on their feet. */
  function actor(w: Who, a: Actor, st: Stage): void {
    if (a.mode === 'away') return;
    // Anyone not walking is at their place on the set, wherever the window's size now puts it.
    if (a.mode === 'sitting' || a.mode === 'standing') a.x = st[w];
    const id = idOf(w);
    const lk = look(id);
    const s = sizeOf(id);
    const k = w === 'you' ? 0 : 1;
    sg.clearRect(0, 0, 48, 56);
    // In the scratch canvas the hip of someone sitting, or the feet of someone standing, is at (24, 40).
    if (a.mode === 'sitting') {
      const breathe = Math.sin(clock * 0.9 + k * 2) > 0.96 ? 1 : 0;
      sg.save();
      sg.beginPath();
      sg.rect(0, 0, 48, 40);
      sg.clip();
      drawPerson(sg, 24, 47 - breathe, lk, { pose: 'stand', frame: 0, outfit: 'casual', grey: greyOf(id), flip: k === 0 });
      sg.restore();
      const hang = scene!.set !== 'sofa';
      const swing = hang && Math.sin(clock * 1.3 + k * 1.7) > 0.7 ? 1 : 0;
      const len = Math.round(st.legs / s);
      sg.fillStyle = lk.pants;
      sg.fillRect(21, 40, 2, len);
      sg.fillRect(25 + (k ? swing : 0), 40, 2, len - (k ? 0 : swing));
      sg.fillStyle = '#15151a';
      sg.fillRect(21, 40 + len, 3, 1);
      sg.fillRect(25 + (k ? swing : 0), 40 + len - (k ? 0 : swing), 3, 1);
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
      g.drawImage(scratch, 0, 0, 48, 56, Math.round(a.x - 24 * s), Math.round(st.seatY - 40 * s), Math.round(48 * s), Math.round(56 * s));
    } else {
      const moving = a.mode === 'walking' || a.mode === 'leaving';
      drawPerson(sg, 24, 40, lk, { pose: moving ? 'walk' : 'stand', frame: Math.floor(clock * 6), outfit: 'casual', grey: greyOf(id), flip: a.mode === 'leaving' ? false : k === 0 });
      if (a.bottle && w === 'them' && scene!.start.them === 'away') {
        sg.fillStyle = '#4f8a63';
        sg.fillRect(29, 31, 2, 4);
        sg.fillRect(32, 31, 2, 4);
      }
      g.drawImage(scratch, 0, 0, 48, 56, Math.round(a.x - 24 * s), Math.round(st.standY - 40 * s), Math.round(48 * s), Math.round(56 * s));
    }
  }

  // ------------------------------------------------------------------ sets

  function sky(bands: string[], to: number): void {
    const bh = Math.ceil(to / bands.length);
    bands.forEach((c, k) => { g.fillStyle = c; g.fillRect(0, k * bh, W, bh + 1); });
  }
  function stars(to: number, alpha = 1): void {
    for (let k = 0; k < W / 4; k++) {
      const tw = (hash(k, 3) + Math.floor(clock * 1.5)) % 9 === 0;
      g.fillStyle = `rgba(255,255,255,${(tw ? 0.25 : 0.7) * alpha})`;
      g.fillRect(hash(k, 1) % W, hash(k, 2) % Math.max(1, to), 1, 1);
    }
  }
  const px = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

  function pier(st: Stage, city: number): void {
    const dusk = scene!.time === 'dusk';
    const dy = st.seatY;
    const horizon = Math.round(H * 0.44);
    sky(dusk ? ['#2b2d5b', '#4f4576', '#8f5a7a', '#d98a7a', '#f5b56a'] : ['#060916', '#0a1024', '#101a36', '#182447', '#232c55'], horizon);
    stars(horizon - 26, dusk ? 0.35 : 1);
    const mx = Math.round(W * 0.8);
    const my = Math.round(horizon * (dusk ? 0.78 : 0.3));
    const glow = dusk ? '255,214,150' : '244,241,222';
    g.fillStyle = `rgba(${glow},0.10)`;
    g.beginPath(); g.arc(mx, my, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = dusk ? '#ffd9a0' : '#f4f1de';
    g.beginPath(); g.arc(mx, my, 6, 0, Math.PI * 2); g.fill();
    drawSkyline(g, city, dusk ? '#2a2646' : '#0c1228', dusk ? 0.45 : 0.9, 90, W, horizon + 14);
    // Water, with the lights of the far shore and the moon or the low sun lying on it.
    px(0, horizon, W, H - horizon, dusk ? '#2a2a4c' : '#0a1226');
    for (let x = 0; x < W; x += 3) {
      if (hash(x, 41) % 4) continue;
      const len = 8 + (hash(x, 42) % 26);
      for (let y = 2; y < len; y += 2) {
        const wob = Math.round(Math.sin(clock * 1.6 + y * 0.7 + x) * 1.2);
        g.fillStyle = `rgba(255,214,120,${(dusk ? 0.16 : 0.28) * (1 - y / len)})`;
        g.fillRect(x + wob, horizon + y, 1, 1);
      }
    }
    for (let y = 3; y < H - horizon; y += 3) {
      const wob = Math.round(Math.sin(clock * 1.2 + y * 0.5) * (1 + y * 0.08));
      const w = Math.max(1, 5 - Math.floor(y / 14)) + (hash(y, 7) % 3);
      g.fillStyle = `rgba(${glow},${0.5 * Math.max(0.15, 1 - y / (H - horizon))})`;
      g.fillRect(mx - Math.floor(w / 2) + wob, horizon + y, w, 1);
    }
    g.fillStyle = dusk ? 'rgba(255,200,170,0.10)' : 'rgba(120,150,210,0.10)';
    for (let y = horizon + 5; y < H; y += 6) {
      for (let k = 0; k < 6; k++) {
        const x = (hash(y, k) + Math.floor(clock * (4 + (y % 5)))) % (W + 20) - 10;
        g.fillRect(x, y, 5 + (hash(y, k + 9) % 6), 1);
      }
    }
    // The pier.
    const end = Math.round(W * 0.7);
    for (let x = 14; x < end; x += 38) {
      px(x, dy + 5, 4, H - dy, '#1c1611');
      for (let y = dy + 18; y < H; y += 3) px(x + Math.round(Math.sin(clock * 1.4 + y)), y, 4, 1, dusk ? 'rgba(42,42,76,0.55)' : 'rgba(10,18,38,0.55)');
    }
    px(0, dy - 4, end, 4, dusk ? '#6a4f3a' : '#4a3828');
    px(0, dy - 4, end, 1, dusk ? '#8a6848' : '#5c4631');
    for (let x = 6; x < end; x += 9) px(x, dy - 4, 1, 4, '#3a2b1f');
    px(0, dy, end, 5, '#2c2118');
    px(0, dy + 4, end, 1, '#211811');
    // A lamp, and the pool of light under it.
    const lx = Math.round(W * 0.2);
    px(lx, dy - 44, 2, 40, '#15171f');
    px(lx - 3, dy - 46, 8, 2, '#15171f');
    const flick = 0.9 + Math.sin(clock * 7) * 0.03;
    for (let r = 26; r > 2; r -= 4) {
      g.fillStyle = `rgba(255,196,110,${(dusk ? 0.02 : 0.035) * flick})`;
      g.beginPath(); g.arc(lx + 1, dy - 42, r, 0, Math.PI * 2); g.fill();
    }
    px(lx - 1, dy - 44, 4, 2, '#ffd9a0');
    px(lx - 22, dy - 4, 46, 4, 'rgba(255,196,110,0.10)');
  }

  /** The front of the house you grew up in: a garage door, three steps and a lit doorway. */
  function steps(st: Stage, city: number): void {
    const morning = scene!.time === 'morning';
    const ground = st.standY;
    const cx = Math.round(W * 0.5);
    sky(morning ? ['#3f8fd8', '#5aa6e6', '#7fbdf0', '#a8d4f6', '#d4ebfb'] : ['#2b2d5b', '#5b4a7a', '#b5657a', '#f0a07a', '#ffd9a0'], ground);
    if (!morning) stars(Math.round(ground * 0.3), 0.5);
    drawSkyline(g, city, morning ? '#8fb0cf' : '#4a3a5e', morning ? 0 : 0.35, 300, W, ground - 6);
    const tint = (c: string) => (morning ? c : mix(c, '#3a2a4a', 0.42));
    // The house.
    const hx = cx - 92;
    const hw = 150;
    const top = ground - 86;
    px(hx, top, hw, 86, tint('#d9c7a8'));
    px(hx - 4, top - 6, hw + 8, 7, tint('#7a4a3a'));
    for (let y = top + 9; y < ground - 2; y += 6) px(hx, y, hw, 1, tint('#cdb999'));
    // Garage door, with years of football on it.
    px(hx + 8, ground - 46, 62, 46, tint('#b9b0a0'));
    for (let y = ground - 46; y < ground; y += 9) px(hx + 8, y, 62, 1, tint('#9c9484'));
    for (let k = 0; k < 9; k++) px(hx + 12 + (hash(k, 71) % 54), ground - 40 + (hash(k, 72) % 34), 2, 2, tint('#8a8274'));
    // A window, and the door at the top of the steps, lit from inside in the evening.
    const lit = morning ? '#bfe3f2' : '#ffd98a';
    px(hx + 82, top + 12, 20, 16, tint('#6b4a3a'));
    px(hx + 84, top + 14, 16, 12, lit);
    px(cx - 6, st.seatY - 34, 20, 34, tint('#5b4028'));
    px(cx - 3, st.seatY - 31, 14, 12, lit);
    if (!morning) {
      g.fillStyle = 'rgba(255,217,138,0.10)';
      g.fillRect(cx - 22, st.seatY - 4, 52, 6);
    }
    // Three steps.
    for (let k = 0; k < 3; k++) {
      const w = 56 + k * 8;
      px(cx + 4 - w / 2, st.seatY + k * 6, w, 6, tint(k % 2 ? '#a89c8c' : '#b8ad9c'));
      px(cx + 4 - w / 2, st.seatY + k * 6, w, 1, tint('#d0c6b6'));
    }
    // The pavement and the road.
    px(0, ground, W, 4, tint('#b9b6b0'));
    px(0, ground + 4, W, H - ground, tint('#6c6f72'));
    for (let x = -((Math.floor(clock * 0)) % 30); x < W; x += 30) px(x, ground + 22, 14, 1, tint('#c9c6b8'));
    if (scene!.props.includes('ball')) {
      px(st.them - 16, st.seatY - 5, 5, 5, '#f4f4f4');
      px(st.them - 15, st.seatY - 4, 2, 2, '#2a2a2a');
    }
    if (scene!.props.includes('boxes')) {
      const bx = cx + 52;
      for (const [dx, dy2, w, h] of [[0, 0, 16, 12], [18, 0, 14, 10], [4, 12, 14, 10], [-46 - 52, 0, 15, 11]] as const) {
        px(bx + dx, ground - dy2 - h, w, h, tint('#b58a55'));
        px(bx + dx, ground - dy2 - h, w, 1, tint('#d0a870'));
        px(bx + dx + w / 2 - 1, ground - dy2 - h, 2, h, tint('#9a7040'));
      }
    }
  }

  /** A small flat at night: the city in the window, one lamp, and a sofa that was free. */
  function sofa(st: Stage, city: number): void {
    const floor = st.standY;
    const cx = Math.round(W * 0.4);
    px(0, 0, W, floor, '#272231');
    for (let x = 0; x < W; x += 16) px(x, 0, 1, floor, '#2c2637');
    px(0, floor, W, H - floor, '#19151d');
    for (let x = 4; x < W; x += 20) px(x, floor, 1, H - floor, '#211c26');
    px(0, floor, W, 2, '#3a3145');
    // The window.
    const wx = Math.round(W * 0.56);
    const wy = Math.round(H * 0.1);
    const ww = Math.round(W * 0.32);
    const wh = Math.round(H * 0.4);
    g.save();
    g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
    px(wx, wy, ww, wh, '#0a1024');
    stars(wy + wh * 0.5);
    drawSkyline(g, city, '#0c1228', 0.95, 40, W, wy + wh + 14);
    g.restore();
    for (const [x, y, w, h] of [[wx - 2, wy - 2, ww + 4, 2], [wx - 2, wy + wh, ww + 4, 3], [wx - 2, wy, 2, wh], [wx + ww, wy, 2, wh], [wx + ww / 2, wy, 2, wh]] as const) px(x, y, w, h, '#4a3d52');
    // A floor lamp and its pool of light.
    const lx = cx - 52;
    px(lx, floor - 46, 2, 46, '#15131a');
    px(lx - 5, floor - 54, 12, 9, '#e9c98a');
    const flick = 0.92 + Math.sin(clock * 5) * 0.02;
    for (let r = 44; r > 6; r -= 6) {
      g.fillStyle = `rgba(255,205,130,${0.03 * flick})`;
      g.beginPath(); g.arc(lx + 1, floor - 46, r, 0, Math.PI * 2); g.fill();
    }
    // A rug, and the sofa's back and arms. The seat goes on after the people.
    px(cx - 50, floor + 5, 104, 8, '#3d2f3f');
    px(cx - 50, floor + 5, 104, 1, '#55415a');
    px(cx - 38, st.seatY - 20, 78, 22, '#5d4a6e');
    px(cx - 38, st.seatY - 20, 78, 2, '#75608a');
    px(cx - 44, st.seatY - 10, 8, 19, '#52405f');
    px(cx + 38, st.seatY - 10, 8, 19, '#52405f');
  }
  function sofaFront(st: Stage): void {
    const cx = Math.round(W * 0.4);
    px(cx - 36, st.seatY, 74, 5, '#6b567c');
    px(cx - 36, st.seatY, 74, 1, '#8a72a0');
    px(cx - 36, st.seatY + 5, 74, 3, '#473652');
  }

  function draw(): void {
    const st = stage();
    const city = ctx.cityAt(view().data.ego.cities, Math.max(0, scene!.week));
    if (scene!.set === 'steps') steps(st, city);
    else if (scene!.set === 'sofa') sofa(st, city);
    else pier(st, city);
    if (scene!.set === 'sofa') sofaFront(st);
    actor('them', them, st);
    actor('you', you, st);

    // A small mark over whoever is speaking, so the face in the box has a body in the scene.
    if (speaking) {
      const a = speaking === 'you' ? you : them;
      const s = sizeOf(idOf(speaking));
      const top = Math.round((a.mode === 'sitting' ? st.seatY - 23 * s : st.standY - 30 * s) - 6);
      g.fillStyle = 'rgba(244,241,222,0.85)';
      g.fillRect(Math.round(a.x) - 2, top, 5, 1);
      g.fillRect(Math.round(a.x) - 1, top + 1, 3, 1);
      g.fillRect(Math.round(a.x), top + 2, 1, 1);
    }
    // Dark at the edges, and in and out of black.
    for (let k = 0; k < 18; k += 2) {
      g.fillStyle = `rgba(4,6,12,${0.3 * (1 - k / 18)})`;
      g.fillRect(k, 0, 2, H);
      g.fillRect(W - k - 2, 0, 2, H);
    }
    const v = Math.max(clock < 2.5 ? 1 - clock / 2.5 : 0, veil);
    if (v > 0) {
      g.fillStyle = `rgba(4,6,12,${v})`;
      g.fillRect(0, 0, W, H);
    }
  }

  function frame(dt: number): void {
    if (!on_ || !scene) return;
    t += dt;
    clock += dt;
    const st = stage();
    if (after === 'fade') {
      afterT += dt;
      veil = Math.min(1, afterT / 2.2);
      if (veil >= 1) {
        if (si >= list.length - 1) { leave(); return; }
        after = 'between';
        afterT = 0;
        const b = between();
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
      if (s.t === 'title') { if (t >= s.hold) advance(); }
      else if (s.t === 'pause') { if (t >= s.s) advance(); }
      else if (s.t === 'enter') {
        them.x += dt * 16;
        if (them.x >= st.them) { them.x = st.them; them.mode = 'standing'; advance(); }
      } else if (s.t === 'leave') {
        const a = s.who === 'you' ? you : them;
        a.x += dt * 18;
        if (a.x > W + 16) { a.mode = 'away'; advance(); }
      } else if (s.t === 'sit' || s.t === 'give') { if (t >= 1.2) advance(); }
      else if (s.t === 'drink') advance();
      else if (s.t === 'say') {
        const n = Math.min(s.text.length, Math.floor(t * TYPE_RATE));
        if (n !== typed) {
          if (n > 0) sound.blip(s.who === 'you' ? 0 : s.who === 'them' ? 1 : 2, s.text[n - 1]);
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
        if (t >= withoutTimes.take && t < withoutTimes.last) withoutLine.textContent = `Take ${nameOf('them')} away.`;
        endText.classList.toggle('on', t >= withoutTimes.last);
        endActions.classList.toggle('on', t >= withoutTimes.last + 2.5);
      }
    }
    draw();
  }

  root.addEventListener('click', (ev) => {
    sound.unlock();
    if ((ev.target as HTMLElement).closest('button')) return;
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
  root.querySelector('.see')!.addEventListener('click', () => { sound.quiet(); on_ = false; root.hidden = true; titleEl.classList.remove('on'); on.without(); });
  root.querySelector('.again')!.addEventListener('click', () => open(0));

  return {
    active: () => on_,
    start(scenes, from = 0, rev = false) {
      if (!scenes.length) return;
      // Starting from a button is a click, which is what lets the browser play sound.
      sound.unlock();
      list = scenes;
      review = rev;
      on_ = true;
      root.hidden = false;
      titleEl.classList.remove('on');
      open(Math.min(scenes.length - 1, Math.max(0, from)));
    },
    stop() { sound.quiet(); on_ = false; root.hidden = true; },
    frame,
    next() { sound.unlock(); next(); },
    toggleSound() { sound.unlock(); sound.setMuted(!sound.isMuted()); showSound(); },
    jump(lines, scenes) {
      if (!on_ || !scene) return;
      titleEl.classList.remove('on');
      if (scenes) open(Math.min(list.length - 1, Math.max(0, si + scenes)));
      else {
        // Going to a line: put everyone where the script would have them by then.
        const target = Math.min(scene.steps.length - 1, Math.max(0, i + lines));
        open(si);
        clock = 3;
        for (let k = 0; k < target; k++) {
          const s = scene.steps[k];
          const st = stage();
          if (s.t === 'enter' || s.t === 'sit') { them.mode = s.t === 'enter' ? 'standing' : 'sitting'; them.x = st.them; }
          else if (s.t === 'give') you.bottle = true;
          else if (s.t === 'leave') (s.who === 'you' ? you : them).mode = 'away';
        }
        begin(target);
      }
    },
    resize: () => { if (on_) resize(); },
  };
}
