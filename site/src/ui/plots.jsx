// Small canvas plots for the source panel: the source time function and the beachball (lower hemisphere).
import { useEffect, useRef } from "react";
import { stfTime } from "../engine/stf.js";

function useCanvas(draw, deps, w, h) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = devicePixelRatio || 1; c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
  }, deps);   // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} style={{ width: w, height: h }} />;
}

export function StfPlot({ stf, isForce, w = 300, h = 84 }) {
  return useCanvas((ctx, W, H) => {
    const tmax = stf.kind === "brune" ? Math.max(8 / (2 * Math.PI * stf.fc), 0.2) : stf.kind === "step" ? 1 : stf.T * 1.4;
    const n = 200, t = Array.from({ length: n }, (_, i) => -0.08 * tmax + (i / (n - 1)) * 1.08 * tmax);
    // force: show the force history F(t)/F0 (the step for brune: cumulative of the rate)
    let y = stfTime(t, stf);
    if (isForce && stf.kind === "brune") { let acc = 0; const dt = t[1] - t[0]; y = y.map(v => (acc += v * dt)); }
    if (stf.kind === "step") y = t.map(x => (x >= 0 ? 1 : 0));
    const ymax = Math.max(...y) || 1, L = 34, B = 18, pw = W - L - 6, ph = H - B - 6;
    ctx.strokeStyle = "#5a5a55"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, 4); ctx.lineTo(L, 4 + ph); ctx.lineTo(L + pw, 4 + ph); ctx.stroke();
    ctx.strokeStyle = "#e69f00"; ctx.lineWidth = 1.8; ctx.beginPath();
    t.forEach((x, i) => { const px = L + ((x - t[0]) / (t[n - 1] - t[0])) * pw, py = 4 + ph - (y[i] / ymax) * ph * 0.92; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.stroke();
    ctx.fillStyle = "#a8a59c"; ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(isForce ? "F(t)/F0" : "rate", 2, 12);
    ctx.fillText(`${tmax.toFixed(tmax < 1 ? 2 : 1)} s`, L + pw - 34, H - 4); ctx.fillText("0", L - 2, H - 4);
  }, [stf.kind, stf.fc, stf.T, isForce], w, h);
}

// lower-hemisphere equal-area projection of n^T M n > 0 (USE basis)
export function Beachball({ m, size = 84 }) {
  return useCanvas((ctx, W) => {
    const dpr = devicePixelRatio || 1, N = Math.round(W * dpr), img = ctx.createImageData(N, N), R = W / 2 - 1.5, c = W / 2;
    const s = Math.max(...m.map(Math.abs)) || 1, [rr, tt, pp, rt, rp, tp] = m.map(v => v / s);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = ((i + 0.5) / dpr - c) / R, y = ((j + 0.5) / dpr - c) / R, q = x * x + y * y;
      if (q > 1) continue;
      // equal area: r = sqrt(2) sin(theta/2), theta from down; x east, y south on screen (north up)
      const th = 2 * Math.asin(Math.sqrt(q / 2)), az = Math.atan2(x, -y);
      const e = Math.sin(th) * Math.sin(az), n = Math.sin(th) * Math.cos(az), u = -Math.cos(th);
      const r = u, t = -n, p = e;
      const v = rr * r * r + tt * t * t + pp * p * p + 2 * (rt * r * t + rp * r * p + tp * t * p), k = (j * N + i) * 4;
      const g = v > 0 ? 34 : 245; img.data[k] = g; img.data[k + 1] = g; img.data[k + 2] = g; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = "#a8a59c"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c, c, R, 0, 2 * Math.PI); ctx.stroke();
  }, [m.join(",")], size, size);
}
