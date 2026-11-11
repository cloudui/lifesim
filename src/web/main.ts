// The inspection page: timeline, social graph and circle chart for one exported life.
// Reads only the LifeExport JSON; never touches the simulation.

import type { LifeExport, PersonExport } from '../sim/export';
import { formatOdds, LEVEL_NAMES } from '../sim/highlights';
import '@fontsource/vt323';
import { createMap } from './map';
import './style.css';
import type { Ctx, Scene, View } from './types';
import { createWalk } from './walk';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const SVG = 'http://www.w3.org/2000/svg';
function el(name: string, attrs: Record<string, string | number> = {}, text?: string): SVGElement {
  const e = document.createElementNS(SVG, name);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (text !== undefined) e.textContent = text;
  return e;
}
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

let view: View;
let week = 0;
let playing = false;
let hoverId = -1;
let lastFrame = 0;
let speed = 1;
type Tab = 'walk' | 'map' | 'circle';
let tab: Tab = 'walk';
/** Weeks of life per second of playback. The pixel views run slower so moments can land. */
const RATE: Record<Tab, number> = { walk: 30, map: 45, circle: 70 };

// ------------------------------------------------------------------ helpers

const yearOf = (w: number) => view.data.startYear + Math.floor(w / 52);
const ageAt = (w: number) => yearOf(w) - view.data.ego.born;
function cityAt(timeline: [number, number][], w: number): number {
  let c = timeline[0][1];
  for (const [wk, city] of timeline) if (wk <= w) c = city;
  return c;
}
function levelOf(s: number): number {
  const L = view.data.levels;
  return s >= L[3] ? 4 : s >= L[2] ? 3 : s >= L[1] ? 2 : s >= L[0] ? 1 : 0;
}
/** Index of the last snapshot at or before week w. */
function snapIndex(w: number): number {
  const s = view.data.snapshots;
  let lo = 0;
  let hi = s.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s[mid].week <= w) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
/** Everyone's strength at week w, interpolated between the two surrounding snapshots. */
function strengthsAt(w: number): Map<number, number> {
  const snaps = view.data.snapshots;
  const i = snapIndex(w);
  const a = snaps[i];
  const b = snaps[Math.min(i + 1, snaps.length - 1)];
  const f = b.week > a.week ? Math.min(1, Math.max(0, (w - a.week) / (b.week - a.week))) : 0;
  const out = new Map<number, number>();
  for (const [id, s] of a.nodes) out.set(id, (s / 100) * (1 - f));
  for (const [id, s] of b.nodes) out.set(id, (out.get(id) ?? 0) + (s / 100) * f);
  return out;
}

const tip = $('tip');
function showTip(html: string, x: number, y: number): void {
  tip.innerHTML = html;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = `${Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 14))}px`;
  tip.style.top = `${Math.min(window.innerHeight - r.height - 8, Math.max(8, y + 14))}px`;
}
const hideTip = () => (tip.hidden = true);
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

// ----------------------------------------------------------------- timeline

let tlScale = (w: number) => w;
let tlInvert = (x: number) => x;
let tlPlayhead: SVGElement;
let tlDots: { node: SVGElement; week: number }[] = [];

