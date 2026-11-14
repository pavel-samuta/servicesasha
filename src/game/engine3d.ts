import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { soundEngine } from './audio';
import {
  BASE_PLAYER_STATS,
  DIFFICULTIES,
  HIGH_SCORE_STORAGE_KEY,
  UPGRADE_CATALOG,
} from './constants';
import {
  createLakeMaterials,
  detectSoftwareGl,
  LakeMaterials,
  waterHeightAt,
} from './materials3d';
import {
  buildBitcoinProjectileMesh,
  buildBulbaPickupMesh,
  buildGarlicPickupMesh,
  buildHarpoonPowerPickupMesh,
  createMonsterModel,
  createPickupAssets3D,
  createSashaBoatModel,
  MonsterMeshRig,
  PickupAssets3D,
  SashaBoatRig,
} from './models3d';
import {
  BlackLakeEngine,
  CameraPreset,
  Difficulty,
  EngineCallbacks,
  HudSnapshot,
  MonsterKind,
  PlayerStats,
  RunCarryoverState,
  UpgradeId,
  WeatherKind,
} from './types';
import { WaterSplashSystem3D } from './splashes3d';
import { IslandManager3D, WorldObstacle3D } from './islands3d';
import { getTourDefinition, TOTAL_TOURS, TOUR_BIOMES, TourDefinition } from './tours';
import { WEATHER_LABELS, WeatherSystem3D } from './weather3d';

const ARENA_HALF_W = 54;
const ARENA_HALF_H = 38;

// Pre-allocated math helpers (Zero GC in tick loop)
const _v3A = new THREE.Vector3();
const _v3B = new THREE.Vector3();
const _mouseNdc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _dummyObj = new THREE.Object3D();
const _colorTmp = new THREE.Color();

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

interface Monster3D {
  id: number;
  kind: MonsterKind;
  name: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  scoreValue: number;
  coinValue: number;
  swimPhase: number;
  hitFlash: number;
  stateTimer: number;
  telegraphTimer: number;
  telegraphYaw: number;
  isLunging: boolean;
  lungeTimer: number;
  isJumping: boolean;
  jumpY: number;
  jumpVy: number;
  jumpCooldown: number;
  shootCooldown: number;
  rig: MonsterMeshRig;
}

interface Projectile3D {
  fromPlayer: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  yaw: number;
  radius: number;
  damage: number;
  life: number;
  isCrit: boolean;
  isBitcoin?: boolean;
  pierce: number;
  hitIds: number[];
  mesh: THREE.Object3D;
}

interface Particle3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  kind: 'splash' | 'ring' | 'shockwave' | 'spark';
  mesh: THREE.Mesh;
}

interface Pickup3D {
  kind: 'coin' | 'bulba_heal' | 'garlic_overdrive' | 'harpoon_power';
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  bobPhase: number;
  value: number;
  mesh: THREE.Group;
}

