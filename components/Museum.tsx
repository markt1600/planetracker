"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { scaleFact } from "@/lib/facts";
import { scaleDenominator } from "@/lib/format";
import { liveryFor, shapeFor, type PlaneShape } from "@/lib/planeShape";
import PlaneImage from "./PlaneImage";

export type Exhibit = {
  id: string;
  title: string;
  brand: string;
  modelNumber: string;
  scale: string;
  airline?: string;
  aircraft?: string;
  family?: string;
  registration?: string;
  notes?: string;
  images: (string | undefined)[];
  value?: string;
};

const PITCH = 17; // distance between plinths
const DEG = Math.PI / 180;

/** Flat swept panel (wing, tailplane or fin) built in the X/Y plane and extruded to a thin slab. */
function panel(rootChord: number, tipChord: number, reach: number, sweepDeg: number, thickness: number) {
  const back = Math.tan(sweepDeg * DEG) * reach;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(-back, reach);
  s.lineTo(-back - tipChord, reach);
  s.lineTo(-rootChord, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false });
  g.translate(0, 0, -thickness / 2);
  return g;
}

/** A simplified but recognisable aircraft, in metres, nose towards +X. */
function buildPlane(shape: PlaneShape, colors: { body: string; tail: string; engine: string; stripe?: string }) {
  const { length: L, span: S, radius: R } = shape;
  const group = new THREE.Group();
  const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.12, side: THREE.DoubleSide, ...extra });
  const body = mat(colors.body);
  const tailMat = mat(colors.tail);
  const engineMat = mat(colors.engine);
  const dark = mat("#1b2330", { roughness: 0.2, metalness: 0.5 });
  const wingMat = mat("#c9ced6", { roughness: 0.3, metalness: 0.35 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, place?: (m: THREE.Mesh) => void) => {
    const m = new THREE.Mesh(geometry, material);
    place?.(m);
    group.add(m);
    return m;
  };

  // Fuselage: a lathe profile with an ogive nose and a tapered, upswept tail.
  const noseLen = shape.delta ? 0.3 : 0.13;
  const tailLen = 0.3;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    let r = 1;
    if (t < tailLen) r = 0.1 + 0.9 * Math.sin((t / tailLen) * (Math.PI / 2));
    else if (t > 1 - noseLen) r = Math.sqrt(Math.max(0, 1 - ((t - (1 - noseLen)) / noseLen) ** 2));
    pts.push(new THREE.Vector2(Math.max(r * R, 0.001), (t - 0.5) * L));
  }
  const fus = new THREE.LatheGeometry(pts, 28);
  fus.rotateZ(-Math.PI / 2);
  const pos = fus.attributes.position;
  const deck = shape.doubleDeck ? 1.2 : 1;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getX(i) / L + 0.5;
    let y = pos.getY(i) * deck;
    if (t < tailLen) y += R * 0.75 * (1 - t / tailLen) ** 2; // tail upsweep
    if (shape.delta && t > 0.8) y -= R * 0.5 * ((t - 0.8) / 0.2) ** 2; // Concorde's drooped nose line
    pos.setY(i, y);
  }
  fus.computeVertexNormals();
  add(fus, body);

  if (shape.hump) add(new THREE.SphereGeometry(1, 24, 16), body, (m) => { m.scale.set(L * 0.2, R * 0.62, R * 0.72); m.position.set(L * 0.25, R * 0.62, 0); });

  // Window line and cockpit glazing.
  for (const side of [1, -1]) add(new THREE.BoxGeometry(L * 0.6, R * 0.09, 0.05), dark, (m) => m.position.set(L * 0.03, R * 0.22 * deck, side * R * 0.975));
  if (shape.doubleDeck) for (const side of [1, -1]) add(new THREE.BoxGeometry(L * 0.5, R * 0.08, 0.05), dark, (m) => m.position.set(L * 0.03, R * 0.72, side * R * 0.86));
  add(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), dark, (m) => {
    m.scale.set(R * 0.5, R * 0.34, R * 0.62);
    m.position.set(L * (0.5 - noseLen * 0.62), R * (shape.hump ? 0.95 : 0.52) * (shape.delta ? 0.5 : 1), 0);
    if (shape.hump) m.position.x = L * 0.37;
  });
  if (colors.stripe) for (const side of [1, -1]) add(new THREE.BoxGeometry(L * 0.72, R * 0.14, 0.05), mat(colors.stripe), (m) => m.position.set(-L * 0.02, -R * 0.12, side * R * 0.99));

  // Main wing.
  const half = S / 2;
  const wingY = shape.highWing ? R * 0.78 : -R * 0.42;
  const rootChord = shape.delta ? L * 0.52 : Math.min(L * 0.22, half * 0.5);
  const tipChord = shape.delta ? L * 0.02 : rootChord * 0.26;
  const wingX = shape.delta ? L * 0.16 : /^rear/.test(shape.engines) ? L * 0.02 : L * 0.13;
  const dihedral = shape.highWing ? -2 : shape.delta ? 0 : 5;
  for (const side of [1, -1]) {
    const wing = panel(rootChord, tipChord, half, shape.sweep, R * 0.16);
    wing.rotateX(side * (Math.PI / 2 - dihedral * DEG));
    add(wing, wingMat, (m) => m.position.set(wingX, wingY, 0));
    if (shape.winglets) {
      const tipX = wingX - Math.tan(shape.sweep * DEG) * half - tipChord;
      const tipY = wingY + Math.sin(dihedral * DEG) * half;
      add(panel(tipChord * 1.1, tipChord * 0.45, R * 1.1, 35, R * 0.1), tailMat, (m) => { m.position.set(tipX + tipChord * 1.1, tipY, side * half * Math.cos(dihedral * DEG)); m.rotation.x = side * -12 * DEG; });
    }
  }

  // Fin and tailplane.
  const finH = shape.delta ? R * 2.6 : Math.max(R * 2.5, L * 0.13);
  const finChord = L * (shape.delta ? 0.2 : 0.15);
  const tailX = -L * 0.34;
  add(panel(finChord, finChord * 0.36, finH, 40, R * 0.16), tailMat, (m) => m.position.set(tailX + finChord * 0.2, R * 0.55 * deck, 0));
  if (!shape.delta) {
    const stabY = shape.tTail ? R * 0.55 * deck + finH : R * 0.5;
    const stabX = shape.tTail ? tailX - Math.tan(40 * DEG) * finH + finChord * 0.3 : -L * 0.385;
    for (const side of [1, -1]) {
      const stab = panel(L * 0.1, L * 0.04, S * 0.19, shape.sweep + 4, R * 0.1);
      stab.rotateX(side * (Math.PI / 2 - (shape.tTail ? 0 : 6) * DEG));
      add(stab, wingMat, (m) => m.position.set(stabX, stabY, 0));
    }
  }

  // Engines.
  const jet = (x: number, y: number, z: number, r: number, len: number) => {
    add(new THREE.CylinderGeometry(r, r * 0.78, len, 20), engineMat, (m) => { m.rotation.z = -Math.PI / 2; m.position.set(x, y, z); });
    add(new THREE.CylinderGeometry(r * 0.86, r * 0.86, 0.12, 20), dark, (m) => { m.rotation.z = -Math.PI / 2; m.position.set(x + len / 2, y, z); });
  };
  const prop = (x: number, y: number, z: number, r: number, len: number) => {
    add(new THREE.CylinderGeometry(r * 0.5, r * 0.34, len, 14), engineMat, (m) => { m.rotation.z = -Math.PI / 2; m.position.set(x, y, z); });
    add(new THREE.CylinderGeometry(r * 1.9, r * 1.9, 0.06, 28), new THREE.MeshStandardMaterial({ color: "#aab4c4", transparent: true, opacity: 0.28, side: THREE.DoubleSide }), (m) => { m.rotation.z = -Math.PI / 2; m.position.set(x + len / 2 + 0.1, y, z); });
  };
  const onWing = (frac: number, r: number, len: number, kind: "jet" | "prop") => {
    for (const side of [1, -1]) {
      const z = side * half * frac;
      const le = wingX - Math.tan(shape.sweep * DEG) * half * frac;
      const y = wingY + Math.sin(dihedral * DEG) * half * frac;
      if (kind === "jet") jet(le + len * 0.18, y - r * 1.15, z, r, len);
      else prop(le + len * 0.25, y + (shape.highWing ? -r * 0.4 : r * 0.2), z, r, len);
    }
  };
  const big = R * (shape.engines === "wing2" ? 0.5 : 0.36);
  switch (shape.engines) {
    case "wing2": onWing(0.33, big, R * 2.3, "jet"); break;
    case "wing4": onWing(0.3, big, R * 1.8, "jet"); onWing(0.58, big, R * 1.8, "jet"); break;
    case "tri": onWing(0.34, R * 0.42, R * 2, "jet"); jet(tailX - finChord * 0.2, R * 0.55 * deck + finH * 0.3, 0, R * 0.42, R * 2.6); break;
    case "rear2": for (const s of [1, -1]) jet(-L * 0.27, R * 0.35, s * R * 1.45, R * 0.42, R * 2.4); break;
    case "rear3": for (const s of [1, -1]) jet(-L * 0.27, R * 0.35, s * R * 1.45, R * 0.4, R * 2.4); jet(-L * 0.36, R * 1.05, 0, R * 0.4, R * 2.6); break;
    case "rear4": for (const s of [1, -1]) { jet(-L * 0.27, R * 0.35, s * R * 1.4, R * 0.36, R * 2.4); jet(-L * 0.27, R * 0.35, s * R * 2.15, R * 0.36, R * 2.4); } break;
    case "prop2": onWing(0.28, R * 0.6, R * 2.6, "prop"); break;
    case "prop4": onWing(0.24, R * 0.5, R * 2.2, "prop"); onWing(0.5, R * 0.5, R * 2.2, "prop"); break;
    case "none": for (const s of [1, -1]) add(new THREE.BoxGeometry(L * 0.2, R * 0.5, R * 1.3), engineMat, (m) => m.position.set(-L * 0.18, wingY - R * 0.3, s * half * 0.32)); break;
  }
  return group;
}

