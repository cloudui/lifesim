# Life Connections Sim

A web page that simulates one person's life and shows how they connect with other people over time: who they meet, where, how likely each meeting was, and how friendships grow and fade. Inspired by a Veritasium video on six degrees of separation. The goal is something fun and shareable, not a full life-simulation game.

This file is the shared brief for any coding agent or person picking the project up. `CLAUDE.md` imports it. Keep it current when a decision changes.

## Status

Last updated 2026-11-12.

- **Done:** the simulation core, highlight detection, a console highlight reel, a tuning harness, determinism tests, a JSON export, and a browser page with three tabs: Walk (pixel art), Map (pixel art) and Circle (the original graph and charts).
- **Branch:** everything is on `main`: the pixel views, the depth and contact tie model, messaging, breakups and the person card.
- **Not started:** running the sim in the browser, the intake form, a phone layout, sound.
- **Next step:** give friendships sudden movement. Today closeness only changes by small weekly nudges and slow fading, so most friendships look flat on the person card (see "Next: conflict and busy periods" in the roadmap). Product direction is still being decided around what makes the site worth exploring; ideas are in `docs/product-ideas.md`. Speed is parked; the page reads lives simulated ahead of time.

## Run it

Node 18 or newer.

```
npm install
npm run life -- --seed 7              # one life, printed as a highlight reel
npm run life -- --seed 7 --ext 0.9 --hobbies run,games --top 40
npm run harness -- --n 16             # many lives in parallel, aggregate sanity numbers
npm run harness -- --n 8 --years 15 --set hlMin=30 --set invitePow=2   # try parameter changes without editing code
npm run export -- --seeds 1,3,5,7     # simulate lives and write public/lives/<seed>.json for the page
npm run dev                           # open the page (Vite); add ?seed=5&tab=walk&week=1100 to jump to a moment
                                      # ?play&advance=2.5 fast-forwards the animation, for screenshots
npm test
npm run typecheck
npm run build                         # static site in dist/
```

## Deploy

GitHub Pages, via `.github/workflows/deploy.yml`: every push to `main` typechecks, builds and publishes `dist/`. The repo's Pages source must be set to "GitHub Actions". `vite.config.ts` sets `base: './'`, so the same build works under `username.github.io/<repo>/` and at the root of a custom domain. The site shows only the lives committed in `public/lives/`; run `npm run export` and commit to add more.

`life` flags: `--seed`, `--years` (default 40), `--top` (how many highlights), and protagonist overrides `--ext`, `--novelty`, `--circle` (each 0 to 1) and `--hobbies` (ids from `src/sim/activities.ts`).

## Principles

- Focus on one thing: social connections. Resist turning it into a full simulation game.
- Small and modular. New activities, traits, life events and views should plug in without rewriting the core.
- Fun and light in tone, even when heavier events arrive later. Nothing crude.
- Highlight the surprising. Most of life is uneventful, so compress quiet stretches and surface the unlikely moments.

## Decisions so far

