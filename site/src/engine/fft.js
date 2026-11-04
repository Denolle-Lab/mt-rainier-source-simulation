// Radix-2 complex FFT (in place) and real-input transforms with numpy's sign convention:
// X[k] = sum_n x[n] exp(-2 pi i k n / N); irfft(rfft(x)) = x.
export class FFT {
  constructor(n) {
    if (n & (n - 1)) throw new Error(`FFT size ${n} is not a power of two`);
    this.n = n;
    this.rev = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float64Array(n / 2); this.sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) { this.cos[i] = Math.cos((2 * Math.PI * i) / n); this.sin[i] = Math.sin((2 * Math.PI * i) / n); }
    this.re = new Float64Array(n); this.im = new Float64Array(n);
  }

  // in place on (re, im); inverse = true uses exp(+...) without the 1/N factor
  transform(re, im, inverse = false) {
    const n = this.n, rev = this.rev, sgn = inverse ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0; k < half; k++) {
          const wr = this.cos[k * step], wi = sgn * this.sin[k * step];
          const a = start + k, b = a + half;
          const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
  }

  // real x (length <= n, zero-padded) -> (re, im) of the n/2 + 1 non-negative frequencies
  rfft(x, outRe, outIm) {
    const n = this.n, re = this.re, im = this.im;
    re.fill(0); im.fill(0);
    for (let i = 0; i < Math.min(n, x.length); i++) re[i] = x[i];
    this.transform(re, im, false);
    for (let k = 0; k <= n / 2; k++) { outRe[k] = re[k]; outIm[k] = im[k]; }
  }

  // (re, im) of the n/2 + 1 non-negative frequencies -> real samples out[0 .. out.length - 1]
  irfft(inRe, inIm, out) {
    const n = this.n, re = this.re, im = this.im, h = n / 2;
    for (let k = 0; k <= h; k++) { re[k] = inRe[k]; im[k] = inIm[k]; }
    for (let k = 1; k < h; k++) { re[n - k] = inRe[k]; im[n - k] = -inIm[k]; }
    im[0] = 0; im[h] = 0;
    this.transform(re, im, true);
    for (let i = 0; i < out.length; i++) out[i] = re[i] / n;
  }
}

export const rfftFreqs = (n, dt) => Float64Array.from({ length: n / 2 + 1 }, (_, k) => k / (n * dt));
