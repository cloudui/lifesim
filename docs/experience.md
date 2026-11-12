# The experience we are aiming for

A working draft, started 2026-11-12. This is current thinking, not a spec. Every part of it is meant to be tried, looked at and changed. When something here turns out wrong in practice, change this file rather than bending the build to fit it. Sections marked **Open** are undecided on purpose.

`docs/product-ideas.md` is the wider list of ideas. This file is narrower: what the core experience should feel like, and which parts of the simulation serve that feeling.

## The feeling

The draw is watching people shift in and out of a life: how random events, and the odds behind them, change who is in it. The moment to capture is something like this: you decide on a whim to spend a weekend somewhere, and at the aquarium you run into someone you have not seen in ten years.

The page should make people feel how small and how big life is, and leave them with some sense of what their relationships mean. Realism matters where it makes that believable. It is not the goal on its own.

## What makes a moment feel magical

Our current guess at the ingredients, taken from the aquarium moment:

1. **A setup.** You knew this person, and the story showed them to you while you did. A reunion with someone you never saw means nothing.
2. **A gap.** Time passed, and both of you went off into other parts of life.
3. **A departure from routine.** You were somewhere you do not usually go.
4. **Odds you can read.** "About a 1-in-9,000 chance that weekend", or "if you had gone on Sunday instead…"

A working test for any new feature: **what moment does it create?** If we cannot name a moment it would put on screen, it waits. This test is a rule of thumb; override it when something is clearly worth trying.

Where the simulation stands against these today: it has the odds, and a weak version of the gap. It has little setup, because people arrive as "Met X (age, trait)" and seldom become characters. It has almost no departure from routine, because everyone lives in three cities and follows their routine.

## Two scales

- **How big life is:** you crossed paths with tens of thousands of people, spoke to hundreds, and a dozen mattered.
- **How small it is:** the stranger at the aquarium is three handshakes from you, and the chain runs through your college roommate.

## Shape: a life in chapters

Current thinking, to try. A life reads as a few chapters: home, maybe college, a first city, an era defined by a hobby or a job, a move. Each chapter has a small cast. Between chapters people scatter. The memorable moments are where threads cross chapters: a reunion, a college friend who turns out to know your partner, the person who keeps turning up in every chapter.

Chapters are also how a long life could play in about a minute. Quiet stretches inside a chapter fold away, and the crossings get the screen time.

**Open:** whether chapters are detected from what happened (moves, job changes, a hobby era) or are part of the setup from the start. Detecting them is the more natural fit for a simulation; try that first.

## Whose life

Current thinking: eventually the person sets a handful of knobs so the life resembles their own, or someone else's they would like to see. Then they watch it play, then dig into it by clicking people and moments. Watching comes first and exploring second.

A first guess at the knobs (six or so, each answerable in a few seconds):

1. Where you grew up.
2. Family roots elsewhere: places you go back to.
3. Path, as an archetype (see below), which covers whether you go to college.
4. How outgoing you are.
5. How adventurous you are, travel included.
6. A few hobbies.

**Open:** which knobs actually change a life enough to be worth asking. Measure each one by running lives with it set high and low.

## Starting age

Start at 18 for now. A short prologue for childhood can come later, for instance if we want the site to appeal to younger people. Not everyone goes to college, so college is one path among several, not a stage everyone passes through.

## Three layers

These ideas seem to belong together: a person is shaped by where they come from and who they are with, and they change over time.

### 1. Background: who you start as

- **Roots.** Family in other places that pull you back: parents from China, grandparents in Texas, a hometown you visit for the holidays. Model them as a short list of places, each with a pull (every holiday, every couple of years). Going back is where reunions come from. Roots can also shape who you click with.
- **Archetypes for career, school and money.** Perhaps six to eight, so it stays manageable. An archetype bundles the size and turnover of your workplace, your hours, travel for work, the cities you are likely to live in, income (which pays for travel), and whether college is part of the path.
- **Travel tendency.** Not in the model yet. A trait of its own, or part of "adventurous". Weekend trips and holidays put people from every part of your life into the same places for a few days.

### 2. Influence: who you are with changes you

This may be the most important layer, because it is about relationships, which is what the project is about.

- **A partner pulls you into their world:** their clubs, their friends, what they want to do at the weekend. Over years two circles merge; after a breakup your share of the merged circle tends to fall away. Today partners only come along to plans.
- **Friends pull you into things:** go along as a plus-one, try their hobby, and sometimes it sticks. "You took up climbing because of Sam, and were still climbing twenty years after Sam moved away." Today a changed hobby is often copied from a friend, but nothing makes a friend the reason for the change.
- **Small nudges:** a gift, an invitation, a recommendation. The same mechanism on a smaller scale. Later.

### 3. Drift: you change over time

- Traits shift with age and with what happens to you. A bike accident makes you warier of biking; a great year in a club makes you more outgoing. One possible form is a table of event, the trait it moves, and by how much, varying with personality.
- Interests mature and fade: hobbies phase in and out, giving a life its eras.
- Two guidelines so drift stays readable: every shift should show up on screen ("after the crash, Maya stopped riding and drifted from the Saturday group"), and shifts should be few, limited in size and partly fade back.
- Tone: light, never crude. Heavier events wait until we decide how to show them.

## Where the world needs detail

An idea to try, not a decision. Full person-by-person simulation where the camera is (the protagonist's cities and the few hundred people around them), and likelihoods elsewhere (destinations, distant people, the background crowd). That is what would make extra destinations affordable.

Worth keeping either way: everyone near the protagonist follows the same rules as the protagonist, so friends meeting without you and other people's lives crossing still happen naturally. This would loosen the earlier rule that the protagonist is only a camera in a uniform world, so record it in `AGENTS.md` if we adopt it.

Already in the model and worth keeping: friends of convenience, such as coworkers who fall away soon after the job ends.

## Places

Several destinations, but not many, so the world stays small. Destinations can be thinner than home cities: a few relatives, some locals, and whoever else is visiting that week.

**Open, reconsider later:** how many destinations, which ones, and how detailed each is.

## How this changes the order of work

Current thinking: settle the experience first and the practical work after it. Conflict, speed and calibration are still needed, but they serve whatever shape comes out of this. A plausible first experiment that tests the feeling cheaply: add travel and holidays home to the existing three cities, then check whether reunions start to feel like the aquarium moment. Change the plan freely if it does not.

## Open questions

- Watching versus exploring: how much of the page is a film, and how much a world to poke at.
- Which knobs matter enough to ask for.
- How chapters are found and shown.
- How many destinations, and how detailed.
- How heavier events (injuries, deaths, falling out) are shown while keeping the tone light.
- Whether trait drift is visible enough to be worth its complexity.
