// The Map view: the three cities as islands, everyone in the world as a faint dot,
// and the people you know lit up by how close they are. Dots fly between cities
// when someone moves.

import { drawGlyph, hash, unit } from './pixel';
import type { Ctx, Scene } from './types';

const W = 400;
const H = 190;
const CITIES = [
  { x: 318, y: 98, r: 50 }, // New York, east
  { x: 80, y: 108, r: 46 }, // San Francisco, west
  { x: 204, y: 52, r: 38 }, // Chicago, middle
];
const SQUASH = 0.68;
const TRANSIT_WEEKS = 20;
const TIER_COLORS = ['#4fa8ff', '#f2f6ff', '#ffd166', '#ff7b54'];
const TIER_SIZES = [2, 2, 3, 4];
const OUTLINE = 'rgba(11,20,32,0.45)';

function spot(id: number, city: number): [number, number] {
  const c = CITIES[city];
  const a = unit(id, city * 7 + 1) * Math.PI * 2;
  const r = c.r * 0.88 * Math.sqrt(unit(id, city * 7 + 2));
  return [c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * SQUASH];
}

/** Where someone is at week w, including the flight between cities after a move. */
function position(id: number, timeline: [number, number][], w: number): [number, number] {
  let i = 0;
  for (let k = 0; k < timeline.length; k++) if (timeline[k][0] <= w) i = k;
  const here = spot(id, timeline[i][1]);
  if (i === 0 || w - timeline[i][0] >= TRANSIT_WEEKS) return here;
  const from = spot(id, timeline[i - 1][1]);
  const f = (w - timeline[i][0]) / TRANSIT_WEEKS;
  const e = f * f * (3 - 2 * f);
  return [from[0] + (here[0] - from[0]) * e, from[1] + (here[1] - from[1]) * e - Math.sin(Math.PI * f) * 22];
}

