// Green's-function database (format RGF1, docs/data-format.md): index.json and one binary file per source point.
// File: "RGF1", uint16 version, nrec, ncomp, nel, uint32 npts, float32 scale[nrec*ncomp*nel],
// float16 data[nrec][ncomp][nel][npts]; value = data * scale; little endian.

// IEEE 754 half -> float
const HALF = (() => {
  const t = new Float32Array(65536);
  for (let h = 0; h < 65536; h++) {
    const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
    t[h] = e === 0 ? s * m * 2 ** -24 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * 2 ** (e - 15);
  }
  return t;
})();

export function parsePoint(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== "RGF1") throw new Error(`not an RGF1 file (${magic})`);
  const version = dv.getUint16(4, true), nrec = dv.getUint16(6, true), ncomp = dv.getUint16(8, true);
  const nel = dv.getUint16(10, true), npts = dv.getUint32(12, true), ntr = nrec * ncomp * nel;
  if (buf.byteLength !== 16 + 4 * ntr + 2 * ntr * npts) throw new Error("RGF1 file size does not match its header");
  const data = new Float32Array(ntr * npts);
  for (let i = 0; i < ntr; i++) {
    const s = dv.getFloat32(16 + 4 * i, true), o = 16 + 4 * ntr + 2 * i * npts;
    for (let j = 0; j < npts; j++) data[i * npts + j] = HALF[dv.getUint16(o + 2 * j, true)] * s;
  }
  return { version, nrec, ncomp, nel, npts, data };
}

export const pointUrl = (base, index, p) => `${base}${index.kinds[p.kind].folder}/${String(p.id).padStart(5, "0")}.bin`;

async function get(url, kind) {
  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error(`${url}: HTTP ${r.status}`), { status: r.status });
  return kind === "bin" ? r.arrayBuffer() : r.json();
}

export const loadIndex = base => get(`${base}index.json`);

// point record of index.points -> { ...parsePoint, elements }
export async function loadPoint(base, index, p) {
  const pt = parsePoint(await get(pointUrl(base, index, p), "bin"));
  const elements = index.kinds[p.kind].elements;
  if (pt.nrec !== index.receivers.length || pt.nel !== elements.length || pt.npts !== index.npts)
    throw new Error(`point ${p.kind}/${p.id} does not match index.json`);
  return { ...pt, elements };
}
