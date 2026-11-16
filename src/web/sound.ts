// Sound for the film, made in the browser: there are no audio files.
//
//   ambience  a bed of filtered noise per set: water at the pier, a room, a street
//   voices    a short soft blip as each letter of a line is typed, pitched per speaker,
//             so two sprites sound like two people
//
// Browsers only allow sound after a click or a key press, so nothing plays until then.
// The choice to mute is remembered.

export type Ambience = 'water' | 'room' | 'street' | 'none';

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
}

/** Four seconds of brown-ish noise, looped. */
function noise(c: AudioContext): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
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
  src.buffer = noise(c);
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

/** One letter of a line. `voice` picks the pitch: 0 and 1 are the two people, 2 is someone off screen. */
export function blip(voice: number, letter: string): void {
  const c = context();
  if (!c || !master || muted || c.state !== 'running') return;
  if (!/[a-z0-9]/i.test(letter)) return;
  const now = c.currentTime;
  // Not every letter: a blip every 60ms or so reads as a voice, more is a buzz.
  if (now - lastBlip < 0.06) return;
  lastBlip = now;
  const base = [196, 262, 147][voice] ?? 220;
  const o = c.createOscillator();
  o.type = 'triangle';
  // A little movement from letter to letter, so it is not a single tone.
  o.frequency.value = base * (1 + ((letter.toLowerCase().charCodeAt(0) % 7) - 3) * 0.018);
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(voice === 2 ? 0.03 : 0.055, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, now + 0.07);
  o.connect(g).connect(master);
  o.start(now);
  o.stop(now + 0.08);
}

/** Leaving the film: let the bed fade out. */
export function quiet(): void {
  ambience('none');
}
