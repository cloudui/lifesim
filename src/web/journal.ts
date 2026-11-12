// The Journal view: the reading page of the game. Who this life belongs to, how their
// circle grew and shrank, and every moment in order. The people are in the People view.

import type { Ctx, Scene } from './types';

const SVG = 'http://www.w3.org/2000/svg';
function el(name: string, attrs: Record<string, string | number> = {}, text?: string): SVGElement {
  const e = document.createElementNS(SVG, name);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (text !== undefined) e.textContent = text;
  return e;
}
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

export const TIER_LABELS = ['Inner circle', 'Close friends', 'Friends', 'Acquaintances'];

export function createJournal(root: HTMLElement, ctx: Ctx, seek: (week: number) => void): Scene {
  root.innerHTML = `
    <div class="journal">
      <div class="j-col">
        <section class="panel">
          <h2 class="j-name"></h2>
          <p class="j-about"></p>
          <div class="j-stats"></div>
        </section>
        <section class="panel">
          <h3>Your circle over time</h3>
          <div class="j-area chart"></div>
          <div class="pixel-legend j-tier-legend"></div>
        </section>
      </div>
      <section class="panel j-moments">
        <h3>Moments</h3>
        <ol class="j-feed"></ol>
      </section>
    </div>`;
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const feed = q<HTMLOListElement>('.j-feed');
  let feedItems: HTMLLIElement[] = [];
  let lastCurrent = -2;
  let areaPlayhead: SVGElement | undefined;
  let areaX = (w: number) => w;
  let lastWeek = -1;

  function buildSummary(): void {
    const v = ctx.view();
    const d = v.data;
    const e = d.ego;
    q('.j-name').textContent = e.name;
    const social = e.ext < 0.35 ? 'An introvert' : e.ext < 0.65 ? 'Neither introvert nor extravert' : 'An extravert';
    q('.j-about').textContent = `Born ${e.born} in ${d.cities[e.hometown]}. ${social}, ${e.trait}, into ${e.hobbies.join(' and ')}.`;
    const s = d.stats;
    const stat = (k: string, val: string | number) => `<div class="stat"><b>${esc(String(val))}</b><span>${esc(k)}</span></div>`;
    q('.j-stats').innerHTML =
      stat('years', d.years) + stat('people met', s.metDuringLife) + stat('became friends', s.becameFriends) +
      stat('close friends', s.becameClose) + stat('inner circle', s.becameInner) + stat('moves', s.moves) +
      stat('job changes', s.jobs) + stat(s.partneredAt === null ? 'never partnered' : 'age partnered', s.partneredAt ?? '—');
  }

  function buildArea(): void {
    const v = ctx.view();
    const host = q('.j-area');
    const W = Math.max(280, host.clientWidth || 480);
    const H = 170;
    const padL = 30;
    const padR = 8;
    const padT = 8;
    const padB = 22;
    const snaps = v.data.snapshots;
    const totals = v.tiers.map((t) => t[0] + t[1] + t[2] + t[3]);
    const max = Math.max(10, ...totals);
    const step = max > 160 ? 50 : max > 80 ? 25 : max > 30 ? 10 : 5;
    const top = Math.ceil(max / step) * step;
    const x = (w: number) => padL + (w / v.totalWeeks) * (W - padL - padR);
    const y = (val: number) => padT + (1 - val / top) * (H - padT - padB);
    areaX = x;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': 'Circle sizes over time' });
    for (let val = 0; val <= top; val += step) {
      svg.append(el('line', { x1: padL, x2: W - padR, y1: y(val), y2: y(val), class: 'gridline' }));
      svg.append(el('text', { x: padL - 6, y: y(val) + 4, 'text-anchor': 'end' }, String(val)));
    }
    for (let yr = 0; yr <= v.data.years; yr += 10) {
      const anchor = yr === 0 ? 'start' : yr === v.data.years ? 'end' : 'middle';
      svg.append(el('text', { x: x(yr * 52), y: H - 5, 'text-anchor': anchor }, `age ${ctx.ageAt(yr * 52)}`));
    }
    // Stacked bands, innermost at the bottom. Drawn outermost first so each sits on top of the last.
    for (let tier = 3; tier >= 0; tier--) {
      const height = (i: number) => v.tiers[i].slice(0, tier + 1).reduce((a, b) => a + b, 0);
      const pts = snaps.map((s, i) => `${x(s.week).toFixed(1)},${y(height(i)).toFixed(1)}`);
      svg.append(el('path', {
        d: `M${x(0)},${y(0)} L${pts.join(' L')} L${x(v.totalWeeks)},${y(0)} Z`,
        fill: `var(--tier-${tier})`, stroke: 'var(--surface)', 'stroke-width': 1.5, 'stroke-linejoin': 'round',
      }));
    }
    areaPlayhead = el('line', { y1: padT, y2: H - padB, class: 'playhead' });
    svg.append(areaPlayhead);

    let dragging = false;
    const at = (ev: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      return Math.min(v.totalWeeks, Math.max(0, ((px - padL) / (W - padL - padR)) * v.totalWeeks));
    };
    svg.addEventListener('pointerdown', (ev) => {
      dragging = true;
      svg.setPointerCapture((ev as PointerEvent).pointerId);
      seek(at(ev as PointerEvent));
    });
    svg.addEventListener('pointerup', () => (dragging = false));
    svg.addEventListener('pointermove', (ev) => {
      const e = ev as PointerEvent;
      const w = at(e);
      if (dragging) seek(w);
      const t = v.tiers[ctx.snapIndex(w)];
      ctx.showTip(`<b>${ctx.yearOf(w)} · age ${ctx.ageAt(w)}</b>` + TIER_LABELS.map((l, i) => `${l}: ${t[i]}`).join('<br>'), e.clientX, e.clientY);
    });
    svg.addEventListener('pointerleave', () => ctx.hideTip());
    host.replaceChildren(svg);
    q('.j-tier-legend').innerHTML = TIER_LABELS.map((l, i) => `<span><i style="background:var(--tier-${i})"></i>${l}</span>`).join('');
  }

  function buildFeed(): void {
    const v = ctx.view();
    feedItems = v.data.highlights.map((h) => {
      const li = document.createElement('li');
      if (h.scaffold) li.classList.add('scaffold');
      li.innerHTML = `<span class="when">${ctx.yearOf(h.week)} · ${ctx.ageAt(h.week)}</span><span class="what">${esc(h.text)}</span>`;
      li.addEventListener('click', () => seek(h.week));
      return li;
    });
    feed.replaceChildren(...feedItems);
    lastCurrent = -2;
  }

  function update(): void {
    const week = ctx.week();
    if (areaPlayhead) {
      const x = areaX(week);
      areaPlayhead.setAttribute('x1', String(x));
      areaPlayhead.setAttribute('x2', String(x));
    }
    const hs = ctx.view().data.highlights;
    let current = -1;
    for (let i = 0; i < hs.length; i++) if (hs[i].week <= week) current = i;
    if (current === lastCurrent) return;
    lastCurrent = current;
    feedItems.forEach((li, i) => {
      li.classList.toggle('future', i > current);
      li.classList.toggle('current', i === current);
    });
    const li = feedItems[Math.max(0, current)];
    if (li) feed.scrollTo({ top: li.offsetTop - feed.clientHeight / 2 + li.clientHeight / 2, behavior: 'auto' });
  }

  function layout(): void {
    const { top, bottom } = ctx.insets();
    const j = q('.journal');
    j.style.top = `${top}px`;
    j.style.bottom = `${bottom}px`;
  }

  return {
    reset() {
      layout();
      buildSummary();
      buildFeed();
      buildArea();
      lastWeek = -1;
    },
    seek() {
      lastWeek = -1;
    },
    frame() {
      if (Math.abs(ctx.week() - lastWeek) < 0.5) return;
      lastWeek = ctx.week();
      update();
    },
    resize() {
      layout();
      buildArea();
      lastWeek = -1;
    },
    timeScale: () => 1,
  };
}
