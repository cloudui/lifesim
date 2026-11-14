# Scene scripts

One file per scene, played in file-name order for a life. Edit the words freely; the page reloads.

```
name: The pier            what the scene list calls it
seed: 7                   the life it was written for
with: 1051 Kofi           the other person: their id and first name (the scene hides itself if they no longer match)
set: pier night           pier (night | dusk), steps (dusk | morning), sofa
week: 1287                when it happens; weeks before the story starts are negative (52 a year)
start: you sitting, them away     each of: sitting | standing | away
props: bottles            any of: bottles, ball, boxes
wearing: #8b8f98          optional: the other person's shirt colour
status: draft             draft | reviewed
notes: anything for the review list

TITLE New York, 2050 | The week after the funeral
PAUSE 5                   seconds of nothing said
ENTER                     the other person walks in
SIT                       the other person sits
GIVE                      they hand you a bottle
DRINK them                or: DRINK you
LEAVE you                 or: LEAVE them
KOFI: A line.             the other person (THEM: also works)
YOU: A line. [2]          optional: seconds of quiet after the line
KOFI (smile): A line.     optional: the face for the line: smile | sad | open | shut
VOICE Dad: A line.        someone off screen
FLAG the joke is flat     a review note on the next line; shown in review mode
END Last words. {seen} and {led} are filled in from the life. Before them the film shows
                          "without them": the person and everyone who reached you through them, fading out.
```

Review: open `?seed=7&scene&review`. The file and line being played are shown top left; `[` and `]` jump between scenes, left and right arrows between lines.
