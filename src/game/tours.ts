import { MonsterKind, WeatherKind } from './types';

export const TOTAL_TOURS = 20;

export type TourBiomeId =
  | 'midnight_pine'
  | 'amber_marsh'
  | 'misty_shallows'
  | 'storm_abyss'
  | 'crimson_eclipse';

export interface IslandSpec {
  x: number;
  z: number;
  radius: number;
  alcoholicsCount: 2 | 3;
  seed: number;
}

export interface ReefSpec {
  x: number;
  z: number;
  radius: number;
}

export interface TourBiomePalette {
  label: string;
  skyColor: string;
  fogColor: string;
  fogDensity: number;
  foliageColor: string;
  islandSoilColor: string;
  waterTint: string;
}

export const TOUR_BIOMES: Record<TourBiomeId, TourBiomePalette> = {
  midnight_pine: {
    label: 'Сосновая ночь',
    skyColor: '#040911',
    fogColor: '#040911',
    fogDensity: 0.011,
    foliageColor: '#0f2922',
    islandSoilColor: '#29221a',
    waterTint: '#07131e',
  },
  amber_marsh: {
    label: 'Болотная топь',
    skyColor: '#050e0b',
    fogColor: '#06120d',
    fogDensity: 0.0125,
    foliageColor: '#1a3319',
    islandSoilColor: '#2d2616',
    waterTint: '#061714',
  },
  misty_shallows: {
    label: 'Седая отмель',
    skyColor: '#09111a',
    fogColor: '#0d1722',
    fogDensity: 0.0135,
    foliageColor: '#132a2c',
    islandSoilColor: '#312b22',
    waterTint: '#091824',
  },
  storm_abyss: {
    label: 'Грозовая бездна',
    skyColor: '#030712',
    fogColor: '#050a18',
    fogDensity: 0.013,
    foliageColor: '#0c2029',
    islandSoilColor: '#232024',
    waterTint: '#050f1d',
  },
  crimson_eclipse: {
    label: 'Багровый омут',
    skyColor: '#0e070c',
    fogColor: '#130910',
    fogDensity: 0.012,
    foliageColor: '#221c18',
    islandSoilColor: '#2e1d19',
    waterTint: '#110a15',
  },
};

export interface TourDefinition {
  tour: number;
  name: string;
  subtitle: string;
  biome: TourBiomeId;
  weather: WeatherKind;
  islands: IslandSpec[];
  reefs: ReefSpec[];
  roster: MonsterKind[];
  enemyCount: number;
  crocInterval: number;
  maxCrocs: number;
  bossCount: number;
}

const TOUR_NAMES: { name: string; subtitle: string }[] = [
  { name: 'Пристань Барона', subtitle: 'Щуки и юркий Пескарь Натаскарь у первых островков' },
  { name: 'Коряжник Ержа', subtitle: 'Колючий Ёрш Передрёш и костры на берегах' },
  { name: 'Тихая заводь Сома', subtitle: 'Первая встреча с Левиафаном среди тройки островов' },
  { name: 'Трясина Линя Жминя', subtitle: 'Вязкая вода, костры выпивох и залпы из глубины' },
  { name: 'Золотой перекат', subtitle: 'Быстрые стаи Натаскаря обходят рифы с флангов' },
  { name: 'Утиный плёс', subtitle: 'Двойная застава Крокодила Гены и болотные угри' },
  { name: 'Остров Трёх Бутылок', subtitle: 'Узкие проливы между островами и иглобрюхи' },
  { name: 'Глубокий каньон', subtitle: 'Тяжёлый Карась Вырубась выходит на таран' },
  { name: 'Логово Передрёша', subtitle: 'Густой туман и стаи колючих ершей' },
  { name: 'Перекрёсток Десяти Огней', subtitle: 'Середина пути: усиленный Левиафан и гроза' },
  { name: 'Рыбацкая заимка', subtitle: 'Четыре острова с кострами делят озеро на сектора' },
  { name: 'Серебряный омут', subtitle: 'Линь Жминь и Угорь-искра атакуют под дождём' },
  { name: 'Гнилая протока', subtitle: 'Плотные минные поля из иглобрюхов у проходов' },
  { name: 'Лесной рубеж Гены', subtitle: 'Крокодилы чаще выпрыгивают из сосен с биткоинами' },
  { name: 'Кольцо Собутыльников', subtitle: 'Острова в центре кольца и двойной натиск бездны' },
  { name: 'Багровая отмель', subtitle: 'Натиск Карася Вырубася и стайных хищников' },
  { name: 'Чертов перевал', subtitle: 'Штормовые волны и перекрёстный огонь угрей' },
  { name: 'Затонувший причал', subtitle: 'Все виды речных монстров на узкой карте' },
  { name: 'Преддверие Бездны', subtitle: 'Последний рубеж перед троном Левиафана' },
  { name: 'Чёрный трон Левиафана', subtitle: 'Финальный 20-й тур: Левиафаны, Гены и вся орда озера!' },
];

