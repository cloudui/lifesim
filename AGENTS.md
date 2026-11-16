# Life Connections Sim

A web page that simulates one person's life and shows how they connect with other people over time: who they meet, where, how likely each meeting was, and how friendships grow and fade. Inspired by a Veritasium video on six degrees of separation. The goal is something fun and shareable, not a full life-simulation game.

This file is the shared brief for any coding agent or person picking the project up. `CLAUDE.md` imports it. Keep it current when a decision changes.

## Status

Last updated 2026-11-16 (a film about the owner and real friends, built from the draft: nineteen scenes with a hand-written cast).

- **Direction (agreed 2026-11-12):** story first, playground second. A short opening story makes you care about a few people; the tabs are for exploring the whole life afterwards. See "The opening story" below.
- **Done:** the simulation core with endings (falling out, fading when out of sight, death), highlight detection, a retelling by people, a story editor that cuts a life to about 16 beats about one person, a library of invented details for its captions, a what-if rerun (console only), a console highlight reel, a tuning harness, determinism tests, a JSON export, and a full-screen browser game: an opening story, then five tabs: Walk (pixel art), Map (pixel art), Circle, People and Journal.
- **Branch:** the story editor, the opening story and the film are committed on `story-editor`, not pushed or merged. Everything before that is on `main`. `codex/priya-walk` is a separate Codex experiment (walking through a life with one person); it has not been reviewed or merged.
- **Not started:** running the sim in the browser, the intake form, a phone layout, music.
- **Blue Shoes (built, draft):** a film about the owner and real friends, to test whether real material is what the simulated films lack. The script the owner approved is `drafts/jason-film.md`; it is built as nineteen scene files and a cast file in `src/web/scenes/blue-shoes/`. Open it from the title screen or with `?film=blue-shoes`. It is committed at the owner's request, as a demo among friends, and is to be removed later (the folder and the draft). Do not push it to `main`: that would publish it.
- **Next step:** the owner watches Blue Shoes (`npm run dev`, then `?film=blue-shoes&review`), listens to the sound, and says what to fix in the words, the looks and the sets. The seed 7 film is still waiting for the same review (`?seed=7&scene&review`): edit the words in `src/web/scenes/*.scene` and add `FLAG` lines for what to fix. Then: act on the flags, refine the art (some props and poses look wrong; nobody gestures), sound, and what comes after "without them" (the data side: the same life with and without the person, then changing the starting conditions). Films for other lives come after this one is right. The caption story (`?story`) stays as it is meanwhile. Engine work is paused except where a scene needs a cause. Speed and phone layout stay parked.

## Run it

Node 18 or newer.

```
npm install
npm run life -- --seed 7              # one life, printed as a highlight reel
npm run life -- --seed 7 --ext 0.9 --hobbies run,games --top 40
npm run story -- --seed 7             # the life cut to a short story about one person: about 16 beats
npm run story -- --seeds 1-20 --cut   # many lives in parallel; --cut also lists the beats left out; --name Sam renames the person it is about
npm run people -- --seed 7            # the same life retold as the ten or so people who mattered
npm run whatif -- --seed 7 --n 2      # leave out the meetings that mattered most and run the life again (one extra run each)
npm run harness -- --n 16             # many lives in parallel, aggregate sanity numbers
npm run harness -- --n 8 --years 15 --set hlMin=30 --set invitePow=2   # try parameter changes without editing code
npm run export -- --seeds 1,3,5,7     # simulate lives and write public/lives/<seed>.json for the page
npm run dev                           # open the page (Vite); add ?seed=5&tab=walk&week=1100 to jump to a moment
                                      # ?play&advance=2.5 fast-forwards the animation, for screenshots
                                      # ?seed=7&scene plays the film written for seed 7; ?scene=3 starts at scene 3; &review shows file and line
                                      # ?film=blue-shoes plays the film written from scratch; &scene=3 and &review work the same way
                                      # ?seed=7&without opens the Circle with the story's one person and everyone they led to taken out
                                      # ?story&beat=4 opens the story at a beat; &name=Sam renames the person it is about
npm test
npm run typecheck
npm run build                         # static site in dist/
```

## Deploy

GitHub Pages, via `.github/workflows/deploy.yml`: every push to `main` typechecks, builds and publishes `dist/`. The repo's Pages source must be set to "GitHub Actions". `vite.config.ts` sets `base: './'`, so the same build works under `username.github.io/<repo>/` and at the root of a custom domain. The site shows only the lives committed in `public/lives/`; run `npm run export` and commit to add more.

