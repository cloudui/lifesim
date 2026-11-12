// The game shell. One full-window stage shows the current view; the HUD floats on top:
// who and when at the top left, the view tabs in the middle, the dialogue box and the
// timeline scrubber along the bottom. A title screen opens a life and an end card closes it.
// Reads only the LifeExport JSON; never touches the simulation.

import type { LifeExport } from '../sim/export';
import { formatOdds, LEVEL_NAMES } from '../sim/highlights';
import '@fontsource/vt323';
import { createCircle } from './circle';
import { createJournal } from './journal';
import { createPeople } from './people';
import { portrait } from './pixel';
import { createMap } from './map';
import { createPersonCard } from './person';
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
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

type Tab = 'walk' | 'map' | 'circle' | 'people' | 'journal';
const TABS: Tab[] = ['walk', 'map', 'circle', 'people', 'journal'];
/** Weeks of life per second of playback. The pixel views run slower so moments can land. */
const RATE: Record<Tab, number> = { walk: 30, map: 45, circle: 70, people: 70, journal: 70 };
const SPEEDS = [1, 2, 4, 8];

let view: View;
let lives: { seed: number; name: string; born: number; hometown: string }[] = [];
let week = 0;
let playing = false;
let lastFrame = 0;
let speed = 1;
let tab: Tab = 'walk';

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
function partnerAt(w: number): { id: number; from: number | null } | null {
  for (const p of view.data.ego.partners) {
    if ((p.from === null || w >= p.from) && (p.to === null || w < p.to)) return p;
  }
  return null;
}
function wasPartner(id: number): boolean {
  return view.data.ego.partners.some((p) => p.id === id);
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

/** How the protagonist came to know someone, as a short phrase. */
function howMet(id: number): string {
  const p = view.people.get(id)!;
  return p.ctx === 'family' ? 'Family'
    : p.ctx === 'childhood' ? 'You grew up together'
    : `Met in ${yearOf(p.met)}` +
      (p.ctx === 'work' ? ` at work (${p.venue})` : p.ctx === 'club' ? ` at ${p.venue}` : p.ctx === 'hangout' ? ` by chance at ${p.venue}` : p.via ? ` through ${p.via}` : ' through friends') +
      (p.met >= 0 && p.p < 0.2 ? `, ${formatOdds(p.p)} that week` : '');
}

function personTip(id: number): string {
  const p = view.people.get(id)!;
  const s = strengthsAt(week).get(id) ?? 0;
  const isPartner = id === partnerAt(week)?.id;
  const isEx = view.data.ego.partners.some((x) => x.id === id && x.to !== null && week >= x.to);
  const gone = p.died !== null && week >= p.died;
  const arc = view.arcs.get(id);
  const role = isPartner ? 'your partner'
    : isEx ? 'a former partner'
    : wasPartner(id) ? 'your late partner'
    : p.kin ? (arc?.role === 'family' ? arc.label : 'family')
    : gone ? 'a friend' : LEVEL_NAMES[levelOf(s)];
  const where = gone ? `died ${yearOf(p.died!)}` : `lives in ${view.data.cities[cityAt(p.cities, week)]}`;
  return (
    `<b>${esc(p.name)}, ${yearOf(gone ? p.died! : week) - p.born}</b>` +
    `<span class="muted">${esc(role)} · ${esc(where)}</span>` +
    `${esc(p.trait[0].toUpperCase() + p.trait.slice(1))}. Into ${esc(p.hobbies.join(', '))}.<br>${esc(howMet(id))}.` +
    (p.kin ? '' : `<br>How well you fit: ${Math.round(p.compat * 100)} out of 100.`)
  );
}

const hudTop = $('hud-top');
const hudBottom = $('hud-bottom');
function insets(): { top: number; bottom: number } {
  return {
    top: hudTop.getBoundingClientRect().bottom + 8,
    bottom: window.innerHeight - hudBottom.getBoundingClientRect().top + 8,
  };
}

// ----------------------------------------------------------------- timeline

let tlScale = (w: number) => w;
let tlPlayhead: SVGElement;
let tlDims: SVGElement[] = [];
let tlDots: { node: SVGElement; week: number }[] = [];
let tlLanes = new Map<number, SVGElement>();
/** Whether the timeline shows a lane for each person in the cast. Remembered between visits. */
let lanesOn = window.innerHeight >= 700;
try {
  const saved = localStorage.getItem('lanes');
  if (saved !== null) lanesOn = saved === '1';
} catch {
  // Storage can be blocked; the default is fine.
}

function buildTimeline(): void {
  const host = $('timeline');
  const W = Math.max(200, host.clientWidth);
  const pad = 8;
  const bandY = 3;
  const laneTop = 14;
  const total = view.totalWeeks;
  const cast = lanesOn ? view.data.arcs.cast.filter((id) => view.people.has(id) && view.arcs.has(id)) : [];
  // With lanes, the names sit in a gutter on the left; on a narrow screen they sit on the lane itself.
  const narrow = W <= 560;
  const padL = pad + (cast.length && !narrow ? 196 : 0);
  // With lanes, the moments row keeps only life events; each person's moments are on their lane.
  const laneBottom = cast.length ? 26 : 36;
  const LH = 9;
  const LG = narrow ? 14 : 5;
  const castTop = laneBottom + (narrow ? 16 : 6);
  const bottom = cast.length ? castTop + cast.length * (LH + LG) : laneBottom;
  const H = bottom + 14;
  tlScale = (w) => padL + (w / total) * (W - padL - pad);
  const invert = (x: number) => Math.min(total, Math.max(0, ((x - padL) / (W - padL - pad)) * total));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'slider', 'aria-label': 'Timeline: drag to move through the life' });

  // Where the protagonist lived, as the track itself.
  const tl = view.data.ego.cities;
  tl.forEach(([w, c], i) => {
    const x0 = tlScale(w);
    const x1 = tlScale(i + 1 < tl.length ? tl[i + 1][0] : total);
    svg.append(el('rect', { x: x0 + 0.5, y: bandY, width: Math.max(1, x1 - x0 - 1), height: 5, fill: `var(--city-${c})` }));
  });

  // A tick every five years.
  for (let y = 0; y <= view.data.years; y += 5) {
    const x = tlScale(y * 52);
    svg.append(el('line', { x1: x, x2: x, y1: laneTop - 2, y2: bottom + 2, class: 'gridline' }));
    if (W > 520 || y % 10 === 0) {
      const anchor = y === 0 ? 'start' : y === view.data.years ? 'end' : 'middle';
      svg.append(el('text', { x, y: H - 2, 'text-anchor': anchor }, `${view.data.startYear + y}`));
    }
  }

  // Moments, packed into rows so they do not overlap. Life events are diamonds.
  const placed: { x: number; y: number; r: number }[] = [];
  const mid = (laneTop + laneBottom) / 2;
  tlDots = [];
  for (const h of view.data.highlights) {
    if (cast.length && !h.scaffold) continue;
    const r = Math.min(cast.length ? 4.5 : 6, 2 + h.score * 0.32);
    const x = tlScale(h.week);
    // Try spots outward from the middle; if the column is full, overlap at the middle.
    let y = mid;
    for (let k = 0; k < 12; k++) {
      const cand = mid + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 4;
      if (cand - r < laneTop || cand + r > laneBottom) continue;
      if (!placed.some((p) => (p.x - x) ** 2 + (p.y - cand) ** 2 < (p.r + r + 0.5) ** 2)) {
        y = cand;
        break;
      }
    }
    placed.push({ x, y, r });
    const node = h.scaffold
      ? el('rect', { x: x - r * 0.75, y: y - r * 0.75, width: r * 1.5, height: r * 1.5, transform: `rotate(45 ${x} ${y})`, class: `dot scaffold ${h.type}` })
      : el('circle', { cx: x, cy: y, r, class: `dot ${h.type}` });
    node.addEventListener('pointermove', (ev) => {
      const e = ev as PointerEvent;
      showTip(`<b>${yearOf(h.week)} · age ${ageAt(h.week)}</b>${esc(h.text)}`, e.clientX, e.clientY);
    });
    node.addEventListener('pointerleave', hideTip);
    svg.append(node);
    tlDots.push({ node, week: h.week });
  }

  // One lane per person in the cast: when they were in your life, and how close. The band is
  // tall and warm when you are close and thin and cool when you are not. Marks are the turns
  // in their story.
  tlLanes = new Map();
  const L = view.data.levels;
  const snaps = view.data.snapshots;
  const THICK = [LH, 7, 4, 2];
  // Two people in one cast can share a first name; those get a last initial.
  const firstNames = cast.map((id) => view.people.get(id)!.name.split(' ')[0]);
  cast.forEach((id, row) => {
    const p = view.people.get(id)!;
    const arc = view.arcs.get(id)!;
    const y = castTop + row * (LH + LG);
    const parts = p.name.split(' ');
    const first = firstNames.filter((n) => n === parts[0]).length > 1 && parts[1] ? `${parts[0]} ${parts[1][0]}.` : parts[0];
    // Every lane says who the person is to you, not only their name.
    const role = arc.tag === 'partner' ? ' ♥' : ` · ${arc.tag}`;
    const g = el('g', { class: 'lane' });
    const from = Math.max(0, p.met);
    // The lane ends where the person's life does.
    const until = p.died ?? total;
    g.append(el('line', { x1: tlScale(from), x2: tlScale(until), y1: y + LH / 2, y2: y + LH / 2, class: 'lane-base' }));
    if (p.died !== null) g.append(el('circle', { cx: tlScale(until) + 3, cy: y + LH / 2, r: 2.5, class: 'lane-end' }));
    const tierAt = (i: number): number => {
      const n = snaps[i].nodes.find((r) => r[0] === id);
      const s = n ? n[1] / 100 : 0;
      return s >= L[3] ? 0 : s >= L[2] ? 1 : s >= L[1] ? 2 : s >= L[0] ? 3 : 4;
    };
    let runStart = 0;
    let runTier = -1;
    const flush = (end: number) => {
      if (runTier < 0 || runTier > 3) return;
      const h = THICK[runTier];
      g.append(el('rect', {
        x: tlScale(runStart), y: y + (LH - h) / 2, width: Math.max(1, tlScale(end) - tlScale(runStart)), height: h,
        fill: `var(--tier-${runTier})`,
      }));
    };
    for (let i = 0; i < snaps.length; i++) {
      const t = tierAt(i);
      if (t === runTier) continue;
      flush(snaps[i].week);
      runStart = snaps[i].week;
      runTier = t;
    }
    flush(total);

    // Hovering the lane says who this is and how close you are at that point.
    const hit = el('rect', { x: padL, y: y - LG / 2, width: W - padL - pad, height: LH + LG, class: 'lane-hit' });
    hit.addEventListener('pointermove', (ev) => {
      const e = ev as PointerEvent;
      const r = svg.getBoundingClientRect();
      const w = invert(((e.clientX - r.left) / r.width) * W);
      const t = w < from ? 4 : tierAt(snapIndex(w));
      const state = w < from ? 'not in your life yet' : p.died !== null && w >= p.died ? `died ${yearOf(p.died)}` : t === 4 ? 'out of touch' : ['inner circle', 'close friend', 'friend', 'acquaintance'][t];
      showTip(`<b>${esc(p.name)}</b><span class="muted">${esc(arc.label)}</span>${yearOf(w)}: ${state}`, e.clientX, e.clientY);
    });
    hit.addEventListener('pointerleave', hideTip);
    g.append(hit);

    const seenWeeks = new Set<number>();
    for (const b of arc.beats) {
      if (b.week <= 0 || b.week >= total || seenWeeks.has(b.week)) continue;
      seenWeeks.add(b.week);
      const mark = el('rect', { x: tlScale(b.week) - 1.5, y: y - 1.5, width: 3, height: LH + 3, rx: 1, class: 'lane-beat' });
      mark.addEventListener('pointermove', (ev) => {
        const e = ev as PointerEvent;
        e.stopPropagation();
        showTip(`<b>${esc(first)} · ${yearOf(b.week)}</b>${esc(b.text)}`, e.clientX, e.clientY);
      });
      mark.addEventListener('pointerleave', hideTip);
      mark.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
        setWeek(b.week);
        openPerson(id);
      });
      g.append(mark);
    }

    const name = narrow
      ? el('text', { x: pad + 2, y: y - 1, class: 'lane-name inside' }, first + role)
      : el('text', { x: padL - 8, y: y + LH - 0.5, 'text-anchor': 'end', class: 'lane-name' }, first + role);
    name.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      openPerson(id);
    });
    g.append(name);
    svg.append(g);
    tlLanes.set(id, g);
  });

  // Everything to the right of the playhead is dimmed.
  tlDims = [el('rect', { y: bandY, height: 5, class: 'tl-dim' })];
  if (cast.length) tlDims.push(el('rect', { y: castTop - 2, height: bottom - castTop + 2, class: 'tl-dim lanes' }));
  svg.append(...tlDims);

  tlPlayhead = el('g', { class: 'playhead' });
  tlPlayhead.append(el('line', { x1: 0, x2: 0, y1: 0, y2: bottom + 2 }));
  tlPlayhead.append(el('rect', { x: -3, y: -1, width: 6, height: 11 }));
  svg.append(tlPlayhead);

  let dragging = false;
  const seekTo = (ev: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    setWeek(invert(((ev.clientX - r.left) / r.width) * W));
  };
  svg.addEventListener('pointerdown', (ev) => {
    dragging = true;
    svg.setPointerCapture((ev as PointerEvent).pointerId);
    seekTo(ev as PointerEvent);
  });
  svg.addEventListener('pointermove', (ev) => {
    const e = ev as PointerEvent;
    if (dragging) seekTo(e);
  });
  svg.addEventListener('pointerup', () => (dragging = false));
  host.replaceChildren(svg);
  $('lanes').setAttribute('aria-pressed', String(lanesOn));
}

