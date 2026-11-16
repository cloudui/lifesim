// Procedural pixel art: every sprite is drawn in code from a person's id, so there
// are no image assets to license or load.

export function hash(a: number, b = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
export const unit = (a: number, b = 0) => hash(a, b) / 4294967296;

export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${f(r1, r2)},${f(g1, g2)},${f(b1, b2)})`;
}

const SKIN = ['#f6d3b3', '#eab98f', '#d39a6a', '#b17a4c', '#8a5a36', '#5f3d24'];
const HAIR = ['#2b2118', '#4a2f1b', '#7a4a21', '#b8862f', '#d9b25a', '#8c2f1c', '#1a1a22'];
const SHIRT = ['#e4572e', '#2a78d6', '#1baf7a', '#eda100', '#9b5de5', '#e87ba4', '#3d5a80', '#f2f2f2', '#5c946e', '#c44536'];
const PANTS = ['#2d3142', '#4f5d75', '#5b4636', '#1f2933'];

export interface Look {
  skin: string;
  hair: string;
  /** 0 short, 1 long, 2 bun, 3 cropped, 4 middle part with a swoop, 5 short and spiky, 6 a mop of curls, 7 permed mullet. */
  hairStyle: number;
  shirt: string;
  pants: string;
  /** Which formal outfit they wear for big occasions. */
  formal: 'suit' | 'gown';
  /** Extra pixels of height (one is about three inches). */
  tall?: number;
  /** Shorts: the lower leg is bare. */
  shorts?: boolean;
  /** An open jacket over the shirt. */
  jacket?: string;
  /** Shoe colour, when it matters. */
  shoes?: string;
}

export function lookFor(id: number): Look {
  return {
    skin: SKIN[hash(id, 1) % SKIN.length],
    hair: HAIR[hash(id, 2) % HAIR.length],
    hairStyle: hash(id, 3) % 4,
    shirt: SHIRT[hash(id, 4) % SHIRT.length],
    pants: PANTS[hash(id, 5) % PANTS.length],
    formal: hash(id, 6) % 2 ? 'suit' : 'gown',
  };
}

export type Outfit = 'casual' | 'suit' | 'gown';
export type Pose = 'walk' | 'stand' | 'wave';

export interface SpriteOptions {
  pose: Pose;
  /** Animation frame counter; any integer. */
  frame: number;
  outfit: Outfit;
  /** 0 to 1: how grey their hair has gone. */
  grey?: number;
  /** Face left instead of right. */
  flip?: boolean;
  alpha?: number;
  /** Mid-change between outfits: the new outfit and progress 0 to 1. */
  melt?: { to: Outfit; t: number };
}

const SW = 20;
const SH = 26;
function scratch(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = SW;
  c.height = SH;
  return [c, c.getContext('2d', { willReadFrequently: true })!];
}
let buffers: ReturnType<typeof scratch>[] | undefined;

/** Paint one person, facing right, feet on the bottom row. */
function paint(g: CanvasRenderingContext2D, look: Look, outfit: Outfit, pose: Pose, frame: number, grey: number): void {
  g.clearRect(0, 0, SW, SH);
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };
  const stride = pose === 'walk' && (frame & 1) === 1;
  const by = (stride ? 4 : 3) - (look.tall ?? 0);
  const hair = grey > 0 ? mix(look.hair, '#dcdcdc', grey) : look.hair;
  const shirt = outfit === 'suit' ? '#23242c' : outfit === 'gown' ? '#f7f5ef' : look.shirt;
  const jacket = outfit === 'casual' ? look.jacket : undefined;
  const sleeve = outfit === 'gown' ? look.skin : jacket ?? shirt;
  const shoe = look.shoes ?? '#15151a';
  const bare = outfit === 'casual' && look.shorts;
  const pants = outfit === 'suit' ? '#1b1c22' : look.pants;
  const legsTop = by + 15;

  // Legs, or the skirt of a gown.
  if (outfit === 'gown') {
    for (let y = by + 13; y <= 24; y++) {
      const r = y - (by + 13);
      const half = Math.min(8, 3 + ((r + 1) >> 1));
      px(10 - half, y, half * 2, 1, r % 3 === 2 ? '#e2dfd6' : '#f7f5ef');
    }
  } else if (stride) {
    px(6, legsTop, 3, 23 - legsTop, pants);
    px(11, legsTop, 3, 24 - legsTop, pants);
    if (bare) { px(6, legsTop + 3, 3, 20 - legsTop, look.skin); px(11, legsTop + 3, 3, 21 - legsTop, look.skin); }
    px(5, 23, 4, 1, shoe);
    px(11, 24, 4, 1, shoe);
  } else {
    px(8, legsTop, 4, 24 - legsTop, pants);
    if (bare) px(8, legsTop + 3, 4, 21 - legsTop, look.skin);
    px(8, 24, 5, 1, shoe);
  }

  // Back arm, torso, front arm.
  const swing = stride ? ((frame & 2) === 0 ? 1 : -1) : 0;
  px(6 - swing, by + 8, 1, 6, sleeve);
  px(6 - swing, by + 14, 1, 1, look.skin);
  px(7, by + 8, 6, 7, shirt);
  if (jacket) { px(7, by + 8, 2, 7, jacket); px(11, by + 8, 2, 7, jacket); }
  if (outfit === 'suit') {
    px(9, by + 8, 2, 4, '#f4f4f4');
    px(9, by + 8, 2, 1, '#c0392b');
  }
  if (pose === 'wave') {
    const wiggle = (frame >> 1) & 1;
    px(13, by + 4, 1, 6, sleeve);
    px(13 + wiggle, by + 2, 2, 2, look.skin);
  } else {
    px(13 + swing, by + 8, 1, 6, sleeve);
    px(13 + swing, by + 14, 1, 1, look.skin);
  }

  // Head and hair.
  px(9, by + 7, 2, 1, look.skin);
  px(7, by + 1, 6, 6, look.skin);
  px(10, by + 4, 1, 1, '#1a1a1a');
  px(12, by + 4, 1, 1, '#1a1a1a');
  const curl = mix(look.hair, '#ffffff', 0.16);
  if (look.hairStyle === 3) px(7, by, 6, 2, hair);
  else if (look.hairStyle === 4) {
    // Parted in the middle, falling to both sides of the forehead.
    px(7, by, 6, 2, hair);
    px(6, by + 1, 1, 4, hair);
    px(7, by + 2, 2, 1, hair);
    px(12, by + 2, 1, 1, hair);
    px(13, by + 1, 1, 2, hair);
    px(10, by + 1, 1, 1, look.skin);
  } else if (look.hairStyle === 5) {
    px(7, by, 6, 2, hair);
    px(6, by + 1, 1, 2, hair);
    for (const x of [7, 9, 11, 12]) px(x, by - 1, 1, 1, hair);
  } else if (look.hairStyle === 6) {
    px(6, by - 2, 8, 2, hair);
    px(5, by - 1, 10, 3, hair);
    px(5, by + 2, 2, 3, hair);
    px(14, by + 1, 1, 2, hair);
    for (const [x, y] of [[7, -2], [10, -1], [12, -2], [6, 0], [13, 0], [9, 1], [5, 3]]) px(x, by + y, 1, 1, curl);
  } else if (look.hairStyle === 7) {
    px(6, by - 1, 8, 3, hair);
    px(6, by + 2, 1, 2, hair);
    px(5, by + 3, 2, 6, hair);
    px(4, by + 6, 1, 3, hair);
    for (const [x, y] of [[7, -1], [10, 0], [12, -1], [5, 4], [6, 7], [4, 7]]) px(x, by + y, 1, 1, curl);
  } else {
    px(7, by, 6, 3, hair);
    px(6, by + 1, 1, 3, hair);
  }
  if (look.hairStyle === 1) px(5, by + 1, 2, 8, hair);
  if (look.hairStyle === 2) px(5, by - 1, 3, 3, hair);
  if (outfit === 'gown') px(4, by + 1, 2, 10, 'rgba(255,255,255,0.75)');
}

/** Draw a person with their feet at (x, y) on a low-resolution canvas. */
export function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, look: Look, o: SpriteOptions): void {
  buffers ??= [scratch(), scratch(), scratch()];
  const [[c0, g0], [, g1], [c2, g2]] = buffers;
  paint(g0, look, o.outfit, o.pose, o.frame, o.grey ?? 0);
  let src = c0;
  if (o.melt && o.melt.t > 0 && o.melt.t < 1) {
    // The new outfit pours down from the top through a ragged, sparkling edge.
    paint(g1, look, o.melt.to, o.pose, o.frame, o.grey ?? 0);
    const a = g0.getImageData(0, 0, SW, SH);
    const b = g1.getImageData(0, 0, SW, SH);
    const front = o.melt.t * 1.7;
    for (let py = 0; py < SH; py++) {
      for (let pxl = 0; pxl < SW; pxl++) {
        const edge = py / SH + unit(pxl, py) * 0.6;
        const i = (py * SW + pxl) * 4;
        if (front > edge) {
          a.data[i] = b.data[i];
          a.data[i + 1] = b.data[i + 1];
          a.data[i + 2] = b.data[i + 2];
          a.data[i + 3] = b.data[i + 3];
        }
        if (Math.abs(front - edge) < 0.05 && (a.data[i + 3] > 0 || b.data[i + 3] > 0)) {
          a.data[i] = a.data[i + 1] = a.data[i + 2] = a.data[i + 3] = 255;
        }
      }
    }
    g2.putImageData(a, 0, 0);
    src = c2;
  }
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (o.flip) {
    ctx.translate(ix, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, -SW / 2, iy - SH + 1);
  } else ctx.drawImage(src, ix - SW / 2, iy - SH + 1);
  ctx.restore();
}

/** Small one-colour glyphs, as rows of bits. */
export const GLYPHS: Record<string, string[]> = {
  heart: ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'],
  bang: ['11', '11', '11', '11', '00', '11'],
  star: ['0001000', '0011100', '1111111', '0111110', '0110110', '1100011'],
  note: ['0011', '0010', '0010', '1110', '1110'],
  dots: ['00000', '00000', '10101', '00000'],
  z: ['1111', '0010', '0100', '1111'],
  ask: ['0110', '1001', '0010', '0100', '0000', '0100'],
  ring: ['01110', '10001', '00100', '01010', '00000', '00100'],
  puff: ['0110', '1111', '0110'],
};

export function drawGlyph(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, color: string): void {
  const rows = GLYPHS[name];
  ctx.fillStyle = color;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '1') ctx.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
  });
}

/** A standing portrait of a person, as a small canvas scaled up by CSS. The same face everywhere. */
export function portrait(id: number, scale: number): HTMLCanvasElement {
  return portraitOf(lookFor(id), scale);
}
export function portraitOf(look: Look, scale: number, grey = 0): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 20;
  c.height = 26;
  c.style.width = `${20 * scale}px`;
  c.style.height = `${26 * scale}px`;
  c.style.imageRendering = 'pixelated';
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  drawPerson(g, 10, 25, look, { pose: 'stand', frame: 0, outfit: 'casual', grey });
  return c;
}
