#!/bin/bash
# Pack the site's data bundle (not in git) for a GitHub release: the terrain (from the Mount Rainier Seismic Atlas
# data bundle: overview.bin, overview.jpg, terrain.json; made smaller by tools/pack_terrain.py, so run this inside a
# Python environment with numpy and Pillow) and the Green's-function databases named in site/public/config.json
# (folders built by build_web_db.py in the research project).
# usage: make_site_data.sh TERRAIN_DIR GFDB_ROOT OUT.tar.gz
#   TERRAIN_DIR  folder with overview.bin, overview.jpg, terrain.json
#   GFDB_ROOT    folder holding one subfolder per database id
set -euo pipefail
TERRAIN=$1; GFDB=$2; OUT=$(realpath -m "$3")
HERE=$(dirname "$(realpath "$0")")
STAGE=$(mktemp -d); trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/scene/terrain" "$STAGE/gfdb"
python "$HERE/pack_terrain.py" --src "$TERRAIN" --out "$STAGE/scene/terrain"
for id in $(grep -o '"id": *"[^"]*"' "$HERE/../site/public/config.json" | cut -d '"' -f 4); do
  cp -r "$GFDB/$id" "$STAGE/gfdb/$id"
done
tar czf "$OUT" -C "$STAGE" scene gfdb
echo "$OUT: $(du -h "$OUT" | cut -f 1)"; tar tzf "$OUT" | awk -F/ '{print $1 "/" $2}' | sort | uniq -c
