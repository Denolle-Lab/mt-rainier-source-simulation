import { describe, expect, it } from "vitest";
import fixture from "../test/fixture_synth.json";
import { FFT } from "./fft.js";
import { Synthesizer } from "./synth.js";
import { forceVector, mwToM0, scaleTensor, sdrToUse, tensorM0 } from "./source.js";
import { stfSpectrum } from "./stf.js";

const f32 = b64 => new Float32Array(Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer);
const relL2 = (a, b) => {
  let d = 0, n = 0;
  for (let i = 0; i < a.length; i++) { d += (a[i] - b[i]) ** 2; n += b[i] ** 2; }
  return Math.sqrt(d / n);
};

describe("FFT", () => {
  it("irfft(rfft(x)) = x", () => {
    const fft = new FFT(64), x = Float64Array.from({ length: 64 }, (_, i) => Math.sin(i * 0.3) + 0.1 * i);
    const re = new Float64Array(33), im = new Float64Array(33), y = new Float64Array(64);
    fft.rfft(x, re, im); fft.irfft(re, im, y);
    expect(relL2(y, x)).toBeLessThan(1e-12);
  });
  it("matches a direct DFT", () => {
    const n = 16, fft = new FFT(n), x = Float64Array.from({ length: n }, (_, i) => Math.cos(i) * i);
    const re = new Float64Array(9), im = new Float64Array(9);
    fft.rfft(x, re, im);
    for (let k = 0; k <= 8; k++) {
      let r = 0, s = 0;
      for (let j = 0; j < n; j++) { r += x[j] * Math.cos((2 * Math.PI * k * j) / n); s -= x[j] * Math.sin((2 * Math.PI * k * j) / n); }
      expect(re[k]).toBeCloseTo(r, 9); expect(im[k]).toBeCloseTo(s, 9);
    }
  });
});

describe("sources", () => {
  it("SDR -> USE matches the NumPy reference (Aki & Richards)", () => {
    const { sdr, mw, use } = fixture.sdr_check;
    const m = sdrToUse(...sdr, mwToM0(mw));
    m.forEach((v, i) => expect(Math.abs(v - use[i]) / Math.abs(use[0])).toBeLessThan(1e-12));
    expect(tensorM0(m) / mwToM0(mw)).toBeCloseTo(1, 12);
  });
  it("scales a tensor to the moment of Mw", () => {
    expect(tensorM0(scaleTensor([1, 1, 1, 0, 0, 0], 2)) / mwToM0(2)).toBeCloseTo(1, 12);
  });
  it("force vector: azimuth from north, plunge down", () => {
    const [e, n, z] = forceVector(2, 90, 30);
    expect(e).toBeCloseTo(Math.sqrt(3), 12); expect(n).toBeCloseTo(0, 12); expect(z).toBeCloseTo(-1, 12);
  });
  it("half-sine spectrum is continuous through w = pi / T", () => {
    const T = 0.5, f0 = 1 / (2 * T), s = stfSpectrum(Float64Array.from([f0 * (1 - 1e-7), f0, f0 * (1 + 1e-7)]), { kind: "halfsine", T });
    expect(s.re[0]).toBeCloseTo(s.re[1], 5); expect(s.im[0]).toBeCloseTo(s.im[1], 5); expect(s.im[2]).toBeCloseTo(s.im[1], 5);
    expect(stfSpectrum(Float64Array.from([0]), { kind: "halfsine", T }).re[0]).toBeCloseTo(1, 12);   // unit area
  });
});

describe("synthesis vs tools/reference_synth.py", () => {
  const { nrec, ncomp, nel, npts, dt, t0 } = fixture;
  const syn = new Synthesizer({ dt, npts, t0 });
  syn.setPoint({ nrec, ncomp, nel, npts, data: f32(fixture.g_b64) });
  for (const c of fixture.cases) {
    it(c.name, () => {
      const u = syn.run(c.weights, c.stf, c.output, c.band);
      expect(relL2(u, f32(c.expected_b64))).toBeLessThan(1e-5);
    });
  }
});
