import type { LifeExport, PersonExport } from '../sim/export';

export interface View {
  data: LifeExport;
  people: Map<number, PersonExport>;
  /** Fixed angle for each person, clockwise by when they met the protagonist. */
  angle: Map<number, number>;
  totalWeeks: number;
  /** Per snapshot: how many non-family people sit in each tier, innermost first. */
  tiers: number[][];
}

/** What a scene may read from the page. Scenes never change the playhead themselves. */
export interface Ctx {
  view(): View;
  week(): number;
  playing(): boolean;
  yearOf(w: number): number;
  ageAt(w: number): number;
  cityAt(timeline: [number, number][], w: number): number;
  levelOf(s: number): number;
  strengthsAt(w: number): Map<number, number>;
  snapIndex(w: number): number;
  /** The protagonist's partner at week w, or null. `from` is null if they were together before the story. */
  partnerAt(w: number): { id: number; from: number | null } | null;
  /** Whether this person is or ever was the protagonist's partner. */
  wasPartner(id: number): boolean;
  personTip(id: number): string;
  showTip(html: string, x: number, y: number): void;
  hideTip(): void;
}

/** An animated view driven by the shared playhead. */
export interface Scene {
  /** A new life was loaded. */
  reset(): void;
  /** The user jumped to a different point in time. */
  seek(): void;
  /** Draw one frame. dt is seconds since the last frame, already scaled by playback speed. */
  frame(dt: number): void;
  /** 0 while the scene is dwelling on a moment and time should hold still, otherwise 1. */
  timeScale(): number;
}
