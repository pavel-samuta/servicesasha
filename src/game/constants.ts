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
    title: 'Сонарный прожектор',
    description: 'Усиливает свет фонаря, крит-шанс (+10%) и ускоряет откат акустического сигнала [F].',
    cost: 28,
    maxLevel: 4,
    statLabel: '+10% крит и сонар',
  },
  hull_insulation: {
    id: 'hull_insulation',
    title: 'Изоляция и стабилизаторы',
    description: 'Уменьшает время электрошока, ЭМ-помех и резонанса на 30%, а также гасит снос от гидроудара.',
    cost: 32,
    maxLevel: 3,
    statLabel: '-30% шок и снос',
  },
};

export const MONSTER_EYE_COLORS: Record<MonsterKind, string> = {
  pike: '#fbbf24', // Огненно-янтарные
  ersh: '#ff6b00', // Раскалённо-оранжевые
  lin: '#84cc16', // Ядовито-салатовые
  eel: '#00e5ff', // Электро-циановые
  puffer: '#e879f9', // Неоново-фиолетовые
  karas: '#facc15', // Золотистые
  catfish: '#dc2626', // Тёмно-красные
  peskar: '#2dd4bf', // Аквамариновые
  minnow: '#ff2d55', // Ало-рубиновые
  glass_ghost: '#e2e8f0', // Серебристо-белые
  mirage_ray: '#14b8a6', // Бирюзовые
  chrono_morok: '#ec4899', // Розово-малиновые
  sky_jelly: '#38bdf8', // Небесно-голубые
  turtle_rift: '#a3e635', // Изумрудно-лаймовые
  croc_gena: '#fde047', // Жёлто-лимонные
  leviathan: '#10b981', // Изумрудно-призрачные
};

export type DefenseCategory =
  | 'Контактная'
  | 'Дистанционная'
  | 'Поведенческая'
  | 'Запредельная'
  | 'Надводная';

