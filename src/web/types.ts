import type { ArcExport, LifeExport, PersonExport } from '../sim/export';

export interface View {
  data: LifeExport;
  people: Map<number, PersonExport>;
  /** Each person's part in the story, by id. */
  arcs: Map<number, ArcExport>;
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
  /** Open the card showing the protagonist and this person over time. */
  openPerson(id: number): void;
  showTip(html: string, x: number, y: number): void;
  hideTip(): void;
  /**
   * The screen is one full-window stage with HUD overlays on top. These are the CSS pixels
   * the overlays cover at the top and bottom, so a scene can keep its subject clear of them.
   */
  insets(): { top: number; bottom: number };
}

/** An animated view driven by the shared playhead. It fills the whole stage. */
export interface Scene {
  /** A new life was loaded. */
  reset(): void;
  /** The user jumped to a different point in time. */
  seek(): void;
  /** Draw one frame. dt is seconds since the last frame, already scaled by playback speed. */
  frame(dt: number): void;
  /** 0 while the scene is dwelling on a moment and time should hold still, otherwise 1. */
  timeScale(): number;
  /** The window or the overlays changed size. */
  resize?(): void;
  /** Which highlight the dialogue box should show, if the scene wants to choose. -1 for none yet. */
  caption?(): number;
}
