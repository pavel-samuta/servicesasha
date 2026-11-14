import * as THREE from 'three';
import { LakeMaterials } from './materials3d';
import { IslandSpec, ReefSpec, TOUR_BIOMES, TourDefinition } from './tours';
import { MonsterKind, WeatherKind } from './types';

export interface WorldObstacle3D {
  x: number;
  z: number;
  radius: number;
  isIsland: boolean;
}

export interface FishermanShoutContext {
  hpRatio: number;
  weather: WeatherKind;
  bossAlive: boolean;
  tourRoster: MonsterKind[];
}

export interface FishermanShoutEvent {
  speaker: string;
  text: string;
  seed: number;
}

interface AnimatedAlcoholic {
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  bottleArm: THREE.Group;
  phase: number;
  swaySpeed: number;
}

interface AnimatedFisherman {
  speaker: string;
  seed: number;
  worldX: number;
  worldZ: number;
  triggerRadius: number;
  baseYaw: number;
  root: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  rodArmGroup: THREE.Group;
  bobberMesh: THREE.Mesh;
  shoutSprite: THREE.Sprite;
  shoutMat: THREE.SpriteMaterial;
  shoutTexture: THREE.CanvasTexture | null;
  shoutTimer: number;
  cooldownTimer: number;
  phase: number;
}

export const FISHERMAN_NAMES = [
  'Рыбак Михалыч',
  'Дед Семён',
  'Боцман Петрович',
  'Дядя Толя',
  'Дед Захар',
  'Старик Игнат',
];

const GENERAL_TIPS = [
  'Саша, не жмись к камышам — крокодил Гена биткоином лупит!',
  'Если Линь Жминь плюётся зеленью — уходи рывком на Пробел!',
  'Карась Вырубась светит оранжевым перед тараном — беги вбок!',
  'Увидишь чеснок на воде — хватай! Гарпун сразу как пулемёт!',
  'Красная бульба латает лодку! Плыви к ней, пока рыбы не отняли!',
  'Прижмут со всех сторон — жми [E], глубинный заряд спасёт!',
  'Не экономь трофеи — загляни в мастерскую у причала после тура!',
  'Шёпотом: Ёрш Передрёш звереет, когда ему чешую поцарапают!',
];

const WEIRD_SHOUTS = [
  'Эй, Барон! Мужики у костра уже третий тост за твою нефтебульбу подняли!',
  'Клюёт сегодня странно... то ли рыба-монстр, то ли пустой башмак!',
  'Вчера видел, как Левиафан у берега криптокошелёк искал!',
  'Барон Саша, подвези дров, а то наши у костра скоро вёсла сожгут!',
  'Чёрное озеро любит смелых, свежий чеснок и хорошую уху!',
  'Не верь карасям с медным лбом — они без билета на озеро пролезли!',
  'Семёныч у костра поспорил с бутылкой, что ты за 20 туров прорвёшься!',
  'Гарпун — сила, а вот от жареного пескаря я бы не отказался...',
];

interface AnimatedCampfire {
  outerFlame: THREE.Mesh;
  innerFlame: THREE.Mesh;
  light: THREE.PointLight;
  embers: { mesh: THREE.Mesh; phase: number; radius: number; speed: number }[];
  phase: number;
}

export function pickFishermanPhraseFromContext(
  ctx: FishermanShoutContext,
  recentPhrases: string[]
): string {
  const candidates: string[] = [];

  if (ctx.hpRatio < 0.48) {
    candidates.push(
      'Саша, корпус трещит! Лови красную бульбу, пока не ушёл на дно!',
      'Подлечи лодку бульбой или починись у причала после боя!'
    );
  }
  if (ctx.bossAlive) {
    candidates.push(
      'Левиафан вышел на охоту! Держи дистанцию и копи глубинный заряд!',
      'Не подпускай Левиафана вплотную — он лодку одним рывком снесёт!'
    );
  }
  if (ctx.weather === 'storm' || ctx.weather === 'rain') {
    candidates.push(
      'Ну и ливень! В такую грозу крокодилы из леса ещё злее!',
      'Держи курс по фонарю, Саша — в бурю волны нос задирают!'
    );
  } else if (ctx.weather === 'mist') {
    candidates.push(
      'Туман густой как кисель! Смотри в оба — из мглы рыба прямо в борт лезет!'
    );
  }
  if (ctx.tourRoster.includes('peskar')) {
    candidates.push('Сначала бей Пескаря Натаскаря, а то круги вокруг лодки наматывает!');
  }
  if (ctx.tourRoster.includes('karas')) {
    candidates.push('Карась Вырубась светит оранжевым перед тараном — беги вбок!');
  }
  if (ctx.tourRoster.includes('lin')) {
    candidates.push('Линь Жминь ядовитой слизью пуляет — не стой на одной линии!');
  }

  candidates.push(...GENERAL_TIPS, ...WEIRD_SHOUTS);

  const fresh = candidates.filter((p) => !recentPhrases.includes(p));
  const pool = fresh.length > 0 ? fresh : candidates;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  recentPhrases.push(chosen);
  if (recentPhrases.length > 7) {
    recentPhrases.shift();
  }
  return chosen;
}