/** Open someone's card and mark their lane. */
function openPerson(id: number): void {
  card.open(id);
  updateTimeline();
}

function updateTimeline(): void {
  const x = tlScale(week);
  tlPlayhead.setAttribute('transform', `translate(${x},0)`);
  for (const d of tlDims) {
    d.setAttribute('x', String(x));
    d.setAttribute('width', String(Math.max(0, tlScale(view.totalWeeks) - x)));
  }
  for (const d of tlDots) {
    d.node.classList.toggle('past', d.week <= week);
    d.node.classList.toggle('now', d.week <= week && week - d.week < 26);
  }
  const open = card.current();
  for (const [id, g] of tlLanes) g.classList.toggle('open', id === open);
}

// ---------------------------------------------------------- HUD and dialogue

let hudKey = '';
let dialogIdx = -3;

function updateHud(): void {
  const d = view.data;
  const t = view.tiers[snapIndex(week)];
  const p = partnerAt(week);
  const partner = p ? view.people.get(p.id)?.name.split(' ')[0] : null;
  const key = `${yearOf(week)}|${cityAt(d.ego.cities, week)}|${partner}|${t.join(',')}`;
  if (key === hudKey) return;
  hudKey = key;
  $('hud-when').innerHTML =
    `<span class="y">${yearOf(week)}</span> · age ${ageAt(week)} · ` +
    `<span class="city" style="color:var(--city-${cityAt(d.ego.cities, week)})">${esc(d.cities[cityAt(d.ego.cities, week)])}</span>` +
    (partner ? ` · <span class="heart">♥</span> ${esc(partner)}` : '');
  const chip = (i: number, label: string) => `<span><i style="background:var(--tier-${i})"></i>${t[i]} ${label}</span>`;
  $('hud-circle').innerHTML = chip(0, 'inner') + chip(1, 'close') + chip(2, 'friends') + chip(3, 'acquaintances');
}

