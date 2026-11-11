# What would make this magnetic

Notes from 2026-11-10, saved for later. None of this is decided or built. The question was: what would make people want to explore a site like this, and what stats and features would pull them in?

## The shape that seems strongest

A 20-second setup, a 60 to 90 second pixel-art life, and an end card with three numbers and a share link. Everything below either feeds that loop or gives a reason to run it again.

## Hooks, strongest first

1. **It has to be about you.** People share things that say something about them. A short setup (age, city, a couple of hobbies, how outgoing you are) turns "a simulated person" into "a life like mine". Letting people type the first names of two or three real friends, who then appear in the life, would make it personal immediately.

2. **What if.** One click on any moment: "what if you hadn't gone to that bar that night?" The life replays from that week without it. This is the sliding-doors feeling the whole project is about, and the keyed randomness was designed to allow it.

3. **Many versions of you.** Run the same person 100 times and report the spread: "you end up close to Sam in 31 of 100 lives", "you meet your partner in 12 different places". It answers the question people actually have, which is how much of their life was luck.

4. **One number worth repeating.** An end card built around a single line: "You met 412 people. Nine of them mattered. The one who mattered most was a 1-in-14,000 chance." A new seed gives a new line, so pressing "another life" has a slot-machine pull.

5. **The bittersweet stats.** In the spirit of "The Tail End":
   - the share of all the time you will ever spend with your parents that is already behind you when you leave home
   - how many more times you see a friend after one of you moves
   - how many people in your inner circle at 60 you had already met by 30
   - the longest friendship, and the one that faded fastest
   - how many friendships were made in a single year, and which year

6. **Near misses.** "You stood in the same café as your future partner 11 times before you spoke." Strangers who matter later are the most quotable kind of coincidence.

7. **Six degrees, made visible.** Pick any stranger in the world and see the chain of handshakes to you, and how it shortens as your life goes on.

8. **Friends in each other's lives.** Send a link: "you're in my life". If the recipient runs theirs, the two lives share a world. This is the growth loop, and it is also the far-future multi-user idea.

9. **A cast list.** Credits at the end: everyone who mattered, in order of appearance, with their pixel portrait and one line each.

## Considerations

- **Length.** A whole life has to play in about a minute, with a skip button. Nobody shares something they did not finish.
- **Phones first.** Sharing happens on phones, so the walk view needs a portrait layout before anything else is polished.
- **Believability.** People will dismiss it the moment their own life looks wrong. A few numbers need to be right (circle sizes, how many friends survive a move), and the framing should be "a life like yours", never a prediction.
- **Tone.** Some lives will be lonely, and later there will be deaths and breakups. Decide how those are shown before they are added. Light, never mocking.
- **Privacy.** If people type real names, keep them in the browser and say so.
- **A thing to share.** A picture or short clip of the end card, and an address that replays the exact life. The second part already works, because a life is a seed.
- **Cost.** Every one of these needs lives to be cheap. See the notes on precomputed worlds in `AGENTS.md`.
- **Real places.** Real city and neighbourhood names are fine; real businesses and real people are not.

## What each idea needs from the simulation

| Idea | Needs |
|---|---|
| About you | The intake form, and a way to drop a user into a finished world quickly |
| What if | Rerunning from a chosen week with one event removed |
| Many versions | Cheap lives, or a batch service |
| End card | Nothing new; the stats already exist |
| Bittersweet stats | Time-with-family counts, and later deaths and children |
| Near misses | Already recorded for open venues |
| Six degrees | Everyone's ties recorded, not only the protagonist's |
| Friends in each other's lives | A shared world and accounts |
| Cast list | Nothing new |
