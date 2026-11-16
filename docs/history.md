# History

What was added, when, and why, newest first. `AGENTS.md` describes the project as it is now; this file is the record of how it got there. Add an entry whenever a change alters how the simulation behaves or what the page shows. Commit ids are in brackets.

## 2026-11-16: Blue Shoes, after a full watch

- Skipping: space or the right arrow during a walk finishes the walk and moves on. The left arrow goes back to the previous line that is said or shown, never to a pause, a walk or a sign over a head (which only played again), and steps back into the previous scene from a scene's first line.
- People stay turned towards whoever last spoke; before, they snapped back between lines.
- `RUN` leaves at a run (the end of the rain scene). `POSE ... slump` now closes the eyes and puts the head lower. The phone-ring sign is redrawn as a phone, and a call is the phone against the ear.
- Jason's building is named: The Varsity, with other people from the barbecue leaving. The stranger at the courts turns away and looks at his phone. Eric is handed the racket.
- Words: the card after the lecture hall is one plain sentence; the night before no longer says "it was good" and "I appreciate you having me" twice each; punctuation fixed throughout (commas before "man", question marks, Chipotle, Amazon, Uber).

## 2026-11-16: Blue Shoes, Jason's life written by hand

- The owner did not want a renamed simulation: the life after the film should be written by hand, and told from Jason, since it is for him. `npm run recast` and its life are gone.
- `src/web/scenes/blue-shoes/life.json` is Jason's life: 22 people (his parents, his brothers James and Jeffrey, Eric, Momo, Calvin, Berek, Emily, Daniel, Jocelyn in New York, David, Tomoka, and a few invented ones marked as such), each with a closeness curve and a few lines, plus 27 moments and a 12-beat caption story. It follows what the owner said up to late 2026; everything after is invented and matches the film's invented scenes (New York in 2027, Mei in 2031).
- `npm run handlife` turns it into `public/lives/2002.json`: quarterly snapshots from the curves, how often people saw each other from closeness and city, counts for the Journal, and anonymous dots for the Map. Nothing is simulated.
- Leaving the film opens it. Looks are matched by first name, so Jason is "you" here though the film is told from Eric.
- Music: `late-night` on the couch and the night before; `club`, muffled, under the party and outside the bar.

## 2026-11-16: Blue Shoes, a life to explore after the film

- `npm run recast` runs a simulated life and gives some of its people names you know: the protagonist, the partner, a lead and friends, from a cast file (`src/web/scenes/blue-shoes/life.json`). Names are changed before the life is told, so every caption uses them. Named people are given the protagonist's birth year, and a known name never goes to someone who dies in the story. `--scan 1-12` prints lives to choose from.
- The life for Blue Shoes is seed 11 with Maryland as a city: Eric Chen grows up in College Park and moves to San Francisco in 2022. Only the names are real; everything that happens in it is the simulation's. It is `public/lives/2002.json` and is listed with the other lives.
- Leaving the film (Leave, Escape, or "Explore Eric's life" at the end) opens that life on the People tab. The people the film drew have the same looks there.
- The mark over whoever is speaking is gold with a dark edge and bobs. Signs over heads sit in a small speech bubble; a lightbulb and a sweat drop were added. A phone call is drawn with the phone at the ear and lines coming off it, and the phone rings out loud. Calvin's hair is shorter on the small sprite, with bangs.

## 2026-11-16: Blue Shoes, the owner's music

- Five tracks the owner found are in `public/music/` and named in the scenes: `morning`, `muzak`, `rain`, `cafe`, `bench`. At least one may not be free to publish; they are for the private demo and must not reach `main`.
- Music files now play through the same output as the rest of the sound, fade in and out, and take two options: `muffled` (through a wall) and a volume.
- The party scene has its own sound in place of music: a murmur of people and a bass line coming through it, synthesized.
- None of this has been listened to by the agent.

## 2026-11-16: Blue Shoes, second round of looks

- Jason was redrawn from two more photos: softer short hair that fades at the sides, a light grey tee and no jacket (the dark jacket and flat top read as an anime delinquent), and a smile as his resting face (`mood=smile` in the cast file).
- Mouths no longer move while a line is typed; the owner found it creepy. Expressions stay.
- The small sprites of Momo and Eric were simplified: glasses are three dots, the mop and the fringe are smaller. Eric wears a white top.
- The sound and leave buttons sit in one row and no longer overlap.
- The bar along the bottom is a timeline: numbered pieces, and the scene's name and year above the pointer.