function updateDialog(): void {
  const scene = scenes[tab];
  let idx = scene.caption ? scene.caption() : -1;
  if (!scene.caption || idx < -1) {
    idx = -1;
    const hs = view.data.highlights;
    for (let i = 0; i < hs.length && hs[i].week <= week; i++) idx = i;
  }
  if (idx === dialogIdx) return;
  dialogIdx = idx;
  const h = view.data.highlights[idx];
  const box = $('dialog');
  box.classList.toggle('empty', !h);
  box.classList.remove('pop');
  void box.offsetWidth;
  if (h) box.classList.add('pop');
  // Say who the moment is about, with their face, when it is someone in the cast.
  const who = h?.people.map((id) => view.arcs.get(id)).find((a) => a?.cast);
  const whoName = who ? view.people.get(who.id)?.name.split(' ')[0] : undefined;
  box.querySelector('.dialog-when')!.innerHTML = h
    ? `${yearOf(h.week)} · age ${ageAt(h.week)}` + (who && whoName ? `<small>${esc(whoName)} · ${esc(who.tag)}</small>` : '')
    : '';
  const face = box.querySelector<HTMLElement>('.dialog-face')!;
  face.replaceChildren();
  face.hidden = !who;
  if (who) face.append(portrait(who.id, 3));
  box.querySelector('.dialog-text')!.textContent = h ? h.text : playing ? '' : 'Press play to start walking through this life.';
}

