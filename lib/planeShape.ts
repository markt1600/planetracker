import { dimensions } from "./facts";

export type EngineLayout = "wing2" | "wing4" | "rear2" | "rear3" | "rear4" | "tri" | "prop2" | "prop4" | "none";

/** Everything the museum needs to sculpt a recognisable version of an aircraft type. Lengths in metres. */
export type PlaneShape = {
  length: number;
  span: number;
  radius: number;
  engines: EngineLayout;
  sweep: number;
  tTail?: boolean;
  highWing?: boolean;
  hump?: boolean;
  doubleDeck?: boolean;
  delta?: boolean;
  winglets?: boolean;
};

type Base = Omit<PlaneShape, "length" | "span">;

const SHAPES: Record<string, Base> = {
  "Boeing 707": { radius: 1.88, engines: "wing4", sweep: 35 },
  "Boeing 717": { radius: 1.67, engines: "rear2", sweep: 24, tTail: true },
  "Boeing 727": { radius: 1.88, engines: "rear3", sweep: 32, tTail: true },
  "Boeing 737": { radius: 1.88, engines: "wing2", sweep: 25, winglets: true },
  "Boeing 747": { radius: 3.25, engines: "wing4", sweep: 37, hump: true },
  "Boeing 757": { radius: 1.88, engines: "wing2", sweep: 25 },
  "Boeing 767": { radius: 2.51, engines: "wing2", sweep: 31 },
  "Boeing 777": { radius: 3.1, engines: "wing2", sweep: 31 },
  "Boeing 787": { radius: 2.9, engines: "wing2", sweep: 32 },
  "Airbus A220": { radius: 1.75, engines: "wing2", sweep: 25, winglets: true },
  "Airbus A300": { radius: 2.82, engines: "wing2", sweep: 28 },
  "Airbus A310": { radius: 2.82, engines: "wing2", sweep: 28 },
  "Airbus A320 family": { radius: 1.98, engines: "wing2", sweep: 25, winglets: true },
  "Airbus A330": { radius: 2.82, engines: "wing2", sweep: 30, winglets: true },
  "Airbus A340": { radius: 2.82, engines: "wing4", sweep: 30, winglets: true },
  "Airbus A350": { radius: 2.98, engines: "wing2", sweep: 32, winglets: true },
  "Airbus A380": { radius: 3.57, engines: "wing4", sweep: 33, doubleDeck: true },
  "McDonnell Douglas MD-11": { radius: 3.01, engines: "tri", sweep: 35, winglets: true },
  "McDonnell Douglas MD-80/90": { radius: 1.67, engines: "rear2", sweep: 24, tTail: true },
  "Douglas DC-3": { radius: 1.25, engines: "prop2", sweep: 8 },
  "Douglas DC-8": { radius: 1.87, engines: "wing4", sweep: 30 },
  "Douglas DC-9": { radius: 1.67, engines: "rear2", sweep: 24, tTail: true },
  "McDonnell Douglas DC-10": { radius: 3.01, engines: "tri", sweep: 35 },
  "Lockheed L-1011 TriStar": { radius: 2.98, engines: "tri", sweep: 35 },
  Concorde: { radius: 1.44, engines: "none", sweep: 60, delta: true },
  "Embraer E-Jet": { radius: 1.5, engines: "wing2", sweep: 23, winglets: true },
  "Embraer ERJ": { radius: 1.14, engines: "rear2", sweep: 22, tTail: true },
  "Bombardier CRJ": { radius: 1.35, engines: "rear2", sweep: 24, tTail: true, winglets: true },
  "ATR 42/72": { radius: 1.43, engines: "prop2", sweep: 3, tTail: true, highWing: true },
  "De Havilland Dash 8": { radius: 1.35, engines: "prop2", sweep: 3, tTail: true, highWing: true },
  "Comac C919": { radius: 1.98, engines: "wing2", sweep: 25, winglets: true },
  "Comac ARJ21": { radius: 1.67, engines: "rear2", sweep: 25, tTail: true, winglets: true },
  "Lockheed C-130 Hercules": { radius: 2.15, engines: "prop4", sweep: 0, highWing: true },
  "Boeing C-17 Globemaster": { radius: 3.4, engines: "wing4", sweep: 25, tTail: true, highWing: true, winglets: true },
  "Boeing KC-135": { radius: 1.83, engines: "wing4", sweep: 35 },
  "Lockheed C-5 Galaxy": { radius: 3.6, engines: "wing4", sweep: 25, tTail: true, highWing: true },
  Tupolev: { radius: 1.9, engines: "rear3", sweep: 35, tTail: true },
  Ilyushin: { radius: 2.4, engines: "wing4", sweep: 25, tTail: true, highWing: true },
  Antonov: { radius: 3.6, engines: "wing4", sweep: 25, highWing: true },
  Fokker: { radius: 1.65, engines: "rear2", sweep: 17, tTail: true },
  "BAe 146 / Avro RJ": { radius: 1.78, engines: "wing4", sweep: 15, tTail: true, highWing: true },
  "Lockheed Constellation": { radius: 1.75, engines: "prop4", sweep: 5 },
  "Lockheed Electra": { radius: 1.73, engines: "prop4", sweep: 3 },
  "Vickers VC10": { radius: 1.88, engines: "rear4", sweep: 32, tTail: true },
  "Sukhoi Superjet": { radius: 1.73, engines: "wing2", sweep: 25 },
};

