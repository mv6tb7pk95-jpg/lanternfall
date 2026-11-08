// Lanternfall: the class the player chose for co-op and for the nametags (one answer for the whole game).
//   myClass()       a valid class key, always. Saved choice first, then the class of the last run, then "warden".
//   chooseClass(k)  saves the choice (localStorage, through net.js) and tells the party room and the hub channel.
//   classOf(k)      the CLASSES entry for a key, or null. Safe for keys that arrive over the network.
import { G } from "./state.js";
import { CLASSES } from "./skills.js";
import { getCls, setCls, sendClass } from "./net.js";

const has = (k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(CLASSES, k);

export const classOf = (k) => (has(k) ? CLASSES[k] : null);

let cur = null; // cached, so the per-frame callers do not read localStorage every time

export function myClass() {
  if (cur && has(cur)) return cur;
  const saved = getCls();
  cur = has(saved) ? saved : has(G.key) ? G.key : "warden";
  if (cur !== saved) setCls(cur); // the first answer is stored, so the choice stays the same from now on
  return cur;
}

export function chooseClass(k) {
  if (!has(k)) return myClass();
  cur = k;
  setCls(k);
  sendClass(k);
  return k;
}