`life` flags: `--seed`, `--years` (default 40), `--start-age` (default 18; also on `people`, `whatif` and `export`), `--top` (how many highlights), and protagonist overrides `--ext`, `--novelty`, `--circle` (each 0 to 1) and `--hobbies` (ids from `src/sim/activities.ts`).

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
| Starting point | The protagonist is 18 or 19, living where they grew up. Not birth. | At 18 the only people already in a life are family and the friends you grew up with, so every adult friendship begins on screen. `startAge` of 22 or more gives the older, already-settled start used before 2026-11-12. Childhood itself is still not simulated. |
| Starting network | Family ties and childhood friends are seeded, then the normal rules run for a 5-year burn-in before the story starts. | The starting circle comes from the same rules as everything after it. |
| The protagonist | A camera, not a special agent. Every rule applies to all agents. | Makes reunions and "friends met without you" possible, and keeps multi-user open. |
| World size | About 2,000 people across New York, San Francisco and Chicago, with real neighbourhood names. Every venue and person is invented. | In a few hundred people you eventually meet everyone and nothing is surprising. |
| Time step | One week. Each week an agent samples venue visits from their routine. | Nothing in the planned views needs finer resolution. |
| Randomness | Keyed, not sequential: each draw is a hash of seed, purpose, week, agent and index. | A life replays exactly from its seed, and adding a rule does not shift the draws of existing rules. |
| Life events in V0 | Moving city, changing job, getting together with a partner and breaking up, falling out and making up, being there after a loss, and dying, for everyone except that the protagonist does not die. | A job change is a move that only reassigns the workplace. Partners were added because the strongest adult tie was missing. Falling out and death were added because friendships had no endings. Children and school stages are later. |
| Compatibility | Every pair has a friendship index from 0 to 1: half personality similarity (four axes), the rest closeness in age and shared hobbies. | It sets how readily strangers talk, the first-impression bonus, and how close two people can ever get. It also gives the reel a reason for each friendship. |
| Age | Openness to new people and how often people go out decline from 25. Long-held ties fade more slowly. | Older adults see friends less often but stay close to them. |
| Ties | Two numbers per tie, depth and contact, instead of one strength. | Separates friends of convenience from lasting ones, lets older adults stay close while seeing people less, and gives calls a role. |
| Tuning | Do not fine-tune numbers until the structure is more complete. | Each structural change moves them again. Fix only what is clearly broken. |
| Traits | Extraversion, hobbies, social circle seed, novelty-seeking, plus four personality axes (humour, homebody or adventurous, listener or talker, spontaneous or planner). | Each drives one visible rule. Introversion is the low end of extraversion. |
| Interestingness | Improbability times consequence, not improbability alone. | Every specific meeting with a stranger is unlikely, so rarity alone is noise. |
| Probability shown | The model's own chance that the pair met in that particular week. | It is known at the moment the meeting is sampled, so nothing is estimated afterwards. It is approximate for open venues and introductions. |
| First views | Timeline, then social graph, then a schematic map (cities as clusters, venues as dots). | All three read the same event log. |
| Shape of the experience | Story first, playground second: a short opening story about one person, then the tabs. | The owner did not want to keep watching the timeline. Beats with strangers are not earned, and exploring only works once you care. |
| What goes in the story | Turning points, texture and facts, each scored within its own kind. | Rarity alone misses what makes it feel like a life: the same table, changing. |
| Who the story is about | One person, picked for drama (turns between the two of you), not for closeness alone. | Three leads in 15 beats left three beats each and nothing was earned. A close, uneventful friendship is not a hook. |
| Invented detail | The event is real and from the log; the specifics in a caption come from a detail library. | The simulation does not know what two people did together, and captions made of counts gave no reason to care. |
| Scope rule | A variable earns its place if it changes what is on screen or in a caption. | Keeps the simulation from growing detail nobody sees. |
| Speed | Parked until there is a full product. The page reads lives simulated ahead of time. | Owner's call, 2026-11-12. |

## Architecture

