// A film scene: two people, one place, dialogue and silence. No narration.
//
// The opposite of a caption. Nothing here says what happened or how anyone feels; a line appears
// with the speaker's face, there is a pause, the other one answers or does not. Pauses are part
// of the script, and the scene keeps moving (water, lights, a drink) while nothing is said.
// Scripts are written by hand per life (scenes.ts).

import { drawSkyline } from './backdrop';
import { drawPerson, hash, lookFor, type Look } from './pixel';
import type { FilmScene, Step, Who } from './scenes';
import type { Ctx } from './types';

export interface FilmPlayer {
  active(): boolean;
  start(scene: FilmScene): void;
  stop(): void;
  frame(dt: number): void;
  next(): void;
  resize(): void;
}

/** Characters of dialogue typed per second. Slower than reading speed on purpose. */
const TYPE_RATE = 24;

export function createFilm(root: HTMLElement, ctx: Ctx, on: { done(): void }): FilmPlayer {
  root.innerHTML = `
    <canvas class="pixel-canvas"></canvas>
    <div class="film-title"><div class="film-title-text"></div><div class="film-title-sub"></div></div>
    <button class="film-skip" type="button" title="Leave the scene">Leave ▸▸</button>
    <div class="film-hint">it plays by itself · space or click to go sooner</div>
    <div class="film-box" hidden>
      <div class="film-face"></div>
      <div class="film-words"><div class="film-name"></div><div class="film-line"></div></div>
    </div>
    <div class="film-end" hidden>
      <div class="film-end-text"></div>
      <div class="film-actions">
        <button class="again" type="button">↺ Watch again</button>
        <button class="back big" type="button">Back ▶</button>
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

  let W = 320;
  let H = 180;
  let scene: FilmScene | null = null;
  let on_ = false;
  let i = 0;
  /** Seconds into the current step, and into the whole scene. */
  let t = 0;
  let clock = 0;
  let typed = -1;
  let faceOf: Who | null = null;
  // What the other person is doing, and who holds a bottle.
  let them: 'away' | 'walking' | 'standing' | 'sitting' = 'away';
  let themX = -20;
  let bottle = { you: false, them: true };
  let drinking: { you: number; them: number } = { you: -9, them: -9 };
  let speaking: Who | null = null;
  let fadeOut = 0;

  const egoId = () => ctx.view().data.ego.id;
  const look = (id: number): Look => (scene && id === scene.other && scene.wearing ? { ...lookFor(id), shirt: scene.wearing } : lookFor(id));
  /** A face for the dialogue box: the same sprite, in what they are wearing tonight, at their age. */
  const faceFor = (id: number): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = 20;
    c.height = 26;
    c.style.width = '140px';
    c.style.height = '182px';
    c.style.imageRendering = 'pixelated';
    drawPerson(c.getContext('2d')!, 10, 25, look(id), { pose: 'stand', frame: 0, outfit: 'casual', grey: greyOf(id) });
    return c;
  };
  const idOf = (w: Who) => (w === 'you' ? egoId() : scene!.other);
  const nameOf = (w: Who) => (w === 'you' ? ctx.view().data.ego.name : ctx.view().people.get(scene!.other)?.name ?? scene!.otherName).split(' ')[0];
  const greyOf = (id: number): number => {
    const born = id === egoId() ? ctx.view().data.ego.born : ctx.view().people.get(id)?.born;
    return born === undefined ? 0 : Math.min(1, Math.max(0, (ctx.yearOf(scene!.week) - born - 45) / 22));
  };

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

  // Where things are. The pier comes in from the left; the two sit on its near edge, facing us.
  const deckY = () => Math.round(H * 0.66);
  const youX = () => Math.round(W * 0.54);
  const seatX = () => youX() - 19;

  function begin(k: number): void {
    i = k;
    t = 0;
    typed = -1;
    const s = scene!.steps[i];
    speaking = s.t === 'say' ? s.who : null;
    box.hidden = s.t !== 'say';
    titleEl.classList.toggle('on', s.t === 'title');
    if (s.t === 'title') {
      titleEl.querySelector('.film-title-text')!.textContent = s.text;
      titleEl.querySelector('.film-title-sub')!.textContent = s.sub ?? '';
    } else if (s.t === 'say') {
      if (faceOf !== s.who) {
        faceOf = s.who;
        face.replaceChildren(faceFor(idOf(s.who)));
      }
      box.classList.toggle('you', s.who === 'you');
      nameEl.textContent = nameOf(s.who);
      lineEl.textContent = '';
    } else if (s.t === 'enter') {
      them = 'walking';
      themX = -14;
    } else if (s.t === 'sit') them = 'sitting';
    else if (s.t === 'give') bottle.you = true;
    else if (s.t === 'drink') drinking[s.who] = clock;
    else if (s.t === 'end') {
      const seen = ctx.view().data.arcs.people.find((p) => p.id === scene!.other)?.seen ?? 0;
      endEl.querySelector('.film-end-text')!.textContent = s.text.replace('{seen}', seen.toLocaleString('en-US'));
      endEl.hidden = false;
    }
  }

  const step = (): Step => scene!.steps[i];
  const lineDone = () => {
    const s = step();
    return s.t !== 'say' || t * TYPE_RATE >= s.text.length;
  };
  function advance(): void {
    if (i < scene!.steps.length - 1) begin(i + 1);
  }
  /** Space or a click: finish the line being typed, or move on. A pause can be cut short too. */
  function next(): void {
    const s = step();
    if (s.t === 'end') return;
    if (s.t === 'say' && !lineDone()) { t = s.text.length / TYPE_RATE + 0.01; return; }
    if (s.t === 'enter') return;
    advance();
  }

  // ------------------------------------------------------------------ drawing

  function seated(id: number, x: number, hasBottle: boolean, sipAt: number, k: number): void {
    const dy = deckY();
    const lk = look(id);
    const breathe = Math.sin(clock * 0.9 + k * 2) > 0.96 ? 1 : 0;
    // The upper body, down to the hip, which rests on the edge of the deck.
    g.save();
    g.beginPath();
    g.rect(x - 12, 0, 24, dy);
    g.clip();
    drawPerson(g, x, dy + 7 - breathe, lk, { pose: 'stand', frame: 0, outfit: 'casual', grey: greyOf(id), flip: k === 0 });
    g.restore();
    // Legs over the edge, one of them swinging now and then.
    const swing = Math.sin(clock * 1.3 + k * 1.7) > 0.7 ? 1 : 0;
    g.fillStyle = lk.pants;
    g.fillRect(x - 3, dy, 2, 8);
    g.fillRect(x + 1 + (k ? swing : 0), dy, 2, 8 - (k ? 0 : swing));
    g.fillStyle = '#15151a';
    g.fillRect(x - 3, dy + 8, 3, 1);
    g.fillRect(x + 1 + (k ? swing : 0), dy + 8 - (k ? 0 : swing), 3, 1);
    if (hasBottle) {
      const sip = clock - sipAt;
      const up = sip >= 0 && sip < 1.6;
      const bx = k === 0 ? x - 8 : x + 6;
      g.fillStyle = '#4f8a63';
      if (up) {
        g.fillRect(k === 0 ? x - 5 : x + 3, dy - 15, 2, 4);
        g.fillStyle = lk.skin;
        g.fillRect(k === 0 ? x - 6 : x + 4, dy - 11, 2, 2);
      } else {
        g.fillRect(bx, dy - 5, 2, 4);
        g.fillRect(bx, dy - 7, 1, 2);
      }
    }
  }

  function draw(): void {
    const dy = deckY();
    const horizon = Math.round(H * 0.44);
    const city = ctx.cityAt(ctx.view().data.ego.cities, scene!.week);
    // Sky.
    const bands = ['#060916', '#0a1024', '#101a36', '#182447', '#232c55'];
    const bh = Math.ceil(horizon / bands.length);
    bands.forEach((c, k) => { g.fillStyle = c; g.fillRect(0, k * bh, W, bh + 1); });
    for (let k = 0; k < W / 4; k++) {
      const tw = (hash(k, 3) + Math.floor(clock * 1.5)) % 9 === 0;
      g.fillStyle = tw ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)';
      g.fillRect(hash(k, 1) % W, hash(k, 2) % Math.max(1, horizon - 26), 1, 1);
    }
    const mx = Math.round(W * 0.8);
    const my = Math.round(horizon * 0.3);
    g.fillStyle = 'rgba(244,241,222,0.08)';
    g.beginPath(); g.arc(mx, my, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f4f1de';
    g.beginPath(); g.arc(mx, my, 6, 0, Math.PI * 2); g.fill();
    // The far shore.
    drawSkyline(g, city, '#0c1228', 0.9, 90, W, horizon + 14);
    // Water, with the lights of the far shore and the moon lying on it.
    g.fillStyle = '#0a1226';
    g.fillRect(0, horizon, W, H - horizon);
    for (let x = 0; x < W; x += 3) {
      if (hash(x, 41) % 4) continue;
      const len = 8 + (hash(x, 42) % 26);
      for (let y = 2; y < len; y += 2) {
        const wob = Math.round(Math.sin(clock * 1.6 + y * 0.7 + x) * 1.2);
        g.fillStyle = `rgba(255,214,120,${0.28 * (1 - y / len)})`;
        g.fillRect(x + wob, horizon + y, 1, 1);
      }
    }
    for (let y = 3; y < H - horizon; y += 3) {
      const wob = Math.round(Math.sin(clock * 1.2 + y * 0.5) * (1 + y * 0.08));
      const w = Math.max(1, 5 - Math.floor(y / 14)) + (hash(y, 7) % 3);
      g.fillStyle = `rgba(244,241,222,${0.5 * Math.max(0.15, 1 - y / (H - horizon))})`;
      g.fillRect(mx - Math.floor(w / 2) + wob, horizon + y, w, 1);
    }
    g.fillStyle = 'rgba(120,150,210,0.10)';
    for (let y = horizon + 5; y < H; y += 6) {
      for (let k = 0; k < 6; k++) {
        const x = (hash(y, k) + Math.floor(clock * (4 + (y % 5)))) % (W + 20) - 10;
        g.fillRect(x, y, 5 + (hash(y, k + 9) % 6), 1);
      }
    }
    // The pier.
    const end = Math.round(W * 0.7);
    for (let x = 14; x < end; x += 38) {
      g.fillStyle = '#1c1611';
      g.fillRect(x, dy + 5, 4, H - dy);
      for (let y = dy + 18; y < H; y += 3) {
        g.fillStyle = 'rgba(10,18,38,0.55)';
        g.fillRect(x + Math.round(Math.sin(clock * 1.4 + y) * 1), y, 4, 1);
      }
    }
    g.fillStyle = '#4a3828';
    g.fillRect(0, dy - 4, end, 4);
    g.fillStyle = '#5c4631';
    g.fillRect(0, dy - 4, end, 1);
    g.fillStyle = '#3a2b1f';
    for (let x = 6; x < end; x += 9) g.fillRect(x, dy - 4, 1, 4);
    g.fillStyle = '#2c2118';
    g.fillRect(0, dy, end, 5);
    g.fillStyle = '#211811';
    g.fillRect(0, dy + 4, end, 1);
    // A lamp, and the pool of light under it.
    const lx = Math.round(W * 0.2);
    g.fillStyle = '#15171f';
    g.fillRect(lx, dy - 44, 2, 40);
    g.fillRect(lx - 3, dy - 46, 8, 2);
    const flick = 0.9 + Math.sin(clock * 7) * 0.03;
    for (let r = 26; r > 2; r -= 4) {
      g.fillStyle = `rgba(255,196,110,${0.035 * flick})`;
      g.beginPath(); g.arc(lx + 1, dy - 42, r, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#ffd9a0';
    g.fillRect(lx - 1, dy - 44, 4, 2);
    g.fillStyle = 'rgba(255,196,110,0.10)';
    g.fillRect(lx - 22, dy - 4, 46, 4);

    // The two of them.
    if (them === 'walking' || them === 'standing') {
      drawPerson(g, themX, dy - 4, look(scene!.other), { pose: them === 'walking' ? 'walk' : 'stand', frame: Math.floor(clock * 6), outfit: 'casual', grey: greyOf(scene!.other) });
      g.fillStyle = '#4f8a63';
      g.fillRect(Math.round(themX) + 5, dy - 13, 2, 4);
      g.fillRect(Math.round(themX) + 8, dy - 13, 2, 4);
    } else if (them === 'sitting') seated(scene!.other, seatX(), bottle.them, drinking.them, 1);
    seated(egoId(), youX(), bottle.you, drinking.you, 0);

    // A small mark over whoever is speaking, so the face in the box has a body in the scene.
    if (speaking) {
      const sx = speaking === 'you' ? youX() : them === 'sitting' ? seatX() : Math.round(themX);
      const top = (speaking === 'them' && them !== 'sitting' ? dy - 4 : dy + 7) - 30;
      g.fillStyle = 'rgba(244,241,222,0.85)';
      g.fillRect(sx - 2, top, 5, 1);
      g.fillRect(sx - 1, top + 1, 3, 1);
      g.fillRect(sx, top + 2, 1, 1);
    }
    // Dark at the edges, and in and out of black.
    for (let k = 0; k < 18; k += 2) {
      g.fillStyle = `rgba(4,6,12,${0.3 * (1 - k / 18)})`;
      g.fillRect(k, 0, 2, H);
      g.fillRect(W - k - 2, 0, 2, H);
    }
    const veil = Math.max(clock < 2.5 ? 1 - clock / 2.5 : 0, fadeOut);
    if (veil > 0) {
      g.fillStyle = `rgba(4,6,12,${veil})`;
      g.fillRect(0, 0, W, H);
    }
  }

  function frame(dt: number): void {
    if (!on_ || !scene) return;
    t += dt;
    clock += dt;
    const s = step();
    if (s.t === 'title') { if (t >= s.hold) advance(); }
    else if (s.t === 'pause') { if (t >= s.s) advance(); }
    else if (s.t === 'enter') {
      themX += dt * 16;
      if (themX >= seatX()) { themX = seatX(); them = 'standing'; advance(); }
    } else if (s.t === 'sit' || s.t === 'give') { if (t >= 1.2) advance(); }
    else if (s.t === 'drink') advance();
    else if (s.t === 'say') {
      const n = Math.min(s.text.length, Math.floor(t * TYPE_RATE));
      if (n !== typed) { typed = n; lineEl.textContent = s.text.slice(0, n); }
      // A line stays up long enough to read twice, then the quiet after it.
      const read = s.text.length / TYPE_RATE + Math.max(1.4, s.text.split(' ').length * 0.3) + (s.after ?? 1);
      if (t >= read) advance();
    } else if (s.t === 'end') fadeOut = Math.min(0.82, fadeOut + dt * 0.4);
    draw();
  }

  root.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement).closest('button')) return;
    next();
  });
  const leave = () => { on_ = false; root.hidden = true; on.done(); };
  root.querySelector('.film-skip')!.addEventListener('click', leave);
  root.querySelector('.back')!.addEventListener('click', leave);
  root.querySelector('.again')!.addEventListener('click', () => { if (scene) start(scene); });

  function start(sc: FilmScene): void {
    scene = sc;
    on_ = true;
    root.hidden = false;
    endEl.hidden = true;
    resize();
    clock = 0;
    fadeOut = 0;
    faceOf = null;
    them = 'away';
    themX = -20;
    bottle = { you: false, them: true };
    drinking = { you: -9, them: -9 };
    begin(0);
  }

  return {
    active: () => on_,
    start,
    stop() { on_ = false; root.hidden = true; },
    frame,
    next,
    resize: () => { if (on_) resize(); },
  };
}
