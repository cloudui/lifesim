# Music for the film

Put an `.mp3` here and name it in a scene's header to play it under that scene, looped:

```
music: evening            plays public/music/evening.mp3
music: evening muffled    the same, as if through a wall (only the bass gets through)
music: evening 0.6        quieter; 1 is normal
music: none               no music
```

`warm`, `quiet`, `late` and `none` are taken: the first three are tunes made in the browser (`src/web/sound.ts`). Any other name is looked for here. A scene with no `music:` line uses `warm`. Two scenes in a row with the same line keep the track playing across the cut.

In Blue Shoes: `morning` (the shoes, the campsite, the call), `study` (the seat), `muzak` (H Mart), `tender` (hang back), `club` (the party; muffled outside the bar), `late-night` (the couch, the night before), `evening` (Castro Street, the hill), `courts` (court three, the theory), `cafe` (the café), `leaving` (the lanyard), `bench` (2066). Still on the made-up tune: the rain and the awning.

**Licences.** These files were added by the owner for a private demo, and at least one may not be free to publish. They must not reach `main`, which deploys the site. Before anything is published, replace them with CC0 or otherwise cleared tracks.
