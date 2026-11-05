// Lanternfall: classes and skills. Every skill is a real pixelfx "move" (src/fx/moves/*), performed with createAct:
// the hero winds up, the effect plays, everything freezes on contact, the screen shakes, he recovers.
//
// The game adds only the numbers around it:
//   cd    seconds before it can be used again
//   dmg   damage dealt on EACH real hit of the move (a combo with three hits deals it three times)
//   zone  [from, to] in px ahead of the hero where enemies are hit (taken from the move's own target distance)
//   free  optional: seconds into the move when the hero gets control back (default: 0.6 s after the last real hit)
import { createAct, actSpan } from "./px.js";
import { GY } from "./world.js";

export const CLASSES = {
  warden: {
    name: "WARDEN", blurb: "Melee. Sword and stone.", hp: 150,
    skills: [
      { id: "sword-combo", path: "moves/sword-combo", name: "Sword combo", cd: 3, dmg: 14, zone: [-10, 150] },
      { id: "ground-pound", path: "moves/ground-pound", name: "Ground pound", cd: 6, dmg: 20, zone: [-120, 120] },
      { id: "earth-stomp", path: "moves/earth-stomp", name: "Earth stomp", cd: 5, dmg: 38, zone: [70, 160] },
    ],
  },
  emberist: {
    name: "EMBERIST", blurb: "Ranged. Fire and storm.", hp: 95,
    skills: [
      { id: "fireball-throw", path: "moves/fireball-throw", name: "Fireball", cd: 4, dmg: 40, zone: [150, 230] },
      { id: "meteor-call", path: "moves/meteor-call", name: "Meteor", cd: 12, dmg: 75, zone: [120, 225] },
      { id: "lightning-call", path: "moves/lightning-call", name: "Lightning", cd: 6, dmg: 16, zone: [90, 170] },
    ],
  },
  skulker: {
    name: "SKULKER", blurb: "Fast. Blade and pistol.", hp: 105,
    skills: [
      { id: "dash-strike", path: "moves/dash-strike", name: "Dash strike", cd: 5, dmg: 50, zone: [70, 215], free: 1.8 },
      { id: "pistol-shots", path: "moves/pistol-shots", name: "Pistol", cd: 2.5, dmg: 12, zone: [150, 215] },
    ],
  },
  arbalist: {
    name: "ARBALIST", blurb: "Ranged. Bow and rocket.", hp: 110,
    skills: [
      { id: "arrow-shot", path: "moves/arrow-shot", name: "Arrow", cd: 1.5, dmg: 28, zone: [140, 225] },
      { id: "rocket-launcher", path: "moves/rocket-launcher", name: "Rocket", cd: 7, dmg: 60, zone: [150, 250] },
    ],
  },
  lightkeeper: {
    name: "LIGHTKEEPER", blurb: "Light and frost.", hp: 115,
    skills: [
      { id: "holy-smite", path: "moves/holy-smite", name: "Holy smite", cd: 4, dmg: 40, zone: [85, 155] },
      { id: "ice-lance-throw", path: "moves/ice-lance-throw", name: "Ice lance", cd: 3.5, dmg: 34, zone: [130, 210] },
    ],
  },
};

// A hit counts when it lands on the target and does something. The moves also contain bookkeeping entries
// (target: false for the caster's own wind-up shake, or push 0 / straw 0 to reset the dummy at the end).
const isReal = (h) => h.target !== false && ((h.push ?? 1.2) !== 0 || (h.straw ?? 8) > 0);

/**
 * Start a skill at the player's feet, facing the way he faces. onDamage(run, hit) is called at the exact moment
 * of each real hit, so damage lands in sync with the effect (and after the hit-freeze, not before).
 */
export function startSkill(mod, skill, player, onDamage) {
  const dir = player.face < 0 ? -1 : 1, x = Math.round(player.x); // positions must be whole pixels
  const act = createAct(mod, { x, y: GY, flip: dir < 0 });
  const hits = mod.act?.hits ?? [];
  const lastReal = hits.filter(isReal).reduce((m, h) => Math.max(m, h.t), 0);
  const run = { act, skill, dir, x, freeAt: skill.free ?? lastReal + 0.6, free: false, to: actSpan(mod).to };
  act.onHit = (h) => {
    if (isReal(h)) onDamage(run, h);
  };
  return run;
}
