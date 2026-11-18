import { scaleDenominator } from "./format";

export type AircraftFacts = {
  /** Variant the numbers below describe. */
  variant: string;
  maker: string;
  firstFlight: number;
  lengthM: number;
  wingspanM: number;
  rangeKm?: number;
  seats?: string;
  engines: string;
  cruiseKmh?: number;
  nickname?: string;
  facts: string[];
};

/** Real-aircraft reference data keyed by the catalogue's `family` field. */
export const FACTS: Record<string, AircraftFacts> = {
  "Boeing 707": {
    variant: "707-320B", maker: "Boeing", firstFlight: 1957, lengthM: 46.6, wingspanM: 44.4, rangeKm: 9300, seats: "140–190", engines: "4 turbofans", cruiseKmh: 890,
    facts: [
      "The 707 kicked off the Jet Age for ordinary travellers — it cut New York to London to about seven hours.",
      "Its prototype, the Dash 80, was famously barrel-rolled over Seattle by test pilot Tex Johnston in front of airline bosses.",
      "Boeing's habit of naming jets 7-something-7 started here.",
    ],
  },
  "Boeing 717": {
    variant: "717-200", maker: "Boeing (McDonnell Douglas design)", firstFlight: 1998, lengthM: 37.8, wingspanM: 28.4, rangeKm: 3800, seats: "106–134", engines: "2 rear-mounted turbofans", cruiseKmh: 810,
    facts: [
      "The 717 began life as the McDonnell Douglas MD-95 and was renamed when Boeing bought the company.",
      "It is the last of the DC-9 family, a design line that stretches back to 1965.",
      "Only 156 were built, which makes it one of the rarer modern jetliners.",
    ],
  },
  "Boeing 727": {
    variant: "727-200", maker: "Boeing", firstFlight: 1963, lengthM: 46.7, wingspanM: 32.9, rangeKm: 4700, seats: "150–189", engines: "3 rear-mounted turbofans", cruiseKmh: 870,
    facts: [
      "The 727 has three engines at the back — the middle one breathes through an S-shaped duct in the tail.",
      "It carried its own staircase under the tail so it could use small airports with no equipment.",
      "For years it was the best-selling jetliner in the world, with 1,832 built.",
    ],
  },
  "Boeing 737": {
    variant: "737-800", maker: "Boeing", firstFlight: 1967, lengthM: 39.5, wingspanM: 35.8, rangeKm: 5400, seats: "160–189", engines: "2 turbofans", cruiseKmh: 840,
    nickname: "Baby Boeing",
    facts: [
      "More than 11,000 have been delivered — a 737 takes off or lands somewhere in the world every few seconds.",
      "Its engines have a flat-bottomed 'hamster pouch' shape because the plane sits so close to the ground.",
      "The 737 has no doors over its main wheels: when retracted you can see the tyres from below.",
    ],
  },
  "Boeing 747": {
    variant: "747-400", maker: "Boeing", firstFlight: 1969, lengthM: 70.7, wingspanM: 64.4, rangeKm: 13450, seats: "416–524", engines: "4 turbofans", cruiseKmh: 920,
    nickname: "Queen of the Skies",
    facts: [
      "The hump exists because the 747 was designed to become a freighter: the cockpit sits upstairs so the nose can swing open for cargo.",
      "The Wright brothers' entire first flight (37 m) would fit inside a 747's economy cabin.",
      "A 747-400 has about six million parts, half of them fasteners, and 274 km of wiring.",
      "It was the first twin-aisle 'jumbo jet' and stayed the biggest passenger plane for 37 years.",
    ],
  },
  "Boeing 757": {
    variant: "757-200", maker: "Boeing", firstFlight: 1982, lengthM: 47.3, wingspanM: 38.1, rangeKm: 7200, seats: "200–239", engines: "2 turbofans", cruiseKmh: 850,
    facts: [
      "Pilots call the 757 a 'rocket' — it has so much power it can climb out of short, hot or high runways with ease.",
      "It shares a cockpit design with the 767, so pilots can fly both with one licence.",
      "Its tall landing gear gives it a distinctive nose-high stance on the ground.",
    ],
  },
  "Boeing 767": {
    variant: "767-300ER", maker: "Boeing", firstFlight: 1981, lengthM: 54.9, wingspanM: 47.6, rangeKm: 11000, seats: "218–269", engines: "2 turbofans", cruiseKmh: 850,
    facts: [
      "The 767 proved twin-engine jets could safely cross oceans, which changed long-haul flying forever.",
      "It was Boeing's first airliner with a two-person 'glass cockpit' — no flight engineer needed.",
      "In 1983 an Air Canada 767 ran out of fuel and glided to a safe landing on an old runway: the 'Gimli Glider'.",
    ],
  },
  "Boeing 777": {
    variant: "777-300ER", maker: "Boeing", firstFlight: 1994, lengthM: 73.9, wingspanM: 64.8, rangeKm: 13650, seats: "365–396", engines: "2 turbofans (GE90)", cruiseKmh: 905,
    nickname: "Triple Seven",
    facts: [
      "Each GE90 engine on a 777-300ER is as wide as a 737's cabin and is the most powerful jet engine ever flown on an airliner.",
      "The 777 was the first airliner designed entirely on computers — no paper drawings.",
      "Its main landing gear has six wheels per leg, an easy way to tell it apart from other twins.",
    ],
  },
  "Boeing 787": {
    variant: "787-9", maker: "Boeing", firstFlight: 2009, lengthM: 62.8, wingspanM: 60.1, rangeKm: 14010, seats: "290–296", engines: "2 turbofans", cruiseKmh: 903,
    nickname: "Dreamliner",
    facts: [
      "About half of the Dreamliner is carbon-fibre composite instead of aluminium, which makes it lighter and lets the cabin be more humid.",
      "Its windows are the biggest of any airliner and dim electronically — no pull-down shades.",
      "In flight the wingtips flex upward by around three metres.",
    ],
  },
  "Airbus A220": {
    variant: "A220-300", maker: "Airbus (Bombardier design)", firstFlight: 2013, lengthM: 38.7, wingspanM: 35.1, rangeKm: 6300, seats: "120–160", engines: "2 geared turbofans", cruiseKmh: 830,
    facts: [
      "The A220 was designed in Canada as the Bombardier CSeries before Airbus took over the programme in 2018.",
      "Its windows are unusually large for a small jet, and the cabin has a 2–3 seat layout so fewer middle seats.",
      "Geared turbofan engines make it one of the quietest jets at any airport.",
    ],
  },
  "Airbus A300": {
    variant: "A300-600R", maker: "Airbus", firstFlight: 1972, lengthM: 54.1, wingspanM: 44.8, rangeKm: 7500, seats: "247–266", engines: "2 turbofans", cruiseKmh: 830,
    facts: [
      "The A300 was Airbus's very first aircraft — and the world's first twin-engine wide-body.",
      "The whale-shaped Beluga transporter is built on an A300 and carries wings and fuselages between Airbus factories.",
      "Its fuselage cross-section was so good that Airbus reused it on the A310, A330 and A340.",
    ],
  },
  "Airbus A310": {
    variant: "A310-300", maker: "Airbus", firstFlight: 1982, lengthM: 46.7, wingspanM: 43.9, rangeKm: 9600, seats: "220–240", engines: "2 turbofans", cruiseKmh: 850,
    facts: [
      "The A310 is a shortened A300 with a brand-new wing, built for longer, thinner routes.",
      "It was one of the first airliners with small winglets ('wingtip fences') to save fuel.",
      "It introduced the two-pilot glass cockpit to Airbus wide-bodies.",
    ],
  },
  "Airbus A320 family": {
    variant: "A320-200", maker: "Airbus", firstFlight: 1987, lengthM: 37.6, wingspanM: 35.8, rangeKm: 6100, seats: "150–180", engines: "2 turbofans", cruiseKmh: 830,
    facts: [
      "The A320 was the first airliner flown by computer 'fly-by-wire' with a side-stick instead of a control column.",
      "The family — A318, A319, A320 and A321 — is now the best-selling airliner family ever, passing the 737.",
      "That barking-dog sound you sometimes hear on the ground is its hydraulic power transfer unit.",
      "In 2009 an A320 landed safely on New York's Hudson River after hitting birds; everyone on board survived.",
    ],
  },
  "Airbus A330": {
    variant: "A330-300", maker: "Airbus", firstFlight: 1992, lengthM: 63.7, wingspanM: 60.3, rangeKm: 11750, seats: "250–290", engines: "2 turbofans", cruiseKmh: 870,
    facts: [
      "The A330 and four-engine A340 were designed together and share the same wing and fuselage.",
      "Air forces use the A330 MRTT as a flying petrol station to refuel fighters in mid-air.",
      "The newest A330neo has curved sharklet wingtips and a black 'mask' around the cockpit windows.",
    ],
  },
  "Airbus A340": {
    variant: "A340-600", maker: "Airbus", firstFlight: 1991, lengthM: 75.4, wingspanM: 63.5, rangeKm: 14450, seats: "320–370", engines: "4 turbofans", cruiseKmh: 880,
    facts: [
      "The A340-600 was the longest airliner in the world until the 747-8 arrived.",
      "The A340-500 flew the longest scheduled flights of its day: Singapore to New York, nearly 19 hours non-stop.",
      "With four engines it could fly remote ocean routes without the twin-engine restrictions of the time.",
    ],
  },
  "Airbus A350": {
    variant: "A350-900", maker: "Airbus", firstFlight: 2013, lengthM: 66.8, wingspanM: 64.75, rangeKm: 15370, seats: "300–350", engines: "2 turbofans (Rolls-Royce Trent XWB)", cruiseKmh: 903,
    facts: [
      "The A350's black cockpit 'sunglasses' and curved wingtips make it one of the easiest jets to spot.",
      "Its wings change shape in flight, inspired by how birds adjust their wings.",
      "The A350-900ULR flies the world's longest route, Singapore to New York, in about 18 hours 40 minutes.",
      "More than half of the aircraft is carbon-fibre composite.",
    ],
  },
  "Airbus A380": {
    variant: "A380-800", maker: "Airbus", firstFlight: 2005, lengthM: 72.7, wingspanM: 79.75, rangeKm: 14800, seats: "525–853", engines: "4 turbofans", cruiseKmh: 903,
    nickname: "Superjumbo",
    facts: [
      "The A380 is the largest passenger aircraft ever built, with two full-length decks.",
      "Singapore Airlines flew the very first A380 passenger flight, from Singapore to Sydney, in October 2007.",
      "Its wings are so big that 70 cars could park on each one.",
      "The tail is as tall as an eight-storey building, and some A380s have showers and a bar on board.",
    ],
  },
  "McDonnell Douglas MD-11": {
    variant: "MD-11", maker: "McDonnell Douglas", firstFlight: 1990, lengthM: 61.6, wingspanM: 51.7, rangeKm: 12600, seats: "285–410", engines: "3 turbofans", cruiseKmh: 880,
    facts: [
      "The MD-11 is a stretched, modernised DC-10 — the third engine is mounted right through the tail fin.",
      "Most surviving MD-11s fly parcels at night for cargo airlines.",
      "It was the last three-engine wide-body airliner ever produced.",
    ],
  },
  "McDonnell Douglas MD-80/90": {
    variant: "MD-83", maker: "McDonnell Douglas", firstFlight: 1979, lengthM: 45.1, wingspanM: 32.9, rangeKm: 4600, seats: "140–172", engines: "2 rear-mounted turbofans", cruiseKmh: 810,
    nickname: "Mad Dog",
    facts: [
      "Pilots nicknamed it the 'Mad Dog'. With engines at the back, the front of the cabin is whisper quiet.",
      "Its long thin fuselage and T-tail make it look like a flying pencil.",
      "The seats are arranged 2–3, so only one in five is a middle seat.",
    ],
  },
  "Douglas DC-3": {
    variant: "DC-3", maker: "Douglas", firstFlight: 1935, lengthM: 19.7, wingspanM: 29.0, rangeKm: 2400, seats: "21–32", engines: "2 radial piston engines", cruiseKmh: 333,
    facts: [
      "The DC-3 made airlines profitable for the first time without needing mail contracts.",
      "Over 16,000 were built including military C-47s, and some still fly for a living about 90 years later.",
      "General Eisenhower called the C-47 one of the machines that won World War II.",
    ],
  },
  "Douglas DC-8": {
    variant: "DC-8-63", maker: "Douglas", firstFlight: 1958, lengthM: 57.1, wingspanM: 45.2, rangeKm: 7400, seats: "180–259", engines: "4 turbofans", cruiseKmh: 890,
    facts: [
      "In 1961 a DC-8 became the first airliner to break the sound barrier, in a shallow test dive.",
      "The stretched 'Super Sixty' DC-8s were the longest airliners in the world until the 747.",
      "It was the 707's great rival in the first years of the Jet Age.",
    ],
  },
  "Douglas DC-9": {
    variant: "DC-9-30", maker: "Douglas", firstFlight: 1965, lengthM: 36.4, wingspanM: 28.5, rangeKm: 2800, seats: "90–115", engines: "2 rear-mounted turbofans", cruiseKmh: 810,
    facts: [
      "The DC-9 was built for short hops and small airports, with its own built-in stairs.",
      "Its design grew into the MD-80, MD-90 and Boeing 717 — a family that lasted more than 40 years in production.",
      "Engines at the tail keep the wing clean and the cabin quiet.",
    ],
  },
  "McDonnell Douglas DC-10": {
    variant: "DC-10-30", maker: "McDonnell Douglas", firstFlight: 1970, lengthM: 55.5, wingspanM: 50.4, rangeKm: 10600, seats: "250–380", engines: "3 turbofans", cruiseKmh: 880,
    facts: [
      "The DC-10 is a 'trijet': two engines under the wings and one mounted in the tail.",
      "A converted DC-10 called the Orbis Flying Eye Hospital travels the world performing eye surgery on board.",
      "Others were turned into firefighting air tankers that can drop 35,000 litres of retardant.",
    ],
  },
  "Lockheed L-1011 TriStar": {
    variant: "L-1011-1", maker: "Lockheed", firstFlight: 1970, lengthM: 54.2, wingspanM: 47.3, rangeKm: 5400, seats: "250–400", engines: "3 turbofans (Rolls-Royce RB211)", cruiseKmh: 890,
    facts: [
      "The TriStar could land itself in fog with a fully automatic landing system — years ahead of its time.",
      "Its tail engine is fed through an S-shaped duct, giving a smoother look than the DC-10.",
      "One TriStar, 'Stargazer', still launches rockets into space from under its belly.",
    ],
  },
  Concorde: {
    variant: "Concorde", maker: "Aérospatiale / BAC", firstFlight: 1969, lengthM: 61.7, wingspanM: 25.6, rangeKm: 7200, seats: "92–128", engines: "4 afterburning turbojets", cruiseKmh: 2180,
    facts: [
      "Concorde cruised at twice the speed of sound — faster than a rifle bullet — and crossed the Atlantic in about three and a half hours.",
      "It flew so high (18 km) that passengers could see the curve of the Earth.",
      "The fuselage heated up and stretched by about 20 cm in supersonic flight.",
      "Its nose drooped down for take-off and landing so the pilots could see the runway.",
    ],
  },
  "Embraer E-Jet": {
    variant: "E190", maker: "Embraer", firstFlight: 2002, lengthM: 36.2, wingspanM: 28.7, rangeKm: 4500, seats: "96–114", engines: "2 turbofans", cruiseKmh: 830,
    facts: [
      "E-Jets are built in Brazil and have no middle seats at all — every row is 2–2.",
      "The fuselage is a 'double-bubble' shape, giving more shoulder room than you'd expect in a small jet.",
      "The newer E2 version has a painted 'Profit Hunter' series of demonstrators with tiger, shark and eagle faces.",
    ],
  },
  "Embraer ERJ": {
    variant: "ERJ-145", maker: "Embraer", firstFlight: 1995, lengthM: 29.9, wingspanM: 20.0, rangeKm: 2900, seats: "50", engines: "2 rear-mounted turbofans", cruiseKmh: 830,
    facts: [
      "The ERJ-145 seats passengers 1–2, so a third of them get both a window and an aisle.",
      "It is long and thin — almost 30 m long but the cabin is barely 2 m wide.",
      "Over 1,200 of the ERJ family were built for regional airlines.",
    ],
  },
  "Bombardier CRJ": {
    variant: "CRJ-900", maker: "Bombardier", firstFlight: 1991, lengthM: 36.2, wingspanM: 24.9, rangeKm: 2900, seats: "76–90", engines: "2 rear-mounted turbofans", cruiseKmh: 830,
    facts: [
      "The CRJ started as a stretched Challenger business jet.",
      "It launched the regional-jet boom of the 1990s, replacing noisy turboprops on short routes.",
      "Nearly 2,000 were delivered before production ended in 2020.",
    ],
  },
  "ATR 42/72": {
    variant: "ATR 72-600", maker: "ATR", firstFlight: 1984, lengthM: 27.2, wingspanM: 27.1, rangeKm: 1500, seats: "68–78", engines: "2 turboprops", cruiseKmh: 510,
    facts: [
      "Passengers board an ATR through a door at the back, because the cargo hold is at the front.",
      "Its propellers make it far more fuel-efficient than a jet on short island-hopping routes.",
      "The wing sits on top of the fuselage, so every window has a view of the ground.",
    ],
  },
  "De Havilland Dash 8": {
    variant: "Dash 8 Q400", maker: "De Havilland Canada", firstFlight: 1983, lengthM: 32.8, wingspanM: 28.4, rangeKm: 2000, seats: "68–90", engines: "2 turboprops", cruiseKmh: 667,
    facts: [
      "The 'Q' stands for Quiet — the Q400 uses anti-noise speakers hidden in the cabin walls.",
      "It is one of the fastest turboprop airliners, nearly as quick as a jet on short routes.",
      "Its long main landing gear folds into the engine nacelles.",
    ],
  },
  "Comac C919": {
    variant: "C919", maker: "COMAC", firstFlight: 2017, lengthM: 38.9, wingspanM: 35.8, rangeKm: 4075, seats: "158–192", engines: "2 turbofans", cruiseKmh: 834,
    facts: [
      "The C919 is China's first modern home-grown narrow-body jetliner.",
      "Its name: C for China and COMAC, 9 for 'forever' in Chinese culture, and 19 for its 190 seats.",
      "It entered passenger service with China Eastern in May 2023.",
    ],
  },
  "Comac ARJ21": {
    variant: "ARJ21-700", maker: "COMAC", firstFlight: 2008, lengthM: 33.5, wingspanM: 27.3, rangeKm: 2200, seats: "78–90", engines: "2 rear-mounted turbofans", cruiseKmh: 830,
    facts: [
      "ARJ21 stands for 'Advanced Regional Jet for the 21st century'. It has since been renamed the C909.",
      "It was designed to cope with the hot, high airports of western China.",
    ],
  },
  "Lockheed C-130 Hercules": {
    variant: "C-130H", maker: "Lockheed", firstFlight: 1954, lengthM: 29.8, wingspanM: 40.4, rangeKm: 3800, engines: "4 turboprops", cruiseKmh: 540,
    facts: [
      "The Hercules has been in production longer than any other military aircraft — since 1954.",
      "In 1963 a C-130 landed on and took off from an aircraft carrier without a hook or catapult.",
      "It can land on dirt, sand, snow and ice.",
    ],
  },
  "Boeing C-17 Globemaster": {
    variant: "C-17A", maker: "Boeing (McDonnell Douglas)", firstFlight: 1991, lengthM: 53.0, wingspanM: 51.8, rangeKm: 4500, engines: "4 turbofans", cruiseKmh: 830,
    facts: [
      "A C-17 can carry a 70-tonne battle tank and still land on a short, rough airstrip.",
      "It can reverse up a slope using engine thrust reversers alone.",
    ],
  },
  "Boeing KC-135": {
    variant: "KC-135R", maker: "Boeing", firstFlight: 1956, lengthM: 41.5, wingspanM: 39.9, rangeKm: 2400, engines: "4 turbofans", cruiseKmh: 850,
    facts: [
      "The KC-135 refuels other aircraft in flight through a boom 'flown' by an operator lying in the tail.",
      "Many KC-135s flying today are older than the grandparents of their pilots.",
    ],
  },
  "Lockheed C-5 Galaxy": {
    variant: "C-5M", maker: "Lockheed", firstFlight: 1968, lengthM: 75.3, wingspanM: 67.9, rangeKm: 8900, engines: "4 turbofans", cruiseKmh: 830,
    facts: [
      "The Galaxy's nose and tail both open, so vehicles can drive straight through.",
      "Its cargo hold is longer than the Wright brothers' first flight.",
    ],
  },
  Tupolev: {
    variant: "Tu-154M", maker: "Tupolev", firstFlight: 1968, lengthM: 48.0, wingspanM: 37.6, rangeKm: 5300, seats: "164–180", engines: "3 rear-mounted turbofans", cruiseKmh: 900,
    facts: [
      "The Tu-154 was the workhorse of Soviet air travel and could use gravel runways.",
      "Tupolev also built the Tu-144, a supersonic airliner that flew two months before Concorde.",
    ],
  },
  Ilyushin: {
    variant: "Il-76TD", maker: "Ilyushin", firstFlight: 1971, lengthM: 46.6, wingspanM: 50.5, rangeKm: 4400, engines: "4 turbofans", cruiseKmh: 800,
    facts: [
      "The Il-76 has a glass nose where a navigator sits to help line up cargo drops.",
      "The Il-96 is Russia's four-engine wide-body and serves as the presidential aircraft.",
    ],
  },
  Antonov: {
    variant: "An-124", maker: "Antonov", firstFlight: 1982, lengthM: 69.1, wingspanM: 73.3, rangeKm: 4800, engines: "4 turbofans", cruiseKmh: 800,
    facts: [
      "The An-124 can 'kneel' on its nose gear so cargo can roll in through the lifting nose.",
      "Its big sister, the six-engine An-225 Mriya, was the heaviest aircraft ever built.",
    ],
  },
  Fokker: {
    variant: "Fokker 100", maker: "Fokker", firstFlight: 1986, lengthM: 35.5, wingspanM: 28.1, rangeKm: 3170, seats: "97–122", engines: "2 rear-mounted turbofans", cruiseKmh: 845,
    facts: [
      "Fokker was a Dutch company founded in 1912 — it built the Red Baron's famous triplane.",
      "The Fokker 100 and 70 use their tail cone as an airbrake that splits open like a clam.",
    ],
  },
  "BAe 146 / Avro RJ": {
    variant: "BAe 146-200", maker: "British Aerospace", firstFlight: 1981, lengthM: 28.6, wingspanM: 26.3, rangeKm: 2900, seats: "85–100", engines: "4 small turbofans", cruiseKmh: 750,
    nickname: "Whisperjet",
    facts: [
      "It has four engines on a small regional jet, which made it quiet enough for city-centre airports.",
      "Instead of thrust reversers it has a tail airbrake that opens like petals.",
    ],
  },
  "Lockheed Constellation": {
    variant: "L-1049 Super Constellation", maker: "Lockheed", firstFlight: 1943, lengthM: 35.4, wingspanM: 37.5, rangeKm: 8700, seats: "62–95", engines: "4 radial piston engines", cruiseKmh: 490,
    nickname: "Connie",
    facts: [
      "The 'Connie' has three tail fins so it could fit inside the hangars of its day.",
      "Its dolphin-shaped fuselage is curved along its whole length — no two frames are the same.",
    ],
  },
  "Lockheed Electra": {
    variant: "L-188A", maker: "Lockheed", firstFlight: 1957, lengthM: 31.9, wingspanM: 30.2, rangeKm: 3500, seats: "66–98", engines: "4 turboprops", cruiseKmh: 600,
    facts: [
      "The Electra was America's first big turboprop airliner.",
      "Its design lived on as the P-3 Orion submarine hunter, which flew for decades.",
    ],
  },
  "Vickers VC10": {
    variant: "VC10", maker: "Vickers", firstFlight: 1962, lengthM: 48.4, wingspanM: 44.6, rangeKm: 9400, seats: "115–151", engines: "4 rear-mounted turbofans", cruiseKmh: 930,
    facts: [
      "The VC10 has four engines clustered at the tail and held the subsonic transatlantic speed record for decades.",
    ],
  },
  "Sukhoi Superjet": {
    variant: "SSJ100", maker: "Sukhoi", firstFlight: 2008, lengthM: 29.9, wingspanM: 27.8, rangeKm: 3050, seats: "87–108", engines: "2 turbofans", cruiseKmh: 830,
    facts: ["The Superjet was Russia's first all-new airliner after the Soviet era."],
  },
};