## 2026-11-16: Blue Shoes, after the owner's first watch

The owner watched it and sent a list, with photos of the four friends.

- The cast was redrawn from the photos: glasses (new), a messy fringe, a flat top, wavy hair to the shoulders, a taller mop, and Momo only in black and grey. The very large men are a wide build drawn at native size, where before they were a stretched sprite that smeared.
- The dialogue box has a proper portrait (32 by 26) in place of the body sprite blown up, because the mouths looked wrong. It talks while the line types.
- Title cards hold on black and the picture comes up after. The sound button is an icon the size of Leave. A scrubber along the bottom jumps between scenes.
- People sitting on a seat are drawn from the side with bent knees, and the sofa's cushions are behind them.
- Sets: Mission Dolores has a row of courts, the park and low houses, and no bridge. Jason's place is the foot of a high-rise among apartment blocks. Maryland scenes no longer show a city skyline. Background people at the party, the café (with a counter and other tables), the checkout and on Castro Street.
- Close-ups (`SHOW`), things in hands (`HOLD`) and a head on the desk (`POSE`).
- Long lines were split into consecutive boxes where there was a beat.
- Music: three synthesized tunes, or an .mp3 from `public/music/`. Not listened to.

## 2026-11-16: Blue Shoes, a film about real people

- The owner approved the script in `drafts/jason-film.md` and asked for it to be built. It is nineteen scene files and a cast file in `src/web/scenes/blue-shoes/`, opened from the title screen ("Films about real people") or with `?film=blue-shoes`. The words are the owner's draft; two typos were fixed ("made", "visiting"). The last line of the film (END) is not from the draft and is flagged.
- The film player was rewritten to hold any number of people. A scene places each one, and they can walk in and out from either side or through a door, walk to a place, sit, stand, turn to the speaker, and show a small sign over their head. Scenes can end on a card. The seed 7 film plays through the same code.
- A film can now be written from scratch, with a hand-written cast in place of a simulated life. Looks come from the cast file: skin, hair (four new styles), clothes, height. A scene can change what someone wears, which is how the blue shoes are on the right feet in 2022 and 2066.
- Ten new sets, in a new `sets.ts`: a car in a car park, a campsite, a lecture hall, a supermarket checkout, a campus in the rain and under an awning, Castro Street outside the gym, the hill, tennis courts, the outside of a bar, a café table inside and outside. The steps got a night and a packed car; the sofa got balloons, plates, an armchair and a blanket.
- Sound: a rain bed, a voice pitch per person, and a line said "as" someone else borrows their pitch (Eric doing Jason).
- Checked by loading every scene at a fast-forwarded moment and looking at a still, never by watching it play, and the sound has still not been listened to.
- Kept out of `main` on purpose: pushing there would publish a film about real people.

## 2026-11-16

### Sound for the film, and a draft about real people

- **Why:** the owner said the film feels decent but lacks two things: sound, and characters you know enough about to believe. They proposed a test: a film about themselves and a real friend, sent to that friend, to find out whether realness or craft is the gap.
- **Sound:** `src/web/sound.ts` synthesizes a bed of noise per set and a blip per typed letter with a pitch per speaker (the Stardew and Undertale device, which also helps tell two sprites apart). No music. It was built without being heard; treat every level in it as a guess.
- **The draft:** `drafts/jason-film.md`, eleven scenes from the owner's account plus three invented ones set in the future, with a list of facts to confirm and what building it needs (eight new sets, a third person on screen, a hand-written life in place of a simulated one). Not built yet, and kept out of git.
- **What the draft already shows about characterization:** the real material came with voices (who teases, who deflects), a want, a running complaint and shared objects. Axel and Kofi have a made-up country and a hoodie and nothing else.

## 2026-11-14

### The life with and without them, in the Circle

