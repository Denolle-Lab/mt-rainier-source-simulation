// Source time functions as analytic spectra (numpy sign convention, exp(-2 pi i f t)), so no sampling of the
// STF is needed. The Green's functions are step responses, so the spectrum used is that of the rate:
//   moment tensor: normalized moment rate (area 1), times M0 in the weights;
//   force: rate of the force history F(t) / F0, times F0 in the weights.
//
//   step       F or M is a step at t = 0                        S = 1
//   brune      rate omega_c^2 t exp(-omega_c t), omega_c = 2 pi fc  S = 1 / (1 + i f / fc)^2   (a smooth step)
//   halfsine   moment rate (pi / 2T) sin(pi t / T), 0 <= t <= T     S = (pi / 2T) P(f)
//   pulse      force history sin(pi t / T), 0 <= t <= T (peak F0)  S = i 2 pi f P(f)
// with P(f) = a (1 + exp(-i w T)) / (a^2 - w^2), a = pi / T, w = 2 pi f (P(a) = -i T / 2).

function halfSine(w, T) {
  const a = Math.PI / T;
  if (Math.abs(w - a) < 1e-9 * a) return [0, -T / 2];
  const c = Math.cos(w * T), s = Math.sin(w * T), den = a * a - w * w;
  return [(a * (1 + c)) / den, (-a * s) / den];
}

// f: frequencies (Hz) -> { re, im } spectra of the chosen STF
export function stfSpectrum(f, stf) {
  const n = f.length, re = new Float64Array(n), im = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const w = 2 * Math.PI * f[k];
    if (stf.kind === "step") { re[k] = 1; }
    else if (stf.kind === "brune") {
      const x = f[k] / stf.fc;   // 1 / (1 + i x)^2 = (1 - x^2 - 2 i x) / (1 + x^2)^2
      const d = (1 + x * x) ** 2; re[k] = (1 - x * x) / d; im[k] = (-2 * x) / d;
    } else if (stf.kind === "halfsine") {
      const [pr, pi] = halfSine(w, stf.T), g = Math.PI / (2 * stf.T); re[k] = g * pr; im[k] = g * pi;
    } else if (stf.kind === "pulse") {
      const [pr, pi] = halfSine(w, stf.T); re[k] = -w * pi; im[k] = w * pr;   // i w P
    } else throw new Error(`unknown STF ${stf.kind}`);
  }
  return { re, im };
}

// The time function itself for the panel plot: rate (MT) or force history (force), on t (s).
export function stfTime(t, stf) {
  return t.map(x => {
    if (x < 0) return 0;
    if (stf.kind === "step") return 1;
    if (stf.kind === "brune") { const wc = 2 * Math.PI * stf.fc; return wc * wc * x * Math.exp(-wc * x); }
    if (stf.kind === "halfsine") return x <= stf.T ? (Math.PI / (2 * stf.T)) * Math.sin((Math.PI * x) / stf.T) : 0;
    if (stf.kind === "pulse") return x <= stf.T ? Math.sin((Math.PI * x) / stf.T) : 0;
    return 0;
  });
}