| Decision | Choice | Why |
|---|---|---|
| Language | TypeScript. The sim core has no DOM or Node dependencies. | Runs in Node for the console and unchanged in the browser later. |
| Backend | None. | Nothing needs one yet. |
| Hosting | GitHub Pages, static build deployed by GitHub Actions. | Free, and the page is static files plus precomputed lives. |
| Starting point | Adulthood, not birth. | Simpler. Agents already carry birth year, hometown, family and a `stage` field so childhood can be added as new stages. |
| Starting network | Family ties and childhood friends are seeded, then the normal rules run for a 5-year burn-in before the story starts. | The starting circle comes from the same rules as everything after it. |
| The protagonist | A camera, not a special agent. Every rule applies to all agents. | Makes reunions and "friends met without you" possible, and keeps multi-user open. |
| World size | About 2,000 people across New York, San Francisco and Chicago, with real neighbourhood names. Every venue and person is invented. | In a few hundred people you eventually meet everyone and nothing is surprising. |
| Time step | One week. Each week an agent samples venue visits from their routine. | Nothing in the planned views needs finer resolution. |
| Randomness | Keyed, not sequential: each draw is a hash of seed, purpose, week, agent and index. | A life replays exactly from its seed, and adding a rule does not shift the draws of existing rules. |
| Life events in V0 | Moving city, changing job, getting together with a partner and breaking up, for everyone. | A job change is a move that only reassigns the workplace. Partners were added because the strongest adult tie was missing. Children, school stages and death are later. |
| Compatibility | Every pair has a friendship index from 0 to 1: half personality similarity (four axes), the rest closeness in age and shared hobbies. | It sets how readily strangers talk, the first-impression bonus, and how close two people can ever get. It also gives the reel a reason for each friendship. |
| Age | Openness to new people and how often people go out decline from 25. Long-held ties fade more slowly. | Older adults see friends less often but stay close to them. |
| Ties | Two numbers per tie, depth and contact, instead of one strength. | Separates friends of convenience from lasting ones, lets older adults stay close while seeing people less, and gives calls a role. |
| Tuning | Do not fine-tune numbers until the structure is more complete. | Each structural change moves them again. Fix only what is clearly broken. |
| Traits | Extraversion, hobbies, social circle seed, novelty-seeking, plus four personality axes (humour, homebody or adventurous, listener or talker, spontaneous or planner). | Each drives one visible rule. Introversion is the low end of extraversion. |
| Interestingness | Improbability times consequence, not improbability alone. | Every specific meeting with a stranger is unlikely, so rarity alone is noise. |
| Probability shown | The model's own chance that the pair met in that particular week. | It is known at the moment the meeting is sampled, so nothing is estimated afterwards. It is approximate for open venues and introductions. |
| First views | Timeline, then social graph, then a schematic map (cities as clusters, venues as dots). | All three read the same event log. |

## Architecture

```
src/sim/rng.ts         keyed random draws, plus a sequential stream used only for world generation
src/sim/activities.ts  club activities as plain data (run club, game night, dance practice, ...)
src/sim/params.ts      every tunable number, with comments
src/sim/world.ts       cities, venues, families, starting ties
src/sim/people.ts      compatibility index, personality wording, reasons two people clicked
src/sim/sim.ts         the weekly loop, ties, event log, snapshots; runLife() is the entry point
src/sim/highlights.ts  event log -> scored, worded highlights
src/sim/stats.ts       summary numbers for one life
src/cli/life.ts        console highlight reel
src/cli/harness.ts     many lives in parallel, aggregate numbers
src/sim/export.ts      LifeResult -> LifeExport, the plain JSON the page reads
src/cli/export.ts      writes public/lives/<seed>.json and index.json
index.html, src/web/   the page (vanilla TypeScript, SVG and canvas):
  main.ts              shell, shared timeline and playhead, tabs, the Circle tab
  walk.ts              Walk tab: the pixel-art walk through life
  map.ts               Map tab: where everyone is
  pixel.ts             procedural sprites and glyphs; there are no image assets
  person.ts            the person card: you and one other person as two lines over time
  types.ts             the Scene interface the animated tabs implement
docs/product-ideas.md  what would make the site magnetic; saved for later
test/sim.test.ts       determinism and consistency tests
```

The data flow is one-way: `runLife(options)` returns a `LifeResult` holding the event log, the protagonist's contact rows, quarterly network snapshots and their ties. Highlights, stats and the export are pure functions of that result. The page reads only the exported JSON (`LifeExport`) and never touches the simulation.

### What happens each week

1. Life events: each agent may move city or change job. A partner moves with them.
2. Some agents travel to see family in another city for the week.
3. Everyone else follows their routine (a couple may also split here): work, the clubs they belong to, and looking for a club for a hobby they have no club for. Hobbies occasionally change, often copied from a friend. A single person aged 24 or over may get together with a close, compatible, single friend.
4. Plans with friends: an agent invites a few friends who are in town, favouring close ones and brand-new ones. Partners often come along, which is how people get to know each other's friends. Everyone in the group spends time together, and people who did not know each other may be introduced.
5. Going out alone to a usual or a new hangout.
6. Mixing at each venue: each person present tries to talk to a few others, more readily with people they already know.
7. Family time for relatives in the same city, and one call to a far-away friend or relative.
8. Messages: most people text a couple of the people they are closest to, wherever they live.

