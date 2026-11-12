// The People view: the life retold as the people in it. First the cast, the handful the
// story is about. Each card is meant to be looked at before it is read: a portrait, who
// they are to you, a strip showing how close you were across the life, and one line for
// where things stand at the playhead. The whole story is one click away. Then how they
// reached you, then a catalog of everyone you ever knew, most relevant first.

import type { ArcExport } from '../sim/export';
import { tierRuns } from './closeness';
import { portrait } from './pixel';
import type { Ctx, Scene } from './types';

const SVG = 'http://www.w3.org/2000/svg';
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

type Filter = 'all' | 'family' | 'close' | 'friends' | 'passing';
const FILTERS: [Filter, string][] = [
  ['all', 'Everyone'], ['family', 'Family'], ['close', 'Close friends'], ['friends', 'Friends'], ['passing', 'Passing through'],
];

interface Card {
  arc: ArcExport;
  el: HTMLElement;
  now: HTMLElement;
  count: HTMLElement;
  playhead: SVGElement;
  beat: number;
}

/** How many of the sorted weeks are at or before w. */
function countUpTo(weeks: number[], w: number): number {
  let lo = 0;
  let hi = weeks.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (weeks[mid] <= w) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function createPeople(root: HTMLElement, ctx: Ctx, seek: (week: number) => void): Scene {
  root.innerHTML = `
    <div class="people">
      <section>
        <h3 class="p-title">The people this story is about</h3>
        <p class="muted p-hint">Each strip is one person across the whole life: taller and warmer when you were closer. Click a name to see the two of you over time.</p>
        <div class="p-cast"></div>
      </section>
      <section class="panel p-threads" hidden>
        <h3>How they reached you</h3>
        <div class="p-thread-list"></div>
      </section>
      <section class="panel">
        <h3>Everyone you knew <span class="p-count"></span></h3>
        <div class="p-tools">
          <input class="p-search" type="search" placeholder="Find someone" aria-label="Find someone by name">
          <div class="p-filters"></div>
        </div>
        <div class="p-list"></div>
      </section>
    </div>`;
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const search = q<HTMLInputElement>('.p-search');
  let filter: Filter = 'all';
  /** Elements that are dim until their week arrives: [week, element]. */
  let timed: [number, HTMLElement][] = [];
  let cards: Card[] = [];
  let rows: { arc: ArcExport; name: string; el: HTMLElement }[] = [];
  let lastWeek = -1;

  const firstWeek = (a: ArcExport) => a.beats[0]?.week ?? 0;
  const tierOf = (id: number): number => {
    const L = ctx.view().data.levels;
    const peak = ctx.view().people.get(id)?.peak ?? 0;
    return peak >= L[3] ? 0 : peak >= L[2] ? 1 : peak >= L[1] ? 2 : 3;
  };

  /** One person across the whole life, as a strip. */
  function strip(a: ArcExport): { svg: SVGElement; playhead: SVGElement } {
    const v = ctx.view();
    const W = 300;
    const H = 14;
    const total = v.totalWeeks;
    const x = (w: number) => (w / total) * W;
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'p-strip');
    const add = (name: string, attrs: Record<string, string | number>) => {
      const e = document.createElementNS(SVG, name);
      for (const k in attrs) e.setAttribute(k, String(attrs[k]));
      svg.append(e);
      return e;
    };
    const p = v.people.get(a.id)!;
    add('line', { x1: x(Math.max(0, p.met)), x2: x(p.died ?? total), y1: H / 2, y2: H / 2, class: 'lane-base' });
    const THICK = [12, 9, 5, 2];
    for (const r of tierRuns(v.data, a.id)) {
      const h = THICK[r.tier];
      add('rect', { x: x(r.from), y: (H - h) / 2, width: Math.max(0.5, x(r.to) - x(r.from)), height: h, fill: `var(--tier-${r.tier})` });
    }
    const playhead = add('line', { y1: 0, y2: H, class: 'p-strip-now' });
    svg.addEventListener('click', (ev) => {
      const r = svg.getBoundingClientRect();
      seek(Math.min(total, Math.max(0, (((ev as MouseEvent).clientX - r.left) / r.width) * total)));
    });
    return { svg, playhead };
  }

  function buildCast(): void {
    const v = ctx.view();
    const host = q('.p-cast');
    const cast = v.data.arcs.cast.map((id) => v.arcs.get(id)).filter((a): a is ArcExport => !!a);
    cards = cast.map((a) => {
      const p = v.people.get(a.id)!;
      const card = document.createElement('article');
      card.className = 'panel p-card';
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'p-head';
      const years = a.closeFrom >= 0 && a.role !== 'family'
        ? ` · close ${ctx.yearOf(a.closeFrom)}${ctx.yearOf(a.closeTo) > ctx.yearOf(a.closeFrom) ? `–${ctx.yearOf(a.closeTo)}` : ''}`
        : '';
      const text = document.createElement('span');
      text.innerHTML =
        `<small class="p-role">${esc(a.label)}</small>` +
        `<b>${esc(p.name)}${ctx.wasPartner(a.id) ? ' ♥' : ''}</b>` +
        `<small>${a.shape ? esc(a.shape) : ''}${a.shape && years ? ' · ' : ''}${years.replace(/^ · /, '')}</small>`;
      head.append(portrait(a.id, 3), text);
      head.addEventListener('click', () => ctx.openPerson(a.id));

      const s = strip(a);
      const now = document.createElement('p');
      now.className = 'p-now';
      const count = document.createElement('p');
      count.className = 'p-seen muted';

      const more = document.createElement('details');
      more.className = 'p-more';
      const summary = document.createElement('summary');
      summary.textContent = `The whole story · ${a.beats.length} lines`;
      const list = document.createElement('ol');
      list.className = 'p-beats';
      for (const b of a.beats) {
        const li = document.createElement('li');
        li.textContent = b.text;
        li.title = `Go to ${ctx.yearOf(b.week)}`;
        li.addEventListener('click', () => seek(b.week));
        timed.push([b.week, li]);
        list.append(li);
      }
      more.append(summary, list);
      card.append(head, s.svg, now, count, more);
      timed.push([firstWeek(a), card]);
      return { arc: a, el: card, now, count, playhead: s.playhead, beat: -2 };
    });
    host.replaceChildren(...cards.map((c) => c.el));
    if (!cast.length) host.innerHTML = '<p class="muted">Nobody stands out in this life yet.</p>';
    const threads = v.data.arcs.threads;
    q('.p-threads').hidden = !threads.length;
    q('.p-thread-list').innerHTML = threads.map((t) => `<p>${esc(t)}</p>`).join('');
  }

  function buildList(): void {
    const v = ctx.view();
    rows = v.data.arcs.people.map((a) => {
      const p = v.people.get(a.id)!;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'p-row';
      const from = ctx.yearOf(Math.max(0, p.met));
      const to = a.last >= 0 ? ctx.yearOf(a.last) : from;
      const span = p.met < 0 && to >= v.data.startYear + v.data.years - 1 ? 'the whole story' : p.met < 0 ? `until ${to}` : from === to ? `${from}` : `${from}–${to}`;
      const seen = a.seen === 0 ? 'never met up' : a.seen === 1 ? 'seen once' : `seen ${a.seen} times`;
      const text = document.createElement('span');
      text.innerHTML =
        `<b><i class="p-dot" style="background:var(--tier-${tierOf(a.id)})"></i>${esc(p.name)}${ctx.wasPartner(a.id) ? ' ♥' : ''}${a.cast ? ' ★' : ''}</b>` +
        `<small>${esc(a.label)} · ${esc(span)} · ${seen}</small>`;
      b.append(portrait(a.id, 1), text);
      b.addEventListener('click', () => ctx.openPerson(a.id));
      timed.push([firstWeek(a), b]);
      return { arc: a, name: p.name.toLowerCase(), el: b };
    });
    q('.p-list').replaceChildren(...rows.map((r) => r.el));
    applyFilter();
  }

  function applyFilter(): void {
    const needle = search.value.trim().toLowerCase();
    let shown = 0;
    for (const r of rows) {
      const tier = tierOf(r.arc.id);
      const fam = r.arc.role === 'family' || r.arc.role === 'partner';
      const ok =
        (filter === 'all' || (filter === 'family' ? fam : !fam && (filter === 'close' ? tier <= 1 : filter === 'friends' ? tier === 2 : tier === 3))) &&
        (!needle || r.name.includes(needle));
      r.el.hidden = !ok;
      if (ok) shown++;
    }
    q('.p-count').textContent = shown === rows.length ? `· ${rows.length}` : `· ${shown} of ${rows.length}`;
    for (const b of root.querySelectorAll<HTMLElement>('.p-filters button')) b.setAttribute('aria-pressed', String(b.dataset.f === filter));
  }

  q('.p-filters').append(
    ...FILTERS.map(([f, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.f = f;
      b.textContent = label;
      b.addEventListener('click', () => {
        filter = f;
        applyFilter();
      });
      return b;
    }),
  );
  search.addEventListener('input', applyFilter);
  // Typing a name should not trigger the page's shortcuts (space to play, digits for tabs).
  search.addEventListener('keydown', (ev) => ev.stopPropagation());

  function update(): void {
    const v = ctx.view();
    const week = ctx.week();
    for (const [w, el] of timed) el.classList.toggle('future', w > week);
    for (const c of cards) {
      c.playhead.setAttribute('x1', String((week / v.totalWeeks) * 300));
      c.playhead.setAttribute('x2', String((week / v.totalWeeks) * 300));
      // The one line shown is the latest thing that has happened between you.
      let beat = -1;
      for (let i = 0; i < c.arc.beats.length; i++) if (c.arc.beats[i].week <= week) beat = i;
      if (beat !== c.beat) {
        c.beat = beat;
        c.now.textContent = beat < 0 ? 'Not in your life yet.' : c.arc.beats[beat].text;
      }
      const weeks = c.arc.seenAt;
      if (weeks) {
        const sofar = countUpTo(weeks, week);
        const left = weeks.length - sofar;
        c.count.textContent =
          beat < 0 ? ''
          : left === 0 ? (sofar ? `You saw each other ${sofar} times in all.` : '')
          : `Seen ${sofar} time${sofar === 1 ? '' : 's'} so far · ${left} still to come`;
      }
    }
  }

  function layout(): void {
    const { top, bottom } = ctx.insets();
    const p = q('.people');
    p.style.top = `${top}px`;
    p.style.bottom = `${bottom}px`;
  }

  return {
    reset() {
      layout();
      timed = [];
      search.value = '';
      filter = 'all';
      buildCast();
      buildList();
      q('.people').scrollTop = 0;
      lastWeek = -1;
    },
    seek() {
      lastWeek = -1;
    },
    frame() {
      if (Math.abs(ctx.week() - lastWeek) < 2) return;
      lastWeek = ctx.week();
      update();
    },
    resize() {
      layout();
      lastWeek = -1;
    },
    timeScale: () => 1,
  };
}
