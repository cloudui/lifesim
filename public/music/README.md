# Music for the film

Put an `.mp3` here and name it in a scene's header to play it under that scene, looped:

```
music: evening        plays public/music/evening.mp3
```

`warm`, `quiet`, `late` and `none` are taken: they are the tunes made in the browser (`src/web/sound.ts`). Any other name is looked for here. A scene with no `music:` line uses `warm`.

Check the licence before committing a file. CC0 or "free for any use" is simplest; "CC BY" needs a credit line somewhere on the page.
