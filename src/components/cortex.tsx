'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MoveUpRight, Pause, Play, RefreshCw, RotateCcw } from 'lucide-react';
import { marketSignalPosition, marketSignalStrength, takeUnseenRecentSignals } from '@/lib/cortical-signal';
import type { DecodedSurfaceFrames } from '@/lib/surface-frames';
import type { MeshData, PredictionResult, Tick } from '@/lib/types';

type MarketSignal = { id: string; side: 'buy' | 'sell'; started: number; position: [number, number, number]; strength: number };
type VisualMode = 'schematic' | 'market-input' | 'model-output';
type FrameReadout = { state: 'static' | 'playing' | 'held' | 'reduced'; from: number; to: number; count: number; time: number };
type FramePair = { from: number; to: number; mix: number; time: number };
type ModelRuntime = {
  color: THREE.BufferAttribute;
  colors: Float32Array;
  frames: DecodedSurfaceFrames | null;
  startedAt: number;
  replaying: boolean;
  lastPaintAt: number;
  lastReadoutAt: number;
  lastReadoutKey: string;
};
type CortexEngine = {
  install: (result: PredictionResult | null, mesh: MeshData | null, frames: DecodedSurfaceFrames | null) => void;
  replay: () => void;
  nudgeCamera: (key: string) => void;
  schedule: () => void;
  setReduced: (value: boolean) => void;
};

const MODEL_COLOR_LIMIT = 2;
const ZERO_COLOR = new THREE.Color('#252b35');
const POSITIVE_COLOR = new THREE.Color('#67d9ff');
const NEGATIVE_COLOR = new THREE.Color('#ff936f');

function validModelSurface(result: PredictionResult | null, mesh: MeshData | null, frames: DecodedSurfaceFrames | null): result is PredictionResult {
  if (!result || !mesh || mesh.mesh !== 'fsaverage5' || mesh.vertices.length < 9 || mesh.vertices.length % 3 || mesh.faces.length < 3 || mesh.faces.length % 3) return false;
  const count = mesh.vertices.length / 3;
  if (result.vertexCount !== count || result.values.length !== count || mesh.hemisphereBoundary <= 0 || mesh.hemisphereBoundary >= count) return false;
  if (frames && (frames.vertexCount !== count || frames.frameCount !== result.sampleCount || Math.abs(frames.colorLimit - MODEL_COLOR_LIMIT) > 1e-6)) return false;
  for (const coordinate of mesh.vertices) if (!Number.isFinite(coordinate)) return false;
  for (const index of mesh.faces) if (!Number.isInteger(index) || index < 0 || index >= count) return false;
  for (const value of result.values) if (!Number.isFinite(value)) return false;
  return true;
}

function framePairAtTime(frames: DecodedSurfaceFrames, requestedTime: number): FramePair {
  const last = frames.frameCount - 1; const firstTime = frames.starts[0]; const lastTime = frames.starts[last];
  const time = Number.isFinite(requestedTime) ? Math.min(lastTime, Math.max(firstTime, requestedTime)) : lastTime;
  if (!last || time <= firstTime) return { from: 0, to: 0, mix: 0, time };
  if (time >= lastTime) return { from: last, to: last, mix: 0, time };
  let low = 0; let high = last;
  while (low + 1 < high) { const middle = (low + high) >>> 1; if (frames.starts[middle] <= time) low = middle; else high = middle; }
  const span = frames.starts[high] - frames.starts[low];
  return { from: low, to: high, mix: span > 0 ? (time - frames.starts[low]) / span : 0, time };
}

function writeHeatColor(target: Float32Array, offset: number, value: number) {
  const intensity = Math.min(1, Math.abs(value) / MODEL_COLOR_LIMIT);
  const endpoint = value < 0 ? NEGATIVE_COLOR : POSITIVE_COLOR;
  target[offset] = ZERO_COLOR.r + (endpoint.r - ZERO_COLOR.r) * intensity;
  target[offset + 1] = ZERO_COLOR.g + (endpoint.g - ZERO_COLOR.g) * intensity;
  target[offset + 2] = ZERO_COLOR.b + (endpoint.b - ZERO_COLOR.b) * intensity;
}