const BIOME_CYCLE: TourBiomeId[] = [
  'midnight_pine',
  'amber_marsh',
  'misty_shallows',
  'midnight_pine',
  'amber_marsh',
  'storm_abyss',
  'misty_shallows',
  'midnight_pine',
  'misty_shallows',
  'storm_abyss',
  'amber_marsh',
  'storm_abyss',
  'amber_marsh',
  'midnight_pine',
  'crimson_eclipse',
  'crimson_eclipse',
  'storm_abyss',
  'misty_shallows',
  'crimson_eclipse',
  'storm_abyss',
];

const WEATHER_CYCLE: WeatherKind[] = [
  'clear',
  'clear',
  'mist',
  'mist',
  'clear',
  'rain',
  'mist',
  'rain',
  'mist',
  'storm',
  'clear',
  'rain',
  'mist',
  'rain',
  'storm',
  'mist',
  'storm',
  'rain',
  'storm',
  'storm',
];

// Hand-tuned distinct 20-tour island & reef layouts (center 0,0 kept clear >= 11m for Sasha's boat)
const ISLAND_LAYOUTS: IslandSpec[][] = [
  // Tour 1: 2 wide islands
  [
    { x: -24, z: -13, radius: 4.5, alcoholicsCount: 2, seed: 101 },
    { x: 24, z: 13, radius: 4.6, alcoholicsCount: 2, seed: 102 },
  ],
  // Tour 2: 2 diagonal opposite + north
  [
    { x: 22, z: -15, radius: 4.4, alcoholicsCount: 2, seed: 201 },
    { x: -23, z: 14, radius: 4.8, alcoholicsCount: 3, seed: 202 },
  ],
  // Tour 3: 3 triangle islands
  [
    { x: 0, z: -21, radius: 4.8, alcoholicsCount: 3, seed: 301 },
    { x: -25, z: 13, radius: 4.4, alcoholicsCount: 2, seed: 302 },
    { x: 25, z: 13, radius: 4.4, alcoholicsCount: 2, seed: 303 },
  ],
  // Tour 4: Twin channel islands
  [
    { x: -17, z: -2, radius: 4.7, alcoholicsCount: 3, seed: 401 },
    { x: 17, z: 2, radius: 4.7, alcoholicsCount: 3, seed: 402 },
    { x: 0, z: 23, radius: 4.2, alcoholicsCount: 2, seed: 403 },
  ],
  // Tour 5: East-West archipelago
  [
    { x: -30, z: -14, radius: 4.4, alcoholicsCount: 2, seed: 501 },
    { x: -14, z: 18, radius: 4.5, alcoholicsCount: 2, seed: 502 },
    { x: 28, z: -12, radius: 4.8, alcoholicsCount: 3, seed: 503 },
  ],
  // Tour 6: 3 north-south staggered
  [
    { x: -20, z: -18, radius: 4.6, alcoholicsCount: 3, seed: 601 },
    { x: 26, z: 0, radius: 4.9, alcoholicsCount: 3, seed: 602 },
    { x: -18, z: 19, radius: 4.3, alcoholicsCount: 2, seed: 603 },
  ],
  // Tour 7: 3 tight central islands
  [
    { x: -15, z: -12, radius: 4.5, alcoholicsCount: 3, seed: 701 },
    { x: 16, z: -11, radius: 4.5, alcoholicsCount: 2, seed: 702 },
    { x: 0, z: 17, radius: 4.9, alcoholicsCount: 3, seed: 703 },
  ],
  // Tour 8: 4 corner bastions
  [
    { x: -26, z: -17, radius: 4.4, alcoholicsCount: 2, seed: 801 },
    { x: 26, z: -17, radius: 4.4, alcoholicsCount: 2, seed: 802 },
    { x: -26, z: 17, radius: 4.4, alcoholicsCount: 3, seed: 803 },
    { x: 26, z: 17, radius: 4.4, alcoholicsCount: 2, seed: 804 },
  ],
  // Tour 9: Horizontal barrier with gaps
  [
    { x: -31, z: 4, radius: 4.6, alcoholicsCount: 2, seed: 901 },
    { x: 0, z: -18, radius: 5.0, alcoholicsCount: 3, seed: 902 },
    { x: 31, z: -4, radius: 4.6, alcoholicsCount: 2, seed: 903 },
  ],
  // Tour 10: Cross formation around arena
  [
    { x: 0, z: -22, radius: 4.8, alcoholicsCount: 3, seed: 1001 },
    { x: 0, z: 22, radius: 4.8, alcoholicsCount: 3, seed: 1002 },
    { x: -28, z: 0, radius: 4.6, alcoholicsCount: 2, seed: 1003 },
    { x: 28, z: 0, radius: 4.6, alcoholicsCount: 2, seed: 1004 },
  ],
  // Tour 11: Asymmetric riverbend
  [
    { x: -32, z: -18, radius: 4.5, alcoholicsCount: 2, seed: 1101 },
    { x: -13, z: 14, radius: 4.7, alcoholicsCount: 3, seed: 1102 },
    { x: 15, z: -15, radius: 4.7, alcoholicsCount: 3, seed: 1103 },
    { x: 33, z: 16, radius: 4.5, alcoholicsCount: 2, seed: 1104 },
  ],
  // Tour 12: Southern harbor
  [
    { x: -21, z: 12, radius: 4.9, alcoholicsCount: 3, seed: 1201 },
    { x: 21, z: 12, radius: 4.9, alcoholicsCount: 3, seed: 1202 },
    { x: -8, z: -21, radius: 4.3, alcoholicsCount: 2, seed: 1203 },
    { x: 29, z: -16, radius: 4.2, alcoholicsCount: 2, seed: 1204 },
  ],
  // Tour 13: Tight hourglass
  [
    { x: -14, z: -15, radius: 4.6, alcoholicsCount: 3, seed: 1301 },
    { x: 14, z: 15, radius: 4.6, alcoholicsCount: 3, seed: 1302 },
    { x: -29, z: 14, radius: 4.3, alcoholicsCount: 2, seed: 1303 },
    { x: 29, z: -14, radius: 4.3, alcoholicsCount: 2, seed: 1304 },
  ],
  // Tour 14: Forest border outposts
  [
    { x: -34, z: 0, radius: 4.8, alcoholicsCount: 3, seed: 1401 },
    { x: 34, z: 0, radius: 4.8, alcoholicsCount: 3, seed: 1402 },
    { x: 16, z: -20, radius: 4.4, alcoholicsCount: 2, seed: 1403 },
    { x: -16, z: 20, radius: 4.4, alcoholicsCount: 2, seed: 1404 },
  ],
  // Tour 15: Ring of drinking buddies
  [
    { x: -18, z: -13, radius: 4.6, alcoholicsCount: 3, seed: 1501 },
    { x: 18, z: -13, radius: 4.6, alcoholicsCount: 3, seed: 1502 },
    { x: -18, z: 13, radius: 4.6, alcoholicsCount: 3, seed: 1503 },
    { x: 18, z: 13, radius: 4.6, alcoholicsCount: 3, seed: 1504 },
  ],
  // Tour 16: Crimson diagonal
  [
    { x: -29, z: -18, radius: 4.7, alcoholicsCount: 3, seed: 1601 },
    { x: -12, z: -6, radius: 4.2, alcoholicsCount: 2, seed: 1602 },
    { x: 12, z: 6, radius: 4.2, alcoholicsCount: 2, seed: 1603 },
    { x: 29, z: 18, radius: 4.7, alcoholicsCount: 3, seed: 1604 },
  ],
  // Tour 17: Storm triangle + flank
  [
    { x: 0, z: -20, radius: 5.0, alcoholicsCount: 3, seed: 1701 },
    { x: -24, z: 11, radius: 4.7, alcoholicsCount: 3, seed: 1702 },
    { x: 24, z: 11, radius: 4.7, alcoholicsCount: 3, seed: 1703 },
    { x: 0, z: 24, radius: 4.1, alcoholicsCount: 2, seed: 1704 },
  ],
  // Tour 18: Sunken pier blocks
  [
    { x: -22, z: -17, radius: 4.8, alcoholicsCount: 3, seed: 1801 },
    { x: 22, z: -17, radius: 4.8, alcoholicsCount: 3, seed: 1802 },
    { x: -29, z: 14, radius: 4.4, alcoholicsCount: 2, seed: 1803 },
    { x: 29, z: 14, radius: 4.4, alcoholicsCount: 2, seed: 1804 },
  ],
  // Tour 19: Twin gate islands
  [
    { x: -16, z: 0, radius: 5.0, alcoholicsCount: 3, seed: 1901 },
    { x: 16, z: 0, radius: 5.0, alcoholicsCount: 3, seed: 1902 },
    { x: -28, z: -19, radius: 4.3, alcoholicsCount: 2, seed: 1903 },
    { x: 28, z: 19, radius: 4.3, alcoholicsCount: 2, seed: 1904 },
  ],
  // Tour 20: Final Citadel Ring
  [
    { x: -22, z: -16, radius: 4.9, alcoholicsCount: 3, seed: 2001 },
    { x: 22, z: -16, radius: 4.9, alcoholicsCount: 3, seed: 2002 },
    { x: -22, z: 16, radius: 4.9, alcoholicsCount: 3, seed: 2003 },
    { x: 22, z: 16, radius: 4.9, alcoholicsCount: 3, seed: 2004 },
  ],
];

