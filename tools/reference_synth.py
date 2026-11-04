#!/usr/bin/env python
"""NumPy reference of the browser synthesis (site/src/engine/synth.js, stf.js, filters.js, source.js).

  python tools/reference_synth.py fixture --out site/src/test/fixture_synth.json
      writes a test fixture: a small random set of step responses (seeded) and the expected waveforms for a few
      sources, STFs, outputs and bands; site/src/engine/synth.test.js checks the JS engine against it.
  python tools/reference_synth.py point FILE.bin --sdr 165 44 65 --mw 1.62 [--stf brune --fc 2] ...
      synthesizes the waveforms of one RGF1 point file (prints the peak per receiver component).

Needs only numpy.
"""
import argparse
import base64
import json
import struct
from pathlib import Path

import numpy as np

NFFT, TAPER = 2048, 200
MIJ = ["Mrr", "Mtt", "Mpp", "Mrt", "Mrp", "Mtp"]


def read_point(path):
    b = Path(path).read_bytes()
    assert b[:4] == b"RGF1"
    _, nrec, ncomp, nel, npts = struct.unpack("<HHHHI", b[4:16])
    ntr = nrec * ncomp * nel
    scale = np.frombuffer(b, "<f4", ntr, 16).reshape(nrec, ncomp, nel)
    q = np.frombuffer(b, "<f2", ntr * npts, 16 + 4 * ntr).reshape(nrec, ncomp, nel, npts)
    return q.astype(np.float32) * scale[..., None]


def sdr_to_use(strike, dip, rake, m0=1.0):
    s, d, r = np.radians([strike, dip, rake])
    mxx = -(np.sin(d) * np.cos(r) * np.sin(2 * s) + np.sin(2 * d) * np.sin(r) * np.sin(s) ** 2)
    mxy = np.sin(d) * np.cos(r) * np.cos(2 * s) + 0.5 * np.sin(2 * d) * np.sin(r) * np.sin(2 * s)
    mxz = -(np.cos(d) * np.cos(r) * np.cos(s) + np.cos(2 * d) * np.sin(r) * np.sin(s))
    myy = np.sin(d) * np.cos(r) * np.sin(2 * s) - np.sin(2 * d) * np.sin(r) * np.cos(s) ** 2
    myz = -(np.cos(d) * np.cos(r) * np.sin(s) - np.cos(2 * d) * np.sin(r) * np.cos(s))
    mzz = np.sin(2 * d) * np.sin(r)
    return m0 * np.array([mzz, mxx, myy, mxz, -myz, -mxy])


def mw_to_m0(mw):
    return 10 ** (1.5 * mw + 9.1)


def stf_spectrum(f, stf):
    w = 2 * np.pi * f
    if stf["kind"] == "step":
        return np.ones_like(f, complex)
    if stf["kind"] == "brune":
        return 1 / (1 + 1j * f / stf["fc"]) ** 2
    T = stf["T"]
    a = np.pi / T
    with np.errstate(divide="ignore", invalid="ignore"):
        p = a * (1 + np.exp(-1j * w * T)) / (a ** 2 - w ** 2)
    p = np.where(np.abs(w - a) < 1e-9 * a, -0.5j * T, p)
    if stf["kind"] == "halfsine":
        return np.pi / (2 * T) * p
    if stf["kind"] == "pulse":
        return 1j * w * p
    raise ValueError(stf["kind"])


def band_gain(f, fmin=None, fmax=None):
    g = np.ones_like(f)
    if fmax:
        g = g / (1 + (f / fmax) ** 8)
    if fmin:
        with np.errstate(divide="ignore"):
            g = g * np.where(f > 0, 1 / (1 + (fmin / np.where(f > 0, f, 1)) ** 8), 0.0)
    return g


def pad(x):
    """[..., npts] -> [..., NFFT]: the record, its last value held for npts samples, a cosine taper, zeros."""
    n = x.shape[-1]
    out = np.zeros(x.shape[:-1] + (NFFT,))
    out[..., :n] = x
    out[..., n:2 * n] = x[..., -1:]
    i = np.arange(TAPER)
    out[..., 2 * n:2 * n + TAPER] = x[..., -1:] * 0.5 * (1 + np.cos(np.pi * (i + 1) / (TAPER + 1)))
    return out