// ------------------------------------------------------ title and end screens

function showTitle(on: boolean): void {
  $('title-screen').hidden = !on;
  if (on) {
    setPlaying(false);
    $('end-screen').hidden = true;
  }
}

function fillTitle(): void {
  const d = view.data;
  const e = d.ego;
  $('title-name').textContent = e.name;
  const social = e.ext < 0.35 ? 'an introvert' : e.ext < 0.65 ? 'neither introvert nor extravert' : 'an extravert';
  $('title-sub').textContent =
    `Born ${e.born} in ${d.cities[e.hometown]}: ${social}, ${e.trait}, into ${e.hobbies.join(' and ')}. ` +
    `Follow ${e.name.split(' ')[0]} through ${d.years} years of meeting people, losing touch and finding them again.`;
  // The opening credits: the people this story turns out to be about, by what they are to you.
  $('title-cast').replaceChildren(
    ...d.arcs.cast.map((id) => {
      const arc = view.arcs.get(id);
      const p = view.people.get(id);
      const item = document.createElement('div');
      item.className = 'title-person';
      if (!arc || !p) return item;
      const label = document.createElement('span');
      label.innerHTML = `<b>${esc(p.name.split(' ')[0])}</b><small>${esc(arc.tag)}</small>`;
      item.append(portrait(id, 2), label);
      return item;
    }),
  );
  $('lives').replaceChildren(
    ...lives.map((l) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = l.seed === d.seed ? 'life current' : 'life';
      b.innerHTML = `<b>${esc(l.name)}</b><small>born ${l.born} · ${esc(l.hometown)}</small>`;
      b.addEventListener('click', () => {
        if (l.seed !== view.data.seed) load(l.seed, true);
      });
      return b;
    }),
  );
}