export interface BestiaryEntry {
  kind: MonsterKind;
  name: string;
  abilityTitle: string;
  category: 'Монстр-рыба' | 'Надводное существо' | 'Лесной злодей' | 'Босс озера';
  defenseCategory: DefenseCategory;
  threat: string;
  eyeColorLabel: string;
  telegraphSignal: string;
  defenseTrait: string;
  weakness: string;
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
    abilityTitle: 'Пространственный разрез',
    category: 'Монстр-рыба',
    defenseCategory: 'Дистанционная',
    threat: 'Гидроудар-клин',
    eyeColorLabel: 'Огненно-янтарные',
    telegraphSignal: 'Вытягивает тело, вдоль позвоночника вспыхивают янтарные полосы.',
    defenseTrait: 'Выпускает узкую клиновидную ударную волну, сбивающую лодку с курса.',
    weakness: 'После импульса на 3 секунды теряет манёвренность и становится лёгкой мишенью.',
    behavior: 'Предупреждает световым клином и посылает импульсный гидроудар по прямой.',
    lore: 'Стремительный хищник с огненно-янтарными глазами и светящимся хребтом. Разрезает воду ударным клином, отбрасывающим катер.',
    habitat: 'С 1-го тура, все глубины озера',
    stats: { hp: 48, speed: 8.2, damage: 14, score: 110 },
    viewDistance: 4.4,
    portrait: PIKE_PORTRAIT_PATH,
  },
  {
    kind: 'ersh',
    name: 'Ёрш Передрёш',
    abilityTitle: 'Иглы резонанса',
    category: 'Монстр-рыба',
    defenseCategory: 'Контактная',
    threat: 'Акустический щит',
    eyeColorLabel: 'Раскалённо-оранжевые',
    telegraphSignal: 'Шипы начинают часто вибрировать, вокруг вспыхивает оранжевое кольцо.',
    defenseTrait: 'Звуковой импульс вызывает тряску камеры, дезориентирует штурвал и колет шипами.',
    weakness: 'Во время вибрации рыба почти неподвижна и открыта для точных выстрелов.',
    behavior: 'Зависает в резонансе, сбивая курс катера, затем таранит колючками.',
    lore: 'Колючий боец с раскалённо-оранжевыми глазами. Вибрация длинных плавниковых игл формирует дезориентирующий акустический щит.',
    habitat: 'Со 2-го тура, коряжники и проливы',
    stats: { hp: 76, speed: 7.4, damage: 18, score: 145 },
    viewDistance: 4.4,
  },
  {
    kind: 'lin',
    name: 'Линь Жминь',
    abilityTitle: 'Живая слизь',
    category: 'Монстр-рыба',
    defenseCategory: 'Поведенческая',
    threat: 'Токсичное облако',
    eyeColorLabel: 'Ядовито-салатовые',
    telegraphSignal: 'Раздувает ядовитые железы и подсвечивает салатовые полосы.',
    defenseTrait: 'Сбрасывает облако слизи (замедляет катер на 35%) и ускользает; слизь электризуется рядом с Угрём!',
    weakness: 'После сброса защитного слоя становится уязвимым и получает повышенный урон (+45%).',
    behavior: 'Выбрасывает споровое облако и отпрыгивает; лечится Бульбой или Чесноком.',
    lore: 'Толстобокий токсичный обитатель с ядовито-салатовыми глазами и биолюминесцентными железами.',
    habitat: 'С 3-го тура, болотные заводи',
    stats: { hp: 145, speed: 5.2, damage: 20, score: 205 },
    viewDistance: 5.0,
  },
  {
    kind: 'eel',
    name: 'Угорь-искра',
    abilityTitle: 'Электромагнитный кокон',
    category: 'Монстр-рыба',
    defenseCategory: 'Дистанционная',
    threat: 'Отключение HUD и мотора',
    eyeColorLabel: 'Электро-циановые',
    telegraphSignal: 'Кольцевые органы вспыхивают циановыми разрядами вокруг тела.',
    defenseTrait: 'Круговой разряд глушит мотор, вызывает ЭМ-помехи HUD на 2 сек и заряжает слизь Линя!',
    weakness: 'После разряда уходит на перезарядку; помогает апгрейд «Изоляция двигателя».',
    behavior: 'Держит дистанцию, накапливает кокон и бьёт кольцом тока при сближении.',
    lore: 'Шестисегментный электрический угорь с электро-циановыми глазами, нарушающий приборы катера и электризующий воду.',
    habitat: 'С 4-го тура, центральные плёсы',
    stats: { hp: 68, speed: 7.0, damage: 12, score: 150 },
    viewDistance: 5.6,
  },
  {
    kind: 'puffer',
    name: 'Иглобрюх-мина',
    abilityTitle: 'Биологическая мина',
    category: 'Монстр-рыба',
    defenseCategory: 'Контактная',
    threat: 'Залп из 8 сфер',
    eyeColorLabel: 'Неоново-фиолетовые',
    telegraphSignal: 'Раздувается в размерах и пульсирует фиолетовыми железами.',
    defenseTrait: 'При касании или гибели раздутый иглобрюх выбрасывает 8 ядовитых сфер во все стороны.',
    weakness: 'В раздутом состоянии движется очень медленно, позволяя легко обойти его.',
    behavior: 'Чередует обычное преследование и раздутую фазу мины с кристаллическими шипами.',
    lore: 'Неоновый шар с фиолетовыми глазами и предупреждающей окраской. Живая мина среди рифов.',
    habitat: 'С 5-го тура, каменистые банки',
    stats: { hp: 82, speed: 5.6, damage: 20, score: 165 },
    viewDistance: 4.0,
  },
  {
    kind: 'karas',
    name: 'Карась Вырубась',
    abilityTitle: 'Живая броня',
    category: 'Монстр-рыба',
    defenseCategory: 'Контактная',
    threat: 'Отражение гарпунов',
    eyeColorLabel: 'Золотистые',
    telegraphSignal: 'Минерализованные лобовые пластины смыкаются и вспыхивают золотым блеском.',
    defenseTrait: 'Отражает лобовые гарпуны со звоном рикошета и мощно таранит катер.',
    weakness: 'Брюшко и фланги остаются открытыми во время разворота после броска.',
    behavior: 'Выставляет лобовой панцирь на цель, разгоняется и открывает корму при развороте.',
    lore: 'Могучий бронированный гигант с золотистыми глазами и минерализованной чешуёй, смыкающейся в непробиваемый щит.',
    habitat: 'С 7-го тура, глубокие каньоны',
    stats: { hp: 115, speed: 6.4, damage: 24, score: 185 },
    viewDistance: 4.8,
  },
  {
    kind: 'catfish',
    name: 'Сом Бездон',
    abilityTitle: 'Гравитационная воронка',
    category: 'Монстр-рыба',
    defenseCategory: 'Запредельная',
    threat: 'Затягивающий водоворот',
    eyeColorLabel: 'Тёмно-красные',
    telegraphSignal: 'Длинные усы напрягаются, а вокруг пасти закручивается тёмный водоворот.',
    defenseTrait: 'Затягивает лодку в радиусе 7 метров прямо к себе (или в токсичную слизь!); при смерти выпускает мальков.',
    weakness: 'Во время создания воронки почти не может поворачиваться.',
    behavior: 'Притягивает судно направленным потоком жаберных камер, замирая на месте.',
    lore: 'Громадный глубинный сом с тёмно-красными глазами, чьи жаберные камеры порождают локальную воронку давления.',
    habitat: 'С 1-го тура, глубокие ямы',
    stats: { hp: 125, speed: 5.0, damage: 22, score: 190 },
    viewDistance: 5.4,
  },
  {
    kind: 'peskar',
    name: 'Пескарь Натаскарь',
    abilityTitle: 'Квантовая линька',
    category: 'Монстр-рыба',
    defenseCategory: 'Запредельная',
    threat: 'Сдвиг на 3–5 м',
    eyeColorLabel: 'Аквамариновые',
    telegraphSignal: 'Мерцает аквамариновой вспышкой перед смещением.',
    defenseTrait: 'При опасности распадается на световые фрагменты и телепортируется на 3–5 метров в сторону.',
    weakness: 'После квантового скачка замирает на мгновение и уязвим для плотного огня.',
    behavior: 'Лавирует с золотым мешком добычи и уходит квантовыми скачками с линии прицела.',
    lore: 'Пронырливый разбойник с аквамариновыми глазами, освоивший квантовую линьку среди островков.',
    habitat: 'С 1-го тура, прибрежные отмели',
    stats: { hp: 42, speed: 9.8, damage: 12, score: 130 },
    viewDistance: 4.1,
  },
  {
    kind: 'minnow',
    name: 'Малёк-пиранья',
    abilityTitle: 'Пространственный карман',
    category: 'Монстр-рыба',
    defenseCategory: 'Запредельная',
    threat: 'Стайное уклонение',
    eyeColorLabel: 'Ало-рубиновые',
    telegraphSignal: 'Резко сжимается перед мгновенным рывком.',
    defenseTrait: 'Молниеносно смещается рывком из-под выстрелов и рвёт обшивку плавниками.',
    weakness: 'Имеет низкую прочность — легко гибнет от веерного огня или глубинного заряда.',
    behavior: 'Вырывается из поверженного Сома Бездона и бросается стаей наперерез.',
    lore: 'Мелкий алоглазый хищник с бритвенными лучами и резкими выпадами.',
    habitat: 'Вырывается из поверженного Сома Бездона',
    stats: { hp: 20, speed: 10.6, damage: 8, score: 45 },
    viewDistance: 3.1,
  },
  {
    kind: 'glass_ghost',
    name: 'Стеклянный Призрак',
    abilityTitle: 'Оптическое исчезновение',
    category: 'Монстр-рыба',
    defenseCategory: 'Поведенческая',
    threat: 'Невидимость + ложный силуэт',
    eyeColorLabel: 'Серебристо-белые',
    telegraphSignal: 'Кристаллическое тело преломляет свет, оставляя призрачную «Память воды».',
    defenseTrait: 'Становится почти невидимым на 4.5 сек и оставляет ложную световую копию на старом месте.',
    weakness: 'Выдаёт себя рябью воды и мгновенно раскрывается акустическим сигналом [F] или прожектором.',
    behavior: 'Исчезает под покровом пигментных клеток, оставляя светящуюся приманку.',
    lore: 'Прозрачное кристаллическое существо с серебристо-белыми глазами, управляющее преломлением света.',
    habitat: 'С 4-го тура, туманные протоки',
    stats: { hp: 64, speed: 7.8, damage: 16, score: 175 },
    viewDistance: 4.5,
  },
  {
    kind: 'mirage_ray',
    name: 'Скат Мираж',
    abilityTitle: 'Искажение восприятия',
    category: 'Монстр-рыба',
    defenseCategory: 'Поведенческая',
    threat: 'Три ложных силуэта',
    eyeColorLabel: 'Бирюзовые',
    telegraphSignal: 'На крыльях зажигаются тысячи биолюминесцентных узоров.',
    defenseTrait: 'Порождает два ложных ноуменальных силуэта, сбивающих прицел.',
    weakness: 'Настоящий скат оставляет пузырьковый след и тень, а миражи развеиваются сигналом [F].',
    behavior: 'Раздваивается на миражи и заходит с разных бортов катера.',
    lore: 'Грациозный бирюзовоглазый скат, чьи крылья проецируют ложные образы на поверхность воды.',
    habitat: 'С 6-го тура, широкие плёсы',
    stats: { hp: 88, speed: 7.2, damage: 18, score: 195 },
    viewDistance: 4.9,
  },
  {
    kind: 'chrono_morok',
    name: 'Хроно-Морок',
    abilityTitle: 'Временной пузырь',
    category: 'Монстр-рыба',
    defenseCategory: 'Запредельная',
    threat: 'Замедление времени на 50%',
    eyeColorLabel: 'Розово-малиновые',
    telegraphSignal: 'Вокруг тела начинают вращаться светящиеся мембраны.',
    defenseTrait: 'Раздувает временную сферу на 3 секунды: внутри лодка и гарпуны замедляются на 50%.',
    weakness: 'После распада сферы существо истощено и получает +45% урона.',
    behavior: 'Подплывает на среднюю дистанцию, разворачивает хроно-пузырь и переходит в истощение.',
    lore: 'Аномальная глубоководная рыба с розово-малиновыми глазами и кольцами времени вокруг плавников.',
    habitat: 'С 8-го тура, аномальные глубины',
    stats: { hp: 108, speed: 5.9, damage: 21, score: 230 },
    viewDistance: 5.0,
  },
  {
    kind: 'sky_jelly',
    name: 'Медуза Небоплав',
    abilityTitle: 'Надводная электрозавеса',
    category: 'Надводное существо',
    defenseCategory: 'Надводная',
    threat: 'Парение + удар сверху',
    eyeColorLabel: 'Небесно-голубые',
    telegraphSignal: 'Газовый купол вспыхивает, а свисающие щупальца искрятся над водой.',
    defenseTrait: 'Парит над волнами благодаря газовому органу и бьёт электрической завесой сверху.',
    weakness: 'После разряда купол спускается ниже к воде и становится уязвим.',
    behavior: 'Дрейфует над поверхностью озера, посылая электрические импульсы вниз.',
    lore: 'Надводный парящий организм с полупрозрачным газовым куполом и светящимися щупальцами.',
    habitat: 'С 5-го тура, штормовые воды',
    stats: { hp: 78, speed: 6.2, damage: 19, score: 190 },
    viewDistance: 5.2,
  },
  {
    kind: 'turtle_rift',
    name: 'Черепахор Разлом',
    abilityTitle: 'Панцирь-риф и волна',
    category: 'Надводное существо',
    defenseCategory: 'Надводная',
    threat: 'Замаскированный остров',
    eyeColorLabel: 'Изумрудно-лаймовые',
    telegraphSignal: 'Каменистый панцирь приподнимается из воды, пластины смыкаются.',
    defenseTrait: 'Притворяется рифом; при сближении смыкает броню (неуязвим!) и пускает мощную круговую волну.',
    weakness: 'Когда пластины раздвигаются после волны, уязвим в течение 2.5 секунд.',
    behavior: 'Затаивается у пути лодки, затем захлопывает панцирь с ударной волной.',
    lore: 'Гигантский панцирный зверь, чья спина поросла мхом и камнем, маскируя его под мелкий островок.',
    habitat: 'С 6-го тура, проливы и отмели',
    stats: { hp: 160, speed: 3.6, damage: 24, score: 225 },
    viewDistance: 5.4,
  },
  {
    kind: 'croc_gena',
    name: 'Крокодил Гена',
    abilityTitle: 'Антигравитационный прыжок',
    category: 'Лесной злодей',
    defenseCategory: 'Надводная',
    threat: 'Залп биткоинов из леса',
    eyeColorLabel: 'Жёлто-лимонные',
    telegraphSignal: 'Выскакивает из прибрежных сосен и замирает в прыжке.',
    defenseTrait: 'Алое пальто предупреждает издалека; прыгает над волнами и стреляет тяжёлыми биткоинами.',
    weakness: 'После приземления требуется короткое восстановление.',
    behavior: 'Вылезает с лесного берега, совершает высокие прыжки и палит золотыми монетами.',
    lore: 'Легендарный лесной злодей с жёлто-лимонными глазами в алом пальто и чёрном котелке.',
    habitat: 'Регулярно вылезает из леса в каждом туре',
    stats: { hp: 95, speed: 5.4, damage: 16, score: 220 },
    viewDistance: 5.2,
  },
  {
    kind: 'leviathan',
    name: 'Левиафан бездны',
    abilityTitle: 'Магнитный шторм',
    category: 'Босс озера',
    defenseCategory: 'Запредельная',
    threat: 'Отклонение гарпунов и 5-залп',
    eyeColorLabel: 'Изумрудно-призрачные',
    telegraphSignal: 'Вокруг тела вспыхивают кольца магнитных частиц и красный луч броска.',
    defenseTrait: 'Создаёт магнитные кольца, отклоняющие гарпуны, совершает таран и веерный залп из 5 сфер.',
    weakness: 'После магнитного шторма и тарана на 2.5 секунды открыт для критических залпов.',
    behavior: 'Владыка глубин: чередует магнитный шторм, бросок и многолучевой обстрел.',
    lore: 'Древнее семисегментное чудовище с изумрудно-призрачными глазами, повелевающее давлением и полями Чёрного озера.',
    habitat: 'Босс ключевых туров (3, 6, 9, 10, 12, 15, 18, 20)',
    stats: { hp: 780, speed: 5.8, damage: 30, score: 1200 },
    viewDistance: 12.2,
    portrait: LEVIATHAN_PORTRAIT_PATH,
  },
];