function plaqueTexture(e: Exhibit) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#1a2439");
  grad.addColorStop(1, "#0d1423");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "#f6b84b";
  g.lineWidth = 6;
  g.strokeRect(9, 9, 494, 238);
  const fit = (text: string, font: (px: number) => string, px: number, y: number, color: string) => {
    let size = px;
    do {
      g.font = font(size);
      size -= 2;
    } while (g.measureText(text).width > 460 && size > 16);
    g.fillStyle = color;
    g.textAlign = "center";
    g.fillText(text, 256, y);
  };
  fit(e.airline ?? e.title, (p) => `600 ${p}px Georgia, serif`, 54, 92, "#f3f5f9");
  fit([e.aircraft, e.registration].filter(Boolean).join("  ·  ") || e.title, (p) => `${p}px ui-monospace, Menlo, monospace`, 34, 152, "#f6b84b");
  fit(`${e.brand}  ·  ${e.scale}`.toUpperCase(), (p) => `${p}px ui-monospace, Menlo, monospace`, 24, 208, "#93a1ba");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export default function Museum({ exhibits }: { exhibits: Exhibit[] }) {
  const mount = useRef<HTMLDivElement>(null);
  const focus = useRef<(id: string | null) => void>(() => {});
  const [selected, setSelected] = useState<string | null>(null);
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
    const overviewDist = Math.max(width * 0.62, depth * 0.85, 20) + 6;
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
      goal = { target: new THREE.Vector3(p.x, 2.8, p.z), pos: new THREE.Vector3(p.x + r * 0.3, 3 + r * 0.55, p.z + r) };
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
    <div className="relative h-[calc(100dvh-11rem)] min-h-[30rem] overflow-hidden rounded-3xl border border-line bg-night">
      <div ref={mount} className="absolute inset-0" />
      {failed && <p className="absolute inset-0 grid place-items-center p-6 text-center text-mute">This device can&rsquo;t show 3D graphics. The collection page has everything in 2D.</p>}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <p className="chip !bg-night/80 backdrop-blur">Drag to look around · scroll or pinch to zoom · tap a plane</p>
        <div className="pointer-events-auto flex gap-2">
          <button className="btn btn-ghost !bg-night/80 !px-3 !py-1.5 text-sm backdrop-blur" onClick={() => step(-1)} aria-label="Previous plane">‹ Prev</button>
          <button className="btn btn-ghost !bg-night/80 !px-3 !py-1.5 text-sm backdrop-blur" onClick={() => step(1)} aria-label="Next plane">Next ›</button>
          {selected && <button className="btn btn-ghost !bg-night/80 !px-3 !py-1.5 text-sm backdrop-blur" onClick={() => setSelected(null)}>Whole hall</button>}
        </div>
      </div>

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
            <Link href={`/collection?plane=${current.id}`} className="btn btn-primary flex-1 !py-2">Full details</Link>
            <button className="btn btn-ghost !py-2" onClick={() => setSelected(null)}>Close</button>
          </div>
        </aside>
      )}
    </div>
  );
}
