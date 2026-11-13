// Scenes written by hand for one particular simulated life.
//
// The simulation supplies the facts (who these two are, what has just happened, how long they
// have known each other); the dialogue is authored for that life and is not generated. A scene
// names the life it was written for, and the page only offers it while that life still matches,
// because a new rule in the simulation changes every life.

export type Who = 'you' | 'them';

export type Step =
  /** A place and a time, alone on the screen. */
  | { t: 'title'; text: string; sub?: string; hold: number }
  /** Nothing is said. The scene keeps running for `s` seconds. */
  | { t: 'pause'; s: number }
  | { t: 'say'; who: Who; text: string; /** Seconds of quiet after the line. */ after?: number }
  /** The other person walks out along the pier, sits down, hands over a bottle, or drinks. */
  | { t: 'enter' }
  | { t: 'sit' }
  | { t: 'give' }
  | { t: 'drink'; who: Who }
  /** The last line, alone on the screen. {seen} is how many times the two have seen each other. */
  | { t: 'end'; text: string };

export interface FilmScene {
  /** What the title screen calls it. */
  name: string;
  set: 'pier';
  /** The life this was written for: the seed, the other person, and their first name as a check. */
  seed: number;
  other: number;
  otherName: string;
  /** What the other person is wearing, when the scene needs it: a shirt colour. */
  wearing?: string;
  /** The week it happens in, for ages and grey hair. */
  week: number;
  steps: Step[];
}

// Seed 7. Axel is 43 and lives in New York. His father Jonas has just died, aged 86, far away.
// Kofi is the friend he grew up with in San Francisco: they made up flag quizzes as kids, Kofi kept
// Axel's grey hoodie when Axel moved away at 23, they did not see each other for nine years, and
// Kofi moved to New York in 2040. Three years ago Kofi's partner Suki died and Axel was the one
// who came round. Rafael is Axel's partner. All of that is in the simulated life.
const PIER_7: FilmScene = {
  name: 'The pier',
  set: 'pier',
  seed: 7,
  other: 1051,
  otherName: 'Kofi',
  // The grey hoodie.
  wearing: '#8b8f98',
  week: 1287,
  steps: [
    { t: 'title', text: 'New York, 2050', sub: 'The week after the funeral', hold: 4 },
    { t: 'pause', s: 5 },
    { t: 'enter' },
    { t: 'pause', s: 1.5 },
    { t: 'say', who: 'them', text: "Rafael said you'd be out here.", after: 1.4 },
    { t: 'say', who: 'you', text: 'Rafael talks too much.', after: 1.2 },
    { t: 'sit' },
    { t: 'give' },
    { t: 'pause', s: 3.5 },
    { t: 'say', who: 'them', text: "I'm not going to ask how you are.", after: 1.6 },
    { t: 'say', who: 'you', text: 'Good.', after: 1 },
    { t: 'drink', who: 'them' },
    { t: 'pause', s: 2.5 },
    { t: 'drink', who: 'you' },
    { t: 'pause', s: 5 },
    { t: 'say', who: 'you', text: 'He kept the flag quizzes. Every one we ever made him sit through. A whole drawer of them.', after: 2 },
    { t: 'say', who: 'them', text: 'Even the ones I made up?', after: 1.2 },
    { t: 'say', who: 'you', text: 'He thought Zambovia was a real country until I was about thirty.', after: 1.6 },
    { t: 'say', who: 'them', text: 'Zambovia was good work.', after: 1 },
    { t: 'pause', s: 5 },
    { t: 'say', who: 'you', text: 'I left at twenty-three, Kof. I kept meaning to go back more.', after: 1.2 },
    { t: 'pause', s: 4 },
    { t: 'drink', who: 'them' },
    { t: 'say', who: 'them', text: 'When Suki died you came round and did my washing-up for a week.', after: 2 },
    { t: 'say', who: 'them', text: "You didn't say one useful thing.", after: 1.4 },
    { t: 'say', who: 'you', text: "I didn't have one.", after: 1.6 },
    { t: 'say', who: 'them', text: 'No. Nobody does.', after: 1.8 },
    { t: 'say', who: 'them', text: 'You came, though.', after: 1 },
    { t: 'pause', s: 6 },
    { t: 'say', who: 'you', text: 'Is that my hoodie?', after: 1.2 },
    { t: 'say', who: 'them', text: "It's been mine since 2030.", after: 1.2 },
    { t: 'say', who: 'you', text: 'It was a loan.', after: 1 },
    { t: 'say', who: 'them', text: 'It was not.', after: 1 },
    { t: 'drink', who: 'you' },
    { t: 'pause', s: 7 },
    { t: 'say', who: 'them', text: 'Same time tomorrow?', after: 2.4 },
    { t: 'say', who: 'you', text: 'Yeah.', after: 1 },
    { t: 'pause', s: 6 },
    { t: 'end', text: 'You and Kofi have seen each other {seen} times in forty years. This was one of them.' },
  ],
};

const ALL: FilmScene[] = [PIER_7];

/** The scene written for this life, if there is one and the life is still the one it was written for. */
export function sceneFor(seed: number, people: { id: number; name: string }[]): FilmScene | null {
  const s = ALL.find((x) => x.seed === seed);
  if (!s) return null;
  const p = people.find((x) => x.id === s.other);
  return p && p.name.split(' ')[0] === s.otherName ? s : null;
}
