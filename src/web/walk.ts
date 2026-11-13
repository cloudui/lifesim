// The Walk view: you walk through your life in pixel art. The city scrolls past,
// the sky moves from dawn to dusk over the years, people walk up and greet you,
// your inner circle walks behind you, and big moments change the scene.

import type { Highlight } from '../sim/highlights';
import { drawSkyline, drawVenue, mixRgb, skyAt } from './backdrop';
import { drawGlyph, drawPerson, hash, lookFor, unit, type Outfit } from './pixel';
import type { Ctx, Scene } from './types';

// The canvas is sized to fill the window at a whole-number pixel scale, so these change on resize.
let W = 320;
let H = 180;
/** The street line the people stand on, kept just above the dialogue box. */
let GROUND = 140;
let EGO_X = 120;
const WALK_SPEED = 40;

type Kind = 'meet' | 'partner' | 'move' | 'note';
interface Active {
  h: Highlight;
  kind: Kind;
  t: number;
  /** Seconds to hold once the moment is fully on screen. */
  hold: number;
  visitor: number;
  /** Visitor's position, which is fixed to the street until they reach you. */
  vx: number;
  joins: boolean;
  fromCity: number;
}
interface Prop { x: number; kind: string }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; glyph?: string; color: string }

export function createWalk(root: HTMLElement, ctx: Ctx): Scene {
  root.innerHTML = `<canvas class="pixel-canvas"></canvas>`;
  const canvas = root.querySelector('canvas')!;
  const g = canvas.getContext('2d')!;

  function resize(): void {
    const cw = root.clientWidth || window.innerWidth;
    const ch = root.clientHeight || window.innerHeight;
    const { bottom } = ctx.insets();
    // Big chunky pixels: roughly 190 game pixels tall, never fewer than 230 wide.
    const scale = Math.max(2, Math.round(Math.min(ch / 190, cw / 230)));
    W = Math.ceil(cw / scale);
    H = Math.ceil(ch / scale);
    GROUND = Math.min(H - 6, Math.max(100, Math.floor((ch - bottom) / scale) - 6));
    EGO_X = Math.round(W * 0.4);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${H * scale}px`;
    g.imageSmoothingEnabled = false;
  }

  let scroll = 0;
  let clock = 0;
  let nextIdx = 0;
  let queue: number[] = [];
  let active: Active | null = null;
  let props: Prop[] = [];
  let particles: Particle[] = [];
  let captionIdx = -2;
  const presence = new Map<number, number>();

  const kindOf = (h: Highlight): Kind =>
    h.type === 'move' ? 'move'
    : h.type === 'partner' ? 'partner'
    : h.type === 'met' || h.type === 'smallWorld' || h.type === 'nearMiss' || h.type === 'reunion' ? 'meet'
    : 'note';

  function start(i: number): void {
    const v = ctx.view();
    const h = v.data.highlights[i];
    const kind = kindOf(h);
    const visitor = kind === 'meet' || kind === 'partner' ? h.people[0] ?? -1 : -1;
    const hold = kind === 'partner' ? 3.4 : kind === 'move' ? 1.8 : kind === 'meet' ? (h.score >= 6 ? 1.7 : 0.9) : h.scaffold || h.score >= 6 ? 1.1 : 0.5;
    const person = v.people.get(visitor);
    const tl = v.data.ego.cities;
    let fromCity = tl[0][1];
    for (const [wk, c] of tl) if (wk < h.week) fromCity = c;
    active = {
      h, kind, t: 0, hold, visitor, vx: W + 24,
      joins: !!person && person.peak >= v.data.levels[2], fromCity,
    };
    if (kind === 'meet' || kind === 'partner') {
      const venue = v.data.venues.find((x) => x.id === h.venue);
      if (venue) props.push({ x: W + 40, kind: venue.kind });
    }
    showCaption(i);
  }

  function showCaption(i: number): void {
    captionIdx = i;
  }

  function burst(x: number, y: number, n: number, glyph: string | undefined, colors: string[]): void {
    for (let i = 0; i < n; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 26, vy: -14 - Math.random() * 26, life: 0.9 + Math.random() * 0.9,
        glyph, color: colors[i % colors.length],
      });
    }
  }

  // ---------------------------------------------------------------- frame

  function frame(dt: number): void {
    const v = ctx.view();
    const d = v.data;
    const week = ctx.week();
    const playing = ctx.playing();
    clock += dt;

    if (playing) {
      while (nextIdx < d.highlights.length && d.highlights[nextIdx].week <= week) queue.push(nextIdx++);
    }
    if (!active && queue.length) start(queue.shift()!);

    // Advance the current moment. The street keeps moving until the visitor reaches you.
    let greeting = false;
    let travel = -1;
    if (active) {
      active.t += dt;
      const a = active;
      if (a.kind === 'meet' || a.kind === 'partner') {
        const meetX = EGO_X + 19;
        if (a.vx > meetX) {
          a.vx = Math.max(meetX, a.vx - dt * WALK_SPEED * 5);
          a.t = 0;
        } else {
          greeting = a.t < a.hold;
          if (a.kind === 'partner' && Math.random() < dt * 9) burst(EGO_X + 10, GROUND - 30, 1, 'heart', ['#ff5d8f', '#ff9ecb']);
          if (a.kind === 'partner' && a.t > 1.2 && a.t - dt <= 1.2) {
            for (let i = 0; i < 40; i++) burst(EGO_X + 10 + (Math.random() - 0.5) * 120, 24, 1, undefined, ['#ffd166', '#ff7b54', '#7fd1ff', '#f7f5ef', '#ff9ecb']);
          }
          if (a.t >= a.hold + 0.5) active = null;
        }
      } else if (a.kind === 'move') {
        travel = Math.min(1, a.t / (a.hold * 0.8));
        if (a.t >= a.hold) active = null;
      } else if (a.t >= a.hold) active = null;
    }
    const walking = playing && !greeting;
    if (walking) {
      const dx = dt * WALK_SPEED;
      scroll += dx;
      for (const p of props) p.x -= dx * (active && (active.kind === 'meet' || active.kind === 'partner') && active.vx > EGO_X + 19 ? 5 : 1);
      props = props.filter((p) => p.x > -80);
    }

    // ------------------------------------------------------------ draw
    const progress = Math.min(1, week / v.totalWeeks);
    const sky = skyAt(progress);
    const bandH = Math.ceil((GROUND - 10) / sky.length);
    sky.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(0, i * bandH, W, bandH + 1);
    });
    const night = progress > 0.8 ? (progress - 0.8) / 0.2 : progress < 0.06 ? 1 - progress / 0.06 : 0;
    if (night > 0) {
      g.fillStyle = `rgba(255,255,255,${0.75 * night})`;
      for (let i = 0; i < W / 6; i++) g.fillRect(hash(i, 11) % W, hash(i, 12) % Math.round(GROUND * 0.5), 1, 1);
    }
    // The sun crosses the sky once over the whole life.
    const sunX = 30 + progress * (W - 60);
    const sunY = GROUND * 0.55 - Math.sin(progress * Math.PI) * GROUND * 0.4;
    g.fillStyle = progress > 0.85 ? '#f4f1de' : '#fff3b0';
    g.beginPath();
    g.arc(Math.round(sunX), Math.round(sunY), 6, 0, Math.PI * 2);
    g.fill();

    const city = ctx.cityAt(d.ego.cities, week);
    const far = mixRgb(sky[2], [18, 18, 42], 0.6);
    if (travel >= 0 && travel < 1 && active) {
      // Moving city: the new skyline sweeps in from the right.
      const edge = Math.round(W * (1 - travel));
      g.save();
      g.beginPath();
      g.rect(0, 0, edge, H);
      g.clip();
      drawSkyline(g, active.fromCity, far, night * 0.8, scroll * 0.25, W, GROUND);
      g.restore();
      g.save();
      g.beginPath();
      g.rect(edge, 0, W - edge, H);
      g.clip();
      drawSkyline(g, city, far, night * 0.8, scroll * 0.25, W, GROUND);
      g.restore();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let y = 0; y < GROUND; y += 3) g.fillRect(edge + (hash(y, Math.floor(clock * 20)) % 5) - 2, y, 1, 2);
      // A small plane overhead.
      const planeX = W + 20 - travel * (W + 60);
      g.fillStyle = '#f4f4f4';
      g.fillRect(Math.round(planeX), 22, 14, 2);
      g.fillRect(Math.round(planeX) + 5, 19, 4, 8);
      g.fillRect(Math.round(planeX) + 12, 18, 2, 5);
    } else drawSkyline(g, city, far, night * 0.8, scroll * 0.25, W, GROUND);

    // The far side of the street, then trees and lamps, then the pavement.
    g.fillStyle = mixRgb('#5f6b63', [16, 18, 40], 0.25 + night * 0.5);
    g.fillRect(0, GROUND - 14, W, 14);
    g.fillStyle = mixRgb('#7d8a80', [16, 18, 40], 0.25 + night * 0.5);
    g.fillRect(0, GROUND - 14, W, 1);
    for (let i = 0; i < 9; i++) {
      const x = Math.round(((i * 74 - scroll * 0.6) % (9 * 74) + 9 * 74) % (9 * 74)) - 40;
      if (i % 3 === 0) {
        g.fillStyle = '#2a2a33';
        g.fillRect(x, GROUND - 40, 2, 40);
        g.fillRect(x - 3, GROUND - 42, 8, 2);
        g.fillStyle = night > 0.2 ? '#ffe39a' : '#d8d8d8';
        g.fillRect(x - 2, GROUND - 40, 6, 2);
      } else {
        g.fillStyle = '#4a3323';
        g.fillRect(x, GROUND - 22, 3, 22);
        g.fillStyle = mixRgb('#2f7d4f', [16, 20, 44], night * 0.5);
        g.fillRect(x - 8, GROUND - 40, 19, 14);
        g.fillStyle = mixRgb('#3fa066', [16, 20, 44], night * 0.5);
        g.fillRect(x - 5, GROUND - 45, 13, 8);
      }
    }
    g.fillStyle = mixRgb('#8d8a86', [20, 20, 48], night * 0.55);
    g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = mixRgb('#b9b6b0', [20, 20, 48], night * 0.55);
    g.fillRect(0, GROUND, W, 2);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let x = -((scroll | 0) % 24); x < W; x += 24) g.fillRect(x, GROUND + 2, 1, H - GROUND);

    for (const p of props) drawVenue(g, p.kind, p.x, GROUND, clock);

    // Who walks with you: your inner circle behind, your partner beside you.
    const strengths = ctx.strengthsAt(week);
    const L = d.levels;
    const current = ctx.partnerAt(week);
    const partnered = current !== null;
    const partnerId = current?.id ?? -1;
    const inner = [...strengths.entries()]
      .filter(([id, s]) => s >= L[3] && id !== partnerId && !v.people.get(id)?.kin)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
    for (const id of inner) presence.set(id, Math.min(1, (presence.get(id) ?? 0) + dt * 2));
    for (const [id, a] of presence) {
      if (!inner.includes(id)) {
        if (a - dt * 2 <= 0) presence.delete(id);
        else presence.set(id, a - dt * 2);
      }
    }
    const step = Math.floor(clock * 7);
    const pose = walking ? 'walk' : greeting ? 'wave' : 'stand';
    const yearNow = ctx.yearOf(week);
    const greyOf = (born: number) => Math.min(1, Math.max(0, (yearNow - born - 45) / 22));

    // Formal outfits for the year after getting together, melting in and out.
    const pw = current ? current.from : null;
    const outfit = (id: number): { outfit: Outfit; melt?: { to: Outfit; t: number } } => {
      if (pw === null || pw === undefined) return { outfit: 'casual' };
      const formal = lookFor(id).formal;
      const melting = active && active.kind === 'partner' && active.vx <= EGO_X + 19;
      if (melting) {
        const t = Math.min(1, Math.max(0, (active!.t - 0.9) / 1.3));
        return t >= 1 ? { outfit: formal } : { outfit: 'casual', melt: { to: formal, t } };
      }
      if (week < pw) return { outfit: 'casual' };
      const out = (week - (pw + 52)) / 10;
      if (out <= 0) return { outfit: formal };
      return out >= 1 ? { outfit: 'casual' } : { outfit: formal, melt: { to: 'casual', t: out } };
    };

    let slot = 0;
    for (const [id, a] of [...presence.entries()].reverse()) {
      const person = v.people.get(id);
      if (!person) continue;
      slot++;
      drawPerson(g, EGO_X - 16 - slot * 17, GROUND - (slot % 2), lookFor(id), {
        pose: walking ? 'walk' : 'stand', frame: step + slot, outfit: 'casual', grey: greyOf(person.born), alpha: a,
      });
    }
    if (partnered && !(active && active.kind === 'partner')) {
      const p = v.people.get(partnerId);
      drawPerson(g, EGO_X - 15, GROUND, lookFor(partnerId), {
        pose: walking ? 'walk' : 'stand', frame: step + 1, ...outfit(partnerId), grey: p ? greyOf(p.born) : 0,
      });
    }
    drawPerson(g, EGO_X, GROUND, lookFor(d.ego.id), { pose, frame: step, ...outfit(d.ego.id), grey: greyOf(d.ego.born) });

    if (active && active.visitor >= 0) {
      const a = active;
      const person = v.people.get(a.visitor);
      const arriving = a.vx > EGO_X + 19;
      const leaving = !arriving && a.t >= a.hold;
      const fade = leaving ? Math.max(0, 1 - (a.t - a.hold) / 0.5) : 1;
      drawPerson(g, a.vx, GROUND, lookFor(a.visitor), {
        pose: arriving ? 'walk' : leaving ? 'stand' : 'wave', frame: step, flip: !(leaving && a.joins), alpha: fade,
        ...(a.kind === 'partner' ? outfit(a.visitor) : { outfit: 'casual' as Outfit }), grey: person ? greyOf(person.born) : 0,
      });
      if (!arriving && !leaving) {
        const glyph = a.kind === 'partner' ? 'heart' : a.joins ? 'star' : a.h.type === 'reunion' ? 'note' : 'bang';
        const color = a.kind === 'partner' ? '#ff5d8f' : a.joins ? '#ffd166' : '#ffffff';
        const bob = Math.round(Math.sin(clock * 9) * 1.5);
        g.fillStyle = 'rgba(20,20,34,0.85)';
        g.fillRect(Math.round(a.vx) - 7, GROUND - 46 + bob, 13, 12);
        drawGlyph(g, glyph, a.vx - (glyph === 'bang' ? 2 : 4), GROUND - 43 + bob, color);
      }
    }

    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.glyph ? 6 : 70) * dt;
      if (p.glyph) drawGlyph(g, p.glyph, p.x, p.y, p.color);
      else {
        g.fillStyle = p.color;
        g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      }
    }

    // Text lives in the shell's HUD and dialogue box so it stays crisp.
    if (!active) {
      let last = -1;
      for (let i = 0; i < d.highlights.length && d.highlights[i].week <= week; i++) last = i;
      showCaption(last);
    }
  }

  function seek(): void {
    const hs = ctx.view().data.highlights;
    const week = ctx.week();
    queue = [];
    active = null;
    props = [];
    particles = [];
    nextIdx = 0;
    while (nextIdx < hs.length && hs[nextIdx].week <= week) nextIdx++;
    captionIdx = -2;
  }

  return {
    reset() {
      presence.clear();
      scroll = unit(ctx.view().data.seed, 9) * 400;
      resize();
      seek();
    },
    seek,
    frame,
    resize,
    caption: () => captionIdx,
    timeScale: () => (active || queue.length ? 0 : 1),
  };
}