export class IslandManager3D {
  private scene: THREE.Scene;
  private materials: LakeMaterials;
  private rootGroup: THREE.Group;
  private obstacles: WorldObstacle3D[] = [];

  private campfires: AnimatedCampfire[] = [];
  private alcoholics: AnimatedAlcoholic[] = [];
  private fishermen: AnimatedFisherman[] = [];
  private globalShoutCooldown = 2.0;
  private recentPhrases: string[] = [];

  // Shared geometries & materials (zero leak across 20 tours)
  private geometries: THREE.BufferGeometry[] = [];
  private ownedMaterials: THREE.Material[] = [];

  private shoreGeo: THREE.CylinderGeometry;
  private grassCapGeo: THREE.CylinderGeometry;
  private rockGeo: THREE.DodecahedronGeometry;
  private ringGeo: THREE.RingGeometry;
  private trunkGeo: THREE.CylinderGeometry;
  private pineLowGeo: THREE.ConeGeometry;
  private pineHighGeo: THREE.ConeGeometry;
  private logBenchGeo: THREE.CylinderGeometry;
  private fireLogGeo: THREE.CylinderGeometry;
  private pebbleGeo: THREE.DodecahedronGeometry;
  private flameOuterGeo: THREE.ConeGeometry;
  private flameInnerGeo: THREE.ConeGeometry;
  private emberGeo: THREE.SphereGeometry;

  private torsoGeo: THREE.CylinderGeometry;
  private legGeo: THREE.CylinderGeometry;
  private headGeo: THREE.SphereGeometry;
  private noseGeo: THREE.SphereGeometry;
  private armGeo: THREE.CylinderGeometry;
  private bottleBodyGeo: THREE.CylinderGeometry;
  private bottleNeckGeo: THREE.CylinderGeometry;
  private hatCapGeo: THREE.CylinderGeometry;
  private ushankaFlapGeo: THREE.BoxGeometry;
  private visorGeo: THREE.BoxGeometry;
  private barrelGeo: THREE.CylinderGeometry;

  private crateGeo: THREE.BoxGeometry;
  private fisherHatBrimGeo: THREE.CylinderGeometry;
  private fisherBeardGeo: THREE.ConeGeometry;
  private rodGeo: THREE.CylinderGeometry;
  private lineGeo: THREE.CylinderGeometry;
  private bobberGeo: THREE.SphereGeometry;
  private bucketGeo: THREE.CylinderGeometry;

