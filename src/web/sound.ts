/// <reference types="vite/client" />
// Sound for the film, made in the browser: there are no audio files.
//
//   ambience  a bed of filtered noise per set: water at the pier, a room, a street
//   voices    a short soft blip as each letter of a line is typed, pitched per speaker,
//             so two sprites sound like two people
//
// Browsers only allow sound after a click or a key press, so nothing plays until then.
// The choice to mute is remembered.

export type Ambience = 'water' | 'room' | 'street' | 'rain' | 'none';

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let bed: { src: AudioBufferSourceNode; gain: GainNode; lfo?: OscillatorNode } | null = null;
let bedKind: Ambience = 'none';
let muted = false;
try { muted = localStorage.getItem('film-muted') === '1'; } catch { /* private window */ }
let lastBlip = 0;

function context(): AudioContext | null {
  if (ac) return ac;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ac.destination);
  return ac;
}

/** Call from a click or key press: lets the browser start playing. */
export function unlock(): void {
  const c = context();
  if (c && c.state === 'suspended') void c.resume();
}

export function isMuted(): boolean {
  return muted;
}
export function setMuted(m: boolean): void {
  muted = m;
  try { localStorage.setItem('film-muted', m ? '1' : '0'); } catch { /* private window */ }
  if (ac && master) master.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.05);
  if (tune) tune.muted = m;
}

/** Four seconds of noise, looped: brown-ish for water and rooms, white for rain. */
function noise(c: AudioContext, white = false): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    if (white) { d[i] = Math.random() * 2 - 1; continue; }
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

/** Fade the bed of sound over to the one for this set. */
export function ambience(kind: Ambience): void {
  const c = context();
  if (!c || !master || kind === bedKind) return;
  bedKind = kind;
  const now = c.currentTime;
  if (bed) {
    const old = bed;
    old.gain.gain.setTargetAtTime(0, now, 0.6);
    window.setTimeout(() => { try { old.src.stop(); old.lfo?.stop(); } catch { /* already stopped */ } }, 3000);
    bed = null;
  }
  if (kind === 'none') return;
  const src = c.createBufferSource();
  src.buffer = noise(c, kind === 'rain');
  src.loop = true;
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  gain.gain.value = 0;
  let lfo: OscillatorNode | undefined;
  if (kind === 'water') {
    // Low and slow, swelling like small waves against the posts.
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    lfo = c.createOscillator();
    lfo.frequency.value = 0.17;
    const depth = c.createGain();
    depth.gain.value = 0.05;
    lfo.connect(depth).connect(gain.gain);
    lfo.start();
    gain.gain.setTargetAtTime(0.11, now, 1.5);
  } else if (kind === 'rain') {
    filter.type = 'bandpass';
    filter.frequency.value = 2600;
    filter.Q.value = 0.5;
    gain.gain.setTargetAtTime(0.035, now, 1.5);
  } else if (kind === 'room') {
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    gain.gain.setTargetAtTime(0.07, now, 1.5);
  } else {
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.4;
    gain.gain.setTargetAtTime(0.045, now, 1.5);
  }
  src.connect(filter).connect(gain).connect(master);
  src.start();
  bed = { src, gain, lfo };
}

/** One letter of a line, at the speaker's pitch in Hz. `soft` is someone off screen or on a phone. */
export function blip(pitch: number, letter: string, soft = false): void {
  const c = context();
  if (!c || !master || muted || c.state !== 'running') return;
  if (!/[a-z0-9]/i.test(letter)) return;
  const now = c.currentTime;
  // Not every letter: a blip every 60ms or so reads as a voice, more is a buzz.
  if (now - lastBlip < 0.06) return;
  lastBlip = now;
  const base = pitch || 220;
  const o = c.createOscillator();
  o.type = 'triangle';
  // A little movement from letter to letter, so it is not a single tone.
  o.frequency.value = base * (1 + ((letter.toLowerCase().charCodeAt(0) % 7) - 3) * 0.018);
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(soft ? 0.03 : 0.055, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, now + 0.07);
  o.connect(g).connect(master);
  o.start(now);
  o.stop(now + 0.08);
}

