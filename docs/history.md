# History

What was added, when, and why, newest first. `AGENTS.md` describes the project as it is now; this file is the record of how it got there. Add an entry whenever a change alters how the simulation behaves or what the page shows. Commit ids are in brackets.

## 2026-11-12

### Busy periods, and the story starts at 18

- **What:** for a year after a move, a new job or a new partner, a person has less time for plans (70% of usual). The protagonist is now 18 or 19 when the story starts and lives where they grew up; the youngest people in the world are that age too. Under-18s, who only exist in the warm-up years, do not work or move on their own. `--start-age 25` gives the old start.
- **Why:** busy periods were the other half of "nothing is sudden". The start at 18 answers a finding from the retelling: most of a cast was already close on the first page, so their beginnings were never seen.
- **Result:** in a typical life now only one or two cast members are there from the first page (family aside), and everyone else is met on screen. A first, harsher setting for busy periods delayed partnering by a decade and was softened; the numbers are in `AGENTS.md`.
- **Open:** the story now covers ages 18 to 58, not 25 to 65. See `docs/open-questions.md`.

### Endings: falling out, fading when out of sight, and death

- **What:** three rules, each with an off switch.
  - *Falling out.* Two friends who matter to each other can fall out when they spend time together, more readily if they are a poor fit or the friendship is young. They stop seeing each other; whenever their paths would cross they either make up or keep away. Making up restores most of what they had.
  - *Out of sight.* After two years without being in the same room, a friendship that is not family loses the staying power that depth and long acquaintance gave it, and calls and texts hold much less of it. Seeing each other again resets it.
  - *Death.* People die on a realistic mortality curve. They leave the world; the protagonist keeps the memory. The protagonist cannot die.
- **Also:** the stories, highlights, lanes, person card and map all show these. A lane ends where a life does. The story lines now say what a count works out to ("427 times, about once a month"), after the owner pointed out that a bare number means little.
- **Why:** the retelling by people showed that almost every close friendship lasted the full 40 years and parents lived to 105. There were no endings to tell.
- **Experiment:** the same 8 lives with all three on, each one off, and all off; the table is in `AGENTS.md`. With all three off the simulation is unchanged, and a test checks that.
- **Result:** about 3.6 fallings-out per life with a third made up; "drifted apart" moments up from 7 to 17 per life and "grew close again" from 0.6 to 2.5; friends kept two years after a move down from 76% to 58%; about 13 deaths among a protagonist's family and friends.
- **Costs, not fixed:** circles shrank at every level and are now well under the human targets, and 59% of the world dies over a story because nobody new arrives. Both are in `docs/open-questions.md`.
- **A bug worth remembering:** weeks are negative during the warm-up, so "week of death, or -1" misread anyone who died then as alive. The rules now start with the story.

### A lane per person on the timeline; mom, dad, brother, sister

- **What:** the scrubber now has a lane for each person in the cast. A lane is tall and coral when you are in each other's inner circle, gold when close, thin and white for a friend, a blue hairline for an acquaintance, and a faint line when out of touch. White marks are the turns in that person's story; clicking one goes there and opens their card. A Cast button hides the lanes and brings back the old row of highlight dots. Family are now called mom, dad, older brother, younger sister and so on, read from the first name so that no existing life changes. Two cast members with the same first name get a last initial. The person card is no longer see-through.
- **Why:** the old scrubber was a time bar with a dot per meeting, which fitted the old list-of-meetings story. The project owner wanted scrubbing to mean more, wanted a way in from the scrubber (especially on a phone), and suggested the family words.
- **Raised and not solved:** the page is text heavy, and it is hard for a first-time visitor to tell who is who. Ideas are noted in `docs/experience.md`.

### People tab, a catalog of everyone, and the story on the person card

- **What:** a fifth tab, People. It shows the cast (now 7 to 14 people, depending on how many mattered, instead of a fixed ten) as cards with each person's story in a few lines, then who led to whom, then a catalog of everyone the protagonist ever knew, most relevant first, with search and filters. Lines that have not happened yet are dim, so the page fills in as time moves. The person card shows the same story under its chart. The export gained `arcs`, and the five lives were exported again. The Journal lost its cast list, which the People tab replaces. The dialogue box is now hidden on the People and Journal tabs, not just blanked, so they use the full height.
- **Why:** to judge the people-centred retelling in the browser, and so that anyone can be looked up, not only the cast.
- **Not done:** the timeline scrubber is unchanged; a lane per cast member is the next idea. The What-if is still console only. A phone layout is still not started.