```
src/sim/rng.ts         keyed random draws, plus a sequential stream used only for world generation
src/sim/activities.ts  club activities as plain data (run club, game night, dance practice, ...)
src/sim/params.ts      every tunable number, with comments
src/sim/world.ts       cities, venues, families, starting ties
src/sim/people.ts      compatibility index, personality wording, reasons two people clicked
src/sim/sim.ts         the weekly loop, ties, event log, snapshots; runLife() is the entry point
src/sim/highlights.ts  event log -> scored, worded highlights
src/sim/arcs.ts        event log -> a cast of people, each with a beginning, middle and ending, and who led to whom (experiment)
src/sim/story.ts       event log -> the opening story: one person and about 16 beats (turning points, texture, facts)
src/sim/details.ts     invented specifics for the story's captions, chosen from hobbies and context, keyed by seed and person
src/sim/stats.ts       summary numbers for one life
src/cli/life.ts        console highlight reel
src/cli/story.ts       console story, one or many lives
src/cli/people.ts      console retelling by people
src/cli/whatif.ts      console what-if: the same life with one meeting left out
src/cli/harness.ts     many lives in parallel, aggregate numbers
src/sim/export.ts      LifeResult -> LifeExport, the plain JSON the page reads
src/cli/export.ts      writes public/lives/<seed>.json and index.json
index.html, src/web/   the page (vanilla TypeScript, SVG and canvas):
  main.ts              game shell: playhead, HUD, dialogue box, timeline scrubber, tabs, title and end screens
  story.ts             the opening story: one pixel scene and a caption per beat
  film.ts              the film player: people in one place, dialogue and silence, no narration; for a simulated life or a hand-written cast
  sets.ts              the places a scene can happen in, drawn in code: a back layer, sometimes a front layer, and where people sit and stand
  sound.ts             the film's sound, synthesized: ambience per set and a blip per speaker
  scenes.ts            reads the scene scripts and cast files; offers the scenes written for the life on screen, and the films written from scratch
  scenes/*.scene       one plain script file per scene, written by hand for one simulated life; format in scenes/README.md
  scenes/blue-shoes/   a film written from scratch: a cast file and nineteen scenes about real people (to be removed later)
  backdrop.ts          sky, skylines and venue fronts, shared by the story and the Walk
  walk.ts              Walk tab: the pixel-art walk through life
  map.ts               Map tab: where everyone is
  circle.ts            Circle tab: everyone you know by closeness
  people.ts            People tab: the cast and their stories, how they reached you, and a catalog of everyone
  closeness.ts         one person's closeness across the life as runs of the same circle, for strips and lanes
  journal.ts           Journal tab: summary, circle chart and moments
  pixel.ts             procedural sprites and glyphs; there are no image assets
  person.ts            the person card: you and one other person as two lines over time
  types.ts             the Scene interface the animated tabs implement
docs/experience.md     the core experience we are aiming for; a working draft, open to change
docs/open-questions.md big questions waiting for the project owner, with what was done in the meantime
docs/product-ideas.md  what would make the site magnetic; saved for later
docs/history.md        what was added, when and why, newest first; add an entry for each change in behaviour
test/sim.test.ts       determinism and consistency tests
```

The data flow is one-way: `runLife(options)` returns a `LifeResult` holding the event log, the protagonist's contact rows, quarterly network snapshots and their ties. Highlights, stats and the export are pure functions of that result. The page reads only the exported JSON (`LifeExport`) and never touches the simulation.

### What happens each week

1. Life events: each agent may die, move city or change job. A partner moves with them.
2. Some agents travel to see family in another city for the week. People close to someone who has just lost a relative or a partner, or split up, come round, and a few travel to.
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
- Two friends may fall out. It can happen whenever two friends who matter to each other spend chosen time together, more readily for a poor fit and a young friendship. They lose most of their depth and contact and stop seeing each other: any time their paths would cross, they either make up or keep their distance. Making up restores 70% of the depth they had. Family and partners do not fall out. `fightRate=0` turns it off.
- Out of sight: once two people who are not family have gone two years without being in the same room, depth fades up to four times faster (never faster than a brand-new tie, so this only removes the staying power of deep, long-held ties), and calls and messages hold a quarter as much. Seeing each other again resets it. `apartFade=1` turns it off.
- When someone dies they leave every list and every other person's ties. The protagonist keeps the tie as a memory, with the week of death on it, and it no longer counts in any circle. Death follows a mortality curve (about 1% a year at 60, 7% at 80, 16% at 90). The protagonist is exempt. `deathRate=0` turns it off.
- Nobody dies or falls out during the five warm-up years before the story.
- Being there: for 8 weeks after someone loses a relative or a partner, or a couple splits, each close friend in the same city comes round with chance 0.35 a week (at most two a week), and a deep friend in another city may travel once. It counts as chosen time together and builds depth three times as fast. `supportRate=0` turns it off.
- Busy periods: for a year after a move, a new job or a new partner, a person makes, accepts and goes out on plans 70% as often. `busyFactor=1` turns it off.
- Under 18 (which only happens in the warm-up years) people do not work, change jobs or move on their own. They still have family, friends and clubs.
- Circles are thresholds on closeness: acquaintance, friend, close friend, inner circle (`levels` in `params.ts`).
- Ties between other people are forgotten once negligible. The protagonist's ties are kept forever so reunions can be detected.

