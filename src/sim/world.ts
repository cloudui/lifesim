// World generation: cities, venues, families and the ties people start with.
// Everything here is plain data produced from the seed.

import { CLUBS, type Ctx } from './activities';
import { Stream } from './rng';

export interface City {
  id: number;
  name: string;
  pop: number;
}

export type VenueKind = 'work' | 'club' | 'hangout';

export interface Venue {
  id: number;
  kind: VenueKind;
  city: number;
  name: string;
  /** Index into CLUBS for clubs, otherwise -1. */
  hobby: number;
  /** Workplace capacity; 0 for other kinds. */
  cap: number;
  /** Current employees or club members. Unused for hangouts. */
  members: number[];
}

export type LifeStage = 'adult';

export interface Agent {
  id: number;
  name: string;
  birthYear: number;
  hometown: number;
  city: number;
  stage: LifeStage;
  family: number[];
  partner: number;
  /** 0 = very introverted, 1 = very extraverted. */
  ext: number;
  /** How readily they try a new place instead of a usual one. */
  novelty: number;
  /** How connected they start out. */
  circleSeed: number;
  /** Indices into CLUBS. */
  hobbies: number[];
  hobbyMask: number;
  /** Personality axes, each -1 to 1. See PERSONALITY in people.ts. */
  pers: number[];
  work: number;
  clubs: number[];
  /** Usual hangouts in the current city, with visit counts. */
  haunts: { v: number; n: number }[];
  grewUpHere: boolean;
  /** Week they died, or -1. */
  died: number;
}

export interface SeedTie {
  a: number;
  b: number;
  s: number;
  ctx: Ctx;
  kin: boolean;
  met: number;
}

export interface World {
  cities: City[];
  venues: Venue[];
  agents: Agent[];
  hangoutsByCity: number[][];
  workByCity: number[][];
  clubsByCityHobby: number[][][];
  ego: number;
  seedTies: SeedTie[];
}

export interface EgoOverrides {
  ext?: number;
  novelty?: number;
  circleSeed?: number;
  /** Hobby ids from CLUBS, e.g. ["run", "games"]. */
  hobbies?: string[];
}

export interface WorldOptions {
  seed: number;
  startYear: number;
  cities: CityConfig[];
  ego?: EgoOverrides;
  /** The protagonist's age when the story starts (default 18). */
  startAge?: number;
}

export interface CityConfig {
  name: string;
  pop: number;
  /** Neighbourhood names used to name venues. Falls back to a generic list. */
  areas?: string[];
}

// Real cities and neighbourhoods for familiarity; every venue and person is invented.
export const DEFAULT_CITIES: CityConfig[] = [
  {
    name: 'New York', pop: 800,
    areas: ['Williamsburg', 'East Village', 'Upper West Side', 'Astoria', 'Park Slope', 'Harlem', 'Chelsea', 'SoHo',
      'Bushwick', 'Greenpoint', 'Tribeca', 'Flatiron', 'Lower East Side', 'Fort Greene', 'Long Island City', 'Washington Heights'],
  },
  {
    name: 'San Francisco', pop: 700,
    areas: ['Mission', 'Castro', 'Haight', 'SoMa', 'Richmond', 'Sunset', 'Noe Valley', 'Marina', 'North Beach',
      'Hayes Valley', 'Potrero Hill', 'Dogpatch', 'Bernal Heights', 'Nob Hill', 'Japantown', 'Glen Park'],
  },
  {
    name: 'Chicago', pop: 500,
    areas: ['Wicker Park', 'Logan Square', 'Lincoln Park', 'Pilsen', 'Hyde Park', 'Lakeview', 'Andersonville',
      'River North', 'Bucktown', 'West Loop', 'Uptown', 'Bridgeport', 'Old Town', 'Rogers Park', 'Ravenswood', 'South Loop'],
  },
];

