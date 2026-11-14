import { Difficulty, MonsterKind, PlayerStats, UpgradeId, UpgradeOption } from './types';

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1600;
export const SHORE_PADDING = 90;
export const HIGH_SCORE_STORAGE_KEY = 'black_lake_sasha_high_score_v1';
export const HERO_TITLE = 'Барон Песковской Нефтебульбы Саша';
export const HERO_SHORT_TITLE = 'Барон Саша';

export const HERO_ART_PATH = '/src/assets/images/black_lake_hero_1794603140048.jpg';
export const PIKE_PORTRAIT_PATH = '/src/assets/images/monster_pike_portrait_1794603140120.jpg';
export const LEVIATHAN_PORTRAIT_PATH = '/src/assets/images/monster_leviathan_portrait_1794603138949.jpg';

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  subtitle: string;
  enemyHpMult: number;
  enemySpeedMult: number;
  enemyDamageMult: number;
  spawnMult: number;
  scoreMult: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  calm: {
    id: 'calm',
    label: 'Тихая вода',
    subtitle: 'Меньше урона, плавный темп',
    enemyHpMult: 0.85,
    enemySpeedMult: 0.9,
    enemyDamageMult: 0.75,
    spawnMult: 0.85,
    scoreMult: 1.0,
  },
  hunt: {
    id: 'hunt',
    label: 'Охота',
    subtitle: 'Сбалансированный бой на озере',
    enemyHpMult: 1.0,
    enemySpeedMult: 1.0,
    enemyDamageMult: 1.0,
    spawnMult: 1.0,
    scoreMult: 1.25,
  },
  nightmare: {
    id: 'nightmare',
    label: 'Чёрная бездна',
    subtitle: 'Быстрые монстры, высокий счёт',
    enemyHpMult: 1.25,
    enemySpeedMult: 1.15,
    enemyDamageMult: 1.35,
    spawnMult: 1.25,
    scoreMult: 1.6,
  },
};

export const BASE_PLAYER_STATS: PlayerStats = {
  maxHp: 100,
  hp: 100,
  speed: 315,
  damage: 28,
  fireRate: 3.4,
  projectileCount: 1,
  projectileSpeed: 780,
  dashCooldown: 2.6,
  depthCharges: 2,
  maxDepthCharges: 2,
  depthRadius: 270,
  critChance: 0.12,
  lanternRadius: 340,
};

export const UPGRADE_CATALOG: Record<UpgradeId, UpgradeOption> = {
  multishot: {
    id: 'multishot',
    title: 'Веерный гарпун',
    description: 'Добавляет +1 дополнительный гарпун за выстрел.',
    cost: 45,
    maxLevel: 3,
    statLabel: '+1 гарпун',
  },
  heavy_harpoon: {
    id: 'heavy_harpoon',
    title: 'Кованый наконечник',
    description: 'Увеличивает урон каждого гарпуна на 30% и усиливает отдачу по рыбе.',
    cost: 30,
    maxLevel: 5,
    statLabel: '+30% урона',
  },
  rapid_loader: {
    id: 'rapid_loader',
    title: 'Пружинный затвор',
    description: 'Повышает скорострельность турели Барона Саши на 22%.',
    cost: 30,
    maxLevel: 5,
    statLabel: '+22% темпа',
  },
  reinforced_hull: {
    id: 'reinforced_hull',
    title: 'Дубовая обшивка',
    description: 'Увеличивает макс. прочность лодки на 30 и полностью чинит корпус.',
    cost: 25,
    maxLevel: 5,
    statLabel: '+30 HP и ремонт',
  },
  turboprop: {
    id: 'turboprop',
    title: 'Мощный винт',
    description: 'Увеличивает скорость хода лодки на 12% и ускоряет откат рывка.',
    cost: 25,
    maxLevel: 4,
    statLabel: '+12% хода',
  },
  depth_charges: {
    id: 'depth_charges',
    title: 'Глубинные заряды',
    description: 'Даёт +1 заряд (клавиша E) и расширяет радиус взрывной волны.',
    cost: 35,
    maxLevel: 4,
    statLabel: '+1 заряд и радиус',
  },
  lantern_crit: {
    id: 'lantern_crit',
    title: 'Носовой прожектор',
    description: 'Расширяет свет фонаря Саши и повышает шанс критического удара (+10%).',
    cost: 28,
    maxLevel: 4,
    statLabel: '+10% крит и свет',
  },
};