### Highlight types

Getting together with a partner, breaking up, falling out, making up, the death of family, a partner or a friend, unlikely origin of a close friend, small world (a new friend already knows someone from another part of your life), near miss (crossed paths many times before speaking), reunion after years, two close friends meeting without you, friends you introduced, drifting apart, growing close again, a friend moving away or into your city, picking up a hobby. Moves, job changes, getting together, breaking up and deaths in the family are always shown as the scaffold of the timeline. New people are introduced with their age and most pronounced trait, and close friendships say what the two clicked over.

### The opening story

`tellStory(life)` in `story.ts` is a pure function of the `LifeResult` and is exported as `LifeExport.story`. It is an editor: it proposes candidate beats, scores them, and cuts to a budget (16 by default).

- **One person.** The story is about whoever has the most happen between the two of you: a falling-out and a mend, a silence of three years or more that ended, being there in the weeks after a death or a breakup, years as a friend before becoming your partner, the people who reached you through them. Closeness over the years gets someone considered; drama picks them. `leads[0]` is that person (`main`). A partner who is someone else is listed after them and gets one line when you get together.
- **Earned before it turns.** The one person gets small moments before the turning points: a flashback to the meeting if it was before 18, a few moments from growing up or from the first two years, a long talk (placed where their depth rose fastest), the weeks they were there after a death or a breakup, a trip to see each other, a standing night out.
- **Invented detail.** `details.ts` supplies the specifics in those moments, chosen from both people's hobbies and how they know each other, keyed by seed and person. The event is always from the log. One object leaves with them when one of you moves and can come back at a reunion. To add a detail, append a line to a list there; `{N}` is the person's first name and lines avoid "he" and "she".
- **Three kinds of beat.** Turning points (a move, getting together, falling out, a death). Texture (the family table, a standing night out, the small moments). Facts, which are about the one person (the long silence; "Without them") or the family (half the time with your parents).
- **Importance is compared within a kind, not across.** Each kind has a ceiling (`CAP` in `story.ts`). With a single score the table and house moves took every place.
- **The family thread.** The table opens the story, closes it, and returns in up to two Decembers when it changed: a partner's first time, a sibling bringing someone, an empty chair, a year nobody made it home. Who is there is inferred: family in the same city, or seen in person that December. Only the one person, a partner and the family are named in captions, except that "Without them" names the two people who mattered most among those they led to.
- **Flashbacks.** A beat can be sorted at one week and dated at another (`at`), which is how a meeting at 14 follows the opening table at 18.
- **Each beat names a scene template** (`table`, `meet`, `early`, `ritual`, `talk`, `showup`, `gap`, `visit`, `without`, `move`, `together`, `breakup`, `fallout`, `makeup`, `reunion`, `last`, `goodbye`, `nudge`, `fact`, `end`) and who is on stage. A variable earns its place in the simulation if it changes a scene or a caption.
- **To add a beat:** add a candidate in `story.ts` with a weight, a group and a `tell()` that writes the caption; give it a scene the page can draw, or add a template to `src/web/story.ts`.
- **Being there** is told from `support` events, in both directions: they came to you, or you went to them. A beat says when someone got on a plane.
- **What it cannot show yet:** hard stretches are only deaths and breakups; fallings-out rarely involve the one person and have no reason; childhood is not simulated, so early moments are invented.

### The film (draft)

The owner's verdict on the opening story: better, but narration will not make anyone care. A caption says what happened; it has to be shown, in dialogue, with room to breathe. The pier scene tested that form on 2026-11-13 and the owner said it works. Seed 7 now has five scenes about Axel and Kofi: the steps (2018, aged 11 and 14), the boxes (2030, the morning he leaves), the sofa (2038, after nine years apart), the pier (2050, after his father's funeral) and the pier again (2065).

