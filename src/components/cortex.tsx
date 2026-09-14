'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RotateCcw, MoveUpRight, Pause, Play } from 'lucide-react';
import type { MeshData, PredictionResult } from '@/lib/types';

export default function Cortex({ result, mesh }: { result: PredictionResult | null; mesh: MeshData | null }) {
  const root = useRef<HTMLDivElement>(null); const reset = useRef<() => void>(() => {});
  const orbit = useRef<OrbitControls | null>(null);
  const rotation = useRef(false);
  const [rotating, setRotating] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setRotating(!preference.matches);
    sync(); preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    rotation.current = rotating;
    if (orbit.current) orbit.current.autoRotate = rotating;
  }, [rotating]);
  useEffect(() => {
    if (!root.current) return;
    const host = root.current; const scene = new THREE.Scene();
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setUnsupported(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
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
        const surface = new THREE.MeshStandardMaterial({ color: '#292a30', roughness: 0.75, metalness: 0.15 });
        const dots = new THREE.PointsMaterial({ color: '#dde0e9', size: 0.58, transparent: true, opacity: 0.65 });
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
    const render = () => { if (visible) { controls.update(); renderer.render(scene, camera); } frame = requestAnimationFrame(render); };
    const visibility = () => { visible = !document.hidden; }; document.addEventListener('visibilitychange', visibility);
    render();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); orbit.current = null; controls.dispose(); renderer.dispose();
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.domElement.remove();
      document.removeEventListener('visibilitychange', visibility); };
  }, [result, mesh]);
  const anatomical = !!mesh && !!result && mesh.vertices.length / 3 === result.values.length;
  return <div className="cortex-stage">
    <div className="cortex-cross cross-one"/><div className="cortex-cross cross-two"/>
    <div ref={root} className="cortex-canvas" role="img" aria-label={anatomical ? 'Predicted cortical response on fsaverage5. Drag to rotate.' : 'Decorative cortex schematic. No model prediction is displayed.'}/>
    {unsupported ? <div className="cortex-fallback">3D is unavailable in this browser.<br/>Prediction details remain available below.</div> : null}
    <div className="anatomy-tag"><span>{anatomical ? 'FSAVERAGE5' : 'CORTEX SCHEMATIC'}</span><small>{anatomical ? `${result.vertexCount.toLocaleString()} surface vertices` : 'Awaiting model output'}</small></div>
    <div className="camera-controls"><button className="icon-button" onClick={() => setRotating(v => !v)} aria-label={rotating ? 'Pause camera rotation' : 'Resume camera rotation'} title={rotating ? 'Pause camera rotation' : 'Resume camera rotation'}>{rotating ? <Pause size={14}/> : <Play size={14}/>}</button><button className="icon-button" onClick={() => reset.current()} aria-label="Reset brain view" title="Reset brain view"><RotateCcw size={15}/></button></div>
    <div className="drag-hint"><MoveUpRight size={12}/> Drag to explore</div>
  </div>;
}
