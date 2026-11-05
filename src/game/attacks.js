// Lanternfall: the basic attack (the normal attack that needs no cooldown skill).
// Every class gets one, built from a real pixelfx effect:
//   melee    sword-slash / claw-swipe played at the hero, damage in a short zone in front of him
//   shot     fireball / arrow, a loop effect that the game moves along the floor until it hits something
//   missile  magic-missile, which charges, weaves to its target and bursts (damage lands when it arrives)
// The hero's swing poses use the same pose fields as the pixelfx sword-slash and claw-swipe acts.
// This file is data plus tiny helpers. main.js decides when to attack and who gets hurt.
import { STAND, READY, createFx } from "./px.js";
import { GY, tintOpts } from "./world.js";

/**
 * cd      seconds between attacks
 * dur     how long the swing pose lasts
 * hitAt   seconds into the swing when the effect appears and the damage lands (shot: when it is fired)
 * dmg     base damage before the weapon bonus
 * zone    melee: [from, to] px in front of the hero
 * speed, range, height   shot: px/s, how far it flies, how high above the floor it flies
 * range, delay, height, tint   missile: how far it can find a target, how long until it arrives, hand height, recolour
 */
export const BASIC = {
  warden: { name: "Slash", kind: "melee", path: "melee/sword-slash", pose: "sword", cd: 0.55, dur: 0.46, hitAt: 0.09, dmg: 10, zone: [-6, 64] },
  skulker: { name: "Claws", kind: "melee", path: "melee/claw-swipe", pose: "claw", cd: 0.42, dur: 0.36, hitAt: 0.1, dmg: 7, zone: [-6, 54] },
  emberist: { name: "Flame bolt", kind: "shot", path: "fire/fireball", pose: "cast", cd: 0.75, dur: 0.34, hitAt: 0.1, dmg: 14, speed: 190, range: 240, height: 26, fxOpts: { speed: 190 } },
  arbalist: { name: "Shot", kind: "shot", path: "projectiles/arrow", pose: "aim", cd: 0.55, dur: 0.3, hitAt: 0.08, dmg: 11, speed: 320, range: 260, height: 24, fxOpts: {} },
  lightkeeper: { name: "Light bolt", kind: "missile", path: "projectiles/magic-missile", pose: "cast", cd: 0.95, dur: 0.34, hitAt: 0.1, dmg: 14, range: 150, delay: 0.82, height: 26, tint: "holy" },
};

// ---------------------------------------------------------------- swing poses
// Hand and foot fields as in pixelfx rig poses (y negative is up). No `x` here: the body stays where the game put it.
const BASE = { ...STAND, ...READY };
const SWORD = { ...BASE, weapon: "sword", fx: 12, fy: -21, sa: -0.85 };
const SWORD_WIND = { ...SWORD, crouch: 4, lean: -4, fx: -7, fy: -35, sa: -2.65, bx: 9, by: -25, armsFront: true, ffx: 9, fbx: -8 };
const SWORD_CUT = { ...SWORD, crouch: 2, lean: 3, fx: 16, fy: -37, sa: -1.45, bx: -7, by: -24, ffx: 11, fbx: -10 };
const SWORD_DOWN = { ...SWORD, crouch: 5, lean: 5, fx: 20, fy: -21, sa: 0.62, bx: -9, by: -24, ffx: 13, fbx: -10, toeB: true };

const CLAW = { ...BASE, weapon: "claw", offWeapon: "claw", sa: -0.4, sb: -0.9, crouch: 5, lean: 3, fx: 14, fy: -21, bx: 8, by: -25, ffx: 9, fbx: -8 };
const CLAW_HIGH = { ...CLAW, crouch: 4, lean: -3, fx: 3, fy: -41, sa: -1.4, bx: 7, by: -18, sb: -0.3, ffx: 10 };
const CLAW_RAKE = { ...CLAW, crouch: 3, lean: 4, fx: 19, fy: -36, sa: -0.9, bx: -7, by: -24 };
const CLAW_DOWN = { ...CLAW, crouch: 7, lean: 7, fx: 22, fy: -12, sa: 1.2, bx: -7, by: -24, ffx: 13, fbx: -10, toeB: true };

// the ranged poses are my own tuning: the front hand reaches out, the body leans in
const CAST_WIND = { ...BASE, lean: -2, crouch: 2, fx: 6, fy: -26, bx: 4, by: -22, ffx: 7, fbx: -7 };
const CAST = { ...BASE, lean: 3, crouch: 2, fx: 19, fy: -25, bx: 8, by: -24, ffx: 10, fbx: -9 };
const AIM = { ...BASE, lean: 2, crouch: 3, fx: 18, fy: -26, bx: 7, by: -25, ffx: 9, fbx: -8 };
const AIM_REC = { ...AIM, lean: 0, fx: 15 };

// [start time, pose]: each pose holds until the next one starts, like pixelfx's 12 fps held drawings
const SEQ = {
  sword: [[0, SWORD_WIND], [0.09, SWORD_CUT], [0.15, SWORD_DOWN], [0.34, SWORD]],
  claw: [[0, CLAW_HIGH], [0.1, CLAW_RAKE], [0.15, CLAW_DOWN], [0.3, CLAW]],
  cast: [[0, CAST_WIND], [0.1, CAST], [0.26, BASE]],
  aim: [[0, AIM], [0.1, AIM_REC], [0.22, BASE]],
};

/** The pose for a swing of this kind, t seconds in. */
export function attackPose(kind, t) {
  const seq = SEQ[kind] || SEQ.cast;
  let pose = seq[0][1];
  for (const [s, p] of seq) if (t >= s) pose = p;
  return pose;
}

// ---------------------------------------------------------------- effects the game creates
/** A melee swing effect at the hero's feet. */
export function spawnSwing(mod, x, dir) {
  return createFx(mod, { x: Math.round(x), y: GY, flip: dir < 0 });
}

/** A projectile that the game moves: { fx, x, dir, speed, left, dmg }. */
export function spawnShot(mod, b, x, dir) {
  const sx = Math.round(x + dir * 14);
  const fx = createFx(mod, { x: sx, y: GY - b.height, flip: dir < 0, ...(b.fxOpts || {}) });
  return { fx, x: sx, dir, speed: b.speed, left: b.range, dmg: b.dmg };
}

/** Move a shot. Returns false when it has flown its full range. */
export function moveShot(s, dt) {
  const d = s.speed * dt;
  s.x += s.dir * d;
  s.left -= d;
  s.fx.options.x = Math.round(s.x);
  s.fx.update(dt);
  return s.left > 0;
}

/** A magic missile that flies `reach` px from the hero's hand to its target. */
export function spawnMissile(mod, b, x, dir, reach) {
  return createFx(mod, { x: Math.round(x), y: GY, flip: dir < 0, height: b.height, reach: Math.max(40, Math.round(reach)), ...tintOpts(mod, b.tint, 0.75) });
}