### The life retold as people, and a first "what if" [branch `worktree-experience-doc`]

- **What:** two console experiments. `npm run people` retells a life as about ten people (family, partners and a varied set of friends), each with how you met, what you were to each other, what changed and how it stands at the end, plus the chains of who led to whom. `npm run whatif` picks the meetings that mattered most, leaves each one out, and runs the same life again to compare. The simulation gained one option, `skipMeeting`; no rule changed, and existing lives are identical.
- **Why:** the timeline read as a list of meetings. The project owner wants people to keep digging and to appreciate what the people in a life mean; a relationship's meaning is in its middle and ending, which were hardly told. `docs/experience.md` was written first, as a working draft of the experience.
- **Result:** the retelling reads better and the chains are the most interesting new thing. It also showed that the simulation rarely ends a friendship: in seed 7 almost everyone who became close stayed close for 40 years. In the what-if, undoing one 1-in-47,000 meeting in seed 7 gives a different partner and a different city. A single rerun is chaotic, so it shows a different life and not what the meeting caused.
- **Not done:** nothing on the page uses this yet.

### Full-screen game layout [branch `redesign-fullscreen`]

- **What:** the page is now one full-window screen instead of a column of cards. The current view fills the window and a HUD floats on top. Top left shows who, when, where and the circle counts. The tabs are in the middle of the top bar. Along the bottom are a dialogue box for the current moment and a docked timeline scrubber. A title screen opens each life and an end card closes it. Circle became a full-screen view of its own. The charts, the moments list and a new cast list (pixel portraits of everyone who became a close friend) moved to a fourth tab, Journal. Everything is dark and set in VT323. The four circle colours are now the same in every view.
- **Why:** the old page read like a dashboard of separate pieces; the project owner wanted one cohesive, game-like experience with the timeline as the default full-screen view.
- **Kept as is:** the stack (vanilla TypeScript and Vite), the Walk and Map drawing, the person card. Treated as an experiment; the stack may change once the product shape is decided.

### Closeness chart rescaled by circle [branch `chart-rescale`]

- **What:** the person card now uses one shared scale where each circle (acquaintance, friend, close friend, inner circle) takes the same height, with faint guides naming each circle. The names "you" and the friend moved into the legend.
- **Why:** most friendships looked flat. On a plain 0 to 100 scale most people sit between 5 and 40, so a change of circle was only a few pixels.
- **Result:** moving between circles is now a visible step. It does not change the underlying smoothness, which is a property of the model (see the next entry).

### Finding: friendships are too smooth [4cee3f6]

- **What:** measured about 1,050 friendships of two years or more across the five exported lives. Nearly half move less than 15 points (of 100) in total; the typical change from one quarter to the next is 1.5 points. People do change circle: about 31 become close friends per life and 36% of those later fall to acquaintance or below, but only 7 of 55 came back.
- **Why it matters:** closeness only changes by small weekly nudges and slow fading. Nothing is sudden.
- **Decision:** conflict (a falling-out that may or may not be mended) and busy periods are the next step. The plan is in the roadmap in `AGENTS.md`.

### Everything merged to `main` [9fc8300]

- The tie model, messaging, breakups and the person card were developed on separate branches and merged together.

## 2026-11-11

### Person card with the closeness chart [dccbd8a]

- **What:** click anyone in the Map or Circle tab to see the two of you as two lines over time, close together when you are close and apart when you are not. A dotted pair shows where you would be on depth alone. Dots along the top are shared moments; dragging scrubs time.
- **Why:** the project owner's idea, and the first way to see the depth and contact model with your own eyes.

### Messaging and breakups [aec2ed8, bece97a]

