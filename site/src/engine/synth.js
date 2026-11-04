// Waveform synthesis from one source point's step responses (gfdb.js), in the frequency domain:
//   U_c(f) = sum_k w_k G_ck(f) * S(f) * (i 2 pi f)^p * H(f),   u_c = irfft(U_c)[0 .. npts)
// G are padded before the FFT: the last value is held for npts samples (a step response ends on its static
// offset), then a cosine taper of TAPER samples to zero, then zeros, so the circular transform does not fold the
// end of the record onto its start. Same algorithm as tools/reference_synth.py.
import { FFT, rfftFreqs } from "./fft.js";
import { stfSpectrum } from "./stf.js";
import { bandGain } from "./filters.js";

export const NFFT = 2048, TAPER = 200;

export function padTrace(x, out) {
  const n = x.length, last = x[n - 1];
  out.fill(0);
  out.set(x, 0);
  for (let i = n; i < 2 * n; i++) out[i] = last;
  for (let i = 0; i < TAPER; i++) out[2 * n + i] = last * 0.5 * (1 + Math.cos((Math.PI * (i + 1)) / (TAPER + 1)));
  return out;
}

export class Synthesizer {
  constructor({ dt, npts, t0 }) {
    if (2 * npts + TAPER > NFFT) throw new Error("record too long for NFFT");
    this.dt = dt; this.npts = npts; this.t0 = t0;
    this.fft = new FFT(NFFT); this.f = rfftFreqs(NFFT, dt); this.nf = this.f.length;
    this.spec = null;
  }

  // point: { nrec, ncomp, nel, npts, data } -> spectra of every trace (done once per source point)
  setPoint(point) {
    const { nrec, ncomp, nel, npts, data } = point, nf = this.nf, ntr = nrec * ncomp * nel;
    if (npts !== this.npts) throw new Error("point npts differs from the database");
    const re = new Float32Array(ntr * nf), im = new Float32Array(ntr * nf);
    const pad = new Float64Array(NFFT), r = new Float64Array(nf), i = new Float64Array(nf);
    for (let t = 0; t < ntr; t++) {
      padTrace(data.subarray(t * npts, (t + 1) * npts), pad);
      this.fft.rfft(pad, r, i);
      re.set(r, t * nf); im.set(i, t * nf);
    }
    this.spec = { re, im, nrec, ncomp, nel };
  }

  // weights [nel], stf { kind, fc, T }, output 0 disp / 1 vel / 2 acc, band { fmin, fmax }
  // -> Float32Array [nrec][ncomp][npts]
  run(weights, stf, output = 0, band = {}) {
    const { re, im, nrec, ncomp, nel } = this.spec, nf = this.nf, npts = this.npts, f = this.f;
    const s = stfSpectrum(f, stf), h = bandGain(f, band);
    // common factor C(f) = S(f) (i 2 pi f)^p H(f)
    const cr = new Float64Array(nf), ci = new Float64Array(nf);
    for (let k = 0; k < nf; k++) {
      let ar = s.re[k] * h[k], ai = s.im[k] * h[k];
      for (let p = 0; p < output; p++) { const w = 2 * Math.PI * f[k]; const t = -ai * w; ai = ar * w; ar = t; }
      cr[k] = ar; ci[k] = ai;
    }
    const out = new Float32Array(nrec * ncomp * npts), ur = new Float64Array(nf), ui = new Float64Array(nf), u = new Float64Array(npts);
    for (let rc = 0; rc < nrec * ncomp; rc++) {
      ur.fill(0); ui.fill(0);
      for (let e = 0; e < nel; e++) {
        const w = weights[e];
        if (!w) continue;
        const o = (rc * nel + e) * nf;
        for (let k = 0; k < nf; k++) { ur[k] += w * re[o + k]; ui[k] += w * im[o + k]; }
      }
      for (let k = 0; k < nf; k++) { const a = ur[k], b = ui[k]; ur[k] = a * cr[k] - b * ci[k]; ui[k] = a * ci[k] + b * cr[k]; }
      this.fft.irfft(ur, ui, u);
      out.set(u, rc * npts);
    }
    return out;
  }

  times() { return Float64Array.from({ length: this.npts }, (_, i) => this.t0 + i * this.dt); }
}