- **No narration.** A place and a year, then only lines of dialogue with the speaker's face, and silences. Pauses are steps in the script, and the scene keeps moving while nothing is said. Between scenes one card says how many years passed and how often the two saw each other in them, counted from the life. The last scene ends on the numbers.
- **Written by hand per life.** Each scene is a plain script file in `src/web/scenes/` (format in `scenes/README.md`): a header (seed, the other person, set, week, who starts where, props, status, notes) and then lines such as `KOFI: ...`, `YOU: ... [2]`, `PAUSE 5`, `ENTER`, `SIT`, `DRINK you`, `VOICE Dad: ...`. The simulation supplies the facts; the words are authored, not generated. A scene is only offered while its seed and person still match, because any new simulation rule changes every life.
- **Review.** `?seed=7&scene&review` (or a scene's button on the title screen) shows the file and line being played, the scene's notes and any `FLAG` on the line; `[` and `]` move between scenes and the arrows between lines. A `FLAG some note` line in a script marks the next line for attention, and the title screen shows which scenes are flagged. `status:` is `draft` or `reviewed`.
- **Faces.** The face in the dialogue box has a mouth and blinks. A line can set it: `KOFI (smile): ...`, with `smile`, `sad`, `open` or `shut`.
- **Without them.** The film's `END` line is preceded by a short sequence: how many people were ever your friend, then the one person and everyone who reached you through them as portraits with how often you saw each, then "Take Kofi away" and they fade one at a time. Nothing is rerun; it is this life with those people removed. The list is the `without` beat of the caption story.
- **The comparison.** "See the life without them" at the end of the film (or `?seed=7&without`) opens the Circle with those people taken out: they are drawn as dashed outlines with their names, their ties are not drawn, and a bar under the tabs gives each circle's size with and without them at the playhead ("close 16 → 15"), how many people are gone and how many times you saw one of them. "Put them back" ends it. The playhead starts at the quarter when most of them were friends. `Ctx.without()` gives any view the set of people taken out; only the Circle uses it so far.
- **Sound** (`sound.ts`) is made in the browser, with no audio files: a bed of filtered noise per set (water at the pier, a room, a street) and a soft blip as each letter is typed, pitched differently for each speaker. It starts after the first click or key press, `M` or the button mutes it, and the choice is remembered. There is no music yet. It was written without being listened to, so levels and character need the owner's ear.
- **Sets** are drawn in code in `sets.ts`: `pier`, `steps`, `sofa`, `car`, `camp`, `hall`, `checkout`, `campus`, `street`, `hill`, `courts`, `bar` and `cafe`, most with a variant (night, dusk, rain) and props. A set has a back layer, sometimes a front layer over the people (a bonnet, a desk, a table, rain), and says where people sit and stand. Children are the same sprites drawn smaller; hair greys with age. To add a set, write its drawing function and add it to `SETS`.
- **Any number of people.** A scene places each person by pixels from the middle of the set. They can walk in and out (from either side or a door), walk to a place, sit and stand, and carry on walking while the script moves on (`&`). They turn to face whoever is speaking. A small sign can appear over a head (`EMOTE`: z, dots, bang, ring, heart), which is the only gesture so far. A `CARD` closes a scene with a line over the picture as it goes dark.
- **A film written from scratch** (`scenes/<name>/`) has a `cast` file in place of a simulated life: each person's name, birth year, voice pitch and looks (skin, hair colour and style, clothes, height in pixels), and `wear:` in a scene changes clothes for that scene. Its scenes carry a `year`, there is no card between scenes, and the ending is written in the script: a `WITHOUT` line and `GONE` lines for what goes when the person is taken away. `pixel.ts` has four more hair styles for it (a middle part, short spikes, a mop of curls, a permed mullet), shorts, an open jacket and shoe colour.
- **Threads through the five scenes:** Zambovia (a country Kofi made up in a flag quiz), the father who sets a place for Kofi, the grey hoodie, "same time tomorrow?".
- **Where this is going:** the film, then "without them" (take the person and everyone who reached you through them out of the life), then changing the starting conditions. A rerun shows another way a life could have gone, not what one meeting caused, and must be labelled so.

### People and what-if (experiments)

- The moments exported for the page are the ones about the cast, plus life events and a few of the best others, about 50 in all (it used to be the top 90 of everything).
- Every person has a short role (`tag`: "mom", "work friend", "pub quiz", "via Tomas") used on the lanes, the dialogue box and the title screen.
- `findArcs(life)` in `arcs.ts` is a pure function of the `LifeResult`, like highlights. It tells a few lines for everyone the protagonist knew and exports them as `LifeExport.arcs`. It picks a cast of 7 to 14 (partners, the family you spent most time with, then friends ranked by closeness added up over the years, with a penalty for repeating a kind of friendship so the cast is varied) and writes each person's beats from the event log, contact rows and snapshots.
- "Reached you through" means the person introduced you, or brought you into the club or job where you met.
- `LifeOptions.skipMeeting` makes the protagonist and one person not meet in one given week. Nothing else changes, so the life is identical up to that week. The two may still meet later.
- A single rerun is chaotic: a meeting delayed by a week can change who is close decades later. It shows a different life, not what one meeting caused.

### How to extend

- **New club activity:** add an entry to `CLUBS` in `activities.ts`. Hobby sets are stored as a 32-bit mask, so the limit is 31 activities.
- **New tunable:** add it to `params.ts`; the harness can then override it with `--set`.
- **New random draw:** add a new purpose to the `R` table in `sim.ts`. Append only, never renumber, or existing lives change.
- **New life event:** add a rule to `lifeEvents` in `sim.ts`, a variant to `SimEvent`, and wording in `highlights.ts`.
- **Family words:** `kinWord` in `people.ts` gives "mom", "dad", "older brother", "younger sister". It reads gender from the first name (a few names go either way and are settled by id), so no random draw is used and no life changes. A new first name in `world.ts` should be added to the list there if it reads as male.
- **New view:** read `LifeExport` only. If a view needs more data, add it in `export.ts`.

### The page

The page is one full-window game screen, not a page of cards. The current view fills the window and a HUD floats on top of it:

- **Top left:** the protagonist's name, the year, their age, their city (in its colour), their partner, and how many people sit in each circle.
- **Top centre:** the view tabs (keys 1 to 5). **Top right:** "Lives" reopens the title screen.
- **Bottom:** a dialogue box with the current moment's text (and, when it is about someone in the cast, their portrait, first name and role), and under it the timeline scrubber: a play button, the city band as the track, life events as diamonds, a lane for each person in the cast, a Cast button that hides the lanes, and a speed button (1×, 2×, 4×, 8×). Drag to scrub, space plays, arrows step a quarter.
- **Lanes:** a lane shows when that person was in your life and how close: tall and coral for inner circle, gold for close, thin white for a friend, a blue hairline for an acquaintance, and a faint line when out of touch. White marks are the turns in their story; clicking one goes to that moment and opens their card. Clicking a name opens their card. With the lanes hidden the scrubber shows every highlight as a dot sized by score, as it used to. Lanes are on by default in windows at least 700 pixels tall, and the choice is remembered in the browser.
- **Title screen** on load: the person, the one person the opening story is about (portrait, first name and role), a field to give them a name you know, Begin the story, Explore the whole life, and the other lives. Deep links (`?week=`, `?play`, `?person=`, `?advance=`, `?story`) skip it.
- **The opening story** (`story.ts`) covers the whole window: one pixel scene per beat with a caption typed under it, pips along the top, and an Explore button. It moves on by itself after a reading pause; space, enter, a click or the right arrow goes sooner, the left arrow goes back, escape leaves. The playhead follows the story, so leaving lands on the same moment in the tabs. The last beat offers watch again, explore this life, or another life.
- **End card** when playback reaches the end: people met, close friends, the one who mattered most, the luckiest meeting, then watch again, read the journal, or another life.

The views:

- **Walk** (pixel art, the default): the protagonist walks in place while the city scrolls past. The canvas is sized to the window at a whole-number pixel scale, and the street sits just above the dialogue box. The skyline is the city they live in (a spire for New York, a red bridge for San Francisco, a twin-antenna tower for Chicago), and the sky moves from dawn to dusk across the whole life. Their inner circle walks behind them and their partner beside them. At each highlight time holds still: the person walks up outside the venue (bar, café, park, office or club hall) and they wave. Getting together brings hearts and confetti and both outfits melt into a suit or gown for a year. A move sweeps the new skyline in with a plane overhead. Hair greys with age.
- **Map** (pixel art): the three cities as islands, fitted between the HUD bars. Everyone in the world is a faint dot; people the protagonist knows are coloured by closeness; dotted lines run to the inner circle wherever they live; dots fly between islands when someone moves. Hover for details.
- **Circle** (`circle.ts`): the protagonist in the centre, everyone they know placed by closeness and clockwise in the order they met.
- **People** (`people.ts`): the life retold as people. First the cast, the 7 to 14 people the story is about (partners, close family and a varied set of friends), each as a card meant to be looked at before it is read: who they are to you, their portrait and name, a strip of how close you were across the life, the one line that is current at the playhead, and a running count ("Seen 147 times so far · 96 still to come"). The whole story is folded away under the card. Then how they reached you (who led to whom). Then a catalog of everyone the protagonist ever knew, most relevant first, with a name search and filters.
- **Journal** (`journal.ts`): the reading page. A summary with lifetime numbers, the circle-size chart (scrubbable) and the full list of moments.

Clicking a person in the Map, Circle or People tab opens a card (`person.ts`) with the two of you drawn as two lines over time, and under the chart their story in a few lines: close together when you are close, drifting apart when you are not. A dotted pair shows where you would be on depth alone, without regular contact. The scale is shared by everyone and gives each circle the same height, so a change of circle is a visible step. Dots along the top are the moments you shared; drag the chart to scrub. `?person=<id>` or `?person=closest` opens it from the address bar.

Notes for anyone changing it:

- All pixel art is drawn in code from a person's id (`pixel.ts`), so there are no assets to license. Scenes draw to a small canvas that CSS scales up with `image-rendering: pixelated`; text is HTML in the VT323 font so it stays crisp.
- Every tab implements `Scene` (`types.ts`) and fills the whole stage. It reads the shared playhead through `Ctx`, returns `timeScale() === 0` to hold time still while a moment plays, and may choose which highlight the dialogue box shows (`caption()`). `ctx.insets()` gives the CSS pixels the HUD covers at the top and bottom so a scene can keep its subject clear of them; `resize()` is called when the window changes.
- The whole page is dark in both system themes and set in VT323. The circle tiers use the same four colours everywhere (`--tier-0` to `--tier-3`: coral, gold, off-white, blue), and the three cities keep their hues.
- The project owner does not want the experience to look like a dashboard. It should feel like a game: one screen, a HUD, tabs to dig into the detail.
- Still vanilla TypeScript and Vite. This layout is an experiment; expect to revisit the stack when the product shape is decided.

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

### Endings, switched on and off

2026-11-12: 8 lives of 40 years, seeds 1 to 8. Each column is the same 8 lives. "All on" is the default.

| Measure | All on | No falling out | No out-of-sight fading | No death | All three off |
|---|---|---|---|---|---|
| Circle sizes, whole world at the end | 2.9 / 11.2 / 26.6 / 44 | 3.0 / 11.7 / 27.2 / 45 | 3.1 / 14.9 / 40.1 / 67 | 3.3 / 11.6 / 25.5 / 44 | 3.5 / 15.5 / 40.5 / 69 |
| Protagonist's circle over their life | 2.3 / 9.9 / 25.8 / 58 | 2.5 / 9.9 / 26.5 / 56 | 2.7 / 11.8 / 33.9 / 71 | 2.4 / 9.0 / 24.2 / 53 | 2.5 / 12.5 / 33.7 / 71 |
| Fallings-out per protagonist, and made up | 3.6, 1.1 | 0 | 2.4, 0.6 | 2.1, 1.0 | 0 |
| Fallings-out made up, whole world | 26% | none | 29% | 27% | none |
| Deaths of family and friends per protagonist | 12.8 | 12.1 | 15.1 | 0 | 0 |
| Share of the world that dies | 59% | 59% | 59% | 0 | 0 |
| Friends still friends two years after a move | 58% | 60% | 74% | 65% | 76% |
| "Drifted apart" highlights per life | 17.1 | 20.8 | 6.6 | 18.3 | 7.3 |
| "Grew close again" highlights per life | 2.5 | 2.8 | 0.6 | 2.1 | 0.6 |
| Reunions per life | 12.3 | 12.6 | 7.0 | 13.0 | 8.4 |
| Deep friends (close on depth alone) | 6.6 | 6.7 | 8.7 | 6.4 | 9.4 |
| Friends of convenience | 25% | 20% | 19% | 24% | 14% |

What this shows. Out-of-sight fading is the big one: far more friendships end, more come back, and fewer survive a move (58%, down from 76%, which the earlier notes called too high). It is also what shrinks the circles. Falling out is a small number of sharp events, about a third of them mended. Death removes most of the older generation, as it would. With all three off the simulation is identical to what it was before, which a test checks.

Now clearly off and not tuned: circles are too small at every level (26 friends and 58 acquaintances for the protagonist; targets 50 and 150). See `docs/open-questions.md`.

### Being there, switched on and off

2026-11-13, 8 lives (seeds 1 to 8). On is the default.

| Measure | On | Off |
|---|---|---|
| Circle sizes, whole world at the end | 3.6 / 11.2 / 25.9 / 44 | 2.7 / 10.7 / 25.9 / 44 |
| Protagonist's circle over their life | 2.6 / 9.8 / 27.3 / 62 | 2.0 / 8.8 / 25.5 / 59 |
| Ever became inner circle | 5.9 | 3.0 |
| Ever became close | 36.4 | 32.8 |
| Deep friends (close on depth alone) | 6.9 | 6.0 |
| Age when partnered | 30 | 32.5 |
| Friends kept two years after a move | 65% | 61% |

It deepens the friendships that were already close and leaves the outer circles alone.

### Busy periods and starting at 18

2026-11-12, the same 8 lives (seeds 1 to 8). Busy periods were first tried at half as many plans for 18 months. That pushed the protagonist's age at partnering from 27 to 38, because partners come from close friends and close friends come from plans. At 70% for a year the age is about 32, everyone still finds a partner, and the protagonist's circle is about a tenth smaller (2.0 / 8.8 / 25.5 / 59 against 2.6 / 10.3 / 28.7 / 67 with busy periods off).

Starting at 18 in place of about 25: the protagonist meets more people over the story (about 330 against 220) and moves and changes job more, as a younger person would. Circle sizes are about the same. The story covers ages 18 to 58.

## Known limitations

- **Speed:** a 40-year life takes roughly 35 to 55 seconds on a laptop. The cost is memory-bound: tie objects and per-person maps are scattered, so the hot loops miss the cache. The identified fix is to store ties in flat typed arrays; it has not been done. For the browser, run the sim in a web worker and stream events so the timeline can play as it simulates.
- **No life stages, and nobody new arrives:** age lowers sociability, people stop going to work at 67, and people die. Nobody is born or moves in from outside, so about 59% of the world dies over a 40-year story and the protagonist's world ages with them. The protagonist never dies, so a "life" is always 40 years of adulthood.
- **Partners are simple:** no children, no in-laws, a breakup changes nothing about mutual friends or where anyone lives, and partners are always chosen from existing close friends in the same city.
- **Small cities:** 500 to 800 people stand in for each real city, so friends of friends overlap heavily and near-miss and small-world criteria are deliberately strict.
- **Probabilities are approximate** for chance meetings at open venues and for introductions.
- **Model was built from general knowledge** of the literature (shared-venue meeting, triadic closure, homophily, tie decay, preferential return to familiar places). No literature pass has been done to pin parameter values, and the Quarew1107/Life-simulation repo has not been read.

## Roadmap

### Done on 2026-11-12: conflict and busy periods

Conflict was built as falling out and making up, together with fading when out of sight and death. Busy periods followed, and the story now starts at 18. See "Ties" above and the calibration tables. The note below is kept for the measurement that led to this work.

Measured on 2026-11-12 across the five exported lives (about 1,050 friendships of two years or more, closeness on a 0 to 100 scale): nearly half move less than 15 points in total, only 14% move 30 or more, and the typical change from one quarter to the next is 1.5 points. People do change circle (about 31 become close friends per life and 36% of those later fall to acquaintance or below), but the fall is a slide over years and only 7 of 55 came back. Nothing in the model is sudden.

1. **Conflict.** Two people can fall out. The chance should depend on both personalities and on the relationship: how close they are, how long they have known each other, how much time they spend together. A fight opens a rift, a sharp drop in depth and a stop to plans together, that may be mended later or may not. Needs: a rule in the weekly loop, a `SimEvent` and highlight wording for the fight and for making up, a light tone, and an off switch so its effect can be measured the way messaging and breakups were.
2. **Busy periods.** A new job, a new partner or a move cuts someone's time for friends for a year or two, so contact drops across the board and then recovers.
3. After both: look at the person card again (its chart was rescaled by circle on 2026-11-12).

### After that

1. Review console lives and adjust tone, highlight wording and thresholds.
2. Review the Walk and Map views in a real browser: pacing, charm, what is missing.
3. Decide the product shape from `docs/experience.md` and `docs/product-ideas.md` (the leading idea: short setup, a one-minute pixel life, an end card to share).
4. Decide how the interactive experience pays for simulation time (precomputed lives, a web worker that streams, a faster core, or a mix), then do the performance work.
5. Timeline refinements: compress quiet periods.
6. Short literature pass to tune decay rates, contact frequencies and circle sizes.

Later, in no fixed order: intake form to set traits and rerun or compare lives; braided-lines view of you and a few best friends; illustrated life view; stats such as the share of time with your parents that remains after you leave home; life stages from birth (school, college), deaths, breakups and children; extra traits such as money and travel. Far future and out of scope: real users linked inside each other's simulations. Do not design it out.

## Explicitly out of scope for V0

Polished art and animation, the intake form, extra traits such as money, life events beyond moving, job changes and partnering, and a backend. This can change if we are realizing it's mature enough, not a strict requirement.

## Note
You as the AI own the codebase. Feel free to make sweeping changes and code modifications to fit the necessary problems at hand. Don't have allegiance to the code already written in this repository. 
