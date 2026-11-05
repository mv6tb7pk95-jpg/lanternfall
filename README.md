# lanternfall

A small browser game built on [pixelfx](https://github.com/patch-gg/pixelfx) pixel-art effects, loaded as ES modules
and hosted on GitHub Pages. There are two pages:

| Page | What it is |
|---|---|
| `game.html` | The playable game: story mode, endless mode, five classes, a gacha forge. |
| `index.html` | A viewer for the fire effects (campfire, brazier, torch, candle, and more). |

## Play

Turn on GitHub Pages: Settings, Pages, Deploy from a branch, `main`, `/ (root)`. Then open
`https://mv6tb7pk95-jpg.github.io/lanternfall/game.html`.

The game needs an internet connection, because it loads pixelfx from jsDelivr (see below).

### Controls

| Action | Keyboard | iPad / touch |
|---|---|---|
| Move | Left / Right arrows, or A / D | On-screen ◀ ▶ |
| Jump | Space, Up arrow, or W | On-screen JUMP |
| Basic attack | J, K or Z (hold to repeat) | On-screen ATK (hold) |
| Skills | 1, 2, 3 | Skill buttons at the bottom |
| Story dialogue | Space or Enter | Tap the box |

With no direction held, the basic attack turns the hero toward the nearest enemy. You can walk slowly while swinging.

### Modes

- **Story:** three chapters (The Gatehouse, The Frozen Cloister, The Ember Vault). Each has 3 waves, a boss, and
  dialogue before and after. A chapter opens when the one before it is cleared. A first clear pays the full reward and
  a replay pays 40%.
- **Endless:** survive as many waves as you can. Enemies get a little tougher every wave. Your best wave is saved.
- **Defeat:** you still earn shards (2 per kill in story, 12 per wave plus 1 per kill in endless).

### Classes and basic attacks

| Class | Basic attack |
|---|---|
| Warden | Slash (`melee/sword-slash`) |
| Skulker | Claws (`melee/claw-swipe`) |
| Emberist | Flame bolt (`fire/fireball`), a projectile |
| Arbalist | Shot (`projectiles/arrow`), a projectile |
| Lightkeeper | Light bolt (`projectiles/magic-missile`, recoloured gold): it charges and lands about 0.8 s later |

Each class also has its skills, which are real pixelfx moves (wind-up, effect, hit-freeze, screen shake, recovery).

### Lantern Forge (gacha)

Spend shards to pull weapons and accessories. There is no real money in the game.

- A pull costs 100 shards and a 10-pull costs 900. You start with 300.
- Odds: Common 55%, Rare 30%, Epic 12%, Legendary 3%.
- Pity: the 40th pull since your last Legendary is always a Legendary. A 10-pull always has a Rare or better.
- A duplicate raises the item's level (+15% of its base stats per level, up to level 6). After that it refunds shards.
- Equip one weapon (more damage) and one accessory (HP, cooldown reduction, crit chance, move speed or shard gain).
  Cooldown reduction applies to skills, not to the basic attack.

Your shards, story progress, items and equipment are stored in this browser's localStorage. Clearing the site data
resets them.

## Structure

```
game.html             game page; shows any load error in a red box
index.html            fire effect viewer
src/game/px.js        imports the real pixelfx from jsDelivr (pinned commit) and provides loadFx()
src/game/world.js     maps as themes: backdrops, walls, torches, braziers, campfire
src/game/entities.js  hero, enemies (slime, ghost, bat, snake, wisp), bosses
src/game/skills.js    classes and skills (pixelfx moves played with createAct)
src/game/attacks.js   basic attacks, swing poses, projectile helpers
src/game/story.js     chapters as data: map theme, waves, boss, reward, dialogue
src/game/gacha.js     items, odds, pity, pull and equip rules
src/game/save.js      the saved data (localStorage)
src/game/main.js      game loop, modes, input, HUD, menus
src/main.js           the fire viewer's code
src/core/             copied pixelfx core, used by the fire viewer (index.js is trimmed)
src/fx/fire/          copied pixelfx fire effects, used by the fire viewer
.nojekyll             stops GitHub Pages from skipping files that start with "_"
LICENSE-pixelfx.txt   pixelfx license
```

To add a chapter, add one object to `CHAPTERS` in `story.js`. To add an item, add one line to `ITEMS` in `gacha.js`.

The game does not use `src/core/` or `src/fx/`. It imports pixelfx straight from
`https://cdn.jsdelivr.net/gh/patch-gg/pixelfx@a841596/`, so every effect in the library is available and the code is
exactly the upstream code. To update pixelfx, change the commit in `src/game/px.js`.

## Run locally

ES modules do not load from `file://`. From this folder run a local server, for example `python3 -m http.server`, and
open `http://localhost:8000/game.html`.

## Credits

- pixelfx: https://github.com/patch-gg/pixelfx (MIT)
- Fire recipes adapted from Sprite Fusion's open-source fire, MIT License, Copyright (c) 2026 Hugo Duprez
