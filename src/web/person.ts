// The person card: click anyone and see the two of you as two lines over time.
// The lines run close together when you are close and drift apart when you are not.
// A dotted pair shows where you would be on depth alone, without regular contact.

import { LEVEL_NAMES } from '../sim/highlights';
import type { Ctx } from './types';

const SVG = 'http://www.w3.org/2000/svg';
function el(name: string, attrs: Record<string, string | number> = {}, text?: string): SVGElement {
  const e = document.createElementNS(SVG, name);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (text !== undefined) e.textContent = text;
  return e;
}

const W = 420;
const H = 182;
const LEFT = 10;
const RIGHT = 62;
const TOP = 34;
const BOTTOM = 26;
const MID = TOP + (H - TOP - BOTTOM) / 2;
/** Half the distance between the lines when two people are strangers. */
const GAP = (H - TOP - BOTTOM) / 2 - 3;
const TOUCH = 2;

export interface PersonCard {
  open(id: number): void;
  close(): void;
  /** The playhead moved. */
  update(): void;
  /** A new life was loaded. */
  reset(): void;
  current(): number;
}

export function createPersonCard(root: HTMLElement, ctx: Ctx, seek: (week: number) => void): PersonCard {
  root.innerHTML = `
    <button class="pc-close" type="button" aria-label="Close">×</button>
    <div class="pc-head"></div>
    <div class="pc-chart"></div>
    <div class="legend pc-legend">
      <span><i class="pc-key"></i>you</span>
      <span><i class="pc-key them"></i><span class="pc-name"></span></span>
      <span><i class="pc-key dotted"></i>where you would be without regular contact</span>
    </div>`;
  const head = root.querySelector<HTMLElement>('.pc-head')!;
  const chart = root.querySelector<HTMLElement>('.pc-chart')!;
  root.querySelector('.pc-close')!.addEventListener('click', () => close());
  let id = -1;
  let playhead: SVGElement | undefined;
  let series: { week: number; s: number; d: number }[] = [];
  let x = (w: number) => w;
  let invert = (px: number) => px;

  // One shared scale for everyone, with each circle given the same height, so moving from
  // one circle to the next is a visible step. A stranger is at 0 and the two lines touch at 1.
  const scaled = (closeness: number): number => {
    const stops = [0, ...ctx.view().data.levels, 1];
    const c = Math.min(1, Math.max(0, closeness));
    for (let i = 1; i < stops.length; i++) {
      if (c <= stops[i]) return (i - 1 + (c - stops[i - 1]) / (stops[i] - stops[i - 1])) / (stops.length - 1);
    }
    return 1;
  };
  const half = (closeness: number) => TOUCH + GAP * (1 - scaled(closeness));

  function build(): void {
    const v = ctx.view();
    const person = v.people.get(id);
    chart.innerHTML = '';
    if (!person) return;
    const total = v.totalWeeks;
    const from = Math.max(0, person.met);
    x = (w) => LEFT + (w / total) * (W - LEFT - RIGHT);
    invert = (px) => ((px - LEFT) / (W - LEFT - RIGHT)) * total;
    series = v.data.snapshots
      .filter((s) => s.week >= from)
      .map((s) => {
        const n = s.nodes.find((row) => row[0] === id);
        return { week: s.week, s: n ? n[1] / 100 : 0, d: n ? n[2] / 100 : 0 };
      });

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
    svg.setAttribute('aria-label', `How close you and ${person.name} were over time`);

    // Decades along the bottom.
    for (let w = 0; w <= total; w += 520) {
      svg.append(el('line', { x1: x(w), x2: x(w), y1: TOP, y2: H - BOTTOM + 4, class: 'pc-grid' }));
      svg.append(el('text', { x: x(w), y: H - 8, class: 'pc-tick', 'text-anchor': w === 0 ? 'start' : 'middle' }, `${ctx.yearOf(w)} · ${ctx.ageAt(w)}`));
    }

    // Where each circle begins, as faint guides on both sides, named once on the left.
    v.data.levels.forEach((level, i) => {
      const g = half(level);
      for (const sign of [-1, 1]) {
        svg.append(el('line', { x1: LEFT, x2: W - RIGHT, y1: MID + sign * g, y2: MID + sign * g, class: 'pc-band' }));
      }
      svg.append(el('text', { x: W - RIGHT + 5, y: MID - g + 3, class: 'pc-band-label' }, LEVEL_NAMES[i + 1]));
    });

    const path = (sign: number, key: 's' | 'd') =>
      series.map((p, i) => `${i ? 'L' : 'M'}${x(p.week).toFixed(1)},${(MID + sign * half(p[key])).toFixed(1)}`).join('');
    if (series.length > 1) {
      svg.append(el('path', { d: path(-1, 'd'), class: 'pc-line pc-depth pc-you' }));
      svg.append(el('path', { d: path(1, 'd'), class: 'pc-line pc-depth pc-them' }));
      svg.append(el('path', { d: path(-1, 's'), class: 'pc-line pc-you' }));
      svg.append(el('path', { d: path(1, 's'), class: 'pc-line pc-them' }));
    }
    if (person.met > 0) {
      svg.append(el('text', { x: x(from), y: TOP - 16, class: 'pc-tick', 'text-anchor': x(from) > W - RIGHT - 40 ? 'end' : 'start' }, `met ${ctx.yearOf(from)}`));
    }

    // Moments the two of you shared, along the top.
    for (const h of v.data.highlights) {
      if (!h.people.includes(id)) continue;
      const dot = el('circle', { cx: x(h.week), cy: TOP - 6, r: 3, class: 'pc-moment' });
      dot.addEventListener('pointermove', (ev) => {
        ev.stopPropagation();
        ctx.showTip(`<b>${ctx.yearOf(h.week)} · age ${ctx.ageAt(h.week)}</b>${h.text.replace(/[&<>]/g, '')}`, (ev as PointerEvent).clientX, (ev as PointerEvent).clientY);
      });
      dot.addEventListener('pointerleave', () => ctx.hideTip());
      dot.addEventListener('click', (ev) => {
        ev.stopPropagation();
        seek(h.week);
      });
      svg.append(dot);
    }

    playhead = el('line', { y1: TOP - 6, y2: H - BOTTOM + 4, class: 'pc-playhead' });
    svg.append(playhead);

    const weekAt = (ev: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      return Math.min(total, Math.max(0, invert(((ev.clientX - r.left) / r.width) * W)));
    };
    let dragging = false;
    svg.addEventListener('pointerdown', (ev) => {
      dragging = true;
      svg.setPointerCapture((ev as PointerEvent).pointerId);
      seek(weekAt(ev as PointerEvent));
    });
    svg.addEventListener('pointerup', () => (dragging = false));
    svg.addEventListener('pointermove', (ev) => {
      const e = ev as PointerEvent;
      const w = weekAt(e);
      if (dragging) seek(w);
      if (!series.length || w < series[0].week) return ctx.hideTip();
      let best = series[0];
      for (const p of series) if (Math.abs(p.week - w) < Math.abs(best.week - w)) best = p;
      const lone = LEVEL_NAMES[ctx.levelOf(best.d)];
      ctx.showTip(
        `<b>${ctx.yearOf(best.week)} · age ${ctx.ageAt(best.week)}</b>` +
          `${LEVEL_NAMES[ctx.levelOf(best.s)]}<span class="muted">without regular contact: ${lone}</span>`,
        e.clientX, e.clientY,
      );
    });
    svg.addEventListener('pointerleave', () => ctx.hideTip());
    chart.append(svg);
  }

  function update(): void {
    if (id < 0) return;
    head.innerHTML = ctx.personTip(id);
    root.querySelector('.pc-name')!.textContent = ctx.view().people.get(id)?.name.split(' ')[0] ?? '';
    if (playhead) {
      const px = x(ctx.week());
      playhead.setAttribute('x1', String(px));
      playhead.setAttribute('x2', String(px));
    }
  }

  function close(): void {
    id = -1;
    root.hidden = true;
  }

  return {
    open(next) {
      if (!ctx.view().people.has(next)) return;
      id = next;
      root.hidden = false;
      build();
      update();
    },
    close,
    update,
    reset: close,
    current: () => id,
  };
}
