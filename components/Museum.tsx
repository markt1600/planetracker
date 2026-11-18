"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { scaleFact } from "@/lib/facts";
import { scaleDenominator } from "@/lib/format";
import { liveryFor, shapeFor } from "@/lib/planeShape";
import { buildPlane, plaqueTexture, type Exhibit } from "./plane3d";
import PlaneImage from "./PlaneImage";

const PITCH = 17; // distance between plinths

export default function Museum({ exhibits, initial }: { exhibits: Exhibit[]; initial?: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const focus = useRef<(id: string | null) => void>(() => {});
  const [selected, setSelected] = useState<string | null>(initial && exhibits.some((e) => e.id === initial) ? initial : null);
  const [failed, setFailed] = useState(false);
  const order = useMemo(() => [...exhibits].sort((a, b) => (a.airline ?? "~").localeCompare(b.airline ?? "~") || a.title.localeCompare(b.title)), [exhibits]);
  const current = order.find((e) => e.id === selected);

  useEffect(() => {
    const el = mount.current;
    if (!el || !order.length) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      queueMicrotask(() => setFailed(true)); // no WebGL on this device
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#070b14");
    scene.fog = new THREE.Fog("#070b14", 90, 260);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);

    const cols = Math.max(1, Math.ceil(Math.sqrt(order.length * 1.7)));
    const rows = Math.ceil(order.length / cols);
    const width = cols * PITCH;
    const depth = rows * PITCH;

    // The hall: polished floor, a back wall and soft museum lighting.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width + 160, depth + 160), new THREE.MeshStandardMaterial({ color: "#18233a", roughness: 0.6, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const grid = new THREE.GridHelper(Math.max(width, depth) + 160, Math.round((Math.max(width, depth) + 160) / (PITCH / 2)), "#2b3b5c", "#202d49");
    grid.position.y = 0.01;
    scene.add(grid);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(width + 160, 46), new THREE.MeshStandardMaterial({ color: "#101a2e", roughness: 0.9 }));
    wall.position.set(0, 23, -depth / 2 - 14);
    scene.add(wall);
    scene.add(new THREE.HemisphereLight("#dbe9ff", "#1a2233", 2.2));
    const sun = new THREE.DirectionalLight("#fff4e0", 2.8);
    sun.position.set(30, 60, 40);
    scene.add(sun);
    const fill = new THREE.DirectionalLight("#7cc6ff", 0.7);
    fill.position.set(-40, 25, -30);
    scene.add(fill);

    const plinthMat = new THREE.MeshStandardMaterial({ color: "#2a3a5c", roughness: 0.45, metalness: 0.3 });
    const poleMat = new THREE.MeshStandardMaterial({ color: "#8a94a6", roughness: 0.25, metalness: 0.9 });
    const planes = new Map<string, { root: THREE.Group; plane: THREE.Group; ring: THREE.Mesh; size: number; rest: number }>();
    const pickable: THREE.Object3D[] = [];

    order.forEach((e, i) => {
      const shape = shapeFor(e.family, e.aircraft);
      // Bigger scales get bigger exhibits, but everything stays inside its bay.
      const d = scaleDenominator(e.scale) ?? 400;
      const k = Math.min(1.35, Math.max(0.8, Math.sqrt(400 / d))) * 0.105;
      const fit = Math.min(1, (PITCH * 0.78) / (Math.max(shape.length, shape.span) * k));
      const size = Math.max(shape.length, shape.span) * k * fit;

      const root = new THREE.Group();
      root.position.set(((i % cols) - (cols - 1) / 2) * PITCH, 0, (Math.floor(i / cols) - (rows - 1) / 2) * PITCH);
      root.userData.id = e.id;

      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.36, size * 0.4, 0.5, 48), plinthMat);
      plinth.position.y = 0.25;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(size * 0.385, 0.06, 8, 64), new THREE.MeshStandardMaterial({ color: "#f6b84b", emissive: "#f6b84b", emissiveIntensity: 0.5 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 2.2, 12), poleMat);
      pole.position.y = 1.6;

      const plane = buildPlane(shape, liveryFor(e.airline));
      plane.scale.setScalar(k * fit);
      const rest = -0.5;
      plane.rotation.set(0.05, rest, 0.03);
      plane.position.y = 2.7 + shape.radius * k * fit;

      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7), new THREE.MeshBasicMaterial({ map: plaqueTexture(e) }));
      plaque.position.set(0, 1.05, size * 0.4 + 1.5);
      plaque.rotation.x = -0.6;
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), poleMat);
      stand.position.set(0, 0.3, size * 0.4 + 1.2);

      root.add(plinth, ring, pole, plane, plaque, stand);
      scene.add(root);
      planes.set(e.id, { root, plane, ring, size, rest });
      pickable.push(root);
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minDistance = 6;
    controls.maxDistance = Math.max(width, depth) + 60;
    controls.screenSpacePanning = false;
    const portrait = el.clientWidth < el.clientHeight * 0.8;
    const overviewDist = (Math.max(width * 0.62, depth * 0.85, 20) + 6) * (portrait ? 1.8 : 1);
    const overview = { pos: new THREE.Vector3(0, overviewDist * 0.55, depth / 2 + overviewDist * 0.7), target: new THREE.Vector3(0, 2, 0) };
    camera.position.copy(overview.pos);
    controls.target.copy(overview.target);

    // Camera glides to the chosen exhibit; any manual drag cancels the glide.
    let goal: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
    let active: string | null = null;
    controls.addEventListener("start", () => { goal = null; });
    focus.current = (id) => {
      active = id;
      const hit = id ? planes.get(id) : null;
      if (!hit) { goal = { pos: overview.pos.clone(), target: overview.target.clone() }; return; }
      const p = hit.root.position;
      const r = hit.size * 1.15 + 8;
      goal = { target: new THREE.Vector3(p.x, portrait ? 0.6 : 2.8, p.z), pos: new THREE.Vector3(p.x + r * 0.3, 3 + r * 0.55, p.z + r) };
    };

    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickAt = (ev: PointerEvent) => {
      const b = renderer.domElement.getBoundingClientRect();
      pointer.set(((ev.clientX - b.left) / b.width) * 2 - 1, -((ev.clientY - b.top) / b.height) * 2 + 1);
      ray.setFromCamera(pointer, camera);
      let o: THREE.Object3D | null = ray.intersectObjects(pickable, true)[0]?.object ?? null;
      while (o && !o.userData.id) o = o.parent;
      return (o?.userData.id as string | undefined) ?? null;
    };
    let down = { x: 0, y: 0 };
    const onDown = (ev: PointerEvent) => { down = { x: ev.clientX, y: ev.clientY }; };
    const onUp = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 6) return; // that was a drag
      const id = pickAt(ev);
      if (id) setSelected(id);
    };
    const onMove = (ev: PointerEvent) => { renderer.domElement.style.cursor = pickAt(ev) ? "pointer" : "grab"; };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    const clock = new THREE.Clock();
    let frame = 0;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (goal) {
        const a = 1 - Math.exp(-dt * 3.2);
        camera.position.lerp(goal.pos, a);
        controls.target.lerp(goal.target, a);
        if (camera.position.distanceTo(goal.pos) < 0.05) goal = null;
      }
      for (const [id, p] of planes) {
        const on = id === active;
        // The selected plane turns slowly on its stand; the rest ease back to their resting pose.
        if (on && !still) p.plane.rotation.y += dt * 0.45;
        else if (!on) p.plane.rotation.y += Math.atan2(Math.sin(p.rest - p.plane.rotation.y), Math.cos(p.rest - p.plane.rotation.y)) * Math.min(1, dt * 3);
        (p.ring.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 2.4 : 0.5;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    tick();
    (window as unknown as { __museumReady?: boolean }).__museumReady = true;

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const x of mats) {
          (x as THREE.MeshBasicMaterial).map?.dispose();
          x.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [order]);

  useEffect(() => focus.current(selected), [selected]);

  const step = (dir: number) => {
    const i = order.findIndex((e) => e.id === selected);
    setSelected(order[(i + dir + order.length) % order.length].id);
  };
  const sizeNote = current ? scaleFact(current.family, current.scale, current.aircraft) : null;

  if (!order.length) {
    return (
      <div className="panel p-10 text-center">
        <h2 className="font-display text-2xl">The museum is waiting for its first exhibit</h2>
        <p className="mt-2 text-mute">Add a plane and it will appear here on its own plinth.</p>
        <Link href="/add" className="btn btn-primary mt-5">+ Add a plane</Link>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-13rem)] min-h-[26rem] sm:h-[calc(100dvh-11rem)] overflow-hidden rounded-3xl border border-line bg-night">
      <div ref={mount} className="absolute inset-0" />
      {failed && <p className="absolute inset-0 grid place-items-center p-6 text-center text-mute">This device can&rsquo;t show 3D graphics. The collection page has everything in 2D.</p>}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex gap-2">
          <button className="btn btn-ghost !bg-night/80 !px-3 !py-1.5 text-sm backdrop-blur" onClick={() => step(-1)} aria-label="Previous plane">‹ Prev</button>
          <button className="btn btn-ghost !bg-night/80 !px-3 !py-1.5 text-sm backdrop-blur" onClick={() => step(1)} aria-label="Next plane">Next ›</button>
          {selected && <button className="btn btn-ghost !bg-night/80 !px-3 !py-1.5 text-sm backdrop-blur" onClick={() => setSelected(null)}>Overview</button>}
        </div>
      </div>
      {!current && <p className="chip pointer-events-none absolute bottom-3 left-1/2 max-w-[calc(100%-1.5rem)] -translate-x-1/2 truncate !bg-night/80 backdrop-blur">Drag to look around · pinch or scroll to zoom · tap a plane</p>}

      {current && (
        <aside key={current.id} className="panel rise absolute inset-x-3 bottom-3 !bg-panel/95 p-4 sm:inset-x-auto sm:right-4 sm:top-16 sm:bottom-auto sm:w-80" aria-live="polite">
          <div className="flex gap-3 sm:block">
            <PlaneImage sources={current.images} alt={current.title} className="aspect-[4/3] w-28 shrink-0 rounded-xl sm:w-full" />
            <div className="min-w-0 sm:mt-3">
              <p className="label truncate">{current.brand} · {current.modelNumber}</p>
              <h2 className="mt-1 font-display text-xl leading-tight">{current.airline && current.aircraft ? `${current.airline} ${current.aircraft}` : current.title}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="chip">{current.scale}</span>
                {current.registration && <span className="chip">{current.registration}</span>}
                {current.value && <span className="chip chip-amber">{current.value}</span>}
              </div>
            </div>
          </div>
          {sizeNote && <p className="mt-3 hidden text-sm text-mute sm:block">{sizeNote}</p>}
          {current.notes && <p className="mt-2 text-sm italic text-mute">“{current.notes}”</p>}
          <div className="mt-3 flex gap-2">
            <Link href={`/collection?plane=${current.id}&from=museum`} className="btn btn-primary flex-1 !py-2">Full details</Link>
            <button className="btn btn-ghost !py-2" onClick={() => setSelected(null)}>Close</button>
          </div>
        </aside>
      )}
    </div>
  );
}
