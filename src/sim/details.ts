// The detail library: small invented specifics for the story's captions.
//
// The simulation knows that two people spent an evening together; it does not know what they did.
// These lines fill that in. The event under each one is real (it is in the log); the detail is
// chosen here from the two people's hobbies and from where they know each other, and it is keyed
// by seed and person, so the same life always tells the same story.
//
// {N} is the other person's first name. Lines avoid "he" and "she".
// To add a detail: append a line to a list. To add a kind of detail: add a list and a function.

import { hashInt } from './rng';

/** Indexed like CLUBS: run, games, dance, climb, choir, books, football, pottery, improv, quiz. */
const KID_THEIRS: string[][] = [
  ['{N} talks you into the school cross-country team. You come last. {N} is waiting at the line.'],
  ["A board game on {N}'s floor that lasts a whole weekend. Neither of you gives in."],
  ['{N} has a routine to learn and you hold the phone. You film the ceiling.'],
  ['{N} gets you up the tree behind the school. Getting down takes an hour.'],
  ['{N} sings in the back of the car with the windows down. You pretend not to know the words.'],
  ["{N} lends you a book and asks every day whether you've finished it."],
  ["Penalties against {N}'s garage door until it is too dark to see the ball."],
  ['{N} makes you a mug in art class. The handle falls off in a week. You keep it.'],
  ['{N} does the voice of every teacher. You are the one sent out for laughing.'],
  ['{N} knows every capital city and makes sure you know it.'],
];
const KID_YOURS: string[][] = [
  ['You race {N} to the end of the street every day for a year. You win about half.'],
  ['You teach {N} your favourite game and lose the first time you play.'],
  ['You show {N} a dance from a video. Neither of you ever speaks of it again.'],
  ['You dare {N} onto the garage roof. You both get grounded for it, the same week.'],
  ['You sing on the walk to school. {N} joins in on the second verse.'],
  ['You read the same book at the same time and are not allowed to skip ahead.'],
  ['You and {N} against the older kids, every lunch break. You lose most of them.'],
  ['You make {N} a clay dog. {N} says it is a horse and keeps it anyway.'],
  ['You put on a show in the yard. {N} is the whole audience and claps at the wrong moments.'],
  ['You quiz each other on flags. {N} makes some up to see if you notice.'],
];
const KID: string[] = [
  "{N}'s basement, a whole summer. You build a fort out of sofa cushions and refuse to come up for dinner.",
  'The night before an exam, on the front steps. {N} quizzes you. You get four out of twenty.',
  'Walking home from a birthday party, you talk about who you each like, and take the long way.',
  '{N} is at your house so often that your family stops asking and just sets a place.',
  'Bikes, every evening, until the streetlights come on.',
  'You fall out over something neither of you can remember by Monday.',
  'A sleepover where nobody sleeps. You make plans for when you are grown up.',
  'You share one pair of headphones on the bus, an ear each.',
];

const ADULT_THEIRS: string[][] = [
  ['{N} gets you out for a run. You complain for five kilometres and sign up for a race that night.'],
  ["{N}'s game night ends at three in the morning over a rule nobody can find."],
  ['{N} drags you to a dance class. You are terrible. {N} is delighted.'],
  ['{N} takes you climbing. In rented shoes, six feet up, you are furious.'],
  ['Karaoke. {N} picks your song for you, and it is the wrong one.'],
  ["{N} hands you a book with the corners folded down on the pages you're meant to notice."],
  ["Five-a-side in the rain. {N} goes in goal so you don't have to."],
  ['{N} makes you a bowl. It leans. You use it every day.'],
  ['{N} makes you come to a show, then pulls you up on stage.'],
  ['{N} joins your quiz team and knows nothing except, somehow, every flag.'],
];
const ADULT_BY_CTX: Record<string, string[]> = {
  work: [
    'Lunch at the same table every day. {N} always takes your fries.',
    'You both stay late the week everything breaks. {N} orders dumplings to the office.',
    '{N} covers for you the morning you oversleep. You owe a coffee and never stop owing it.',
  ],
  club: [
    'You start getting there early, because {N} does.',
    'Afterwards the two of you are always the last to leave.',
    'You save {N} a place without deciding to.',
  ],
  other: [
    "{N} texts 'outside' with no warning. You go.",
    'A film neither of you likes. You talk through all of it and get shushed.',
    'You help {N} carry a sofa up four flights. It does not fit through the door.',
    '{N} cooks for you. It is one dish, and it is always that dish.',
    'You miss the last train together and walk the whole way home.',
  ],
};

const FIRST_WORDS: Record<string, string[]> = {
  work: [
    "It is {N}'s first week. You are told to show {N} around, and get lost yourself.",
    '{N} sits down at the desk opposite and asks if the coffee is always this bad. It is.',
  ],
  club: [
    '{N} is new and stands at the edge. You are the one who says hello.',
    '{N} is paired with you because nobody else is left.',
  ],
  outing: [
    '{N} ends up next to you and you do not talk to anyone else all night.',
    'By the end of the evening {N} has your number and you have a nickname.',
  ],
  hangout: [
    '{N} takes the last free seat, which is at your table, without asking.',
    'You both reach for the same order. It is not yours.',
    '{N} knocks your drink over, buys the replacement, and then drinks half of it.',
  ],
};