function showEnd(): void {
  const d = view.data;
  const s = d.stats;
  const first = d.ego.name.split(' ')[0];
  $('end-eyebrow').textContent = `${d.startYear} – ${d.startYear + d.years} · ${d.years} years`;
  $('end-title').textContent = `${first} at ${ageAt(view.totalWeeks)}`;
  const cand = d.people.filter((p) => (!p.kin || wasPartner(p.id)) && p.met >= 0);
  const most = [...cand].sort((a, b) => b.peak - a.peak)[0];
  const luckiest = cand.filter((p) => p.peak >= d.levels[2]).sort((a, b) => a.p - b.p)[0];
  const end = partnerAt(view.totalWeeks);
  const lines: string[] = [
    `<p><b>${s.metDuringLife}</b> new people met. <b>${s.becameClose}</b> became close friends${s.becameInner ? `, <b>${s.becameInner}</b> made the inner circle` : ''}.</p>`,
  ];
  if (most) lines.push(`<p>The one who mattered most: <b>${esc(most.name)}</b>. ${esc(howMet(most.id))}.</p>`);
  if (luckiest && luckiest !== most && luckiest.p < 0.2) {
    lines.push(`<p>Luckiest meeting: <b>${esc(luckiest.name.split(' ')[0])}</b>, ${esc(formatOdds(luckiest.p))}.</p>`);
  }
  lines.push(
    `<p>${s.moves ? `Moved ${s.moves === 1 ? 'once' : `${s.moves} times`}` : 'Never moved'}, changed jobs ${s.jobs === 1 ? 'once' : `${s.jobs} times`}. ` +
      (end ? `Ended the story with ${esc(view.people.get(end.id)?.name.split(' ')[0] ?? 'a partner')}.` : 'Single at the end.') +
      '</p>',
  );
  $('end-lines').innerHTML = lines.join('');
  $('end-screen').hidden = false;
}

