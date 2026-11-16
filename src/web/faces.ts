// Portraits for the film's dialogue box.
//
// The body sprite's head is six pixels wide, which is not enough for a face: a mouth is one
// pixel. A portrait is drawn separately at 32 by 26, from the same Look, so it is the same
// person: skin, hair colour and style, glasses, what they are wearing. It faces the viewer,
// blinks, moves its mouth while a line is being typed, and can hold an expression.

import { mix, type Look } from './pixel';
import type { Mood } from './scenes';

export const FACE_W = 32;
export const FACE_H = 26;

type G = CanvasRenderingContext2D;

export interface FaceState { mood: Mood; blink: boolean; talking: boolean; grey: number }

export function drawFace(g: G, look: Look, st: FaceState): void {
  const px = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  g.clearRect(0, 0, FACE_W, FACE_H);
  const skin = look.skin;
  const shade = mix(skin, '#3a1f1a', 0.22);
  const dark = mix(skin, '#2a1512', 0.72);
  const hair = st.grey > 0 ? mix(look.hair, '#dcdcdc', st.grey) : look.hair;
  const curl = mix(hair, '#ffffff', 0.16);
  const hs = look.hairStyle;
  const long = hs === 1 || hs === 10 || hs === 7;

  // Hair that falls behind the head and shoulders.
  if (long) {
    px(5, 6, 22, hs === 7 ? 16 : 20, hair);
    px(4, 10, 24, hs === 7 ? 10 : 14, hair);
    if (hs === 10) for (const [x, y] of [[5, 12], [26, 14], [4, 18], [27, 20], [6, 22], [25, 9]]) px(x, y, 1, 2, curl);
  }
  // Shoulders, in what they are wearing, and the neck.
  px(4, 23, 24, 3, look.jacket ?? look.shirt);
  px(7, 22, 18, 1, look.jacket ?? look.shirt);
  if (look.jacket) px(12, 22, 8, 4, look.shirt);
  px(13, 20, 6, 3, shade);
  px(14, 22, 4, 1, skin);
  // The head, with the corners taken off, and ears.
  px(9, 6, 14, 15, skin);
  px(10, 5, 12, 1, skin);
  px(10, 21, 12, 1, skin);
  for (const [x, y] of [[9, 6], [22, 6], [9, 20], [22, 20]]) px(x, y, 1, 1, long ? hair : 'rgba(0,0,0,0)');
  g.clearRect(9, 20, 1, 1);
  g.clearRect(22, 20, 1, 1);
  if (long) { px(9, 20, 1, 1, hair); px(22, 20, 1, 1, hair); }
  px(8, 12, 1, 4, skin);
  px(23, 12, 1, 4, skin);
  px(9, 19, 14, 1, mix(skin, '#3a1f1a', 0.06));

  // Brows and eyes.
  const sad = st.mood === 'sad';
  px(11, sad ? 10 : 11, 4, 1, dark);
  px(17, sad ? 10 : 11, 4, 1, dark);
  if (sad) { px(11, 10, 1, 1, skin); px(11, 11, 2, 1, dark); px(20, 10, 1, 1, skin); px(19, 11, 2, 1, dark); }
  if (st.blink || st.mood === 'shut') {
    px(11, 14, 3, 1, dark);
    px(18, 14, 3, 1, dark);
  } else {
    px(11, 13, 3, 2, '#f7f3ea');
    px(18, 13, 3, 2, '#f7f3ea');
    px(12, 13, 2, 2, '#1a1418');
    px(19, 13, 2, 2, '#1a1418');
    px(12, 13, 1, 1, '#3d3540');
    px(19, 13, 1, 1, '#3d3540');
    if (st.mood === 'smile') { px(11, 14, 1, 1, skin); px(20, 14, 1, 1, skin); }
  }
  // Nose and mouth.
  px(15, 15, 1, 2, shade);
  px(15, 17, 2, 1, shade);
  const lip = mix(skin, '#8a2f2a', 0.55);
  const open = st.mood === 'open' || st.talking;
  if (open) {
    const tall = st.mood === 'open' ? 2 : 1;
    px(14, 19, 4, 1 + tall, '#4a1c1c');
    if (st.mood === 'open') px(14, 19, 4, 1, '#f7f3ea');
    if (st.mood === 'smile') { px(13, 19, 1, 1, lip); px(18, 19, 1, 1, lip); }
  } else if (st.mood === 'smile') {
    px(13, 18, 1, 1, lip);
    px(18, 18, 1, 1, lip);
    px(14, 19, 4, 1, lip);
  } else if (sad) {
    px(14, 19, 4, 1, lip);
    px(13, 20, 1, 1, lip);
    px(18, 20, 1, 1, lip);
  } else px(14, 19, 4, 1, lip);

  // Hair in front.
  const cap = () => { px(9, 4, 14, 3, hair); px(10, 3, 12, 1, hair); px(8, 6, 2, 5, hair); px(22, 6, 2, 5, hair); };
  if (hs === 3) { px(9, 4, 14, 2, hair); px(10, 3, 12, 1, hair); }
  else if (hs === 2) { cap(); px(13, 0, 6, 4, hair); px(14, 1, 2, 1, curl); }
  else if (hs === 4) {
    // A middle part, falling to each side.
    cap();
    px(9, 7, 5, 3, hair); px(18, 7, 5, 3, hair); px(9, 10, 2, 2, hair); px(21, 10, 2, 2, hair);
    px(15, 5, 2, 3, skin);
  } else if (hs === 5) {
    cap();
    for (let x = 9; x < 23; x += 2) px(x, 2 - ((x >> 1) % 2), 1, 2, hair);
    px(10, 7, 12, 1, hair);
  } else if (hs === 6) {
    // A mop of curls, taller than the face is wide.
    px(8, 0, 16, 3, hair);
    px(6, 2, 20, 6, hair);
    px(5, 4, 22, 5, hair);
    px(6, 9, 3, 4, hair); px(23, 9, 3, 4, hair);
    px(9, 8, 13, 2, hair);
    px(10, 10, 3, 1, hair); px(15, 10, 4, 1, hair); px(20, 10, 2, 1, hair);
    for (const [x, y] of [[9, 1], [14, 0], [20, 1], [7, 4], [12, 3], [17, 2], [23, 4], [6, 8], [25, 7], [11, 6], [19, 6], [15, 8], [22, 10], [8, 11]]) px(x, y, 2, 1, curl);
  } else if (hs === 7) {
    cap();
    px(8, 2, 16, 3, hair); px(10, 7, 12, 1, hair);
    for (const [x, y] of [[10, 2], [15, 3], [20, 2], [5, 14], [26, 16], [6, 19]]) px(x, y, 2, 1, curl);
  } else if (hs === 8) {
    // A messy fringe to the brows, and flyaways.
    px(8, 3, 16, 4, hair); px(9, 2, 14, 1, hair);
    px(8, 7, 2, 5, hair); px(22, 7, 2, 5, hair);
    px(9, 7, 14, 3, hair);
    px(10, 10, 3, 1, hair); px(14, 10, 2, 1, hair); px(18, 10, 4, 1, hair);
    for (const [x, y, h] of [[11, 0, 2], [14, 1, 1], [17, 0, 2], [20, 1, 1], [8, 2, 1], [23, 2, 1], [13, 1, 1]]) px(x, y, 1, h, hair);
    for (const [x, y] of [[12, 4], [18, 5], [21, 3]]) px(x, y, 2, 1, curl);
  } else if (hs === 9) {
    // Short and dense with a flat top, close at the sides.
    px(9, 2, 14, 5, hair); px(10, 1, 12, 1, hair);
    px(8, 5, 1, 5, hair); px(23, 5, 1, 5, hair);
    px(10, 7, 12, 1, hair); px(11, 8, 9, 1, hair);
  } else if (hs === 10) {
    // Parted in the middle, wavy, in front of the ears.
    px(9, 3, 14, 4, hair); px(10, 2, 12, 1, hair);
    px(8, 6, 3, 12, hair); px(21, 6, 3, 12, hair);
    px(11, 7, 3, 2, hair); px(18, 7, 3, 2, hair);
    px(15, 4, 2, 4, skin);
    for (const [x, y] of [[8, 9], [22, 11], [9, 14], [21, 16], [12, 3], [19, 4]]) px(x, y, 2, 1, curl);
  } else if (hs === 1) { cap(); px(8, 6, 2, 12, hair); px(22, 6, 2, 12, hair); px(10, 7, 12, 1, hair); }
  else { cap(); px(10, 7, 12, 1, hair); }

  if (look.glasses) {
    const c = look.glasses;
    const t = look.heavyGlasses ? 2 : 1;
    for (const x of [9, 17]) {
      px(x, 11, 6, 1, c); px(x, 16, 6, 1, c); px(x, 11, 1, 6, c); px(x + 5, 11, 1, 6, c);
      if (t === 2) { px(x, 12, 6, 1, c); px(x - 1, 12, 1, 4, c); }
    }
    px(15, 13, 2, 1, c);
    px(8, 13, 1, 1, c); px(23, 13, 1, 1, c);
    if (t === 1) for (const x of [9, 17]) px(x + 1, 12, 2, 1, 'rgba(255,255,255,0.25)');
  }
}