export interface BestiaryEntry {
  kind: MonsterKind;
  name: string;
  category: 'Монстр-рыба' | 'Лесной злодей' | 'Босс озера';
  threat: string;
  behavior: string;
  lore: string;
  habitat: string;
  stats: {
    hp: number;
    speed: number;
    damage: number;
    score: number;
  };
  viewDistance: number;
  portrait?: string;
}

export const BESTIARY_ENTRIES: BestiaryEntry[] = [
  {
    kind: 'pike',
    name: 'Щука-стрела',
    category: 'Монстр-рыба',
    threat: 'Быстрый хищник',
    behavior: 'Намечает траекторию красной полосой и молниеносно бросается на лодку.',
    lore: 'Вытянутая торпедообразная щука с янтарными глазами и зазубренным спинным плавником. Замирает в чёрной воде, выцеливает борт катера и совершает стремительный выпад.',
    habitat: 'Все волны, глубокие воды и отмели',
    stats: { hp: 48, speed: 8.2, damage: 14, score: 110 },
    viewDistance: 4.4,
    portrait: PIKE_PORTRAIT_PATH,
  },
  {
    kind: 'peskar',
    name: 'Пескарь Натаскарь',
    category: 'Монстр-рыба',
    threat: 'Юркий налётчик',
    behavior: 'Стремительно лавирует зигзагами между островами и заходит лодке во фланг.',
    lore: 'Пронырливый песчано-золотой разбойник с широким рылом, длинными усами и латунным мешком добычи на спине. Обожает обходить рифы и выныривать с боку катера.',
    habitat: 'С 1-го тура, прибрежные мели и островки',
    stats: { hp: 42, speed: 9.8, damage: 12, score: 130 },
    viewDistance: 4.1,
  },
  {
    kind: 'ersh',
    name: 'Ёрш Передрёш',
    category: 'Монстр-рыба',
    threat: 'Колючий боец',
    behavior: 'Ощетинивается спинными шипами и резко ускоряется для таранного броска.',
    lore: 'Бронированный оливково-бронзовый ёрш с частоколом золотых шипов и колючими жабрами. Чем сильнее ранен, тем яростнее бросается на корпус судна.',
    habitat: 'Со 2-го тура, коряжники и проливы между островами',
    stats: { hp: 76, speed: 7.4, damage: 18, score: 145 },
    viewDistance: 4.4,
  },
  {
    kind: 'lin',
    name: 'Линь Жминь',
    category: 'Монстр-рыба',
    threat: 'Болотный пресс',
    behavior: 'Выдерживает град гарпунов и стреляет тяжёлыми сгустками болотного ила.',
    lore: 'Упитанный изумрудно-лаймовый толстяк с мясистыми плавниками-лопастями. Не спешит в ближний бой, а сжимает озеро плотным огнём токсичных шаров.',
    habitat: 'С 3-го тура, тинистые заводи и топи',
    stats: { hp: 145, speed: 5.2, damage: 20, score: 205 },
    viewDistance: 5.0,
  },
  {
    kind: 'karas',
    name: 'Карась Вырубась',
    category: 'Монстр-рыба',
    threat: 'Мощный нокаут',
    behavior: 'Выбирает цель оранжевым лучом и сокрушительно таранит лодку лбом.',
    lore: 'Высокотелый медно-рыжий великан с бронированной лобовой пластиной. Один его разбег способен отбросить катер Барона Саши на несколько метров.',
    habitat: 'С 7-го тура, глубокие каньоны и перекаты',
    stats: { hp: 115, speed: 6.4, damage: 24, score: 185 },
    viewDistance: 4.8,
  },
  {
    kind: 'catfish',
    name: 'Озёрный сом',
    category: 'Монстр-рыба',
    threat: 'Тяжёлый таран',
    behavior: 'Пробивает корпус массой. После гибели рассыпается на стаю зубастых мальков.',
    lore: 'Массивный донный гигант с длинными усами и толстой чешуёй. Идёт напролом прямо на лодку Барона Саши, а при уничтожении выпускает из пасти шустрых мальков-пираний.',
    habitat: 'С 1-й волны, донные ямы озера',
    stats: { hp: 125, speed: 5.0, damage: 22, score: 190 },
    viewDistance: 5.4,
  },
  {
    kind: 'minnow',
    name: 'Малёк-пиранья',
    category: 'Монстр-рыба',
    threat: 'Стайный рой',
    behavior: 'Вырывается из поверженного Озёрного сома и стремительно преследует катер.',
    lore: 'Мелкий, но предельно агрессивный хищник с алыми глазами. Опасен своей высокой скоростью и тем, что атакует парой сразу после гибели крупного сома.',
    habitat: 'Появляется при гибели Озёрного сома',
    stats: { hp: 20, speed: 10.6, damage: 8, score: 45 },
    viewDistance: 3.1,
  },
  {
    kind: 'eel',
    name: 'Угорь-искра',
    category: 'Монстр-рыба',
    threat: 'Дальний бой',
    behavior: 'Извивается на средней дистанции и выпускает разряды болотной энергии.',
    lore: 'Шестисегментный светящийся угорь, пропитанный фосфором Чёрного озера. Держится на дистанции от прожектора и ведёт прицельный огонь энергетическими сгустками.',
    habitat: 'Со 2-й волны, центральная акватория',
    stats: { hp: 68, speed: 7.0, damage: 12, score: 150 },
    viewDistance: 5.6,
  },
  {
    kind: 'puffer',
    name: 'Иглобрюх-мина',
    category: 'Монстр-рыба',
    threat: 'Взрывная угроза',
    behavior: 'Сближается с лодкой, а при гибели разбрасывает круговой залп из 8 ядовитых сфер.',
    lore: 'Раздутый багровый шар, утыканный острыми шипами во все стороны. Ускоряется вблизи судна и превращается в живую морскую мину в момент уничтожения.',
    habitat: 'Со 2-й волны, каменистые рифы',
    stats: { hp: 82, speed: 5.6, damage: 20, score: 165 },
    viewDistance: 4.0,
  },
  {
    kind: 'croc_gena',
    name: 'Крокодил Гена',
    category: 'Лесной злодей',
    threat: 'Залп из леса',
    behavior: 'Выпрыгивает из прибрежного леса, прыгает над волнами и стреляет золотыми биткоинами.',
    lore: 'Коварный рептилий в алом пальто и чёрном котелке с оскаленной пастью. Вылезает из тёмных сосен на берег, преодолевает волны мощными прыжками и палит крутящимися биткоинами.',
    habitat: 'Регулярно вылезает с лесного берега в ходе боя',
    stats: { hp: 95, speed: 5.4, damage: 16, score: 220 },
    viewDistance: 5.2,
  },
  {
    kind: 'leviathan',
    name: 'Левиафан бездны',
    category: 'Босс озера',
    threat: 'Босс озера',
    behavior: 'Совершает таранные броски и выпускает веер из пяти разрядов. Идёт с эскортом.',
    lore: 'Древнее семисегментное чудовище в изумрудных шипах и с гигантскими усами-щупальцами. Владыка глубин Чёрного озера, выходящий на поверхность каждую третью волну.',
    habitat: 'Каждая 3-я волна (Волна 3, 6, 9...)',
    stats: { hp: 780, speed: 5.8, damage: 30, score: 1200 },
    viewDistance: 12.2,
    portrait: LEVIATHAN_PORTRAIT_PATH,
  },
];

