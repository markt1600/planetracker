"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { scaleFact } from "@/lib/facts";
import { scaleDenominator } from "@/lib/format";
import { liveryFor, shapeFor } from "@/lib/planeShape";
import { buildPlane, GROUND, plaqueTexture, type Exhibit } from "./plane3d";
import PlaneImage from "./PlaneImage";

const PITCH = 17; // width of one aircraft stand
const ROW = 23; // depth of one row of stands

type Weather = { name: string; icon: string; sky: [number, string][]; fog: string; sun: string; sunPower: number; ambient: number; clouds: string; cloudOpacity: number; stars?: boolean; rain?: boolean; exposure: number };
const WEATHER: Weather[] = [
  { name: "Clear day", icon: "☀️", sky: [[0, "#1f6fd0"], [0.55, "#5aa6ec"], [1, "#b5dbf7"]], fog: "#b5dbf7", sun: "#fff6e0", sunPower: 3.4, ambient: 2.6, clouds: "#ffffff", cloudOpacity: 0.9, exposure: 1.0 },
  { name: "Sunset", icon: "🌇", sky: [[0, "#1a2350"], [0.45, "#4a4a86"], [0.75, "#d7786a"], [0.92, "#f6b06a"], [1, "#ffd9a0"]], fog: "#a4788a", sun: "#ffb070", sunPower: 2.8, ambient: 1.7, clouds: "#ffc6a6", cloudOpacity: 0.85, exposure: 1.1 },
  { name: "Night", icon: "🌙", sky: [[0, "#03050c"], [0.7, "#0b1430"], [1, "#1c2a55"]], fog: "#0d1630", sun: "#9db8ff", sunPower: 0.9, ambient: 0.75, clouds: "#3b4a70", cloudOpacity: 0.45, stars: true, exposure: 1.0 },
  { name: "Tropical rain", icon: "🌧️", sky: [[0, "#39424f"], [0.6, "#6a7684"], [1, "#98a3ad"]], fog: "#7f8b97", sun: "#dfe6ee", sunPower: 1.3, ambient: 1.9, clouds: "#5b6570", cloudOpacity: 0.95, rain: true, exposure: 0.95 },
];
/** Start with weather that matches the visitor's time of day. */
const weatherForNow = () => { const h = new Date().getHours(); return h >= 7 && h < 17 ? 0 : h >= 17 && h < 19 ? 1 : 2; };

