// Shared pixel backdrops: the sky, each city's skyline and the venue fronts.
// The Walk and the Story both draw with these.

import { hash, mix } from './pixel';

type G = CanvasRenderingContext2D;

const SKY: [number, string[]][] = [
  [0, ['#2b2d5b', '#5b4a7a', '#b5657a', '#f0a07a', '#ffd9a0']],
  [0.28, ['#3f8fd8', '#5aa6e6', '#7fbdf0', '#a8d4f6', '#d4ebfb']],
  [0.68, ['#3a5ba0', '#7a6fb0', '#d98a7a', '#f5b56a', '#ffe1a0']],
  [1, ['#0f1030', '#1d1b4a', '#3a2a66', '#6a3a78', '#b0567a']],
];
/** Five bands of sky, top to bottom, for a point in the life from 0 (dawn) to 1 (night). */
export function skyAt(p: number): string[] {
  for (let i = 1; i < SKY.length; i++) {
    if (p <= SKY[i][0]) {
      const f = (p - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]);
      return SKY[i][1].map((c, k) => mix(SKY[i - 1][1][k], c, f));
    }
  }
  return SKY[SKY.length - 1][1];
}

export function mixRgb(a: string, b: [number, number, number], t: number): string {
  const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(a);
  const [r, gg, bb] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const f = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${f(r, b[0])},${f(gg, b[1])},${f(bb, b[2])})`;
}

/** One city's skyline as a repeating strip of buildings. */
const STRIP = 560;
function buildings(city: number): { x: number; w: number; h: number }[] {
  const out: { x: number; w: number; h: number }[] = [];
  const tall = city === 0 ? [24, 44] : city === 1 ? [9, 22] : [18, 38];
  for (let x = 0, i = 0; x < STRIP; i++) {
    const w = 9 + (hash(city * 97 + i, 1) % 17);
    out.push({ x, w, h: tall[0] + (hash(city * 97 + i, 2) % tall[1]) });
    x += w + (hash(city * 97 + i, 3) % 3);
  }
  return out;
}
const SKYLINES = [0, 1, 2].map(buildings);

/** A city's skyline across a canvas W wide, standing on the far side of the street at `ground`. */
export function drawSkyline(g: G, city: number, shade: string, lit: number, offset: number, W: number, ground: number): void {
  const base = ground - 14;
  if (city === 1) {
    // Hills behind San Francisco.
    g.fillStyle = shade;
    for (let x = 0; x < W; x++) {
      const hgt = 15 + Math.sin((x + offset) / 46) * 8 + Math.sin((x + offset) / 17) * 3;
      g.fillRect(x, base - hgt, 1, hgt);
    }
  }
  for (const b of SKYLINES[city % SKYLINES.length]) {
    for (let x = b.x - (offset % STRIP) - STRIP; x < W; x += STRIP) {
      if (x + b.w < 0) continue;
      g.fillStyle = shade;
      g.fillRect(Math.round(x), base - b.h, b.w, b.h);
      if (lit > 0) {
        g.fillStyle = `rgba(255,214,120,${lit})`;
        for (let wy = base - b.h + 3; wy < base - 3; wy += 5) {
          for (let wx = 2; wx < b.w - 2; wx += 4) {
            if (hash(b.x * 31 + wx, wy) % 3 === 0) g.fillRect(Math.round(x) + wx, wy, 1, 2);
          }
        }
      }
    }
  }
  // One landmark per city, repeating with the strip.
  for (let x = 250 - (offset % STRIP) - STRIP; x < W + 80; x += STRIP) {
    const lx = Math.round(x);
    g.fillStyle = shade;
    if (city === 0) {
      g.fillRect(lx, base - 70, 16, 70);
      g.fillRect(lx + 3, base - 79, 10, 9);
      g.fillRect(lx + 6, base - 85, 4, 6);
      g.fillRect(lx + 7, base - 98, 2, 13);
    } else if (city === 2) {
      g.fillRect(lx, base - 78, 20, 78);
      g.fillRect(lx + 2, base - 83, 16, 5);
      g.fillRect(lx + 5, base - 98, 1, 15);
      g.fillRect(lx + 14, base - 98, 1, 15);
    } else {
      // A red suspension bridge.
      g.fillStyle = '#b8432c';
      g.fillRect(lx - 60, base - 16, 190, 2);
      for (const tx of [lx, lx + 70]) g.fillRect(tx, base - 46, 3, 46);
      for (let i = -60; i <= 130; i++) {
        const near = Math.min(Math.abs(i), Math.abs(i - 70));
        const span = i < 0 || i > 70 ? 60 : 35;
        g.fillRect(lx + i, base - 44 + Math.round(26 * (1 - (near / span) ** 2) * (near < span ? 1 : 0)), 1, 1);
      }
    }
  }
  if (city !== 0) {
    // Bay or lake at the foot of the skyline.
    g.fillStyle = mix('#3a6ea5', '#101530', 0.35);
    g.fillRect(0, base - 3, W, 3);
  }
}

/** A venue front centred on x: park, cafe, bar, work or a club hall. */
export function drawVenue(g: G, kind: string, cx: number, ground: number, clock: number): void {
  const x = Math.round(cx);
  const y = ground;
  const px = (dx: number, dy: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(x + dx, y - dy, w, h);
  };
  if (kind === 'park') {
    for (const dx of [-26, 4, 30]) {
      px(dx + 5, 22, 3, 22, '#5b4028');
      px(dx - 3, 44, 19, 14, '#2f7d4f');
      px(dx, 50, 13, 8, '#3fa066');
    }
    px(-6, 8, 22, 2, '#8a6a3f');
    px(-5, 6, 2, 6, '#5b4028');
    px(13, 6, 2, 6, '#5b4028');
    return;
  }
  const wall = kind === 'cafe' ? '#e9dcc3' : kind === 'bar' ? '#3a2b3f' : kind === 'work' ? '#9fb3c8' : '#d9c2a0';
  px(-34, 62, 68, 62, wall);
  px(-36, 66, 72, 5, mix(wall, '#000000', 0.35));
  px(-6, 30, 14, 30, '#3b2a22');
  px(-4, 28, 10, 20, kind === 'work' ? '#cfe6f7' : '#f6d98a');
  if (kind === 'cafe') {
    for (let i = 0; i < 9; i++) px(-34 + i * 8, 44, 8, 7, i % 2 ? '#d1495b' : '#f7f5ef');
    px(-28, 26, 14, 14, '#bfe3f2');
    px(16, 26, 14, 14, '#bfe3f2');
  } else if (kind === 'bar') {
    px(-24, 56, 48, 9, '#17121a');
    const on = Math.floor(clock * 4) % 5 !== 0;
    for (let i = 0; i < 5; i++) px(-20 + i * 9, 54, 6, 5, on ? '#ff5fa2' : '#7a2f52');
    px(-28, 24, 12, 10, '#f6c453');
    px(18, 24, 12, 10, '#f6c453');
  } else if (kind === 'work') {
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) if (c !== 1 && c !== 2 || r === 1) px(-28 + c * 15, 56 - r * 14, 10, 9, '#cfe6f7');
  } else {
    // A club: a hall with bunting.
    for (let i = 0; i < 11; i++) px(-33 + i * 6, 58 - (i % 2), 4, 4, ['#e4572e', '#eda100', '#1baf7a', '#2a78d6'][i % 4]);
    px(-28, 26, 14, 14, '#f6d98a');
    px(16, 26, 14, 14, '#f6d98a');
  }
}