### Ties

- A tie has two numbers, each 0 to 1. **Contact** is how much two people have seen of each other lately. **Depth** is how much they matter to each other. Closeness is `depth + (1 - depth) * contact`, and everything that asks "how close are they" (circles, invitations, calls) reads closeness.
- Every interaction raises contact towards that context's ceiling. Work, clubs and chance meetings have low ceilings. Contact fades with a half-life of about six months.
- Only chosen time together (plans with friends) and family time build depth, slowly. The ceiling on depth rises with compatibility, so only well-matched pairs get deep. That, plus a weekly limit on outings, is the social budget.
- Depth fades over years. Its half-life grows with how deep the tie ever got and how long the two have known each other. Family depth barely fades.
- A friend of convenience has contact and little depth: they drop away within a year of the job or club ending. A deep friend stays close through years of silence.
- Seeing an old friend again restores part of the depth that had faded. A call does the same on a smaller scale, and cannot add depth that was never there.
- A message raises contact a little (low ceiling) and holds faded depth, less than a call does. It builds no depth. `msgRate=0` turns messaging off.
- A new tie gets a one-off "spark" of depth, larger for compatible pairs, so a few first meetings matter straight away.
- A partner is treated as family from the day they get together: slow decay and time together every week. They are also added to each other's `family` list. In-laws are not modelled.
- A couple may split. The yearly chance is highest for new and poorly matched couples and falls the longer they stay together. The two stop being family, keep a quarter of their depth and contact, and wait a year before looking for someone new. `breakupRate=0` turns breakups off.
- Circles are thresholds on closeness: acquaintance, friend, close friend, inner circle (`levels` in `params.ts`).
- Ties between other people are forgotten once negligible. The protagonist's ties are kept forever so reunions can be detected.

### Highlight types

Getting together with a partner, breaking up, unlikely origin of a close friend, small world (a new friend already knows someone from another part of your life), near miss (crossed paths many times before speaking), reunion after years, two close friends meeting without you, friends you introduced, drifting apart, growing close again, a friend moving away or into your city, picking up a hobby. Moves, job changes, getting together and breaking up are always shown as the scaffold of the timeline. New people are introduced with their age and most pronounced trait, and close friendships say what the two clicked over.

### How to extend

- **New club activity:** add an entry to `CLUBS` in `activities.ts`. Hobby sets are stored as a 32-bit mask, so the limit is 31 activities.
- **New tunable:** add it to `params.ts`; the harness can then override it with `--set`.
- **New random draw:** add a new purpose to the `R` table in `sim.ts`. Append only, never renumber, or existing lives change.
- **New life event:** add a rule to `lifeEvents` in `sim.ts`, a variant to `SimEvent`, and wording in `highlights.ts`.
- **New view:** read `LifeExport` only. If a view needs more data, add it in `export.ts`.

### The page

The timeline at the top is shared: a coloured band for where the protagonist lived, highlights as dots sized by score, life events as diamonds. Drag to scrub, space plays, and there is a speed control. Below it are three tabs.

- **Walk** (pixel art): the protagonist walks in place while the city scrolls past. The skyline is the city they live in (a spire for New York, a red bridge for San Francisco, a twin-antenna tower for Chicago), and the sky moves from dawn to dusk across the whole life. Their inner circle walks behind them and their partner beside them. At each highlight time holds still: the person walks up outside the venue (bar, café, park, office or club hall) and they wave. Getting together brings hearts and confetti and both outfits melt into a suit or gown for a year. A move sweeps the new skyline in with a plane overhead. Hair greys with age. A caption under the scene gives the highlight text.
- **Map** (pixel art): the three cities as islands. Everyone in the world is a faint dot; people the protagonist knows are coloured by closeness; dotted lines run to the inner circle wherever they live; dots fly between islands when someone moves. Hover for details.
- **Circle**: the protagonist in the centre, everyone they know placed by closeness and clockwise in the order they met, with the circle-size chart, a "now" panel and the moments list.