// ------------------------------------------------------------------ music
//
// Either a tune made here (a slow arpeggio over four chords, with a bass note under each), or a
// file: `music: name` in a scene plays public/music/name.mp3 if `name` is not one of the tunes below.

interface Tune { bpm: number; chords: number[][]; wave: OscillatorType; gain: number; pattern: number[] }
const TUNES: Record<string, Tune> = {
  // C, G, A minor, F: the daytime one.
  warm: { bpm: 84, chords: [[60, 64, 67], [55, 62, 67], [57, 60, 64], [53, 60, 65]], wave: 'triangle', gain: 0.03, pattern: [0, 1, 2, 1, 0, 2, 1, 2] },
  // A minor, F, C, G, slower and softer: late at night.
  quiet: { bpm: 60, chords: [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]], wave: 'sine', gain: 0.035, pattern: [0, -1, 1, -1, 2, -1, 1, -1] },
  // The daytime one again, much slower: forty years on.
  late: { bpm: 52, chords: [[60, 64, 67], [55, 62, 67], [57, 60, 64], [53, 60, 65]], wave: 'sine', gain: 0.035, pattern: [0, -1, 2, -1, 1, -1, 2, -1] },
};
let tuneKind = 'none';
let tuneTimer: number | undefined;
let tuneGain: GainNode | null = null;
let tune: HTMLAudioElement | null = null;

/** Change the music under the film: one of the tunes above, a file name, or 'none'. */
export function music(kind: string): void {
  if (kind === tuneKind) return;
  tuneKind = kind;
  window.clearInterval(tuneTimer);
  if (tuneGain && ac) { const old = tuneGain; old.gain.setTargetAtTime(0, ac.currentTime, 0.5); window.setTimeout(() => old.disconnect(), 3000); tuneGain = null; }
  if (tune) { tune.pause(); tune = null; }
  if (kind === 'none') return;
  const def = TUNES[kind];
  if (!def) {
    tune = new Audio(`${import.meta.env.BASE_URL}music/${kind}.mp3`);
    tune.loop = true;
    tune.volume = 0.35;
    tune.muted = muted;
    void tune.play().catch(() => { /* no such file, or not allowed yet */ });
    return;
  }
  const c = context();
  if (!c || !master) return;
  const out = c.createGain();
  out.gain.value = 0;
  out.gain.setTargetAtTime(1, c.currentTime, 2);
  out.connect(master);
  tuneGain = out;
  const half = 30 / def.bpm;
  let n = 0;
  let next = c.currentTime + 0.3;
  const note = (midi: number, at: number, len: number, vol: number, wave: OscillatorType) => {
    const o = c.createOscillator();
    o.type = wave;
    o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    const e = c.createGain();
    e.gain.setValueAtTime(0, at);
    e.gain.linearRampToValueAtTime(vol, at + 0.03);
    e.gain.exponentialRampToValueAtTime(0.0005, at + len);
    o.connect(e).connect(out);
    o.start(at);
    o.stop(at + len + 0.05);
  };
  tuneTimer = window.setInterval(() => {
    // Schedule a little ahead of the clock, so the timer's jitter is not heard.
    while (next < c.currentTime + 0.6) {
      const chord = def.chords[Math.floor(n / 8) % def.chords.length];
      const k = def.pattern[n % 8];
      if (k >= 0) note(chord[k] + (n % 16 === 12 ? 12 : 0), next, half * 3, def.gain, def.wave);
      if (n % 8 === 0) note(chord[0] - 24, next, half * 8, def.gain * 1.3, 'sine');
      next += half;
      n++;
    }
  }, 200);
}

/** Leaving the film: let the bed and the music fade out. */
export function quiet(): void {
  ambience('none');
  music('none');
}