- **What:** most weeks a person texts two of the people they are closest to, in any city; it nudges contact up and holds faded depth but builds none. A couple may split, most likely when new or poorly matched; they stop being family, keep a quarter of what they had, and wait a year before looking again. The export carries the full partner history and the page shows a breakup and any later partner.
- **Why:** messaging gives cheap contact a role in keeping friendships alive. Breakups were the most obvious missing life event once partners existed.
- **Experiment:** each rule has an off switch (`msgRate=0`, `breakupRate=0`), and the same 12 lives were run with neither, each alone, and both.
- **Result:** messaging is a small, steady effect: circles grow 5 to 10% and friends kept two years after a move rise from 71% to 75%. Breakups barely touch friendship numbers; 52% of couples formed during the story split, which is too high and left untuned.
- **Reverted:** counting reunions from the last time two people met in person pushed them from about 13 to about 62 per life, so the original rule (time since any contact) was restored.

### Ties split into depth and contact [fb4a56f]

- **What:** a friendship used to be one strength number. It is now two: contact (how much you have seen of each other lately, fades in months) and depth (how much you matter to each other, built only by chosen time together and family time, fades over years). Closeness is `depth + (1 - depth) * contact`. Seeing an old friend, or calling them, restores part of the depth that had faded.
- **Why:** to tell friends of convenience from lasting ones, to let older adults stay close while seeing people less, and to give calls and messages something to do.
- **Result (8 lives, against the previous 12):** the inner circle grew from 1.9 to 3.4 (target 5). Outer circles shrank (acquaintances 90 to 68). Friendships now flap in and out of the friend level, so the median length of one that ended fell from 3.3 to 1.4 years. Only about 15% of friends are friends of convenience, which feels low. All left untuned.

### Map dots made readable [9efe883, ffb090b]

- **What:** acquaintances are larger and bright blue, friends near-white, the inner circle a step larger, and every known person has a soft dark rim.
- **Why:** acquaintances were single grey pixels that vanished into the crowd.

### Deployment [8872fa3]

- **What:** GitHub Pages, built and published by a GitHub Actions workflow on every push to `main`. Added by the project owner.

## 2026-11-10

### Pixel-art Walk and Map views [3d6830c]

- **What:** the page became three tabs under a shared timeline. Walk: the protagonist walks in place while their city scrolls past, people walk up and wave at each highlight, getting together melts both outfits into a suit or gown, a move sweeps in a new skyline. Map: the three cities as islands with everyone in the world as a dot. Circle: the original graph and charts, kept for inspection. All art is drawn in code, so there are no image assets.
- **Why:** the project owner did not want the main experience to look like a dashboard, and wanted a map of where everyone is.
- **Also:** `docs/product-ideas.md` was written, on what would make the site worth exploring.

### The first version [3c52d06]

Built in one stretch, in this order:

- **Simulation core.** About 2,000 people in three cities, one-week steps. People meet at shared venues (work, clubs, bars, cafés, parks) and through friends. The protagonist is only a camera: every rule applies to everyone. Randomness is keyed, so a life replays exactly from its seed.
  - *Why adulthood, not birth:* simpler; childhood can be added as stages later.
  - *Why 2,000 people:* in a few hundred you eventually meet everyone and nothing is surprising.
- **Highlights.** Moments are scored by improbability times consequence, because every specific meeting with a stranger is unlikely and rarity alone is noise.
- **Console reel, tuning harness, tests, JSON export.** The harness runs many lives in parallel and prints circle sizes against rough human targets of 5 / 15 / 50 / 150.
- **Compatibility index.** Every pair has a fit from 0 to 1 (personality, age, shared hobbies). It sets how readily strangers talk and how close two people can get. Added after the project owner asked for a friendship index.
- **Age effects.** Openness and going out decline from 25; long-held ties fade more slowly; people retire at 67. Added because a 27-year-old was befriending 70-year-olds and older adults should be "tight in heart but not in frequency".
- **Partners.** A single person may get together with a close, compatible friend. Partners count as family, come along to plans (which is how you meet each other's friends) and move together.
- **Real cities.** New York, San Francisco and Chicago with real neighbourhood names; every person and venue is invented.
- **First page.** Timeline, social graph and circle-size chart, reading exported lives only.

Standing decisions from this period, still in force:

- **Do not tune numbers early.** Each structural change moves them again; fix only what is clearly broken.
- **Speed is parked.** A life takes 35 to 55 seconds. The page reads lives simulated ahead of time.
