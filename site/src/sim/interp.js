// Interpolation between receivers for the surface color field: inverse-distance weights from the cells of a regular
// grid to their nearest receivers, computed once per database; per frame the field is a weighted sum.

// rx, rz: receiver positions (km); grid { x0, z0, w, h, n } (n x n cells, row j along z, cell index j * n + i);
// k nearest receivers within maxKm (the nearest always), weights 1 / d^power normalized. fade: 1 within maxKm / 2 of
// the nearest receiver, smoothly 0 at maxKm (no color far from every receiver).
export function idwWeights(rx, rz, grid, k = 6, maxKm = 3, power = 2) {
  const { x0, z0, w: W, h: H, n } = grid, nr = rx.length, nc = n * n;
  const idx = new Int32Array(nc * k).fill(-1), wt = new Float32Array(nc * k), fade = new Float32Array(nc);
  const bd = new Float64Array(k), bi = new Int32Array(k);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i + 0.5) / n) * W, z = z0 + ((j + 0.5) / n) * H, c = j * n + i;
      bd.fill(Infinity); bi.fill(-1);
      for (let r = 0; r < nr; r++) {   // keep the k nearest, sorted
        const d = (rx[r] - x) ** 2 + (rz[r] - z) ** 2;
        if (d >= bd[k - 1]) continue;
        let m = k - 1;
        while (m > 0 && bd[m - 1] > d) { bd[m] = bd[m - 1]; bi[m] = bi[m - 1]; m--; }
        bd[m] = d; bi[m] = r;
      }
      const dmin = Math.sqrt(bd[0]);
      const t = Math.min(1, Math.max(0, (maxKm - dmin) / (0.5 * maxKm)));
      fade[c] = t * t * (3 - 2 * t);
      if (bi[0] < 0) continue;
      if (dmin < 1e-6) { idx[c * k] = bi[0]; wt[c * k] = 1; continue; }
      let s = 0;
      for (let m = 0; m < k; m++) {
        if (bi[m] < 0 || (m > 0 && Math.sqrt(bd[m]) > maxKm)) break;
        const v = 1 / Math.sqrt(bd[m]) ** power;
        idx[c * k + m] = bi[m]; wt[c * k + m] = v; s += v;
      }
      for (let m = 0; m < k && idx[c * k + m] >= 0; m++) wt[c * k + m] /= s;
    }
  }
  return { idx, wt, fade, k };
}

// cell values = weighted receiver values; out Float32Array(n * n)
export function applyWeights(vals, { idx, wt, k }, out) {
  for (let c = 0; c < out.length; c++) {
    let s = 0;
    for (let m = 0; m < k; m++) { const r = idx[c * k + m]; if (r < 0) break; s += wt[c * k + m] * vals[r]; }
    out[c] = s;
  }
  return out;
}
