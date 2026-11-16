// Close-ups: a small framed picture over the scene when an object matters (SHOW in a script).
// Each is drawn in code, 72 by 46 pixels, like everything else.

import { drawFace, FACE_H, FACE_W } from './faces';
import type { Look } from './pixel';

type G = CanvasRenderingContext2D;
export const INSERT_W = 72;
export const INSERT_H = 46;
let faceBuf: HTMLCanvasElement | null = null;

/** `look` is whoever the picture is of, for the ones that show a person. `alpha` fades it in and out. */
export function drawInsert(g: G, name: string, x: number, y: number, clock: number, alpha: number, look?: Look): void {
  const px = (dx: number, dy: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
  g.save();
  g.globalAlpha = alpha;
  px(-2, -2, INSERT_W + 4, INSERT_H + 4, '#04060c');
  px(-1, -1, INSERT_W + 2, INSERT_H + 2, 'rgba(244,241,222,0.6)');
  px(0, 0, INSERT_W, INSERT_H, '#1b1d2a');
  if (name === 'shoes') {
    // Two pairs of blue shoes that are nearly, but not quite, the same.
    px(0, 30, INSERT_W, 16, '#3a3d44');
    const shoe = (dx: number, dy: number, c: string, sole: string, stripe: string) => {
      px(dx, dy + 4, 14, 5, c);
      px(dx + 2, dy, 7, 5, c);
      px(dx + 9, dy + 2, 4, 3, c);
      px(dx, dy + 9, 15, 2, sole);
      px(dx + 4, dy + 3, 5, 1, '#f4f4f4');
      px(dx + 5, dy + 5, 4, 1, '#f4f4f4');
      px(dx + 10, dy + 5, 3, 2, stripe);
    };
    shoe(5, 22, '#2f8fff', '#f4f4f4', '#f4f4f4');
    shoe(18, 26, '#2f8fff', '#f4f4f4', '#f4f4f4');
    shoe(40, 22, '#2a7fe8', '#e8e8e8', '#ffd166');
    shoe(53, 26, '#2a7fe8', '#e8e8e8', '#ffd166');
    px(35, 4, 1, 38, 'rgba(244,241,222,0.25)');
  } else if (name === 'receipt') {
    px(0, 0, INSERT_W, INSERT_H, '#6b6f78');
    px(22, 0, 28, INSERT_H, '#ffffff');
    for (let r = 0; r < 12; r++) {
      const yy = 3 + r * 3 - (Math.floor(clock * 2) % 3);
      if (yy < 1 || yy > 34) continue;
      px(25, yy, 10 + ((r * 7) % 7), 1, '#9aa0aa');
      px(43, yy, 4, 1, '#6b6f78');
    }
    px(24, 37, 24, 1, '#22252b');
    px(25, 40, 8, 2, '#22252b');
    px(38, 40, 9, 2, '#c8102e');
  } else if (name === 'photo' && look) {
    // A phone held up, with an old photo on it.
    px(0, 0, INSERT_W, INSERT_H, '#241f2c');
    px(18, 2, 36, 42, '#0c0d12');
    px(20, 5, 32, 36, '#8fb0cf');
    px(20, 27, 32, 14, '#5c946e');
    faceBuf ??= Object.assign(document.createElement('canvas'), { width: FACE_W, height: FACE_H });
    drawFace(faceBuf.getContext('2d')!, look, { mood: 'smile', blink: false, talking: false, grey: 0 });
    g.drawImage(faceBuf, x + 20, y + 15);
    px(33, 3, 6, 1, '#2a2d33');
  } else if (name === 'cake') {
    px(0, 34, INSERT_W, 12, '#6a4f3a');
    px(14, 32, 44, 3, '#f4f1de');
    px(20, 18, 32, 14, '#f2a7c0');
    px(20, 18, 32, 4, '#fff6f0');
    for (let k = 0; k < 6; k++) px(21 + k * 5, 22, 3, 2 + (k % 2), '#fff6f0');
    for (let k = 0; k < 5; k++) {
      px(24 + k * 6, 12, 1, 6, ['#2a78d6', '#eda100', '#1baf7a', '#e4572e', '#9b5de5'][k]);
      px(24 + k * 6, 10 - (Math.floor(clock * 6 + k) % 2), 1, 2, '#ffd166');
    }
  }
  g.restore();
}