const FIRST = [
  'Maya', 'Sam', 'Priya', 'Leo', 'Nora', 'Omar', 'Elena', 'Kofi', 'Hana', 'Mateo', 'Zoe', 'Ravi', 'Ines', 'Tariq',
  'Lucy', 'Diego', 'Amara', 'Felix', 'Yuki', 'Noah', 'Sofia', 'Idris', 'Clara', 'Jonas', 'Leila', 'Marcus', 'Anya',
  'Theo', 'Mina', 'Caleb', 'Rosa', 'Arjun', 'Freya', 'Dmitri', 'Naomi', 'Hugo', 'Aisha', 'Owen', 'Camila', 'Kenji',
  'Ruth', 'Emeka', 'Greta', 'Luis', 'Fatima', 'Jack', 'Mei', 'Andre', 'Sana', 'Victor', 'Iris', 'Pablo', 'Tess',
  'Bashir', 'Ella', 'Tomas', 'Nia', 'Stefan', 'Wren', 'Darius', 'Lena', 'Kwame', 'Alma', 'Ezra', 'Chloe', 'Rahul',
  'Signe', 'Malik', 'Vera', 'Joon', 'Paloma', 'Miles', 'Zainab', 'Anton', 'Juno', 'Carlos', 'Edith', 'Samir', 'Odile',
  'Ben', 'Thandi', 'Nico', 'Maren', 'Yusuf', 'Dara', 'Elias', 'Suki', 'Rafael', 'Ingrid', 'Abel', 'Lola', 'Hassan',
  'Pia', 'Gus', 'Mira', 'Tobias', 'Esme', 'Jamal', 'Cora', 'Silas', 'Uma', 'Levi', 'Bianca', 'Kai', 'Renata', 'Finn',
  'Adaeze', 'Otto', 'Selma', 'Ivo', 'Noor', 'Dev', 'Astrid', 'Remy', 'Talia', 'Enzo', 'Marta', 'Cyrus', 'Linh', 'Axel',
];

const LAST = [
  'Okafor', 'Lee', 'Sharma', 'Novak', 'Haddad', 'Silva', 'Mensah', 'Tanaka', 'Garcia', 'Lindqvist', 'Rao', 'Costa',
  'Aziz', 'Bennett', 'Moreno', 'Eze', 'Fischer', 'Sato', 'Walker', 'Rossi', 'Khan', 'Dubois', 'Petrov', 'Cohen',
  'Larsen', 'Hale', 'Osei', 'Kim', 'Ortiz', 'Varga', 'Nair', 'Brandt', 'Ibarra', 'Chen', 'Abbasi', 'Doyle', 'Mwangi',
  'Keller', 'Reyes', 'Sorensen', 'Patel', 'Marsh', 'Adeyemi', 'Volkov', 'Castillo', 'Winter', 'Yilmaz', 'Hughes',
  'Nakamura', 'Ferrari', 'Banda', 'Quinn', 'Soto', 'Engel', 'Farouk', 'Pike', 'Delgado', 'Holm', 'Iyer', 'Lambert',
  'Otieno', 'Vance', 'Romero', 'Stein', 'Malik', 'Thorne', 'Nguyen', 'Ricci', 'Sesay', 'Blake', 'Cruz', 'Dahl',
  'Hosseini', 'Frost', 'Medina', 'Asante', 'Wolfe', 'Park', 'Bauer', 'Tran',
];

const AREAS = [
  'Riverside', 'Old Town', 'Northgate', 'Harbor', 'Elm Hill', 'Canal Street', 'Eastside', 'Midtown', 'Lakeshore',
  'Foundry', 'Westbank', 'Saltmarsh', 'Orchard', 'Station Road', 'Highfield', 'Quarry', 'Mill Lane', 'Southgate',
  'Fernhill', 'Dockside', 'Greenway', 'Abbey Road', 'Tanner Row', 'Lighthouse', 'Brookside', 'Castle Hill',
  'Market Square', 'Windmill', 'Chapel Street', 'Bayview', 'Cedar Grove', 'Ironbridge',
];
const ADJ = ['Copper', 'Blue', 'Quiet', 'Golden', 'Crooked', 'Lucky', 'Velvet', 'Rusty', 'Bright', 'Hollow', 'Wild', 'Little'];
const NOUN = ['Fox', 'Heron', 'Anchor', 'Lantern', 'Badger', 'Compass', 'Magpie', 'Otter', 'Pear', 'Kettle', 'Sparrow', 'Bell'];
const WORK_SUFFIX = ['Labs', 'Studio', 'Partners', 'Clinic', 'Works', 'Press', 'Logistics', 'Design', 'Bakery', 'Group'];

function popcountMask(hobbies: number[]): number {
  let m = 0;
  for (const h of hobbies) m |= 1 << h;
  return m;
}

