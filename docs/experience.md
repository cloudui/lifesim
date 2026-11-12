# The experience we are aiming for

A working draft, started 2026-11-12 and revised the same day after a first prototype. This is current thinking, not a spec. Every part of it is meant to be tried, looked at and changed. When something here turns out wrong in practice, change this file rather than bending the build to fit it. Sections marked **Open** are undecided on purpose. Nothing here is in priority order unless it says so.

`docs/product-ideas.md` is the wider list of ideas. This file is narrower: what the core experience should feel like, and which parts of the simulation serve that feeling.

## The feeling

People should look, keep digging, and come away appreciating their life and what the people in it mean to them. The draw is watching people shift in and out of a life, and seeing how much of that turned on chance.

One image that started this: deciding on a whim to spend a weekend somewhere and running into someone you have not seen in ten years. That is an inspiration, not a target. The simulation should not be bent to produce it.

Realism matters where it makes a life believable and gives the story more to tell. It is not the goal on its own.

## Two ways in

1. **A life as it could be.** Given who you are and who you happen to meet, here is one life. You watch it, then dig into it.
2. **Picking at it.** Choose a moment, make it never happen, and see how the life comes out differently.

Current thinking: the first leads, because undoing a meeting only lands when you care about what would be lost. The second sits on top of it.

## The core: people, not events

The timeline as first built is a list of meetings ("Met X at Y"), and reads as repetitive. A relationship gets its meaning from its middle and its ending, and those were hardly told.

So the unit of the story is the person. A life has a small cast, about ten people, and each one gets an arc:

- **How you met**, and the odds.
- **What you were to each other:** the years you were close, how much you saw of each other, who and what they brought into your life.
- **What changed:** a move, drifting, finding each other again.
- **How it stands at the end:** still close, or the last time you saw them.

Everyone else is background: "you met 223 other people along the way".

The cast should hold:

- **Family**, alongside friends. Parents and siblings are among the longest arcs in any life.
- **Partners**, past and present.
- **Variety.** Not ten coworkers. Someone from growing up, someone met by chance, a slow burn, a late arrival, someone who was close for a season and is gone. A cast that is all "there the whole way" is as dull as a list of meetings.

**Who led to whom** matters as much as who was close. "Maren brought you to the pottery studio, where you met Dmitri, who became your partner. Thirteen of your friends trace back to Maren." These chains are what make one meeting feel large, and they point at the moments worth undoing.

## The full simulation stays

Nothing is being thrown away. The simulated world is the engine: every arc is read off what actually happened in it, and nothing is scripted. It is also the second layer of the experience. After the core story, people can dig into the rest: the map of where everyone is, the circle, the journal, the hundreds of people who passed through, the friendships between other people.

A principle to hold on to: **never rig, only curate.** The odds only mean something if they are honest. The story comes from choosing what to show and how to tell it, never from forcing an outcome.

## What the first prototype showed (2026-11-12)

Two console commands, built as experiments on the existing simulation with no new rules:

- `npm run people -- --seed 7` retells a life as a cast of about ten people (`src/sim/arcs.ts`).
- `npm run whatif -- --seed 7` leaves out the meetings that mattered most, one at a time, and runs the same life again.

What we learned:

- **It reads better.** Ten people with a beginning, a middle and an ending are easier to care about than 95 moments. The chains of who led to whom are the most interesting new thing.
- **The simulation rarely gives an ending.** In seed 7, of the 39 people who were ever close friends, almost all who became close stayed close for the full 40 years. There is very little falling away, falling out, or loss. The retelling can only tell the endings that exist. This is the strongest argument yet for the realism work below.
- **Lives are too settled at the start.** Much of each cast is already close "from the first page", so their beginnings are never seen.
- **Family arcs are thin.** Parents live to 105 and nothing happens to them. The good material is in the counts ("153 of those visits were in the first ten years and 43 in the last ten").
- **"What if" works and is dramatic.** Undo one 1-in-47,000 meeting in seed 7 and the protagonist ends up with a different partner in a different city, and never meets 157 of the people from the original life.
- **"What if" is also chaotic.** Delaying a meeting by a single week can change who you are close to decades later. One rerun shows *a* different life; it does not prove the meeting *caused* the difference. Saying "because of Axel" honestly would need many reruns. **Open:** whether to show one alternative life as a story, or many as odds.

## What the story needs from the simulation

These are the realism gaps that most limit the story. Not ranked; each is judged by one rule of thumb: **what does it give the story to tell?** Override the rule when something is worth trying anyway.

- **Endings and sudden turns.** Falling out, making up, drifting after a move that actually ends things, busy years when contact drops. (Conflict and busy periods are already written up in the roadmap in `AGENTS.md`.)
- **Ageing and loss.** Parents grow old and die; so, later, do friends. Decide the tone first.
- **Travel and going home.** Weekend trips and holidays back home put people from different parts of a life into the same place. Today the only travel is visiting family in another of the three cities.
- **Roots.** Family elsewhere that pulls you back: parents from China, grandparents in Texas. A short list of places, each with a pull.
- **Background.** Career, school and money shape what happens in a life. Perhaps six to eight archetypes so it stays manageable. College is one path among several, not a stage for everyone.
- **Influence.** A partner pulls you into their world: their friends, their clubs, what they want to do. Friends get you to try things. Today partners only come along to plans, and a changed hobby is often copied from a friend.
- **Drift in who you are.** Traits shift with age and with what happens to you (a bike accident makes you warier of riding). Hobbies phase in and out and give a life its eras. To stay readable, each shift should show up in the story and shifts should be few.
- **A start that is less settled.** Beginning at 18, or with fewer ready-made close friends, so more beginnings happen on screen.

## Whose life

Eventually the person sets a handful of knobs so the life resembles their own, or someone else's they would like to see. A first guess at the knobs: where you grew up, family roots elsewhere, path or archetype, how outgoing, how adventurous (travel included), a few hobbies.

Start at 18 for now. Childhood can come later as a short prologue, for instance to appeal to younger people.

**Open:** which knobs change a life enough to be worth asking.

## Where the world needs detail

An idea to try, not a decision. Full person-by-person simulation where the camera is (the protagonist's cities and the few hundred people around them), and likelihoods elsewhere (destinations, distant people, the background crowd). That would make extra destinations affordable. Several destinations, not many; reconsider the number later.

Worth keeping either way: everyone near the protagonist follows the same rules as the protagonist, so friends meeting without you still happens naturally.

## Open questions

- How the cast is shown on the page. A first version is the People tab: cast cards with their stories, then a catalog of everyone. Still open: bringing the cast into the Walk, and turning the timeline scrubber into a lane per cast member so scrubbing shows who was in your life when.
- What one minute of a life looks like, beat by beat. Writing a storyboard by hand would test this cheaply.
- One alternative life or many, for "what if".
- How loss and falling out are shown while keeping the tone light.
- What the last screen leaves people with: who was there throughout, who was lost, who came back.
- How many destinations, and how detailed.
- Whether trait drift is visible enough to be worth its complexity.