// --------------------------------------------------------------------- loop

const ctx: Ctx = {
  view: () => view,
  week: () => week,
  playing: () => playing,
  yearOf, ageAt, cityAt, levelOf, strengthsAt, snapIndex, partnerAt, wasPartner, personTip, showTip, insets,
  hideTip: () => hideTip(),
  openPerson,
};
const card = createPersonCard($('person-card'), ctx, (w) => setWeek(w));
const scenes: Record<Tab, Scene> = {
  walk: createWalk($('view-walk'), ctx),
  map: createMap($('view-map'), ctx),
  circle: createCircle($('view-circle'), ctx),
  people: createPeople($('view-people'), ctx, (w) => setWeek(w)),
  journal: createJournal($('view-journal'), ctx, (w) => setWeek(w)),
};

/** The user jumped to a point in time. */
function setWeek(w: number): void {
  week = Math.min(view.totalWeeks, Math.max(0, w));
  for (const s of Object.values(scenes)) s.seek();
  $('end-screen').hidden = true;
  render();
}

function render(): void {
  updateTimeline();
  updateHud();
  updateDialog();
  card.update();
}

function setPlaying(on: boolean): void {
  if (on && week >= view.totalWeeks) setWeek(0);
  playing = on;
  const b = $('play');
  b.textContent = on ? '❚❚' : '▶';
  b.setAttribute('aria-label', on ? 'Pause' : 'Play');
  document.body.classList.toggle('playing', on);
  if (on) {
    $('title-screen').hidden = true;
    $('end-screen').hidden = true;
  }
}

function setTab(next: Tab): void {
  tab = next;
  for (const t of TABS) {
    $(`view-${t}`).hidden = t !== tab;
    $(`tab-${t}`).setAttribute('aria-selected', String(t === tab));
  }
  document.body.dataset.tab = tab;
  hideTip();
  if (!view) return;
  scenes[tab].resize?.();
  scenes[tab].seek();
  dialogIdx = -3;
  render();
  history.replaceState(null, '', `?seed=${view.data.seed}&tab=${tab}`);
}

function tick(dt: number): void {
  if (!view) return;
  const scene = scenes[tab];
  if (playing && scene.timeScale() !== 0) {
    week = Math.min(view.totalWeeks, week + dt * speed * RATE[tab]);
    if (week >= view.totalWeeks) {
      setPlaying(false);
      showEnd();
    }
  }
  scene.frame(dt * speed);
  render();
}

function loop(now: number): void {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  tick(dt);
  requestAnimationFrame(loop);
}

/** Keep the person card between the HUD bars. */
function placeCard(): void {
  const { top, bottom } = insets();
  const c = $('person-card');
  c.style.top = `${top}px`;
  c.style.maxHeight = `${window.innerHeight - top - bottom}px`;
}

function layoutAll(): void {
  placeCard();
  buildTimeline();
  for (const s of Object.values(scenes)) s.resize?.();
  render();
}

