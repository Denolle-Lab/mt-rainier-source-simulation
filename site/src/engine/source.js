// Source descriptions -> weights of the Green's-function elements.
// Moment tensors in the USE basis (r up, t south, p east; MTUQ and GCMT convention), N m.
// Forces as (Fe, Fn, Fz up), N.

const D2R = Math.PI / 180;

export const mwToM0 = mw => 10 ** (1.5 * mw + 9.1);
export const m0ToMw = m0 => (Math.log10(m0) - 9.1) / 1.5;

// Strike, dip, rake (degrees, Aki & Richards convention) and M0 -> [Mrr, Mtt, Mpp, Mrt, Mrp, Mtp].
export function sdrToUse(strike, dip, rake, m0 = 1) {
  const s = strike * D2R, d = dip * D2R, r = rake * D2R;
  const sd = Math.sin(d), cd = Math.cos(d), s2d = Math.sin(2 * d), c2d = Math.cos(2 * d);
  const sr = Math.sin(r), cr = Math.cos(r), ss = Math.sin(s), cs = Math.cos(s), s2s = Math.sin(2 * s), c2s = Math.cos(2 * s);
  // Aki & Richards box 4.4: x north, y east, z down
  const mxx = -(sd * cr * s2s + s2d * sr * ss * ss);
  const mxy = sd * cr * c2s + 0.5 * s2d * sr * s2s;
  const mxz = -(cd * cr * cs + c2d * sr * ss);
  const myy = sd * cr * s2s - s2d * sr * cs * cs;
  const myz = -(cd * cr * ss - c2d * sr * cs);
  const mzz = s2d * sr;
  return [mzz, mxx, myy, mxz, -myz, -mxy].map(v => v * m0);
}

// Scalar moment of a tensor (Silver & Jordan): ||M||_F / sqrt(2).
export function tensorM0(m) {
  const [rr, tt, pp, rt, rp, tp] = m;
  return Math.sqrt((rr * rr + tt * tt + pp * pp + 2 * (rt * rt + rp * rp + tp * tp)) / 2);
}

// Six components in any units (ratios) scaled to the moment of magnitude mw.
export function scaleTensor(m, mw) {
  const m0 = tensorM0(m);
  return m0 > 0 ? m.map(v => (v * mwToM0(mw)) / m0) : m.map(() => 0);
}

// Force of magnitude f (N) toward azimuth az (degrees clockwise from north), plunging plunge degrees below the
// horizontal (negative = upward) -> [Fe, Fn, Fz up].
export function forceVector(f, az, plunge) {
  const a = az * D2R, p = plunge * D2R;
  return [f * Math.cos(p) * Math.sin(a), f * Math.cos(p) * Math.cos(a), -f * Math.sin(p)];
}

// Weights for a point file's elements (names from index.json) from a source { kind: "mt", m: [6] } or
// { kind: "force", f: [3] }; elements the source does not use get weight 0.
export function elementWeights(elements, src) {
  const names = src.kind === "mt" ? ["Mrr", "Mtt", "Mpp", "Mrt", "Mrp", "Mtp"] : ["Fe", "Fn", "Fz"];
  const vals = src.kind === "mt" ? src.m : src.f;
  return elements.map(e => { const i = names.indexOf(e); return i < 0 ? 0 : vals[i]; });
}