- **Why:** the film ends by taking one person away. The data side should then show what that does to the life, which is the link between the film and the views.
- **What:** "See the life without them" at the end of the film, or `?seed=7&without`, opens the Circle with the person and everyone who reached you through them taken out. They become dashed outlines with names; a bar gives each circle's size with and without them as the playhead moves, the number of people gone and how often you saw one of them (651 times in seed 7). The bar says plainly that this is the same life with people removed, not a rerun.
- **What it shows about seed 7:** not much changes. At 33 it is one close friend and two friends fewer. Kofi matters to Axel for what passes between them, not for who he brought, and the partner came through someone else. A life chosen for a film should ideally have one person who is both.
- **Not done:** the other views ignore the mode; nothing yet compares two different starting conditions.

### "Without them" after the film, and faces with moods

- **Why:** the film was meant to lead somewhere: once you care about one person, take them away. That step did not exist. And the faces in the dialogue box could not show anything.
- **Without them:** after the last scene and before the last words, the film says how many people were ever your friend (207 in seed 7), shows Kofi and the five people who reached Axel through him as portraits with how often each was seen, then "Take Kofi away" and they fade one at a time. It is this life with those people removed, not a rerun.
- **Faces:** a mouth, a blink every few seconds, and four moods a script line can ask for (`KOFI (smile): ...`; also `sad`, `open`, `shut`). The five scripts are marked up, lightly.
- **Title screen:** when a life has a film, the film is the main button and the caption story is offered as "The same life as captions".
- **Not done:** the comparison view that should follow (the life with and without the person, side by side, in the data views); gestures; sound.

### A five-scene film for seed 7, as script files

- **Why:** the owner watched the pier scene and said the form works. They want a handful of scenes prepared in advance for chosen lives, to refine the art later, to improve some of the dialogue themselves, and to flag things while reviewing scene by scene.
- **What:** five scenes about Axel and Kofi (the steps 2018, the boxes 2030, the sofa 2038, the pier 2050, the pier again 2065), each a plain script file in `src/web/scenes/` that can be edited without touching code. The player (`film.ts`) plays them in order with a card for the years between, counted from the life ("Eight years. You and Kofi do not see each other once."). Two new sets: the front steps of the family house and a flat with a sofa; the pier has a dusk version. People can be children (smaller) and old (grey). An off-screen voice is possible (the father, from inside the house).
- **Review tools:** `?seed=7&scene&review` shows file and line; `FLAG` lines in a script mark what needs attention; each scene has a `status` and `notes`; the title screen lists the scenes with their status.
- **Facts and invention:** each script's `notes:` line says what is from the log. Invented: Zambovia, the card after Ben's death, what was said.
- **Not done:** expressions and gestures (nobody turns to look at anyone), sound, films for other lives, the "without them" step after the film. The title screen is crowded with both the story and the film on it.

## 2026-11-13

### A first film scene: the pier

- **Why:** the owner watched the one-person story and said it still lacked emotional care. Narration ("this happened, then this") will not make people care; it needs a scene in the manner of a Stardew heart event, an intimate moment in dialogue with room to breathe. They suggested two people on a pier at night with a beer.
- **What:** `src/web/film.ts` plays a scene with no narration: a title (place and year), then lines of dialogue with the speaker's face, and scripted silences during which the water moves and someone drinks. `src/web/scenes.ts` holds one scene written by hand for seed 7: Axel and Kofi on a pier in New York the week after Axel's father's funeral. Every fact in it is from that simulated life (the flag quizzes are from the detail library; the hoodie, the nine years apart, Kofi's partner Suki and who did the washing-up are from the log). About two and a half minutes; space or click goes sooner.
- **Where:** `?seed=7&scene`, or "One scene: the pier (draft)" on seed 7's title screen.
- **What it is for:** deciding the form. If dialogue scenes work, the plan is a short film of four or five per life, then "without them", then changing the starting conditions. Dialogue would be written per shipped life, ahead of time, from its log.
- **Not done:** expressions on the faces, sound, any other set, any other life.

### Being there: close people come when something goes wrong