export function generateWorld(opt: WorldOptions): World {
  const st = new Stream(opt.seed, 1);
  const cities: City[] = opt.cities.map((c, i) => ({ id: i, name: c.name, pop: c.pop }));
  const venues: Venue[] = [];
  const hangoutsByCity: number[][] = [];
  const workByCity: number[][] = [];
  const clubsByCityHobby: number[][][] = [];
  const usedNames = new Set<string>();

  const uniqueName = (make: () => string, city: City): string => {
    for (let i = 0; i < 30; i++) {
      const n = make();
      if (!usedNames.has(n)) {
        usedNames.add(n);
        return n;
      }
    }
    const base = `${make()} (${city.name})`;
    let n = base;
    for (let i = 2; usedNames.has(n); i++) n = `${base} ${i}`;
    usedNames.add(n);
    return n;
  };
  const addVenue = (kind: VenueKind, city: City, name: string, hobby = -1, cap = 0): number => {
    const id = venues.length;
    venues.push({ id, kind, city: city.id, name, hobby, cap, members: [] });
    return id;
  };

  for (const city of cities) {
    const areas = opt.cities[city.id].areas ?? AREAS;
    const hang: number[] = [];
    const nHang = Math.max(4, Math.round(city.pop / 35));
    for (let i = 0; i < nHang; i++) {
      const kind = i % 3;
      const name = uniqueName(() => {
        if (kind === 0) return `The ${st.pick(ADJ)} ${st.pick(NOUN)}`;
        if (kind === 1) return `${st.pick(NOUN)} & ${st.pick(NOUN)} Café`;
        return `${st.pick(areas)} Park`;
      }, city);
      hang.push(addVenue('hangout', city, name));
    }
    hangoutsByCity.push(hang);

    const work: number[] = [];
    let capacity = 0;
    while (capacity < city.pop * 1.15) {
      const cap = 4 + Math.floor(st.next() ** 2 * 28);
      const name = uniqueName(
        () => (st.next() < 0.5 ? `${st.pick(LAST)} & ${st.pick(LAST)}` : `${st.pick(areas)} ${st.pick(WORK_SUFFIX)}`),
        city,
      );
      work.push(addVenue('work', city, name, -1, cap));
      capacity += cap;
    }
    workByCity.push(work);

    const byHobby: number[][] = [];
    CLUBS.forEach((club, h) => {
      const n = Math.max(1, Math.round((city.pop * 0.11) / club.size));
      const list: number[] = [];
      for (let i = 0; i < n; i++) {
        list.push(addVenue('club', city, uniqueName(() => `${st.pick(areas)} ${club.venueSuffix}`, city), h));
      }
      byHobby.push(list);
    });
    clubsByCityHobby.push(byHobby);
  }

  const startAge = opt.startAge ?? 18;
  // The youngest people in the world are the protagonist's age, and never older than 22.
  const youngest = Math.min(22, startAge);
  // --- People, generated as families so everyone has kin and a hometown.
  const agents: Agent[] = [];
  const usedPeople = new Set<string>();
  const families: number[][] = [];
  const makeAgent = (last: string, birthYear: number, hometown: number, grewUpHere: boolean): Agent => {
    let name = '';
    for (let i = 0; i < 40; i++) {
      name = `${st.pick(FIRST)} ${last}`;
      if (!usedPeople.has(name)) break;
    }
    usedPeople.add(name);
    const nHobbies = 1 + st.int(3);
    const hobbies: number[] = [];
    while (hobbies.length < nHobbies) {
      const h = st.int(CLUBS.length);
      if (!hobbies.includes(h)) hobbies.push(h);
    }
    const a: Agent = {
      id: agents.length,
      name,
      birthYear,
      hometown,
      city: hometown,
      stage: 'adult',
      family: [],
      partner: -1,
      ext: (st.next() + st.next()) / 2,
      novelty: (st.next() + st.next()) / 2,
      circleSeed: st.next(),
      hobbies,
      hobbyMask: popcountMask(hobbies),
      pers: [st.next() * 2 - 1, st.next() * 2 - 1, st.next() * 2 - 1, st.next() * 2 - 1],
      work: -1,
      clubs: [],
      haunts: [],
      grewUpHere,
      died: -1,
    };
    agents.push(a);
    return a;
  };

  for (const city of cities) {
    let remaining = city.pop;
    while (remaining > 0) {
      const last = st.pick(LAST);
      const nParents = st.next() < 0.8 ? 2 : 1;
      const nKids = 1 + st.int(3);
      const kidAges: number[] = [];
      for (let i = 0; i < nKids; i++) kidAges.push(youngest + st.int(39 - youngest));
      const oldest = Math.max(...kidAges);
      const fam: number[] = [];
      const parents: Agent[] = [];
      for (let i = 0; i < nParents; i++) {
        const p = makeAgent(last, opt.startYear - (oldest + 22 + st.int(13)), city.id, false);
        parents.push(p);
        fam.push(p.id);
      }
      if (parents.length === 2) {
        parents[0].partner = parents[1].id;
        parents[1].partner = parents[0].id;
      }
      for (const age of kidAges) {
        const k = makeAgent(last, opt.startYear - age, city.id, true);
        // Some have already left their hometown before the story starts.
        if (cities.length > 1 && st.next() < 0.3) {
          let c = st.int(cities.length - 1);
          if (c >= city.id) c++;
          // Nobody has left home before they are 20.
          if (age >= 20) k.city = c;
        }
        fam.push(k.id);
      }
      for (const id of fam) agents[id].family = fam.filter((x) => x !== id);
      families.push(fam);
      remaining -= fam.length;
    }
  }

  // --- The protagonist: a young adult picked by the seed. Same rules as everyone else.
  // The protagonist is one of the youngest adults: 18 or 19 by default, living where they grew up.
  const young = agents.filter((a) => a.grewUpHere && opt.startYear - a.birthYear <= (startAge < 22 ? startAge + 1 : 26) && (startAge >= 22 || a.city === a.hometown));
  const ego = (young.length ? st.pick(young) : st.pick(agents)).id;
  if (opt.ego) {
    const e = agents[ego];
    if (opt.ego.ext !== undefined) e.ext = opt.ego.ext;
    if (opt.ego.novelty !== undefined) e.novelty = opt.ego.novelty;
    if (opt.ego.circleSeed !== undefined) e.circleSeed = opt.ego.circleSeed;
    if (opt.ego.hobbies) {
      const hs = opt.ego.hobbies.map((id) => CLUBS.findIndex((c) => c.id === id)).filter((h) => h >= 0);
      if (hs.length) {
        e.hobbies = [...new Set(hs)];
        e.hobbyMask = popcountMask(e.hobbies);
      }
    }
  }

  // --- Jobs and clubs.
  for (const a of agents) {
    const cands = workByCity[a.city];
    let total = 0;
    const w = cands.map((v) => {
      const x = Math.max(0.5, venues[v].cap - venues[v].members.length);
      total += x;
      return x;
    });
    let u = st.next() * total;
    let pick = cands[cands.length - 1];
    for (let i = 0; i < cands.length; i++) {
      u -= w[i];
      if (u <= 0) {
        pick = cands[i];
        break;
      }
    }
    a.work = pick;
    venues[pick].members.push(a.id);
    for (const h of a.hobbies) {
      if (st.next() < 0.3 + 0.5 * a.ext) {
        const c = st.pick(clubsByCityHobby[a.city][h]);
        a.clubs.push(c);
        venues[c].members.push(a.id);
      }
    }
  }

  // --- Starting ties: family, plus friends people grew up with.
  const seedTies: SeedTie[] = [];
  const N = agents.length;
  const tied = new Set<number>();
  const key = (a: number, b: number) => (a < b ? a * N + b : b * N + a);
  for (const fam of families) {
    for (let i = 0; i < fam.length; i++) {
      for (let j = i + 1; j < fam.length; j++) {
        tied.add(key(fam[i], fam[j]));
        seedTies.push({ a: fam[i], b: fam[j], s: 0.85, ctx: 'family', kin: true, met: 0 });
      }
    }
  }
  const kidsByTown: Agent[][] = cities.map(() => []);
  for (const a of agents) if (a.grewUpHere) kidsByTown[a.hometown].push(a);
  for (const a of agents) {
    if (!a.grewUpHere) continue;
    const pool = kidsByTown[a.hometown];
    const want = Math.round(a.circleSeed * 7 * (0.5 + st.next()));
    let made = 0;
    for (let attempt = 0; attempt < want * 8 && made < want; attempt++) {
      const b = st.pick(pool);
      if (b.id === a.id || Math.abs(b.birthYear - a.birthYear) > 3 || tied.has(key(a.id, b.id))) continue;
      tied.add(key(a.id, b.id));
      const metYear = Math.max(a.birthYear, b.birthYear) + 8;
      seedTies.push({
        a: a.id,
        b: b.id,
        s: 0.25 + 0.5 * st.next(),
        ctx: 'childhood',
        kin: false,
        met: (metYear - opt.startYear) * 52,
      });
      made++;
    }
  }

  return { cities, venues, agents, hangoutsByCity, workByCity, clubsByCityHobby, ego, seedTies };
}
