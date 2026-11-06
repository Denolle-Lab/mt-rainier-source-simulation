# Third-party notices

This repository's code is under the BSD 3-Clause license in `LICENSE`. The components and data below keep their own terms.

## Code adapted from the Mount Rainier Seismic Atlas viewer

Files under `site/src/scene/` and `site/src/ui/` marked "Adapted from the Mount Rainier Seismic Atlas viewer" come from
[Denolle-Lab/mt-rainier-digital-model](https://github.com/Denolle-Lab/mt-rainier-digital-model) `web/viewer/site/src/`
(originally [yaoderek/rainier-seismic-atlas](https://github.com/yaoderek/rainier-seismic-atlas)) under this license:

```text
MIT License

Copyright (c) 2026 Derek Yao

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Data (not in git; built into the site at deploy time)

| Data | Source | Terms |
|---|---|---|
| Elevation and aerial imagery of the terrain | USGS 3D Elevation Program, USGS The National Map (via the Seismic Atlas data bundle) | Public domain (U.S. Government work). Credit: U.S. Geological Survey. |
| Station metadata | EarthScope FDSN station service; networks UW (PNSN), CC (USGS CVO), Z5 | Openly available metadata. Credit the networks and EarthScope when reusing. |

## Components

| Component | Terms |
|---|---|
| three.js (npm `three`) | MIT, Copyright © 2010–2024 three.js authors |
| React, React DOM | MIT, Copyright © Meta Platforms, Inc. and affiliates |
| Scientific color maps roma and vik (`site/src/scene/crameri.js`, data from cmcrameri 1.10; Crameri 2018, doi:10.5281/zenodo.1243862) | MIT, Copyright (c) 2020 Fabio Crameri |
