// Site configuration (public/config.json) and the terrain bundle (scene/terrain/: Int16 heights in m, overview.jpg
// drape, terrain.json grid; from the Seismic Atlas data bundle by tools/pack_terrain.py). terrain.json names the
// heights file; with "encoding": "row-delta" it holds each row's differences (column 0: the height).
import { loadIndex } from "../engine/gfdb.js";

const BASE = import.meta.env.BASE_URL;
const abs = u => (/^https?:\/\//.test(u) ? u : `${BASE}${u}`);

async function get(url, kind) {
  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error(`${url}: HTTP ${r.status}`), { status: r.status });
  return kind === "bin" ? r.arrayBuffer() : r.json();
}

export async function loadConfig() {
  const c = await get(`${BASE}config.json`);
  return { ...c, scene: abs(c.scene), databases: c.databases.map(d => ({ ...d, url: abs(d.url) })) };
}

// row differences -> heights, in place
export function undoRowDelta(h, cols) {
  for (let i = 0; i < h.length; i += cols) for (let c = 1; c < cols; c++) h[i + c] += h[i + c - 1];
  return h;
}

export async function loadTerrain(sceneBase) {
  const meta = await get(`${sceneBase}terrain/terrain.json`);
  const heights = new Int16Array(await get(`${sceneBase}terrain/${meta.heights ?? "overview.bin"}`, "bin"));
  if (meta.encoding === "row-delta") undoRowDelta(heights, meta.cols);
  return { meta, heights, imageUrl: `${sceneBase}terrain/overview.jpg` };
}

export async function loadDatabase(db) {
  const index = await loadIndex(db.url);
  return { ...db, index };
}