- **Why:** the one-person story (below) could only say "they were there" when the log happened to put the two of you in a room after a death. Nothing caused it. In seed 7 the protagonist's brother died and the person the story was about did not appear. The owner asked for moments of duress, and for someone being there in them.
- **What:** for 8 weeks after someone loses a relative or a partner, or a couple splits, they are having a hard time (`hardTime` in `sim.ts`). Each week, each friend who is at least a close friend and in the same city comes round with chance 0.35, at most two a week. A friend in another city whose depth is at least 0.45 may travel, once, with chance 0.2 a week. The time counts as chosen time together and builds depth three times as fast, so being there is one of the ways a friendship becomes deep. It applies to everyone, not only the protagonist. `supportRate=0` turns it off, and a test checks that the simulation is then unchanged.
- **Logged** as `{ t: 'support', who, other, why, lost, far }` whenever the protagonist is either the one having the hard time or the one who came.
- **In the story:** "they came" beats are now told from these events and say when the person got on a plane. There is a new beat for the other direction: something happens to the one person and you go to them.
- **Measured,** 8 lives (seeds 1 to 8), rule on against off: the protagonist's inner circle averages 2.6 against 2.0 and close circle 9.8 against 8.8; people who ever became inner circle 5.9 against 3.0; deep friends 6.9 against 6.0; age at partnering 30 against 32.5 (partners come from close friends). The whole world's inner circle at the end is 3.6 against 2.7 (target 5). Outer circles do not move.
- **In 20 stories:** 37 beats of someone being there, in both directions. The one person is now a friend in 12 lives and the partner in 8.
- **Every life changed,** as with any new rule: the five exported lives were re-simulated. Seed 7 is now about Kofi, a childhood friend, so `docs/story-script-seed7.md` (written by hand from the earlier seed 7) no longer matches that life. It is kept as the target for tone.
- **Still missing:** hard stretches are only deaths and breakups (no lost job, illness or bad year); a falling-out still has no reason and rarely involves the one person; a pair has no place of their own.

### The story is about one person, with moments that earn the turns

- **Why:** the owner watched the first opening story and found it not compelling. Nothing was earned: captions summarised a relationship ("you met", "527 times") and never showed two people doing something, and three leads in 15 beats left about three beats each. A hand-written target (`docs/story-script-seed7.md`) tested the fix on paper first, and the owner said to build towards it.
- **One person:** `tellStory` now picks one lead. Closeness over the years gets someone considered; what picks them is how much happens between the two of you: a falling-out and a mend, a silence of three years or more that ended, being there in the weeks after a death or a breakup, being a friend for years before becoming your partner, how many people reached you through them. Sometimes that is the partner and sometimes a friend. Family, and a partner who is someone else, are a second thread underneath (the table, deaths, one line when you get together).
- **Moments read from the log** (new beats, all for the one person): a flashback to the meeting when it was before 18; a few small moments from growing up or from the first two years; a long talk, placed in the half-year their depth rose fastest; the weeks they were there after a death or a breakup; the long silence as a card (how often before, not once after, and the calls thinning); a trip to see each other while living apart; and "Without them", everyone who reached you through this person.
- **The detail library:** `src/sim/details.ts`. The simulation knows two people spent an evening together and not what they did. The library supplies the specifics (the fort of sofa cushions, the rented climbing shoes, the food from a place you have never heard of), chosen from both people's hobbies and from how they know each other, keyed by seed and person so a life always tells the same story. One object (a hoodie, an umbrella) leaves with them when one of you moves and comes back at the reunion. The event under every detail is real; the detail is invented in the telling.
- **Dropped from the story:** the two facts about aggregates ("half of everyone you will meet", "the most friends you will ever have"). The owner's note: they are about nobody. The fact about time with your parents stays, and the numbers that remain are about the one person.
- **Page:** new scenes for these beats (`early` with three small poses, `talk` with speech bubbles taking turns, `showup`, `gap` as two cities drifting apart with messages thinning, `visit`, `without` with people appearing one at a time). Scenes from before 18 are drawn smaller, in daylight, with a warm wash. The title screen shows the one person.
- **What 20 lives looked like before the rule above:** the one person was the partner in 13 of 20 lives and a friend in 7.
- **What it still cannot do, and why the engine is next:** (1) the early moments are invented, because childhood is not simulated; (2) "they were there" was a coincidence in the log (fixed the same day, see the entry above); (3) fallings-out almost never involve the person the story is about, and have no reason; (4) a pair has no place or habit of its own beyond a venue they both happen to use. The library is also small (about 100 lines), so stories repeat each other's moments.