export default function Cortex({ result, mesh, surface = null, tick, ticks = [], quote = 'QUOTE', liveInput = false }: {
  result: PredictionResult | null;
  mesh: MeshData | null;
  /** Decoded display frames; the retained float model artifact remains authoritative. */
  surface?: DecodedSurfaceFrames | null;
  tick?: Tick;
  ticks?: Tick[];
  quote?: string;
  liveInput?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null); const reset = useRef<() => void>(() => {});
  const orbit = useRef<OrbitControls | null>(null); const engine = useRef<CortexEngine | null>(null);
  const rotation = useRef(false); const signals = useRef<MarketSignal[]>([]);
  const seenSignals = useRef<Map<string, number>>(new Map()); const reduced = useRef(false);
  const requestDraw = useRef<() => void>(() => {});
  const [rotating, setRotating] = useState(false); const [unsupported, setUnsupported] = useState(false);
  const [visualMode, setVisualMode] = useState<VisualMode>('schematic');
  const [frameReadout, setFrameReadout] = useState<FrameReadout | null>(null);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      reduced.current = preference.matches;
      if (orbit.current) orbit.current.enableDamping = !preference.matches;
      setRotating(!preference.matches); engine.current?.setReduced(preference.matches); requestDraw.current();
    };
    sync(); preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    rotation.current = rotating;
    if (orbit.current) orbit.current.autoRotate = rotating;
    requestDraw.current();
  }, [rotating]);

  const eventKey = (ticks.length ? ticks : tick ? [tick] : []).map(event => event.id).join('|');
  useEffect(() => {
    if (!liveInput) { signals.current = []; requestDraw.current(); return; }
    const events = ticks.length ? ticks : tick ? [tick] : [];
    const unseen = takeUnseenRecentSignals(events, seenSignals.current); const now = performance.now();
    unseen.forEach((event, index) => signals.current.push({ id: event.id, side: event.side,
      started: now + index * 150, position: marketSignalPosition(event), strength: marketSignalStrength(event, events) }));
    signals.current = signals.current.slice(-8); requestDraw.current();
    if (!signals.current.length) return;
    const expiry = Math.max(...signals.current.map(signal => signal.started + 4800));
    const timer = window.setTimeout(() => requestDraw.current(), Math.max(0, expiry - performance.now() + 20));
    return () => window.clearTimeout(timer);
  // eventKey is an intentional compact identity for the latest feed window.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey, liveInput]);

  useEffect(() => {
    if (!root.current) return;
    const host = root.current; const scene = new THREE.Scene();
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); }
    catch { setUnsupported(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const contextLost = (event: Event) => { event.preventDefault(); setUnsupported(true); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !reduced.current; controls.enablePan = false;
    controls.autoRotate = rotation.current; controls.autoRotateSpeed = 0.35; orbit.current = controls;
    const brainGroup = new THREE.Group(); const inputGroup = new THREE.Group(); scene.add(brainGroup, inputGroup);
    brainGroup.rotation.set(0.12, -0.35, -0.1);
    scene.add(new THREE.AmbientLight('#d6d8e0', 1.2));
    const light = new THREE.DirectionalLight('#ffffff', 3); light.position.set(80, 100, 120); scene.add(light);
    const rim = new THREE.DirectionalLight('#8691af', 2); rim.position.set(-90, -20, -70); scene.add(rim);

    const brainGeometries: THREE.BufferGeometry[] = []; const brainMaterials: THREE.Material[] = [];
    const pulseGeometry = new THREE.SphereGeometry(1, 20, 14); const pulseMaterials: THREE.Material[] = [];
    const pulsePool = Array.from({ length: 8 }, () => {
      const holder = new THREE.Group(); holder.visible = false;
      const coreMaterial = new THREE.MeshBasicMaterial({ color: '#67d9ff', transparent: true, opacity: 1,
        depthWrite: false, blending: THREE.AdditiveBlending });
      const waveMaterial = new THREE.MeshBasicMaterial({ color: '#67d9ff', transparent: true, opacity: 0,
        wireframe: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const core = new THREE.Mesh(pulseGeometry, coreMaterial); const wave = new THREE.Mesh(pulseGeometry, waveMaterial);
      holder.add(core, wave); inputGroup.add(holder); pulseMaterials.push(coreMaterial, waveMaterial);
      return { holder, core, wave, coreMaterial, waveMaterial };
    });

    let model: ModelRuntime | null = null; let displayRadius = 52;
    let frame: number | null = null; let documentVisible = !document.hidden; let inViewport = true;
    let active = documentVisible && inViewport; let suspendedAt: number | null = null;

    const clearBrain = () => {
      brainGroup.clear(); brainGeometries.splice(0).forEach(item => item.dispose()); brainMaterials.splice(0).forEach(item => item.dispose());
      model = null;
    };
    const positionCamera = () => {
      camera.near = Math.max(0.1, displayRadius / 200); camera.far = Math.max(1000, displayRadius * 20);
      camera.position.set(displayRadius * 2.15, displayRadius * 0.66, displayRadius * 3.32);
      controls.minDistance = displayRadius * 1.65; controls.maxDistance = displayRadius * 8;
      controls.target.set(0, 0, 0); camera.updateProjectionMatrix(); controls.update();
    };
    reset.current = positionCamera;

    const installSchematic = () => {
      clearBrain(); displayRadius = 52;
      for (const hemisphere of [-1, 1]) {
        const geometry = new THREE.SphereGeometry(1, 90, 64); const position = geometry.attributes.position;
        for (let index = 0; index < position.count; index++) {
          const x = position.getX(index); const y = position.getY(index); const z = position.getZ(index);
          const fold = 1 + 0.048 * Math.sin(y * 27 + Math.sin(z * 10)) * Math.sin(z * 24 + x * 7)
            + 0.025 * Math.cos(x * 30 - y * 9);
          position.setXYZ(index, hemisphere * 23 + x * 24 * fold, y * 36 * fold + 3 * z, z * 43 * fold);
        }
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ color: '#30343b', roughness: 0.72, metalness: 0.08 });
        const dots = new THREE.PointsMaterial({ color: '#a8afbb', size: 0.55, transparent: true, opacity: 0.38 });
        brainGroup.add(new THREE.Mesh(geometry, material), new THREE.Points(geometry, dots));
        brainGeometries.push(geometry); brainMaterials.push(material, dots);
      }
      positionCamera(); setFrameReadout(null);
    };

    const announceFrame = (pair: FramePair, now: number, state: FrameReadout['state'], force = false) => {
      if (!model?.frames) return;
      const key = `${state}:${pair.from}:${pair.to}`;
      if (!force && key === model.lastReadoutKey && now - model.lastReadoutAt < 250) return;
      model.lastReadoutKey = key; model.lastReadoutAt = now;
      setFrameReadout({ state, from: pair.from, to: pair.to, count: model.frames.frameCount, time: pair.time });
    };

    const paintTemporalFrame = (now: number, force = false) => {
      if (!model?.frames) return;
      const frames = model.frames; const last = frames.frameCount - 1;
      const replayStart = frames.starts[0]; const replayEnd = frames.starts[last] + frames.durations[last];
      let displayTime = frames.starts[last]; let state: FrameReadout['state'] = reduced.current ? 'reduced' : 'held';
      let finished = false;
      if (model.replaying && !reduced.current) {
        const elapsed = Math.max(0, (now - model.startedAt) / 1000);
        displayTime = Math.min(frames.starts[last], replayStart + elapsed);
        state = elapsed < replayEnd - replayStart ? 'playing' : 'held';
        finished = state === 'held';
      }
      if (!force && now - model.lastPaintAt < 1000 / 30) return;
      model.lastPaintAt = now;
      const pair = framePairAtTime(frames, displayTime);
      const firstOffset = pair.from * frames.vertexCount; const secondOffset = pair.to * frames.vertexCount;
      for (let vertex = 0, color = 0; vertex < frames.vertexCount; vertex++, color += 3) {
        const first = frames.quantized[firstOffset + vertex]; const second = frames.quantized[secondOffset + vertex];
        writeHeatColor(model.colors, color, (first + (second - first) * pair.mix) / 32767 * frames.colorLimit);
      }
      model.color.needsUpdate = true;
      if (finished) model.replaying = false;
      announceFrame(pair, now, state, force);
    };

    const schedule = () => { if (frame === null && active) frame = requestAnimationFrame(render); };
    const install = (nextResult: PredictionResult | null, nextMesh: MeshData | null, nextFrames: DecodedSurfaceFrames | null) => {
      if (!validModelSurface(nextResult, nextMesh, nextFrames)) {
        installSchematic(); setVisualMode(liveInput ? 'market-input' : 'schematic'); schedule(); return;
      }
      const anatomicalMesh = nextMesh as MeshData;
      clearBrain();
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(anatomicalMesh.vertices, 3));
      geometry.setIndex(anatomicalMesh.faces); geometry.computeVertexNormals(); geometry.center(); geometry.computeBoundingSphere();
      const colors = new Float32Array(nextResult.vertexCount * 3);
      const color = new THREE.BufferAttribute(colors, 3); color.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('color', color);
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide });
      brainGroup.add(new THREE.Mesh(geometry, material)); brainGeometries.push(geometry); brainMaterials.push(material);
      displayRadius = Math.max(1, geometry.boundingSphere?.radius ?? 52); positionCamera();
      model = { color, colors, frames: nextFrames, startedAt: performance.now(), replaying: !!nextFrames && nextFrames.frameCount > 1 && !reduced.current,
        lastPaintAt: -Infinity, lastReadoutAt: -Infinity, lastReadoutKey: '' };
      if (nextFrames) paintTemporalFrame(performance.now(), true);
      else {
        nextResult.values.forEach((value, index) => writeHeatColor(colors, index * 3, value)); color.needsUpdate = true;
        setFrameReadout({ state: 'static', from: Math.max(0, nextResult.sampleCount - 1), to: Math.max(0, nextResult.sampleCount - 1),
          count: nextResult.sampleCount, time: nextResult.times.at(-1) ?? 0 });
      }
      setVisualMode('model-output'); schedule();
    };

    function render() {
      frame = null; if (!active) return;
      const now = performance.now(); paintTemporalFrame(now);
      signals.current = signals.current.filter(signal => now - signal.started < 4800);
      const visibleSignals = signals.current.filter(signal => signal.started <= now).slice(-pulsePool.length);
      pulsePool.forEach((visual, index) => {
        const current = visibleSignals[index]; visual.holder.visible = !!current;
        if (!current) return;
        const elapsed = Math.max(0, (now - current.started) / 1000); const progress = Math.min(1, elapsed / 4.2);
        const direction = new THREE.Vector3(...current.position); if (!direction.lengthSq()) direction.set(1, 0, 0); direction.normalize();
        const arrival = Math.min(1, progress / 0.28);
        const radius = THREE.MathUtils.lerp(displayRadius * 1.72, displayRadius * 1.13, 1 - Math.pow(1 - arrival, 3));
        visual.holder.position.copy(direction.multiplyScalar(radius));
        const tint = current.side === 'sell' ? NEGATIVE_COLOR : POSITIVE_COLOR;
        visual.coreMaterial.color.copy(tint); visual.waveMaterial.color.copy(tint);
        const unit = Math.max(0.7, displayRadius / 52);
        visual.core.scale.setScalar((reduced.current ? 1.45 : 1.08 + Math.sin(elapsed * 11) * 0.24) * current.strength * unit);
        visual.wave.scale.setScalar((reduced.current ? 1.9 : 1.7 + progress * 9) * current.strength * unit);
        visual.coreMaterial.opacity = reduced.current ? 0.7 : Math.max(0, 1 - progress * 0.82);
        visual.waveMaterial.opacity = reduced.current ? 0 : Math.sin(progress * Math.PI) * 0.42;
      });
      controls.update(); renderer.render(scene, camera);
      if (rotation.current || model?.replaying || (!reduced.current && signals.current.length > 0)) schedule();
    }

    const replay = () => {
      if (!model?.frames || model.frames.frameCount < 2 || reduced.current) return;
      model.startedAt = performance.now(); model.replaying = true; model.lastPaintAt = -Infinity; model.lastReadoutKey = '';
      paintTemporalFrame(model.startedAt, true); schedule();
    };
    const nudgeCamera = (key: string) => {
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      if (key === 'ArrowLeft') spherical.theta -= 0.14;
      else if (key === 'ArrowRight') spherical.theta += 0.14;
      else if (key === 'ArrowUp') spherical.phi -= 0.11;
      else if (key === 'ArrowDown') spherical.phi += 0.11;
      else if (key === '+' || key === '=') spherical.radius *= 0.9;
      else if (key === '-' || key === '_') spherical.radius *= 1.1;
      else return;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.12, Math.PI - 0.12);
      spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
      camera.position.copy(new THREE.Vector3().setFromSpherical(spherical).add(controls.target));
      rotation.current = false; controls.autoRotate = false; setRotating(false); controls.update(); schedule();
    };
    const setReduced = (value: boolean) => {
      if (!model?.frames) return;
      if (value) model.replaying = false;
      model.lastPaintAt = -Infinity; paintTemporalFrame(performance.now(), true); schedule();
    };
    engine.current = { install, replay, nudgeCamera, schedule, setReduced }; requestDraw.current = schedule;

    const resize = () => {
      const width = host.clientWidth; const height = host.clientHeight; if (!width || !height) return;
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); schedule();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const setActivity = (nextDocumentVisible: boolean, nextInViewport: boolean) => {
      documentVisible = nextDocumentVisible; inViewport = nextInViewport;
      const nextActive = documentVisible && inViewport; if (nextActive === active) return; active = nextActive;
      if (!active) { suspendedAt = performance.now(); if (frame !== null) { cancelAnimationFrame(frame); frame = null; } }
      else { if (suspendedAt !== null && model?.replaying) model.startedAt += performance.now() - suspendedAt; suspendedAt = null; schedule(); }
    };
    const intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      setActivity(!document.hidden, entries[0]?.isIntersecting ?? true);
    }, { rootMargin: '100px' });
    intersection?.observe(host);
    const visibility = () => setActivity(!document.hidden, inViewport);
    controls.addEventListener('change', schedule); document.addEventListener('visibilitychange', visibility); schedule();

    return () => {
      if (frame !== null) cancelAnimationFrame(frame); observer.disconnect(); intersection?.disconnect(); orbit.current = null; engine.current = null;
      requestDraw.current = () => {}; controls.removeEventListener('change', schedule); controls.dispose(); clearBrain();
      pulseGeometry.dispose(); pulseMaterials.forEach(material => material.dispose()); renderer.dispose(); renderer.domElement.remove();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost); document.removeEventListener('visibilitychange', visibility);
    };
  // The WebGL context intentionally mounts once. Model, mesh and receipt updates use refs/effects.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { engine.current?.install(result, mesh, surface); }, [result, mesh, surface]);
  useEffect(() => { if (visualMode !== 'model-output') setVisualMode(liveInput ? 'market-input' : 'schematic'); }, [liveInput, visualMode]);

  const anatomical = visualMode === 'model-output';
  const frameLabel = frameReadout ? frameReadout.from === frameReadout.to
    ? `${frameReadout.from + 1}/${frameReadout.count}` : `${frameReadout.from + 1}→${frameReadout.to + 1}/${frameReadout.count}` : null;
  return <div className={`cortex-stage ${anatomical ? 'has-model' : ''}`} data-input-event={liveInput ? tick?.id : undefined}
    data-visual-mode={visualMode} data-model-playback={frameReadout?.state}>
    <div className="cortex-cross cross-one"/><div className="cortex-cross cross-two"/>
    <div ref={root} className="cortex-canvas" role={unsupported ? undefined : 'img'} aria-hidden={unsupported || undefined} tabIndex={unsupported ? -1 : 0}
      onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'].includes(event.key)) { event.preventDefault(); engine.current?.nudgeCamera(event.key); } }}
      aria-label={anatomical
        ? liveInput ? 'Predicted cortical response on the fsaverage5 surface, with separately layered exterior market receipt particles. Drag, use arrow keys to rotate, and plus or minus to zoom.' : 'Predicted cortical response on the fsaverage5 surface. Drag, use arrow keys to rotate, and plus or minus to zoom.'
        : liveInput ? 'Interactive three-dimensional cortex with exterior particles representing real market receipts. No model prediction is displayed. Drag, use arrow keys to rotate, and plus or minus to zoom.' : 'Decorative cortex schematic. No model prediction is displayed. Drag, use arrow keys to rotate, and plus or minus to zoom.'}/>
    {unsupported ? <div className="cortex-fallback"><svg viewBox="0 0 200 130" role="img" aria-label="Cortex outline fallback"><path d="M95 20C65 0 20 24 23 52C2 68 19 104 44 103C55 129 87 118 95 104ZM105 20C135 0 180 24 177 52C198 68 181 104 156 103C145 129 113 118 105 104Z" fill="none" stroke="currentColor" strokeWidth="2"/></svg><p>WebGL is unavailable. The live feed and receipts below still work.</p></div> : null}
    {anatomical && frameReadout ? <div className="cortex-model-readout"><span>{surface ? frameReadout.state === 'playing' ? 'PUBLISHED MODEL REPLAY' : 'PUBLISHED MODEL FRAME' : 'LATEST PUBLISHED MODEL FRAME'}</span><strong>FRAME {frameLabel} · t={frameReadout.time.toFixed(2)}s</strong><small>{surface ? frameReadout.state === 'reduced' ? 'Final authentic sample · reduced motion' : 'Linear display interpolation · upstream media time' : 'Static final authentic sample'}</small></div> : null}
    {liveInput && tick ? <div className={`cortex-live-readout ${tick.side}`} aria-live="polite"><span>MARKET RECEIPT // {tick.side.toUpperCase()}</span><strong>BLOCK {tick.blockNumber.toLocaleString()}</strong><small>{tick.quoteAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} {quote} · {tick.txHash.slice(0, 10)}…{tick.txHash.slice(-6)}</small><div className="signal-bars" aria-hidden="true">{[2, 5, 3, 8, 4, 7, 3, 6].map((height, index) => <i key={index} style={{ height: `${height}px` }}/>)}</div></div> : null}
    {(anatomical || liveInput) ? <div className="cortex-data-legend" role="img" aria-label={anatomical
      ? 'Legend: cortical surface colors range from negative two through zero to positive two normalized model units. Cyan and coral exterior particles are separate market inputs.'
      : 'Legend: cyan and coral exterior particles are market inputs. No cortical model output is displayed.'}>
      <div aria-hidden="true" className={anatomical ? '' : 'legend-disabled'}><span className="heat-scale"/><b>MODEL</b><small>−2</small><small>0</small><small>+2</small></div>
      <div aria-hidden="true"><span className="receipt-dot buy"/><span className="receipt-dot sell"/><b>MARKET INPUT</b><small>exterior receipt particles</small></div>
    </div> : null}
    <div className="anatomy-tag"><span>{anatomical ? liveInput ? 'FSAVERAGE5 MODEL + SEPARATE RECEIPTS' : 'FSAVERAGE5 MODEL SURFACE' : liveInput ? 'LIVE MARKET RECEIPT FIELD' : 'CORTEX SCHEMATIC'}</span><small>{anatomical ? `${result?.vertexCount.toLocaleString()} model vertices · fixed ±${MODEL_COLOR_LIMIT} scale` : liveInput ? `${Math.max(1, ticks.length)} recent event${ticks.length === 1 ? '' : 's'} · no cortical output` : 'Connect a feed to see exterior receipt particles'}</small></div>
    <div className="camera-controls">{surface && surface.frameCount > 1 && anatomical ? <button className="icon-button" onClick={() => engine.current?.replay()} disabled={reduced.current} aria-label="Replay published cortical frames" title={reduced.current ? 'Animation disabled by reduced-motion preference' : 'Replay published cortical frames'}><RefreshCw size={14}/></button> : null}<button className="icon-button" onClick={() => setRotating(value => !value)} aria-label={rotating ? 'Pause camera rotation' : 'Resume camera rotation'} title={rotating ? 'Pause camera rotation' : 'Resume camera rotation'}>{rotating ? <Pause size={14}/> : <Play size={14}/>}</button><button className="icon-button" onClick={() => reset.current()} aria-label="Reset brain view" title="Reset brain view"><RotateCcw size={15}/></button></div>
    <div className="drag-hint"><MoveUpRight size={12}/> Drag or use arrow keys</div>
  </div>;
}