  private shoreMat: THREE.MeshStandardMaterial;
  private grassMat: THREE.MeshStandardMaterial;
  private foamMat: THREE.MeshBasicMaterial;
  private fireOuterMat: THREE.MeshBasicMaterial;
  private fireInnerMat: THREE.MeshBasicMaterial;
  private emberMat: THREE.MeshBasicMaterial;
  private charSkinMat: THREE.MeshStandardMaterial;
  private noseMat: THREE.MeshStandardMaterial;
  private pantsMat: THREE.MeshStandardMaterial;
  private hatMat: THREE.MeshStandardMaterial;
  private bottleMat: THREE.MeshStandardMaterial;
  private coatMats: THREE.MeshStandardMaterial[];
  private fisherCoatMat: THREE.MeshStandardMaterial;
  private fisherHatMat: THREE.MeshStandardMaterial;
  private beardMat: THREE.MeshStandardMaterial;
  private rodMat: THREE.MeshStandardMaterial;
  private lineMat: THREE.MeshBasicMaterial;
  private bobberMat: THREE.MeshStandardMaterial;
  private bucketMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, materials: LakeMaterials) {
    this.scene = scene;
    this.materials = materials;
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    // Initialize shared geometries
    this.shoreGeo = this.trackGeo(new THREE.CylinderGeometry(0.92, 1.08, 1.3, 14));
    this.grassCapGeo = this.trackGeo(new THREE.CylinderGeometry(0.84, 0.92, 0.24, 14));
    this.rockGeo = this.trackGeo(new THREE.DodecahedronGeometry(1, 0));
    this.ringGeo = this.trackGeo(new THREE.RingGeometry(0.95, 1.12, 24));
    this.ringGeo.rotateX(-Math.PI / 2);

    this.trunkGeo = this.trackGeo(new THREE.CylinderGeometry(0.22, 0.34, 1.9, 6));
    this.pineLowGeo = this.trackGeo(new THREE.ConeGeometry(1.45, 2.8, 7));
    this.pineHighGeo = this.trackGeo(new THREE.ConeGeometry(1.05, 2.3, 7));

    this.logBenchGeo = this.trackGeo(new THREE.CylinderGeometry(0.18, 0.2, 1.05, 7));
    this.logBenchGeo.rotateZ(Math.PI / 2);
    this.fireLogGeo = this.trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 0.95, 6));
    this.pebbleGeo = this.trackGeo(new THREE.DodecahedronGeometry(0.16, 0));

    this.flameOuterGeo = this.trackGeo(new THREE.ConeGeometry(0.32, 0.95, 7));
    this.flameOuterGeo.translate(0, 0.45, 0);
    this.flameInnerGeo = this.trackGeo(new THREE.ConeGeometry(0.18, 0.62, 6));
    this.flameInnerGeo.translate(0, 0.3, 0);
    this.emberGeo = this.trackGeo(new THREE.SphereGeometry(0.055, 5, 5));

    this.torsoGeo = this.trackGeo(new THREE.CylinderGeometry(0.2, 0.24, 0.56, 8));
    this.legGeo = this.trackGeo(new THREE.CylinderGeometry(0.085, 0.075, 0.48, 6));
    this.headGeo = this.trackGeo(new THREE.SphereGeometry(0.17, 10, 8));
    this.noseGeo = this.trackGeo(new THREE.SphereGeometry(0.055, 6, 6));
    this.armGeo = this.trackGeo(new THREE.CylinderGeometry(0.06, 0.055, 0.42, 6));
    this.bottleBodyGeo = this.trackGeo(new THREE.CylinderGeometry(0.055, 0.058, 0.24, 8));
    this.bottleNeckGeo = this.trackGeo(new THREE.CylinderGeometry(0.022, 0.03, 0.12, 6));
    this.hatCapGeo = this.trackGeo(new THREE.CylinderGeometry(0.18, 0.19, 0.15, 8));
    this.ushankaFlapGeo = this.trackGeo(new THREE.BoxGeometry(0.06, 0.18, 0.14));
    this.visorGeo = this.trackGeo(new THREE.BoxGeometry(0.24, 0.03, 0.14));
    this.barrelGeo = this.trackGeo(new THREE.CylinderGeometry(0.32, 0.3, 0.68, 10));

    this.crateGeo = this.trackGeo(new THREE.BoxGeometry(0.54, 0.34, 0.46));
    this.fisherHatBrimGeo = this.trackGeo(new THREE.CylinderGeometry(0.32, 0.34, 0.04, 12));
    this.fisherBeardGeo = this.trackGeo(new THREE.ConeGeometry(0.11, 0.22, 6));
    this.fisherBeardGeo.rotateX(Math.PI);
    this.rodGeo = this.trackGeo(new THREE.CylinderGeometry(0.015, 0.038, 2.35, 6));
    this.rodGeo.translate(0, 1.15, 0);
    this.lineGeo = this.trackGeo(new THREE.CylinderGeometry(0.005, 0.005, 1.45, 4));
    this.bobberGeo = this.trackGeo(new THREE.SphereGeometry(0.075, 8, 6));
    this.bucketGeo = this.trackGeo(new THREE.CylinderGeometry(0.18, 0.15, 0.3, 10));

    // Initialize shared materials
    this.shoreMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: '#3b2e21', roughness: 0.92, metalness: 0.04 })
    );
    this.grassMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: '#1b3526', roughness: 0.88, metalness: 0.02 })
    );
    this.foamMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: '#94a3b8',
        transparent: true,
        opacity: 0.36,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.fireOuterMat = this.trackMat(
      new THREE.MeshBasicMaterial({ color: '#fb923c', transparent: true, opacity: 0.92 })
    );
    this.fireInnerMat = this.trackMat(
      new THREE.MeshBasicMaterial({ color: '#fef08a', transparent: true, opacity: 0.96 })
    );
    this.emberMat = this.trackMat(
      new THREE.MeshBasicMaterial({ color: '#fdba74', transparent: true, opacity: 0.85 })
    );

    this.charSkinMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: '#e5b899', roughness: 0.65, metalness: 0.02 })
    );
    this.noseMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#e11d48',
        emissive: '#881337',
        emissiveIntensity: 0.35,
        roughness: 0.45,
      })
    );
    this.pantsMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.85, metalness: 0.05 })
    );
    this.hatMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.82, metalness: 0.05 })
    );
    this.bottleMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#16a34a',
        emissive: '#14532d',
        emissiveIntensity: 0.35,
        roughness: 0.16,
        metalness: 0.15,
      })
    );

    this.coatMats = [
      this.trackMat(new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.78 })),
      this.trackMat(new THREE.MeshStandardMaterial({ color: '#1e3a5f', roughness: 0.78 })),
      this.trackMat(new THREE.MeshStandardMaterial({ color: '#365314', roughness: 0.78 })),
    ];

    this.fisherCoatMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: '#ca8a04', roughness: 0.48, metalness: 0.06 })
    );
    this.fisherHatMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: '#a16207', roughness: 0.52, metalness: 0.05 })
    );
    this.beardMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.9, metalness: 0.02 })
    );
    this.rodMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.72, metalness: 0.08 })
    );
    this.lineMat = this.trackMat(
      new THREE.MeshBasicMaterial({ color: '#e2e8f0', transparent: true, opacity: 0.6 })
    );
    this.bobberMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#ef4444',
        emissive: '#dc2626',
        emissiveIntensity: 0.45,
        roughness: 0.35,
      })
    );
    this.bucketMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.32, metalness: 0.75 })
    );
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private trackMat<T extends THREE.Material>(m: T): T {
    this.ownedMaterials.push(m);
    return m;
  }

  public loadTour(tour: TourDefinition): WorldObstacle3D[] {
    this.clearCurrentMap();
    const palette = TOUR_BIOMES[tour.biome];
    this.grassMat.color.set(palette.foliageColor);
    this.shoreMat.color.set(palette.islandSoilColor);

    for (const isl of tour.islands) {
      this.buildIsland(isl);
      this.obstacles.push({
        x: isl.x,
        z: isl.z,
        radius: isl.radius,
        isIsland: true,
      });
    }

    for (const reef of tour.reefs) {
      this.buildReef(reef);
      this.obstacles.push({
        x: reef.x,
        z: reef.z,
        radius: reef.radius,
        isIsland: false,
      });
    }

    return this.obstacles;
  }

  public getObstacles(): WorldObstacle3D[] {
    return this.obstacles;
  }

  private clearCurrentMap() {
    for (const f of this.fishermen) {
      f.shoutTexture?.dispose();
      f.shoutTexture = null;
      f.shoutMat.dispose();
    }
    while (this.rootGroup.children.length > 0) {
      this.rootGroup.remove(this.rootGroup.children[0]);
    }
    this.obstacles = [];
    this.campfires = [];
    this.alcoholics = [];
    this.fishermen = [];
    this.globalShoutCooldown = 1.5;
  }

  private buildIsland(spec: IslandSpec) {
    const group = new THREE.Group();
    group.position.set(spec.x, 0, spec.z);

    // 1. Sandy/Earthy Island Mound
    const shore = new THREE.Mesh(this.shoreGeo, this.shoreMat);
    shore.scale.set(spec.radius, 1, spec.radius * 0.94);
    shore.position.y = -0.05;
    shore.receiveShadow = true;
    shore.castShadow = true;
    group.add(shore);

    const grassCap = new THREE.Mesh(this.grassCapGeo, this.grassMat);
    grassCap.scale.set(spec.radius, 1, spec.radius * 0.94);
    grassCap.position.y = 0.62;
    grassCap.receiveShadow = true;
    group.add(grassCap);

    // Shoreline foam ring
    const foam = new THREE.Mesh(this.ringGeo, this.foamMat);
    foam.position.y = 0.1;
    foam.scale.setScalar(spec.radius * 1.07);
    group.add(foam);

    // Coastal rocks around perimeter
    const rockCount = 6;
    for (let r = 0; r < rockCount; r++) {
      const a = (r / rockCount) * Math.PI * 2 + spec.seed * 0.13;
      const dist = spec.radius * 0.88;
      const rock = new THREE.Mesh(this.rockGeo, this.materials.rockMaterial);
      const rScale = 0.48 + ((spec.seed + r) % 3) * 0.18;
      rock.scale.set(rScale * 1.2, rScale * 0.72, rScale);
      rock.position.set(Math.cos(a) * dist, 0.2, Math.sin(a) * dist);
      rock.rotation.set(0.2, a, 0.15);
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);
    }

    // 2. Two Pine Trees & Wooden Barrel on the back edge (facing away from lake center 0,0)
    const awayAngle = Math.atan2(spec.z, spec.x);
    for (let t = 0; t < 2; t++) {
      const ta = awayAngle + (t === 0 ? -0.52 : 0.52);
      const td = spec.radius * 0.56;
      const tx = Math.cos(ta) * td;
      const tz = Math.sin(ta) * td;

      const pine = new THREE.Group();
      pine.position.set(tx, 0.72, tz);
      const scale = 0.85 + (t % 2) * 0.22;
      pine.scale.setScalar(scale);

      const trunk = new THREE.Mesh(this.trunkGeo, this.materials.pineTrunk);
      trunk.position.y = 0.95;
      trunk.castShadow = true;
      const cone1 = new THREE.Mesh(this.pineLowGeo, this.materials.pineFoliage);
      cone1.position.y = 2.4;
      cone1.castShadow = true;
      const cone2 = new THREE.Mesh(this.pineHighGeo, this.materials.pineFoliage);
      cone2.position.y = 3.85;
      cone2.castShadow = true;

      pine.add(trunk, cone1, cone2);
      group.add(pine);
    }

    // Barrel / stash prop near pines
    const barrelAngle = awayAngle + 0.05;
    const barrel = new THREE.Mesh(this.barrelGeo, this.materials.woodHull);
    barrel.position.set(
      Math.cos(barrelAngle) * spec.radius * 0.54,
      1.04,
      Math.sin(barrelAngle) * spec.radius * 0.54
    );
    barrel.castShadow = true;
    group.add(barrel);

    // 3. Central Campfire (Костёр) slightly toward lake center so visible from boat
    const fireCenterX = -Math.cos(awayAngle) * 0.35;
    const fireCenterZ = -Math.sin(awayAngle) * 0.35;
    const campfireGroup = new THREE.Group();
    campfireGroup.position.set(fireCenterX, 0.74, fireCenterZ);
    group.add(campfireGroup);

    for (let p = 0; p < 7; p++) {
      const pa = (p / 7) * Math.PI * 2;
      const pebble = new THREE.Mesh(this.pebbleGeo, this.materials.rockMaterial);
      pebble.position.set(Math.cos(pa) * 0.52, 0.06, Math.sin(pa) * 0.52);
      campfireGroup.add(pebble);
    }

    for (let l = 0; l < 3; l++) {
      const log = new THREE.Mesh(this.fireLogGeo, this.materials.pineTrunk);
      log.position.y = 0.12;
      log.rotation.z = Math.PI / 2 - 0.25;
      log.rotation.y = (l / 3) * Math.PI;
      campfireGroup.add(log);
    }

    const outerFlame = new THREE.Mesh(this.flameOuterGeo, this.fireOuterMat);
    outerFlame.position.y = 0.12;
    const innerFlame = new THREE.Mesh(this.flameInnerGeo, this.fireInnerMat);
    innerFlame.position.y = 0.15;
    campfireGroup.add(outerFlame, innerFlame);

    const fireLight = new THREE.PointLight('#fb923c', 7.2, 17, 1.45);
    fireLight.position.set(0, 1.35, 0);
    campfireGroup.add(fireLight);

    const embers: AnimatedCampfire['embers'] = [];
    for (let e = 0; e < 5; e++) {
      const ember = new THREE.Mesh(this.emberGeo, this.emberMat);
      campfireGroup.add(ember);
      embers.push({
        mesh: ember,
        phase: e * 0.2 + (spec.seed % 7) * 0.11,
        radius: 0.12 + (e % 3) * 0.08,
        speed: 0.65 + (e % 3) * 0.22,
      });
    }

    this.campfires.push({
      outerFlame,
      innerFlame,
      light: fireLight,
      embers,
      phase: spec.seed * 0.7,
    });

    // 4. Sitting Alcoholics around the Campfire (Алкоголики у костра)
    for (let aIdx = 0; aIdx < spec.alcoholicsCount; aIdx++) {
      // Place them radially facing the campfire, biased slightly away from the trees
      const seatAngle = awayAngle + Math.PI + (aIdx - (spec.alcoholicsCount - 1) / 2) * 1.45;
      const seatDist = 1.42;
      const sx = fireCenterX + Math.cos(seatAngle) * seatDist;
      const sz = fireCenterZ + Math.sin(seatAngle) * seatDist;

      const sitter = this.buildSittingAlcoholic(spec.seed + aIdx);
      sitter.root.position.set(sx, 0.74, sz);
      // Face toward campfire
      sitter.root.rotation.y = Math.atan2(fireCenterX - sx, fireCenterZ - sz);
      group.add(sitter.root);
      this.alcoholics.push(sitter.anim);
    }

    // 5. Shore NPC Fisherman (Рыбак) sitting on a crate near the water edge, shouting tips/phrases
    const fisherAngle = awayAngle + Math.PI + ((spec.seed % 2 === 0 ? 1 : -1) * 0.58);
    const fisherDist = spec.radius * 0.74;
    const fx = Math.cos(fisherAngle) * fisherDist;
    const fz = Math.sin(fisherAngle) * fisherDist;
    const fisherYaw = Math.atan2(-Math.cos(fisherAngle), -Math.sin(fisherAngle)) + (spec.seed % 2 === 0 ? 0.2 : -0.2);

    const fisher = this.buildIslandFisherman(spec, fx, fz, fisherYaw);
    group.add(fisher.root);
    this.fishermen.push(fisher);

    this.rootGroup.add(group);
  }

  private buildSittingAlcoholic(variantSeed: number): { root: THREE.Group; anim: AnimatedAlcoholic } {
    const root = new THREE.Group();

    // Wooden log bench
    const bench = new THREE.Mesh(this.logBenchGeo, this.materials.woodDark);
    bench.position.set(0, 0.18, -0.05);
    bench.castShadow = true;
    root.add(bench);

    // Bent seated legs pointing toward the campfire (+Z)
    for (const side of [-0.11, 0.11]) {
      const thigh = new THREE.Mesh(this.legGeo, this.pantsMat);
      thigh.rotation.x = Math.PI / 2.2;
      thigh.position.set(side, 0.26, 0.18);
      root.add(thigh);

      const shin = new THREE.Mesh(this.legGeo, this.pantsMat);
      shin.scale.set(0.95, 0.82, 0.95);
      shin.position.set(side, 0.14, 0.36);
      root.add(shin);
    }

    // Swaying Upper Torso Group
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.34, -0.04);
    root.add(torsoGroup);

    const coatMat = this.coatMats[variantSeed % this.coatMats.length];
    const torso = new THREE.Mesh(this.torsoGeo, coatMat);
    torso.position.y = 0.26;
    torso.castShadow = true;
    torsoGroup.add(torso);

    // Head + Rosy Drinker's Nose + Ushanka / Cap
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.62, 0.02);
    torsoGroup.add(headGroup);

    const head = new THREE.Mesh(this.headGeo, this.charSkinMat);
    head.castShadow = true;
    headGroup.add(head);

    const nose = new THREE.Mesh(this.noseGeo, this.noseMat);
    nose.position.set(0, -0.01, 0.17);
    headGroup.add(nose);

    const hatCap = new THREE.Mesh(this.hatCapGeo, this.hatMat);
    hatCap.position.set(0, 0.12, -0.01);
    headGroup.add(hatCap);

    if (variantSeed % 2 === 0) {
      // Fur ushanka earflaps
      const flapL = new THREE.Mesh(this.ushankaFlapGeo, this.hatMat);
      flapL.position.set(-0.18, 0.02, 0);
      flapL.rotation.z = 0.18;
      const flapR = flapL.clone();
      flapR.position.x = 0.18;
      flapR.rotation.z = -0.18;
      headGroup.add(flapL, flapR);
    } else {
      // Visor cap brim
      const visor = new THREE.Mesh(this.visorGeo, this.hatMat);
      visor.position.set(0, 0.07, 0.16);
      headGroup.add(visor);
    }

    // Left Arm reaching forward to warm hands by the fire
    const warmArm = new THREE.Mesh(this.armGeo, coatMat);
    warmArm.position.set(-0.24, 0.38, 0.18);
    warmArm.rotation.x = -1.05;
    warmArm.rotation.z = -0.15;
    torsoGroup.add(warmArm);

    // Right Arm holding a green glass bottle (animated toasting!)
    const bottleArm = new THREE.Group();
    bottleArm.position.set(0.24, 0.44, 0.02);
    torsoGroup.add(bottleArm);

    const rArmMesh = new THREE.Mesh(this.armGeo, coatMat);
    rArmMesh.position.set(0, -0.06, 0.16);
    rArmMesh.rotation.x = -1.15;
    bottleArm.add(rArmMesh);

    const bottle = new THREE.Group();
    bottle.position.set(0.02, 0.05, 0.36);
    bottle.rotation.x = 0.25;
    const bBody = new THREE.Mesh(this.bottleBodyGeo, this.bottleMat);
    const bNeck = new THREE.Mesh(this.bottleNeckGeo, this.bottleMat);
    bNeck.position.y = 0.17;
    bottle.add(bBody, bNeck);
    bottleArm.add(bottle);

    return {
      root,
      anim: {
        torsoGroup,
        headGroup,
        bottleArm,
        phase: variantSeed * 1.37,
        swaySpeed: 1.65 + (variantSeed % 3) * 0.35,
      },
    };
  }

  private buildReef(reef: ReefSpec) {
    const rockGroup = new THREE.Group();
    rockGroup.position.set(reef.x, 0, reef.z);

    const mainRock = new THREE.Mesh(this.rockGeo, this.materials.rockMaterial);
    mainRock.scale.set(reef.radius, reef.radius * 0.65, reef.radius * 0.9);
    mainRock.rotation.set(0.2, reef.x, 0.15);
    mainRock.castShadow = true;
    mainRock.receiveShadow = true;
    rockGroup.add(mainRock);

    const sideRock = new THREE.Mesh(this.rockGeo, this.materials.rockMaterial);
    sideRock.position.set(reef.radius * 0.65, -0.25, reef.radius * 0.4);
    sideRock.scale.setScalar(reef.radius * 0.48);
    rockGroup.add(sideRock);

    const foam = new THREE.Mesh(this.ringGeo, this.foamMat);
    foam.position.y = 0.09;
    foam.scale.setScalar(reef.radius * 1.18);
    rockGroup.add(foam);

    this.rootGroup.add(rockGroup);
  }

  private buildIslandFisherman(
    spec: IslandSpec,
    localX: number,
    localZ: number,
    localYaw: number
  ): AnimatedFisherman {
    const root = new THREE.Group();
    root.position.set(localX, 0.74, localZ);
    root.rotation.y = localYaw;

    // Wooden crate seat
    const crate = new THREE.Mesh(this.crateGeo, this.materials.woodHull);
    crate.position.set(0, 0.17, -0.05);
    crate.castShadow = true;
    crate.receiveShadow = true;
    root.add(crate);

    // Metallic bait bucket beside crate
    const bucket = new THREE.Mesh(this.bucketGeo, this.bucketMat);
    bucket.position.set(-0.42, 0.15, 0.12);
    bucket.castShadow = true;
    root.add(bucket);

    // Legs hanging off crate toward water
    for (const side of [-0.11, 0.11]) {
      const thigh = new THREE.Mesh(this.legGeo, this.pantsMat);
      thigh.rotation.x = Math.PI / 2.15;
      thigh.position.set(side, 0.28, 0.18);
      root.add(thigh);

      const shin = new THREE.Mesh(this.legGeo, this.pantsMat);
      shin.scale.set(0.95, 0.85, 0.95);
      shin.position.set(side, 0.13, 0.36);
      root.add(shin);
    }

    // Yellow oilskin slicker torso
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.36, -0.03);
    root.add(torsoGroup);

    const torso = new THREE.Mesh(this.torsoGeo, this.fisherCoatMat);
    torso.position.y = 0.26;
    torso.castShadow = true;
    torsoGroup.add(torso);

    // Head + Beard + Wide Sou'wester Fisherman Hat
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.62, 0.02);
    torsoGroup.add(headGroup);

    const head = new THREE.Mesh(this.headGeo, this.charSkinMat);
    head.castShadow = true;
    headGroup.add(head);

    const beard = new THREE.Mesh(this.fisherBeardGeo, this.beardMat);
    beard.position.set(0, -0.14, 0.12);
    headGroup.add(beard);

    const hatCrown = new THREE.Mesh(this.hatCapGeo, this.fisherHatMat);
    hatCrown.position.set(0, 0.13, -0.01);
    const hatBrim = new THREE.Mesh(this.fisherHatBrimGeo, this.fisherHatMat);
    hatBrim.position.set(0, 0.07, 0);
    headGroup.add(hatCrown, hatBrim);

    // Left steadying arm
    const leftArm = new THREE.Mesh(this.armGeo, this.fisherCoatMat);
    leftArm.position.set(-0.24, 0.4, 0.14);
    leftArm.rotation.x = -0.85;
    leftArm.rotation.z = -0.12;
    torsoGroup.add(leftArm);

    // Right arm holding long fishing rod over the shoreline
    const rodArmGroup = new THREE.Group();
    rodArmGroup.position.set(0.24, 0.45, 0.04);
    torsoGroup.add(rodArmGroup);

    const rightArm = new THREE.Mesh(this.armGeo, this.fisherCoatMat);
    rightArm.position.set(0, -0.06, 0.16);
    rightArm.rotation.x = -1.1;
    rodArmGroup.add(rightArm);

    const rod = new THREE.Mesh(this.rodGeo, this.rodMat);
    rod.position.set(0, -0.02, 0.3);
    rod.rotation.x = 1.08;
    rod.castShadow = true;
    rodArmGroup.add(rod);

    const line = new THREE.Mesh(this.lineGeo, this.lineMat);
    line.position.set(0, 0.36, 2.38);
    rodArmGroup.add(line);

    const bobberMesh = new THREE.Mesh(this.bobberGeo, this.bobberMat);
    bobberMesh.position.set(0, -0.35, 2.38);
    rodArmGroup.add(bobberMesh);

    // 3D Speech Bubble Sprite (hidden until fisherman shouts)
    const shoutMat = new THREE.SpriteMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    const shoutSprite = new THREE.Sprite(shoutMat);
    shoutSprite.position.set(0, 2.05, 0);
    shoutSprite.scale.set(4.8, 1.35, 1);
    shoutSprite.visible = false;
    shoutSprite.renderOrder = 20;
    root.add(shoutSprite);

    const speaker = FISHERMAN_NAMES[spec.seed % FISHERMAN_NAMES.length];

    return {
      speaker,
      seed: spec.seed,
      worldX: spec.x + localX,
      worldZ: spec.z + localZ,
      triggerRadius: spec.radius + 9.8,
      baseYaw: localYaw,
      root,
      torsoGroup,
      headGroup,
      rodArmGroup,
      bobberMesh,
      shoutSprite,
      shoutMat,
      shoutTexture: null,
      shoutTimer: 0,
      cooldownTimer: 1.5 + (spec.seed % 3) * 1.1,
      phase: spec.seed * 0.91,
    };
  }

  private renderSpeechBubbleTexture(speaker: string, text: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 180;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Speech bubble rounded rect
    const x = 14;
    const y = 10;
    const w = canvas.width - 28;
    const h = 136;
    const r = 18;

    ctx.fillStyle = 'rgba(7, 15, 25, 0.94)';
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(canvas.width / 2 + 16, y + h);
    ctx.lineTo(canvas.width / 2, y + h + 22);
    ctx.lineTo(canvas.width / 2 - 16, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Speaker header
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(speaker, canvas.width / 2, 42);

    // Wrap phrase into max 2 crisp lines
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '600 22px system-ui, -apple-system, sans-serif';
    const words = text.split(' ');
    let line1 = '';
    let line2 = '';
    for (const word of words) {
      const test = line1 ? `${line1} ${word}` : word;
      if (ctx.measureText(test).width <= w - 44 && !line2) {
        line1 = test;
      } else {
        line2 = line2 ? `${line2} ${word}` : word;
      }
    }

    if (line2) {
      ctx.fillText(line1, canvas.width / 2, 82);
      ctx.fillText(line2, canvas.width / 2, 114);
    } else {
      ctx.fillText(line1, canvas.width / 2, 98);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private pickFishermanPhrase(ctx: FishermanShoutContext): string {
    return pickFishermanPhraseFromContext(ctx, this.recentPhrases);
  }

  public update(
    dt: number,
    worldTime: number,
    boatX: number,
    boatZ: number,
    context: FishermanShoutContext
  ): FishermanShoutEvent | null {
    // Animate campfire flames, flickering warm light, and rising embers
    for (const cf of this.campfires) {
      const t = worldTime + cf.phase;
      const flicker = 0.88 + Math.sin(t * 14) * 0.12 + Math.cos(t * 23) * 0.08;
      cf.outerFlame.scale.set(0.95 + Math.sin(t * 11) * 0.08, flicker * 1.15, 0.95 + Math.cos(t * 13) * 0.08);
      cf.outerFlame.rotation.y = t * 1.5;

      cf.innerFlame.scale.set(0.9 + Math.cos(t * 15) * 0.1, flicker * 1.1, 0.9);
      cf.light.intensity = 6.8 + Math.sin(t * 17) * 1.4 + Math.cos(t * 29) * 0.8;

      for (const em of cf.embers) {
        const life = (worldTime * em.speed + em.phase) % 1;
        const angle = life * 5.2 + em.phase * 6.28;
        em.mesh.position.set(
          Math.cos(angle) * em.radius * (1 + life),
          0.3 + life * 2.1,
          Math.sin(angle) * em.radius * (1 + life)
        );
        em.mesh.scale.setScalar(1 - life * 0.75);
      }
    }

    // Animate drunken alcoholics swaying and raising bottles around the fire
    for (const alc of this.alcoholics) {
      const t = worldTime * alc.swaySpeed + alc.phase;
      alc.torsoGroup.rotation.z = Math.sin(t) * 0.11;
      alc.torsoGroup.rotation.x = Math.cos(t * 0.7) * 0.06;
      alc.headGroup.rotation.y = Math.sin(t * 0.85) * 0.22;
      alc.headGroup.rotation.x = 0.08 + Math.sin(t * 1.4) * 0.08;

      // Periodic bottle toast wave
      const toast = Math.max(0, Math.sin(t * 0.65));
      alc.bottleArm.rotation.x = -toast * 0.55;
      alc.bottleArm.rotation.z = -toast * 0.12;
    }

    // Animate shore NPC fishermen & check proximity shout triggers
    if (this.globalShoutCooldown > 0) {
      this.globalShoutCooldown = Math.max(0, this.globalShoutCooldown - dt);
    }

    let triggeredShout: FishermanShoutEvent | null = null;

    for (const fisher of this.fishermen) {
      if (fisher.cooldownTimer > 0) {
        fisher.cooldownTimer = Math.max(0, fisher.cooldownTimer - dt);
      }

      const t = worldTime * 1.8 + fisher.phase;
      const dist = Math.hypot(boatX - fisher.worldX, boatZ - fisher.worldZ);

      // Gently bob fishing rod & float
      const shoutLift = fisher.shoutTimer > 0 ? Math.sin(worldTime * 8) * 0.16 + 0.18 : 0;
      fisher.rodArmGroup.rotation.x = Math.sin(t) * 0.06 - shoutLift;
      fisher.bobberMesh.position.y = -0.35 + Math.sin(worldTime * 3.8 + fisher.phase) * 0.08;
      fisher.torsoGroup.rotation.z = Math.sin(t * 0.7) * 0.04;

      // Turn head toward Sasha when he sails near the island
      if (dist < fisher.triggerRadius + 4) {
        const worldAngleToBoat = Math.atan2(boatX - fisher.worldX, boatZ - fisher.worldZ);
        let rel = worldAngleToBoat - fisher.baseYaw;
        while (rel < -Math.PI) rel += Math.PI * 2;
        while (rel > Math.PI) rel -= Math.PI * 2;
        fisher.headGroup.rotation.y = THREE.MathUtils.clamp(rel, -0.85, 0.85);
      } else {
        fisher.headGroup.rotation.y = Math.sin(t * 0.5) * 0.18;
      }

      // Trigger shout when Sasha sails past within triggerRadius
      if (
        !triggeredShout &&
        this.globalShoutCooldown <= 0 &&
        fisher.cooldownTimer <= 0 &&
        dist <= fisher.triggerRadius
      ) {
        const text = this.pickFishermanPhrase(context);
        fisher.shoutTexture?.dispose();
        fisher.shoutTexture = this.renderSpeechBubbleTexture(fisher.speaker, text);
        fisher.shoutMat.map = fisher.shoutTexture;
        fisher.shoutMat.needsUpdate = true;
        fisher.shoutMat.opacity = 1;
        fisher.shoutSprite.visible = true;
        fisher.shoutTimer = 4.4;
        fisher.cooldownTimer = 17;
        this.globalShoutCooldown = 7.5;

        triggeredShout = {
          speaker: fisher.speaker,
          text,
          seed: fisher.seed,
        };
      }

      // Update floating 3D speech bubble fade & bob
      if (fisher.shoutTimer > 0) {
        fisher.shoutTimer = Math.max(0, fisher.shoutTimer - dt);
        const fade = fisher.shoutTimer < 0.65 ? fisher.shoutTimer / 0.65 : 1;
        fisher.shoutMat.opacity = fade;
        fisher.shoutSprite.position.y = 2.05 + Math.sin(worldTime * 3.2) * 0.06;
        if (fisher.shoutTimer <= 0) {
          fisher.shoutSprite.visible = false;
        }
      }
    }

    return triggeredShout;
  }

  public dispose() {
    this.clearCurrentMap();
    if (this.rootGroup.parent === this.scene) {
      this.scene.remove(this.rootGroup);
    }
    for (const g of this.geometries) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    this.geometries = [];
    this.ownedMaterials = [];
  }
}
