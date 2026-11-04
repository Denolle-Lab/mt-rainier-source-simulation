// Collapsible table of the receivers: a column header sorts the rows; a checkbox turns a receiver's waveforms on or
// off in the record section. Dragging over the checkboxes sets a run of consecutive rows at once (to the flipped
// state of the first row), so a block of rows sorted by distance or network goes on or off in one stroke.
import { useEffect, useMemo, useRef, useState } from "react";
import { paintRange, sortRows, stationKey } from "../sim/stations.js";

const COLS = [["sta", "Station", ""], ["net", "Network", ""], ["dist", "Distance (km)", "num"]];
const EDGE = 18;   // px from the top or bottom of the table where a drag scrolls it

export function StationTable({ receivers, geo, off, setOff }) {
  const [sort, setSort] = useState({ key: "dist", dir: 1 });
  const rows = useMemo(() => sortRows(receivers.map((r, i) => ({ i, net: r.net, sta: r.sta, dist: geo[i].dist, key: stationKey(r) })),
    sort.key, sort.dir), [receivers, geo, sort]);
  const keys = useMemo(() => rows.map(r => r.key), [rows]);
  const nOn = keys.filter(k => !off.has(k)).length;
  const wrap = useRef(null), all = useRef(null), drag = useRef(null);

  useEffect(() => { if (all.current) all.current.indeterminate = nOn > 0 && nOn < keys.length; }, [nOn, keys]);

  // the drag: rows between the first one and the one under the pointer take the new state; the table scrolls when the
  // pointer is held near its top or bottom edge
  useEffect(() => {
    let raf = 0;
    const rowAt = d => {
      const r = wrap.current?.getBoundingClientRect(); if (!r) return null;
      const x = Math.min(r.right - 4, Math.max(r.left + 4, d.x)), y = Math.min(r.bottom - 4, Math.max(r.top + 4, d.y));
      const tr = document.elementFromPoint(x, y)?.closest("tr[data-k]");
      return tr ? Number(tr.dataset.k) : null;
    };
    const paint = d => { const k = rowAt(d); if (k != null && k !== d.k1) { d.k1 = k; setOff(paintRange(d.before, d.keys, d.k0, k, d.on)); } };
    const scroll = () => {
      const d = drag.current, el = wrap.current; raf = 0;
      if (!d || !el) return;
      const r = el.getBoundingClientRect(), v = d.y < r.top + EDGE ? d.y - r.top - EDGE : d.y > r.bottom - EDGE ? d.y - r.bottom + EDGE : 0;
      if (v) { el.scrollTop += Math.max(-20, Math.min(20, v / 2)); paint(d); }
      raf = requestAnimationFrame(scroll);
    };
    const move = e => { const d = drag.current; if (!d) return; d.x = e.clientX; d.y = e.clientY; paint(d); if (!raf) raf = requestAnimationFrame(scroll); };
    const end = () => { drag.current = null; cancelAnimationFrame(raf); raf = 0; };
    addEventListener("pointermove", move); addEventListener("pointerup", end); addEventListener("pointercancel", end);
    return () => { end(); removeEventListener("pointermove", move); removeEventListener("pointerup", end); removeEventListener("pointercancel", end); };
  }, [setOff]);

  const start = (e, k) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const d = (drag.current = { k0: k, k1: k, on: off.has(keys[k]), before: off, keys, x: e.clientX, y: e.clientY });
    setOff(paintRange(d.before, keys, k, k, d.on));
  };
  const setAll = on => setOff(paintRange(off, keys, 0, keys.length - 1, on));

  return (
    <section className="stations">
      <details>
        <summary><h2>Stations</h2><span className="count">{nOn} of {keys.length} shown</span></summary>
        <div className="stable" ref={wrap}>
          <table>
            <thead>
              <tr>
                <th className="chk"><input type="checkbox" ref={all} checked={nOn === keys.length} aria-label="All stations"
                  onChange={() => setAll(nOn < keys.length)} /></th>
                {COLS.map(([k, label, cls]) => (
                  <th key={k} className={cls} aria-sort={sort.key === k ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
                    <button type="button" className={sort.key === k ? "on" : ""}
                      onClick={() => setSort(s => ({ key: k, dir: s.key === k ? -s.dir : 1 }))}>
                      {label}{sort.key === k ? (sort.dir > 0 ? " ▲" : " ▼") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, k) => {
                const on = !off.has(r.key);
                return (
                  <tr key={r.key} data-k={k} className={on ? "" : "off"}>
                    <td className="chk" onPointerDown={e => start(e, k)}>
                      <input type="checkbox" checked={on} aria-label={`Show ${r.key}`}
                        onChange={() => setOff(paintRange(off, keys, k, k, !on))} />
                    </td>
                    <td>{r.sta}</td><td>{r.net}</td><td className="num">{r.dist.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hint">Drag over the checkboxes to turn several rows on or off.</p>
      </details>
    </section>
  );
}