async function load(seed: number, title = false): Promise<void> {
  setPlaying(false);
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
  const arcs = new Map(data.arcs.people.map((a) => [a.id, a]));
  view = { data, people, arcs, angle, totalWeeks: data.years * 52, tiers };
  card.reset();
  week = 0;
  hudKey = '';
  dialogIdx = -3;
  $('hud-name').textContent = data.ego.name;
  document.title = `${data.ego.name} · Life Connections`;
  fillTitle();
  // Fill the HUD first: the scenes measure it to stay clear of it.
  updateHud();
  for (const sc of Object.values(scenes)) sc.reset();
  placeCard();
  buildTimeline();
  scenes[tab].resize?.();
  render();
  if (title) showTitle(true);
  history.replaceState(null, '', `?seed=${seed}&tab=${tab}`);
}

async function main(): Promise<void> {
  const query = new URLSearchParams(location.search);
  lives = (await (await fetch('lives/index.json')).json()) as typeof lives;
  const wanted = Number(query.get('seed'));
  const seed = lives.some((l) => l.seed === wanted) ? wanted : lives[0].seed;

  $('play').addEventListener('click', () => setPlaying(!playing));
  $('speed').addEventListener('click', () => {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    $('speed').textContent = `${speed}×`;
  });
  $('start').addEventListener('click', () => setPlaying(true));
  $('lives-btn').addEventListener('click', () => showTitle($('title-screen').hidden));
  $('end-again').addEventListener('click', () => {
    setWeek(0);
    setPlaying(true);
  });
  $('end-journal').addEventListener('click', () => {
    $('end-screen').hidden = true;
    setTab('journal');
  });
  $('end-next').addEventListener('click', () => {
    const i = lives.findIndex((l) => l.seed === view.data.seed);
    load(lives[(i + 1) % lives.length].seed, true);
  });
  for (const t of TABS) $(`tab-${t}`).addEventListener('click', () => setTab(t));
  $('lanes').addEventListener('click', () => {
    lanesOn = !lanesOn;
    try {
      localStorage.setItem('lanes', lanesOn ? '1' : '0');
    } catch {
      // Not remembered, but it still works for this visit.
    }
    layoutAll();
  });
  const wantedTab = query.get('tab') as Tab | null;
  setTab(wantedTab && TABS.includes(wantedTab) ? wantedTab : 'walk');

  window.addEventListener('keydown', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.code === 'Space') {
      ev.preventDefault();
      setPlaying(!playing);
    } else if (ev.code === 'ArrowRight') setWeek(week + 13);
    else if (ev.code === 'ArrowLeft') setWeek(week - 13);
    else if (ev.code === 'Escape') {
      if (card.current() >= 0) card.close();
      else {
        $('title-screen').hidden = true;
        $('end-screen').hidden = true;
      }
    } else if (/^Digit[1-5]$/.test(ev.code)) setTab(TABS[Number(ev.code.slice(5)) - 1]);
  });
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(layoutAll, 120);
  });

  // Deep links skip the title screen: ?week=1100, ?play, ?person=<id|closest>, ?advance=2.5.
  const deep = ['week', 'play', 'person', 'advance'].some((k) => query.has(k));
  await load(seed, !deep);
  // The pixel font changes the HUD's size once it arrives.
  document.fonts.ready.then(layoutAll);
  if (query.has('week')) setWeek(Number(query.get('week')) || 0);
  if (query.has('person')) {
    const closest = [...view.data.people].filter((p) => !p.kin).sort((x, y) => y.peak - x.peak)[0];
    openPerson(query.get('person') === 'closest' && closest ? closest.id : Number(query.get('person')));
  }
  if (query.has('play')) setPlaying(true);
  // Testing aid: ?play&advance=2.5 runs the animation forward that many seconds before showing it.
  for (let i = 0, n = Math.round(Number(query.get('advance') ?? 0) * 30); i < n; i++) tick(1 / 30);
  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

main().catch((err) => {
  $('hud-name').textContent = 'No lives to show yet';
  $('hud-when').textContent = `Run "npm run export -- --seeds 1,3,5" first. (${err})`;
});
