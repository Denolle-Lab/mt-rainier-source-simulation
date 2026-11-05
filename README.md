# Mount Rainier Source Simulator

Synthetic seismograms at the seismic stations on and around Mount Rainier for a source you place on the 3D
mountain: a moment tensor below the surface or a force on it, with a source time function of your choice. The
waveforms are computed in the browser from a precomputed database of 3D Green's functions.

**Status:** under development (November 2026). Live demo: https://denolle-lab.github.io/mt-rainier-source-simulation/
with two databases at all 114 receivers: the reciprocity database for the current tests (moment tensors at the
source points below the surface within 1 km of the epicenter of PNSN event 62134192, all depths; forces at the
surface points within 2 km of the summit) and the forward check database (five depths below that epicenter). The
simulations cover every source point; the site carries this part of them. A third database, **GF comparison**, holds the
hypocenter of that event in three velocity models (rainier3d products-v1.0.0 regional without soil, the one of the
other databases; products-v1.1.0 regional without soil; products-v1.1.0 fused): their waveforms are drawn over each
other, and their Vp and Vs can be explored on sections below ground.

## How it works

- **Green's functions.** SPECFEM3D Cartesian spectral-element simulations in a 28 × 28 km, 10 Hz mesh of the
  summit region (topography, 3D velocity model), with reciprocity: one point-force simulation per receiver
  component gives the response at every source point. Receivers are the 114 UW, CC and Z5 seismometers within
  12 km of the summit. Source points are a 1 km grid below the surface and a 250 m grid on the surface.
- **Synthesis.** For the chosen source point the browser downloads one file (the step responses of the six
  moment-tensor elements, or of the three force components on the surface, at all receivers) and combines them
  with the source and the source time function in the frequency domain.
- **Display.** The source and the receivers' ground motion are shown on a 3D rendering of the mountain, with the
  waveforms as a record section.

## Layout

```text
site/     React + Vite + three.js web application
tools/    Python helpers: scene bundle (terrain, receivers, source grid), NumPy reference synthesis
docs/     data format of the Green's-function database, validation
```

## Build and test

```sh
cd site
npm ci && npm test                     # engine unit tests (against tools/reference_synth.py) and scene helpers
tar xzf site-data.tar.gz -C public     # data bundle from the release named in DATA_RELEASE (not in git)
npm run dev                            # http://127.0.0.1:5180/mt-rainier-source-simulation/
npm run build && npx playwright test   # end-to-end check and screenshots (test-results/screens/)
```

The data bundle is packed by `tools/make_site_data.sh` and uploaded as the release asset `site-data.tar.gz`; pushing to
`main` builds the site with it and deploys to GitHub Pages (`.github/workflows/pages.yml`).

## License

BSD 3-Clause (see `LICENSE`). Code adapted from the Mount Rainier Seismic Atlas viewer
([Denolle-Lab/mt-rainier-digital-model](https://github.com/Denolle-Lab/mt-rainier-digital-model), `web/viewer`,
MIT, Derek Yao) keeps its notice; see `THIRD_PARTY_NOTICES.md`.