function buildTimeline(): void {
  const host = $('timeline');
  const W = Math.max(320, host.clientWidth);
  const H = 150;
  const padL = 10;
  const padR = 10;
  const bandY = 6;
  const laneTop = 30;
  const laneBottom = 118;
  tlScale = (w) => padL + (w / view.totalWeeks) * (W - padL - padR);
  tlInvert = (x) => Math.min(view.totalWeeks, Math.max(0, ((x - padL) / (W - padL - padR)) * view.totalWeeks));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': 'Timeline of notable moments' });

  // Where the protagonist lived.
  const tl = view.data.ego.cities;
  tl.forEach(([w, c], i) => {
    const x0 = tlScale(w);
    const x1 = tlScale(i + 1 < tl.length ? tl[i + 1][0] : view.totalWeeks);
    svg.append(el('rect', { x: x0 + 1, y: bandY, width: Math.max(1, x1 - x0 - 2), height: 8, rx: 4, fill: `var(--city-${c})` }));
    if (x1 - x0 > 70) svg.append(el('text', { x: x0 + 2, y: bandY + 21, class: 'label' }, view.data.cities[c]));
  });

  // Axis: a tick every five years.
  for (let y = 0; y <= view.data.years; y += 5) {
    const x = tlScale(y * 52);
    svg.append(el('line', { x1: x, x2: x, y1: laneTop, y2: laneBottom + 4, class: 'gridline' }));
    const anchor = y === 0 ? 'start' : y === view.data.years ? 'end' : 'middle';
    svg.append(el('text', { x, y: H - 6, 'text-anchor': anchor }, `${view.data.startYear + y} · age ${ageAt(y * 52)}`));
  }

  // Dots, packed into lanes so they do not overlap.
  const hs = view.data.highlights;
  const placed: { x: number; y: number; r: number }[] = [];
  const mid = (laneTop + laneBottom) / 2;
  tlDots = [];
  hs.forEach((h, i) => {
    const r = Math.min(11, 3 + h.score * 0.55);
    const x = tlScale(h.week);
    let y = mid;
    for (let k = 0; k < 40; k++) {
      y = mid + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 7;
      if (y - r < laneTop || y + r > laneBottom) continue;
      if (!placed.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + r + 1) ** 2)) break;
    }
    placed.push({ x, y, r });
    const node = h.scaffold
      ? el('rect', { x: x - r * 0.75, y: y - r * 0.75, width: r * 1.5, height: r * 1.5, rx: 1.5, transform: `rotate(45 ${x} ${y})`, class: 'dot scaffold' })
      : el('circle', { cx: x, cy: y, r, class: 'dot' });
    node.addEventListener('pointermove', (ev) => {
      const e = ev as PointerEvent;
      showTip(`<b>${yearOf(h.week)} · age ${ageAt(h.week)}</b>${esc(h.text)}`, e.clientX, e.clientY);
    });
    node.addEventListener('pointerleave', hideTip);
    node.dataset.i = String(i);
    svg.append(node);
    tlDots.push({ node, week: h.week });
  });

  tlPlayhead = el('line', { y1: bandY - 2, y2: laneBottom + 6, class: 'playhead' });
  svg.append(tlPlayhead);

  let dragging = false;
  const seek = (ev: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    setWeek(tlInvert(((ev.clientX - r.left) / r.width) * W));
  };
  svg.addEventListener('pointerdown', (ev) => {
    dragging = true;
    (svg as unknown as Element).setPointerCapture((ev as PointerEvent).pointerId);
    seek(ev as PointerEvent);
  });
  svg.addEventListener('pointermove', (ev) => dragging && seek(ev as PointerEvent));
  svg.addEventListener('pointerup', () => (dragging = false));
  host.replaceChildren(svg);
}

function updateTimeline(): void {
  const x = tlScale(week);
  tlPlayhead.setAttribute('x1', String(x));
  tlPlayhead.setAttribute('x2', String(x));
  for (const d of tlDots) {
    d.node.classList.toggle('past', d.week <= week);
    d.node.classList.toggle('now', d.week <= week && week - d.week < 26);
  }
}

// --------------------------------------------------------------- area chart

const TIER_LABELS = ['Inner circle', 'Close friends', 'Friends', 'Acquaintances'];
let areaPlayhead: SVGElement;
let areaScale = (w: number) => w;