export function createMap(root: HTMLElement, ctx: Ctx): Scene {
  root.innerHTML = `
    <div class="stage map-stage">
      <canvas width="${W}" height="${H}"></canvas>
      <div class="map-labels"></div>
      <div class="hud hud-left"></div>
    </div>
    <div class="pixel-legend">
      <span><i style="background:#ffffff"></i>you</span>
      <span><i style="background:${TIER_COLORS[3]}"></i>inner circle</span>
      <span><i style="background:${TIER_COLORS[2]}"></i>close friends</span>
      <span><i style="background:${TIER_COLORS[1]}"></i>friends</span>
      <span><i style="background:${TIER_COLORS[0]}"></i>acquaintances</span>
      <span><i style="background:#ff9ecb"></i>family and partner</span>
      <span><i style="background:rgba(255,255,255,0.3)"></i>everyone else</span>
    </div>`;
  const canvas = root.querySelector('canvas')!;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const labels = root.querySelector<HTMLElement>('.map-labels')!;
  const hud = root.querySelector<HTMLElement>('.hud-left')!;
  let clock = 0;
  let drawn: { id: number; x: number; y: number }[] = [];
  let labelEls: HTMLElement[] = [];

  // The sea and the islands never change, so paint them once.
  const base = document.createElement('canvas');
  base.width = W;
  base.height = H;
  function paintBase(): void {
    const b = base.getContext('2d')!;
    b.fillStyle = '#0e1a2b';
    b.fillRect(0, 0, W, H);
    b.fillStyle = '#16283f';
    for (let i = 0; i < 260; i++) b.fillRect(hash(i, 21) % W, hash(i, 22) % H, 3, 1);
    const styles = getComputedStyle(document.documentElement);
    CITIES.forEach((c, ci) => {
      const hue = styles.getPropertyValue(`--city-${ci}`).trim() || '#888888';
      for (let y = Math.floor(c.y - c.r); y <= c.y + c.r; y++) {
        for (let x = Math.floor(c.x - c.r - 8); x <= c.x + c.r + 8; x++) {
          const dx = (x - c.x) / (c.r + 6);
          const dy = (y - c.y) / ((c.r + 6) * SQUASH);
          const a = Math.atan2(dy, dx);
          const edge = 1 + Math.sin(a * 3 + ci) * 0.07 + Math.sin(a * 7 + ci * 2) * 0.04;
          const dist = Math.sqrt(dx * dx + dy * dy) / edge;
          if (dist < 0.93) b.fillStyle = (x + y) % 9 === 0 ? '#2b4350' : '#24394a';
          else if (dist < 1) b.fillStyle = hue;
          else if (dist < 1.06) b.fillStyle = '#1b3350';
          else continue;
          b.fillRect(x, y, 1, 1);
        }
      }
    });
  }

  function frame(dt: number): void {
    const v = ctx.view();
    const d = v.data;
    const week = ctx.week();
    clock += dt;
    g.drawImage(base, 0, 0);

    const strengths = ctx.strengthsAt(week);
    const L = d.levels;
    const partnerId = ctx.partnerAt(week)?.id ?? -1;
    const me = position(d.ego.id, d.ego.cities, week);
    const counts = [0, 0, 0];

    // Everyone else, faintly.
    g.fillStyle = 'rgba(255,255,255,0.14)';
    for (const [id, tl] of d.population) {
      if (id === d.ego.id || (strengths.get(id) ?? 0) >= L[0]) continue;
      const [x, y] = position(id, tl, week);
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }

    // The people you know, weakest first so the closest sit on top.
    const known = [...strengths.entries()].filter(([, s]) => s >= L[0]).sort((a, b) => a[1] - b[1]);
    drawn = [];
    const lines: [number, number][] = [];
    for (const [id, s] of known) {
      const p = v.people.get(id);
      if (!p) continue;
      const [x, y] = position(id, p.cities, week);
      const ix = Math.round(x);
      const iy = Math.round(y);
      counts[ctx.cityAt(p.cities, week)]++;
      const lv = ctx.levelOf(s);
      const isPartner = id === partnerId;
      const kin = isPartner || (p.kin && !ctx.wasPartner(id));
      if (kin) {
        g.fillStyle = OUTLINE;
        g.fillRect(ix - 1, iy - 1, 3, 3);
        g.fillStyle = '#ff9ecb';
        g.fillRect(ix - 1, iy, 3, 1);
        g.fillRect(ix, iy - 1, 1, 3);
        if (isPartner) drawGlyph(g, 'heart', ix - 3, iy - 9 + Math.round(Math.sin(clock * 4)), '#ff5d8f');
      } else {
        // A dark rim keeps each dot readable over the island and over the faint crowd.
        const size = TIER_SIZES[lv - 1];
        const o = size >> 1;
        g.fillStyle = OUTLINE;
        g.fillRect(ix - o, iy - o - 1, size, size + 2);
        g.fillRect(ix - o - 1, iy - o, size + 2, size);
        g.fillStyle = TIER_COLORS[lv - 1];
        g.fillRect(ix - o, iy - o, size, size);
      }
      if (lv >= 4 || isPartner) lines.push([x, y]);
      drawn.push({ id, x, y });
    }

    // Dotted lines from you to your inner circle, wherever they live.
    g.fillStyle = 'rgba(255,255,255,0.5)';
    const phase = Math.floor(clock * 6);
    for (const [x, y] of lines) {
      const n = Math.max(1, Math.round(Math.hypot(x - me[0], y - me[1]) / 3));
      for (let i = 1; i < n; i++) {
        if ((i + phase) % 3) continue;
        g.fillRect(Math.round(me[0] + ((x - me[0]) * i) / n), Math.round(me[1] + ((y - me[1]) * i) / n), 1, 1);
      }
    }

    // You.
    const mx = Math.round(me[0]);
    const my = Math.round(me[1]);
    const pulse = 4 + Math.floor((clock * 3) % 3);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1;
    g.strokeRect(mx - pulse + 0.5, my - pulse + 0.5, pulse * 2 - 1, pulse * 2 - 1);
    g.fillStyle = '#ffffff';
    g.fillRect(mx - 1, my - 1, 3, 3);

    hud.textContent = `${ctx.yearOf(week)} · AGE ${ctx.ageAt(week)}`;
    labelEls.forEach((elm, ci) => {
      const here = ctx.cityAt(d.ego.cities, week) === ci;
      elm.querySelector('.n')!.textContent = `${counts[ci]} you know${here ? ' · you live here' : ''}`;
    });
  }

  canvas.addEventListener('pointermove', (ev) => {
    const r = canvas.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    const y = ((ev.clientY - r.top) / r.height) * H;
    let best = -1;
    let bestD = 49;
    for (const p of drawn) {
      const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (dd <= bestD) {
        bestD = dd;
        best = p.id;
      }
    }
    if (best >= 0) ctx.showTip(ctx.personTip(best), ev.clientX, ev.clientY);
    else ctx.hideTip();
  });
  canvas.addEventListener('pointerleave', () => ctx.hideTip());

  return {
    reset() {
      paintBase();
      const names = ctx.view().data.cities;
      labels.innerHTML = CITIES.map(
        (c, i) => `<div class="map-label" style="left:${(c.x / W) * 100}%;top:${((c.y + c.r * SQUASH + 10) / H) * 100}%"><b>${names[i] ?? ''}</b><span class="n"></span></div>`,
      ).join('');
      labelEls = [...labels.querySelectorAll<HTMLElement>('.map-label')];
    },
    seek() {},
    frame,
    timeScale: () => 1,
  };
}