function buildReefsForTour(tourIdx: number, islands: IslandSpec[]): ReefSpec[] {
  const reefs: ReefSpec[] = [];
  const count = 4 + (tourIdx % 3);
  for (let i = 0; i < count; i++) {
    const angle = (tourIdx * 1.15 + (i / count) * Math.PI * 2) % (Math.PI * 2);
    const distX = 14 + ((tourIdx * 7 + i * 11) % 24);
    const distZ = 11 + ((tourIdx * 5 + i * 9) % 16);
    const rx = Math.cos(angle) * distX;
    const rz = Math.sin(angle) * distZ;

    // Ensure reef doesn't overlap center (0,0) or any island
    if (Math.hypot(rx, rz) < 10.5) continue;
    const collidesIsland = islands.some((isl) => Math.hypot(rx - isl.x, rz - isl.z) < isl.radius + 4.5);
    if (collidesIsland) continue;

    reefs.push({
      x: Number(rx.toFixed(1)),
      z: Number(rz.toFixed(1)),
      radius: 1.8 + ((tourIdx + i) % 3) * 0.35,
    });
  }
  return reefs;
}

function buildRosterForTour(tour: number): MonsterKind[] {
  if (tour === 1) return ['pike', 'peskar', 'catfish'];
  if (tour === 2) return ['pike', 'ersh', 'peskar', 'catfish'];
  if (tour === 3) return ['pike', 'ersh', 'lin', 'catfish', 'peskar'];
  if (tour === 4) return ['pike', 'ersh', 'lin', 'eel', 'peskar'];
  if (tour <= 6) return ['pike', 'ersh', 'lin', 'eel', 'puffer', 'peskar', 'catfish'];
  if (tour <= 9) return ['pike', 'ersh', 'lin', 'eel', 'puffer', 'peskar', 'catfish', 'karas'];
  return ['pike', 'ersh', 'lin', 'eel', 'puffer', 'peskar', 'catfish', 'karas'];
}

export const TOURS: TourDefinition[] = Array.from({ length: TOTAL_TOURS }, (_, idx) => {
  const tourNum = idx + 1;
  const meta = TOUR_NAMES[idx];
  const islands = ISLAND_LAYOUTS[idx];
  const reefs = buildReefsForTour(idx, islands);

  const bossCount =
    tourNum === 20 ? 2 : tourNum === 15 || tourNum === 10 || tourNum % 3 === 0 ? 1 : 0;

  return {
    tour: tourNum,
    name: meta.name,
    subtitle: meta.subtitle,
    biome: BIOME_CYCLE[idx],
    weather: WEATHER_CYCLE[idx],
    islands,
    reefs,
    roster: buildRosterForTour(tourNum),
    enemyCount: Math.round(7 + tourNum * 2.1),
    crocInterval: Math.max(5.2, 11.5 - tourNum * 0.3),
    maxCrocs: tourNum >= 14 ? 3 : 2,
    bossCount,
  };
});

export function getTourDefinition(tourNum: number): TourDefinition {
  const clamped = Math.max(1, Math.min(TOTAL_TOURS, tourNum));
  return TOURS[clamped - 1];
}