export class BlackLakeEngine3D implements BlackLakeEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private materials: LakeMaterials;
  private envRT: THREE.WebGLRenderTarget;

  private boatRig: SashaBoatRig;
  private aimReticle: THREE.Mesh;
  private blastLight: THREE.PointLight;
  private blastLightTimer = 0;
  private moonLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private moonMat!: THREE.MeshBasicMaterial;
  private starsMat!: THREE.PointsMaterial;
  private weatherSystem: WeatherSystem3D;
  private splashSystem: WaterSplashSystem3D;
  private islandManager: IslandManager3D;
  private currentTour: TourDefinition = getTourDefinition(1);

  // Shared Geometries & Materials for dynamic entities (disposed cleanly on unmount)
  private harpoonGeo: THREE.ConeGeometry;
  private harpoonMat: THREE.MeshStandardMaterial;
  private critHarpoonMat: THREE.MeshStandardMaterial;
  private orbGeo: THREE.SphereGeometry;
  private orbMat: THREE.MeshStandardMaterial;
  private slimeOrbMat: THREE.MeshStandardMaterial;
  private splashGeo: THREE.SphereGeometry;
  private splashMat: THREE.MeshBasicMaterial;
  private sparkMat: THREE.MeshBasicMaterial;
  private ringGeo: THREE.RingGeometry;
  private ringMat: THREE.MeshBasicMaterial;
  private shockwaveMat: THREE.MeshBasicMaterial;
  private pickupAssets: PickupAssets3D;

  private frameId = 0;
  private clock = new THREE.Clock();
  private running = false;
  private paused = false;
  private disposed = false;
  private worldTime = 0;

  private difficulty: Difficulty = 'hunt';
  private cameraPreset: CameraPreset = 'chase';
  private stats: PlayerStats = { ...BASE_PLAYER_STATS };
  private upgradeLevels: Record<UpgradeId, number> = {
    multishot: 0,
    heavy_harpoon: 0,
    rapid_loader: 0,
    reinforced_hull: 0,
    turboprop: 0,
    depth_charges: 0,
    lantern_crit: 0,
  };

  // Boat physics state (in meters)
  private boatX = 0;
  private boatZ = 0;
  private boatVx = 0;
  private boatVz = 0;
  private boatYaw = Math.PI;
  private aimYaw = Math.PI;
  private boatRadius = 1.15;
  private invulnTimer = 0;
  private dashTimer = 0;
  private dashCooldownTimer = 0;
  private recoil = 0;
  private wakeTimer = 0;

  private monsters: Monster3D[] = [];
  private projectiles: Projectile3D[] = [];
  private particles: Particle3D[] = [];
  private pickups: Pickup3D[] = [];
  private obstacles: WorldObstacle3D[] = [];

  private nextEntityId = 1;
  private wave = 1;
  private waveSpawnQueue: MonsterKind[] = [];
  private spawnTimer = 0;
  private waveClearPending = false;
  private waveClearDelay = 0;
  private waveBannerTimer = 0;
  private waveBannerText = '';
  private eventBannerTimer = 0;
  private eventBannerText = '';
  private npcShout: { speaker: string; text: string; timer: number } | null = null;
  private crocSpawnTimer = 8;

  private score = 0;
  private highScore = 0;
  private coins = 0;
  private monstersKilled = 0;
  private leviathansKilled = 0;
  private crocsKilled = 0;
  private killsByKind: Partial<Record<MonsterKind, number>> = {};
  private combo = 0;
  private maxCombo = 0;
  private comboTimer = 0;
  private overdriveTimer = 0;

  private fireTimer = 0;
  private screenShake = 0;
  private hudEmitTimer = 0;

  // Input state
  private keys = new Set<string>();
  private mouseClientX = 0;
  private mouseClientY = 0;
  private mouseDown = false;
  private autoFire = false;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private hasMouseMoved = false;

  // Smooth camera tracking state
  private camPos = new THREE.Vector3(0, 19, 17);
  private camLook = new THREE.Vector3(0, 0, 0);

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();

    try {
      const saved = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      if (saved) this.highScore = parseInt(saved, 10) || 0;
    } catch {
      this.highScore = 0;
    }

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.cursor = 'crosshair';
    this.renderer.domElement.style.touchAction = 'none';

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#040911');
    this.scene.fog = new THREE.FogExp2('#040911', 0.0115);

    this.camera = new THREE.PerspectiveCamera(48, w / h, 0.2, 260);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // Studio / Moonlit PBR environment reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.materials = createLakeMaterials(maxAniso);

    // Shared projectile/particle/pickup geometries & materials
    this.harpoonGeo = new THREE.ConeGeometry(0.11, 0.88, 6);
    this.harpoonGeo.rotateX(Math.PI / 2);
    this.harpoonMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      emissive: '#38bdf8',
      emissiveIntensity: 0.75,
      roughness: 0.25,
      metalness: 0.8,
    });
    this.critHarpoonMat = new THREE.MeshStandardMaterial({
      color: '#fef3c7',
      emissive: '#f59e0b',
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.8,
    });
    this.orbGeo = new THREE.SphereGeometry(0.28, 10, 8);
    this.orbMat = new THREE.MeshStandardMaterial({
      color: '#e0f2fe',
      emissive: '#38bdf8',
      emissiveIntensity: 2.6,
      roughness: 0.15,
    });
    this.slimeOrbMat = new THREE.MeshStandardMaterial({
      color: '#d9f99d',
      emissive: '#65a30d',
      emissiveIntensity: 2.4,
      roughness: 0.2,
    });

    this.splashGeo = new THREE.SphereGeometry(0.22, 6, 6);
    this.splashMat = new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.85 });
    this.sparkMat = new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.95 });

    this.ringGeo = new THREE.RingGeometry(0.75, 1.0, 24);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: '#94a3b8',
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.shockwaveMat = new THREE.MeshBasicMaterial({
      color: '#f59e0b',
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.pickupAssets = createPickupAssets3D();

    // Build 3D World
    this.setupLighting();
    this.buildLakeWorld();
    this.islandManager = new IslandManager3D(this.scene, this.materials);
    this.weatherSystem = new WeatherSystem3D({
      scene: this.scene,
      moonLight: this.moonLight,
      hemiLight: this.hemiLight,
      moonMat: this.moonMat,
      starsMat: this.starsMat,
      materials: this.materials,
    });
    this.splashSystem = new WaterSplashSystem3D(this.scene);

    // Boat + Aim Reticle + Blast Light
    this.boatRig = createSashaBoatModel(this.materials);
    this.scene.add(this.boatRig.root);

    const reticleGeo = new THREE.RingGeometry(0.45, 0.62, 24);
    reticleGeo.rotateX(-Math.PI / 2);
    this.aimReticle = new THREE.Mesh(
      reticleGeo,
      new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.aimReticle.position.y = 0.16;
    this.scene.add(this.aimReticle);

    this.blastLight = new THREE.PointLight('#f59e0b', 0, 28, 1.4);
    this.blastLight.position.set(0, 2.5, 0);
    this.scene.add(this.blastLight);

    // Post-processing Bloom on GPU
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.52, 0.42, 0.78);
      this.composer.addPass(this.bloomPass);
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.stop();
    this.callbacks.onContextLost?.();
  };

  private setupLighting() {
    // Cool night-sky / deep-lake hemisphere fill
    const hemi = new THREE.HemisphereLight('#4f7396', '#060c14', 0.9);
    this.hemiLight = hemi;
    this.scene.add(hemi);

    // Cool moonlight key light with crisp shadows
    const moonLight = new THREE.DirectionalLight('#93c5fd', 1.45);
    moonLight.position.set(35, 58, -32);
    if (!this.isSoftwareGl) {
      moonLight.castShadow = true;
      moonLight.shadow.mapSize.width = 1024;
      moonLight.shadow.mapSize.height = 1024;
      moonLight.shadow.camera.near = 10;
      moonLight.shadow.camera.far = 150;
      const d = 58;
      moonLight.shadow.camera.left = -d;
      moonLight.shadow.camera.right = d;
      moonLight.shadow.camera.top = d;
      moonLight.shadow.camera.bottom = -d;
      moonLight.shadow.bias = -0.0005;
      moonLight.shadow.normalBias = 0.02;
    }
    this.moonLight = moonLight;
    this.scene.add(moonLight);

    // Subtle warm horizon rim from distant shore camp/beacon
    const rimLight = new THREE.DirectionalLight('#f59e0b', 0.35);
    rimLight.position.set(-45, 22, 42);
    this.scene.add(rimLight);
  }

  private buildLakeWorld() {
    // 1. Vast displaced water surface
    const waterGeo = new THREE.PlaneGeometry(340, 340, 128, 128);
    const waterMesh = new THREE.Mesh(waterGeo, this.materials.waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.receiveShadow = true;
    this.scene.add(waterMesh);

    // 2. Moon & Starfield on far horizon sky
    this.moonMat = new THREE.MeshBasicMaterial({ color: '#e2e8f0', fog: false, transparent: true, opacity: 1 });
    const moonMesh = new THREE.Mesh(
      new THREE.CircleGeometry(6.5, 24),
      this.moonMat
    );
    moonMesh.position.set(55, 52, -135);
    moonMesh.lookAt(0, 0, 0);
    this.scene.add(moonMesh);

    const starCount = 260;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const a = (i * 2.39996) % (Math.PI * 2);
      const distR = 115 + (i % 45);
      const y = 18 + (i % 50);
      starPositions[i * 3] = Math.cos(a) * distR;
      starPositions[i * 3 + 1] = y;
      starPositions[i * 3 + 2] = Math.sin(a) * distR;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: '#cbd5e1',
      size: 0.55,
      fog: false,
      transparent: true,
      opacity: 0.95,
    });
    const stars = new THREE.Points(starGeo, this.starsMat);
    this.scene.add(stars);

    // 3. Natural Shoreline Pine Forest & Coastal Boulders (InstancedMesh)
    const treePositions: { x: number; z: number; scale: number }[] = [];
    for (let x = -ARENA_HALF_W - 14; x <= ARENA_HALF_W + 14; x += 4.8) {
      treePositions.push({ x, z: -ARENA_HALF_H - 5 - ((Math.abs(x) * 7) % 6), scale: 0.9 + ((Math.abs(x) * 3) % 4) * 0.08 });
      treePositions.push({ x: x + 2, z: ARENA_HALF_H + 5 + ((Math.abs(x) * 5) % 6), scale: 0.9 + ((Math.abs(x) * 2) % 4) * 0.08 });
    }
    for (let z = -ARENA_HALF_H; z <= ARENA_HALF_H; z += 4.8) {
      treePositions.push({ x: -ARENA_HALF_W - 5 - ((Math.abs(z) * 7) % 6), z, scale: 0.92 + ((Math.abs(z) * 3) % 4) * 0.08 });
      treePositions.push({ x: ARENA_HALF_W + 5 + ((Math.abs(z) * 5) % 6), z: z + 1.5, scale: 0.92 + ((Math.abs(z) * 2) % 4) * 0.08 });
    }

    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 2.2, 6);
    trunkGeo.translate(0, 1.1, 0);
    const coneLowGeo = new THREE.ConeGeometry(2.1, 4.4, 7);
    coneLowGeo.translate(0, 3.3, 0);
    const coneHighGeo = new THREE.ConeGeometry(1.5, 3.6, 7);
    coneHighGeo.translate(0, 5.2, 0);

    const trunks = new THREE.InstancedMesh(trunkGeo, this.materials.pineTrunk, treePositions.length);
    const conesLow = new THREE.InstancedMesh(coneLowGeo, this.materials.pineFoliage, treePositions.length);
    const conesHigh = new THREE.InstancedMesh(coneHighGeo, this.materials.pineFoliage, treePositions.length);

    treePositions.forEach((tp, idx) => {
      _dummyObj.position.set(tp.x, -0.4, tp.z);
      _dummyObj.rotation.set(0, idx * 0.7, 0);
      _dummyObj.scale.setScalar(tp.scale);
      _dummyObj.updateMatrix();

      trunks.setMatrixAt(idx, _dummyObj.matrix);
      conesLow.setMatrixAt(idx, _dummyObj.matrix);
      conesHigh.setMatrixAt(idx, _dummyObj.matrix);

      const shade = 0.82 + (idx % 5) * 0.08;
      _colorTmp.setRGB(0.06 * shade, 0.17 * shade, 0.14 * shade);
      conesLow.setColorAt(idx, _colorTmp);
      conesHigh.setColorAt(idx, _colorTmp);
    });

    trunks.frustumCulled = false;
    conesLow.frustumCulled = false;
    conesHigh.frustumCulled = false;
    this.scene.add(trunks, conesLow, conesHigh);

    // Shoreline earth ridge banks
    const bankMat = new THREE.MeshStandardMaterial({ color: '#0c1815', roughness: 0.95 });
    const bankN = new THREE.Mesh(new THREE.BoxGeometry(150, 1.8, 22), bankMat);
    bankN.position.set(0, -0.35, -ARENA_HALF_H - 13);
    const bankS = bankN.clone();
    bankS.position.z = ARENA_HALF_H + 13;
    const bankW = new THREE.Mesh(new THREE.BoxGeometry(22, 1.8, 120), bankMat);
    bankW.position.set(-ARENA_HALF_W - 13, -0.35, 0);
    const bankE = bankW.clone();
    bankE.position.x = ARENA_HALF_W + 13;
    this.scene.add(bankN, bankS, bankW, bankE);
  }

  public startNewGame(difficulty: Difficulty) {
    this.difficulty = difficulty;
    this.stats = { ...BASE_PLAYER_STATS };
    this.upgradeLevels = {
      multishot: 0,
      heavy_harpoon: 0,
      rapid_loader: 0,
      reinforced_hull: 0,
      turboprop: 0,
      depth_charges: 0,
      lantern_crit: 0,
    };

    this.clearDynamicEntities();

    this.boatX = 0;
    this.boatZ = 0;
    this.boatVx = 0;
    this.boatVz = 0;
    this.boatYaw = Math.PI;
    this.aimYaw = Math.PI;
    this.invulnTimer = 0;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.recoil = 0;
    this.wakeTimer = 0;

    this.camPos.set(0, 19, 17);
    this.camLook.set(0, 0, 0);

    this.wave = 1;
    this.score = 0;
    this.coins = 0;
    this.monstersKilled = 0;
    this.leviathansKilled = 0;
    this.crocsKilled = 0;
    this.killsByKind = {};
    this.crocSpawnTimer = 8;
    this.eventBannerTimer = 0;
    this.eventBannerText = '';
    this.npcShout = null;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.overdriveTimer = 0;
    this.fireTimer = 0;
    this.screenShake = 0;
    this.paused = false;
    this.waveClearPending = false;
    this.weatherSystem.reset('clear');

    this.beginWave(1);
    this.startLoop();
    this.emitHud();
  }

  private clearDynamicEntities() {
    for (const m of this.monsters) this.scene.remove(m.rig.root);
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const pt of this.particles) this.scene.remove(pt.mesh);
    for (const pk of this.pickups) this.scene.remove(pk.mesh);
    this.monsters = [];
    this.projectiles = [];
    this.particles = [];
    this.pickups = [];
    this.splashSystem?.reset();
  }

  private beginWave(waveNum: number) {
    const tour = getTourDefinition(waveNum);
    this.currentTour = tour;
    this.wave = tour.tour;
    this.waveClearPending = false;
    this.waveClearDelay = 0;
    this.waveSpawnQueue = [];
    this.spawnTimer = 0.4;
    this.crocSpawnTimer = tour.crocInterval * 0.75;
    this.npcShout = null;

    // Load tour-specific 3D map, island layout, campfires & sitting alcoholics
    this.obstacles = this.islandManager.loadTour(tour);
    const biome = TOUR_BIOMES[tour.biome];
    this.materials.waterMaterial.color.set(biome.waterTint);
    this.weatherSystem.setWeather(tour.weather);

    // Ensure boat never overlaps a newly spawned island or reef on tour transition
    for (const obs of this.obstacles) {
      const dx = this.boatX - obs.x;
      const dz = this.boatZ - obs.z;
      const d = Math.hypot(dx, dz);
      const safeD = obs.radius + this.boatRadius + 1.25;
      if (d < safeD) {
        if (d > 0.05) {
          this.boatX = obs.x + (dx / d) * safeD;
          this.boatZ = obs.z + (dz / d) * safeD;
        } else {
          this.boatX = 0;
          this.boatZ = 0;
        }
      }
    }
    this.boatX = clamp(this.boatX, -ARENA_HALF_W + this.boatRadius, ARENA_HALF_W - this.boatRadius);
    this.boatZ = clamp(this.boatZ, -ARENA_HALF_H + this.boatRadius, ARENA_HALF_H - this.boatRadius);

    if (waveNum > 1 && this.stats.depthCharges < this.stats.maxDepthCharges) {
      this.stats.depthCharges = Math.min(this.stats.maxDepthCharges, this.stats.depthCharges + 1);
    }

    const diff = DIFFICULTIES[this.difficulty];
    const baseCount = Math.round(tour.enemyCount * diff.spawnMult);

    for (let i = 0; i < baseCount; i++) {
      const pick = tour.roster[Math.floor(Math.random() * tour.roster.length)];
      this.waveSpawnQueue.push(pick);
    }

    for (let b = 0; b < tour.bossCount; b++) {
      this.waveSpawnQueue.unshift('leviathan');
    }

    this.waveBannerText = `Тур ${tour.tour}/${TOTAL_TOURS} · ${tour.name}`;
    this.waveBannerTimer = 2.8;
    this.eventBannerText = tour.subtitle;
    this.eventBannerTimer = 3.0;
  }

  public launchNextWave() {
    this.paused = false;
    this.beginWave(this.wave + 1);
    this.emitHud();
  }

  public exportRunState(): RunCarryoverState {
    return {
      difficulty: this.difficulty,
      wave: this.wave,
      score: this.score,
      coins: this.coins,
      stats: { ...this.stats },
      upgradeLevels: { ...this.upgradeLevels },
      monstersKilled: this.monstersKilled,
      leviathansKilled: this.leviathansKilled,
      crocsKilled: this.crocsKilled,
      killsByKind: { ...this.killsByKind },
      maxCombo: this.maxCombo,
      weather: this.weatherSystem.getWeather(),
    };
  }

  public importRunState(state: RunCarryoverState, paused = false) {
    this.difficulty = state.difficulty;
    this.stats = { ...state.stats };
    this.upgradeLevels = { ...state.upgradeLevels };
    this.clearDynamicEntities();
    this.boatX = 0;
    this.boatZ = 0;
    this.boatVx = 0;
    this.boatVz = 0;
    this.boatYaw = Math.PI;
    this.aimYaw = Math.PI;
    this.invulnTimer = 0;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.recoil = 0;
    this.camPos.set(0, 19, 17);
    this.camLook.set(0, 0, 0);

    this.score = state.score;
    this.coins = state.coins;
    this.monstersKilled = state.monstersKilled;
    this.leviathansKilled = state.leviathansKilled;
    this.crocsKilled = state.crocsKilled;
    this.killsByKind = { ...state.killsByKind };
    this.maxCombo = state.maxCombo;
    this.combo = 0;
    this.comboTimer = 0;
    this.overdriveTimer = 0;
    this.paused = paused;
    this.boatRig.lanternLight.distance = 22 + this.upgradeLevels.lantern_crit * 4;
    this.boatRig.searchSpot.distance = 30 + this.upgradeLevels.lantern_crit * 5;

    this.beginWave(state.wave);
    this.weatherSystem.setWeather(state.weather);
    this.startLoop();
    this.emitHud();
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
  }

  public setAutoFire(enabled: boolean) {
    this.autoFire = enabled;
  }

  public cycleCameraPreset(): CameraPreset {
    const order: CameraPreset[] = ['chase', 'close', 'tactical'];
    const idx = order.indexOf(this.cameraPreset);
    this.cameraPreset = order[(idx + 1) % order.length];
    return this.cameraPreset;
  }

  public getCameraPreset(): CameraPreset {
    return this.cameraPreset;
  }

  public cycleWeather(): WeatherKind {
    const next = this.weatherSystem.cycleWeather();
    this.eventBannerText = `Погода: ${WEATHER_LABELS[next]}`;
    this.eventBannerTimer = 2.0;
    this.emitHud();
    return next;
  }

  public getUpgradeLevels(): Record<UpgradeId, number> {
    return { ...this.upgradeLevels };
  }

  public getCoins(): number {
    return this.coins;
  }

  public getStats(): PlayerStats {
    return { ...this.stats };
  }

  public getUpgradePrice(id: UpgradeId): number {
    const def = UPGRADE_CATALOG[id];
    const level = this.upgradeLevels[id];
    return Math.round(def.cost * Math.pow(1.45, level));
  }

  public applyUpgrade(id: UpgradeId): boolean {
    const def = UPGRADE_CATALOG[id];
    const level = this.upgradeLevels[id];
    const price = this.getUpgradePrice(id);
    if (level >= def.maxLevel || this.coins < price) return false;

    this.coins -= price;
    this.upgradeLevels[id] = level + 1;

    switch (id) {
      case 'multishot':
        this.stats.projectileCount += 1;
        break;
      case 'heavy_harpoon':
        this.stats.damage = Math.round(this.stats.damage * 1.3);
        break;
      case 'rapid_loader':
        this.stats.fireRate = Number((this.stats.fireRate * 1.22).toFixed(2));
        break;
      case 'reinforced_hull':
        this.stats.maxHp += 30;
        this.stats.hp = this.stats.maxHp;
        break;
      case 'turboprop':
        this.stats.speed = Math.round(this.stats.speed * 1.12);
        this.stats.dashCooldown = Math.max(1.1, Number((this.stats.dashCooldown * 0.86).toFixed(2)));
        break;
      case 'depth_charges':
        this.stats.maxDepthCharges += 1;
        this.stats.depthCharges = this.stats.maxDepthCharges;
        this.stats.depthRadius += 45;
        break;
      case 'lantern_crit':
        this.stats.critChance = Math.min(0.65, Number((this.stats.critChance + 0.1).toFixed(2)));
        this.stats.lanternRadius += 55;
        this.boatRig.lanternLight.distance = 22 + this.upgradeLevels.lantern_crit * 4;
        this.boatRig.searchSpot.distance = 30 + this.upgradeLevels.lantern_crit * 5;
        break;
    }

    soundEngine.playPickup('overdrive');
    this.emitHud();
    return true;
  }

  public repairBoatWithCoins(): boolean {
    const cost = 18;
    if (this.coins < cost || this.stats.hp >= this.stats.maxHp) return false;
    this.coins -= cost;
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + 40);
    soundEngine.playPickup('repair');
    this.emitHud();
    return true;
  }

  public handleKeyDown(code: string) {
    this.keys.add(code);
    if (code === 'Space') this.triggerDash();
    else if (code === 'KeyE' || code === 'KeyQ') this.triggerDepthCharge();
  }

  public handleKeyUp(code: string) {
    this.keys.delete(code);
  }

  public handleMouseMove(clientX: number, clientY: number) {
    this.mouseClientX = clientX;
    this.mouseClientY = clientY;
    this.hasMouseMoved = true;
  }

  public handleMouseDown(button: number) {
    soundEngine.unlock();
    if (button === 0) this.mouseDown = true;
    else if (button === 2) this.triggerDash();
  }

  public handleMouseUp(button: number) {
    if (button === 0) this.mouseDown = false;
  }

  public setTouchMove(dx: number, dy: number) {
    this.touchMoveX = dx;
    this.touchMoveY = dy;
  }

  public triggerDash() {
    if (!this.running || this.paused) return;
    if (this.dashCooldownTimer > 0 || this.dashTimer > 0) return;

    this.dashTimer = 0.24;
    this.dashCooldownTimer = this.stats.dashCooldown;
    this.invulnTimer = Math.max(this.invulnTimer, 0.28);
    soundEngine.playDash();

    this.spawnSplashBurst(this.boatX - Math.sin(this.boatYaw) * 1.3, this.boatZ - Math.cos(this.boatYaw) * 1.3, 14, 'splash', 7.5);
  }

  public triggerDepthCharge() {
    if (!this.running || this.paused) return;
    if (this.stats.depthCharges <= 0) return;

    this.stats.depthCharges -= 1;
    this.screenShake = Math.max(this.screenShake, 0.85);
    this.blastLight.position.set(this.boatX, 3.2, this.boatZ);
    this.blastLight.intensity = 42;
    this.blastLightTimer = 0.45;
    soundEngine.playDepthCharge();

    const radius3d = this.stats.depthRadius / 20; // convert 2D radius (270) -> ~13.5 meters

    // Expanding shockwave ring
    const ringMesh = new THREE.Mesh(this.ringGeo, this.shockwaveMat.clone());
    ringMesh.position.set(this.boatX, 0.28, this.boatZ);
    this.scene.add(ringMesh);
    this.particles.push({
      x: this.boatX,
      y: 0.28,
      z: this.boatZ,
      vx: 0,
      vy: 0,
      vz: 0,
      gravity: 0,
      life: 0.5,
      maxLife: 0.5,
      startScale: 1.2,
      endScale: radius3d,
      kind: 'shockwave',
      mesh: ringMesh,
    });

    // Tall water geyser splash burst
    this.spawnSplashBurst(this.boatX, this.boatZ, 24, 'spark', 11);

    // Clear nearby enemy projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.fromPlayer && Math.hypot(p.x - this.boatX, p.z - this.boatZ) <= radius3d) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // Damage & blast nearby monsters
    const blastDamage = Math.round(this.stats.damage * 3.4);
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      const d = Math.hypot(m.x - this.boatX, m.z - this.boatZ);
      if (d <= radius3d + m.radius) {
        const pushYaw = Math.atan2(m.x - this.boatX, m.z - this.boatZ);
        const force = m.kind === 'leviathan' ? 9 : 22;
        m.vx += Math.sin(pushYaw) * force;
        m.vz += Math.cos(pushYaw) * force;
        this.damageMonster(i, blastDamage, true);
      }
    }

    this.emitHud();
  }

  private startLoop() {
    this.stopLoopOnly();
    this.running = true;
    this.clock.getDelta();

    const tick = () => {
      if (!this.running || this.disposed) return;
      const dt = Math.min(0.05, this.clock.getDelta());
      if (!this.paused) {
        this.update(dt);
      }
      this.renderFrame();

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (!this.running || this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private stopLoopOnly() {
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
  }

  public stop() {
    this.running = false;
    this.stopLoopOnly();
  }

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.clearDynamicEntities();
    this.islandManager.dispose();
    this.splashSystem.dispose();
    this.weatherSystem.dispose();
    this.materials.dispose();
    this.envRT.dispose();

    this.harpoonGeo.dispose();
    this.harpoonMat.dispose();
    this.critHarpoonMat.dispose();
    this.orbGeo.dispose();
    this.orbMat.dispose();
    this.slimeOrbMat.dispose();
    this.splashGeo.dispose();
    this.splashMat.dispose();
    this.sparkMat.dispose();
    this.ringGeo.dispose();
    this.ringMat.dispose();
    this.shockwaveMat.dispose();
    this.pickupAssets.dispose();

    this.composer?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  public resize(width: number, height: number) {
    if (this.disposed) return;
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
  }

  private update(dt: number) {
    this.worldTime += dt;
    this.materials.waterUniforms.uTime.value = this.worldTime;

    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 2.5);
    if (this.waveBannerTimer > 0) this.waveBannerTimer = Math.max(0, this.waveBannerTimer - dt);
    if (this.eventBannerTimer > 0) this.eventBannerTimer = Math.max(0, this.eventBannerTimer - dt);
    if (this.npcShout) {
      this.npcShout.timer -= dt;
      if (this.npcShout.timer <= 0) {
        this.npcShout = null;
      }
    }
    if (this.overdriveTimer > 0) this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);
    if (this.blastLightTimer > 0) {
      this.blastLightTimer = Math.max(0, this.blastLightTimer - dt);
      this.blastLight.intensity = (this.blastLightTimer / 0.45) * 42;
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    this.updateBoat(dt);
    this.updateSpawning(dt);
    this.updateMonsters(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.splashSystem.update(dt, this.worldTime, this.weatherSystem.getWaveAmp());

    const fishermanShout = this.islandManager.update(dt, this.worldTime, this.boatX, this.boatZ, {
      hpRatio: this.stats.maxHp > 0 ? this.stats.hp / this.stats.maxHp : 1,
      weather: this.weatherSystem.getWeather(),
      bossAlive: this.monsters.some((m) => m.kind === 'leviathan'),
      tourRoster: this.currentTour.roster,
    });
    if (fishermanShout) {
      this.npcShout = {
        speaker: fishermanShout.speaker,
        text: fishermanShout.text,
        timer: 4.4,
      };
      soundEngine.playFishermanCall(fishermanShout.seed);
      this.emitHud();
    }

    this.updateCamera(dt);

    const shiftedWeather = this.weatherSystem.update(dt, this.worldTime, this.boatX, this.boatZ, this.wave);
    if (shiftedWeather) {
      this.eventBannerText = `Над озером: ${WEATHER_LABELS[shiftedWeather]}`;
      this.eventBannerTimer = 2.4;
    }

    if (this.waveSpawnQueue.length === 0 && this.monsters.length === 0 && !this.waveClearPending) {
      this.waveClearPending = true;
      this.waveClearDelay = 0.85;
      if (this.wave >= TOTAL_TOURS) {
        soundEngine.playVictory();
      } else {
        soundEngine.playWaveClear();
      }
    }

    if (this.waveClearPending) {
      this.waveClearDelay -= dt;
      if (this.waveClearDelay <= 0) {
        this.waveClearPending = false;
        this.coins += 15 + this.wave * 5;
        if (this.wave >= TOTAL_TOURS) {
          this.running = false;
          this.emitHud();
          this.callbacks.onVictory?.(this.buildHudSnapshot());
        } else {
          this.paused = true;
          this.emitHud();
          this.callbacks.onWaveClear(this.wave, this.coins);
        }
      }
    }

    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.08) {
      this.hudEmitTimer = 0;
      this.emitHud();
    }
  }

  private updateBoat(dt: number) {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - dt);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 2.8);

    // Convert 2D speed (~315 px/s) to 3D meters/s (~15.5 m/s)
    const maxSpeed = this.stats.speed / 20;

    let ix = this.touchMoveX;
    let iz = this.touchMoveY;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iz += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;

    const mag = Math.hypot(ix, iz);
    if (mag > 1) {
      ix /= mag;
      iz /= mag;
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      const dashSpd = maxSpeed * 2.45;
      const dx = mag > 0.1 ? ix : Math.sin(this.boatYaw);
      const dz = mag > 0.1 ? iz : Math.cos(this.boatYaw);
      this.boatVx = dx * dashSpd;
      this.boatVz = dz * dashSpd;
    } else {
      const accel = 76;
      this.boatVx += ix * accel * dt;
      this.boatVz += iz * accel * dt;

      const drag = Math.exp(-5.2 * dt);
      this.boatVx *= drag;
      this.boatVz *= drag;

      const spd = Math.hypot(this.boatVx, this.boatVz);
      if (spd > maxSpeed) {
        this.boatVx = (this.boatVx / spd) * maxSpeed;
        this.boatVz = (this.boatVz / spd) * maxSpeed;
      }
    }

    this.boatX += this.boatVx * dt;
    this.boatZ += this.boatVz * dt;

    // Keep inside Black Lake shoreline
    this.boatX = clamp(this.boatX, -ARENA_HALF_W + this.boatRadius, ARENA_HALF_W - this.boatRadius);
    this.boatZ = clamp(this.boatZ, -ARENA_HALF_H + this.boatRadius, ARENA_HALF_H - this.boatRadius);

    // Reef obstacle pushout
    for (const obs of this.obstacles) {
      const dx = this.boatX - obs.x;
      const dz = this.boatZ - obs.z;
      const d = Math.hypot(dx, dz);
      const minD = this.boatRadius + obs.radius * 0.88;
      if (d < minD && d > 0.001) {
        this.boatX = obs.x + (dx / d) * minD;
        this.boatZ = obs.z + (dz / d) * minD;
      }
    }

    // Rotate boat hull smoothly toward velocity & add wave bobbing/roll
    const speed = Math.hypot(this.boatVx, this.boatVz);
    if (speed > 1.2) {
      const targetYaw = Math.atan2(this.boatVx, this.boatVz);
      this.boatYaw = lerpAngle(this.boatYaw, targetYaw, Math.min(1, dt * 9));

      this.wakeTimer -= dt;
      if (this.wakeTimer <= 0) {
        this.wakeTimer = this.dashTimer > 0 ? 0.03 : 0.075;
        const sx = this.boatX - Math.sin(this.boatYaw) * 1.45;
        const sz = this.boatZ - Math.cos(this.boatYaw) * 1.45;
        this.spawnRing(sx, sz, 0.35, this.dashTimer > 0 ? 1.85 : 1.25, 0.55, false);
      }
    }

    // Raycast mouse to water plane for crisp 3D turret aiming
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (this.hasMouseMoved && rect.width > 0 && rect.height > 0) {
      _mouseNdc.x = ((this.mouseClientX - rect.left) / rect.width) * 2 - 1;
      _mouseNdc.y = -((this.mouseClientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_mouseNdc, this.camera);
      if (_raycaster.ray.intersectPlane(_waterPlane, _v3A)) {
        this.aimYaw = Math.atan2(_v3A.x - this.boatX, _v3A.z - this.boatZ);
        this.aimReticle.position.set(
          _v3A.x,
          waterHeightAt(_v3A.x, _v3A.z, this.worldTime, this.weatherSystem.getWaveAmp()) + 0.14,
          _v3A.z
        );
        this.aimReticle.visible = true;
      }
    } else if (this.monsters.length > 0) {
      let nearest = this.monsters[0];
      let bestD = Infinity;
      for (const m of this.monsters) {
        const d = Math.hypot(m.x - this.boatX, m.z - this.boatZ);
        if (d < bestD) {
          bestD = d;
          nearest = m;
        }
      }
      this.aimYaw = Math.atan2(nearest.x - this.boatX, nearest.z - this.boatZ);
      this.aimReticle.visible = false;
    } else {
      this.aimYaw = this.boatYaw;
      this.aimReticle.visible = false;
    }

    // Position 3D Boat & Turret
    const waveY = waterHeightAt(this.boatX, this.boatZ, this.worldTime, this.weatherSystem.getWaveAmp());
    this.boatRig.root.position.set(this.boatX, waveY, this.boatZ);
    this.boatRig.hullGroup.rotation.y = this.boatYaw;
    // Pitch and roll on waves + speed
    this.boatRig.hullGroup.rotation.x = Math.sin(this.worldTime * 2.2) * 0.045 - (speed / maxSpeed) * 0.06;
    this.boatRig.hullGroup.rotation.z = Math.cos(this.worldTime * 1.9) * 0.05;
    this.boatRig.turretGroup.rotation.y = this.aimYaw;
    this.boatRig.harpoonRecoilGroup.position.z = 0.3 - this.recoil;
    this.boatRig.propeller.rotation.z += dt * (8 + speed * 2.4);

    // Invulnerability flicker
    const visible = !(this.invulnTimer > 0 && Math.floor(this.invulnTimer * 18) % 2 === 0 && this.dashTimer <= 0);
    this.boatRig.hullGroup.visible = visible;
    this.boatRig.turretGroup.visible = visible;

    this.materials.waterUniforms.uBoatPos.value.set(this.boatX, 0, this.boatZ);

    // Firing
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if ((this.mouseDown || this.autoFire) && this.fireTimer <= 0) {
      const rateMult = this.overdriveTimer > 0 ? 1.85 : 1;
      this.fireTimer = 1 / (this.stats.fireRate * rateMult);
      this.fireHarpoons();
    }
  }

  private fireHarpoons() {
    const count = this.stats.projectileCount;
    const spreadStep = 0.14;
    const isCrit = Math.random() < this.stats.critChance;
    soundEngine.playHarpoon(isCrit);
    this.recoil = 0.28;

    const projSpd = this.stats.projectileSpeed / 20;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spreadStep;
      const yaw = this.aimYaw + offset;
      const sx = this.boatX + Math.sin(yaw) * 1.3;
      const sz = this.boatZ + Math.cos(yaw) * 1.3;

      const mesh = new THREE.Mesh(this.harpoonGeo, isCrit ? this.critHarpoonMat : this.harpoonMat);
      mesh.rotation.order = 'YXZ';
      mesh.position.set(sx, 0.92, sz);
      mesh.rotation.y = yaw;
      this.scene.add(mesh);

      this.projectiles.push({
        fromPlayer: true,
        x: sx,
        y: 0.92,
        z: sz,
        vx: Math.sin(yaw) * projSpd,
        vy: 1.55,
        vz: Math.cos(yaw) * projSpd,
        gravity: 4.1,
        yaw,
        radius: isCrit ? 0.45 : 0.36,
        damage: isCrit ? Math.round(this.stats.damage * 1.85) : this.stats.damage,
        life: 1.45,
        isCrit,
        pierce: isCrit ? 2 : 1,
        hitIds: [],
        mesh,
      });
    }
  }

  private updateSpawning(dt: number) {
    if (this.waveSpawnQueue.length > 0 || this.monsters.length > 0) {
      this.crocSpawnTimer -= dt;
      if (this.crocSpawnTimer <= 0) {
        this.crocSpawnTimer = this.currentTour.crocInterval + Math.random() * 3.5;
        const activeCrocs = this.monsters.filter((m) => m.kind === 'croc_gena').length;
        if (activeCrocs < this.currentTour.maxCrocs) {
          this.spawnMonster('croc_gena');
          this.eventBannerText = 'Из леса выползает злодейский Крокодил Гена!';
          this.eventBannerTimer = 2.6;
        }
      }
    }

    if (this.waveSpawnQueue.length === 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const kind = this.waveSpawnQueue.shift()!;
      this.spawnMonster(kind);
      this.spawnTimer = Math.max(0.42, 1.32 - this.wave * 0.1);
    }
  }

  private spawnMonster(kind: MonsterKind, customX?: number, customZ?: number) {
    const diff = DIFFICULTIES[this.difficulty];
    const waveScale = 1 + (this.wave - 1) * 0.16;

    let sx = customX ?? 0;
    let sz = customZ ?? 0;
    if (customX === undefined || customZ === undefined) {
      if (kind === 'croc_gena') {
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) {
          sx = (Math.random() * 2 - 1) * (ARENA_HALF_W - 6);
          sz = -ARENA_HALF_H + 1.5;
        } else if (edge === 1) {
          sx = (Math.random() * 2 - 1) * (ARENA_HALF_W - 6);
          sz = ARENA_HALF_H - 1.5;
        } else if (edge === 2) {
          sx = -ARENA_HALF_W + 1.5;
          sz = (Math.random() * 2 - 1) * (ARENA_HALF_H - 6);
        } else {
          sx = ARENA_HALF_W - 1.5;
          sz = (Math.random() * 2 - 1) * (ARENA_HALF_H - 6);
        }
      } else {
        for (let attempt = 0; attempt < 12; attempt++) {
          const a = Math.random() * Math.PI * 2;
          const distR = 23 + Math.random() * 14;
          sx = clamp(this.boatX + Math.sin(a) * distR, -ARENA_HALF_W + 2.5, ARENA_HALF_W - 2.5);
          sz = clamp(this.boatZ + Math.cos(a) * distR, -ARENA_HALF_H + 2.5, ARENA_HALF_H - 2.5);
          if (Math.hypot(sx - this.boatX, sz - this.boatZ) > 16) break;
        }
      }
    }

    let name = 'Щука-стрела';
    let radius = 1.05;
    let hp = 48;
    let speed = 8.2;
    let damage = 14;
    let scoreValue = 110;
    let coinValue = 4;

    if (kind === 'catfish') {
      name = 'Озёрный сом';
      radius = 1.48;
      hp = 125;
      speed = 5.0;
      damage = 22;
      scoreValue = 190;
      coinValue = 8;
    } else if (kind === 'ersh') {
      name = 'Ёрш Передрёш';
      radius = 1.02;
      hp = 76;
      speed = 7.4;
      damage = 18;
      scoreValue = 145;
      coinValue = 5;
    } else if (kind === 'lin') {
      name = 'Линь Жминь';
      radius = 1.42;
      hp = 145;
      speed = 5.2;
      damage = 20;
      scoreValue = 205;
      coinValue = 8;
    } else if (kind === 'peskar') {
      name = 'Пескарь Натаскарь';
      radius = 0.85;
      hp = 42;
      speed = 9.8;
      damage = 12;
      scoreValue = 130;
      coinValue = 6;
    } else if (kind === 'karas') {
      name = 'Карась Вырубась';
      radius = 1.32;
      hp = 115;
      speed = 6.4;
      damage = 24;
      scoreValue = 185;
      coinValue = 7;
    } else if (kind === 'eel') {
      name = 'Угорь-искра';
      radius = 0.98;
      hp = 68;
      speed = 7.0;
      damage = 12;
      scoreValue = 150;
      coinValue = 6;
    } else if (kind === 'puffer') {
      name = 'Иглобрюх-мина';
      radius = 1.18;
      hp = 82;
      speed = 5.6;
      damage = 20;
      scoreValue = 165;
      coinValue = 6;
    } else if (kind === 'minnow') {
      name = 'Малёк-пиранья';
      radius = 0.62;
      hp = 20;
      speed = 10.6;
      damage = 8;
      scoreValue = 45;
      coinValue = 2;
    } else if (kind === 'croc_gena') {
      name = 'Крокодил Гена';
      radius = 1.35;
      hp = 95;
      speed = 5.4;
      damage = 16;
      scoreValue = 220;
      coinValue = 9;
    } else if (kind === 'leviathan') {
      name = 'Левиафан Чёрного озера';
      radius = 2.65;
      hp = 780;
      speed = 5.8;
      damage = 30;
      scoreValue = 1200;
      coinValue = 45;
    }

    // Push spawn outside any islands or rocky reefs
    for (const obs of this.obstacles) {
      const dx = sx - obs.x;
      const dz = sz - obs.z;
      const od = Math.hypot(dx, dz) || 1;
      const minD = radius + obs.radius + 0.8;
      if (od < minD) {
        sx = clamp(obs.x + (dx / od) * minD, -ARENA_HALF_W + radius, ARENA_HALF_W - radius);
        sz = clamp(obs.z + (dz / od) * minD, -ARENA_HALF_H + radius, ARENA_HALF_H - radius);
      }
    }

    const scaledHp = Math.round(hp * waveScale * diff.enemyHpMult);
    const scaledSpeed = speed * diff.enemySpeedMult * (1 + Math.min(0.35, (this.wave - 1) * 0.035));
    const scaledDmg = Math.round(damage * diff.enemyDamageMult);

    const rig = createMonsterModel(kind);
    const yaw = Math.atan2(this.boatX - sx, this.boatZ - sz);
    const spawnWy = waterHeightAt(sx, sz, this.worldTime, this.weatherSystem.getWaveAmp());
    const isCroc = kind === 'croc_gena';
    rig.root.position.set(sx, spawnWy + (isCroc ? 0.35 : 0), sz);
    rig.root.rotation.y = yaw;
    this.scene.add(rig.root);

    this.monsters.push({
      id: this.nextEntityId++,
      kind,
      name,
      x: sx,
      z: sz,
      vx: isCroc ? Math.sin(yaw) * scaledSpeed * 1.4 : 0,
      vz: isCroc ? Math.cos(yaw) * scaledSpeed * 1.4 : 0,
      yaw,
      radius,
      hp: scaledHp,
      maxHp: scaledHp,
      speed: scaledSpeed,
      damage: scaledDmg,
      scoreValue,
      coinValue,
      swimPhase: Math.random() * Math.PI * 2,
      hitFlash: 0,
      stateTimer: 1.5 + Math.random() * 1.5,
      telegraphTimer: 0,
      telegraphYaw: 0,
      isLunging: false,
      lungeTimer: 0,
      isJumping: isCroc,
      jumpY: isCroc ? 0.35 : 0,
      jumpVy: isCroc ? 9.2 : 0,
      jumpCooldown: isCroc ? 3.2 + Math.random() * 1.5 : 0,
      shootCooldown: 1.8 + Math.random() * 1.4,
      rig,
    });

    this.splashSystem.emitSplash(sx, sz, isCroc ? 1.35 : 0.9, 0, 0, spawnWy);
    soundEngine.playMonsterSpawn(kind);
  }

  private updateMonsters(dt: number) {
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      m.swimPhase += dt * (m.isLunging ? 18 : 8.5);
      if (m.hitFlash > 0) {
        m.hitFlash = Math.max(0, m.hitFlash - dt);
        m.rig.bodyMat.emissive.setHex(m.hitFlash > 0 ? 0xffffff : 0x000000);
        m.rig.bodyMat.emissiveIntensity = m.hitFlash > 0 ? 0.9 : 0;
      }

      const toX = this.boatX - m.x;
      const toZ = this.boatZ - m.z;
      const d = Math.hypot(toX, toZ) || 1;
      const yawToBoat = Math.atan2(toX, toZ);

      if (m.kind === 'pike') {
        if (m.isLunging) {
          m.lungeTimer -= dt;
          if (m.lungeTimer <= 0) {
            m.isLunging = false;
            m.stateTimer = 1.6 + Math.random() * 0.9;
          }
        } else if (m.telegraphTimer > 0) {
          m.telegraphTimer -= dt;
          m.vx *= Math.exp(-8 * dt);
          m.vz *= Math.exp(-8 * dt);
          m.yaw = lerpAngle(m.yaw, m.telegraphYaw, dt * 12);
          if (m.rig.telegraphLine) m.rig.telegraphLine.visible = true;
          if (m.telegraphTimer <= 0) {
            if (m.rig.telegraphLine) m.rig.telegraphLine.visible = false;
            m.isLunging = true;
            m.lungeTimer = 0.42;
            const lungeSpd = m.speed * 2.85;
            m.vx = Math.sin(m.telegraphYaw) * lungeSpd;
            m.vz = Math.cos(m.telegraphYaw) * lungeSpd;
            soundEngine.playMonsterLunge(false);
          }
        } else {
          if (m.rig.telegraphLine) m.rig.telegraphLine.visible = false;
          m.stateTimer -= dt;
          if (d < 17 && m.stateTimer <= 0) {
            m.telegraphTimer = 0.55;
            m.telegraphYaw = yawToBoat;
          } else {
            m.yaw = lerpAngle(m.yaw, yawToBoat, dt * 5);
            m.vx += (Math.sin(m.yaw) * m.speed - m.vx) * Math.min(1, dt * 4);
            m.vz += (Math.cos(m.yaw) * m.speed - m.vz) * Math.min(1, dt * 4);
          }
        }
      } else if (m.kind === 'eel') {
        let moveYaw = yawToBoat;
        if (d < 11) moveYaw = yawToBoat + Math.PI + (m.id % 2 === 0 ? 0.85 : -0.85);
        else if (d < 17) moveYaw = yawToBoat + (Math.PI / 2) * (m.id % 2 === 0 ? 1 : -1);

        const wiggle = Math.sin(m.swimPhase * 0.7) * 0.35;
        m.yaw = lerpAngle(m.yaw, yawToBoat, dt * 6);
        m.vx += (Math.sin(moveYaw + wiggle) * m.speed - m.vx) * Math.min(1, dt * 4);
        m.vz += (Math.cos(moveYaw + wiggle) * m.speed - m.vz) * Math.min(1, dt * 4);

        m.shootCooldown -= dt;
        if (m.shootCooldown <= 0 && d < 26) {
          m.shootCooldown = 2.2 + Math.random() * 0.9;
          this.spawnEnemyOrb(m.x, m.z, yawToBoat, 14.5, m.damage);
          soundEngine.playMonsterShot(false, false);
        }
      } else if (m.kind === 'leviathan') {
        m.stateTimer -= dt;
        m.shootCooldown -= dt;
        if (m.isLunging) {
          m.lungeTimer -= dt;
          if (m.lungeTimer <= 0) {
            m.isLunging = false;
            m.stateTimer = 2.8;
          }
        } else if (m.telegraphTimer > 0) {
          m.telegraphTimer -= dt;
          m.vx *= Math.exp(-6 * dt);
          m.vz *= Math.exp(-6 * dt);
          m.yaw = lerpAngle(m.yaw, m.telegraphYaw, dt * 10);
          if (m.rig.telegraphLine) m.rig.telegraphLine.visible = true;
          if (m.telegraphTimer <= 0) {
            if (m.rig.telegraphLine) m.rig.telegraphLine.visible = false;
            m.isLunging = true;
            m.lungeTimer = 0.65;
            const dashSpd = m.speed * 3.1;
            m.vx = Math.sin(m.telegraphYaw) * dashSpd;
            m.vz = Math.cos(m.telegraphYaw) * dashSpd;
            soundEngine.playMonsterLunge(true);
          }
        } else {
          if (m.rig.telegraphLine) m.rig.telegraphLine.visible = false;
          m.yaw = lerpAngle(m.yaw, yawToBoat, dt * 3.5);
          m.vx += (Math.sin(m.yaw) * m.speed - m.vx) * Math.min(1, dt * 3.2);
          m.vz += (Math.cos(m.yaw) * m.speed - m.vz) * Math.min(1, dt * 3.2);

          if (m.stateTimer <= 0 && d < 24) {
            m.telegraphTimer = 0.75;
            m.telegraphYaw = yawToBoat;
          }
          if (m.shootCooldown <= 0) {
            m.shootCooldown = 2.6;
            soundEngine.playMonsterShot(false, true);
            for (let k = -2; k <= 2; k++) {
              this.spawnEnemyOrb(m.x, m.z, yawToBoat + k * 0.24, 13.5, Math.round(m.damage * 0.6));
            }
          }
        }
      } else if (m.kind === 'croc_gena') {
        let moveYaw = yawToBoat;
        if (d < 11) moveYaw = yawToBoat + Math.PI + (m.id % 2 === 0 ? 0.7 : -0.7);
        else if (d < 18) moveYaw = yawToBoat + (Math.PI / 2) * (m.id % 2 === 0 ? 1 : -1);

        m.yaw = lerpAngle(m.yaw, yawToBoat, dt * 6);

        if (m.isJumping) {
          m.jumpY += m.jumpVy * dt;
          m.jumpVy -= 24.5 * dt;
          if (m.jumpY <= 0) {
            m.jumpY = 0;
            m.jumpVy = 0;
            m.isJumping = false;
            const landWy = waterHeightAt(m.x, m.z, this.worldTime, this.weatherSystem.getWaveAmp());
            this.splashSystem.emitSplash(m.x, m.z, 1.85, m.vx * 0.4, m.vz * 0.4, landWy);
            soundEngine.playMonsterSpawn('pike');
          }
        } else {
          m.vx += (Math.sin(moveYaw) * m.speed - m.vx) * Math.min(1, dt * 3.8);
          m.vz += (Math.cos(moveYaw) * m.speed - m.vz) * Math.min(1, dt * 3.8);
          m.jumpCooldown -= dt;
          if (m.jumpCooldown <= 0 && d < 36) {
            m.isJumping = true;
            m.jumpVy = 10.2 + Math.random() * 2.2;
            m.jumpCooldown = 3.1 + Math.random() * 1.6;
            m.vx = Math.sin(moveYaw) * m.speed * 1.9;
            m.vz = Math.cos(moveYaw) * m.speed * 1.9;
            const takeWy = waterHeightAt(m.x, m.z, this.worldTime, this.weatherSystem.getWaveAmp());
            this.splashSystem.emitSplash(m.x, m.z, 1.3, m.vx * 0.35, m.vz * 0.35, takeWy);
            soundEngine.playMonsterLunge(false);
          }
        }

        m.shootCooldown -= dt;
        if (m.shootCooldown <= 0 && d < 32 && !m.isJumping) {
          m.shootCooldown = 1.85 + Math.random() * 0.6;
          this.spawnEnemyOrb(m.x, m.z, yawToBoat, 13.8, m.damage, true);
          soundEngine.playMonsterShot(true, false);
        }
      } else if (m.kind === 'ersh') {
        // Ёрш Передрёш: speeds up when damaged and performs sharp spiked lunges
        const frenzy = m.hp < m.maxHp * 0.65 ? 1.32 : 1.0;
        m.stateTimer -= dt;
        if (m.isLunging) {
          m.lungeTimer -= dt;
          if (m.lungeTimer <= 0) {
            m.isLunging = false;
            m.stateTimer = 1.7 + Math.random() * 0.8;
          }
        } else if (m.stateTimer <= 0 && d < 13) {
          m.isLunging = true;
          m.lungeTimer = 0.36;
          m.yaw = yawToBoat;
          const dashSpd = m.speed * 2.25 * frenzy;
          m.vx = Math.sin(m.yaw) * dashSpd;
          m.vz = Math.cos(m.yaw) * dashSpd;
          soundEngine.playMonsterLunge(false);
        } else {
          m.yaw = lerpAngle(m.yaw, yawToBoat, dt * 6);
          m.vx += (Math.sin(m.yaw) * m.speed * frenzy - m.vx) * Math.min(1, dt * 4.5);
          m.vz += (Math.cos(m.yaw) * m.speed * frenzy - m.vz) * Math.min(1, dt * 4.5);
        }
      } else if (m.kind === 'lin') {
        // Линь Жминь: steady armored tank firing toxic swamp slime orbs
        let moveYaw = yawToBoat;
        if (d < 8.5) moveYaw = yawToBoat + Math.PI * 0.72 * (m.id % 2 === 0 ? 1 : -1);
        m.yaw = lerpAngle(m.yaw, yawToBoat, dt * 4);
        m.vx += (Math.sin(moveYaw) * m.speed - m.vx) * Math.min(1, dt * 3.2);
        m.vz += (Math.cos(moveYaw) * m.speed - m.vz) * Math.min(1, dt * 3.2);

        m.shootCooldown -= dt;
        if (m.shootCooldown <= 0 && d < 25) {
          m.shootCooldown = 2.45 + Math.random() * 0.8;
          this.spawnEnemyOrb(m.x, m.z, yawToBoat, 12.2, m.damage, false, true);
          soundEngine.playMonsterShot(false, false);
        }
      } else if (m.kind === 'peskar') {
        // Пескарь Натаскарь: swift sinusoidal flanking weave around islands
        const weave = Math.sin(m.swimPhase * 0.9 + m.id) * 0.72;
        m.yaw = lerpAngle(m.yaw, yawToBoat + weave, dt * 8);
        m.vx += (Math.sin(m.yaw) * m.speed - m.vx) * Math.min(1, dt * 5.2);
        m.vz += (Math.cos(m.yaw) * m.speed - m.vz) * Math.min(1, dt * 5.2);
      } else if (m.kind === 'karas') {
        // Карась Вырубась: heavy orange-line telegraphed forehead ram
        if (m.isLunging) {
          m.lungeTimer -= dt;
          if (m.lungeTimer <= 0) {
            m.isLunging = false;
            m.stateTimer = 2.1 + Math.random() * 0.8;
          }
        } else if (m.telegraphTimer > 0) {
          m.telegraphTimer -= dt;
          m.vx *= Math.exp(-7 * dt);
          m.vz *= Math.exp(-7 * dt);
          m.yaw = lerpAngle(m.yaw, m.telegraphYaw, dt * 10);
          if (m.rig.telegraphLine) m.rig.telegraphLine.visible = true;
          if (m.telegraphTimer <= 0) {
            if (m.rig.telegraphLine) m.rig.telegraphLine.visible = false;
            m.isLunging = true;
            m.lungeTimer = 0.52;
            const ramSpd = m.speed * 2.95;
            m.vx = Math.sin(m.telegraphYaw) * ramSpd;
            m.vz = Math.cos(m.telegraphYaw) * ramSpd;
            soundEngine.playMonsterLunge(true);
          }
        } else {
          if (m.rig.telegraphLine) m.rig.telegraphLine.visible = false;
          m.stateTimer -= dt;
          if (d < 16 && m.stateTimer <= 0) {
            m.telegraphTimer = 0.62;
            m.telegraphYaw = yawToBoat;
          } else {
            m.yaw = lerpAngle(m.yaw, yawToBoat, dt * 4.5);
            m.vx += (Math.sin(m.yaw) * m.speed - m.vx) * Math.min(1, dt * 3.8);
            m.vz += (Math.cos(m.yaw) * m.speed - m.vz) * Math.min(1, dt * 3.8);
          }
        }
      } else {
        m.yaw = lerpAngle(m.yaw, yawToBoat, dt * 5);
        const spdMult = m.kind === 'puffer' && d < 8 ? 1.25 : 1;
        m.vx += (Math.sin(m.yaw) * m.speed * spdMult - m.vx) * Math.min(1, dt * 4);
        m.vz += (Math.cos(m.yaw) * m.speed * spdMult - m.vz) * Math.min(1, dt * 4);
      }

      // Soft separation
      for (let j = i - 1; j >= 0; j--) {
        const o = this.monsters[j];
        const dx = m.x - o.x;
        const dz = m.z - o.z;
        const sd = Math.hypot(dx, dz);
        const minSep = m.radius + o.radius;
        if (sd < minSep && sd > 0.01) {
          const push = (minSep - sd) * 0.5;
          m.x += (dx / sd) * push;
          m.z += (dz / sd) * push;
          o.x -= (dx / sd) * push;
          o.z -= (dz / sd) * push;
        }
      }

      m.x += m.vx * dt;
      m.z += m.vz * dt;
      m.x = clamp(m.x, -ARENA_HALF_W + m.radius, ARENA_HALF_W - m.radius);
      m.z = clamp(m.z, -ARENA_HALF_H + m.radius, ARENA_HALF_H - m.radius);

      for (const obs of this.obstacles) {
        const dx = m.x - obs.x;
        const dz = m.z - obs.z;
        const od = Math.hypot(dx, dz);
        const minD = m.radius + obs.radius * 0.85;
        if (od < minD && od > 0.01) {
          m.x = obs.x + (dx / od) * minD;
          m.z = obs.z + (dz / od) * minD;
        }
      }

      // Animate 3D articulated mesh on water surface (and jump arc for Crocodile Gena)
      const wy = waterHeightAt(m.x, m.z, this.worldTime, this.weatherSystem.getWaveAmp());
      m.rig.root.position.set(m.x, wy + m.jumpY, m.z);
      m.rig.root.rotation.y = m.yaw;
      m.rig.root.rotation.x = m.isJumping ? clamp(-m.jumpVy * 0.055, -0.45, 0.52) : 0;

      if (m.rig.tail) {
        m.rig.tail.rotation.y = Math.sin(m.swimPhase) * 0.45;
      }
      if (m.rig.segments.length > 0) {
        m.rig.segments.forEach((seg, idx) => {
          seg.position.x = Math.sin(m.swimPhase - idx * 0.65) * (m.kind === 'leviathan' ? idx * 0.16 : idx * 0.07);
        });
      }

      // Collision with Sasha's boat
      if (Math.hypot(m.x - this.boatX, m.z - this.boatZ) < m.radius + this.boatRadius * 0.85) {
        if (this.invulnTimer <= 0) {
          const knockYaw = Math.atan2(this.boatX - m.x, this.boatZ - m.z);
          this.hurtPlayer(m.damage, knockYaw, m.kind === 'karas' ? 1.8 : 1.0);
        }
        const pushYaw = Math.atan2(m.x - this.boatX, m.z - this.boatZ);
        m.vx = Math.sin(pushYaw) * 10;
        m.vz = Math.cos(pushYaw) * 10;
      }
    }
  }

  private spawnEnemyOrb(
    x: number,
    z: number,
    yaw: number,
    speed: number,
    damage: number,
    isBitcoin = false,
    isSlime = false
  ) {
    const mesh: THREE.Object3D = isBitcoin
      ? buildBitcoinProjectileMesh(this.pickupAssets)
      : new THREE.Mesh(this.orbGeo, isSlime ? this.slimeOrbMat : this.orbMat);
    if (isSlime) {
      mesh.scale.setScalar(1.35);
    }
    mesh.position.set(x, isBitcoin ? 0.95 : 0.8, z);
    this.scene.add(mesh);

    this.projectiles.push({
      fromPlayer: false,
      x,
      y: isBitcoin ? 0.95 : 0.8,
      z,
      vx: Math.sin(yaw) * speed,
      vy: 0,
      vz: Math.cos(yaw) * speed,
      gravity: 0,
      yaw,
      radius: isBitcoin ? 0.42 : isSlime ? 0.44 : 0.35,
      damage,
      life: 2.8,
      isCrit: false,
      isBitcoin,
      pierce: 1,
      hitIds: [],
      mesh,
    });
  }

  private updateProjectiles(dt: number) {
    const waveAmp = this.weatherSystem.getWaveAmp();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.vy -= p.gravity * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.mesh.position.set(p.x, p.y, p.z);
      if (p.isBitcoin) {
        p.mesh.rotation.y += dt * 7;
        p.mesh.rotation.z += dt * 3.5;
      } else if (p.fromPlayer) {
        p.mesh.rotation.x = -Math.atan2(p.vy, Math.hypot(p.vx, p.vz));
      }

      const wy = waterHeightAt(p.x, p.z, this.worldTime, waveAmp);
      const hitWaterSurface = p.fromPlayer && p.y <= wy + 0.08;

      if (
        hitWaterSurface ||
        p.life <= 0 ||
        Math.abs(p.x) > ARENA_HALF_W + 2 ||
        Math.abs(p.z) > ARENA_HALF_H + 2
      ) {
        if (hitWaterSurface || (p.fromPlayer && p.life <= 0)) {
          this.splashSystem.emitSplash(p.x, p.z, p.isCrit ? 1.25 : 0.95, p.vx * 0.25, p.vz * 0.25, wy);
        }
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      let hitObs = false;
      for (const obs of this.obstacles) {
        if (Math.hypot(p.x - obs.x, p.z - obs.z) < obs.radius * 0.82 + p.radius) {
          hitObs = true;
          break;
        }
      }
      if (hitObs) {
        this.splashSystem.emitSplash(p.x, p.z, 0.8, -p.vx * 0.2, -p.vz * 0.2, wy);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.fromPlayer) {
        let removed = false;
        for (let j = this.monsters.length - 1; j >= 0; j--) {
          const m = this.monsters[j];
          if (p.hitIds.includes(m.id)) continue;
          if (Math.hypot(p.x - m.x, p.z - m.z) <= m.radius + p.radius) {
            p.hitIds.push(m.id);
            const kb = m.kind === 'leviathan' ? 2.2 : 7 + this.upgradeLevels.heavy_harpoon * 1.4;
            m.vx += Math.sin(p.yaw) * kb;
            m.vz += Math.cos(p.yaw) * kb;
            this.damageMonster(j, p.damage, p.isCrit);
            p.pierce -= 1;
            if (p.pierce <= 0) {
              this.scene.remove(p.mesh);
              this.projectiles.splice(i, 1);
              removed = true;
              break;
            }
          }
        }
        if (removed) continue;
      } else {
        if (Math.hypot(p.x - this.boatX, p.z - this.boatZ) <= this.boatRadius * 0.85 + p.radius) {
          if (this.invulnTimer <= 0) {
            this.hurtPlayer(p.damage, p.yaw);
          }
          this.spawnSplashBurst(p.x, p.z, 6, 'splash', 5);
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private damageMonster(index: number, amount: number, isCrit: boolean) {
    const m = this.monsters[index];
    if (!m) return;
    m.hp -= amount;
    m.hitFlash = 0.11;
    this.spawnSplashBurst(m.x, m.z, isCrit ? 9 : 5, isCrit ? 'spark' : 'splash', isCrit ? 6.5 : 4.5);

    if (m.hp <= 0) {
      soundEngine.playHit(true);
      this.handleMonsterDeath(m, index);
    } else {
      soundEngine.playHit(false);
    }
  }

  private handleMonsterDeath(m: Monster3D, index: number) {
    this.scene.remove(m.rig.root);
    this.monsters.splice(index, 1);
    this.monstersKilled += 1;
    this.killsByKind[m.kind] = (this.killsByKind[m.kind] ?? 0) + 1;
    if (m.kind === 'leviathan') this.leviathansKilled += 1;
    if (m.kind === 'croc_gena') this.crocsKilled += 1;
    this.combo += 1;
    this.comboTimer = 3.2;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    const diff = DIFFICULTIES[this.difficulty];
    const comboMult = 1 + Math.min(2.0, (this.combo - 1) * 0.1);
    this.score += Math.round(m.scoreValue * comboMult * diff.scoreMult);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(this.highScore));
      } catch {
        // ignore storage failure
      }
    }

    this.spawnSplashBurst(m.x, m.z, m.kind === 'leviathan' ? 28 : 12, 'splash', m.kind === 'leviathan' ? 10 : 6);
    this.spawnRing(m.x, m.z, m.radius * 0.5, m.radius * 2.4, 0.45, m.kind === 'leviathan');

    if (m.kind === 'catfish') {
      for (let k = 0; k < 2; k++) {
        const off = k === 0 ? -1.1 : 1.1;
        this.spawnMonster('minnow', m.x + off, m.z + off * 0.6);
      }
    } else if (m.kind === 'puffer') {
      soundEngine.playMonsterShot(false, false);
      for (let k = 0; k < 8; k++) {
        this.spawnEnemyOrb(m.x, m.z, (k / 8) * Math.PI * 2, 12, Math.round(m.damage * 0.65));
      }
    }

    // Trophy coins & themed gifts (1 Бульба, Чеснок, Сила гарпуна)
    const coinDropCount = m.kind === 'leviathan' ? 7 : m.kind === 'minnow' ? 1 : 2;
    const perCoin = Math.max(1, Math.round(m.coinValue / coinDropCount));
    for (let c = 0; c < coinDropCount; c++) {
      this.spawnPickup('coin', m.x, m.z, perCoin);
    }

    if (m.kind === 'croc_gena') {
      const gRoll = Math.random();
      if (gRoll < 0.36) {
        this.spawnPickup('bulba_heal', m.x + 0.6, m.z, 25);
      } else if (gRoll < 0.7) {
        this.spawnPickup('garlic_overdrive', m.x - 0.6, m.z, 8);
      } else {
        this.spawnPickup('harpoon_power', m.x, m.z + 0.6, 4);
      }
    } else if (m.kind === 'leviathan') {
      this.spawnPickup('bulba_heal', m.x + 0.7, m.z, 25);
      this.spawnPickup('harpoon_power', m.x - 0.7, m.z, 4);
    } else {
      const roll = Math.random();
      if (roll < 0.08) {
        this.spawnPickup('bulba_heal', m.x + 0.6, m.z, 25);
      } else if (roll < 0.13) {
        this.spawnPickup('garlic_overdrive', m.x - 0.6, m.z, 8);
      } else if (roll < 0.17) {
        this.spawnPickup('harpoon_power', m.x, m.z + 0.6, 4);
      }
    }
  }

  private spawnPickup(
    kind: 'coin' | 'bulba_heal' | 'garlic_overdrive' | 'harpoon_power',
    x: number,
    z: number,
    value: number
  ) {
    const group = new THREE.Group();
    if (kind === 'coin') {
      group.add(new THREE.Mesh(this.pickupAssets.coinGeo, this.pickupAssets.coinMat));
    } else if (kind === 'bulba_heal') {
      group.add(buildBulbaPickupMesh(this.pickupAssets));
    } else if (kind === 'garlic_overdrive') {
      group.add(buildGarlicPickupMesh(this.pickupAssets));
    } else {
      group.add(buildHarpoonPowerPickupMesh(this.pickupAssets));
    }
    group.position.set(x, 0.55, z);
    this.scene.add(group);

    const a = Math.random() * Math.PI * 2;
    const spd = 2.2 + Math.random() * 2.5;
    this.pickups.push({
      kind,
      x,
      z,
      vx: Math.sin(a) * spd,
      vz: Math.cos(a) * spd,
      life: 18,
      bobPhase: Math.random() * Math.PI * 2,
      value,
      mesh: group,
    });
  }

  private hurtPlayer(damage: number, pushYaw: number, knockMult = 1.0) {
    this.stats.hp = Math.max(0, this.stats.hp - damage);
    this.invulnTimer = 0.78;
    this.boatVx += Math.sin(pushYaw) * 13 * knockMult;
    this.boatVz += Math.cos(pushYaw) * 13 * knockMult;
    this.screenShake = Math.max(this.screenShake, 0.65);
    this.combo = 0;

    soundEngine.playPlayerHurt();
    this.spawnSplashBurst(this.boatX, this.boatZ, 12, 'spark', 6.5);

    if (this.stats.hp <= 0) {
      this.running = false;
      soundEngine.playGameOver();
      this.emitHud();
      this.callbacks.onGameOver(this.buildHudSnapshot());
    } else {
      this.emitHud();
    }
  }

  private updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.life -= dt;
      pk.bobPhase += dt * 4;
      if (pk.life <= 0) {
        this.scene.remove(pk.mesh);
        this.pickups.splice(i, 1);
        continue;
      }

      pk.vx *= Math.exp(-5 * dt);
      pk.vz *= Math.exp(-5 * dt);

      const dx = this.boatX - pk.x;
      const dz = this.boatZ - pk.z;
      const d = Math.hypot(dx, dz);
      const magnet = pk.kind === 'coin' ? 8.5 : 5.8;
      if (d < magnet && d > 0.1) {
        pk.vx += (dx / d) * 20 * dt * 4;
        pk.vz += (dz / d) * 20 * dt * 4;
      }

      pk.x += pk.vx * dt;
      pk.z += pk.vz * dt;

      const wy = waterHeightAt(pk.x, pk.z, this.worldTime, this.weatherSystem.getWaveAmp());
      pk.mesh.position.set(pk.x, wy + 0.5 + Math.sin(pk.bobPhase) * 0.16, pk.z);
      pk.mesh.rotation.y += dt * 2.2;

      if (d < this.boatRadius + 0.9) {
        if (pk.kind === 'coin') {
          soundEngine.playPickup('coin');
          this.coins += pk.value;
          this.score += pk.value * 10;
        } else if (pk.kind === 'bulba_heal') {
          soundEngine.playPickup('repair');
          this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + pk.value);
          this.eventBannerText = `+1 Бульба · Здоровье +${pk.value} HP`;
          this.eventBannerTimer = 2.0;
          this.emitHud();
        } else if (pk.kind === 'garlic_overdrive') {
          soundEngine.playPickup('overdrive');
          this.overdriveTimer = pk.value;
          this.spawnRing(this.boatX, this.boatZ, 1.0, 9.0, 0.45, true);
          for (const m of this.monsters) {
            const md = Math.hypot(m.x - this.boatX, m.z - this.boatZ);
            if (md <= 9.0 && md > 0.01) {
              const pushYaw = Math.atan2(m.x - this.boatX, m.z - this.boatZ);
              const force = m.kind === 'leviathan' ? 7 : 18;
              m.vx += Math.sin(pushYaw) * force;
              m.vz += Math.cos(pushYaw) * force;
            }
          }
          this.eventBannerText = 'Чеснок! Форсаж и чесночная волна';
          this.eventBannerTimer = 2.2;
          this.emitHud();
        } else {
          soundEngine.playPickup('overdrive');
          this.stats.damage += pk.value;
          this.eventBannerText = `Сила гарпуна +${pk.value} (урон: ${this.stats.damage})`;
          this.eventBannerTimer = 2.2;
          this.emitHud();
        }
        this.scene.remove(pk.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  private spawnSplashBurst(x: number, z: number, count: number, kind: 'splash' | 'spark', speed: number) {
    if (kind === 'splash') {
      const wy = waterHeightAt(x, z, this.worldTime, this.weatherSystem.getWaveAmp());
      this.splashSystem.emitSplash(x, z, clamp(count / 10, 0.75, 2.2), 0, 0, wy);
      return;
    }
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.35 + Math.random() * 0.65) * speed;
      const mat = this.sparkMat.clone();
      const mesh = new THREE.Mesh(this.splashGeo, mat);
      mesh.position.set(x, 0.35, z);
      this.scene.add(mesh);
      this.particles.push({
        x,
        y: 0.35,
        z,
        vx: Math.sin(a) * sp,
        vy: 3.2 + Math.random() * speed * 0.7,
        vz: Math.cos(a) * sp,
        gravity: 16,
        life: 0.45 + Math.random() * 0.2,
        maxLife: 0.65,
        startScale: 1.15,
        endScale: 0.1,
        kind,
        mesh,
      });
    }
  }

  private spawnRing(x: number, z: number, startScale: number, endScale: number, life: number, isShockwave: boolean) {
    const mat = (isShockwave ? this.shockwaveMat : this.ringMat).clone();
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.set(x, 0.14, z);
    this.scene.add(mesh);
    this.particles.push({
      x,
      y: 0.14,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      gravity: 0,
      life,
      maxLife: life,
      startScale,
      endScale,
      kind: isShockwave ? 'shockwave' : 'ring',
      mesh,
    });
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.scene.remove(pt.mesh);
        (pt.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }

      const t = 1 - pt.life / pt.maxLife;
      if (pt.kind === 'ring' || pt.kind === 'shockwave') {
        const s = THREE.MathUtils.lerp(pt.startScale, pt.endScale, t);
        pt.mesh.scale.setScalar(s);
        (pt.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * (pt.kind === 'shockwave' ? 0.85 : 0.42);
      } else {
        pt.vy -= pt.gravity * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.z += pt.vz * dt;
        pt.mesh.position.set(pt.x, pt.y, pt.z);
        const s = THREE.MathUtils.lerp(pt.startScale, pt.endScale, t);
        pt.mesh.scale.setScalar(s);
        (pt.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      }
    }
  }

  private updateCamera(dt: number) {
    // Camera offset by preset
    let offsetY = 19;
    let offsetZ = 17;
    if (this.cameraPreset === 'close') {
      offsetY = 11.5;
      offsetZ = 13.5;
    } else if (this.cameraPreset === 'tactical') {
      offsetY = 29;
      offsetZ = 14;
    }

    const leadX = Math.sin(this.aimYaw) * 2.8;
    const leadZ = Math.cos(this.aimYaw) * 2.8;

    const targetCamX = this.boatX + leadX * 0.45;
    const targetCamY = offsetY;
    const targetCamZ = this.boatZ + offsetZ + leadZ * 0.35;

    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, targetCamX, 6.5, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetCamY, 6.5, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetCamZ, 6.5, dt);

    const targetLookX = this.boatX + leadX;
    const targetLookZ = this.boatZ + leadZ;
    this.camLook.x = THREE.MathUtils.damp(this.camLook.x, targetLookX, 8, dt);
    this.camLook.y = 0.4;
    this.camLook.z = THREE.MathUtils.damp(this.camLook.z, targetLookZ, 8, dt);

    // Dynamic FOV widening during Boost Dash
    const desiredFov = this.dashTimer > 0 ? 55 : 48;
    if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, desiredFov, 9, dt);
      this.camera.updateProjectionMatrix();
    }

    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;

    this.camera.position.set(this.camPos.x + shakeX, this.camPos.y + shakeY, this.camPos.z);
    this.camera.lookAt(this.camLook);
  }

  private renderFrame() {
    if (this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private buildHudSnapshot(): HudSnapshot {
    const boss = this.monsters.find((m) => m.kind === 'leviathan');
    return {
      hp: this.stats.hp,
      maxHp: this.stats.maxHp,
      score: this.score,
      highScore: this.highScore,
      coins: this.coins,
      wave: this.wave,
      monstersRemaining: this.monsters.length + this.waveSpawnQueue.length,
      monstersKilled: this.monstersKilled,
      leviathansKilled: this.leviathansKilled,
      crocsKilled: this.crocsKilled,
      killsByKind: { ...this.killsByKind },
      harpoonDamage: this.stats.damage,
      combo: this.combo,
      maxCombo: this.maxCombo,
      dashCooldownRatio:
        this.stats.dashCooldown > 0 ? clamp(this.dashCooldownTimer / this.stats.dashCooldown, 0, 1) : 0,
      dashReady: this.dashCooldownTimer <= 0,
      depthCharges: this.stats.depthCharges,
      maxDepthCharges: this.stats.maxDepthCharges,
      overdriveTimer: this.overdriveTimer,
      bossName: boss ? boss.name : null,
      bossHp: boss ? boss.hp : 0,
      bossMaxHp: boss ? boss.maxHp : 0,
      waveBannerTimer: this.waveBannerTimer,
      waveBannerText: this.waveBannerText,
      eventBannerTimer: this.eventBannerTimer,
      eventBannerText: this.eventBannerText,
      weather: this.weatherSystem.getWeather(),
      tourName: this.currentTour.name,
      tourBiome: TOUR_BIOMES[this.currentTour.biome].label,
      totalTours: TOTAL_TOURS,
      islandCount: this.currentTour.islands.length,
      npcShout: this.npcShout ? { ...this.npcShout } : null,
    };
  }

  private emitHud() {
    this.callbacks.onHudUpdate(this.buildHudSnapshot());
  }
}