Clicking a person in the Map or Circle tab opens a card (`person.ts`) with the two of you drawn as two lines over time: close together when you are close, drifting apart when you are not. A dotted pair shows where you would be on depth alone, without regular contact. Dots along the top are the moments you shared; drag the chart to scrub. `?person=<id>` or `?person=closest` opens it from the address bar.

Notes for anyone changing it:

- All pixel art is drawn in code from a person's id (`pixel.ts`), so there are no assets to license. Scenes draw to a small canvas that CSS scales up with `image-rendering: pixelated`; text is HTML in the VT323 font so it stays crisp.
- An animated tab implements `Scene` (`types.ts`). It reads the shared playhead through `Ctx` and returns `timeScale() === 0` to hold time still while a moment plays.
- The pixel views are a game screen and stay dark in both themes. The Circle tab follows the system theme and uses the dataviz palette: three city hues, neutral greys for the ordered circle tiers.
- The project owner does not want the main experience to look like a dashboard. Circle is kept as an inspection view.

## Calibration

`npm run harness` prints circle sizes against rough human targets of 5 / 15 / 50 / 150 (inner circle, close, friend, acquaintance, cumulative), plus lifetime totals and highlight counts. It only needs to be roughly human, not exact.

Latest run, 2026-11-11: 8 lives of 40 years, seeds 1 to 8, default parameters, after ties were split into depth and contact. The previous run (12 lives, single-strength ties) is in the right-hand column.

| Measure | Result | Before the split |
|---|---|---|
| Circle sizes, everyone in the world at the end (mean) | 3.4 / 14.7 / 38.7 / 68 | 1.9 / 15.2 / 52.4 / 90 |
| Protagonist's circle averaged over their life (mean) | 2.3 / 11.4 / 32.2 / 70 | 2.0 / 14.2 / 50.9 / 104 |
| New people met in 40 years | 244 on average; 100 became friends, 22 close, 2 inner circle | 304; 133, 29, 3 |
| Moves / job changes | 1.9 / 2.9 per life | 1.8 / 3.1 |
| Trips to see family | 77 per life | 92 |
| Protagonists who got together with a partner during the story | 50% (4 of 8), median age 32 | 75%, median age 26 |
| Younger generation with a partner at the end | 89% | 89% |
| Friends still friends two years after a move | 70% | 76% |
| Median length of a friendship that ended | 1.4 years | 3.3 years |
| Friends of convenience (friends with little depth) | 16% of friends | not measured |
| Deep friends (close on depth alone, no recent contact needed) | 8.8 on average | not measured |

### Messaging and breakups, switched on and off

2026-11-11: 12 lives of 40 years, seeds 1 to 12, on `messaging-breakups`. Each column is the same 12 lives with the named rules on. (These runs counted reunions differently; that change was undone, and with both rules on there are about 10 reunions per life.)

| Measure | Neither | Messaging | Breakups | Both |
|---|---|---|---|---|
| Circle sizes, whole world at the end | 3.3 / 14.7 / 38.7 / 68 | 3.6 / 15.8 / 41.1 / 70 | 3.2 / 14.3 / 38.0 / 67 | 3.5 / 15.5 / 40.4 / 69 |
| Protagonist's circle over their life | 2.7 / 13.3 / 38.8 / 84 | 3.2 / 15.0 / 42.4 / 90 | 3.2 / 13.8 / 40.6 / 88 | 3.1 / 14.9 / 42.6 / 90 |
| New people met | 279 | 300 | 295 | 297 |
| Friends still friends two years after a move | 71% | 75% | 69% | 75% |
| Deep friends (close on depth alone) | 10.1 | 11.2 | 10.2 | 11.1 |
| Friends of convenience | 15% | 16% | 15% | 14% |
| "Drifted apart" highlights per life | 12.1 | 9.2 | 10.1 | 9.8 |
| Protagonist partnered during the story | 67% | 83% | 100% | 92% |
| Younger generation with a partner at the end | 90% | 90% | 80% | 80% |
| Couples formed during the story that split | 0 | 0 | 52% | 52% |
| Breakups per protagonist | 0 | 0 | 0.3 | 0.4 |