def synth(g, weights, dt, stf, output=0, band=None):
    """g [nrec, ncomp, nel, npts], weights [nel] -> [nrec, ncomp, npts]"""
    npts = g.shape[-1]
    f = np.fft.rfftfreq(NFFT, dt)
    G = np.fft.rfft(pad(np.asarray(g, float)), NFFT)
    U = np.einsum("rcek,e->rck", G, np.asarray(weights, float))
    U = U * stf_spectrum(f, stf) * (2j * np.pi * f) ** output * band_gain(f, **(band or {}))
    return np.fft.irfft(U, NFFT)[..., :npts]


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a, "<f4").tobytes()).decode()


def fixture(out):
    rng = np.random.default_rng(20261103)
    nrec, ncomp, nel, npts, dt = 2, 3, 9, 680, 0.025
    t = -1.0 + dt * np.arange(npts)
    g = np.zeros((nrec, ncomp, nel, npts))
    for idx in np.ndindex(nrec, ncomp, nel):      # step response: an arrival, a damped wavetrain, a static offset
        t1 = rng.uniform(0.5, 4)
        on = t > t1
        g[idx] = on * (rng.normal() * np.exp(-(t - t1) / rng.uniform(0.3, 2)) * np.sin(2 * np.pi * rng.uniform(0.5, 6) * (t - t1))
                       + rng.normal() * (1 - np.exp(-(t - t1) / 0.2)))
    g = g.astype(np.float32)
    m = sdr_to_use(165, 44, 65, mw_to_m0(1.62))
    cases = [
        {"name": "mt brune disp", "weights": list(m) + [0, 0, 0], "stf": {"kind": "brune", "fc": 2.0}, "output": 0, "band": {}},
        {"name": "mt halfsine vel band", "weights": list(m) + [0, 0, 0], "stf": {"kind": "halfsine", "T": 0.4}, "output": 1,
         "band": {"fmin": 0.5, "fmax": 5.0}},
        {"name": "force pulse acc", "weights": [0] * 6 + [1e9, -2e9, 5e8], "stf": {"kind": "pulse", "T": 3.0}, "output": 2,
         "band": {"fmax": 8.0}},
        {"name": "mt step disp", "weights": list(m) + [0, 0, 0], "stf": {"kind": "step"}, "output": 0, "band": {}},
    ]
    for c in cases:
        u = synth(g, c["weights"], dt, c["stf"], c["output"], c["band"])
        c["expected_b64"] = b64(u)
        c["peak"] = float(np.abs(u).max())
    data = {"nrec": nrec, "ncomp": ncomp, "nel": nel, "npts": npts, "dt": dt, "t0": -1.0, "g_b64": b64(g),
            "sdr_check": {"sdr": [165, 44, 65], "mw": 1.62, "use": list(m)}, "cases": cases}
    Path(out).write_text(json.dumps(data))
    print(f"wrote {out} ({Path(out).stat().st_size / 1e3:.0f} kB), {len(cases)} cases")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    fx = sub.add_parser("fixture")
    fx.add_argument("--out", type=Path, required=True)
    pt = sub.add_parser("point")
    pt.add_argument("file", type=Path)
    pt.add_argument("--dt", type=float, default=0.025)
    pt.add_argument("--sdr", type=float, nargs=3, default=[165, 44, 65])
    pt.add_argument("--mw", type=float, default=1.62)
    pt.add_argument("--stf", default="step")
    pt.add_argument("--fc", type=float, default=2.0)
    pt.add_argument("--T", type=float, default=0.5)
    pt.add_argument("--output", type=int, default=0)
    args = ap.parse_args()
    if args.cmd == "fixture":
        fixture(args.out)
    else:
        g = read_point(args.file)
        w = list(sdr_to_use(*args.sdr, mw_to_m0(args.mw))) + [0] * (g.shape[2] - 6)
        u = synth(g, w, args.dt, {"kind": args.stf, "fc": args.fc, "T": args.T}, args.output)
        print(np.abs(u).max(axis=-1))


if __name__ == "__main__":
    main()