## 2026-11-12

### The story editor, and an opening story on the page

- **Why:** the owner watched the timeline and did not want to keep watching; it read as a repetitive demo. The direction agreed on 2026-11-12: a short story first that makes you care, then the views as a playground. The story should be the emotional beats of a life, told as one contained thing, not only the rarest events.
- **What, engine:** `src/sim/story.ts` is an editor. `tellStory(life)` is a pure function that cuts a life to about 15 beats of three kinds. *Turning points* are moves, getting together, falling out, deaths. *Texture* is what recurs: the family table each December and a standing night out with a friend; it is scored by how much the same scene has changed, not by how rare it is. *Facts* are arithmetic on the log shown as a card ("half of all the days you will spend with your parents after 18 are already behind you"). `npm run story -- --seeds 1-20` prints them.
- **"Contained" is a rule:** the story follows two or three leads (the longest partner and two friends, chosen so that one friendship lasts and one does not, and so that most are met on screen). Only leads and family are named. Each lead has a beginning and an ending inside the story. It opens and closes on the family table.
- **What, page:** Begin now plays the story (`src/web/story.ts`): one pixel scene per beat with a caption under it, about a minute and a half, advancing by itself or on space or click. Scene templates so far: the family table (with empty chairs), a meeting outside a venue, a standing night out, a move, getting together, falling out, a reunion, a last time, a goodbye, a fact card and an end card. "Explore" leaves for the tabs at the same moment in the life. The title screen shows only the leads and has a field to give one friend a name you know. `?story&beat=4&name=Sam` deep-links.
- **Also:** the simulation now writes down when someone in the protagonist's family gets together with or splits from a partner (`kinCouple`, `kinSplit`), so the table knows who a sibling brings home. Nothing in any life changes. "Mom" and "dad" are no longer given to a sibling who is 16 or more years older. The Walk's skyline and venue drawing moved to `src/web/backdrop.ts` so both views use it.
- **What reading 20 stories showed** (the first cut was wrong in instructive ways): importance cannot be one score across kinds, because the family table and house moves crowded out everything else; each kind now has its own ceiling. Three friends known from the first page make a dull opening. "You had been in the same room 28 times" is striking once and noise the fourth time.
- **Specifics the simulation does not have, found by reading the captions.** These are the candidates for the next engine work, in place of the old list order:
  1. *Moves have no reason and there are too many.* "At 19 you leave San Francisco for New York" reads as arbitrary, and people bounce between three cities four or five times. College, a job or following a partner would each give a caption something to say.
  2. *A couple has no place.* Once two people get together all their time is "family time" with no venue, so the most important tie has no standing night out to show.
  3. *The table can only grow through partners.* No children, no weddings, no in-laws. It mostly empties.
  4. *Parents are old.* Families span up to twenty years and the protagonist is the youngest, so a parent can be 50 years older and die when the protagonist is 22.
  5. *The holidays are inferred.* Who is at the table is read off who you saw in December; nothing gathers a family.
  6. *What two people do together is only a venue name.*
  7. *Fallings-out among leads are rare and have no reason;* most friendships in the stories end by a move.
- **Not done:** the story is not tuned by eye in a browser at full size; scenes are first drafts. What-if is not in the story. The setup screen with traits is not started. Phone layout untouched.

### Less text, and who is who

- **What:** cast cards now lead with the role ("your mom", "a friend from growing up"), then portrait and name, a strip of closeness across the life, one current line, and a count that moves with the playhead ("Seen 147 times so far · 96 still to come"). The full story is folded away. Every lane on the timeline says the role, not only family. The dialogue box shows the portrait, first name and role of the cast member a moment is about. The title screen lists the cast as opening credits. The moments shown were cut from about 90 to about 50 and are chosen to be about the cast. The person card has the same count.
- **Why:** the owner found the page text heavy and hard to follow for someone who does not know who anyone is, and wanted numbers to mean more.
- **Tried and dropped:** tiny faces in the lane gutter; unreadable at that size.
- **Not done:** renaming the key people to names from your own life (names are baked into the story text, so it needs care); a visual for who led to whom; the Walk still stages moments the old way.

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