const SHOW_UP: Record<'death' | 'breakup', string[]> = {
  death: [
    '{N} turns up with food from a place you have never heard of and does not ask how you are.',
    '{N} sits with you and lets the television run. Nobody says anything useful. It helps.',
    '{N} takes you out for noodles and talks about anything else, until you can talk about it.',
    '{N} does your dishes without a word and stays until you fall asleep on the sofa.',
  ],
  breakup: [
    '{N} comes over with a bag of groceries and cooks, badly.',
    '{N} takes you somewhere nice for dinner and will not let you look at your phone.',
    '{N} lets you say the same thing four times and nods every time.',
  ],
};

/** When it is the other person having the hard time, and you are the one who goes. */
const YOU_SHOW_UP: string[] = [
  'You bring soup you made yourself. It is not good. {N} eats all of it.',
  'You sit on the floor of {N}\'s kitchen until two in the morning.',
  'You do not know what to say, so you do the washing-up and stay.',
  'You take {N} for a long drive with no destination, and let the radio do the talking.',
];

const TALK: string[] = [
  'You stay until they stack the chairs. {N} tells you something nobody else knows.',
  'A walk home that takes the long way. You say the thing you have been not saying.',
  '{N} asks how you really are, and waits for the answer.',
  'It gets late. You tell {N} what you are afraid of, and {N} does not try to fix it.',
];

const FIGHT: string[] = [
  '{N} says you only turn up when something is wrong. It is a little true.',
  'You cancel on {N} once too often.',
  'Something you said as a joke. It was not heard as one.',
  'You both say more than you mean, and neither of you takes it back.',
  '{N} forgets something that mattered to you, and you let it become a bigger thing than it was.',
];

const MEND: string[] = [
  'A message out of nowhere: a photo of the two of you, years younger.',
  '{N} is at your door with a coffee, made the way you take it.',
  'You write first. It takes four drafts.',
  '{N} calls on your birthday as if nothing had happened, and then says sorry.',
];

const REUNION: string[] = [
  'You both start talking at once.',
  '{N} still laughs the same way.',
  'It takes about a minute to be the two of you again.',
  'You have a hundred things to say and start with the weather.',
];

const TOGETHER: string[] = [
  'It is {N} who says it first.',
  'Neither of you can say afterwards who leaned in.',
  'You are halfway through a sentence about something else.',
  '{N} pulls you onto a dance floor you have been refusing for years.',
];

const VISIT_THEM: string[] = [
  '{N} flies out for a long weekend and sleeps on your sofa.',
  '{N} arrives with one bag and a list of things to eat.',
];
const VISIT_YOU: string[] = [
  "You fly out to see {N} and are shown the neighbourhood as if {N} had always lived there.",
  "You sleep on {N}'s floor for a week and it feels like no time has passed.",
];

/** Something of yours they end up with when one of you moves. It can come back later. */
const KEEPSAKE: string[] = ['your grey hoodie', 'a book you lent and never asked for', 'your good umbrella', 'the scarf you left behind', 'your spare key'];

export interface DetailFor {
  seed: number;
  /** The other person's id and first name. */
  id: number;
  name: string;
  myHobbies: number[];
  theirHobbies: number[];
}

const fill = (line: string, name: string) => line.split('{N}').join(name);

export function details(d: DetailFor) {
  let slot = 0;
  const used = new Set<string>();
  /** A line from the list, the same every time for this person, and never the same line twice. */
  const pick = (list: string[], salt: number): string => {
    if (!list.length) return '';
    const start = hashInt(d.seed, d.id, salt, slot++, 71) % list.length;
    for (let i = 0; i < list.length; i++) {
      const line = list[(start + i) % list.length];
      if (!used.has(line)) { used.add(line); return fill(line, d.name); }
    }
    return fill(list[start], d.name);
  };
  const byHobby = (theirs: string[][], yours: string[][] | null): string[] => [
    ...d.theirHobbies.flatMap((h) => theirs[h] ?? []),
    ...(yours ? d.myHobbies.flatMap((h) => yours[h] ?? []) : []),
  ];
  return {
    /** Small moments from growing up together: one from a hobby if there is one, the rest general. */
    childhood(count: number): string[] {
      const out: string[] = [];
      const hobby = byHobby(KID_THEIRS, KID_YOURS);
      if (hobby.length) out.push(pick(hobby, 1));
      while (out.length < count) out.push(pick(KID, 2));
      return out;
    },
    /** Small moments from the first year or two of an adult friendship. */
    early(ctx: string, count: number): string[] {
      const out: string[] = [];
      const hobby = byHobby(ADULT_THEIRS, null);
      if (hobby.length) out.push(pick(hobby, 3));
      const general = ctx === 'work' ? [...ADULT_BY_CTX.work, ...ADULT_BY_CTX.other] : ctx === 'club' ? [...ADULT_BY_CTX.club, ...ADULT_BY_CTX.other] : ADULT_BY_CTX.other;
      while (out.length < count) out.push(pick(general, 4));
      return out;
    },
    firstWords: (ctx: string) => pick(FIRST_WORDS[ctx] ?? FIRST_WORDS.hangout, 5),
    showUp: (why: 'death' | 'breakup') => pick(SHOW_UP[why], 6),
    youShowUp: () => pick(YOU_SHOW_UP, 14),
    talk: () => pick(TALK, 7),
    fight: () => pick(FIGHT, 8),
    mend: () => pick(MEND, 9),
    reunion: () => pick(REUNION, 10),
    together: () => pick(TOGETHER, 11),
    visit: (theyCame: boolean) => pick(theyCame ? VISIT_THEM : VISIT_YOU, 12),
    keepsake: () => KEEPSAKE[hashInt(d.seed, d.id, 13, 0, 71) % KEEPSAKE.length],
  };
}
