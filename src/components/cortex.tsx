'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RotateCcw, MoveUpRight, Pause, Play } from 'lucide-react';
import type { MeshData, PredictionResult, Tick } from '@/lib/types';

export default function Cortex({ result, mesh, tick, liveInput = false }: { result: PredictionResult | null; mesh: MeshData | null; tick?: Tick; liveInput?: boolean }) {
  const root = useRef<HTMLDivElement>(null); const reset = useRef<() => void>(() => {});
  const orbit = useRef<OrbitControls | null>(null);
  const rotation = useRef(false);
  const signal = useRef<{ id: string; side: 'buy' | 'sell'; started: number } | null>(null);
  const reduced = useRef(false);
  const [rotating, setRotating] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { reduced.current = preference.matches; setRotating(!preference.matches); };
    sync(); preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    rotation.current = rotating;
    if (orbit.current) orbit.current.autoRotate = rotating;
  }, [rotating]);
  useEffect(() => {
    if (!liveInput || !tick?.txHash) { signal.current = null; return; }
    if (signal.current?.id !== tick.id) signal.current = { id: tick.id, side: tick.side, started: Date.now() - tick.ts < 45000 ? performance.now() : 0 };
  }, [tick?.id, tick?.txHash, tick?.side, tick?.ts, liveInput]);
  useEffect(() => {
    if (!root.current) return;
    const host = root.current; const scene = new THREE.Scene();
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); }
    catch { setUnsupported(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    const contextLost = (event: Event) => { event.preventDefault(); setUnsupported(true); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 1000);
    const cameraScale = mesh && result ? 2.2 : 1;
    camera.position.set(115 * cameraScale, 35 * cameraScale, 175 * cameraScale);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 100 * cameraScale; controls.maxDistance = 500 * cameraScale;
    controls.autoRotate = rotation.current; controls.autoRotateSpeed = 0.35; orbit.current = controls;
    const group = new THREE.Group(); scene.add(group);
    const geometries: THREE.BufferGeometry[] = []; const materials: THREE.Material[] = [];
    const real = !!mesh && !!result && mesh.vertices.length / 3 === result.values.length;
    if (real) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3));
      geometry.setIndex(mesh.faces); geometry.computeVertexNormals(); geometry.center();
      const colors = new Float32Array(result.values.length * 3);
      const limit = Math.max(0.0001, result.colorLimit); const a = new THREE.Color('#55cfbf'); const b = new THREE.Color('#ffc789');
      const base = new THREE.Color('#243c43');
      result.values.forEach((v, i) => { const c = base.clone().lerp(v >= 0 ? a : b, Math.min(1, Math.abs(v) / limit)); c.toArray(colors, i * 3); });
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.1, side: THREE.DoubleSide });
      group.add(new THREE.Mesh(geometry, material)); geometries.push(geometry); materials.push(material);
    } else {
      // A decorative, explicitly labelled schematic. No values are invented or called predictions.
      for (const hemisphere of [-1, 1]) {
        const geometry = new THREE.SphereGeometry(1, 110, 80); const position = geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
          const x = position.getX(i); const y = position.getY(i); const z = position.getZ(i);
          const fold = 1 + 0.048 * Math.sin(y * 27 + Math.sin(z * 10)) * Math.sin(z * 24 + x * 7)
            + 0.025 * Math.cos(x * 30 - y * 9);
          position.setXYZ(i, hemisphere * 23 + x * 24 * fold, y * 36 * fold + 3 * z, z * 43 * fold);
        }
        geometry.computeVertexNormals();
        const surface = new THREE.MeshStandardMaterial({ color: '#353940', roughness: 0.65, metalness: 0.15 });
        const dots = new THREE.PointsMaterial({ color: '#dde0e9', size: 0.64, transparent: true, opacity: 0.7 });
        group.add(new THREE.Mesh(geometry, surface)); group.add(new THREE.Points(geometry, dots));
        geometries.push(geometry); materials.push(surface, dots);
      }
    }
    group.rotation.set(0.12, -0.35, -0.1);
    scene.add(new THREE.AmbientLight('#d6d8e0', 1.2));
    const light = new THREE.DirectionalLight('#ffffff', 3); light.position.set(80, 100, 120); scene.add(light);
    const rim = new THREE.DirectionalLight('#8691af', 2); rim.position.set(-90, -20, -70); scene.add(rim);
    const resize = () => { const w = host.clientWidth; const h = host.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    reset.current = () => { camera.position.set(115 * cameraScale, 35 * cameraScale, 175 * cameraScale); controls.target.set(0, 0, 0); controls.update(); };
    let frame = 0; let visible = true;
    const teal = new THREE.Color('#49dcb9'); const amber = new THREE.Color('#eead82');
    const render = () => { if (visible) {
      if (!real) {
        const current = signal.current; const elapsed = current?.started ? (performance.now() - current.started) / 1000 : 10;
        const pulse = current && !reduced.current ? Math.max(0, 1 - elapsed / 3) : 0;
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.emissive.copy(current?.side === 'sell' ? amber : teal);
            material.emissiveIntensity = current ? 0.04 + pulse * 0.35 : 0;
          } else if (material instanceof THREE.PointsMaterial) {
            material.color.set(current ? current.side === 'buy' ? '#a0f2df' : '#f0c3a4' : '#dde0e9');
            material.opacity = 0.65 + pulse * 0.3;
          }
        }
      }
      controls.update(); renderer.render(scene, camera);
    } frame = requestAnimationFrame(render); };
    const visibility = () => { visible = !document.hidden; }; document.addEventListener('visibilitychange', visibility);
    render();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); orbit.current = null; controls.dispose(); renderer.dispose();
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.domElement.remove();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      document.removeEventListener('visibilitychange', visibility); };
  }, [result, mesh]);
  const anatomical = !!mesh && !!result && mesh.vertices.length / 3 === result.values.length;
  return <div className="cortex-stage" data-input-event={liveInput ? tick?.id : undefined} data-visual-mode={anatomical ? 'model-output' : liveInput ? 'market-input' : 'schematic'}>
    <div className="cortex-cross cross-one"/><div className="cortex-cross cross-two"/>
    <div ref={root} className="cortex-canvas" role="img" aria-label={anatomical ? 'Predicted cortical response on fsaverage5. Drag to rotate.' : liveInput ? 'Illustrative cortex showing real market input pulses. This is not a Meta prediction.' : 'Decorative cortex schematic. No model prediction is displayed.'}/>
    {unsupported ? <div className="cortex-fallback"><svg viewBox="0 0 200 130" role="img" aria-label="Cortex outline fallback"><path d="M95 20C65 0 20 24 23 52C2 68 19 104 44 103C55 129 87 118 95 104ZM105 20C135 0 180 24 177 52C198 68 181 104 156 103C145 129 113 118 105 104Z" fill="none" stroke="currentColor" strokeWidth="2"/></svg><p>WebGL is unavailable. The live feed and receipts below still work.</p></div> : null}
    <div className="anatomy-tag"><span>{anatomical ? 'FSAVERAGE5' : liveInput ? 'LIVE MARKET INPUT' : 'CORTEX SCHEMATIC'}</span><small>{anatomical ? `${result.vertexCount.toLocaleString()} surface vertices` : liveInput ? 'Buy / sell pulses · not model activity' : 'Connect a feed to see input pulses'}</small></div>
    <div className="camera-controls"><button className="icon-button" onClick={() => setRotating(v => !v)} aria-label={rotating ? 'Pause camera rotation' : 'Resume camera rotation'} title={rotating ? 'Pause camera rotation' : 'Resume camera rotation'}>{rotating ? <Pause size={14}/> : <Play size={14}/>}</button><button className="icon-button" onClick={() => reset.current()} aria-label="Reset brain view" title="Reset brain view"><RotateCcw size={15}/></button></div>
    <div className="drag-hint"><MoveUpRight size={12}/> Drag to explore</div>
  </div>;
}
