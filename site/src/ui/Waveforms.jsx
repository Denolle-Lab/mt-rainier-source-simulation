// Record section of the receivers turned on (rows by epicentral distance, one column per component) and the selected
// receiver's three components, in the chosen time window; a time cursor follows the playback clock.
import { useEffect, useRef, useState } from "react";
import { fmtSI, tickStep, ticks } from "../sim/model.js";

const COL = { uw: "#ece9e1", z5: "#56b4e9", sel: "#f0e442", axis: "#6b6a64", text: "#b7b4aa" };
const L = 58, T = 18, B = 38, GAP = 12;

function useSize(ref) {
  const [s, setS] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setS({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(ref.current); return () => ro.disconnect();
  }, [ref]);
  return s;
}

// narrow screens (phones): record section only
function layout(w, h, nrow) {
  const narrow = w < 640, detailW = narrow ? 0 : Math.max(220, Math.min(380, w * 0.3)), secW = narrow ? w : w - detailW - GAP;
  const colW = (secW - L - 2 * GAP) / 3, rowH = (h - T - B) / Math.max(1, nrow);
  return { narrow, detailW, secW, colW, rowH, x0: c => L + c * (colW + GAP), dx0: secW + GAP + 40, dW: detailW - 48 };
}

// order: receivers shown, top to bottom; win: [start, end] of the time window (s)
export function Waveforms({ traces, npts, t0, dt, order, geo, receivers, comps, norm, unit, clock, selected, onSelect, win }) {
  const box = useRef(null), base = useRef(null), cur = useRef(null), { w, h } = useSize(box);
  const nrec = receivers.length, nrow = order.length, [ta, tb] = win;
  const [hover, setHover] = useState(null);
  const sel = selected ?? order[0];

  useEffect(() => {
    const c = base.current; if (!c || !w || !h || !traces) return;
    const dpr = devicePixelRatio || 1; c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const g = layout(w, h, nrow), tx = (t, x0, ww) => x0 + ((t - ta) / (tb - ta)) * ww;
    const i0 = Math.max(0, Math.ceil((ta - t0) / dt - 1e-6)), i1 = Math.min(npts - 1, Math.floor((tb - t0) / dt + 1e-6));
    const peak = new Float32Array(nrec);
    for (let r = 0; r < nrec; r++) {
      let m = 0;
      for (let c3 = 0; c3 < 3; c3++) for (let i = (r * 3 + c3) * npts + i0; i <= (r * 3 + c3) * npts + i1; i++) m = Math.max(m, Math.abs(traces[i]));
      peak[r] = m;
    }
    const gmax = Math.max(0, ...order.map(r => peak[r])) || 1;
    const line = (o, x0, ww, yc, s) => {
      for (let i = i0; i <= i1; i++) { const x = tx(t0 + i * dt, x0, ww), y = yc - traces[o + i] * s; i > i0 ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    };
    ctx.font = "11px system-ui, sans-serif"; ctx.textBaseline = "middle";
    // record section
    const tks = ticks(ta, tb, tickStep(tb - ta, g.colW));
    for (let c3 = 0; c3 < 3; c3++) {
      const x0 = g.x0(c3);
      ctx.fillStyle = COL.text; ctx.textAlign = "center"; ctx.fillText(comps[c3], x0 + g.colW / 2, 8);
      ctx.strokeStyle = COL.axis; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, h - B); ctx.lineTo(x0 + g.colW, h - B); ctx.stroke();
      for (const tk of tks) {
        const x = tx(tk, x0, g.colW); ctx.beginPath(); ctx.moveTo(x, h - B); ctx.lineTo(x, h - B + 4); ctx.stroke();
        ctx.fillText(String(tk), x, h - B + 12);
      }
      order.forEach((r, k) => {
        const yc = T + (k + 0.5) * g.rowH, s = Math.min(g.rowH * 1.6, 0.45 * g.rowH + 14) / (norm === "trace" ? peak[r] || 1 : gmax);
        ctx.strokeStyle = r === sel ? COL.sel : receivers[r].kind === "Z5" ? COL.z5 : COL.uw;
        ctx.lineWidth = r === sel ? 1.4 : 0.7; ctx.beginPath();
        line((r * 3 + c3) * npts, x0, g.colW, yc, s);
        ctx.stroke();
      });
    }
    ctx.fillStyle = COL.text; ctx.textAlign = "center";
    ctx.fillText("Time after origin (s)", L + (g.secW - L) / 2, h - 6);
    ctx.textAlign = "right";
    const every = Math.max(1, Math.ceil(16 / g.rowH));
    order.forEach((r, k) => { if (k % every === 0) ctx.fillText(`${geo[r].dist.toFixed(1)} km`, L - 6, T + (k + 0.5) * g.rowH); });
    if (g.narrow || sel == null) return;
    // selected receiver
    const x0 = g.dx0, dH = (h - T - B) / 3, pk = Math.max(peak[sel], 1e-300);
    ctx.textAlign = "left"; ctx.fillStyle = COL.sel;
    const rec = receivers[sel];
    ctx.fillText(`${rec.net}.${rec.sta}  ${geo[sel].dist.toFixed(1)} km, baz ${geo[sel].baz.toFixed(0)}°`, x0 - 36, 8);
    for (let c3 = 0; c3 < 3; c3++) {
      const yc = T + (c3 + 0.5) * dH, o = (sel * 3 + c3) * npts;
      let m = 0; for (let i = i0; i <= i1; i++) m = Math.max(m, Math.abs(traces[o + i]));
      ctx.strokeStyle = COL.axis; ctx.beginPath(); ctx.moveTo(x0, yc); ctx.lineTo(x0 + g.dW, yc); ctx.stroke();
      ctx.strokeStyle = COL.uw; ctx.lineWidth = 1.1; ctx.beginPath();
      line(o, x0, g.dW, yc, (dH * 0.45) / pk);
      ctx.stroke();
      ctx.fillStyle = COL.text; ctx.textAlign = "right"; ctx.fillText(comps[c3], x0 - 6, yc);
      ctx.textAlign = "left"; ctx.fillText(`peak ${fmtSI(m, unit)}`, x0 + 4, yc - dH * 0.42);
    }
    ctx.strokeStyle = COL.axis; ctx.beginPath(); ctx.moveTo(x0, h - B); ctx.lineTo(x0 + g.dW, h - B); ctx.stroke();
    ctx.textAlign = "center"; ctx.fillStyle = COL.text;
    for (const tk of ticks(ta, tb, tickStep(tb - ta, g.dW, 40))) ctx.fillText(String(tk), tx(tk, x0, g.dW), h - B + 12);
    ctx.fillText("Time (s)", x0 + g.dW / 2, h - 6);
  }, [traces, w, h, order, norm, sel, comps, unit, ta, tb]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const draw = c => {
      const k = cur.current; if (!k || !w || !h) return;
      const dpr = devicePixelRatio || 1; if (k.width !== w * dpr) { k.width = w * dpr; k.height = h * dpr; }
      const ctx = k.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const g = layout(w, h, nrow), f = (c.t - ta) / (tb - ta);
      ctx.strokeStyle = "rgba(230, 159, 0, 0.9)"; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let c3 = 0; c3 < 3; c3++) { const x = g.x0(c3) + f * g.colW; ctx.moveTo(x, T); ctx.lineTo(x, h - B); }
      if (!g.narrow) { const x = g.dx0 + f * g.dW; ctx.moveTo(x, T); ctx.lineTo(x, h - B); }
      ctx.stroke();
    };
    draw(clock); return clock.on(draw);
  }, [clock, w, h, ta, tb, nrow]);

  const rowAt = e => {
    const rect = base.current.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top, g = layout(w, h, nrow);
    if (!nrow || x < L || x > g.secW || y < T || y > h - B) return null;
    return order[Math.min(nrow - 1, Math.floor((y - T) / g.rowH))];
  };
  return (
    <div className="waves" ref={box} onMouseMove={e => setHover(rowAt(e))} onMouseLeave={() => setHover(null)}
      onClick={e => { const r = rowAt(e); if (r != null) onSelect(r); }}>
      <canvas ref={base} style={{ width: w, height: h }} />
      <canvas ref={cur} className="cursor" style={{ width: w, height: h }} />
      {hover != null && <div className="tip">{receivers[hover].net}.{receivers[hover].sta} · {geo[hover].dist.toFixed(1)} km</div>}
    </div>
  );
}