export function shapeFor(family?: string, aircraft?: string): PlaneShape {
  const base = (family && SHAPES[family]) || { radius: 1.9, engines: "wing2" as const, sweep: 26 };
  const dim = dimensions(family, aircraft);
  const shape: PlaneShape = { ...base, length: dim?.lengthM ?? 38, span: dim?.wingspanM ?? 34 };
  // A few variants look different enough from their family to matter.
  if (/^(A300-?600ST|A330-?7)|beluga/i.test(aircraft ?? "")) shape.radius *= 1.45;
  if (/^(777|787|747-?8|A350|A220|737.*MAX)/i.test(aircraft ?? "")) shape.winglets = family !== "Boeing 777" && family !== "Boeing 787";
  return shape;
}

export type Livery = { body: string; tail: string; engine: string; stripe?: string };

const WHITE = "#f1f3f6";
const LIVERIES: [RegExp, Partial<Livery>][] = [
  [/singapore|silkair/i, { tail: "#1b2a5e", stripe: "#f5b324" }],
  [/scoot/i, { body: "#ffe500", tail: "#ffe500", engine: "#ffe500", stripe: "#222222" }],
  [/emirates/i, { tail: "#d71921", stripe: "#d71921" }],
  [/qatar/i, { body: "#dcdde0", tail: "#8a1538", engine: "#dcdde0" }],
  [/etihad/i, { body: "#e9e2d0", tail: "#bd8b13", engine: "#e9e2d0" }],
  [/lufthansa/i, { tail: "#05164d", engine: "#e3e6ea" }],
  [/british airways|boac/i, { tail: "#c8102e", stripe: "#075aaa", engine: "#0b2a6b" }],
  [/delta/i, { tail: "#c01933", engine: "#0b2a55", stripe: "#0b2a55" }],
  [/united/i, { tail: "#0033a0", engine: "#0033a0", stripe: "#6aa2e0" }],
  [/american/i, { body: "#cfd4da", tail: "#b61f23", engine: "#cfd4da", stripe: "#0a3a7a" }],
  [/southwest/i, { body: "#304cb2", tail: "#304cb2", engine: "#304cb2", stripe: "#ffbf27" }],
  [/alaska/i, { tail: "#01426a", stripe: "#5bc2e7" }],
  [/jetblue/i, { tail: "#003876", engine: "#003876" }],
  [/hawaiian/i, { tail: "#6b2c91", stripe: "#d5006d" }],
  [/air canada|rouge/i, { tail: "#111111", engine: "#111111", stripe: "#d81e05" }],
  [/westjet/i, { tail: "#00a6a0", stripe: "#00a6a0" }],
  [/cathay|dragon/i, { tail: "#005d63", stripe: "#005d63" }],
  [/all nippon|\bana\b/i, { tail: "#13448f", stripe: "#13448f" }],
  [/japan air|\bjal\b|j-air/i, { tail: WHITE, stripe: "#cc0000", engine: WHITE }],
  [/korean/i, { body: "#9ed3ea", tail: "#9ed3ea", engine: "#dfe7ee" }],
  [/asiana/i, { tail: "#6b6f76", stripe: "#c8102e" }],
  [/eva air/i, { tail: "#00694b", stripe: "#f08300" }],
  [/china airlines|mandarin/i, { tail: "#5b4a9b", stripe: "#d4567f" }],
  [/china southern/i, { tail: "#008bd0", stripe: "#008bd0" }],
  [/china eastern|shanghai/i, { tail: "#1b2a6b", stripe: "#c8102e" }],
  [/air china/i, { tail: WHITE, stripe: "#c8102e", engine: "#c8ccd2" }],
  [/hainan/i, { tail: "#c8102e", stripe: "#f5b324" }],
  [/sichuan|shenzhen|xiamen/i, { tail: "#c8102e" }],
  [/thai/i, { tail: "#4b2a7b", stripe: "#e0a526" }],
  [/malaysia/i, { tail: "#0b2a5e", stripe: "#c8102e" }],
  [/airasia|air asia/i, { body: "#e4002b", tail: "#e4002b", engine: "#e4002b" }],
  [/garuda/i, { tail: "#0a6a85", stripe: "#0a6a85" }],
  [/philippine/i, { tail: "#0b2a6b", stripe: "#c8102e" }],
  [/vietnam/i, { body: "#0d5c75", tail: "#0d5c75", engine: "#0d5c75" }],
  [/qantas|jetstar/i, { tail: "#e40000", engine: WHITE }],
  [/air new zealand/i, { tail: "#111111", stripe: "#111111" }],
  [/virgin/i, { tail: "#e10a0a", engine: "#e10a0a" }],
  [/klm/i, { body: "#00a1de", tail: "#00a1de", engine: "#f1f3f6", stripe: "#0b2a6b" }],
  [/air france/i, { tail: "#002157", stripe: "#c8102e" }],
  [/swiss|austrian|turkish|air india|northwest/i, { tail: "#c8102e" }],
  [/iberia/i, { tail: "#d7192d", stripe: "#f5b324" }],
  [/tap\b|aer lingus|cathay/i, { tail: "#00693c" }],
  [/sas|scandinavian/i, { tail: "#0b2a6b", engine: "#e8743b" }],
  [/finnair|el al|aeroflot/i, { tail: "#0b2a6b" }],
  [/easyjet/i, { tail: "#ff6600", engine: "#ff6600" }],
  [/ryanair/i, { tail: "#0b2a6b", stripe: "#f1c40f", engine: "#0b2a6b" }],
  [/saudi/i, { body: "#efe6d2", tail: "#0b5e3c", engine: "#0b5e3c" }],
  [/ethiopian/i, { tail: "#0a8a3a", stripe: "#f5b324" }],
  [/fedex/i, { tail: "#4d148c", stripe: "#ff6200" }],
  [/ups/i, { body: "#f1f3f6", tail: "#4b2e1e", engine: "#4b2e1e", stripe: "#f5b324" }],
  [/dhl/i, { body: "#ffcc00", tail: "#ffcc00", engine: "#ffcc00", stripe: "#d40511" }],
  [/pan am/i, { tail: "#1f6fc4", stripe: "#1f6fc4" }],
  [/twa|trans world/i, { tail: "#c8102e", stripe: "#c8102e" }],
  [/air force|usaf|navy|military|army/i, { body: "#8c949c", tail: "#7b838b", engine: "#7b838b" }],
];

/** Airline colour scheme; unknown airlines get a stable colour derived from their name. */
export function liveryFor(airline?: string): Livery {
  const base: Livery = { body: WHITE, tail: "#2c3e63", engine: "#d9dde3" };
  if (!airline) return base;
  const hit = LIVERIES.find(([re]) => re.test(airline));
  if (hit) return { ...base, ...hit[1] };
  let h = 0;
  for (const c of airline) h = (h * 31 + c.charCodeAt(0)) % 360;
  return { ...base, tail: `hsl(${h} 62% 38%)`, stripe: `hsl(${h} 62% 38%)` };
}
