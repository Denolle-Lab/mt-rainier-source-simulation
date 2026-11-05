import { useEffect, useMemo, useRef, useState } from "react";
import { loadConfig, loadDatabase, loadTerrain } from "./data/bundle.js";
import { loadPoint } from "./engine/gfdb.js";
import { elementWeights } from "./engine/source.js";
import { Synthesizer } from "./engine/synth.js";
import { SimScene } from "./scene/SimScene.js";
import { SurfaceField } from "./scene/field.js";
import { VelocityVolume } from "./scene/velocityVolume.js";
import { toX, toZ } from "./scene/geo.js";
import { Receivers, SourceGlyph, SourceGrid, domainBox, missingReceivers } from "./scene/overlays.js";
import { Clock } from "./sim/clock.js";
import { DEFAULT_SOURCE, DEFAULT_STF, DEFAULT_VIEW, OUTPUT, engineSource, fmtSI, receiverGeometry, rotateTraces, supports } from "./sim/model.js";
import { PointSet } from "./sim/points.js";
import { stationKey } from "./sim/stations.js";
import { SourcePanel } from "./ui/SourcePanel.jsx";
import { TimeRange, Timeline } from "./ui/Timeline.jsx";
import { Waveforms } from "./ui/Waveforms.jsx";
import { Help } from "./ui/Help.jsx";