export function factsFor(family?: string | null) {
  return family ? FACTS[family] ?? null : null;
}

/** Real lengths/wingspans (m) for common variants that differ a lot from the family's headline variant. */
const VARIANTS: [RegExp, string, number, number][] = [
  [/^A318/i, "A318", 31.4, 34.1],
  [/^A319/i, "A319", 33.8, 35.8],
  [/^A321/i, "A321", 44.5, 35.8],
  [/^A330-?(2|8)/i, "A330-200", 58.8, 60.3],
  [/^A330-?7|beluga/i, "BelugaXL", 63.1, 60.3],
  [/^A340-?[23]/i, "A340-300", 63.7, 60.3],
  [/^A340-?5/i, "A340-500", 67.9, 63.5],
  [/^A350-?(10|K)/i, "A350-1000", 73.8, 64.75],
  [/^A220-?1/i, "A220-100", 35.0, 35.1],
  [/^737-?(1|2)/i, "737-200", 30.5, 28.4],
  [/^737-?[35]/i, "737-300", 33.4, 28.9],
  [/^737-?4/i, "737-400", 36.4, 28.9],
  [/^737-?[67]/i, "737-700", 33.6, 35.8],
  [/^737-?9|^737.*MAX ?(9|10)/i, "737-900", 42.1, 35.8],
  [/^747-?8/i, "747-8", 76.3, 68.4],
  [/^747-?SP/i, "747SP", 56.3, 59.6],
  [/^747-?[123]/i, "747-200", 70.7, 59.6],
  [/^757-?3/i, "757-300", 54.4, 38.1],
  [/^767-?2/i, "767-200", 48.5, 47.6],
  [/^767-?4/i, "767-400ER", 61.4, 51.9],
  [/^777-?2|^777-?F|^777F|^777LRF/i, "777-200", 63.7, 60.9],
  [/^777-?(9|X)/i, "777-9", 76.7, 71.8],
  [/^787-?8/i, "787-8", 56.7, 60.1],
  [/^787-?10/i, "787-10", 68.3, 60.1],
  [/^E-?17[05]|^Embraer 17/i, "E175", 31.7, 26.0],
  [/^E-?195/i, "E195", 38.7, 28.7],
  [/^ATR[- ]?42/i, "ATR 42", 22.7, 24.6],
  [/^MD-?9/i, "MD-90", 46.5, 32.9],
  [/^CRJ-?[12]/i, "CRJ-200", 26.8, 21.2],
  [/^CRJ-?7/i, "CRJ-700", 32.3, 23.2],
];

