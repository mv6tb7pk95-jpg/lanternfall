# lanternfall

A small browser game built on [pixelfx](https://github.com/patch-gg/pixelfx) pixel-art effects, loaded as ES modules
and hosted on GitHub Pages. There are two pages:

| Page | What it is |
|---|---|
| `game.html` | The playable game: five classes, waves of enemies, real pixelfx skills. |
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
| Skills | 1, 2, 3 | Skill buttons at the bottom |

### Classes

Warden, Emberist, Skulker, Arbalist and Lightkeeper. Each skill is a real pixelfx move (wind-up, effect, hit-freeze,
screen shake, recovery). Enemies come in waves: slimes first, ghosts from wave 2, bats from wave 4. You recover 25% of
your health between waves.

## Structure

```
game.html             game page; shows any load error in a red box
index.html            fire effect viewer
src/game/px.js        imports the real pixelfx from jsDelivr (pinned commit) and provides loadFx()
src/game/world.js     map: backdrops, walls, torches, braziers, campfire
src/game/entities.js  hero, enemies (slime, ghost, bat), movement
src/game/skills.js    classes and skills (pixelfx moves played with createAct)
src/game/main.js      game loop, input, waves, HUD
src/main.js           the fire viewer's code
src/core/             copied pixelfx core, used by the fire viewer (index.js is trimmed)
src/fx/fire/          copied pixelfx fire effects, used by the fire viewer
.nojekyll             stops GitHub Pages from skipping files that start with "_"
LICENSE-pixelfx.txt   pixelfx license
```

The game does not use `src/core/` or `src/fx/`. It imports pixelfx straight from
`https://cdn.jsdelivr.net/gh/patch-gg/pixelfx@a841596/`, so every effect in the library is available and the code is
exactly the upstream code. To update pixelfx, change the commit in `src/game/px.js`.

## Run locally

ES modules do not load from `file://`. From this folder run a local server, for example `python3 -m http.server`, and
open `http://localhost:8000/game.html`.

## Credits

- pixelfx: https://github.com/patch-gg/pixelfx (MIT)
- Fire recipes adapted from Sprite Fusion's open-source fire, MIT License, Copyright (c) 2026 Hugo Duprez