export default function Airport({ exhibits, initial }: { exhibits: Exhibit[]; initial?: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const focus = useRef<(id: string | null) => void>(() => {});
  const [selected, setSelected] = useState<string | null>(initial && exhibits.some((e) => e.id === initial) ? initial : null);
  const [failed, setFailed] = useState(false);
  const [weather, setWeather] = useState(weatherForNow);
  const applyWeather = useRef<(w: Weather) => void>(() => {});
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
    // Sky dome: the gradient is repainted whenever the weather changes.
    const sky = document.createElement("canvas");
    sky.width = 4;
    sky.height = 256;
    const skyTex = new THREE.CanvasTexture(sky);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const dome3 = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.12), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
    scene.add(dome3);
    scene.fog = new THREE.Fog("#2a2f4c", 160, 620);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);

    // ---- Layout: a U-shaped terminal. Stands line the main building and both piers, nose-in. ----
    const n = order.length;
    const front = Math.min(n, Math.max(Math.min(n, 3), Math.min(18, Math.ceil(n * 0.44))));
    const perPier = Math.ceil((n - front) / 2);
    const width = front * PITCH;
    const faceZ = 0; // glass front of the main terminal
    const setback = ROW / 2 + 5; // stand centre to the building it faces
    const pierX = width / 2 + ROW + 7; // inner face of each pier
    const pierLen = perPier ? setback + ROW / 2 + 10 + perPier * PITCH : 0;
    const depth = Math.max(pierLen, ROW + 30);
    const stands = order.map((_, i) => {
      if (i < front) return { x: (i - (front - 1) / 2) * PITCH, z: setback, turn: 0 };
      const j = i - front;
      const side = j % 2 === 0 ? -1 : 1;
      return { x: side * (pierX - setback), z: setback + ROW / 2 + 10 + PITCH / 2 + Math.floor(j / 2) * PITCH, turn: (-side * Math.PI) / 2 };
    });
    const centre = new THREE.Vector3(0, 0, depth * 0.5);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...extra });
    const put = <T extends THREE.Object3D>(mesh: T, x: number, y: number, z: number) => { mesh.position.set(x, y, z); scene.add(mesh); return mesh; };
    const flat = (w: number, d: number, material: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material); m.rotation.x = -Math.PI / 2; return put(m, x, y, z); };
    const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

    // Ground: grass, the sea beyond the runway (Changi sits on the coast) and a concrete apron with panel joints.
    flat(3000, 3000, std("#31513a", { roughness: 1 }), 0, -0.08, 0);
    const sea = flat(3000, 900, new THREE.MeshStandardMaterial({ color: "#1d4f6e", roughness: 0.18, metalness: 0.7 }), 0, -0.06, -760);
    const concrete = canvasTex(512, 512, (g) => {
      g.fillStyle = "#8d939c";
      g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${0.02 + ((i * 7) % 10) / 300})`; g.fillRect((i * 193) % 512, (i * 71) % 512, 2 + (i % 3), 2 + (i % 2)); }
      g.strokeStyle = "rgba(40,44,52,0.55)";
      g.lineWidth = 2;
      for (let k = 0; k <= 512; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 512); g.moveTo(0, k); g.lineTo(512, k); g.stroke(); }
    });
    concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping;
    const apronW = pierX * 2 + 60;
    const apronD = depth + 110;
    concrete.repeat.set(apronW / 24, apronD / 24);
    const apronMat = new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.9, metalness: 0.05 });
    const apron = flat(apronW, apronD, apronMat, 0, 0, apronD / 2 - 40);
    apron.receiveShadow = true;
    const yellow = new THREE.MeshBasicMaterial({ color: "#f2c230" });
    const white = new THREE.MeshBasicMaterial({ color: "#e8ecf2" });
    const red = new THREE.MeshBasicMaterial({ color: "#c8372d" });
    // Taxilane through the middle of the U, out to the taxiway in front.
    flat(0.4, depth + 30, yellow, 0, 0.02, depth / 2 + setback + 18);
    flat(apronW - 20, 0.4, yellow, 0, 0.02, depth + 44);
    const laneLights: THREE.Vector3[] = [];
    for (let z = setback + ROW; z < depth + 44; z += 9) laneLights.push(new THREE.Vector3(0, 0.15, z));
    for (let x = -apronW / 2 + 12; x < apronW / 2 - 12; x += 9) laneLights.push(new THREE.Vector3(x, 0.15, depth + 44));
    scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(laneLights), new THREE.PointsMaterial({ color: "#5dff9a", size: 0.55 })));
    const edge: THREE.Vector3[] = [];
    for (let x = -apronW / 2; x <= apronW / 2; x += 10) edge.push(new THREE.Vector3(x, 0.2, apronD - 40));
    scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(edge), new THREE.PointsMaterial({ color: "#4f8dff", size: 0.7 })));

    // Runway behind the terminal with touchdown markings and edge lights.
    const runwayZ = -150;
    flat(1700, 30, std("#2b2f36", { roughness: 0.92 }), 0, -0.03, runwayZ).receiveShadow = true;
    for (let x = -820; x <= 820; x += 26) flat(13, 0.8, white, x, 0, runwayZ);
    for (const end of [-1, 1]) for (let k = -5; k <= 5; k++) if (k) flat(16, 1.3, white, end * 800, 0, runwayZ + k * 2.3);
    flat(1700, 14, std("#2b2f36", { roughness: 0.92 }), 0, -0.03, runwayZ + 48); // parallel taxiway
    flat(1700, 0.3, yellow, 0, 0, runwayZ + 48);
    const rl: THREE.Vector3[] = [];
    for (let x = -840; x <= 840; x += 20) rl.push(new THREE.Vector3(x, 0.3, runwayZ + 15.6), new THREE.Vector3(x, 0.3, runwayZ - 15.6));
    scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(rl), new THREE.PointsMaterial({ color: "#fff1c4", size: 1.3 })));

    // ---- Buildings ----
    const windows = (cols2: number, rows2: number, warm = 0.75) => canvasTex(cols2 * 16, rows2 * 32, (g) => {
      g.fillStyle = "#0b1c28";
      g.fillRect(0, 0, cols2 * 16, rows2 * 32);
      for (let x = 0; x < cols2; x++) for (let y = 0; y < rows2; y++) {
        const r = ((x * 73 + y * 151) % 100) / 100;
        g.globalAlpha = 0.5 + r * 0.5;
        g.fillStyle = r < warm ? "#ffdca6" : "#8fd9e0";
        g.fillRect(x * 16 + 2, y * 32 + 4, 12, 25);
      }
    });
    const wall = std("#dfe4ec", { roughness: 0.55 });
    const roofMat = std("#f4f6fa", { roughness: 0.35, metalness: 0.35, side: THREE.DoubleSide });
    const glazing = (w: number, h: number) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: windows(Math.max(8, Math.round(w / 2.2)), 3) }));
    const building = (w: number, h: number, d: number, x: number, z: number) => { const m = put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall), x, h / 2, z); m.castShadow = true; m.receiveShadow = true; return m; };

    // Main terminal: glass hall under a broad overhanging roof with rows of skylights, after Terminal 3.
    const termW = pierX * 2 + 28;
    building(termW, 14, 34, 0, faceZ - 17);
    put(glazing(termW - 3, 11), 0, 7, faceZ + 0.08);
    const roofTex = canvasTex(512, 128, (g) => { g.fillStyle = "#eef1f6"; g.fillRect(0, 0, 512, 128); g.fillStyle = "#9fb4c8"; for (let x = 6; x < 512; x += 16) for (let y = 10; y < 128; y += 24) g.fillRect(x, y, 9, 14); });
    roofTex.wrapS = THREE.RepeatWrapping;
    roofTex.repeat.x = Math.max(2, Math.round(termW / 70));
    const roof = put(new THREE.Mesh(new THREE.BoxGeometry(termW + 10, 1.1, 46), new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.4, metalness: 0.3 })), 0, 14.8, faceZ - 15);
    roof.castShadow = true;
    for (let x = -termW / 2 + 4; x <= termW / 2 - 4; x += 12) put(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 14, 8), wall), x, 7, faceZ + 5.5);
    const sign = canvasTex(1024, 96, (g) => { g.font = "600 62px Georgia, serif"; g.textAlign = "center"; g.fillStyle = "#fff0cf"; g.fillText("SINGAPORE  CHANGI  AIRPORT", 512, 68); });
    put(new THREE.Mesh(new THREE.PlaneGeometry(58, 5.4), new THREE.MeshBasicMaterial({ map: sign, transparent: true })), 0, 18.6, faceZ + 7.4);
    put(new THREE.Mesh(new THREE.BoxGeometry(60, 0.3, 0.3), wall), 0, 15.6, faceZ + 7.4);

    // Piers on both sides, with curved roofs and glazing facing the stands.
    if (perPier) for (const side of [-1, 1]) {
      const cx = side * (pierX + 7);
      building(14, 8, pierLen, cx, pierLen / 2 - 2);
      const g1 = glazing(pierLen - 4, 5.5);
      g1.rotation.y = (-side * Math.PI) / 2;
      put(g1, side * (pierX - 0.08), 4.4, pierLen / 2 - 2);
      const pr = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, pierLen + 3, 24, 1, false, -0.85, 1.7), roofMat);
      pr.rotation.x = Math.PI / 2;
      pr.rotation.z = Math.PI;
      pr.castShadow = true;
      put(pr, cx, 1.9, pierLen / 2 - 2);
      const hall = put(new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 9, 28), wall), cx, 4.5, pierLen + 6); // rounded end of the pier
      hall.castShadow = true;
      put(new THREE.Mesh(new THREE.CylinderGeometry(11.1, 11.1, 4.5, 28, 1, true), new THREE.MeshBasicMaterial({ map: windows(40, 2) })), cx, 4.6, pierLen + 6);
      put(new THREE.Mesh(new THREE.CylinderGeometry(12.5, 12.5, 0.7, 28), roofMat), cx, 9.3, pierLen + 6);
    }

    // Control tower: Changi's landmark — a slender fluted shaft opening into a wide, stacked cab.
    const tx = Math.min(termW / 2 - 30, 46);
    const tz = faceZ - 62;
    const towerMat = std("#eef0f4", { roughness: 0.5 });
    const cabGlass = new THREE.MeshStandardMaterial({ color: "#0f2a38", emissive: "#7fe0ea", emissiveIntensity: 1.1, roughness: 0.15, metalness: 0.4 });
    const tower = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => { const m = put(new THREE.Mesh(geo, mat), tx, y, tz); m.castShadow = true; return m; };
    tower(new THREE.CylinderGeometry(4.2, 5.2, 6, 32), towerMat, 3);
    tower(new THREE.CylinderGeometry(2.3, 3.4, 58, 12), towerMat, 35);
    for (let k = 0; k < 6; k++) { const fin = tower(new THREE.BoxGeometry(0.5, 58, 7.2), towerMat, 35); fin.rotation.y = (k * Math.PI) / 6; }
    tower(new THREE.CylinderGeometry(10.5, 2.6, 9, 40), towerMat, 68.5);
    tower(new THREE.CylinderGeometry(11.8, 11.8, 1.3, 48), towerMat, 73.6);
    tower(new THREE.CylinderGeometry(10.2, 9, 4.2, 40), cabGlass, 76.3);
    tower(new THREE.CylinderGeometry(11.2, 11.2, 1, 48), towerMat, 78.9);
    tower(new THREE.CylinderGeometry(7, 6.2, 3.4, 32), cabGlass, 81.1);
    tower(new THREE.CylinderGeometry(7.8, 7.8, 0.9, 40), towerMat, 83.2);
    tower(new THREE.CylinderGeometry(3.2, 3.6, 2.4, 24), towerMat, 84.8);
    tower(new THREE.SphereGeometry(2.3, 20, 14), towerMat, 87.4);
    tower(new THREE.CylinderGeometry(0.14, 0.14, 9, 6), towerMat, 93);
    const beacon = put(new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), new THREE.MeshBasicMaterial({ color: "#ff3b3b" })), tx, 97.8, tz);

    // Jewel: the glass-and-steel torus dome, with its lattice and a glow from the gardens inside.
    const jx = -Math.min(termW / 2 - 40, 50);
    const jz = faceZ - 78;
    const jewelGeo = new THREE.SphereGeometry(34, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2);
    const jewel = put(new THREE.Mesh(jewelGeo, new THREE.MeshStandardMaterial({ color: "#9fd8d2", emissive: "#3fb89f", emissiveIntensity: 0.45, roughness: 0.08, metalness: 0.75, transparent: true, opacity: 0.82 })), jx, 0, jz);
    jewel.scale.y = 0.42;
    const lattice = put(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(34.15, 30, 9, 0, Math.PI * 2, 0, Math.PI / 2)), new THREE.LineBasicMaterial({ color: "#e9f4f3", transparent: true, opacity: 0.5 })), jx, 0, jz);
    lattice.scale.y = 0.42;
    put(new THREE.Mesh(new THREE.CylinderGeometry(4.5, 3, 1.6, 24, 1, true), std("#d7e6e4", { side: THREE.DoubleSide })), jx, 13.6, jz); // the oculus above the waterfall
    const jewelLight = put(new THREE.PointLight("#58e0c0", 600, 140), jx, 10, jz);

    // Singapore's skyline across the water: Marina Bay Sands, the Flyer, the Esplanade domes and the CBD towers.
    const skylineMat = new THREE.MeshBasicMaterial({ color: "#223046" });
    const skyline = new THREE.Group();
    const block = (w: number, h: number, x: number, d = 10) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skylineMat); m.position.set(x, h / 2, 0); skyline.add(m); return m; };
    // Marina Bay Sands: three leaning towers joined by the SkyPark, which overhangs at one end.
    for (const k of [-1, 0, 1]) block(9, 44, -150 + k * 15);
    const skypark = block(60, 3.2, -146);
    skypark.position.y = 46;
    // Singapore Flyer.
    const flyer = new THREE.Mesh(new THREE.TorusGeometry(24, 0.9, 8, 64), skylineMat);
    flyer.position.set(-235, 27, 0);
    skyline.add(flyer);
    for (let k = 0; k < 8; k++) { const spoke = new THREE.Mesh(new THREE.BoxGeometry(48, 0.3, 0.3), skylineMat); spoke.position.copy(flyer.position); spoke.rotation.z = (k * Math.PI) / 8; skyline.add(spoke); }
    block(3, 27, -243, 3).rotation.z = 0.25;
    block(3, 27, -227, 3).rotation.z = -0.25;
    // Esplanade "durian" domes and the ArtScience Museum's lotus.
    for (const x of [-70, -48]) { const dome2 = new THREE.Mesh(new THREE.SphereGeometry(11, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), skylineMat); dome2.scale.set(1.3, 0.6, 1); dome2.position.set(x, 0, 0); skyline.add(dome2); }
    for (let k = -2; k <= 2; k++) { const petal = block(3, 13, -105 + k * 3.4, 3); petal.rotation.z = -k * 0.28; }
    // Central business district: a tight cluster, tallest in the middle (Guoco Tower, UOB Plaza, Republic Plaza, OUB Centre).
    const cbd: [number, number, number][] = [[14, 46, 0], [12, 62, 16], [13, 78, 31], [11, 88, 45], [14, 84, 59], [12, 70, 74], [10, 92, 87], [13, 66, 101], [12, 54, 116], [15, 40, 132], [10, 74, 146], [12, 48, 160], [9, 58, 20], [8, 36, 110], [11, 30, 176], [14, 24, 194]];
    for (const [w, h, x] of cbd) block(w, h, x, 12);
    const crown = block(6, 8, 87);
    crown.position.y = 96; // spire-like top on the tallest tower
    // Lower housing blocks trailing off to either side.
    for (let i = 0; i < 26; i++) block(12 + (i % 3) * 5, 10 + ((i * 37) % 16), (i < 13 ? -560 + i * 22 : 230 + (i - 13) * 24) + ((i * 7) % 6));
    skyline.position.set(40, 0, -1120);
    skyline.scale.setScalar(1.25);
    scene.add(skyline);

    // Apron floodlights: tall masts at the head of the piers and along the terminal.
    const lampMat = new THREE.MeshBasicMaterial({ color: "#fff3d0" });
    const masts: THREE.Vector3[] = [];
    for (let x = -pierX + 4; x <= pierX - 4; x += Math.max(34, (pierX * 2 - 8) / 5)) masts.push(new THREE.Vector3(x, 0, faceZ + 3.5));
    if (perPier) for (const side of [-1, 1]) for (let z = 40; z < pierLen; z += 51) masts.push(new THREE.Vector3(side * (pierX - 2.5), 0, z));
    for (const m of masts) {
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 22, 8), std("#aab2c0", { metalness: 0.7, roughness: 0.3 })), m.x, 11, m.z);
      put(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 0.6), lampMat), m.x, 22.2, m.z);
    }

    const hemi = new THREE.HemisphereLight("#b9cdfa", "#4a4a44", 1.7);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight("#ffd7a8", 2.6);
    sun.position.set(centre.x - 110, 130, centre.z + 150);
    sun.target.position.copy(centre);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const reach = Math.max(pierX + 40, depth * 0.7 + 50);
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 10, far: 520 });
    sun.shadow.bias = -0.0006;
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight("#8fb8ff", 0.8);
    fill.position.set(80, 60, -90);
    scene.add(fill);

    const poleMat = new THREE.MeshStandardMaterial({ color: "#8a94a6", roughness: 0.25, metalness: 0.9 });
    const bridgeMat = std("#e3e8ef", { roughness: 0.45, metalness: 0.2 });
    const bridgeGlass = new THREE.MeshBasicMaterial({ color: "#7fc4d6" });
    const truck = [std("#f4f4f2"), std("#f2c230"), std("#2f6fd0"), std("#d84a3a")];
    const tyre = std("#16181d");
    const planes = new Map<string, { root: THREE.Group; ring: THREE.Mesh; size: number }>();
    const pickable: THREE.Object3D[] = [];

    order.forEach((e, i) => {
      const shape = shapeFor(e.family, e.aircraft);
      // Bigger scales get bigger aircraft, but everything stays inside its stand.
      const d = scaleDenominator(e.scale) ?? 400;
      const k = Math.min(1.35, Math.max(0.8, Math.sqrt(400 / d))) * 0.2;
      const fit = Math.min(1, (PITCH * 0.9) / (shape.span * k), (ROW * 0.74) / (shape.length * k));
      const s = k * fit;
      const size = Math.max(shape.length, shape.span) * s;
      const half = (shape.length * s) / 2;

      // Everything on a stand is built facing local -Z (towards its building), then the stand is turned.
      const root = new THREE.Group();
      root.position.set(stands[i].x, 0, stands[i].z);
      root.rotation.y = stands[i].turn;
      root.userData.id = e.id;

      const plane = buildPlane(shape, liveryFor(e.airline), true);
      plane.scale.setScalar(s);
      plane.rotation.y = Math.PI / 2;
      plane.position.set(0, shape.radius * GROUND * s, 1);
      plane.traverse((o) => { o.castShadow = true; });

      // Stand markings: lead-in line, stop bar, red safety outline, stand number and a selection ring.
      const mark = (w: number, dz: number, mat: THREE.Material, x: number, z: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, dz), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); root.add(m); };
      mark(0.26, ROW * 0.9, yellow, 0, 1.2);
      mark(2.6, 0.26, yellow, 0, 1 - half);
      for (const sx of [-1, 1]) mark(0.16, ROW * 0.82, red, sx * (PITCH / 2 - 0.5), 1);
      const num = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), new THREE.MeshBasicMaterial({ map: canvasTex(128, 64, (g) => { g.fillStyle = "#f2c230"; g.font = "700 52px ui-monospace, monospace"; g.textAlign = "center"; g.fillText(`${i < front ? "A" : (i - front) % 2 ? "C" : "B"}${(i < front ? i : Math.floor((i - front) / 2)) + 1}`, 64, 50); }), transparent: true }));
      num.rotation.x = -Math.PI / 2;
      num.position.set(-PITCH / 2 + 2.6, 0.035, ROW * 0.38);
      const ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.57, size * 0.57 + 0.2, 72), new THREE.MeshBasicMaterial({ color: "#f6b84b", transparent: true, opacity: 0, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.05, 1);

      // Placard behind the tail, angled up towards the visitor.
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.9), new THREE.MeshBasicMaterial({ map: plaqueTexture(e) }));
      plaque.position.set(0, 1.25, ROW * 0.47);
      plaque.rotation.x = -0.5;
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), poleMat);
      stand.position.set(0, 0.5, ROW * 0.47 - 0.35);

      // Jet bridge: rotunda at the building, a glazed tunnel, and a cab at the forward door.
      const doorY = plane.position.y + shape.radius * s * 0.1;
      const from = new THREE.Vector3(-shape.radius * s - 0.75, doorY, 1 - half * 0.56);
      const to = new THREE.Vector3(-4.6, 3.6, -setback + 1.2);
      const len = from.distanceTo(to);
      const tunnel = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, len), bridgeMat);
      tunnel.position.copy(from).add(to).multiplyScalar(0.5);
      tunnel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), to.clone().sub(from).normalize());
      tunnel.castShadow = true;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, len * 0.92), bridgeGlass);
      strip.position.copy(tunnel.position);
      strip.quaternion.copy(tunnel.quaternion);
      const rotunda = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.3, 16), bridgeMat);
      rotunda.position.copy(to);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.15, 1.3), bridgeMat);
      cab.position.copy(from);
      const legA = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, to.y, 8), poleMat);
      legA.position.set(to.x, to.y / 2, to.z);
      const legB = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, from.y, 8), poleMat);
      legB.position.set(from.x - 0.3, from.y / 2, from.z + 0.2);
      const link = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 3), bridgeMat);
      link.position.set(to.x, to.y, to.z - 1.6);

      // A little ground crew: a pushback tug at the nose and a baggage train by the wing.
      const car = (w: number, h: number, l: number, mat: THREE.Material, x: number, z: number, yaw = 0) => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
        body.position.y = h / 2 + 0.12;
        body.castShadow = true;
        g.add(body);
        for (const wx of [-1, 1]) for (const wz of [-1, 1]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 8), tyre); t.rotation.z = Math.PI / 2; t.position.set(wx * w * 0.5, 0.13, wz * l * 0.32); g.add(t); }
        g.position.set(x, 0, z);
        g.rotation.y = yaw;
        root.add(g);
      };
      car(0.8, 0.35, 1.4, truck[1], 0.2, -half - 0.6);
      const bx = Math.min(PITCH / 2 - 1.6, shape.radius * s + 2.6);
      car(0.6, 0.5, 0.9, truck[(i % 3) + 1], bx, 2.2, 0.2);
      for (let c = 0; c < 3; c++) car(0.6, 0.42, 0.85, truck[0], bx + 0.25 * (c + 1), 3.35 + c * 1.1, 0.2);
      if (i % 2 === 0) car(0.85, 0.75, 2, truck[0], -bx, 4.5, -0.3); // catering / fuel truck

      root.add(plane, num, ring, plaque, stand, tunnel, strip, rotunda, cab, legA, legB, link);
      scene.add(root);
      planes.set(e.id, { root, ring, size });
      pickable.push(plane, plaque);
    });

    // Clouds: soft sprites drifting on the wind.
    const puff = document.createElement("canvas");
    puff.width = puff.height = 256;
    const pg = puff.getContext("2d")!;
    for (const [cx, cy, r] of [[128, 150, 70], [84, 160, 52], [176, 158, 56], [112, 118, 50], [152, 116, 46]]) {
      const g2 = pg.createRadialGradient(cx, cy, 0, cx, cy, r);
      g2.addColorStop(0, "rgba(255,255,255,0.95)");
      g2.addColorStop(1, "rgba(255,255,255,0)");
      pg.fillStyle = g2;
      pg.fillRect(0, 0, 256, 256);
    }
    const cloudMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(puff), transparent: true, depthWrite: false, fog: false });
    const clouds: THREE.Sprite[] = [];
    for (let i = 0; i < 22; i++) {
      const c = new THREE.Sprite(cloudMat);
      const w = 90 + ((i * 53) % 110);
      c.scale.set(w, w * 0.5, 1);
      c.position.set(-620 + ((i * 197) % 1240), 90 + ((i * 37) % 120), -200 - ((i * 71) % 520));
      scene.add(c);
      clouds.push(c);
    }
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 500 }, (_, i) => { const a = (i * 2.399) % (Math.PI * 2); const h = 0.12 + ((i * 0.618) % 1) * 0.88; const r = Math.sqrt(1 - h * h); return new THREE.Vector3(Math.cos(a) * r * 760, h * 760, Math.sin(a) * r * 760); })),
      new THREE.PointsMaterial({ color: "#ffffff", size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }),
    );
    scene.add(stars);
    const RAIN = 1800;
    const rainPos = new Float32Array(RAIN * 3);
    for (let i = 0; i < RAIN; i++) { rainPos[i * 3] = -160 + ((i * 97) % 320); rainPos[i * 3 + 1] = (i * 13) % 90; rainPos[i * 3 + 2] = -150 + ((i * 61) % 300); }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: "#cfe2f5", size: 0.5, transparent: true, opacity: 0.55, fog: false }));
    scene.add(rain);

    // Floodlights only switch on after dark (a handful, to stay fast on phones).
    const floods = masts.filter((_, i) => i % Math.ceil(masts.length / 6) === 0).map((m) => { const l = new THREE.PointLight("#ffe2b0", 0, 150, 1.6); l.position.set(m.x, 21, m.z + 2); scene.add(l); return l; });
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    applyWeather.current = (w) => {
      const sg = sky.getContext("2d")!;
      const grad = sg.createLinearGradient(0, 0, 0, 256);
      // The dome's texture runs from the zenith (top) to just below the horizon (bottom).
      for (const [stop, color] of w.sky) grad.addColorStop(stop * 0.93, color);
      grad.addColorStop(1, w.sky[w.sky.length - 1][1]);
      sg.fillStyle = grad;
      sg.fillRect(0, 0, 4, 256);
      skyTex.needsUpdate = true;
      (scene.fog as THREE.Fog).color.set(w.fog);
      sun.color.set(w.sun);
      sun.intensity = w.sunPower;
      hemi.intensity = w.ambient;
      cloudMat.color.set(w.clouds);
      cloudMat.opacity = w.cloudOpacity;
      stars.visible = Boolean(w.stars);
      rain.visible = Boolean(w.rain);
      const dark = Boolean(w.stars);
      apronMat.roughness = w.rain ? 0.32 : 0.9; // wet concrete shines
      apronMat.metalness = w.rain ? 0.45 : 0.05;
      (sea.material as THREE.MeshStandardMaterial).color.set(dark ? "#0a1c30" : w.rain ? "#4b6170" : "#1d5f86");
      skylineMat.color.set(dark ? "#0c1424" : w.rain ? "#5d6873" : w.name === "Sunset" ? "#4a3f63" : "#6f8db4");
      cabGlass.emissiveIntensity = dark ? 1.6 : 0.35;
      (jewel.material as THREE.MeshStandardMaterial).emissiveIntensity = dark ? 0.9 : 0.2;
      jewelLight.intensity = dark ? 220 : 0;
      lampMat.color.set(dark || w.rain ? "#fff3d0" : "#c9ced6");
      for (const l of floods) l.intensity = dark ? 170 : w.rain ? 35 : 0;
      sun.castShadow = !dark;
      bloom.strength = dark ? 0.32 : w.name === "Sunset" ? 0.16 : 0;
      renderer.toneMappingExposure = w.exposure;
    };
    applyWeather.current(WEATHER[weatherForNow()]);

    // Background traffic: one aircraft departing and one arriving on the far runway, on a loop.
    const TRAFFIC: [string, string | undefined, string][] = [["Airbus A350", "A350-900", "Singapore Airlines"], ["Boeing 777", "777-300ER", "Emirates"], ["Airbus A380", "A380", "Qantas"], ["Boeing 787", "787-9", "Scoot"], ["Airbus A320 family", "A320", "AirAsia"], ["Boeing 747", "747-400F", "Cathay Pacific"], ["Airbus A330", "A330-300", "Garuda"], ["Boeing 737", "737-800", "Malaysia Airlines"]];
    const flights = [0, 1].map((n) => {
      const yaw = new THREE.Group();
      const pitch = new THREE.Group();
      yaw.add(pitch);
      yaw.visible = false;
      scene.add(yaw);
      return { yaw, pitch, landing: n === 1, wait: n === 1 ? 3 : 9, x: 0, v: 0, y: 0, pick: n * 3, ground: 0 };
    });
    const launch = (f: (typeof flights)[number]) => {
      for (const child of [...f.pitch.children]) { f.pitch.remove(child); child.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); }); }
      const [family, type, airline] = TRAFFIC[f.pick++ % TRAFFIC.length];
      const shape = shapeFor(family, type);
      const model = buildPlane(shape, liveryFor(airline), true);
      model.scale.setScalar(0.34);
      f.pitch.add(model);
      f.ground = shape.radius * GROUND * 0.34;
      f.yaw.rotation.y = f.landing ? Math.PI : 0;
      f.x = f.landing ? 640 : -330;
      f.v = f.landing ? 62 : 0;
      f.y = 0;
      f.yaw.visible = true;
    };
    const fly = (f: (typeof flights)[number], dt: number) => {
      if (!f.yaw.visible) { f.wait -= dt; if (f.wait <= 0) launch(f); return; }
      let nose = 0;
      if (f.landing) {
        const touchdown = 120;
        if (f.x > touchdown) { f.y = (f.x - touchdown) * 0.11; nose = f.x - touchdown < 90 ? 0.1 : 0.04; }
        else { f.y = 0; f.v = Math.max(14, f.v - 16 * dt); }
        f.x -= f.v * dt;
        if (f.x < -340) { f.yaw.visible = false; f.wait = 7 + (f.pick % 4) * 3; }
      } else {
        f.v = Math.min(70, f.v + 11 * dt);
        if (f.v > 46) { nose = Math.min(0.26, (f.v - 46) * 0.03); f.y += f.v * Math.sin(nose) * dt; }
        f.x += f.v * dt;
        if (f.x > 760) { f.yaw.visible = false; f.wait = 6 + (f.pick % 3) * 4; }
      }
      f.pitch.rotation.z += (nose - f.pitch.rotation.z) * Math.min(1, dt * 2);
      f.yaw.position.set(f.x, f.ground + f.y, runwayZ);
    };

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minDistance = 6;
    controls.maxDistance = Math.max(pierX * 2, depth) + 160;
    controls.autoRotateSpeed = 0.7;
    controls.screenSpacePanning = false;
    const portrait = el.clientWidth < el.clientHeight * 0.8; // phones held upright need to stand further back
    const span = Math.max(pierX * 1.25, depth * 0.95, 46) * (portrait ? 1.7 : 1);
    const overview = { pos: new THREE.Vector3(-span * 0.32, span * 0.5 + 8, depth + span * 0.62 + 10), target: new THREE.Vector3(0, 6, depth * 0.3) };
    camera.position.copy(overview.pos);
    controls.target.copy(overview.target);

    // Camera glides to the chosen exhibit; any manual drag cancels the glide.
    let goal: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
    let active: string | null = null;
    controls.addEventListener("start", () => { goal = null; controls.autoRotate = false; });
    focus.current = (id) => {
      active = id;
      const hit = id ? planes.get(id) : null;
      controls.autoRotate = false;
      if (!hit) { goal = { pos: overview.pos.clone(), target: overview.target.clone() }; return; }
      const p = hit.root.position;
      const r = (hit.size * 1.0 + 12) * (portrait ? 1.35 : 1);
      // Stand behind the tail, a little to one side, looking towards the building.
      const back = new THREE.Vector3(0.35, 0, 1).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), hit.root.rotation.y);
      goal = { target: new THREE.Vector3(p.x, portrait ? 1.8 - r * 0.2 : 1.8, p.z), pos: new THREE.Vector3(p.x + back.x * r, 4 + r * 0.5, p.z + back.z * r) }; // on phones the info card covers the bottom, so frame the plane higher
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
      composer.setSize(w, h);
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
        if (camera.position.distanceTo(goal.pos) < 0.15) {
          goal = null;
          controls.autoRotate = Boolean(active) && !still; // slow walk-around of the chosen aircraft
        }
      }
      for (const [id, p] of planes) (p.ring.material as THREE.MeshBasicMaterial).opacity = id === active ? 0.95 : 0;
      if (!still) {
        for (const f of flights) fly(f, dt);
        for (const c of clouds) { c.position.x += dt * 2.2; if (c.position.x > 640) c.position.x = -640; }
        if (rain.visible) {
          const pa = rainGeo.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < RAIN; i++) { let y = pa.getY(i) - dt * 70; if (y < 0) y += 90; pa.setY(i, y); }
          pa.needsUpdate = true;
          rain.position.set(camera.position.x, 0, camera.position.z);
        }
      }
      controls.update();
      beacon.visible = Math.floor(clock.elapsedTime * 1.2) % 2 === 0;
      if (bloom.strength > 0) composer.render();
      else renderer.render(scene, camera);
    };
    tick();
    (window as unknown as { __museumReady?: boolean }).__museumReady = true;

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      composer.dispose();
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
  useEffect(() => applyWeather.current(WEATHER[weather]), [weather]);

  const step = (dir: number) => {
    const i = order.findIndex((e) => e.id === selected);
    setSelected(order[(i + dir + order.length) % order.length].id);
  };
  const sizeNote = current ? scaleFact(current.family, current.scale, current.aircraft) : null;

  if (!order.length) {
    return (
      <div className="panel p-10 text-center">
        <h2 className="font-display text-2xl">The apron is empty</h2>
        <p className="mt-2 text-mute">Add a plane and it will be parked here at its own gate.</p>
        <Link href="/add" className="btn btn-primary mt-5">+ Add a plane</Link>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-13rem)] min-h-[26rem] sm:h-[calc(100dvh-11rem)] overflow-hidden rounded-3xl border border-line bg-night">
      <div ref={mount} className="absolute inset-0" />
      {failed && <p className="absolute inset-0 grid place-items-center p-6 text-center text-mute">This device can&rsquo;t show 3D graphics. The collection page has everything in 2D.</p>}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
        <button className="btn btn-ghost pointer-events-auto !bg-night/80 !px-3 !py-1.5 text-sm backdrop-blur" onClick={() => setWeather((w) => (w + 1) % WEATHER.length)} title="Change the weather" suppressHydrationWarning>
          <span aria-hidden suppressHydrationWarning>{WEATHER[weather].icon}</span> <span suppressHydrationWarning>{WEATHER[weather].name}</span>
        </button>
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
            <Link href={`/collection?plane=${current.id}&from=airport`} className="btn btn-primary flex-1 !py-2">Full details</Link>
            <button className="btn btn-ghost !py-2" onClick={() => setSelected(null)}>Close</button>
          </div>
        </aside>
      )}
    </div>
  );
}
