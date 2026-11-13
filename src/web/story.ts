// The Story: the life cut down to a dozen or so beats, played as short pixel scenes with a
// caption under each. It is what opens when you press Begin; the tabs are for exploring after.
// Each beat is staged with one of a few reusable scene templates (the family table, a meeting
// outside a venue, a move, a goodbye, a fact card), chosen by `beat.scene`.

import type { StoryBeat } from '../sim/story';
import { drawSkyline, drawVenue, mixRgb, skyAt } from './backdrop';
import { drawGlyph, drawPerson, hash, lookFor, type Pose } from './pixel';
import type { Ctx } from './types';

export interface StoryPlayer {
  /** Whether the story is on screen. */
  active(): boolean;
  start(beat?: number): void;
  stop(): void;
  frame(dt: number): void;
  next(): void;
  prev(): void;
  resize(): void;
  /** Show one friend under a name the viewer typed. An empty string undoes it. */
  rename(name: string): void;
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; glyph?: string; color: string }

/** Characters of caption typed per second. */
const TYPE_RATE = 55;

export function createStory(
  root: HTMLElement,
  ctx: Ctx,
  on: { explore(): void; another(): void; beat(week: number): void },
): StoryPlayer {
  root.innerHTML = `
    <canvas class="pixel-canvas"></canvas>
    <div class="story-pips"></div>
    <button class="story-skip" type="button" title="Leave the story and explore the whole life">Explore ▸▸</button>
    <div class="story-caption">
      <div class="story-title"></div>
      <div class="story-text"></div>
      <div class="story-hint">space or click to go on · ← back</div>
      <div class="story-actions" hidden>
        <button class="again" type="button">↺ Watch again</button>
        <button class="explore big" type="button">Explore this life ▶</button>
        <button class="another" type="button">Another life</button>
      </div>
    </div>`;
  const canvas = root.querySelector('canvas')!;
  const g = canvas.getContext('2d')!;
  const pips = root.querySelector<HTMLElement>('.story-pips')!;
  const caption = root.querySelector<HTMLElement>('.story-caption')!;
  const titleEl = root.querySelector<HTMLElement>('.story-title')!;
  const textEl = root.querySelector<HTMLElement>('.story-text')!;
  const actions = root.querySelector<HTMLElement>('.story-actions')!;
  const hint = root.querySelector<HTMLElement>('.story-hint')!;

  let W = 320;
  let H = 180;
  let GROUND = 120;
  let on_ = false;
  let idx = 0;
  let t = 0;
  let clock = 0;
  let shown = -1;
  let typed = -1;
  let particles: Particle[] = [];
  let alias = '';

  const beats = (): StoryBeat[] => ctx.view().data.story.beats;
  /** A typed name replaces the person the story is about. */
  const sub = (s: string): string => {
    if (!alias) return s;
    const story = ctx.view().data.story;
    const lead = story.leads[0];
    if (!lead) return s;
    const first = lead.name.split(' ')[0];
    return s.split(lead.name).join(alias).replace(new RegExp(`\\b${first}\\b`, 'g'), alias);
  };

  function resize(): void {
    const cw = root.clientWidth || window.innerWidth;
    const ch = root.clientHeight || window.innerHeight;
    const scale = Math.max(2, Math.round(Math.min(ch / 190, cw / 230)));
    W = Math.ceil(cw / scale);
    H = Math.ceil(ch / scale);
    GROUND = Math.round(H * 0.6);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${H * scale}px`;
    g.imageSmoothingEnabled = false;
  }

  function show(i: number): void {
    const list = beats();
    idx = Math.min(list.length - 1, Math.max(0, i));
    t = 0;
    typed = -1;
    particles = [];
    const b = list[idx];
    on.beat(Math.min(b.week, ctx.view().totalWeeks));
    if (shown !== idx || pips.childElementCount !== list.length) {
      pips.replaceChildren(...list.map((x, k) => {
        const p = document.createElement('i');
        p.className = `${x.kind}${k < idx ? ' past' : k === idx ? ' now' : ''}`;
        p.addEventListener('click', (ev) => { ev.stopPropagation(); show(k); });
        return p;
      }));
    }
    shown = idx;
    const end = b.scene === 'end';
    caption.className = `story-caption ${b.kind}${b.scene === 'fact' ? ' card' : ''}${end ? ' end' : ''}`;
    const plain = b.scene === 'fact' || b.scene === 'without' || b.scene === 'gap' || b.scene === 'early' || end;
    titleEl.textContent = plain ? sub(b.title) : `${sub(b.title)} · age ${b.age}`;
    textEl.textContent = '';
    actions.hidden = true;
    hint.hidden = end;
  }

  const fullText = () => sub(beats()[idx].text);
  const typingDone = () => t * TYPE_RATE >= fullText().length;

  function next(): void {
    if (!typingDone()) { t = fullText().length / TYPE_RATE + 0.01; return; }
    if (idx < beats().length - 1) show(idx + 1);
  }
  function prev(): void {
    show(idx - 1);
  }

  // ------------------------------------------------------------------ drawing

  const greyOf = (id: number, year: number): number => {
    const born = id === ctx.view().data.ego.id ? ctx.view().data.ego.born : ctx.view().people.get(id)?.born;
    return born === undefined ? 0 : Math.min(1, Math.max(0, (year - born - 45) / 22));
  };
  // Children are the same sprites drawn smaller, by way of a scratch canvas.
  const scratch = document.createElement('canvas');
  scratch.width = 40;
  scratch.height = 44;
  const sg = scratch.getContext('2d')!;
  let small = false;
  function person(id: number, x: number, y: number, pose: Pose, year: number, o: { flip?: boolean; alpha?: number; frame?: number } = {}): void {
    const opt = { pose, frame: o.frame ?? Math.floor(clock * 7), outfit: 'casual' as const, grey: greyOf(id, year), flip: o.flip, alpha: o.alpha };
    if (!small) { drawPerson(g, x, y, lookFor(id), opt); return; }
    sg.clearRect(0, 0, 40, 44);
    drawPerson(sg, 20, 42, lookFor(id), opt);
    g.drawImage(scratch, 0, 0, 40, 44, Math.round(x - 15), Math.round(y - 31.5), 30, 33);
  }
  function burst(x: number, y: number, n: number, glyph: string | undefined, colors: string[]): void {
    for (let i = 0; i < n; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 26, vy: -14 - Math.random() * 26, life: 0.9 + Math.random() * 0.9, glyph, color: colors[i % colors.length],
      });
    }
  }
  function bubble(x: number, glyph: string, color: string, calm = false): void {
    const bob = calm ? 0 : Math.round(Math.sin(clock * 9) * 1.5);
    const top = GROUND - (small ? 38 : 46) + bob;
    g.fillStyle = calm ? 'rgba(244,241,222,0.92)' : 'rgba(20,20,34,0.85)';
    g.fillRect(Math.round(x) - 7, top, 13, calm ? 9 : 12);
    if (calm) g.fillRect(Math.round(x) - 2, top + 9, 3, 2);
    drawGlyph(g, glyph, x - (glyph === 'bang' ? 2 : glyph === 'dots' ? 3 : 4), top + 3, color);
  }
  /** A warm wash over a scene from before the story starts. */
  function memory(): void {
    g.fillStyle = 'rgba(255,196,120,0.2)';
    g.fillRect(0, 0, W, H);
    const edge = Math.round(W * 0.12);
    for (let i = 0; i < edge; i += 2) {
      g.fillStyle = `rgba(30,18,10,${0.35 * (1 - i / edge)})`;
      g.fillRect(i, 0, 2, H);
      g.fillRect(W - i - 2, 0, 2, H);
    }
  }
  /** The night sky of a card, with a strip of ground. */
  function night(): void {
    g.fillStyle = '#0b0d16';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < W / 3; i++) {
      const tw = (hash(i, 3) + Math.floor(clock * 2)) % 7 === 0 ? 0 : 1;
      if (tw) g.fillRect(hash(i, 1) % W, hash(i, 2) % H, 1, 1);
    }
  }

  /** Sky, skyline and street for an outdoor scene. `sweep` 0..1 wipes from one city to another. */
  function street(b: StoryBeat, progress: number, mood: number, sweep = -1): void {
    const sky = skyAt(progress);
    const bandH = Math.ceil((GROUND - 10) / sky.length);
    sky.forEach((c, i) => {
      g.fillStyle = mood > 0 ? mixRgb(c, [40, 42, 60], mood) : c;
      g.fillRect(0, i * bandH, W, bandH + 1);
    });
    const night = progress > 0.8 ? (progress - 0.8) / 0.2 : progress < 0.06 ? 1 - progress / 0.06 : 0;
    if (night > 0) {
      g.fillStyle = `rgba(255,255,255,${0.75 * night})`;
      for (let i = 0; i < W / 6; i++) g.fillRect(hash(i, 11) % W, hash(i, 12) % Math.round(GROUND * 0.5), 1, 1);
    }
    const sunX = 30 + progress * (W - 60);
    const sunY = GROUND * 0.55 - Math.sin(progress * Math.PI) * GROUND * 0.4;
    g.fillStyle = progress > 0.85 ? '#f4f1de' : '#fff3b0';
    g.beginPath();
    g.arc(Math.round(sunX), Math.round(sunY), 6, 0, Math.PI * 2);
    g.fill();
    const far = mixRgb(sky[2], [18, 18, 42], 0.6);
    const off = 120 + b.week * 0.05;
    if (sweep >= 0 && sweep < 1 && b.from >= 0) {
      const edge = Math.round(W * (1 - sweep));
      g.save(); g.beginPath(); g.rect(0, 0, edge, H); g.clip();
      drawSkyline(g, b.from, far, night * 0.8, off, W, GROUND);
      g.restore();
      g.save(); g.beginPath(); g.rect(edge, 0, W - edge, H); g.clip();
      drawSkyline(g, b.city, far, night * 0.8, off, W, GROUND);
      g.restore();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let y = 0; y < GROUND; y += 3) g.fillRect(edge + (hash(y, Math.floor(clock * 20)) % 5) - 2, y, 1, 2);
      const planeX = W + 20 - sweep * (W + 60);
      g.fillStyle = '#f4f4f4';
      g.fillRect(Math.round(planeX), 22, 14, 2);
      g.fillRect(Math.round(planeX) + 5, 19, 4, 8);
      g.fillRect(Math.round(planeX) + 12, 18, 2, 5);
    } else drawSkyline(g, b.city, far, night * 0.8, off, W, GROUND);
    g.fillStyle = mixRgb('#5f6b63', [16, 18, 40], 0.25 + night * 0.5 + mood * 0.2);
    g.fillRect(0, GROUND - 14, W, 14);
    g.fillStyle = mixRgb('#8d8a86', [20, 20, 48], night * 0.55 + mood * 0.2);
    g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = mixRgb('#b9b6b0', [20, 20, 48], night * 0.55 + mood * 0.2);
    g.fillRect(0, GROUND, W, 2);
  }

  /** The family table: the same room every time, so what changes is who is in it. */
  function table(b: StoryBeat, year: number): void {
    const ego = ctx.view().data.ego.id;
    g.fillStyle = '#3a2730';
    g.fillRect(0, 0, W, GROUND);
    g.fillStyle = '#4a323a';
    for (let x = 0; x < W; x += 14) g.fillRect(x, 0, 1, GROUND);
    g.fillStyle = '#2a1c1f';
    g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = '#3b2a22';
    for (let x = -((b.week | 0) % 22); x < W; x += 22) g.fillRect(x, GROUND, 1, H - GROUND);
    // A window onto the December night.
    const wx = Math.round(W * 0.5) - 26;
    const wy = Math.round(GROUND * 0.18);
    g.fillStyle = '#131a3a';
    g.fillRect(wx, wy, 52, 34);
    g.fillStyle = '#f4f4f8';
    for (let i = 0; i < 14; i++) {
      const sx = wx + 2 + (hash(i, 5) % 48);
      const sy = wy + ((hash(i, 6) + Math.floor(clock * (6 + (i % 5)))) % 32);
      g.fillRect(sx, sy, 1, 1);
    }
    g.fillStyle = '#6b4a3a';
    g.fillRect(wx - 2, wy - 2, 56, 2);
    g.fillRect(wx - 2, wy + 34, 56, 2);
    g.fillRect(wx - 2, wy, 2, 34);
    g.fillRect(wx + 52, wy, 2, 34);
    g.fillRect(wx + 25, wy, 2, 34);
    // A string of lights.
    for (let x = 6; x < W; x += 9) {
      const yy = 8 + Math.round(Math.sin(x / 18) * 3);
      const lit = (Math.floor(clock * 2) + x / 9) % 3 !== 0;
      g.fillStyle = lit ? ['#ffd166', '#ff7b54', '#7fd1ff', '#9be28a'][(x / 9) % 4 | 0] : '#5a4650';
      g.fillRect(x, yy, 2, 2);
    }
    // A small tree in the corner.
    const tx = W - 30;
    g.fillStyle = '#5b4028';
    g.fillRect(tx - 1, GROUND - 6, 3, 6);
    for (let r = 0; r < 5; r++) {
      g.fillStyle = r % 2 ? '#2f7d4f' : '#3fa066';
      g.fillRect(tx - 3 - r * 2, GROUND - 34 + r * 6, 7 + r * 4, 6);
    }
    g.fillStyle = '#ffd166';
    g.fillRect(tx - 1, GROUND - 37, 3, 3);

    // Everyone stands behind the table; empty chairs keep their place at one end.
    const seats: number[] = [];
    const half = Math.ceil(b.stage.length / 2);
    seats.push(...b.stage.slice(0, half), ego, ...b.stage.slice(half));
    const total = seats.length + b.empty;
    const gap = Math.min(22, Math.floor((W - 70) / Math.max(1, total)));
    const x0 = Math.round(W / 2 - (total - 1) * gap / 2);
    for (let i = 0; i < b.empty; i++) {
      const x = x0 + i * gap;
      const a = Math.min(1, t / 1.2);
      g.fillStyle = `rgba(107,74,58,${0.5 + 0.5 * a})`;
      g.fillRect(x - 5, GROUND - 22, 10, 14);
      g.fillStyle = '#3a2730';
      g.fillRect(x - 3, GROUND - 20, 6, 8);
    }
    seats.forEach((id, k) => {
      const x = x0 + (b.empty + k) * gap;
      const a = Math.min(1, Math.max(0, t / 0.5 - k * 0.25));
      person(id, x, GROUND - 2, id === ego && t > 1.5 && t < 3 ? 'wave' : 'stand', year, { alpha: a, flip: x > W / 2, frame: k });
    });
    const left = x0 - 16;
    const width = (total - 1) * gap + 32;
    g.fillStyle = '#e9dcc3';
    g.fillRect(left, GROUND - 10, width, 4);
    g.fillStyle = '#c9b89a';
    g.fillRect(left, GROUND - 6, width, 5);
    g.fillStyle = '#5b4028';
    g.fillRect(left + 3, GROUND - 1, 3, 9);
    g.fillRect(left + width - 6, GROUND - 1, 3, 9);
    for (let k = 0; k < total; k++) {
      const x = x0 + k * gap;
      g.fillStyle = k < b.empty ? '#8f8577' : '#f7f5ef';
      g.fillRect(x - 3, GROUND - 11, 6, 1);
      if (k >= b.empty) {
        g.fillStyle = ['#d1495b', '#eda100', '#5c946e'][k % 3];
        g.fillRect(x - 1, GROUND - 13, 3, 2);
      }
    }
    // Candles.
    for (const cx of [left + width * 0.33, left + width * 0.66]) {
      g.fillStyle = '#f7f5ef';
      g.fillRect(Math.round(cx), GROUND - 15, 1, 5);
      g.fillStyle = Math.floor(clock * 8) % 2 ? '#ffd166' : '#ff9b54';
      g.fillRect(Math.round(cx), GROUND - 17, 1, 2);
    }
  }

  function draw(b: StoryBeat, dt: number): void {
    const v = ctx.view();
    const ego = v.data.ego.id;
    const before = b.age < v.data.story.beats[0].age;
    // A memory from before the story is always a bright afternoon.
    const progress = before ? 0.42 : Math.min(1, b.week / v.totalWeeks);
    const year = b.year;
    const other = b.stage[0] ?? -1;
    const cx = Math.round(W / 2);
    g.clearRect(0, 0, W, H);
    small = before && b.age < 17;

    if (b.scene === 'table') table(b, year);
    else if (b.scene === 'fact') {
      // A quiet card: the night sky and one small figure walking.
      night();
      g.fillStyle = '#1b2033';
      g.fillRect(0, H - 14, W, 14);
      person(ego, cx - W * 0.3 + ((t * 8) % (W * 0.6)), H - 14, 'walk', year);
    } else if (b.scene === 'without') {
      // You and the one person; then everyone who reached you through them, one at a time.
      night();
      const y0 = Math.round(H * 0.42);
      const others = b.stage.slice(1);
      const lx = cx + 9;
      const spots = others.map((_, k) => {
        const row = k % 2;
        const col = Math.floor(k / 2);
        const side = col % 2 ? -1 : 1;
        return { x: cx + side * (34 + Math.floor(col / 2) * 22) + row * 8 * side, y: y0 + 26 + row * 26 };
      });
      others.forEach((id, k) => {
        const a = Math.min(1, Math.max(0, (t - 1.4 - k * 0.45) / 0.6));
        if (a <= 0) return;
        g.strokeStyle = `rgba(255,209,102,${0.35 * a})`;
        g.beginPath();
        g.moveTo(lx + 0.5, y0 - 4);
        g.lineTo(spots[k].x + 0.5, spots[k].y - 22);
        g.stroke();
      });
      others.forEach((id, k) => {
        const a = Math.min(1, Math.max(0, (t - 1.4 - k * 0.45) / 0.6));
        if (a > 0) person(id, spots[k].x, spots[k].y, 'stand', year, { alpha: a, flip: spots[k].x > cx, frame: k });
      });
      person(ego, cx - 9, y0, 'stand', year);
      if (other >= 0) person(other, lx, y0, 'stand', year, { flip: true });
    } else if (b.scene === 'gap') {
      // Two cities and the distance between them; the messages thin out.
      const half = Math.round(W / 2);
      const wide = Math.round(Math.min(half * 0.5, 6 + t * 7));
      g.save(); g.beginPath(); g.rect(0, 0, half - wide, H); g.clip();
      street(b, progress, 0.25);
      g.restore();
      g.save(); g.beginPath(); g.rect(half + wide, 0, half, H); g.clip();
      street({ ...b, city: b.otherCity >= 0 ? b.otherCity : b.city, week: b.week + 4000 }, progress, 0.25);
      g.restore();
      g.fillStyle = '#0b0d16';
      g.fillRect(half - wide, 0, wide * 2, H);
      const ax = Math.round(half - wide - 26);
      const bx = Math.round(half + wide + 26);
      person(ego, ax, GROUND, 'stand', year);
      if (other >= 0) person(other, bx, GROUND, 'stand', year, { flip: true });
      // A message crosses now and then, less and less often.
      if (Math.random() < dt * Math.max(0, 1.6 - t * 0.28)) {
        const fromEgo = Math.random() < 0.5;
        particles.push({ x: fromEgo ? ax + 6 : bx - 10, y: GROUND - 30, vx: (fromEgo ? 1 : -1) * (bx - ax) / 2.2, vy: -3, life: 2.1, glyph: 'note', color: '#f4f1de' });
      }
    } else {
      const sad = b.scene === 'goodbye' || b.scene === 'breakup' || b.scene === 'fallout' || b.scene === 'last' || b.scene === 'showup' || b.scene === 'talk';
      const sweep = b.scene === 'move' && b.from >= 0 ? Math.min(1, Math.max(0, (t - 0.6) / 2.2)) : -1;
      street(b, progress, sad ? Math.min(0.45, t * 0.15) : 0, sweep);
      if (b.place && b.scene !== 'move') drawVenue(g, b.place, cx + 34, GROUND, clock);
      const ex = cx - 14;
      const meetX = ex + 21;

      if (b.scene === 'early') {
        // Three small moments, a few seconds each: side by side, face to face, and off again.
        const phase = Math.floor(t / 3.4) % 3;
        const o = other >= 0 ? other : ego;
        if (phase === 0) {
          person(ego, ex, GROUND, 'walk', year);
          person(o, ex + 15, GROUND, 'walk', year, { frame: Math.floor(clock * 7) + 2 });
        } else if (phase === 1) {
          person(ego, ex, GROUND, 'stand', year);
          person(o, meetX, GROUND, 'stand', year, { flip: true });
          bubble(Math.floor(clock / 1.3) % 2 ? ex : meetX, Math.floor(clock / 2.6) % 2 ? 'note' : 'dots', '#33334a', true);
        } else {
          person(ego, ex, GROUND, 'wave', year);
          person(o, meetX, GROUND, 'wave', year, { flip: true });
          if (Math.random() < dt * 3) burst(ex + 10, GROUND - 26, 1, 'star', ['#ffd166', '#f7f5ef']);
        }
      } else if (b.scene === 'talk') {
        // A long talk: close together, taking turns, nobody waving.
        person(ego, ex, GROUND, 'stand', year);
        if (other >= 0) person(other, ex + 17, GROUND, 'stand', year, { flip: true });
        if (t > 0.8) bubble(Math.floor((t - 0.8) / 1.7) % 2 ? ex : ex + 17, 'dots', '#33334a', true);
        if (t > 6 && Math.random() < dt * 0.8) burst(ex + 8, GROUND - 30, 1, 'heart', ['#ffd166']);
      } else if (b.scene === 'showup') {
        // You, alone, and then not.
        const vx = Math.max(ex + 15, W + 20 - Math.max(0, t - 1.4) * 70);
        const arrived = vx <= ex + 15;
        person(ego, ex, GROUND, 'stand', year);
        if (other >= 0) {
          person(other, vx, GROUND, arrived ? 'stand' : 'walk', year, { flip: true });
          if (arrived && Math.floor(t / 2.2) % 2 === 0) bubble(vx, 'dots', '#33334a', true);
        }
      } else if (b.scene === 'meet' || b.scene === 'reunion' || b.scene === 'makeup' || b.scene === 'visit') {
        if (b.scene === 'visit') {
          const planeX = W + 20 - t * 60;
          g.fillStyle = '#f4f4f4';
          g.fillRect(Math.round(planeX), 20, 14, 2);
          g.fillRect(Math.round(planeX) + 5, 17, 4, 8);
          g.fillRect(Math.round(planeX) + 12, 16, 2, 5);
        }
        const vx = Math.max(meetX, W + 20 - t * 150);
        const arrived = vx <= meetX;
        person(ego, ex, GROUND, arrived && t < 4 ? 'wave' : 'stand', year);
        if (other >= 0) {
          person(other, vx, GROUND, arrived ? (t < 4 ? 'wave' : 'stand') : 'walk', year, { flip: true });
          if (arrived) bubble(vx, b.scene === 'meet' ? 'bang' : b.scene === 'makeup' ? 'heart' : 'note', b.scene === 'meet' ? '#ffffff' : '#ffd166');
        }
      } else if (b.scene === 'ritual' || b.scene === 'nudge') {
        person(ego, ex, GROUND, 'stand', year);
        if (other >= 0) person(other, meetX, GROUND, 'stand', year, { flip: true });
        if (Math.random() < dt * 2.5) burst(ex + 10, GROUND - 30, 1, 'note', ['#ffd166', '#f7f5ef']);
      } else if (b.scene === 'together') {
        person(ego, ex, GROUND, 'stand', year);
        if (other >= 0) person(other, ex + 15, GROUND, 'stand', year, { flip: true });
        if (Math.random() < dt * 9) burst(ex + 8, GROUND - 30, 1, 'heart', ['#ff5d8f', '#ff9ecb']);
        if (t > 1 && t - dt <= 1) for (let i = 0; i < 40; i++) burst(cx + (Math.random() - 0.5) * 140, 24, 1, undefined, ['#ffd166', '#ff7b54', '#7fd1ff', '#f7f5ef', '#ff9ecb']);
      } else if (b.scene === 'breakup' || b.scene === 'fallout') {
        const d = Math.min(46, t * 14);
        person(ego, ex - d * 0.4, GROUND, d < 46 ? 'walk' : 'stand', year, { flip: true });
        if (other >= 0) person(other, meetX + d, GROUND, d < 46 ? 'walk' : 'stand', year, { alpha: Math.max(0.25, 1 - d / 60) });
      } else if (b.scene === 'last') {
        const leave = Math.max(0, t - 2.5);
        person(ego, ex, GROUND, leave > 0 && leave < 2 ? 'wave' : 'stand', year);
        if (other >= 0) person(other, meetX + leave * 26, GROUND, leave > 0 ? 'walk' : 'stand', year, { flip: leave <= 0, alpha: Math.max(0, 1 - leave / 3) });
      } else if (b.scene === 'goodbye') {
        person(ego, ex, GROUND, 'stand', year);
        const fade = Math.max(0, 1 - Math.max(0, t - 1) / 3.5);
        if (other >= 0) {
          person(other, meetX, GROUND, 'stand', year, { flip: true, alpha: fade });
          if (fade > 0 && fade < 1 && Math.random() < dt * 10) {
            particles.push({ x: meetX + (Math.random() - 0.5) * 8, y: GROUND - 6 - Math.random() * 18, vx: (Math.random() - 0.5) * 4, vy: -8 - Math.random() * 8, life: 1.6, color: '#f4f1de' });
          }
        }
      } else if (b.scene === 'move') {
        // The people who stay are left standing as the old city slides away.
        const edge = sweep >= 0 ? W * (1 - sweep) : W;
        b.stage.forEach((id, k) => {
          const x = Math.min(ex - 40 - k * 18, edge - 20 - k * 18);
          person(id, x, GROUND, sweep > 0.05 && sweep < 0.6 ? 'wave' : 'stand', year, { alpha: Math.max(0, 1 - Math.max(0, sweep) * 1.4) });
        });
        person(ego, ex, GROUND, sweep >= 1 ? 'stand' : 'walk', year);
      } else {
        // The end: whoever is still with you.
        person(ego, ex, GROUND, t < 3 ? 'wave' : 'stand', year);
        b.stage.forEach((id, k) => {
          const a = Math.min(1, Math.max(0, t / 0.6 - 0.8 - k * 0.6));
          person(id, ex + (k % 2 ? -1 : 1) * (17 + Math.floor(k / 2) * 16), GROUND - (k % 2), 'stand', year, { alpha: a, flip: k % 2 === 0 });
        });
      }
    }

    if (before && b.scene !== 'table') memory();
    small = false;
    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.glyph ? 6 : p.color === '#f4f1de' ? 0 : 70) * dt;
      if (p.glyph) drawGlyph(g, p.glyph, p.x, p.y, p.color);
      else {
        g.fillStyle = p.color;
        g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      }
    }
    // Fade each scene in from black.
    if (t < 0.4) {
      g.fillStyle = `rgba(11,13,22,${1 - t / 0.4})`;
      g.fillRect(0, 0, W, H);
    }
  }

  function frame(dt: number): void {
    if (!on_) return;
    const list = beats();
    if (!list.length) return;
    const b = list[idx];
    t += dt;
    clock += dt;
    draw(b, dt);
    const text = fullText();
    const n = Math.min(text.length, Math.floor(t * TYPE_RATE));
    if (n !== typed) {
      typed = n;
      textEl.textContent = text.slice(0, n);
      if (n >= text.length && b.scene === 'end') actions.hidden = false;
    }
    // Move on by itself once there has been time to read the caption.
    const read = text.length / TYPE_RATE + Math.max(2.6, text.split(' ').length * 0.24);
    if (t >= read && idx < list.length - 1) show(idx + 1);
  }

  root.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement).closest('button, .story-pips')) return;
    next();
  });
  root.querySelector('.story-skip')!.addEventListener('click', () => on.explore());
  root.querySelector('.explore')!.addEventListener('click', () => on.explore());
  root.querySelector('.another')!.addEventListener('click', () => on.another());
  root.querySelector('.again')!.addEventListener('click', () => show(0));

  return {
    active: () => on_,
    start(beat = 0) {
      on_ = true;
      root.hidden = false;
      resize();
      shown = -1;
      show(beat);
    },
    stop() {
      on_ = false;
      root.hidden = true;
    },
    frame,
    next,
    prev,
    resize: () => { if (on_) resize(); },
    rename(name: string) {
      alias = name.trim().slice(0, 16);
      if (on_) show(idx);
    },
  };
}
