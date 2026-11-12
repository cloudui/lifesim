// The Circle view: you in the middle, everyone you know placed by how close they are,
// clockwise in the order you met them. Fills the stage between the HUD bars.

import type { Ctx, Scene } from './types';

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const FONT = "'VT323', ui-monospace, monospace";

export function createCircle(root: HTMLElement, ctx: Ctx): Scene {
  root.innerHTML = `
    <canvas class="circle-canvas"></canvas>
    <div class="pixel-legend circle-legend">
      <span><i class="dot-key"></i>friend</span>
      <span><i class="dot-key diamond"></i>family or partner</span>
      <span><i class="line-key"></i>they know each other</span>
      <span class="muted">colour is the city they live in · closer to the middle is closer to you · clockwise in the order you met</span>
    </div>`;
  const canvas = root.querySelector('canvas')!;
  const legend = root.querySelector<HTMLElement>('.circle-legend')!;
  let nodesDrawn: { id: number; x: number; y: number; r: number }[] = [];
  let hoverId = -1;
  let drawnWeek = -1;
  let dirty = true;
  let palette: Record<string, string> = {};

  function readPalette(): void {
    palette = {};
    for (const k of ['--text', '--text-2', '--text-3', '--grid', '--surface', '--page', '--city-0', '--city-1', '--city-2']) palette[k] = css(k);
  }

  /** Strength to distance from the centre, as a fraction of the outer radius. */
  function radiusFor(s: number): number {
    const L = ctx.view().data.levels;
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

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(root.clientWidth * dpr);
    canvas.height = Math.round(root.clientHeight * dpr);
    legend.style.bottom = `${ctx.insets().bottom}px`;
    dirty = true;
  }

  function draw(): void {
    const v = ctx.view();
    const week = ctx.week();
    const dpr = window.devicePixelRatio || 1;
    const g = canvas.getContext('2d')!;
    const Wc = canvas.width / dpr;
    const Hc = canvas.height / dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, Wc, Hc);
    const { top, bottom } = ctx.insets();
    const areaTop = top;
    const areaBottom = Hc - bottom - legend.offsetHeight - 8;
    const cx = Wc / 2;
    const cy = (areaTop + areaBottom) / 2;
    const R = Math.max(60, Math.min(Wc / 2 - 40, (areaBottom - areaTop) / 2 - 26));
    const ink = palette['--text'];
    const ink2 = palette['--text-2'];
    const ink3 = palette['--text-3'];
    const grid = palette['--grid'];
    const page = palette['--page'];
    const cityColors = [palette['--city-0'], palette['--city-1'], palette['--city-2']];
    const L = v.data.levels;

    // Rings at each threshold, labelled directly (labels are drawn last so dots do not hide them).
    const ringLabels: { text: string; y: number }[] = [];
    [[L[0], 'acquaintances'], [L[1], 'friends'], [L[2], 'close friends'], [L[3], 'inner circle']].forEach(([s, label]) => {
      const r = radiusFor(s as number) * R;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.strokeStyle = grid;
      g.lineWidth = 1;
      g.setLineDash([2, 4]);
      g.stroke();
      g.setLineDash([]);
      ringLabels.push({ text: label as string, y: cy + r - 5 });
    });

    // Decade marks around the rim: people are placed clockwise by when you met them.
    g.font = `16px ${FONT}`;
    for (let yr = 0; yr < v.data.years; yr += 10) {
      const first = v.data.people.filter((p) => p.met >= yr * 52).sort((a, b) => a.met - b.met)[0];
      if (!first) continue;
      const a = v.angle.get(first.id)!;
      g.fillStyle = ink3;
      g.textAlign = 'center';
      g.fillText(`met ${v.data.startYear + yr}+`, cx + Math.cos(a) * (R + 22), cy + Math.sin(a) * (R + 16) + (Math.abs(Math.cos(a)) > 0.8 ? -8 : 4));
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
      g.lineTo(cx + Math.cos(a) * (R + 5), cy + Math.sin(a) * (R + 5));
      g.strokeStyle = ink3;
      g.lineWidth = 1;
      g.stroke();
    }

    const strengths = ctx.strengthsAt(week);
    const pos = new Map<number, { x: number; y: number; s: number }>();
    for (const [id, s] of strengths) {
      if (s < L[0] * 0.6) continue;
      const a = v.angle.get(id);
      if (a === undefined) continue;
      const r = radiusFor(s) * R;
      pos.set(id, { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, s });
    }

    // Friendships among the people you know.
    const snap = v.data.snapshots[ctx.snapIndex(week)];
    g.lineWidth = 1;
    g.globalAlpha = 0.12;
    g.strokeStyle = ink2;
    g.beginPath();
    for (const [a, b] of snap.edges) {
      if (a === hoverId || b === hoverId) continue;
      const p = pos.get(a);
      const q = pos.get(b);
      if (!p || !q) continue;
      g.moveTo(p.x, p.y);
      g.lineTo(q.x, q.y);
    }
    g.stroke();
    g.globalAlpha = 1;
    const linked = new Set<number>();
    if (hoverId >= 0 && pos.has(hoverId)) {
      g.strokeStyle = ink;
      g.lineWidth = 1.25;
      g.globalAlpha = 0.7;
      g.beginPath();
      const p = pos.get(hoverId)!;
      for (const [a, b] of snap.edges) {
        if (a !== hoverId && b !== hoverId) continue;
        const q = pos.get(a === hoverId ? b : a);
        if (!q) continue;
        linked.add(a === hoverId ? b : a);
        g.moveTo(p.x, p.y);
        g.lineTo(q.x, q.y);
      }
      g.stroke();
      g.globalAlpha = 1;
    }

    // People.
    nodesDrawn = [];
    const labels: { x: number; y: number; text: string; strong: boolean; rank: number }[] = [];
    const partner = ctx.partnerAt(week)?.id ?? -1;
    for (const [id, p] of pos) {
      const person = v.people.get(id)!;
      const lv = ctx.levelOf(p.s);
      const r = 3 + lv * 0.9;
      const isPartner = id === partner;
      const kin = isPartner || (person.kin && !ctx.wasPartner(id));
      g.globalAlpha = p.s < L[0] ? 0.35 : hoverId >= 0 && id !== hoverId && !linked.has(id) ? 0.4 : 1;
      g.fillStyle = cityColors[ctx.cityAt(person.cities, week)] ?? ink3;
      g.strokeStyle = page;
      g.lineWidth = 2;
      g.beginPath();
      if (kin) {
        const d = r + 1.5;
        g.moveTo(p.x, p.y - d);
        g.lineTo(p.x + d, p.y);
        g.lineTo(p.x, p.y + d);
        g.lineTo(p.x - d, p.y);
        g.closePath();
      } else g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.stroke();
      g.fill();
      if (isPartner) {
        g.beginPath();
        g.arc(p.x, p.y, r + 5.5, 0, Math.PI * 2);
        g.strokeStyle = '#ff5d8f';
        g.lineWidth = 1.5;
        g.stroke();
      }
      g.globalAlpha = 1;
      nodesDrawn.push({ id, x: p.x, y: p.y, r });
      if (lv >= 4 || isPartner || id === hoverId || linked.has(id)) {
        labels.push({
          x: p.x, y: p.y - r - 5, text: person.name.split(' ')[0] + (isPartner ? ' ♥' : ''),
          strong: id === hoverId || isPartner, rank: (id === hoverId ? 3 : isPartner ? 2 : 0) + p.s,
        });
      }
    }

    // You, in the middle.
    g.beginPath();
    g.arc(cx, cy, 8, 0, Math.PI * 2);
    g.fillStyle = '#ffffff';
    g.strokeStyle = page;
    g.lineWidth = 2;
    g.stroke();
    g.fill();
    labels.push({ x: cx, y: cy - 14, text: 'you', strong: true, rank: 10 });

    g.textAlign = 'center';
    g.lineJoin = 'round';
    g.font = `15px ${FONT}`;
    for (const l of ringLabels) {
      g.strokeStyle = page;
      g.lineWidth = 4;
      g.strokeText(l.text, cx, l.y);
      g.fillStyle = ink3;
      g.fillText(l.text, cx, l.y);
    }
    // Most important labels first; skip any that would sit on top of one already drawn.
    const boxes: { x0: number; x1: number; y: number }[] = [];
    g.font = `17px ${FONT}`;
    for (const l of labels.sort((a, b) => b.rank - a.rank)) {
      const half = g.measureText(l.text).width / 2 + 3;
      if (boxes.some((b) => Math.abs(b.y - l.y) < 14 && l.x - half < b.x1 && l.x + half > b.x0)) continue;
      boxes.push({ x0: l.x - half, x1: l.x + half, y: l.y });
      g.strokeStyle = page;
      g.lineWidth = 3;
      g.strokeText(l.text, l.x, l.y);
      g.fillStyle = l.strong ? ink : ink2;
      g.fillText(l.text, l.x, l.y);
    }
  }

  function nearest(ev: PointerEvent): number {
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
    return best;
  }
  canvas.addEventListener('pointermove', (ev) => {
    const best = nearest(ev);
    if (best !== hoverId) {
      hoverId = best;
      dirty = true;
    }
    canvas.style.cursor = best >= 0 ? 'pointer' : 'default';
    if (best >= 0) ctx.showTip(ctx.personTip(best), ev.clientX, ev.clientY);
    else ctx.hideTip();
  });
  canvas.addEventListener('click', (ev) => {
    const id = nearest(ev);
    if (id >= 0) ctx.openPerson(id);
  });
  canvas.addEventListener('pointerleave', () => {
    hoverId = -1;
    dirty = true;
    ctx.hideTip();
  });

  return {
    reset() {
      readPalette();
      resize();
    },
    seek() {
      dirty = true;
    },
    frame() {
      const w = ctx.week();
      if (!dirty && Math.abs(w - drawnWeek) < 0.5) return;
      dirty = false;
      drawnWeek = w;
      draw();
    },
    resize,
    timeScale: () => 1,
  };
}
