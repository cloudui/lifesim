// The People view: the life retold as the people in it. First the cast, the handful the
// story is about, each with their beats; then how they reached you; then a catalog of
// everyone you ever knew, most relevant first. Lines that have not happened yet are dimmed,
// so the page fills in as the playhead moves.

import type { ArcExport } from '../sim/export';
import { drawPerson, lookFor } from './pixel';
import type { Ctx, Scene } from './types';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

type Filter = 'all' | 'family' | 'close' | 'friends' | 'passing';
const FILTERS: [Filter, string][] = [
  ['all', 'Everyone'], ['family', 'Family'], ['close', 'Close friends'], ['friends', 'Friends'], ['passing', 'Passing through'],
];

export function createPeople(root: HTMLElement, ctx: Ctx, seek: (week: number) => void): Scene {
  root.innerHTML = `
    <div class="people">
      <section>
        <h3 class="p-title">The people this story is about</h3>
        <p class="muted p-hint">Each line lights up as it happens. Click a line to go to that moment, or a name to see the two of you over time.</p>
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
  /** Elements that depend on the playhead: [week it happens, element]. */
  let timed: [number, HTMLElement][] = [];
  let rows: { arc: ArcExport; name: string; el: HTMLElement }[] = [];
  let lastWeek = -1;

  const portrait = (id: number, scale: number): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = 20;
    c.height = 26;
    c.style.width = `${20 * scale}px`;
    c.style.height = `${26 * scale}px`;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    drawPerson(g, 10, 25, lookFor(id), { pose: 'stand', frame: 0, outfit: 'casual' });
    return c;
  };
  const firstWeek = (a: ArcExport) => a.beats[0]?.week ?? 0;
  const tierOf = (id: number): number => {
    const L = ctx.view().data.levels;
    const peak = ctx.view().people.get(id)?.peak ?? 0;
    return peak >= L[3] ? 0 : peak >= L[2] ? 1 : peak >= L[1] ? 2 : 3;
  };

  function buildCast(): void {
    const v = ctx.view();
    const host = q('.p-cast');
    const cast = v.data.arcs.cast.map((id) => v.arcs.get(id)).filter((a): a is ArcExport => !!a);
    host.replaceChildren(
      ...cast.map((a) => {
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
          `<b>${esc(p.name)}${ctx.wasPartner(a.id) ? ' ♥' : ''}</b>` +
          `<small>${esc(a.label)}${a.shape ? ` · ${esc(a.shape)}` : ''}${years}</small>`;
        head.append(portrait(a.id, 2), text);
        head.addEventListener('click', () => ctx.openPerson(a.id));
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
        card.append(head, list);
        timed.push([firstWeek(a), card]);
        return card;
      }),
    );
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
    const week = ctx.week();
    for (const [w, el] of timed) el.classList.toggle('future', w > week);
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
