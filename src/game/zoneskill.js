// Lanternfall: skills built from ONE pixelfx effect that has no `act` (for example fire/flame-pillar).
// createAct cannot play those, so this file plays the effect itself and schedules the damage.
// It is pure: it never touches the game state (G). combat.js decides who gets hurt, run.js updates and draws.
//
// A zone skill is a skill (same fields as skills.js: id, path, name, cd, dmg, zone) plus:
//   kind     "zone"
//   at       px ahead of the hero where the effect appears
//   half     half of the width of the hit area around that point (the game adds each enemy's half-width on top)
//   hits     [[seconds into the effect, damage multiplier], ...]  one entry per damage tick
//   push     optional knockback strength for each tick (default 0.3, so enemies mostly stay in the area)
//   pose     optional hero pose from attacks.js ("cast" by default), castTime how long it lasts (0.4 s by default)
//   fxOpts   optional pixelfx options for the effect (for example { height: 140 })
import { createFx } from "./px.js";
import { GY } from "./world.js";

export const isZoneSkill = (s) => !!s && s.kind === "zone";

/** The value for player.atk while he casts: attack.js ends it at `dur`, and `fired: true` stops it firing a basic attack. */
export function zoneCast(s) {
  const pose = s.pose || "cast";
  return { b: { pose, dur: s.castTime ?? 0.4, hitAt: 99 }, pose, t: 0, fired: true, tx: 0 };
}

/** Start the effect `at` px ahead of the hero. Positions are whole pixels. */
export function spawnZone(mod, skill, player) {
  const dir = player.face < 0 ? -1 : 1;
  const x = Math.round(player.x + dir * skill.at);
  const fx = createFx(mod, { x, y: GY, flip: dir < 0, ...(skill.fxOpts || {}) });
  return { fx, skill, x, dir, t: 0, next: 0 };
}

/** Advance the effect and call onHit(zone, multiplier) for each damage tick that is now due. */
export function stepZone(z, dt, onHit) {
  z.t += dt;
  z.fx.update(dt);
  const hs = z.skill.hits;
  while (z.next < hs.length && z.t >= hs[z.next][0]) {
    onHit(z, hs[z.next][1]);
    z.next++;
  }
}
