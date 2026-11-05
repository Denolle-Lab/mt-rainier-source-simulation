#!/usr/bin/env python
"""Smaller terrain files for the site (lossless heights, a narrower drape).

Reads the Seismic Atlas terrain folder (overview.bin: int16 heights in m, rows x cols; overview.jpg; terrain.json) and
writes to --out:
  overview_delta.bin  int16 row differences (column 0 holds the height itself), little endian; the browser undoes them
                      with a running sum per row. The same heights, but gzip (as served) packs them to ~60 %.
  overview.jpg        the drape resized to --image-width px (Lanczos), JPEG --quality, progressive
  terrain.json        the input's, with "heights": "overview_delta.bin", "encoding": "row-delta" and the new image size

  python tools/pack_terrain.py --src ATLAS_TERRAIN_DIR --out STAGE/scene/terrain
Needs numpy and Pillow.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--image-width", type=int, default=3060)
    ap.add_argument("--quality", type=int, default=82)
    a = ap.parse_args()

    meta = json.loads((a.src / "terrain.json").read_text())
    h = np.fromfile(a.src / "overview.bin", dtype="<i2").reshape(meta["rows"], meta["cols"])
    d = np.diff(h.astype(np.int32), axis=1, prepend=0)
    if np.abs(d).max() > 32767:
        raise SystemExit("row differences do not fit int16")
    d = d.astype("<i2")
    if not np.array_equal(np.cumsum(d.astype(np.int32), axis=1), h):
        raise SystemExit("row differences do not reproduce the heights")

    a.out.mkdir(parents=True, exist_ok=True)
    d.tofile(a.out / "overview_delta.bin")
    im = Image.open(a.src / "overview.jpg")
    w = min(a.image_width, im.size[0]); hgt = round(w * im.size[1] / im.size[0])
    im.convert("RGB").resize((w, hgt), Image.LANCZOS).save(a.out / "overview.jpg", "JPEG", quality=a.quality,
                                                            optimize=True, progressive=True)
    meta.update(heights="overview_delta.bin", encoding="row-delta", image={"width": w, "height": hgt})
    (a.out / "terrain.json").write_text(json.dumps(meta, indent=1))
    for f in ("overview_delta.bin", "overview.jpg"):
        print(f"{f}: {(a.out / f).stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
