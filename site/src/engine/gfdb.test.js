import { describe, expect, it } from "vitest";
import { parsePoint } from "./gfdb.js";

// float -> IEEE half bits (round to nearest), enough for the test values
function toHalf(v) {
  const f = new Float32Array([v]), u = new Uint32Array(f.buffer)[0];
  const s = (u >> 16) & 0x8000, e = ((u >> 23) & 0xff) - 127 + 15, m = u & 0x7fffff;
  if (e <= 0) return s;
  return s | (e << 10) | Math.round(m / 8192);
}

function rgf1(nrec, ncomp, nel, npts, values, scales) {
  const ntr = nrec * ncomp * nel, buf = new ArrayBuffer(16 + 4 * ntr + 2 * ntr * npts), dv = new DataView(buf);
  "RGF1".split("").forEach((c, i) => dv.setUint8(i, c.charCodeAt(0)));
  dv.setUint16(4, 1, true); dv.setUint16(6, nrec, true); dv.setUint16(8, ncomp, true); dv.setUint16(10, nel, true); dv.setUint32(12, npts, true);
  scales.forEach((s, i) => dv.setFloat32(16 + 4 * i, s, true));
  values.forEach((v, i) => dv.setUint16(16 + 4 * ntr + 2 * i, toHalf(v), true));
  return buf;
}

describe("RGF1 point files", () => {
  it("decodes float16 values times the trace scale", () => {
    const buf = rgf1(1, 1, 2, 3, [0.5, -1, 0.25, 1, 0, -0.5], [2e-7, 4e-9]);
    const p = parsePoint(buf);
    expect([p.nrec, p.ncomp, p.nel, p.npts]).toEqual([1, 1, 2, 3]);
    const want = [1e-7, -2e-7, 0.5e-7, 4e-9, 0, -2e-9];
    want.forEach((w, i) => expect(Math.abs(p.data[i] - w)).toBeLessThanOrEqual(1e-6 * Math.abs(w)));   // float32 scale
  });
  it("rejects a file whose size does not match its header", () => {
    const buf = rgf1(1, 1, 1, 4, [1, 1, 1, 1], [1]);
    expect(() => parsePoint(buf.slice(0, buf.byteLength - 2))).toThrow(/size/);
  });
});
