// Source and view state -> engine inputs, and small helpers for the display.
import { forceVector, mwToM0, scaleTensor, sdrToUse } from "../engine/source.js";
import { backAzimuth, distanceKm, neToRt } from "../engine/geodesy.js";

export const DEFAULT_SOURCE = {
  kind: "mt", mode: "sdr", strike: 165, dip: 44, rake: 65, mw: 1.62,
  tensor: [1, -1, 0, 0, 0, 0],
  force: { log10N: 9, az: 90, plunge: 30 },
};
export const DEFAULT_STF = { mt: { kind: "brune", fc: 4, T: 0.5 }, force: { kind: "pulse", fc: 1, T: 2 } };
export const DEFAULT_VIEW = { output: 1, band: { fmin: null, fmax: null }, comps: "ZNE", norm: "trace", anim: "Z" };

// engine source { kind, m | f } from the panel state
export function engineSource(s) {
  if (s.kind === "force") return { kind: "force", f: forceVector(10 ** s.force.log10N, s.force.az, s.force.plunge) };
  const m = s.mode === "sdr" ? sdrToUse(s.strike, s.dip, s.rake, mwToM0(s.mw)) : scaleTensor(s.tensor, s.mw);
  return { kind: "mt", m };
}

// elements of a point kind that a source kind can use
export const supports = (elements, kind) => elements.some(e => (kind === "mt" ? e.startsWith("M") : e.startsWith("F")));

// receivers with distance and back azimuth from a source point, and the order by distance
export function receiverGeometry(receivers, p) {
  const geo = receivers.map((r, i) => ({ i, dist: distanceKm(p.lat, p.lon, r.lat, r.lon), baz: backAzimuth(r, p),
    hyp: Math.hypot(distanceKm(p.lat, p.lon, r.lat, r.lon), (r.elev_m - p.elev_m) / 1000) }));
  return { geo, order: [...geo].sort((a, b) => a.dist - b.dist).map(g => g.i) };
}

// traces [nrec][3][npts] (Z, N, E) -> rotated to Z, R, T in place of N, E when comps = "ZRT"
export function rotateTraces(traces, nrec, npts, geo, comps) {
  if (comps !== "ZRT") return traces;
  const out = new Float32Array(traces);
  for (let r = 0; r < nrec; r++) {
    const o = r * 3 * npts, [rr, tt] = neToRt(traces.subarray(o + npts, o + 2 * npts), traces.subarray(o + 2 * npts, o + 3 * npts), geo[r].baz);
    out.set(rr, o + npts); out.set(tt, o + 2 * npts);
  }
  return out;
}

export const OUTPUT = [
  { key: 0, label: "Displacement", unit: "m" },
  { key: 1, label: "Velocity", unit: "m/s" },
  { key: 2, label: "Acceleration", unit: "m/s²" },
];

// value with an SI prefix: 3.2e-7 m -> "0.32 µm"
export function fmtSI(v, unit) {
  const a = Math.abs(v);
  if (!a) return `0 ${unit}`;
  const pre = [[1e-9, "n"], [1e-6, "µ"], [1e-3, "m"], [1, ""]];
  let [s, p] = pre[0];
  for (const [ss, pp] of pre) if (a >= ss) [s, p] = [ss, pp];
  const x = v / s;
  return `${Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2)} ${p}${unit}`;
}

// time tick spacing (s) for a window of span seconds drawn widthPx wide: the smallest of 0.1, 0.2, 0.5, 1, 2, 5, 10 s
// that leaves at least minPx between ticks
export function tickStep(span, widthPx, minPx = 24) {
  for (const s of [0.1, 0.2, 0.5, 1, 2, 5]) if ((s / span) * widthPx >= minPx) return s;
  return 10;
}

// tick times k * step inside [ta, tb]
export const ticks = (ta, tb, step) => {
  const out = [];
  for (let k = Math.ceil(ta / step - 1e-9); k * step <= tb + 1e-9; k++) out.push(Number((k * step).toFixed(1)));
  return out;
};