export default function App() {
  const [err, setErr] = useState(null), [config, setConfig] = useState(null);
  const [db, setDb] = useState(null), [terrain, setTerrain] = useState(null);
  const [pointIdx, setPointIdx] = useState(null), [point, setPoint] = useState(null), [loading, setLoading] = useState(true);
  const [src, setSrc] = useState(DEFAULT_SOURCE), [stf, setStf] = useState(DEFAULT_STF), [view, setView] = useState(DEFAULT_VIEW);
  const [selected, setSelected] = useState(null), [sceneReady, setSceneReady] = useState(false), [help, setHelp] = useState(false);
  const [see, setSee] = useState(0), [click, setClick] = useState(null);
  const [win, setWin] = useState(null), [off, setOff] = useState(() => new Set());   // time window (null: all); stations turned off
  const [surface, setSurface] = useState("off"), [peakMax, setPeakMax] = useState(null);   // surface color field: off | motion | peak
  const [pointIdxB, setPointIdxB] = useState(null), [pointB, setPointB] = useState(null), [volume, setVolume] = useState(null);   // GF comparison
  const canvasRef = useRef(null), sceneRef = useRef(null), ovRef = useRef(null), labelRef = useRef(null), selRef = useRef(null), volRef = useRef(null);
  const clock = useMemo(() => new Clock(), []);
  const ps = useMemo(() => (db ? new PointSet(db.index.points) : null), [db]);

  const openDb = d => loadDatabase(d).then(x => {
    setSelected(null); setClick(null); setPoint(null); setPointB(null); setDb(x);
    setPointIdx(Math.max(0, x.index.points.findIndex(p => p.default)));
    setPointIdxB(x.index.mode === "compare" ? Math.min(1, x.index.points.length - 1) : null);
  });
  useEffect(() => {
    loadConfig().then(async c => {
      setConfig(c);
      const [t] = await Promise.all([loadTerrain(c.scene), openDb(c.databases[0])]);
      setTerrain(t);
    }).catch(setErr);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // the scene (terrain, navigation) once
  useEffect(() => {
    if (!terrain) return undefined;
    let sc = null, gone = false;
    SimScene.create(canvasRef.current, terrain).then(s => {
      if (gone) { s.dispose(); return; }
      sc = sceneRef.current = s;
      s.beforeRender = (_, now) => {
        clock.tick(now); volRef.current?.update();
        const el = labelRef.current, i = selRef.current, ov = ovRef.current;
        if (el) {
          if (i == null || !ov) el.style.display = "none";
          else { const [x, y, z] = ov.rec.pos[i], [px, py, d] = s.project(x, y + 0.35, z); el.style.display = d < 1 ? "block" : "none"; el.style.transform = `translate(${px}px, ${py}px)`; }
        }
      };
      setSceneReady(true);
    }).catch(setErr);
    return () => { gone = true; sc?.dispose(); setSceneReady(false); };
  }, [terrain, clock]);

  // overlays of the database: domain box, receivers (and the ones not computed yet), source grid, source
  useEffect(() => {
    if (!sceneReady || !db) return undefined;
    const s = sceneRef.current, elev = (x, z) => s.elevKm(x, z);
    const rec = new Receivers(db.index.receivers, elev), glyph = new SourceGlyph(), grid = new SourceGrid(ps, elev);
    const field = new SurfaceField(s.U, db.index.receivers); window.__field = field;   // test hook (e2e)
    const objs = [domainBox(db.index.mesh, elev), rec.group, glyph.group, grid.group];
    if (db.index.receivers_missing?.length) objs.push(missingReceivers(db.index.receivers_missing, elev));
    s.overlays.add(...objs);
    ovRef.current = { rec, glyph, grid, field };
    return () => { s.overlays.remove(...objs); field.dispose(); ovRef.current = null; };
  }, [sceneReady, db, ps]);

  // GF comparison: the velocity models' volumes below ground
  useEffect(() => {
    if (!sceneReady || !db?.index.volume) return undefined;
    const v = (volRef.current = new VelocityVolume(sceneRef.current, db.index.volume, db.url)); setVolume(v);
    window.__vol = v;   // test hook (e2e)
    return () => { v.dispose(); volRef.current = null; setVolume(null); };
  }, [sceneReady, db]);

  // GF comparison: model B, the second point of the same location
  useEffect(() => {
    if (!db || pointIdxB == null) return;
    loadPoint(db.url, db.index, db.index.points[pointIdxB]).then(pt => {
      const syn = new Synthesizer(db.index); syn.setPoint(pt); setPointB({ p: db.index.points[pointIdxB], pt, syn });
    }).catch(setErr);
  }, [db, pointIdxB]);

  // source point: download and transform once
  useEffect(() => {
    if (!db || pointIdx == null) return;
    const p = db.index.points[pointIdx];
    setLoading(true);
    loadPoint(db.url, db.index, p).then(pt => {
      const syn = new Synthesizer(db.index); syn.setPoint(pt);
      setPoint({ p, pt, syn });
      setSrc(s => (supports(pt.elements, s.kind) ? s : { ...s, kind: s.kind === "mt" ? "force" : "mt" }));
    }).catch(setErr).finally(() => setLoading(false));
  }, [db, pointIdx]);

  const npts = db?.index.npts, t0 = db?.index.t0, dt = db?.index.dt;
  const result = useMemo(() => {
    if (!point || !supports(point.pt.elements, src.kind)) return null;
    const es = engineSource(src), w = elementWeights(point.pt.elements, es);
    const tr = point.syn.run(w, stf[src.kind], view.output, view.band);
    const { geo, order } = receiverGeometry(db.index.receivers, point.p), nrec = db.index.receivers.length;
    const b = db.index.mode === "compare" && pointB ? pointB.syn.run(w, stf[src.kind], view.output, view.band) : null;
    return { es, geo, order, traces: rotateTraces(tr, nrec, npts, geo, view.comps), tracesB: b && rotateTraces(b, nrec, npts, geo, view.comps) };
  }, [point, pointB, src, stf, view, db, npts]);

  // time window of the record section and the playback: the whole record until the slider moves
  const tEnd = t0 + (npts - 1) * dt, [ta, tb] = win ?? [t0, tEnd];
  useEffect(() => setWin(null), [t0, npts, dt]);
  useEffect(() => { if (db) clock.setRange(ta, tb); }, [db, clock, ta, tb]);
  const shown = useMemo(() => (result ? result.order.filter(r => !off.has(stationKey(db.index.receivers[r]))) : []), [result, off, db]);

  // source glyph and the grid shown for picking (surface grid, or the level of a point below the surface)
  const mode = point?.p.kind === "surf" ? "surface" : "below";
  const compare = db?.index.mode === "compare";
  useEffect(() => {
    if (!sceneReady || !ovRef.current || !point) return;
    const p = point.p;
    if (result) ovRef.current.glyph.set(p, sceneRef.current.elevKm(toX(p.lon), toZ(p.lat)), result.es);
    ovRef.current.grid.show(mode, p.elev_m);
  }, [sceneReady, result, point, mode, db]);

  // receivers follow the playback time: vertical (Z) motion, each receiver scaled by its own peak in the time window
  // ("Each trace") or all by the largest peak with a square-root amplitude ("Common scale"); the surface field
  // ("motion") interpolates the same values between the receivers
  useEffect(() => {
    if (!sceneReady || !result || !ovRef.current) return undefined;
    const { rec, field } = ovRef.current, move = surface === "motion", nrec = db.index.receivers.length, tr = result.traces, vals = new Float32Array(nrec);
    const peak = new Float32Array(nrec), i0 = Math.max(0, Math.round((ta - t0) / dt)), i1 = Math.min(npts - 1, Math.round((tb - t0) / dt));
    for (let r = 0; r < nrec; r++) for (let i = i0; i <= i1; i++) peak[r] = Math.max(peak[r], Math.abs(tr[r * 3 * npts + i]));
    const gmax = Math.max(...peak), common = view.norm === "common";
    const f = c => {
      const i = Math.round((c.t - t0) / dt);
      if (i < 0 || i >= npts || !gmax) { rec.setValues(null); if (move) field.motion(null); return; }
      for (let r = 0; r < nrec; r++) {
        const v = tr[r * 3 * npts + i] / (common ? gmax : peak[r] || 1);
        vals[r] = common ? Math.sign(v) * Math.sqrt(Math.abs(v)) : v;
      }
      rec.setValues(vals);
      if (move) field.motion(vals);
    };
    f(clock); return clock.on(f);
  }, [sceneReady, result, clock, db, npts, t0, dt, view.norm, ta, tb, surface]);

  // peak map: largest three-component amplitude in the time window per receiver, log scale over two decades below the
  // largest, interpolated between the receivers
  useEffect(() => {
    const field = ovRef.current?.field;
    if (!sceneReady || !field) return;
    if (surface === "off") field.hide();
    if (surface !== "peak" || !result) { setPeakMax(null); return; }
    const nrec = db.index.receivers.length, tr = result.traces, pk = new Float32Array(nrec);
    const i0 = Math.max(0, Math.round((ta - t0) / dt)), i1 = Math.min(npts - 1, Math.round((tb - t0) / dt));
    for (let r = 0; r < nrec; r++) {
      const o = r * 3 * npts;
      for (let i = i0; i <= i1; i++) pk[r] = Math.max(pk[r], Math.hypot(tr[o + i], tr[o + npts + i], tr[o + 2 * npts + i]));
    }
    const m = Math.max(...pk);
    field.peak(m ? pk.map(p => Math.min(1, Math.max(0, (Math.log10(Math.max(p, 1e-30) / m) + 2) / 2))) : null);
    setPeakMax(m);
  }, [sceneReady, result, surface, db, npts, t0, dt, ta, tb]);

  useEffect(() => { selRef.current = selected; ovRef.current?.rec.select(selected); }, [selected, sceneReady, db]);
  useEffect(() => { sceneRef.current?.setSeeThrough(see); }, [see, sceneReady]);

  // location: the nearest surface point, or the nearest point on a level below the surface
  const pickLocation = (m, x, z, levelM) => {
    const i = m === "surface" ? ps.nearestSurface(x, z) : ps.nearestAtLevel(x, z, levelM);
    if (i == null) return;
    setClick({ x, z, offset: ps.offsetKm(i, x, z) }); setPointIdx(i);
  };
  const setMode = m => { if (point) pickLocation(m, ps.x[pointIdx], ps.z[pointIdx], m === "below" ? (point.p.kind === "surf" ? ps.levels[0] : point.p.elev_m) : null); };
  const setLevel = levelM => { if (point) pickLocation("below", click?.x ?? ps.x[pointIdx], click?.z ?? ps.z[pointIdx], levelM); };

  // click (not drag) on the scene: a receiver selects it, the ground moves the source
  const down = useRef(null);
  const onPointerDown = e => { down.current = [e.clientX, e.clientY]; };
  const onPointerUp = e => {
    const d = down.current; down.current = null;
    if (!d || Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 4 || !sceneRef.current || !point) return;
    if (e.target !== canvasRef.current) return;
    const hit = sceneRef.current.pickAt(e.clientX, e.clientY);
    if (hit?.type === "receiver") { setSelected(hit.index); return; }
    const g = sceneRef.current.groundAt(e.clientX, e.clientY);
    if (g && !compare) pickLocation(mode, g.x, g.z, point.p.elev_m);
  };

  if (err) return <div className="fatal"><h1>Mount Rainier Source Simulator</h1><p>Could not load: {String(err.message ?? err)}</p></div>;
  const out = OUTPUT[view.output];
  return (
    <div className="app">
      <header>
        <h1>Mount Rainier Source Simulator</h1>
        {config && config.databases.length > 1 && (
          <select className="dbsel" aria-label="Database" value={db?.id ?? ""}
            onChange={e => openDb(config.databases.find(d => d.id === e.target.value)).catch(setErr)}>
            {config.databases.map(d => <option key={d.id} value={d.id}>{d.label ?? d.id}</option>)}
          </select>
        )}
        <span className="dbinfo">{db ? db.index.description : "Loading…"}</span>
        <button type="button" className="helpbtn" onClick={() => setHelp(h => !h)} aria-expanded={help}>?</button>
      </header>
      <main className="stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <canvas ref={canvasRef} aria-label="3D view of Mount Rainier with the source and the receivers" />
        <div ref={labelRef} className="slabel">{selected != null && db ? `${db.index.receivers[selected].net}.${db.index.receivers[selected].sta}` : ""}</div>
        <div className="legend">
          <span><i className="dot uw" /> UW / CC</span><span><i className="dot z5" /> Z5</span>
          {db?.index.receivers_missing?.length > 0 && <span><i className="dot miss" /> not computed yet ({db.index.receivers_missing.length})</span>}
          {surface === "peak" ? (
            <span><i className="cbar" /> peak {out.label.toLowerCase()}, 1 % to {peakMax ? fmtSI(peakMax, out.unit) : "…"} (log)</span>
          ) : <span><i className="bar" /> vertical {out.label.toLowerCase()} (up red, down blue)</span>}
          {compare && point && pointB ? (
            <><span><i className="line la" /> A: {point.p.label}</span><span><i className="line lb" /> B: {pointB.p.label}</span></>
          ) : <span><i className={`dot ${mode === "surface" ? "gsurf" : "gsub"}`} /> source points{mode === "below" ? " on this level" : ""}</span>}
          <span className="ctrls">
            <label>Ground <input type="range" min={0} max={90} value={see} onChange={e => setSee(Number(e.target.value))} aria-label="See-through ground" /></label>
            <label>Surface <select value={surface} onChange={e => setSurface(e.target.value)} aria-label="Surface color">
              <option value="motion">motion</option><option value="peak">peak</option><option value="off">off</option>
            </select>{surface !== "off" && <span className="interp"> interpolated between receivers</span>}</label>
            {db && <TimeRange min={t0} max={tEnd} step={dt} value={[ta, tb]} onChange={setWin} />}
          </span>
        </div>
        {(loading || !sceneReady) && <div className="busy">Loading…</div>}
        <Timeline clock={clock} />
        {help && <Help onClose={() => setHelp(false)} index={db?.index} />}
      </main>
      {db && point && (
        <SourcePanel db={db} ps={ps} pointIdx={pointIdx} setPointIdx={i => { setClick(null); setPointIdx(i); }} mode={mode}
          setMode={setMode} setLevel={setLevel} click={click} geo={result?.geo} off={off} setOff={setOff}
          src={src} setSrc={setSrc} stf={stf} setStf={setStf} view={view} setView={setView}
          pointIdxB={pointIdxB} setPointIdxB={setPointIdxB} volume={volume} scene={sceneRef.current} />
      )}
      <footer>
        {result && (
          <Waveforms traces={result.traces} tracesB={result.tracesB} npts={npts} t0={t0} dt={dt} order={shown} geo={result.geo} win={[ta, tb]}
            receivers={db.index.receivers} comps={view.comps.split("")} norm={view.norm} unit={out.unit}
            clock={clock} selected={selected} onSelect={setSelected} />
        )}
      </footer>
    </div>
  );
}