What this shows: messaging is a small, steady effect. Circles grow by 5 to 10%, a few more friendships survive a move and fewer drift apart. Breakups barely touch friendship numbers; they move partner numbers only. Half of couples formed during the story splitting is high and untuned.

Known to be off and deliberately not tuned yet: the outer circles are too small (about 70 acquaintances, target 150), friendships flap in and out of the friend level (median length 1.4 years), too many friendships still survive a move, only about 15% of friends are friends of convenience, about 300 people met in 40 years is low, and half of new couples split.

## Known limitations

- **Speed:** a 40-year life takes roughly 35 to 55 seconds on a laptop. The cost is memory-bound: tie objects and per-person maps are scattered, so the hot loops miss the cache. The identified fix is to store ties in flat typed arrays; it has not been done. For the browser, run the sim in a web worker and stream events so the timeline can play as it simulates.
- **No death or life stages:** age only lowers sociability, and people stop going to work at 67 (added after the calibration run above, so those numbers predate it). Parents never die, so a "life" is 40 years of adulthood.
- **Partners are simple:** no children, no in-laws, a breakup changes nothing about mutual friends or where anyone lives, and partners are always chosen from existing close friends in the same city.
- **Small cities:** 500 to 800 people stand in for each real city, so friends of friends overlap heavily and near-miss and small-world criteria are deliberately strict.
- **Probabilities are approximate** for chance meetings at open venues and for introductions.
- **Model was built from general knowledge** of the literature (shared-venue meeting, triadic closure, homophily, tie decay, preferential return to familiar places). No literature pass has been done to pin parameter values, and the Quarew1107/Life-simulation repo has not been read.

## Roadmap

### Next: conflict and busy periods

Measured on 2026-11-12 across the five exported lives (about 1,050 friendships of two years or more, closeness on a 0 to 100 scale): nearly half move less than 15 points in total, only 14% move 30 or more, and the typical change from one quarter to the next is 1.5 points. People do change circle (about 31 become close friends per life and 36% of those later fall to acquaintance or below), but the fall is a slide over years and only 7 of 55 came back. Nothing in the model is sudden.

1. **Conflict.** Two people can fall out. The chance should depend on both personalities and on the relationship: how close they are, how long they have known each other, how much time they spend together. A fight opens a rift, a sharp drop in depth and a stop to plans together, that may be mended later or may not. Needs: a rule in the weekly loop, a `SimEvent` and highlight wording for the fight and for making up, a light tone, and an off switch so its effect can be measured the way messaging and breakups were.
2. **Busy periods.** A new job, a new partner or a move cuts someone's time for friends for a year or two, so contact drops across the board and then recovers.
3. After both: look at the person card again. If friendships still read as flat, rescale the chart so each circle takes equal height on one shared scale.

### After that

1. Review console lives and adjust tone, highlight wording and thresholds.
2. Review the Walk and Map views in a real browser: pacing, charm, what is missing.
3. Decide the product shape from `docs/product-ideas.md` (the leading idea: short setup, a one-minute pixel life, an end card to share).
4. Decide how the interactive experience pays for simulation time (precomputed lives, a web worker that streams, a faster core, or a mix), then do the performance work.
5. Timeline refinements: compress quiet periods.
6. Short literature pass to tune decay rates, contact frequencies and circle sizes.

Later, in no fixed order: intake form to set traits and rerun or compare lives; braided-lines view of you and a few best friends; illustrated life view; stats such as the share of time with your parents that remains after you leave home; life stages from birth (school, college), deaths, breakups and children; extra traits such as money and travel. Far future and out of scope: real users linked inside each other's simulations. Do not design it out.

## Explicitly out of scope for V0

Polished art and animation, the intake form, extra traits such as money, life events beyond moving, job changes and partnering, and a backend. This can change if we are realizing it's mature enough, not a strict requirement.

## Note
You as the AI own the codebase. Feel free to make sweeping changes and code modifications to fit the necessary problems at hand. Don't have allegiance to the code already written in this repository. 
