// Activities are plain data. Adding a new recurring group is a new entry in
// CLUBS; no simulation code changes.

/** The context an interaction happened in. */
export type Ctx = 'work' | 'club' | 'hangout' | 'outing' | 'family' | 'call' | 'childhood' | 'message';
// Append only: positions are written into the contact log.
export const CTX_LIST: Ctx[] = ['work', 'club', 'hangout', 'outing', 'family', 'call', 'childhood', 'message'];

export interface ClubActivity {
  id: string;
  /** What the person is into, e.g. "running". */
  hobby: string;
  /** Venue name suffix, e.g. "Run Club". */
  venueSuffix: string;
  /** Chance a member turns up in a given week. */
  attend: number;
  /** How many people each attendee tries to talk to per session. */
  tries: number;
  /** Chance of actually talking to a stranger you were paired with (before trait effects). */
  open: number;
  /** How much one interaction strengthens a tie, as a fraction of the gap to `cap`. */
  gain: number;
  /** Strength this context alone can build up to. Closer ties need chosen time together. */
  cap: number;
  /** Target membership per club. */
  size: number;
}

export const CLUBS: ClubActivity[] = [
  { id: 'run', hobby: 'running', venueSuffix: 'Run Club', attend: 0.6, tries: 3, open: 0.2, gain: 0.05, cap: 0.4, size: 28 },
  { id: 'games', hobby: 'board games', venueSuffix: 'Game Night', attend: 0.55, tries: 3, open: 0.4, gain: 0.07, cap: 0.45, size: 14 },
  { id: 'dance', hobby: 'dancing', venueSuffix: 'Dance Practice', attend: 0.65, tries: 3, open: 0.35, gain: 0.07, cap: 0.45, size: 20 },
  { id: 'climb', hobby: 'climbing', venueSuffix: 'Climbing Gym', attend: 0.5, tries: 2, open: 0.2, gain: 0.06, cap: 0.4, size: 30 },
  { id: 'choir', hobby: 'singing', venueSuffix: 'Community Choir', attend: 0.7, tries: 2, open: 0.25, gain: 0.05, cap: 0.4, size: 26 },
  { id: 'books', hobby: 'reading', venueSuffix: 'Book Club', attend: 0.6, tries: 4, open: 0.5, gain: 0.07, cap: 0.45, size: 10 },
  { id: 'football', hobby: 'football', venueSuffix: 'Five-a-Side', attend: 0.6, tries: 3, open: 0.35, gain: 0.06, cap: 0.4, size: 16 },
  { id: 'pottery', hobby: 'pottery', venueSuffix: 'Pottery Studio', attend: 0.55, tries: 2, open: 0.3, gain: 0.05, cap: 0.35, size: 12 },
  { id: 'improv', hobby: 'improv', venueSuffix: 'Improv Night', attend: 0.55, tries: 3, open: 0.45, gain: 0.07, cap: 0.45, size: 14 },
  { id: 'quiz', hobby: 'trivia', venueSuffix: 'Pub Quiz', attend: 0.5, tries: 3, open: 0.3, gain: 0.06, cap: 0.4, size: 24 },
];
