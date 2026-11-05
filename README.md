# lanternfall

A test page for the [pixelfx](https://github.com/patch-gg/pixelfx) fire effects, loaded as ES modules.

## Structure

```
index.html            page; loads src/main.js and shows any error on screen
src/main.js           our code: draws campfire, brazier, torch and candle
src/core/             pixelfx core (copied; index.js is trimmed, see below)
src/fx/fire/          pixelfx fire effects (copied): _lib, campfire, brazier, torch, candle
.nojekyll             stops GitHub Pages from skipping files that start with "_"
LICENSE-pixelfx.txt   pixelfx license
```

`src/core/index.js` is trimmed from upstream: the exports for `scene`, `act`, `rig`, `poses` and `chain` are removed
because those files are not copied here yet. Add them back when they are.

## View it

Turn on GitHub Pages: Settings, Pages, Deploy from a branch, `main`, `/ (root)`. Then open
`https://mv6tb7pk95-jpg.github.io/lanternfall/`.

ES modules do not load from `file://`, so opening `index.html` straight from a folder will not work. To test on a
computer, run a local server from this folder, for example `python3 -m http.server`, and open `http://localhost:8000`.

## Credits

- pixelfx: https://github.com/patch-gg/pixelfx (MIT)
- Fire recipes adapted from Sprite Fusion's open-source fire, MIT License, Copyright (c) 2026 Hugo Duprez
