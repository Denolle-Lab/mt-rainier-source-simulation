// Station table helpers: keys that survive a database change, sorting, and turning a run of rows on or off at once.

export const stationKey = r => `${r.net}.${r.sta}`;

// rows: [{ i, net, sta, dist }]; key "sta" | "net" | "dist"; dir 1 | -1. Ties fall back to the distance.
export function sortRows(rows, key, dir) {
  const by = {
    sta: (a, b) => a.sta.localeCompare(b.sta, undefined, { numeric: true }),
    net: (a, b) => a.net.localeCompare(b.net),
    dist: (a, b) => a.dist - b.dist,
  }[key];
  return [...rows].sort((a, b) => dir * by(a, b) || a.dist - b.dist);
}

// the set of stations turned off after setting rows k0..k1 (either order) of the table to on (true) or off (false),
// starting from the set before the drag began
export function paintRange(offBefore, keys, k0, k1, on) {
  const off = new Set(offBefore);
  for (let k = Math.min(k0, k1); k <= Math.max(k0, k1); k++) (on ? off.delete(keys[k]) : off.add(keys[k]));
  return off;
}
