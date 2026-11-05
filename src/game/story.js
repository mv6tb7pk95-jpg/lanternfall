// Lanternfall: the story. This file is DATA only: each chapter is a map theme, a list of waves, a boss, a reward
// and the lines spoken before and after. To add a chapter, add one more object to CHAPTERS. No other code changes.
//
// theme   colours and prop positions for world.js (see DEFAULT_THEME there)
// tint    a pixelfx palette name (PAL.ice, PAL.lava ...) or "#hex" that recolours this map's ordinary enemies, or null
// scale   multipliers on enemy HP and damage
// waves   [{ n: how many enemies, kinds: which types }]
// boss    type, name, hp, dmg, speed, tint, and summon: every N seconds it calls n helpers
// intro/outro   [speaker, line] pairs, shown one at a time
import { DEFAULT_THEME } from "./world.js";

// pillars sit at x = 70 + k * gap, so props are placed on or between them
const CLOISTER = {
  id: "cloister",
  sky: { top: "#0a1226", low: "#1b3556", star: "#e6f4ff", moon: { x: 240, y: 24, r: 11, c: "#dff3ff" } },
  wall: { brick: ["#1c2a3f", "#223349", "#182438"], mortar: "#0e1626", cap: "#3a5578", hi: "#5d7fa6", stone: ["#5d7fa6", "#41607f", "#2c4562", "#1d3047"], gap: 110 },
  floor: { edge: "#6f93ba", light: "#2d4560", dark: "#223650", mortar: "#16243a" },
  props: { torch: [180, 400, 620, 840, 1060], brazier: [290, 730], campfire: [950], tint: "ice" },
};

const VAULT = {
  id: "vault",
  sky: { top: "#1a0708", low: "#4a1410", star: "#ffb070", moon: { x: 80, y: 26, r: 12, c: "#ff7a3a" } },
  wall: { brick: ["#2a1412", "#331a16", "#22100f"], mortar: "#140808", cap: "#5a2a20", hi: "#7a3a2a", stone: ["#7a3a2a", "#5a2a20", "#3a1a16", "#26110f"], gap: 180 },
  floor: { edge: "#8a4a32", light: "#3a1d18", dark: "#2a1411", mortar: "#1c0d0b" },
  props: { torch: [250, 610, 970], brazier: [430, 790, 1150], campfire: [520], tint: null },
};

export const CHAPTERS = [
  {
    id: 1,
    name: "The Gatehouse",
    blurb: "The dark came in through the gate.",
    theme: DEFAULT_THEME,
    tint: null,
    scale: { hp: 1, dmg: 1 },
    waves: [
      { n: 5, kinds: ["slime"] },
      { n: 7, kinds: ["slime", "ghost"] },
      { n: 8, kinds: ["slime", "ghost", "bat"] },
    ],
    boss: { type: "ghost", name: "The Gate Warden", hp: 520, dmg: 14, speed: 30, tint: "blood", summon: { every: 10, kinds: ["slime"], n: 2 } },
    reward: 150,
    intro: [
      ["Narrator", "Lanternfall never slept, because one great lamp burned in its tower."],
      ["Narrator", "The night the lamp fell, the dark came in through the gatehouse."],
      ["You", "I carry a small flame. It will have to be enough."],
    ],
    outro: [
      ["You", "The first lantern burns again. The gate holds."],
      ["Voice", "Climb, bearer. The cloister is colder than the gate."],
    ],
  },
  {
    id: 2,
    name: "The Frozen Cloister",
    blurb: "A prayer that froze halfway through.",
    theme: CLOISTER,
    tint: null,
    scale: { hp: 1.3, dmg: 1.2 },
    waves: [
      { n: 7, kinds: ["ghost", "bat"] },
      { n: 8, kinds: ["ghost", "bat", "wisp"] },
      { n: 10, kinds: ["bat", "wisp", "ghost"] },
    ],
    boss: { type: "snake", name: "The Rime Serpent", hp: 780, dmg: 18, speed: 26, tint: "ice", summon: { every: 9, kinds: ["bat"], n: 2 } },
    reward: 200,
    intro: [
      ["Narrator", "Beyond the gate, the cloister froze in the middle of a prayer."],
      ["You", "My flame is flickering. I have to keep moving."],
    ],
    outro: [
      ["You", "The ice is cracking. The warmth is coming back."],
      ["Voice", "One vault is left. Its fires never went out. They went wrong."],
    ],
  },
  {
    id: 3,
    name: "The Ember Vault",
    blurb: "Fire that forgot what it was for.",
    theme: VAULT,
    tint: "lava",
    scale: { hp: 1.7, dmg: 1.5 },
    waves: [
      { n: 8, kinds: ["slime", "snake"] },
      { n: 10, kinds: ["snake", "wisp", "slime"] },
      { n: 12, kinds: ["snake", "wisp", "bat"] },
    ],
    boss: { type: "wisp", name: "The Cinder Wisp", hp: 1000, dmg: 20, speed: 40, tint: "blood", summon: { every: 8, kinds: ["wisp"], n: 2 } },
    reward: 300,
    intro: [
      ["Narrator", "The Ember Vault burns with a hungry red light. Nothing in it wants to be warm."],
      ["You", "Then I'll show it what a lantern is for."],
    ],
    outro: [
      ["Narrator", "The Cinder Wisp folds into your lantern, and the flame grows steady."],
      ["Narrator", "Far above, the great lamp turns once... and lights."],
      ["You", "Lanternfall is awake again."],
    ],
  },
];
