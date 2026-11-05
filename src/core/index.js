// pixelfx core: everything an effect imports comes from here.
// NOTE (lanternfall): trimmed from upstream. The exports for scene.js, act.js, rig.js, poses.js and chain.js
// are removed because those files are not copied into this repo yet. Add them back when they are.

export * from "./math.js";
export * from "./color.js";
export * from "./particles.js";
export * from "./shapes.js";
export { Particles, Bits, Lights, Blazes, P, PF, B, GRAVITY, FIRE_RAMP, SMOKE_RAMP, sparkle, flare, band, crystal } from "./sim.js";
export { Painter } from "./painter.js";
export { FONTS, textWidth } from "./font.js";
export { createFrame, clearFrame, createFx, composite, painterFor, resolveOptions } from "./fx.js";
export { stockActor, drawActor, actorAlphaOf, HERO, HERO2, HERO_PAL, DUMMY_PAL } from "./actor.js";
