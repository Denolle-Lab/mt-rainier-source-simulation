# Green's-function database format (RGF1)

The site reads one database: `index.json` and one binary file per source point, under a base URL from
`site/public/config.json` (relative to the site, or absolute on any HTTPS host that sends CORS headers).
Built by `scripts/build_web_db.py` in the research project (3D_MtR_Gf_simulation), not in this repository.

## index.json

| field | meaning |
|---|---|
| `format`, `version`, `db_id`, `description` | `"RGF1"`, 1, identifier, one line shown in the header |
| `dt`, `npts`, `t0` | sampling interval (s), samples per trace, time of the first sample after the origin (s) |
| `components` | `["Z", "N", "E"]` (up, north, east at the receiver) |
| `kinds` | per point kind: `elements` (order in the file) and `folder` (relative to the base URL) |
| `units` | moment-tensor elements `Mrr … Mtp`: m per N m for a step in moment (USE basis: r up, t south, p east); force elements `Fe, Fn, Fz`: m per N for a step force (east, north, up) |
| `f_lowpass_hz`, `lowpass` | zero-phase low-pass of the database: gain 1/(1+(f/fc)^8) in the frequency domain |
| `f_reliable_hz`, `reliability_note` | band where the 10 Hz mesh agrees with a 20 Hz mesh to a few percent |
| `receivers[]` | `net`, `sta`, `lat`, `lon`, `elev_m`, `kind` (`UWCC` or `Z5`); the order of the receivers in every file |
| `points[]` | `id`, `kind`, `lon`, `lat`, `elev_m` (asl), `burial_m` (below the mesh surface), optional `label`, `default` |
| `mesh` | SPECFEM domain: `corners_lonlat` (surface box), `xlim_km`, `ylim_km`, `bottom_km` |
| `provenance` | inputs, their sha256, script, date, largest float16 error |

## Point file `{folder}/{id:05d}.bin` (little endian)

| bytes | content |
|---|---|
| 0–3 | `RGF1` |
| 4–15 | uint16 version, uint16 nrec, uint16 ncomp, uint16 nel, uint32 npts |
| 16 … | float32 scale[nrec][ncomp][nel] (largest absolute value of each trace) |
| then | float16 data[nrec][ncomp][nel][npts]; value = data × scale |

Each trace is the step response of one element at one receiver component, on the time axis `t0 + k dt`.
Relative precision of float16: ~5e-4 of the trace peak.

## Synthesis (site/src/engine/synth.js, tools/reference_synth.py)

`u_c(t) = Σ_k w_k [G_ck ∗ ṡ](t)` with `w` the moment tensor (N m) or force (N) and `ṡ` the rate of the source time
function, computed as `irfft(Σ_k w_k Ĝ_ck · S(f) · (i2πf)^p · H(f))`. Each trace is padded to 2048 samples: its last
value held for `npts` samples, a 200-sample cosine taper to zero, then zeros.