/** Dimensions for this exact variant when known, otherwise the family's headline variant. */
export function dimensions(family?: string | null, aircraft?: string | null) {
  const f = factsFor(family);
  if (!f) return null;
  const v = aircraft ? VARIANTS.find(([re]) => re.test(aircraft.trim())) : undefined;
  return v ? { variant: v[1], lengthM: v[2], wingspanM: v[3] } : { variant: f.variant, lengthM: f.lengthM, wingspanM: f.wingspanM };
}

/** How big the model is in the hand, worked out from the real aircraft and the scale. */
export function modelSize(family: string | undefined, scale: string, aircraft?: string) {
  const dim = dimensions(family, aircraft);
  const d = scaleDenominator(scale);
  if (!dim || !d) return null;
  return { lengthCm: (dim.lengthM * 100) / d, wingspanCm: (dim.wingspanM * 100) / d, denominator: d };
}

export function scaleFact(family: string | undefined, scale: string, aircraft?: string) {
  const size = modelSize(family, scale, aircraft);
  const dim = dimensions(family, aircraft);
  if (!size || !dim) return null;
  return `At ${scale} this model is about ${size.lengthCm.toFixed(1)} cm long — line up ${size.denominator} of them nose to tail and you'd match the real ${dim.variant} (${dim.lengthM} m).`;
}
