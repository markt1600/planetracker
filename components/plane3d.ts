import * as THREE from "three";
import type { PlaneShape } from "@/lib/planeShape";

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

export const GROUND = 1.78; // how far below the fuselage centreline the tyres touch, in fuselage radii
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
export function buildPlane(shape: PlaneShape, colors: { body: string; tail: string; engine: string; stripe?: string }, gear = false) {
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

  // Landing gear, so the aircraft can stand on the apron. The ground is at y = -GROUND * R.
  const leg = (x: number, z: number) => {
    add(new THREE.CylinderGeometry(R * 0.06, R * 0.06, R * 1.0, 8), wingMat, (m) => m.position.set(x, -R * 1.05, z));
    add(new THREE.CylinderGeometry(R * 0.24, R * 0.24, R * 0.3, 14), dark, (m) => { m.rotation.x = Math.PI / 2; m.position.set(x, -R * (GROUND - 0.24), z); });
  };
  if (gear) {
    leg(L * 0.36, 0);
    const mainX = shape.delta ? -L * 0.08 : wingX - rootChord * 0.55;
    for (const side of [1, -1]) leg(mainX, side * R * (shape.highWing ? 0.9 : 1.5));
    if (shape.engines === "wing4" && R > 3) for (const side of [1, -1]) leg(mainX - R * 1.6, side * R * 0.6);
  }
  return group;
}

export function plaqueTexture(e: Exhibit) {
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

