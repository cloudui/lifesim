// The places a film scene can happen in. Each is drawn in code on the low-resolution canvas:
// a back layer behind the people and, for some, a front layer over them (a car's bonnet, a desk,
// a table, rain). A set also says where people sit and stand.
//
// To add a set: write a back function (and a front one if something has to cover the people),
// add it to SETS with its stage, and name it in a scene's `set:` line.

import { drawSkyline } from './backdrop';
import { drawPerson, hash, lookFor, mix } from './pixel';
import type { Ambience } from './sound';

type G = CanvasRenderingContext2D;

/** Where a set puts people. Offsets are pixels from `cx`. */
export interface Stage {
  cx: number;
  /** The hip of someone sitting, and the feet of someone standing. */
  seatY: number;
  standY: number;
  /** How far legs hang below the seat; 0 when something hides them. */
  legs: number;
  /** A door people can come out of or go into. */
  door: number;
  /** Default places for the two people of a simulated-life scene. */
  spots: Record<string, number>;
}

export interface SetEnv { g: G; W: number; H: number; clock: number; time: string; props: string[]; city: number }

let g: G;
let W = 320;
let H = 180;
let clock = 0;
let time = 'night';
let props: string[] = [];
let city = 0;

const px = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function sky(bands: string[], to: number): void {
  const bh = Math.ceil(to / bands.length);
  bands.forEach((c, k) => { g.fillStyle = c; g.fillRect(0, k * bh, W, bh + 1); });
}
function stars(to: number, alpha = 1): void {
  for (let k = 0; k < W / 4; k++) {
    const tw = (hash(k, 3) + Math.floor(clock * 1.5)) % 9 === 0;
    g.fillStyle = `rgba(255,255,255,${(tw ? 0.25 : 0.7) * alpha})`;
    g.fillRect(hash(k, 1) % W, hash(k, 2) % Math.max(1, to), 1, 1);
  }
}
/** A triangle with its point at the top, in whole pixels. */
function tri(x: number, y: number, w: number, h: number, c: string): void {
  for (let r = 0; r < h; r++) {
    const rw = Math.max(1, Math.round((w * (r + 1)) / h));
    px(x + (w - rw) / 2, y + r, rw, 1, c);
  }
}
function glow(x: number, y: number, r: number, rgb: string, a: number): void {
  for (let k = r; k > 2; k -= 4) {
    g.fillStyle = `rgba(${rgb},${a})`;
    g.beginPath(); g.arc(x, y, k, 0, Math.PI * 2); g.fill();
  }
}
/** A five-by-seven letter set for signs. Text drawn with the browser's fonts comes out soft at this size. */
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['111', '010', '010', '010', '010', '010', '111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '+': ['000', '000', '010', '111', '010', '000', '000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['010', '110', '010', '010', '010', '010', '111'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
};
/** A sign, in whole pixels, centred on (x, y). Capital letters only. */
function label(text: string, x: number, y: number, c: string): void {
  const glyphs = [...text.toUpperCase()].map((ch) => FONT[ch] ?? null);
  const width = glyphs.reduce((w, gl) => w + (gl ? gl[0].length + 1 : 3), -1);
  let gx = Math.round(x - width / 2);
  const gy = Math.round(y) - 3;
  g.fillStyle = c;
  for (const gl of glyphs) {
    if (!gl) { gx += 3; continue; }
    gl.forEach((row, j) => { for (let k = 0; k < row.length; k++) if (row[k] === '1') g.fillRect(gx + k, gy + j, 1, 1); });
    gx += gl[0].length + 1;
  }
}
function tree(x: number, ground: number, h: number, c: string): void {
  px(x - 1, ground - h * 0.45, 3, h * 0.45, '#4a3626');
  px(x - h * 0.3, ground - h, h * 0.6, h * 0.62, c);
  px(x - h * 0.2, ground - h - 3, h * 0.4, 4, c);
  px(x - h * 0.3 + 2, ground - h + 3, 3, 2, mix(c, '#ffffff', 0.12));
}
/** Someone in the background: an invented person, standing about, sometimes with a cup. */
function folk(x: number, y: number, seed: number, o: { flip?: boolean; cup?: boolean; walk?: boolean; alpha?: number } = {}): void {
  const bob = !o.walk && Math.sin(clock * 0.8 + seed * 1.7) > 0.93 ? 1 : 0;
  drawPerson(g, x, y - bob, lookFor(seed * 31 + 5), { pose: o.walk ? 'walk' : 'stand', frame: Math.floor(clock * 5 + seed), outfit: 'casual', flip: o.flip, alpha: o.alpha ?? 1 });
  if (o.cup) {
    const sip = (clock * 0.25 + seed * 0.37) % 1 < 0.08;
    px(x + (o.flip ? -7 : 6), y - (sip ? 16 : 11) - bob, 2, 3, seed % 2 ? '#c44536' : '#8a5a2a');
  }
}
/** Apartment blocks with some windows lit, for a town that is not a city. */
function blocks(x0: number, x1: number, ground: number, night: boolean): void {
  for (let k = 0, x = x0; x < x1; k++) {
    const w = 26 + (hash(k, 11) % 22);
    const h = 26 + (hash(k, 12) % 34);
    const c = night ? ['#141a30', '#18203a', '#10162a'][k % 3] : ['#a8b4c4', '#c9b8a8', '#b8c4d0'][k % 3];
    px(x, ground - h, w, h, c);
    for (let r = 4; r < h - 4; r += 7) for (let q = 3; q < w - 4; q += 6) px(x + q, ground - h + r, 3, 4, night ? (hash(k * 97 + r, q) % 3 ? '#0c1020' : '#ffd98a') : '#6f8296');
    x += w + 2;
  }
}
const DAY = ['#4f9fe0', '#6ab0e8', '#88c2ef', '#a9d4f5', '#cfe7fa'];
const DUSK = ['#2b2d5b', '#5b4a7a', '#b5657a', '#f0a07a', '#ffd9a0'];
const NIGHT = ['#060916', '#0a1024', '#101a36', '#182447', '#232c55'];
const GREY = ['#5b6470', '#667079', '#727c84', '#7f888e', '#8b9397'];

// ------------------------------------------------------------------ the pier, the steps, the sofa

function pier(st: Stage): void {
  const dusk = time === 'dusk';
  const dy = st.seatY;
  const horizon = Math.round(H * 0.44);
  sky(dusk ? ['#2b2d5b', '#4f4576', '#8f5a7a', '#d98a7a', '#f5b56a'] : NIGHT, horizon);
  stars(horizon - 26, dusk ? 0.35 : 1);
  const mx = Math.round(W * 0.8);
  const my = Math.round(horizon * (dusk ? 0.78 : 0.3));
  const light = dusk ? '255,214,150' : '244,241,222';
  g.fillStyle = `rgba(${light},0.10)`;
  g.beginPath(); g.arc(mx, my, 13, 0, Math.PI * 2); g.fill();
  g.fillStyle = dusk ? '#ffd9a0' : '#f4f1de';
  g.beginPath(); g.arc(mx, my, 6, 0, Math.PI * 2); g.fill();
  drawSkyline(g, city, dusk ? '#2a2646' : '#0c1228', dusk ? 0.45 : 0.9, 90, W, horizon + 14);
  // Water, with the lights of the far shore and the moon or the low sun lying on it.
  px(0, horizon, W, H - horizon, dusk ? '#2a2a4c' : '#0a1226');
  for (let x = 0; x < W; x += 3) {
    if (hash(x, 41) % 4) continue;
    const len = 8 + (hash(x, 42) % 26);
    for (let y = 2; y < len; y += 2) {
      const wob = Math.round(Math.sin(clock * 1.6 + y * 0.7 + x) * 1.2);
      g.fillStyle = `rgba(255,214,120,${(dusk ? 0.16 : 0.28) * (1 - y / len)})`;
      g.fillRect(x + wob, horizon + y, 1, 1);
    }
  }
  for (let y = 3; y < H - horizon; y += 3) {
    const wob = Math.round(Math.sin(clock * 1.2 + y * 0.5) * (1 + y * 0.08));
    const w = Math.max(1, 5 - Math.floor(y / 14)) + (hash(y, 7) % 3);
    g.fillStyle = `rgba(${light},${0.5 * Math.max(0.15, 1 - y / (H - horizon))})`;
    g.fillRect(mx - Math.floor(w / 2) + wob, horizon + y, w, 1);
  }
  g.fillStyle = dusk ? 'rgba(255,200,170,0.10)' : 'rgba(120,150,210,0.10)';
  for (let y = horizon + 5; y < H; y += 6) {
    for (let k = 0; k < 6; k++) {
      const x = (hash(y, k) + Math.floor(clock * (4 + (y % 5)))) % (W + 20) - 10;
      g.fillRect(x, y, 5 + (hash(y, k + 9) % 6), 1);
    }
  }
  // The pier.
  const end = Math.round(W * 0.7);
  for (let x = 14; x < end; x += 38) {
    px(x, dy + 5, 4, H - dy, '#1c1611');
    for (let y = dy + 18; y < H; y += 3) px(x + Math.round(Math.sin(clock * 1.4 + y)), y, 4, 1, dusk ? 'rgba(42,42,76,0.55)' : 'rgba(10,18,38,0.55)');
  }
  px(0, dy - 4, end, 4, dusk ? '#6a4f3a' : '#4a3828');
  px(0, dy - 4, end, 1, dusk ? '#8a6848' : '#5c4631');
  for (let x = 6; x < end; x += 9) px(x, dy - 4, 1, 4, '#3a2b1f');
  px(0, dy, end, 5, '#2c2118');
  px(0, dy + 4, end, 1, '#211811');
  // A lamp, and the pool of light under it.
  const lx = Math.round(W * 0.2);
  px(lx, dy - 44, 2, 40, '#15171f');
  px(lx - 3, dy - 46, 8, 2, '#15171f');
  glow(lx + 1, dy - 42, 26, '255,196,110', (dusk ? 0.02 : 0.035) * (0.9 + Math.sin(clock * 7) * 0.03));
  px(lx - 1, dy - 44, 4, 2, '#ffd9a0');
  px(lx - 22, dy - 4, 46, 4, 'rgba(255,196,110,0.10)');
}

/** The front of a house: a garage door, three steps and a lit doorway. */
function steps(st: Stage): void {
  const morning = time === 'morning';
  const night = time === 'night';
  const ground = st.standY;
  const cx = st.cx;
  sky(morning ? ['#3f8fd8', '#5aa6e6', '#7fbdf0', '#a8d4f6', '#d4ebfb'] : night ? NIGHT : DUSK, ground);
  if (!morning) stars(Math.round(ground * 0.3), night ? 1 : 0.5);
  if (city >= 0) drawSkyline(g, city, morning ? '#8fb0cf' : night ? '#0c1228' : '#4a3a5e', morning ? 0 : night ? 0.7 : 0.35, 300, W, ground - 6);
  else {
    // A small town: hills and trees behind the house.
    for (let x = 0; x < W; x++) px(x, ground - 50 - Math.sin(x / 37) * 10 - Math.sin(x / 13) * 3, 1, 60, morning ? '#7fa58a' : '#2a2a48');
    for (let k = 0; k < W / 30 + 1; k++) tree(k * 30 + (hash(k, 8) % 12), ground, 34 + (hash(k, 9) % 16), morning ? (k % 2 ? '#4f8a55' : '#437a4c') : '#20243e');
  }
  const tint = (c: string) => (morning ? c : night ? mix(c, '#141428', 0.62) : mix(c, '#3a2a4a', 0.42));
  // The house.
  const hx = cx - 92;
  const hw = 150;
  const top = ground - 86;
  px(hx, top, hw, 86, tint('#d9c7a8'));
  px(hx - 4, top - 6, hw + 8, 7, tint('#7a4a3a'));
  for (let y = top + 9; y < ground - 2; y += 6) px(hx, y, hw, 1, tint('#cdb999'));
  // Garage door, with years of football on it.
  px(hx + 8, ground - 46, 62, 46, tint('#b9b0a0'));
  for (let y = ground - 46; y < ground; y += 9) px(hx + 8, y, 62, 1, tint('#9c9484'));
  for (let k = 0; k < 9; k++) px(hx + 12 + (hash(k, 71) % 54), ground - 40 + (hash(k, 72) % 34), 2, 2, tint('#8a8274'));
  // A window, and the door at the top of the steps, lit from inside after dark.
  const lit = morning ? '#bfe3f2' : '#ffd98a';
  px(hx + 82, top + 12, 20, 16, tint('#6b4a3a'));
  px(hx + 84, top + 14, 16, 12, lit);
  px(cx - 6, st.seatY - 34, 20, 34, tint('#5b4028'));
  px(cx - 3, st.seatY - 31, 14, 12, lit);
  if (!morning) px(cx - 22, st.seatY - 4, 52, 6, 'rgba(255,217,138,0.10)');
  // Three steps.
  for (let k = 0; k < 3; k++) {
    const w = 56 + k * 8;
    px(cx + 4 - w / 2, st.seatY + k * 6, w, 6, tint(k % 2 ? '#a89c8c' : '#b8ad9c'));
    px(cx + 4 - w / 2, st.seatY + k * 6, w, 1, tint('#d0c6b6'));
  }
  // The pavement and the road.
  px(0, ground, W, 4, tint('#b9b6b0'));
  px(0, ground + 4, W, H - ground, tint('#6c6f72'));
  for (let x = 0; x < W; x += 30) px(x, ground + 22, 14, 1, tint('#c9c6b8'));
  if (night) {
    // A street lamp down the path.
    const lx = cx + 118;
    px(lx, ground - 52, 2, 52, '#15171f');
    px(lx - 4, ground - 54, 8, 2, '#15171f');
    px(lx - 3, ground - 52, 5, 2, '#ffd9a0');
    glow(lx, ground - 48, 30, '255,196,110', 0.035);
    px(lx - 24, ground, 50, 4, 'rgba(255,196,110,0.10)');
  }
  if (props.includes('ball')) {
    px(cx - 27, st.seatY - 5, 5, 5, '#f4f4f4');
    px(cx - 26, st.seatY - 4, 2, 2, '#2a2a2a');
  }
  if (props.includes('boxes')) {
    const bx = cx + 52;
    for (const [dx, dy2, w, h] of [[0, 0, 16, 12], [18, 0, 14, 10], [4, 12, 14, 10], [-46 - 52, 0, 15, 11]] as const) {
      px(bx + dx, ground - dy2 - h, w, h, tint('#b58a55'));
      px(bx + dx, ground - dy2 - h, w, 1, tint('#d0a870'));
      px(bx + dx + w / 2 - 1, ground - dy2 - h, 2, h, tint('#9a7040'));
    }
  }
  if (props.includes('car')) {
    // A car at the kerb, packed to the roof.
    const x = cx + 58;
    const y = ground + 3;
    px(x, y - 20, 70, 14, tint('#8f9aa6'));
    px(x + 12, y - 32, 44, 13, tint('#8f9aa6'));
    px(x + 15, y - 30, 18, 10, tint('#cfe3ee'));
    px(x + 35, y - 30, 18, 10, tint('#cfe3ee'));
    for (const [bx, by, bw, bh, c] of [[16, -27, 8, 7, '#b58a55'], [25, -29, 7, 9, '#c44536'], [36, -28, 9, 8, '#b58a55'], [46, -26, 6, 6, '#3d5a80']] as const) px(x + bx, y + by, bw, bh, tint(c));
    px(x + 16, y - 38, 34, 6, tint('#3a3d44'));
    px(x + 18, y - 39, 30, 1, tint('#5a5d66'));
    px(x + 8, y - 8, 12, 8, '#15151a');
    px(x + 50, y - 8, 12, 8, '#15151a');
    px(x + 11, y - 5, 6, 3, tint('#8a8d94'));
    px(x + 53, y - 5, 6, 3, tint('#8a8d94'));
    px(x + 66, y - 17, 4, 3, tint('#f4e9b0'));
  }
}

/** A small flat at night: the city in the window, one lamp, and a sofa that was free. */
function sofa(st: Stage): void {
  const floor = st.standY;
  const cx = st.cx;
  px(0, 0, W, floor, '#272231');
  for (let x = 0; x < W; x += 16) px(x, 0, 1, floor, '#2c2637');
  px(0, floor, W, H - floor, '#19151d');
  for (let x = 4; x < W; x += 20) px(x, floor, 1, H - floor, '#211c26');
  px(0, floor, W, 2, '#3a3145');
  // The window.
  const wx = Math.round(W * 0.56);
  const wy = Math.round(H * 0.1);
  const ww = Math.round(W * 0.32);
  const wh = Math.round(H * 0.4);
  g.save();
  g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
  px(wx, wy, ww, wh, '#0a1024');
  stars(wy + wh * 0.5);
  if (city >= 0) drawSkyline(g, city, '#0c1228', 0.95, 40, W, wy + wh + 14);
  else blocks(wx - 6, wx + ww, wy + wh, true);
  g.restore();
  for (const [x, y, w, h] of [[wx - 2, wy - 2, ww + 4, 2], [wx - 2, wy + wh, ww + 4, 3], [wx - 2, wy, 2, wh], [wx + ww, wy, 2, wh], [wx + ww / 2, wy, 2, wh]] as const) px(x, y, w, h, '#4a3d52');
  // A floor lamp and its pool of light.
  const lx = cx - 52;
  px(lx, floor - 46, 2, 46, '#15131a');
  px(lx - 5, floor - 54, 12, 9, '#e9c98a');
  glow(lx + 1, floor - 46, 44, '255,205,130', 0.03 * (0.92 + Math.sin(clock * 5) * 0.02));
  if (props.includes('balloons')) {
    for (const [k, c] of ['#e4572e', '#eda100', '#2a78d6', '#1baf7a'].entries()) {
      const bx = cx - 30 + k * 17 + (k % 2) * 3;
      const by = 14 + (k % 3) * 7 + Math.round(Math.sin(clock * 0.8 + k * 1.9) * 1.5);
      px(bx, by + 10, 1, 26 - (k % 3) * 5, 'rgba(244,241,222,0.25)');
      px(bx - 3, by, 7, 9, c);
      px(bx - 2, by - 1, 5, 11, c);
      px(bx - 2, by + 1, 2, 2, mix(c, '#ffffff', 0.4));
    }
  }
  if (props.includes('crowd')) {
    // A party: people standing about behind the sofa and by the window, talking over drinks.
    const spots = [-96, -80, -28, -12, 10, 28, 74, 90, 112, 128, 150];
    spots.forEach((dx, k) => { if (cx + dx > 6 && cx + dx < W - 6) folk(cx + dx, floor - 5 + (k % 3), k + 3, { flip: k % 2 === 1, cup: k % 3 !== 2 }); });
    px(0, floor - 4, W, 4, 'rgba(25,21,29,0.35)');
  }
  // A rug, and the sofa's back and arms. The seat goes on after the people.
  px(cx - 50, floor + 5, 104, 8, '#3d2f3f');
  px(cx - 50, floor + 5, 104, 1, '#55415a');
  px(cx - 38, st.seatY - 20, 78, 22, '#5d4a6e');
  px(cx - 38, st.seatY - 20, 78, 2, '#75608a');
  px(cx - 44, st.seatY - 10, 8, 19, '#52405f');
  px(cx + 38, st.seatY - 10, 8, 19, '#52405f');
  if (props.includes('chair')) {
    // An armchair to one side.
    px(cx + 56, st.seatY - 18, 26, 20, '#4f6a5a');
    px(cx + 56, st.seatY - 18, 26, 2, '#668a74');
    px(cx + 52, st.seatY - 8, 6, 17, '#435b4d');
    px(cx + 80, st.seatY - 8, 6, 17, '#435b4d');
  }
  sofaSeat(st);
  if (props.includes('plates')) {
    // A low table with what is left of a party.
    px(cx - 20, floor + 1, 44, 3, '#6a4f3a');
    px(cx - 17, floor + 4, 2, 5, '#4a3828');
    px(cx + 19, floor + 4, 2, 5, '#4a3828');
    for (const x of [-15, -5, 8]) px(cx + x, floor - 1, 7, 2, '#f4f1de');
    px(cx + 16, floor - 4, 3, 5, '#e4572e');
    px(cx - 3, floor - 3, 3, 2, '#eda100');
  }
}
/** The seat cushions: behind the people, so that their legs lie over them. */
function sofaSeat(st: Stage): void {
  const cx = st.cx;
  px(cx - 36, st.seatY, 74, 5, '#6b567c');
  px(cx - 36, st.seatY, 74, 1, '#8a72a0');
  px(cx - 36, st.seatY + 5, 74, 3, '#473652');
  if (props.includes('chair')) {
    px(cx + 58, st.seatY, 22, 5, '#5a7868');
    px(cx + 58, st.seatY, 22, 1, '#74977f');
    px(cx + 58, st.seatY + 5, 22, 3, '#3a4f43');
  }
}
function sofaFront(st: Stage): void {
  const cx = st.cx;
  if (props.includes('blanket')) {
    px(cx - 30, st.seatY - 5, 34, 11, '#7fa3b8');
    px(cx - 30, st.seatY - 5, 34, 1, '#a3c2d3');
    for (let x = cx - 27; x < cx + 3; x += 6) px(x, st.seatY - 3, 1, 8, '#6b8ea3');
    px(cx - 32, st.seatY + 6, 38, 5, '#6b8ea3');
  }
}

// ------------------------------------------------------------------ new places

/** The foot of a high-rise apartment building in a college town, at night, with other blocks around it. */
function tower(st: Stage): void {
  const ground = st.standY;
  const cx = st.cx;
  sky(NIGHT, ground);
  stars(Math.round(ground * 0.5));
  blocks(-10, W + 10, ground, true);
  for (let k = 0; k < 4; k++) tree(cx - 150 + k * 96 + (hash(k, 4) % 20), ground, 30 + (hash(k, 5) % 12), '#141c2e');
  // The tower: it goes up out of the picture, a balcony to every floor.
  const tx = cx - 78;
  const tw = 132;
  px(tx, 0, tw, ground, '#2a2c3c');
  px(tx, 0, 3, ground, '#34374a');
  px(tx + tw - 3, 0, 3, ground, '#1f2130');
  for (let y = ground - 52; y > -8; y -= 12) {
    px(tx + 3, y, tw - 6, 2, '#3d4056');
    for (let k = 0; k < 7; k++) {
      const lit = hash(k, y + 400) % 5 < 2;
      px(tx + 8 + k * 18, y - 8, 10, 7, lit ? '#ffd98a' : '#14162a');
      if (lit && hash(k, y) % 3 === 0) px(tx + 11 + k * 18, y - 6, 3, 5, '#c9a45a');
    }
  }
  // The entrance: a canopy, glass doors, light on the path.
  px(tx + 3, ground - 44, tw - 6, 44, '#232536');
  px(cx - 40, ground - 46, 68, 4, '#4a4d66');
  px(cx - 38, ground - 42, 1, 42, '#4a4d66');
  px(cx + 25, ground - 42, 1, 42, '#4a4d66');
  px(cx - 28, ground - 36, 44, 36, '#ffdf9e');
  px(cx - 28, ground - 36, 44, 36, 'rgba(60,70,100,0.25)');
  px(cx - 7, ground - 36, 2, 36, '#232536');
  px(cx - 28, ground - 22, 44, 1, 'rgba(35,37,54,0.5)');
  px(cx - 18, ground - 30, 6, 14, 'rgba(120,90,60,0.5)');
  glow(cx - 6, ground - 26, 44, '255,217,138', 0.03);
  // The name over the door.
  px(cx - 37, ground - 60, 62, 13, '#14162a');
  px(cx - 37, ground - 60, 62, 1, '#4a4d66');
  label('THE VARSITY', cx - 6, ground - 54, '#ffd98a');
  if (props.includes('people')) {
    // Everyone else who was at the barbecue, on their way out.
    folk(cx - 96, ground, 71, { cup: false });
    folk(cx - 82, ground, 72, { flip: true });
    folk(cx - 60, ground, 73, {});
    folk(cx - 132, ground, 74, { flip: true });
  }
  for (const x of [cx - 52, cx + 30]) { px(x, ground - 8, 12, 8, '#3a3d50'); px(x + 1, ground - 15, 10, 8, '#1f3a2c'); }
  px(0, ground, W, 4, '#55586a');
  px(0, ground + 4, W, H - ground, '#2a2c38');
  px(cx - 32, ground, 56, 4, 'rgba(255,217,138,0.16)');
  for (let x = 0; x < W; x += 30) px(x, ground + 22, 14, 1, '#4a4c58');
  // A lamp down the path, and bikes locked to a rack.
  const lx = cx + 118;
  px(lx, ground - 52, 2, 52, '#15171f');
  px(lx - 4, ground - 54, 8, 2, '#15171f');
  px(lx - 3, ground - 52, 5, 2, '#ffd9a0');
  glow(lx, ground - 48, 30, '255,196,110', 0.035);
  px(lx - 24, ground, 50, 4, 'rgba(255,196,110,0.10)');
  for (const x of [cx - 120, cx - 104]) {
    px(x, ground - 7, 6, 6, '#15171f'); px(x + 1, ground - 6, 4, 4, '#2a2c3c');
    px(x + 9, ground - 7, 6, 6, '#15171f'); px(x + 10, ground - 6, 4, 4, '#2a2c3c');
    px(x + 3, ground - 10, 9, 1, x % 2 ? '#c44536' : '#3d7ab8');
    px(x + 3, ground - 12, 1, 3, '#8a8f98');
  }
}

/** A car seen from the front, in a doughnut shop's car park. The people are behind the windscreen. */
function car(st: Stage): void {
  const ground = st.standY;
  const cx = st.cx;
  sky(DAY, ground);
  // The shop.
  const bx = cx - 150;
  const top = ground - 60;
  px(bx, top, 170, 60, '#efe6d2');
  px(bx - 3, top - 6, 176, 7, '#2e7d4f');
  for (let x = bx; x < bx + 170; x += 8) { px(x, top + 12, 4, 6, '#d94f3a'); px(x + 4, top + 12, 4, 6, '#f7f3ea'); }
  px(bx + 10, top + 24, 70, 26, '#9fd0e6');
  px(bx + 10, top + 24, 70, 2, '#c7e6f2');
  for (let k = 0; k < 8; k++) {
    const c = ['#e8a04a', '#f2a7c0', '#7a4a2a', '#f4f1de'][k % 4];
    px(bx + 14 + k * 8, top + 40, 5, 4, c);
    px(bx + 16 + k * 8, top + 41, 1, 2, '#9fd0e6');
  }
  px(bx + 96, top + 22, 18, 38, '#5b4028');
  px(bx + 99, top + 25, 12, 16, '#9fd0e6');
  // A doughnut on a pole.
  const sx = cx + 104;
  px(sx, ground - 78, 2, 78, '#7c8087');
  g.fillStyle = '#e8a04a';
  g.beginPath(); g.arc(sx + 1, ground - 86, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2a7c0';
  g.beginPath(); g.arc(sx + 1, ground - 87, 9, Math.PI, Math.PI * 2); g.fill();
  g.fillStyle = DAY[2];
  g.beginPath(); g.arc(sx + 1, ground - 86, 3.5, 0, Math.PI * 2); g.fill();
  tree(cx + 150, ground, 34, '#4f8a55');
  // Tarmac and bays.
  px(0, ground, W, H - ground, '#5d6066');
  px(0, ground, W, 1, '#74777d');
  for (let x = cx - 138; x < W; x += 92) px(x, ground + 2, 2, 22, '#d8d6cc');
  // The car: roof, glass and headrests. The bonnet goes on after the people.
  const body = '#4a6fa5';
  px(cx - 31, ground - 51, 62, 5, body);
  px(cx - 29, ground - 52, 58, 1, mix(body, '#ffffff', 0.25));
  px(cx - 31, ground - 47, 62, 24, '#bcd9e6');
  px(cx - 31, ground - 47, 3, 24, body);
  px(cx + 28, ground - 47, 3, 24, body);
  px(cx - 18, ground - 42, 10, 12, '#3a3d44');
  px(cx + 8, ground - 42, 10, 12, '#3a3d44');
  px(cx - 1, ground - 46, 2, 3, '#2a2d33');
}
function carFront(st: Stage): void {
  const ground = st.standY;
  const cx = st.cx;
  const body = '#4a6fa5';
  px(cx - 6, ground - 28, 12, 3, '#2a2d33');
  px(cx - 37, ground - 25, 74, 19, body);
  px(cx - 37, ground - 25, 74, 1, mix(body, '#ffffff', 0.3));
  px(cx - 42, ground - 30, 6, 5, body);
  px(cx + 36, ground - 30, 6, 5, body);
  px(cx - 13, ground - 17, 26, 6, '#22252b');
  for (let x = cx - 12; x < cx + 12; x += 3) px(x, ground - 16, 1, 4, '#3a3d44');
  px(cx - 34, ground - 19, 9, 6, '#f4e9b0');
  px(cx + 25, ground - 19, 9, 6, '#f4e9b0');
  px(cx - 6, ground - 10, 12, 4, '#f4f4f4');
  px(cx - 38, ground - 6, 76, 3, '#2a2d33');
  px(cx - 35, ground - 4, 11, 5, '#15151a');
  px(cx + 24, ground - 4, 11, 5, '#15151a');
  px(cx - 40, ground + 1, 80, 2, 'rgba(0,0,0,0.22)');
}

/** A campsite the morning after. */
function camp(st: Stage): void {
  const ground = st.standY;
  const cx = st.cx;
  sky(['#7fb8e6', '#9cc9ec', '#bcdaf1', '#d8e9f4', '#f2efe0'], ground);
  for (let x = 0; x < W; x++) px(x, ground - 34 - Math.sin(x / 31) * 7 - Math.sin(x / 11) * 2, 1, 40, '#6f9a7a');
  for (let k = 0; k < W / 16 + 2; k++) {
    const x = k * 16 + (hash(k, 5) % 9) - 8;
    const h = 44 + (hash(k, 6) % 26);
    px(x + 5, ground - 10, 2, 10, '#3a2b1f');
    tri(x - 2, ground - h, 16, h - 8, k % 2 ? '#2f5d3f' : '#356848');
  }
  px(0, ground, W, H - ground, '#7a8f52');
  px(0, ground, W, 2, '#8fa562');
  for (let k = 0; k < 40; k++) px(hash(k, 81) % W, ground + 3 + (hash(k, 82) % Math.max(1, H - ground - 3)), 2, 1, k % 3 ? '#6b7f47' : '#9aa56a');
  // The orange tent, and a blue one further off.
  tri(cx - 118, ground - 36, 62, 36, '#e8822e');
  tri(cx - 96, ground - 22, 18, 22, '#8a4a1c');
  px(cx - 88, ground - 36, 2, 36, '#c96a1e');
  tri(cx + 96, ground - 24, 40, 24, '#3d7ab8');
  tri(cx + 110, ground - 14, 12, 14, '#27507a');
  // Last night's fire, and two camp chairs.
  px(cx - 34, ground - 3, 18, 3, '#55504a');
  for (const [dx, c] of [[-36, '#8a8780'], [-30, '#a09d96'], [-22, '#8a8780'], [-16, '#a09d96']] as const) px(cx + dx, ground - 2, 4, 3, c);
  px(cx - 30, ground - 5, 10, 2, '#2a2420');
  const smoke = (clock * 5) % 26;
  px(cx - 26 + Math.sin(clock + smoke * 0.3) * 2, ground - 8 - smoke, 2, 2, `rgba(230,230,230,${0.35 * (1 - smoke / 26)})`);
  px(cx + 76, ground - 12, 10, 2, '#c44536');
  px(cx + 76, ground - 18, 2, 18, '#55504a');
  px(cx + 84, ground - 10, 2, 10, '#55504a');
  px(cx + 74, ground - 20, 3, 8, '#c44536');
}

/** A lecture hall seen from the front: rows rising to the back, and an aisle on the right. */
function hall(st: Stage): void {
  const cx = st.cx;
  const end = cx + 44;
  px(0, 0, W, H, '#3d3b4a');
  px(0, 0, W, 16, '#34323f');
  for (let x = 20; x < W; x += 60) { px(x, 6, 24, 3, '#f4f1de'); glow(x + 12, 8, 22, '244,241,222', 0.02); }
  px(end + 60, 26, 20, 34, '#5b4028');
  px(end + 62, 20, 16, 4, '#1baf7a');
  // The rows behind, each a little higher, with a few heads.
  for (let r = 3; r >= 1; r--) {
    const y = st.seatY - r * 17;
    const shade = mix('#8a6a48', '#3d3b4a', 0.25 + r * 0.14);
    for (let k = 0; k < W / 13; k++) {
      if (hash(k, r * 7) % 5 < 2) continue;
      const x = k * 13 + (hash(k, r) % 5);
      if (x > end - 10 && x < end + 46) continue;
      const tone = ['#2b2118', '#4a2f1b', '#1a1a22', '#7a4a21'][hash(k, r + 30) % 4];
      px(x, y - 13, 6, 6, mix(['#eab98f', '#d39a6a', '#8a5a36'][hash(k, r + 40) % 3], '#3d3b4a', 0.3 + r * 0.1));
      px(x, y - 14, 6, 3, mix(tone, '#3d3b4a', 0.2));
      px(x - 1, y - 7, 8, 5, mix(['#3d5a80', '#c44536', '#5c946e', '#8b8f98'][hash(k, r + 50) % 4], '#3d3b4a', 0.35 + r * 0.1));
    }
    px(0, y - 3, end, 3, shade);
    px(0, y, end, 14, mix(shade, '#000000', 0.3));
    px(end + 46, y - 3, W, 3, shade);
    px(end + 46, y, W, 14, mix(shade, '#000000', 0.3));
  }
  // The aisle: steps going up.
  for (let k = 0; k < 9; k++) px(end, st.standY - k * 8.5, 46, 9, k % 2 ? '#56546a' : '#4d4b60');
  px(end, st.standY, 46, H, '#56546a');
}
function hallFront(st: Stage): void {
  const cx = st.cx;
  const end = cx + 44;
  px(0, st.seatY - 2, end, 3, '#b58a55');
  px(0, st.seatY - 2, end, 1, '#d0a870');
  px(0, st.seatY + 1, end, 22, '#7a5a3a');
  for (let x = 14; x < end; x += 34) px(x, st.seatY + 1, 1, 22, '#6a4c30');
  if (props.includes('laptop')) {
    px(cx - 30, st.seatY - 9, 11, 7, '#2a2d33');
    px(cx - 29, st.seatY - 8, 9, 5, '#9fd0e6');
  }
  px(end + 46, st.seatY - 2, W, 3, '#b58a55');
  px(end + 46, st.seatY + 1, W, 22, '#7a5a3a');
  px(0, st.seatY + 23, end, H, '#2c2a36');
  px(end + 46, st.seatY + 23, W, H, '#2c2a36');
}

/** A supermarket checkout. The receipt keeps printing. */
function checkout(st: Stage): void {
  const ground = st.standY;
  const cx = st.cx;
  px(0, 0, W, ground, '#ece6d6');
  px(0, 0, W, 12, '#c8102e');
  px(0, 12, W, 2, '#8f0b20');
  for (let x = 30; x < W; x += 70) { px(x, 18, 30, 2, '#ffffff'); glow(x + 15, 19, 26, '255,255,255', 0.03); }
  for (let row = 0; row < 3; row++) {
    const y = 44 + row * 22;
    if (y > ground - 24) break;
    for (let x = 2; x < W; x += 5) {
      const h = 9 + (hash(x, row) % 8);
      px(x, y - h, 4, h, ['#e4572e', '#eda100', '#1baf7a', '#2a78d6', '#f2f2f2', '#9b5de5', '#c44536', '#5c946e'][hash(x, row + 9) % 8]);
      px(x, y - h + 2, 4, 2, 'rgba(255,255,255,0.35)');
    }
    px(0, y, W, 3, '#9a8f7a');
  }
  px(0, ground, W, H - ground, '#d5cebd');
  for (let x = 0; x < W; x += 22) px(x, ground, 1, H - ground, '#c4bcaa');
  px(0, ground + 12, W, 1, '#c4bcaa');
  // Two carts, both full.
  for (const x of [cx - 112, cx - 76]) {
    for (let k = 0; k < 10; k++) px(x + 2 + (k % 5) * 5, ground - 30 - Math.floor(k / 5) * 6 + (hash(k, x) % 3), 5, 7, ['#c44536', '#eda100', '#5c946e', '#f2f2f2', '#8a5a36'][hash(k, x + 1) % 5]);
    px(x, ground - 24, 28, 14, 'rgba(170,176,186,0.55)');
    for (let k = 0; k < 28; k += 4) px(x + k, ground - 24, 1, 14, '#8a8f98');
    px(x, ground - 24, 28, 1, '#8a8f98');
    px(x, ground - 10, 28, 1, '#8a8f98');
    px(x - 4, ground - 28, 5, 2, '#c8102e');
    px(x + 3, ground - 10, 1, 7, '#8a8f98');
    px(x + 24, ground - 10, 1, 7, '#8a8f98');
    px(x + 1, ground - 3, 4, 3, '#22252b');
    px(x + 22, ground - 3, 4, 3, '#22252b');
  }
  if (props.includes('people')) {
    folk(cx + 100, ground - 3, 41, { flip: true });
    folk(cx - 146, ground, 42, { cup: false });
    px(cx - 141, ground - 12, 7, 6, '#c8102e');
  }
  // The counter, the belt and the till.
  px(cx + 26, ground - 22, 84, 22, '#6b6f78');
  px(cx + 26, ground - 24, 60, 3, '#22252b');
  for (const [dx, c] of [[32, '#c44536'], [42, '#f2f2f2'], [52, '#5c946e'], [64, '#eda100']] as const) px(cx + dx, ground - 29, 6, 5, c);
  px(cx + 90, ground - 42, 18, 18, '#3a3d44');
  px(cx + 92, ground - 40, 14, 8, '#7fe0a0');
  const len = Math.min(30, 3 + clock * 0.9);
  px(cx + 86, ground - 30, 4, len, '#ffffff');
  for (let y = 2; y < len; y += 3) px(cx + 87, ground - 30 + y, 2, 1, '#9aa0aa');
}

/** Outside on campus, in the rain. `awning` is afterwards, under cover. */
function campus(st: Stage): void {
  const ground = st.standY;
  const cx = st.cx;
  const under = time === 'awning';
  sky(GREY, ground);
  if (under) {
    px(0, ground - 96, W, 96, '#8a4a3a');
    for (let y = ground - 92; y < ground; y += 5) px(0, y, W, 1, '#7a3f31');
    for (let x = (W % 60) / 2 - 30; x < W; x += 60) { px(x, ground - 80, 22, 26, '#3a4654'); px(x, ground - 80, 22, 1, '#c9c2b4'); }
    px(cx - 26, ground - 46, 52, 46, '#2c3a48');
    px(cx - 24, ground - 44, 23, 44, '#dfe8a8');
    px(cx + 1, ground - 44, 23, 44, '#d6df9e');
    px(cx - 1, ground - 44, 2, 44, '#2c3a48');
    px(cx - 84, ground - 62, 168, 8, '#b02a2a');
    for (let x = cx - 84; x < cx + 84; x += 12) px(x, ground - 62, 6, 8, '#e9e2d2');
    px(cx - 84, ground - 54, 168, 2, 'rgba(0,0,0,0.25)');
    px(cx - 82, ground - 54, 1, 54, '#55504a');
    px(cx + 81, ground - 54, 1, 54, '#55504a');
  } else {
    px(cx - 170, ground - 78, 150, 78, '#8a4a3a');
    px(cx - 174, ground - 84, 158, 7, '#e9e2d2');
    for (let y = ground - 74; y < ground; y += 5) px(cx - 170, y, 150, 1, '#7a3f31');
    for (let k = 0; k < 5; k++) for (let r = 0; r < 2; r++) px(cx - 160 + k * 28, ground - 68 + r * 28, 14, 18, k === 2 && r === 1 ? '#5b4028' : hash(k, r) % 3 ? '#3a4654' : '#dfe8a8');
    for (const x of [cx - 112, cx - 88]) px(x, ground - 46, 4, 46, '#e9e2d2');
    tree(cx + 60, ground, 52, '#3f6a4a');
    tree(cx + 118, ground, 40, '#365d41');
    px(cx + 24, ground - 44, 2, 44, '#22252b');
    px(cx + 21, ground - 46, 8, 3, '#22252b');
    px(cx + 22, ground - 43, 6, 2, '#ffe9b0');
    glow(cx + 25, ground - 40, 20, '255,233,176', 0.03);
  }
  px(0, ground, W, H - ground, '#5f666c');
  px(0, ground, W, 2, '#727a80');
  for (let k = 0; k < 6; k++) {
    const x = hash(k, 61) % W;
    const y = ground + 5 + (hash(k, 62) % Math.max(1, H - ground - 10));
    if (under && Math.abs(x - cx) < 90) continue;
    px(x, y, 22, 2, '#78828a');
    const r = (clock * 6 + k * 3) % 8;
    px(x + 11 - r, y, 1, 1, '#aab4bb');
    px(x + 11 + r, y + 1, 1, 1, '#aab4bb');
  }
}
function rainFront(st: Stage): void {
  const under = time === 'awning';
  for (let k = 0; k < W * 0.9; k++) {
    const speed = 150 + (hash(k, 3) % 80);
    const y = (hash(k, 2) + clock * speed) % (H + 10) - 10;
    const x = ((hash(k, 1) % (W + 40)) - y * 0.18 + W + 40) % (W + 40);
    if (under && Math.abs(x - st.cx) < 86 && y > st.standY - 60) continue;
    g.fillStyle = 'rgba(205,220,238,0.42)';
    g.fillRect(Math.round(x), Math.round(y), 1, 4);
  }
  if (under) {
    for (let x = st.cx - 84; x < st.cx + 84; x += 7) {
      const y = (hash(x, 9) + clock * 70) % 56;
      px(x, st.standY - 54 + y, 1, 3, 'rgba(205,220,238,0.6)');
    }
  }
  px(0, 0, W, H, 'rgba(60,70,84,0.12)');
}

/** Castro Street at the end of the day, outside the gym. */
function street(st: Stage): void {
  const ground = st.standY;
  const cx = st.cx;
  sky(DUSK, ground);
  stars(Math.round(ground * 0.25), 0.4);
  for (let x = 0; x < W; x++) px(x, ground - 96 - Math.sin((x + 40) / 52) * 14 - Math.sin(x / 19) * 3, 1, 100, '#4a3a5e');
  // The shops on either side.
  const fronts = ['#c9a0b8', '#a8c0a0', '#d9c08a', '#9ab0d0', '#d0a090'];
  for (let k = -3; k <= 3; k++) {
    if (k === 0) continue;
    const x = cx + (k < 0 ? -54 + k * 62 : -8 + k * 62);
    const h = 70 + (hash(k, 4) % 18);
    const c = mix(fronts[(k + 5) % 5], '#3a2a4a', 0.3);
    px(x, ground - h, 60, h, c);
    px(x - 1, ground - h - 3, 62, 4, mix(c, '#000000', 0.3));
    for (let w = 0; w < 2; w++) { px(x + 8 + w * 26, ground - h + 10, 16, 18, '#ffd98a'); px(x + 8 + w * 26, ground - h + 18, 16, 1, c); }
    px(x + 6, ground - 30, 48, 30, mix('#2c3a48', '#ffd98a', 0.25 + (hash(k, 5) % 3) * 0.12));
    px(x + 4, ground - 34, 52, 5, ['#c44536', '#3d5a80', '#5c946e'][(k + 6) % 3]);
  }
  // The gym.
  px(cx - 54, ground - 82, 108, 82, '#1d1f26');
  px(cx - 46, ground - 76, 92, 15, '#c8102e');
  label('FITNESS SF', cx, ground - 68, '#ffffff');
  px(cx - 46, ground - 54, 92, 54, '#31465a');
  px(cx - 46, ground - 54, 92, 20, 'rgba(255,217,138,0.25)');
  for (let k = 0; k < 4; k++) {
    const x = cx - 40 + k * 23 + (k > 1 ? 10 : 0);
    px(x, ground - 28, 10, 2, '#12141a');
    px(x + 4, ground - 44, 2, 16, '#12141a');
    px(x - 1, ground - 46, 12, 3, '#12141a');
  }
  px(cx - 10, ground - 42, 20, 42, '#1d1f26');
  px(cx - 8, ground - 40, 16, 40, '#ffd98a');
  px(cx - 8, ground - 40, 16, 40, 'rgba(49,70,90,0.35)');
  px(cx + 5, ground - 22, 1, 5, '#1d1f26');
  px(cx - 22, ground, 44, 4, 'rgba(255,217,138,0.14)');
  // A rainbow flag, the pavement, the road and a crossing.
  const fx = cx + 86;
  px(fx, ground - 100, 2, 100, '#22252b');
  ['#e4572e', '#eda100', '#f6e05e', '#1baf7a', '#2a78d6', '#9b5de5'].forEach((c, k) => {
    for (let x = 0; x < 22; x += 2) px(fx + 2 + x, ground - 98 + k * 3 + Math.round(Math.sin(clock * 3 + x * 0.4) * 1.2), 2, 3, c);
  });
  px(0, ground, W, 5, '#8f8c88');
  px(0, ground, W, 1, '#a9a6a0');
  px(0, ground + 5, W, H - ground, '#3f4149');
  if (props.includes('people')) {
    // People going by on the pavement.
    const span = W + 60;
    folk(((clock * 13) % span) - 30, ground - 1, 51, { walk: true, alpha: 0.9 });
    folk(span - 30 - ((clock * 10 + 140) % span), ground - 1, 52, { walk: true, flip: true, alpha: 0.9 });
    folk(((clock * 9 + 260) % span) - 30, ground - 1, 53, { walk: true, alpha: 0.9 });
  }
  ['#e4572e', '#eda100', '#f6e05e', '#1baf7a', '#2a78d6', '#9b5de5'].forEach((c, k) => px(cx - 150 + k * 7, ground + 7, 6, H, mix(c, '#3f4149', 0.35)));
}

/** The bottom of the hill up 15th Street. */
function hill(st: Stage): void {
  const ground = st.standY;
  const cx = st.cx;
  sky(DUSK, ground);
  stars(Math.round(ground * 0.25), 0.5);
  const foot = cx - 4;
  const lineY = (x: number) => (x < foot ? ground : ground - (x - foot) * 0.62);
  // The rocks at the top, and houses stepping up the slope.
  for (let x = 0; x < W; x++) px(x, ground - 70 - Math.max(0, x - cx) * 0.5 - Math.sin(x / 13) * 4 - Math.sin(x / 5) * 1.5, 1, 200, '#4a3a5e');
  const paint = ['#c9a0b8', '#a8c0a0', '#d9c08a', '#9ab0d0', '#d0a090', '#b8a0d0'];
  for (let k = 6; k >= 0; k--) {
    const x = foot + 6 + k * 30;
    const base = lineY(x + 14);
    const c = mix(paint[k % paint.length], '#3a2a4a', 0.32);
    px(x, base - 52, 28, 52 + 20, c);
    tri(x - 1, base - 62, 30, 10, mix(c, '#000000', 0.3));
    px(x + 3, base - 46, 9, 12, '#ffd98a');
    px(x + 16, base - 46, 9, 12, hash(k, 3) % 2 ? '#ffd98a' : '#2c3a48');
    px(x + 3, base - 26, 12, 10, '#2c3a48');
    px(x + 18, base - 22, 7, 22, mix(c, '#000000', 0.45));
  }
  for (let k = -4; k < 0; k++) {
    const x = foot + k * 44 - 6;
    const c = mix(paint[(k + 8) % paint.length], '#3a2a4a', 0.4);
    px(x, ground - 58, 42, 58, c);
    px(x + 5, ground - 48, 12, 14, '#ffd98a');
    px(x + 24, ground - 48, 12, 14, '#2c3a48');
    px(x + 4, ground - 24, 34, 24, mix(c, '#000000', 0.35));
  }
  // The street itself, going up.
  for (let x = 0; x < W; x++) {
    const y = lineY(x);
    px(x, y, 1, H - y, '#3f4149');
    px(x, y, 1, 3, '#8f8c88');
  }
  for (let x = foot + 10; x < W; x += 22) px(x, lineY(x) + 12, 10, 1, '#c9c6b8');
  const lx = cx - 70;
  px(lx, ground - 56, 2, 56, '#22252b');
  px(lx - 4, ground - 58, 9, 2, '#22252b');
  px(lx - 3, ground - 56, 6, 2, '#ffd9a0');
  glow(lx, ground - 52, 30, '255,196,110', 0.03);
}

/** Tennis courts behind a fence, and the bench where you wait. */
function courts(st: Stage): void {
  const ground = st.standY;
  const cx = st.cx;
  const dusk = time === 'dusk';
  const tint = (c: string) => (dusk ? mix(c, '#4a2f4a', 0.38) : c);
  sky(dusk ? DUSK : DAY, ground);
  if (dusk) stars(Math.round(ground * 0.2), 0.4);
  // The park rising behind, and the low painted houses of the Mission along its edge.
  for (let x = 0; x < W; x++) px(x, ground - 84 - Math.sin((x + 30) / 70) * 12 - Math.sin(x / 23) * 2, 1, 60, tint('#7fb06a'));
  for (let k = 0, x = -6; x < W; k++) {
    const w = 22 + (hash(k, 21) % 10);
    const h = 18 + (hash(k, 22) % 10);
    const c = tint(['#e6c9a8', '#c9d8e6', '#e6b8b0', '#d8e0b8', '#d0c0e0'][k % 5]);
    px(x, ground - 46 - h, w, h, c);
    px(x - 1, ground - 48 - h, w + 2, 3, tint('#8a6a5a'));
    for (let q = 3; q < w - 4; q += 7) px(x + q, ground - 42 - h + 4, 4, 5, dusk && hash(k, q) % 2 ? '#ffd98a' : tint('#5a6f86'));
    x += w + 1;
  }
  for (let k = 0; k < W / 46 + 1; k++) tree(k * 46 + (hash(k, 2) % 14), ground - 44, 22 + (hash(k, 3) % 10), tint(k % 2 ? '#4f8a55' : '#437a4c'));
  // Two palms.
  for (const x of [cx - 150, cx + 152]) {
    px(x, ground - 96, 2, 56, tint('#6a5238'));
    for (const [dx, dy, w] of [[-9, 0, 10], [1, 0, 10], [-7, -3, 8], [1, -3, 8], [-4, 2, 4], [2, 2, 4]] as const) px(x + dx, ground - 98 + dy, w, 2, tint('#3f7a48'));
  }
  // The courts: a row of them, side by side.
  const top = ground - 46;
  px(0, top, W, 40, tint('#3f8a63'));
  for (let c0 = cx - 134 - 140 * 2; c0 < W; c0 += 140) {
    const mid = c0 + 64;
    px(c0, top + 6, 128, 28, tint('#3b7fb0'));
    for (const [x, y, w, h] of [[c0, top + 6, 128, 1], [c0, top + 33, 128, 1], [c0, top + 6, 1, 28], [c0 + 127, top + 6, 1, 28], [c0 + 30, top + 12, 68, 1], [c0 + 30, top + 27, 68, 1], [c0 + 30, top + 12, 1, 16], [c0 + 97, top + 12, 1, 16], [c0 + 30, top + 19, 68, 1]] as const) px(x, y, w, h, tint('#f4f4f4'));
    px(mid - 1, top + 2, 2, 34, tint('#e8e8e8'));
    for (let y = top + 4; y < top + 34; y += 2) px(mid - 1, y, 2, 1, 'rgba(0,0,0,0.25)');
    px(mid - 2, top, 4, 3, tint('#55504a'));
  }
  if (props.includes('players')) {
    // Whoever has the courts.
    for (const [c0, seed] of [[cx - 134, 0], [cx + 6, 1.7]] as const) {
      const sw = Math.sin(clock * 2.2 + seed);
      for (const [x, c] of [[c0 + 22 + sw * 8, '#f2f2f2'], [c0 + 104 - sw * 7, seed ? '#9b5de5' : '#eda100']] as const) {
        px(x, top + 10, 4, 4, tint('#d39a6a'));
        px(x - 1, top + 14, 6, 7, tint(c));
        px(x, top + 21, 4, 5, tint('#2d3142'));
        px(x + (x < c0 + 64 ? 5 : -3), top + 12, 2, 4, tint('#c44536'));
      }
      const bt = (clock * 0.55 + seed) % 1;
      px(c0 + 26 + (bt < 0.5 ? bt * 2 : 2 - bt * 2) * 76, top + 14 - Math.sin(bt * Math.PI * 2) ** 2 * 9, 2, 2, '#e6f24a');
    }
  }
  // The fence, and the path in front of it.
  px(0, ground - 6, W, 6, tint('#b9b6b0'));
  for (let y = ground - 62; y < ground - 6; y += 4) px(0, y, W, 1, 'rgba(220,225,230,0.10)');
  for (let x = 0; x < W; x += 4) px(x, ground - 62, 1, 56, 'rgba(220,225,230,0.07)');
  for (let x = (W % 48) / 2; x < W; x += 48) px(x, ground - 64, 2, 58, tint('#5a6068'));
  px(0, ground - 64, W, 2, tint('#5a6068'));
  px(0, ground, W, H - ground, tint('#a8a49c'));
  px(0, ground, W, 1, tint('#c2beb6'));
  // The bench, or two.
  const bench = (x: number, w: number) => {
    px(x, st.seatY - 9, w, 2, tint('#7a5a3a'));
    px(x, st.seatY - 4, w, 2, tint('#7a5a3a'));
    px(x + 3, st.seatY - 9, 2, 9, tint('#4a3828'));
    px(x + w - 5, st.seatY - 9, 2, 9, tint('#4a3828'));
    px(x - 1, st.seatY, w + 2, 3, tint('#8a6848'));
    px(x - 1, st.seatY, w + 2, 1, tint('#a88560'));
    px(x + 3, st.seatY + 3, 2, st.standY - st.seatY - 3, tint('#4a3828'));
    px(x + w - 5, st.seatY + 3, 2, st.standY - st.seatY - 3, tint('#4a3828'));
  };
  bench(cx - 40, 80);
  if (props.includes('bench2')) bench(cx + 62, 44);
  if (props.includes('rackets')) {
    for (const x of [cx - 46, cx + 42]) {
      px(x, st.standY - 9, 1, 9, tint('#2a2d33'));
      px(x - 2, st.standY - 17, 5, 8, tint('#c44536'));
      px(x - 1, st.standY - 16, 3, 6, tint('#e9e2d2'));
    }
    px(cx + 30, st.standY - 2, 2, 2, '#e6f24a');
  }
}

/** Outside a bar at night. */
function bar(st: Stage): void {
  const ground = st.standY;
  const cx = st.cx;
  sky(NIGHT, ground);
  stars(Math.round(ground * 0.3));
  px(0, ground - 104, W, 104, '#1c1a24');
  for (let y = ground - 100; y < ground; y += 6) px(0, y, W, 1, '#22202b');
  for (let x = (W % 70) / 2 - 20; x < W; x += 70) px(x, ground - 96, 18, 22, hash(Math.round(x), 2) % 3 ? '#12111a' : '#3a3020');
  // The door, with the light and the noise behind it.
  const dx = cx + st.door;
  px(dx - 12, ground - 48, 24, 48, '#3a2414');
  px(dx - 10, ground - 46, 20, 46, '#5b3a22');
  px(dx - 7, ground - 42, 14, 16, '#ffb86a');
  px(dx + 6, ground - 22, 1, 4, '#d9b25a');
  glow(dx, ground - 34, 34, '255,184,106', 0.035);
  px(dx - 18, ground, 36, 4, 'rgba(255,184,106,0.16)');
  // A long window, people inside.
  const wx = cx - 22;
  px(wx, ground - 50, 104, 32, '#2a1c14');
  px(wx + 2, ground - 48, 100, 28, '#7a4a26');
  px(wx + 2, ground - 48, 100, 28, `rgba(255,184,106,${0.25 + Math.sin(clock * 2.3) * 0.02})`);
  for (let k = 0; k < 7; k++) {
    const x = wx + 8 + k * 14 + (hash(k, 7) % 4);
    const bob = Math.round(Math.sin(clock * 1.1 + k * 2.1) * 0.6);
    px(x, ground - 37 + bob, 6, 6, '#2a1810');
    px(x - 1, ground - 31 + bob, 8, 11, '#2a1810');
  }
  px(wx + 51, ground - 48, 2, 28, '#2a1c14');
  // A neon sign: a glass, and a line under it.
  const nx = cx + 30;
  const flick = Math.sin(clock * 9) > -0.96 ? 1 : 0.4;
  glow(nx, ground - 74, 26, '255,90,160', 0.03 * flick);
  const neon = `rgba(255,110,170,${flick})`;
  tri(nx - 7, ground - 82, 14, 0, neon);
  for (let r = 0; r < 7; r++) px(nx - 7 + r, ground - 82 + r, 14 - r * 2, 1, r === 0 || r === 6 ? neon : `rgba(255,110,170,${0.35 * flick})`);
  px(nx - 1, ground - 75, 2, 6, neon);
  px(nx - 5, ground - 69, 10, 1, neon);
  px(nx - 22, ground - 64, 44, 1, `rgba(120,220,255,${flick})`);
  px(0, ground, W, 5, '#55535c');
  px(0, ground, W, 1, '#6a6872');
  px(0, ground + 5, W, H - ground, '#24232b');
  const lx = cx + 130;
  px(lx, ground - 60, 2, 60, '#15171f');
  px(lx - 4, ground - 62, 9, 2, '#15171f');
  px(lx - 3, ground - 60, 6, 2, '#ffd9a0');
  glow(lx, ground - 56, 30, '255,196,110', 0.03);
}

/** A table for two: `inside` by a window on the second floor, or `outside` a tea shop. */
function cafe(st: Stage): void {
  const ground = st.standY;
  const cx = st.cx;
  if (time === 'outside') {
    sky(DAY, ground);
    px(0, ground - 92, W, 92, '#3f8f8a');
    px(0, ground - 96, W, 5, '#2d6a66');
    px(cx - 100, ground - 78, 70, 12, '#f4f1de');
    label('BOBA + TEA', cx - 65, ground - 72, '#2d6a66');
    px(cx - 104, ground - 58, 78, 46, '#2d6a66');
    px(cx - 101, ground - 55, 72, 40, '#bfe3f2');
    px(cx - 101, ground - 55, 72, 14, 'rgba(255,255,255,0.25)');
    for (let k = 0; k < 5; k++) { px(cx - 96 + k * 14, ground - 28, 7, 11, ['#e9c98a', '#f2a7c0', '#c9a06a', '#b8e0a0', '#e9c98a'][k]); px(cx - 94 + k * 14, ground - 32, 1, 5, '#22252b'); }
    px(cx + 66, ground - 56, 26, 56, '#2d6a66');
    px(cx + 69, ground - 53, 20, 30, '#bfe3f2');
    tree(cx + 134, ground, 46, '#4f8a55');
    px(0, ground, W, H - ground, '#b9b6b0');
    px(0, ground, W, 1, '#d0cdc6');
    for (let x = 10; x < W; x += 36) px(x, ground, 1, H - ground, '#a5a29c');
    // An umbrella over the table.
    px(cx, st.seatY - 44, 1, 44, '#55504a');
    tri(cx - 34, st.seatY - 52, 69, 9, '#e9e2d2');
    for (let k = 0; k < 3; k++) tri(cx - 34 + k * 26, st.seatY - 52, 17, 9, 'rgba(196,69,54,0.55)');
  } else {
    px(0, 0, W, ground, '#3a2f2a');
    for (let x = 0; x < W; x += 18) px(x, 0, 1, ground, '#40342e');
    // The window, and the street below.
    const wx = cx - 96;
    const ww = 192;
    const wy = 12;
    const wh = ground - 50;
    g.save();
    g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
    sky(DAY, wy + wh);
    drawSkyline(g, city, '#8fa8c4', 0, 60, W, wy + wh + 16);
    for (let k = 0; k < 6; k++) {
      const x = wx + k * 36 + (hash(k, 4) % 10);
      const h = 30 + (hash(k, 5) % 30);
      px(x, wy + wh - h, 30, h, ['#b8c4d0', '#c9b8a8', '#a8b4c4'][k % 3]);
      for (let r = 4; r < h - 4; r += 7) for (let c = 3; c < 26; c += 6) px(x + c, wy + wh - h + r, 3, 4, '#6f8296');
    }
    g.restore();
    for (const [x, y, w, h] of [[wx - 3, wy - 3, ww + 6, 3], [wx - 3, wy + wh, ww + 6, 4], [wx - 3, wy, 3, wh], [wx + ww, wy, 3, wh], [wx + ww / 3, wy, 2, wh], [wx + (ww * 2) / 3, wy, 2, wh]] as const) px(x, y, w, h, '#231b17');
    for (const x of [cx - 60, cx + 60]) { px(x, 0, 1, 18, '#15131a'); px(x - 4, 18, 9, 5, '#e9c98a'); glow(x, 22, 26, '255,205,130', 0.03); }
    px(0, ground, W, H - ground, '#2a211d');
    for (let x = 6; x < W; x += 24) px(x, ground, 1, H - ground, '#33291f');
    px(0, ground, W, 2, '#4a3a30');
    if (props.includes('people')) {
      // The counter where you order, someone behind it, and a menu on the wall.
      const bx = cx - 158;
      px(bx - 2, ground - 76, 40, 22, '#1c1612');
      for (let r = 0; r < 4; r++) px(bx + 2, ground - 72 + r * 4, 12 + ((r * 5) % 14), 1, '#e9c98a');
      folk(bx + 14, ground - 4, 61, {});
      px(bx - 10, ground - 26, 58, 26, '#5b4028');
      px(bx - 12, ground - 28, 62, 3, '#c9a06a');
      px(bx + 30, ground - 40, 12, 12, '#9aa0aa');
      px(bx + 33, ground - 37, 6, 4, '#22252b');
      px(bx - 6, ground - 36, 12, 8, '#bfe3f2');
      for (let k = 0; k < 3; k++) px(bx - 4 + k * 4, ground - 33, 2, 3, ['#e9c98a', '#f2a7c0', '#7a4a2a'][k]);
      folk(bx + 62, ground, 62, { flip: true, cup: true });
      // Other tables, other laptops.
      for (const [dx, seed] of [[84, 63], [128, 64]] as const) {
        const tx = cx + dx;
        if (tx > W - 10) continue;
        folk(tx - 8, ground - 1, seed, {});
        px(tx - 12, st.seatY - 5, 22, 3, '#c9a06a');
        px(tx - 2, st.seatY - 2, 3, ground - st.seatY + 2, '#6a4f3a');
        px(tx - 1, st.seatY - 11, 7, 6, '#c9ccd4');
        px(tx - 11, st.seatY + 1, 8, ground - st.seatY - 1, '#2a211d');
      }
    }
  }
  // Two chairs.
  for (const s of [-1, 1]) {
    px(cx + s * 30 - 1, st.seatY - 14, 2, 14 + (ground - st.seatY), '#4a3828');
    px(cx + s * 24 - 6, st.seatY, 12, 2, '#6a4f3a');
    px(cx + s * 19 - 1, st.seatY + 2, 2, ground - st.seatY - 2, '#4a3828');
  }
}
function cafeFront(st: Stage): void {
  const ground = st.standY;
  const cx = st.cx;
  px(cx - 15, st.seatY - 5, 30, 3, '#c9a06a');
  px(cx - 15, st.seatY - 5, 30, 1, '#e0bb86');
  px(cx - 2, st.seatY - 2, 4, ground - st.seatY + 2, '#6a4f3a');
  px(cx - 8, ground - 2, 16, 2, '#4a3828');
  if (props.includes('laptops')) {
    for (const s of [-1, 1]) {
      px(cx + s * 9 - 4, st.seatY - 12, 8, 7, '#c9ccd4');
      px(cx + s * 9 - 4, st.seatY - 6, 9, 1, '#9aa0aa');
    }
  }
  if (props.includes('cups')) {
    px(cx - 2, st.seatY - 9, 3, 4, '#f4f1de');
    px(cx + 2, st.seatY - 8, 3, 3, '#f4f1de');
    const steam = (clock * 4) % 8;
    px(cx - 1, st.seatY - 11 - steam, 1, 1, `rgba(244,241,222,${0.5 * (1 - steam / 8)})`);
  }
  if (props.includes('phone')) {
    px(cx - 3, st.seatY - 7, 7, 2, '#15151a');
    px(cx - 2, st.seatY - 7, 5, 1, Math.sin(clock * 5) > 0 ? '#7fe0a0' : '#4fae78');
  }
  if (props.includes('tea')) {
    for (const x of [-10, 8]) { px(cx + x, st.seatY - 11, 4, 6, '#e9c98a'); px(cx + x + 1, st.seatY - 14, 1, 4, '#22252b'); px(cx + x, st.seatY - 7, 4, 2, '#3a2414'); }
  }
}

// ------------------------------------------------------------------ the list

interface SetDef {
  stage(W: number, H: number): Stage;
  back(st: Stage): void;
  front?(st: Stage): void;
  /** People on their feet are in front of the front layer (a sofa), not behind it (a desk). */
  standInFront?: boolean;
  sound(time: string): Ambience;
}
const at = (W: number, H: number, cxf: number, groundf: number, seat: number, legs: number, extra: Partial<Stage> = {}): Stage => {
  const ground = Math.round(H * groundf);
  return { cx: Math.round(W * cxf), standY: ground, seatY: ground - seat, legs, door: 0, spots: {}, ...extra };
};
const SETS: Record<string, SetDef> = {
  pier: {
    stage: (W, H) => { const deck = Math.round(H * 0.66); return { cx: Math.round(W * 0.54), seatY: deck, standY: deck - 4, legs: 8, door: 0, spots: { YOU: 0, THEM: -19 } }; },
    back: pier, sound: () => 'water',
  },
  steps: { stage: (W, H) => at(W, H, 0.5, 0.74, 18, 7, { spots: { YOU: 9, THEM: -11 } }), back: steps, sound: () => 'street' },
  sofa: { stage: (W, H) => at(W, H, 0.4, 0.72, 9, 8, { spots: { YOU: 11, THEM: -10 } }), back: sofa, front: sofaFront, standInFront: true, sound: () => 'room' },
  tower: { stage: (W, H) => at(W, H, 0.5, 0.74, 9, 8), back: tower, sound: () => 'street' },
  car: { stage: (W, H) => at(W, H, 0.5, 0.74, 23, 0), back: car, front: carFront, sound: () => 'street' },
  camp: { stage: (W, H) => at(W, H, 0.5, 0.74, 9, 8), back: camp, sound: () => 'street' },
  hall: { stage: (W, H) => { const seatY = Math.round(H * 0.6); return { cx: Math.round(W * 0.46), seatY, standY: seatY + 3, legs: 0, door: 0, spots: {} }; }, back: hall, front: hallFront, sound: () => 'room' },
  checkout: { stage: (W, H) => at(W, H, 0.5, 0.74, 9, 8), back: checkout, sound: () => 'room' },
  campus: { stage: (W, H) => at(W, H, 0.5, 0.74, 9, 8), back: campus, front: rainFront, sound: () => 'rain' },
  street: { stage: (W, H) => at(W, H, 0.5, 0.74, 9, 8), back: street, sound: () => 'street' },
  hill: { stage: (W, H) => at(W, H, 0.5, 0.74, 9, 8), back: hill, sound: () => 'street' },
  courts: { stage: (W, H) => at(W, H, 0.5, 0.74, 10, 9), back: courts, sound: () => 'street' },
  bar: { stage: (W, H) => at(W, H, 0.5, 0.74, 9, 8, { door: -70 }), back: bar, sound: () => 'street' },
  cafe: { stage: (W, H) => at(W, H, 0.5, 0.72, 10, 9), back: cafe, front: cafeFront, sound: (t) => (t === 'outside' ? 'street' : 'room') },
};

const def = (set: string): SetDef => SETS[set] ?? SETS.pier;
function use(env: SetEnv): void {
  ({ g, W, H, clock, time, props, city } = env);
}
export const stageOf = (set: string, w: number, h: number): Stage => def(set).stage(w, h);
export const standInFront = (set: string): boolean => !!def(set).standInFront;
export const soundOf = (set: string, t: string): Ambience => def(set).sound(t);
export function drawBack(set: string, env: SetEnv, st: Stage): void { use(env); def(set).back(st); }
export function drawFront(set: string, env: SetEnv, st: Stage): void { use(env); def(set).front?.(st); }
