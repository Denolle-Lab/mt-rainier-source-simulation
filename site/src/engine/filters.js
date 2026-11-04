// Zero-phase band gains in the frequency domain, defined as the analog Butterworth response run forward and
// backward (|H|^2): the same response at any sampling interval (the database's 10 Hz low-pass uses the same form).
export const lowpassGain = (f, fc, poles = 4) => 1 / (1 + (f / fc) ** (2 * poles));
export const highpassGain = (f, fc, poles = 4) => (f <= 0 ? 0 : 1 / (1 + (fc / f) ** (2 * poles)));

// gain of a band { fmin, fmax } (either may be null) at every frequency of f
export function bandGain(f, { fmin = null, fmax = null } = {}) {
  return Float64Array.from(f, x => (fmin ? highpassGain(x, fmin) : 1) * (fmax ? lowpassGain(x, fmax) : 1));
}