function buildArea(): void {
  const host = $('area');
  const W = Math.max(280, host.clientWidth);
  const H = 170;
  const padL = 30;
  const padR = 8;
  const padT = 8;
  const padB = 22;
  const snaps = view.data.snapshots;
  const totals = view.tiers.map((t) => t[0] + t[1] + t[2] + t[3]);
  const max = Math.max(10, ...totals);
  const step = max > 160 ? 50 : max > 80 ? 25 : max > 30 ? 10 : 5;
  const top = Math.ceil(max / step) * step;
  const x = (w: number) => padL + (w / view.totalWeeks) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / top) * (H - padT - padB);
  areaScale = x;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': 'Circle sizes over time' });

  for (let v = 0; v <= top; v += step) {
    svg.append(el('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: 'gridline' }));
    svg.append(el('text', { x: padL - 6, y: y(v) + 3.5, 'text-anchor': 'end' }, String(v)));
  }
  for (let yr = 0; yr <= view.data.years; yr += 10) {
    const anchor = yr === 0 ? 'start' : yr === view.data.years ? 'end' : 'middle';
    svg.append(el('text', { x: x(yr * 52), y: H - 6, 'text-anchor': anchor }, `age ${ageAt(yr * 52)}`));
  }
  // Stacked bands, innermost at the bottom. Drawn outermost first so each sits on top of the last.
  for (let tier = 3; tier >= 0; tier--) {
    const height = (i: number) => view.tiers[i].slice(0, tier + 1).reduce((a, b) => a + b, 0);
    const pts = snaps.map((s, i) => `${x(s.week).toFixed(1)},${y(height(i)).toFixed(1)}`);
    svg.append(el('path', {
      d: `M${x(0)},${y(0)} L${pts.join(' L')} L${x(view.totalWeeks)},${y(0)} Z`,
      fill: `var(--tier-${tier})`, stroke: 'var(--surface)', 'stroke-width': 1.5, 'stroke-linejoin': 'round',
    }));
  }
  areaPlayhead = el('line', { y1: padT, y2: H - padB, class: 'playhead' });
  svg.append(areaPlayhead);

  let dragging = false;
  const at = (ev: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    return Math.min(view.totalWeeks, Math.max(0, ((px - padL) / (W - padL - padR)) * view.totalWeeks));
  };
  svg.addEventListener('pointerdown', (ev) => {
    dragging = true;
    (svg as unknown as Element).setPointerCapture((ev as PointerEvent).pointerId);
    setWeek(at(ev as PointerEvent));
  });
  svg.addEventListener('pointerup', () => (dragging = false));
  svg.addEventListener('pointermove', (ev) => {
    const e = ev as PointerEvent;
    const w = at(e);
    if (dragging) setWeek(w);
    const t = view.tiers[snapIndex(w)];
    showTip(
      `<b>${yearOf(w)} · age ${ageAt(w)}</b>` + TIER_LABELS.map((l, i) => `${l}: ${t[i]}`).join('<br>'),
      e.clientX, e.clientY,
    );
  });
  svg.addEventListener('pointerleave', hideTip);
  host.replaceChildren(svg);

  $('tier-legend').innerHTML = TIER_LABELS.map((l, i) => `<span><i class="swatch" style="background:var(--tier-${i})"></i>${l}</span>`).join('');
}

// -------------------------------------------------------------------- graph

const canvas = $<HTMLCanvasElement>('graph');
let nodesDrawn: { id: number; x: number; y: number; r: number }[] = [];

/** Strength to distance from the centre, as a fraction of the outer radius. */
function radiusFor(s: number): number {
  const L = view.data.levels;
  const stops: [number, number][] = [[L[0], 1], [L[1], 0.76], [L[2], 0.52], [L[3], 0.3], [1, 0.12]];
  if (s <= stops[0][0]) return 1;
  for (let i = 1; i < stops.length; i++) {
    if (s <= stops[i][0]) {
      const f = (s - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return stops[i - 1][1] + f * (stops[i][1] - stops[i - 1][1]);
    }
  }
  return 0.12;
}

function drawGraph(): void {
  const dpr = window.devicePixelRatio || 1;
  const size = canvas.clientWidth;
  if (canvas.width !== Math.round(size * dpr)) {
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  const H = canvas.clientHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, H);
  const cx = size / 2;
  const cy = H / 2;
  const R = Math.min(size, H) / 2 - 44;
  const ink = css('--text');
  const ink2 = css('--text-2');
  const ink3 = css('--text-3');
  const grid = css('--grid');
  const surface = css('--surface');
  const cityColors = [css('--city-0'), css('--city-1'), css('--city-2')];
  const L = view.data.levels;

  // Rings at each threshold, labelled directly (labels are drawn last so dots do not hide them).
  const ringLabels: { text: string; y: number }[] = [];
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  [[L[0], 'acquaintances'], [L[1], 'friends'], [L[2], 'close friends'], [L[3], 'inner circle']].forEach(([s, label]) => {
    const r = radiusFor(s as number) * R;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.stroke();
    ringLabels.push({ text: label as string, y: cy + r - 5 });
  });

  // Decade marks around the rim: people are placed clockwise by when you met them.
  for (let yr = 0; yr < view.data.years; yr += 10) {
    const first = view.data.people.filter((p) => p.met >= yr * 52).sort((a, b) => a.met - b.met)[0];
    if (!first) continue;
    const a = view.angle.get(first.id)!;
    ctx.fillStyle = ink3;
    ctx.textAlign = 'center';
    const lx = Math.min(size - 36, Math.max(36, cx + Math.cos(a) * (R + 22)));
    ctx.fillText(`met ${view.data.startYear + yr}+`, lx, cy + Math.sin(a) * (R + 16) + (Math.abs(Math.cos(a)) > 0.8 ? -8 : 4));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
    ctx.lineTo(cx + Math.cos(a) * (R + 5), cy + Math.sin(a) * (R + 5));
    ctx.strokeStyle = ink3;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const strengths = strengthsAt(week);
  const pos = new Map<number, { x: number; y: number; s: number }>();
  for (const [id, s] of strengths) {
    if (s < L[0] * 0.6) continue;
    const a = view.angle.get(id);
    if (a === undefined) continue;
    const r = radiusFor(s) * R;
    pos.set(id, { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, s });
  }

  // Friendships among the people you know.
  const snap = view.data.snapshots[snapIndex(week)];
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.09;
  ctx.strokeStyle = ink2;
  ctx.beginPath();
  for (const [a, b] of snap.edges) {
    if (a === hoverId || b === hoverId) continue;
    const p = pos.get(a);
    const q = pos.get(b);
    if (!p || !q) continue;
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  const linked = new Set<number>();
  if (hoverId >= 0 && pos.has(hoverId)) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.25;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    const p = pos.get(hoverId)!;
    for (const [a, b] of snap.edges) {
      if (a !== hoverId && b !== hoverId) continue;
      const q = pos.get(a === hoverId ? b : a);
      if (!q) continue;
      linked.add(a === hoverId ? b : a);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // People.
  nodesDrawn = [];
  const labels: { x: number; y: number; text: string; strong: boolean; rank: number }[] = [];
  const partner = view.data.ego.partner;
  for (const [id, p] of pos) {
    const person = view.people.get(id)!;
    const lv = levelOf(p.s);
    const r = 3 + lv * 0.9;
    const isPartner = id === partner && (view.data.ego.partnerWeek === null || week >= view.data.ego.partnerWeek);
    const kin = person.kin && (id !== partner || isPartner);
    ctx.globalAlpha = p.s < L[0] ? 0.35 : hoverId >= 0 && id !== hoverId && !linked.has(id) ? 0.4 : 1;
    ctx.fillStyle = cityColors[cityAt(person.cities, week)] ?? ink3;
    ctx.strokeStyle = surface;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (kin) {
      const d = r + 1.5;
      ctx.moveTo(p.x, p.y - d);
      ctx.lineTo(p.x + d, p.y);
      ctx.lineTo(p.x, p.y + d);
      ctx.lineTo(p.x - d, p.y);
      ctx.closePath();
    } else ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    if (isPartner) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5.5, 0, Math.PI * 2);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    nodesDrawn.push({ id, x: p.x, y: p.y, r });
    if (lv >= 4 || isPartner || id === hoverId || linked.has(id)) {
      labels.push({
        x: p.x, y: p.y - r - 5, text: person.name.split(' ')[0] + (isPartner ? ' ♥' : ''),
        strong: id === hoverId || isPartner, rank: (id === hoverId ? 3 : isPartner ? 2 : 0) + p.s,
      });
    }
  }

  // You, in the middle.
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.strokeStyle = surface;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fill();
  labels.push({ x: cx, y: cy - 14, text: 'You', strong: true, rank: 10 });

  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  for (const l of ringLabels) {
    ctx.strokeStyle = surface;
    ctx.lineWidth = 4;
    ctx.strokeText(l.text, cx, l.y);
    ctx.fillStyle = ink3;
    ctx.fillText(l.text, cx, l.y);
  }
  // Most important labels first; skip any that would sit on top of one already drawn.
  const boxes: { x0: number; x1: number; y: number }[] = [];
  for (const l of labels.sort((a, b) => b.rank - a.rank)) {
    ctx.font = `${l.strong ? '600 ' : ''}11.5px system-ui, sans-serif`;
    const half = ctx.measureText(l.text).width / 2 + 3;
    if (boxes.some((b) => Math.abs(b.y - l.y) < 13 && l.x - half < b.x1 && l.x + half > b.x0)) continue;
    boxes.push({ x0: l.x - half, x1: l.x + half, y: l.y });
    ctx.strokeStyle = surface;
    ctx.lineWidth = 3;
    ctx.strokeText(l.text, l.x, l.y);
    ctx.fillStyle = l.strong ? ink : ink2;
    ctx.fillText(l.text, l.x, l.y);
  }
}

function personTip(id: number): string {
  const p = view.people.get(id)!;
  const s = strengthsAt(week).get(id) ?? 0;
  const isPartner = id === view.data.ego.partner && (view.data.ego.partnerWeek === null || week >= view.data.ego.partnerWeek);
  const role = isPartner ? 'your partner' : p.kin && id !== view.data.ego.partner ? 'family' : LEVEL_NAMES[levelOf(s)];
  const how =
    p.ctx === 'family' ? 'Family'
    : p.ctx === 'childhood' ? 'You grew up together'
    : `Met in ${yearOf(p.met)}` +
      (p.ctx === 'work' ? ` at work (${p.venue})` : p.ctx === 'club' ? ` at ${p.venue}` : p.ctx === 'hangout' ? ` by chance at ${p.venue}` : p.via ? ` through ${p.via}` : ' through friends') +
      (p.met >= 0 && p.p < 0.2 ? `, ${formatOdds(p.p)} that week` : '');
  return (
    `<b>${esc(p.name)}, ${yearOf(week) - p.born}</b>` +
    `<span class="muted">${esc(role)} · lives in ${esc(view.data.cities[cityAt(p.cities, week)])}</span>` +
    `${esc(p.trait[0].toUpperCase() + p.trait.slice(1))}. Into ${esc(p.hobbies.join(', '))}.<br>${esc(how)}.` +
    (p.kin ? '' : `<br>How well you fit: ${Math.round(p.compat * 100)} out of 100.`)
  );
}

canvas.addEventListener('pointermove', (ev) => {
  const r = canvas.getBoundingClientRect();
  const x = ev.clientX - r.left;
  const y = ev.clientY - r.top;
  let best = -1;
  let bestD = 14 * 14;
  for (const n of nodesDrawn) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n.id;
    }
  }
  if (best !== hoverId) {
    hoverId = best;
    drawGraph();
  }
  if (best >= 0) showTip(personTip(best), ev.clientX, ev.clientY);
  else hideTip();
});
canvas.addEventListener('pointerleave', () => {
  hoverId = -1;
  hideTip();
  drawGraph();
});

// ------------------------------------------------------------- now and feed

let feedItems: HTMLLIElement[] = [];
let lastCurrent = -2;

function buildFeed(): void {
  const feed = $('feed');
  feedItems = view.data.highlights.map((h) => {
    const li = document.createElement('li');
    if (h.scaffold) li.classList.add('scaffold');
    li.innerHTML = `<span class="when">${yearOf(h.week)} · ${ageAt(h.week)}</span><span class="what">${esc(h.text)}</span>`;
    li.addEventListener('click', () => setWeek(h.week));
    return li;
  });
  feed.replaceChildren(...feedItems);
  lastCurrent = -2;
}

function updateNow(): void {
  const d = view.data;
  const t = view.tiers[snapIndex(week)];
  const partner = d.ego.partner >= 0 && (d.ego.partnerWeek === null || week >= d.ego.partnerWeek) ? view.people.get(d.ego.partner)?.name ?? '—' : 'Single';
  const tile = (k: string, v: string | number, cls = '') => `<div class="tile ${cls}"><div class="k">${k}</div><div class="v ${typeof v === 'string' && v.length > 9 ? 'small' : ''}">${esc(String(v))}</div></div>`;
  $('now').innerHTML =
    tile('Year', yearOf(week)) + tile('Age', ageAt(week)) + tile('Lives in', d.cities[cityAt(d.ego.cities, week)]) + tile('Partner', partner) +
    TIER_LABELS.map((l, i) => tile(l, t[i])).join('');

  const hs = d.highlights;
  let current = -1;
  for (let i = 0; i < hs.length; i++) if (hs[i].week <= week) current = i;
  if (current === lastCurrent) return;
  lastCurrent = current;
  feedItems.forEach((li, i) => {
    li.classList.toggle('future', i > current);
    li.classList.toggle('current', i === current);
  });
  const li = feedItems[Math.max(0, current)];
  const feed = $('feed');
  if (li) feed.scrollTo({ top: li.offsetTop - feed.clientHeight / 2 + li.clientHeight / 2, behavior: 'auto' });
}

// --------------------------------------------------------------------- loop

const ctx: Ctx = {
  view: () => view,
  week: () => week,
  playing: () => playing,
  yearOf, ageAt, cityAt, levelOf, strengthsAt, snapIndex, personTip, showTip,
  hideTip: () => hideTip(),
};
const scenes: Partial<Record<Tab, Scene>> = {
  walk: createWalk($('view-walk'), ctx),
  map: createMap($('view-map'), ctx),
};

/** The user jumped to a point in time. */
function setWeek(w: number): void {
  week = Math.min(view.totalWeeks, Math.max(0, w));
  for (const s of Object.values(scenes)) s.seek();
  render();
}

function render(): void {
  updateTimeline();
  if (tab !== 'circle') return;
  const x = areaScale(week);
  areaPlayhead.setAttribute('x1', String(x));
  areaPlayhead.setAttribute('x2', String(x));
  drawGraph();
  updateNow();
}

function setPlaying(on: boolean): void {
  if (on && week >= view.totalWeeks) setWeek(0);
  playing = on;
  $('play').textContent = on ? 'Pause' : 'Play';
}

function setTab(next: Tab): void {
  tab = next;
  for (const t of ['walk', 'map', 'circle'] as Tab[]) {
    $(`view-${t}`).hidden = t !== tab;
    $(`tab-${t}`).setAttribute('aria-selected', String(t === tab));
  }
  if (view) buildAll();
}

function tick(dt: number): void {
  if (!view) return;
  const scene = scenes[tab];
  if (playing) {
    const hold = scene ? scene.timeScale() === 0 : false;
    if (!hold) {
      week = Math.min(view.totalWeeks, week + dt * speed * RATE[tab]);
      render();
      if (week >= view.totalWeeks) setPlaying(false);
    }
  }
  scene?.frame(dt * speed);
}

function loop(now: number): void {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  tick(dt);
  requestAnimationFrame(loop);
}

function buildAll(): void {
  buildTimeline();
  if (tab === 'circle') buildArea();
  render();
}

async function load(seed: number): Promise<void> {
  playing = false;
  $('play').textContent = 'Play';
  const data = (await (await fetch(`lives/${seed}.json`)).json()) as LifeExport;
  const people = new Map(data.people.map((p) => [p.id, p]));
  const order = [...data.people].sort((a, b) => a.met - b.met || a.id - b.id);
  const angle = new Map(order.map((p, i) => [p.id, -Math.PI / 2 + (i / order.length) * Math.PI * 2]));
  const L = data.levels;
  const tiers = data.snapshots.map((s) => {
    const t = [0, 0, 0, 0];
    for (const [id, x] of s.nodes) {
      if (people.get(id)?.kin) continue;
      const v = x / 100;
      if (v >= L[3]) t[0]++;
      else if (v >= L[2]) t[1]++;
      else if (v >= L[1]) t[2]++;
      else if (v >= L[0]) t[3]++;
    }
    return t;
  });
  view = { data, people, angle, totalWeeks: data.years * 52, tiers };
  week = Math.min(data.years * 52, Math.max(0, Number(new URLSearchParams(location.search).get('week')) || 0));

  const e = data.ego;
  $('title').textContent = `The life of ${e.name}`;
  const social = e.ext < 0.35 ? 'An introvert' : e.ext < 0.65 ? 'Neither introvert nor extravert' : 'An extravert';
  $('subtitle').textContent =
    `Born ${e.born} in ${data.cities[e.hometown]}. ${social}, ${e.trait}, into ${e.hobbies.join(' and ')}. ` +
    `Over ${data.years} years: met ${data.stats.metDuringLife} people, ${data.stats.becameClose} became close friends, moved ${data.stats.moves} times.`;
  $('city-legend').innerHTML =
    data.cities.map((c, i) => `<span><i class="swatch" style="background:var(--city-${i})"></i>${esc(c)}</span>`).join('') +
    '<span><i class="mark diamond"></i>move, new job or new partner</span>';
  buildFeed();
  for (const sc of Object.values(scenes)) sc.reset();
  buildAll();
  history.replaceState(null, '', `?seed=${seed}&tab=${tab}${week ? `&week=${Math.round(week)}` : ''}`);
}

async function main(): Promise<void> {
  // Read the address before load() tidies it.
  const query = new URLSearchParams(location.search);
  const index = (await (await fetch('lives/index.json')).json()) as { seed: number; name: string }[];
  const select = $<HTMLSelectElement>('seed');
  select.innerHTML = index.map((l) => `<option value="${l.seed}">${esc(l.name)} (seed ${l.seed})</option>`).join('');
  const wanted = Number(new URLSearchParams(location.search).get('seed'));
  const seed = index.some((l) => l.seed === wanted) ? wanted : index[0].seed;
  select.value = String(seed);
  select.addEventListener('change', () => load(Number(select.value)));
  $('play').addEventListener('click', () => setPlaying(!playing));
  $<HTMLSelectElement>('speed').addEventListener('change', (ev) => (speed = Number((ev.target as HTMLSelectElement).value)));
  for (const t of ['walk', 'map', 'circle'] as Tab[]) $(`tab-${t}`).addEventListener('click', () => setTab(t));
  const wantedTab = new URLSearchParams(location.search).get('tab') as Tab | null;
  setTab(wantedTab && ['walk', 'map', 'circle'].includes(wantedTab) ? wantedTab : 'walk');
  window.addEventListener('keydown', (ev) => {
    if (ev.target instanceof HTMLSelectElement) return;
    if (ev.code === 'Space') {
      ev.preventDefault();
      setPlaying(!playing);
    } else if (ev.code === 'ArrowRight') setWeek(week + 13);
    else if (ev.code === 'ArrowLeft') setWeek(week - 13);
  });
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(buildAll, 120);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    for (const sc of Object.values(scenes)) sc.reset();
    render();
  });
  await load(seed);
  if (query.has('play')) setPlaying(true);
  // Testing aid: ?play&advance=2.5 runs the animation forward that many seconds before showing it.
  for (let i = 0, n = Math.round(Number(query.get('advance') ?? 0) * 30); i < n; i++) tick(1 / 30);
  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

main().catch((err) => {
  $('title').textContent = 'No lives to show yet';
  $('subtitle').textContent = `Run "npm run export -- --seeds 1,3,5" first. (${err})`;
});
