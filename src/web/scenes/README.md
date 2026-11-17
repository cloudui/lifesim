# Scene scripts

One file per scene, played in file-name order. Edit the words freely; the page reloads.

There are two kinds of film:

- **For a simulated life** (the files in this folder): the header names a `seed` and the other person (`with: 1051 Kofi`). The two people are `YOU` and the other one by first name. The scene hides itself if the life no longer matches.
- **Written from scratch** (a folder, such as `blue-shoes/`): a `cast` file gives each person a key, a name, a birth year, looks and a voice, and each scene's header names the film (`film: blue-shoes`), the person it is about (`with: JASON`) and a `year`. Nothing comes from the simulation.

```
name: The pier            what the scene list calls it
seed: 7                   a simulated life ...
with: 1051 Kofi           ... and the other person: their id and first name
film: blue-shoes          or: a film written from scratch (its folder) ...
with: JASON               ... and the person it is about
year: 2026                ... and the year (a simulated life uses week:)
set: pier night           the place and its variant; see the list below
week: 1287                when it happens; weeks before the story starts are negative (52 a year)
start: you sitting, them away          a simulated life: each of sitting | standing | away
cast: ERIC -12 sitting, JASON away     a film from scratch: who, pixels from the middle of the set, and a stance
city: 1                   which skyline: 0 New York, 1 San Francisco, 2 Chicago
props: bottles            things the set draws; see the list below
wearing: #8b8f98          a simulated life: the other person's shirt colour
wear: ERIC shoes=#2f8fff shorts=yes, JASON jacket=none    what differs from the cast file in this scene
take: ERIC                a film from scratch: who is taken away at the end, if not the person the scene is with
music: quiet              warm | quiet | late | none, or the name of an .mp3 in public/music (default: warm)
status: draft             draft | reviewed
notes: anything for the review list

TITLE New York, 2050 | The week after the funeral
PAUSE 5                   seconds of nothing said
KOFI: A line.             someone speaks
YOU: A line. [2]          optional: seconds of quiet after the line
KOFI (smile): A line.     optional: the face for the line: smile | sad | open | shut
ERIC (as JASON): "Ah."    said in someone else's voice
VOICE Dad: A line.        someone off screen
PHONE Calvin: A line.     someone on a phone
ENTER JASON left          walks in from left | right | door, to their place (or: ENTER JASON left -20)
LEAVE JASON right         walks off to left | right | door
RUN JASON right           the same, running
WALK ERIC 80              walks to a place
ENTER MOMO right 50 &     "&" at the end of a move: do not wait for it
SIT ERIC                  also STAND ERIC
FACE JASON right          left | right | auto (auto: towards whoever is speaking, or the nearest person)
EMOTE JASON z 8           a sign in a bubble over their head for some seconds: z dots bang ask note ring heart idea sweat (ring also rings)
HOLD JASON phone          something in their hand: phone (held out) | call (at the ear) | racket | cup | flowers | none
POSE JASON slump          sitting with their head down; POSE JASON up to undo
SHOW shoes 6              a close-up over the scene for some seconds: shoes | receipt | cake | photo (SHOW photo 6 JASON)
GIVE                      a simulated life: they hand you a bottle
DRINK them                or: DRINK you
CARD A line over the scene as it goes dark, to close it.
FLAG the joke is flat     a review note on the next line; shown in review mode
WITHOUT A line.           a film from scratch: the line over the ending
GONE Calvin | the roommate     ... and what goes when the person is taken away (a portrait if they are in the cast)
END Last words.           for a simulated life, {seen} and {led} are filled in and "without them" comes from the life
```

In a simulated-life scene the short forms still work: `ENTER`, `SIT` and `THEM:` mean the other person, `LEAVE you`.

`city: -1` is a town with no skyline: apartment blocks in a window, hills behind a house.

Sets: `pier` (night | dusk), `steps` (dusk | morning | night; props ball, boxes, car, breath), `tower` (the foot of a high-rise at night; prop breath), `sofa` (props balloons, plates, chair, blanket, crowd), `car` (a car park, seen through the windscreen), `camp`, `hall` (a lecture hall; prop laptop), `checkout` (prop people), `campus` (rain | awning), `street` (outside the gym; prop people), `hill`, `courts` (day | dusk; props bench2, rackets, players), `bar`, `cafe` (inside | outside; props laptops, cups, phone, tea, people). They are drawn in `../sets.ts`.

Review: open `?seed=7&scene&review`, or `?film=blue-shoes&review` (add `&scene=3` to start at the third). The file and line being played are shown top left; `[` and `]` jump between scenes, left and right arrows between lines.
