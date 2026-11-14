import { soundEngine } from './audio';
import {
  BASE_PLAYER_STATS,
  DIFFICULTIES,
  HIGH_SCORE_STORAGE_KEY,
  MONSTER_EYE_COLORS,
  UPGRADE_CATALOG,
} from './constants';
import {
  FISHERMAN_NAMES,
  pickFishermanPhraseFromContext,
  WorldObstacle3D,
} from './islands3d';
import { getTourDefinition, TOTAL_TOURS, TOUR_BIOMES, TourDefinition } from './tours';
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
import { WEATHER_LABELS } from './weather3d';

const ARENA_HALF_W = 54;
const ARENA_HALF_H = 38;
const PX_PER_METER = 22;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

interface Monster2D {
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
}

interface Projectile2D {
  fromPlayer: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  isCrit: boolean;
  isBitcoin?: boolean;
  isSlime?: boolean;
  isVenomous?: boolean;
  pierce: number;
  hitIds: number[];
}

interface Particle2D {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  maxLife: number;
  startR: number;
  endR: number;
  color: string;
  kind: 'splash' | 'ring' | 'shockwave' | 'spark';
}

interface Pickup2D {
  kind: 'coin' | 'bulba_heal' | 'garlic_overdrive' | 'harpoon_power';
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  bobPhase: number;
  value: number;
}

interface IslandFisherman2D {
  speaker: string;
  seed: number;
  worldX: number;
  worldZ: number;
  triggerRadius: number;
  cooldownTimer: number;
  shoutTimer: number;
  shoutText: string;
  phase: number;
}

interface RainDrop2D {
  x: number;
  y: number;
  len: number;
  speed: number;
}

interface FogWisp2D {
  x: number;
  z: number;
  radius: number;
  speedMult: number;
  phase: number;
  alpha: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

const WEATHER_ORDER: WeatherKind[] = ['clear', 'mist', 'rain', 'storm'];

export class BlackLakeEngine2D implements BlackLakeEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private width = 800;
  private height = 600;
  private dpr = 1;

  private frameId = 0;
  private lastTs = 0;
  private running = false;
  private paused = false;
  private disposed = false;
  private worldTime = 0;

  private difficulty: Difficulty = 'hunt';
  private cameraPreset: CameraPreset = 'chase';
  private camZoom = 1;
  private camX = 0;
  private camZ = 0;

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

  private currentTour: TourDefinition = getTourDefinition(1);
  private obstacles: WorldObstacle3D[] = [];
  private fishermen: IslandFisherman2D[] = [];
  private globalShoutCooldown = 2.0;
  private recentPhrases: string[] = [];

  private monsters: Monster2D[] = [];
  private projectiles: Projectile2D[] = [];
  private particles: Particle2D[] = [];
  private pickups: Pickup2D[] = [];

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
  private poisonTimer = 0;
  private poisonTickTimer = 0;
  private stunTimer = 0;
  private fireTimer = 0;
  private screenShake = 0;
  private hudEmitTimer = 0;

  private weather: WeatherKind = 'clear';
  private weatherShiftTimer = 26;
  private lightningFlash = 0;
  private raindrops: RainDrop2D[] = [];
  private fogWisps: FogWisp2D[] = [];
  private fogDensity2D = 0.22;
  private fogR = 14;
  private fogG = 28;
  private fogB = 38;
  private mistBankOpacity2D = 0.08;

  private keys = new Set<string>();
  private mouseDown = false;
  private autoFire = false;
  private mouseClientX = 0;
  private mouseClientY = 0;
  private hasMouseMoved = false;
  private touchMoveX = 0;
  private touchMoveY = 0;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    try {
      const saved = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      this.highScore = saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      this.highScore = 0;
    }

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D Canvas context unavailable');
    }
    this.ctx = ctx;

    for (let i = 0; i < 85; i++) {
      this.raindrops.push({
        x: Math.random() * 1600,
        y: Math.random() * 1000,
        len: 12 + Math.random() * 14,
        speed: 620 + Math.random() * 240,
      });
    }

    for (let i = 0; i < 30; i++) {
      this.fogWisps.push({
        x: (Math.random() * 2 - 1) * (ARENA_HALF_W + 6),
        z: (Math.random() * 2 - 1) * (ARENA_HALF_H + 4),
        radius: 6 + Math.random() * 7.5,
        speedMult: 0.55 + Math.random() * 0.85,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.45 + Math.random() * 0.55,
      });
    }

    this.resize(container.clientWidth || 800, container.clientHeight || 600);
  }

  public resize(width: number, height: number) {
    if (this.disposed) return;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
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
    this.camX = 0;
    this.camZ = 0;
    this.invulnTimer = 0;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.recoil = 0;
    this.wakeTimer = 0;

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
    this.poisonTimer = 0;
    this.poisonTickTimer = 0;
    this.stunTimer = 0;
    this.fireTimer = 0;
    this.screenShake = 0;
    this.paused = false;
    this.waveClearPending = false;
    this.weather = 'clear';
    this.weatherShiftTimer = 26;

    this.beginWave(1);
    this.startLoop();
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
      weather: this.weather,
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
    this.camX = 0;
    this.camZ = 0;
    this.invulnTimer = 0;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.recoil = 0;

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
    this.poisonTimer = 0;
    this.poisonTickTimer = 0;
    this.stunTimer = 0;
    this.paused = paused;

    this.beginWave(state.wave);
    this.weather = state.weather;
    this.startLoop();
    this.emitHud();
  }

  private clearDynamicEntities() {
    this.monsters = [];
    this.projectiles = [];
    this.particles = [];
    this.pickups = [];
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
    this.poisonTimer = 0;
    this.poisonTickTimer = 0;
    this.stunTimer = 0;
    this.weather = tour.weather;
    this.weatherShiftTimer = 24;

    this.obstacles = [];
    this.fishermen = [];
    this.globalShoutCooldown = 1.5;

    for (const isl of tour.islands) {
      this.obstacles.push({ x: isl.x, z: isl.z, radius: isl.radius, isIsland: true });
      const awayAngle = Math.atan2(isl.z, isl.x);
      const fisherAngle = awayAngle + Math.PI + ((isl.seed % 2 === 0 ? 1 : -1) * 0.58);
      const fisherDist = isl.radius * 0.74;
      this.fishermen.push({
        speaker: FISHERMAN_NAMES[isl.seed % FISHERMAN_NAMES.length],
        seed: isl.seed,
        worldX: isl.x + Math.cos(fisherAngle) * fisherDist,
        worldZ: isl.z + Math.sin(fisherAngle) * fisherDist,
        triggerRadius: isl.radius + 9.8,
        cooldownTimer: 1.5 + (isl.seed % 3) * 1.1,
        shoutTimer: 0,
        shoutText: '',
        phase: isl.seed * 0.91,
      });
    }

    for (const reef of tour.reefs) {
      this.obstacles.push({ x: reef.x, z: reef.z, radius: reef.radius, isIsland: false });
    }

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
    const idx = WEATHER_ORDER.indexOf(this.weather);
    this.weather = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
    this.weatherShiftTimer = 26;
    this.eventBannerText = `Погода: ${WEATHER_LABELS[this.weather]}`;
    this.eventBannerTimer = 2.0;
    this.emitHud();
    return this.weather;
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

    this.spawnBurst(
      this.boatX - Math.sin(this.boatYaw) * 1.3,
      this.boatZ - Math.cos(this.boatYaw) * 1.3,
      12,
      'splash',
      7.2
    );
  }

  public triggerDepthCharge() {
    if (!this.running || this.paused) return;
    if (this.stats.depthCharges <= 0) return;

    this.stats.depthCharges -= 1;
    this.screenShake = Math.max(this.screenShake, 0.85);
    soundEngine.playDepthCharge();

    const radiusM = this.stats.depthRadius / 20;
    this.particles.push({
      x: this.boatX,
      z: this.boatZ,
      vx: 0,
      vz: 0,
      life: 0.5,
      maxLife: 0.5,
      startR: 1.2,
      endR: radiusM,
      color: '#fbbf24',
      kind: 'shockwave',
    });
    this.spawnBurst(this.boatX, this.boatZ, 22, 'spark', 10);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.fromPlayer && Math.hypot(p.x - this.boatX, p.z - this.boatZ) <= radiusM) {
        this.projectiles.splice(i, 1);
      }
    }

    const blastDamage = Math.round(this.stats.damage * 3.4);
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      const d = Math.hypot(m.x - this.boatX, m.z - this.boatZ);
      if (d <= radiusM + m.radius) {
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
    cancelAnimationFrame(this.frameId);
    this.running = true;
    this.lastTs = performance.now();

    const tick = (now: number) => {
      if (!this.running || this.disposed) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTs) / 1000));
      this.lastTs = now;
      if (!this.paused) {
        this.update(dt);
      }
      this.render2D();
      this.frameId = requestAnimationFrame(tick);
    };

    this.frameId = requestAnimationFrame(tick);
  }

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.frameId);
    if (this.canvas.parentNode === this.container) {
      this.container.removeChild(this.canvas);
    }
  }

  private update(dt: number) {
    this.worldTime += dt;

    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 2.5);
    if (this.waveBannerTimer > 0) this.waveBannerTimer = Math.max(0, this.waveBannerTimer - dt);
    if (this.eventBannerTimer > 0) this.eventBannerTimer = Math.max(0, this.eventBannerTimer - dt);
    if (this.npcShout) {
      this.npcShout.timer -= dt;
      if (this.npcShout.timer <= 0) this.npcShout = null;
    }
    if (this.overdriveTimer > 0) this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);
    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);
    if (this.poisonTimer > 0) {
      this.poisonTimer = Math.max(0, this.poisonTimer - dt);
      this.poisonTickTimer -= dt;
      if (this.poisonTickTimer <= 0) {
        this.poisonTickTimer = 0.9;
        if (this.stats.hp > 1) {
          this.stats.hp = Math.max(1, this.stats.hp - 2);
          this.particles.push({
            x: this.boatX + (Math.random() - 0.5) * 1.2,
            z: this.boatZ + (Math.random() - 0.5) * 1.2,
            vx: 0,
            vz: -0.5,
            life: 0.45,
            maxLife: 0.45,
            startR: 0.25,
            endR: 0.05,
            color: '#84cc16',
            kind: 'spark',
          });
        }
      }
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    this.updateWeather(dt);
    this.updateBoat(dt);
    this.updateSpawning(dt);
    this.updateMonsters(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateFishermen(dt);
    this.updateCamera2D(dt);

    if (this.waveSpawnQueue.length === 0 && this.monsters.length === 0 && !this.waveClearPending) {
      this.waveClearPending = true;
      this.waveClearDelay = 0.85;
      if (this.wave >= TOTAL_TOURS) soundEngine.playVictory();
      else soundEngine.playWaveClear();
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

  private updateWeather(dt: number) {
    this.weatherShiftTimer -= dt;
    if (this.weatherShiftTimer <= 0) {
      this.weatherShiftTimer = 25 + Math.random() * 14;
      const pool: WeatherKind[] = this.wave >= 3 ? ['clear', 'mist', 'rain', 'storm'] : ['clear', 'mist', 'rain'];
      const candidates = pool.filter((w) => w !== this.weather);
      if (candidates.length > 0) {
        this.weather = candidates[Math.floor(Math.random() * candidates.length)];
        this.eventBannerText = `Над озером: ${WEATHER_LABELS[this.weather]}`;
        this.eventBannerTimer = 2.4;
      }
    }

    if (this.weather === 'rain' || this.weather === 'storm') {
      const mult = this.weather === 'storm' ? 1.35 : 1;
      for (const drop of this.raindrops) {
        drop.x -= drop.speed * 0.22 * dt * mult;
        drop.y += drop.speed * dt * mult;
        if (drop.y > this.height + 20 || drop.x < -30) {
          drop.x = Math.random() * (this.width + 200);
          drop.y = -20;
        }
      }
    }

    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 2.5);
    } else if (this.weather === 'storm' && Math.random() < dt * 0.14) {
      this.lightningFlash = 0.55;
    }

    // Dynamic biome + weather fog smoothing & drifting low-lying wisps
    const biome = TOUR_BIOMES[this.currentTour.biome];
    const [br, bg, bb] = hexToRgb(biome.fogColor);
    let weatherDensityBoost = 0.16;
    let weatherMistAlpha = 0.08;
    let weatherTintBoost = 0.18;
    let windSpeed = 1.25;

    if (this.weather === 'mist') {
      weatherDensityBoost = 0.56;
      weatherMistAlpha = 0.36;
      weatherTintBoost = 0.48;
      windSpeed = 2.1;
    } else if (this.weather === 'rain') {
      weatherDensityBoost = 0.34;
      weatherMistAlpha = 0.17;
      weatherTintBoost = 0.28;
      windSpeed = 3.9;
    } else if (this.weather === 'storm') {
      weatherDensityBoost = 0.48;
      weatherMistAlpha = 0.26;
      weatherTintBoost = 0.24;
      windSpeed = 5.6;
    }

    // Thicker fog in naturally foggy biomes (misty_shallows, amber_marsh)
    const biomeFactor = clamp((biome.fogDensity - 0.01) / 0.004, 0, 1);
    const targetDensity = clamp(weatherDensityBoost + biomeFactor * 0.22, 0.14, 0.84);
    const targetMistBank = clamp(weatherMistAlpha + biomeFactor * 0.14, 0.06, 0.52);

    // Lighten the biome fog color slightly so drifting wisps read distinctly against deep water
    const targetR = Math.min(220, br + 36 + weatherTintBoost * 92);
    const targetG = Math.min(230, bg + 44 + weatherTintBoost * 100);
    const targetB = Math.min(238, bb + 50 + weatherTintBoost * 106);

    const smooth = 1 - Math.exp(-1.4 * dt);
    this.fogDensity2D += (targetDensity - this.fogDensity2D) * smooth;
    this.mistBankOpacity2D += (targetMistBank - this.mistBankOpacity2D) * smooth;
    this.fogR += (targetR - this.fogR) * smooth;
    this.fogG += (targetG - this.fogG) * smooth;
    this.fogB += (targetB - this.fogB) * smooth;

    for (const w of this.fogWisps) {
      w.x += windSpeed * w.speedMult * dt;
      w.z += Math.sin(this.worldTime * 0.5 + w.phase) * 0.32 * dt;
      if (w.x > ARENA_HALF_W + 10) {
        w.x = -ARENA_HALF_W - 10;
      }
    }
  }

  private updateBoat(dt: number) {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - dt);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 2.8);

    const statusMult = (this.stunTimer > 0 ? 0.35 : 1) * (this.poisonTimer > 0 ? 0.75 : 1);
    const maxSpeed = (this.stats.speed / 20) * statusMult;

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

    this.boatX = clamp(this.boatX + this.boatVx * dt, -ARENA_HALF_W + this.boatRadius, ARENA_HALF_W - this.boatRadius);
    this.boatZ = clamp(this.boatZ + this.boatVz * dt, -ARENA_HALF_H + this.boatRadius, ARENA_HALF_H - this.boatRadius);

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

    const speed = Math.hypot(this.boatVx, this.boatVz);
    if (speed > 1.2) {
      const targetYaw = Math.atan2(this.boatVx, this.boatVz);
      this.boatYaw = lerpAngle(this.boatYaw, targetYaw, Math.min(1, dt * 9));

      this.wakeTimer -= dt;
      if (this.wakeTimer <= 0) {
        this.wakeTimer = this.dashTimer > 0 ? 0.03 : 0.08;
        const sx = this.boatX - Math.sin(this.boatYaw) * 1.4;
        const sz = this.boatZ - Math.cos(this.boatYaw) * 1.4;
        this.particles.push({
          x: sx,
          z: sz,
          vx: 0,
          vz: 0,
          life: 0.55,
          maxLife: 0.55,
          startR: 0.35,
          endR: this.dashTimer > 0 ? 1.85 : 1.25,
          color: '#7dd3fc',
          kind: 'ring',
        });
      }
    }

    const rect = this.canvas.getBoundingClientRect();
    if (this.hasMouseMoved && rect.width > 0 && rect.height > 0) {
      const scale = PX_PER_METER * this.camZoom;
      const wx = this.camX + (this.mouseClientX - rect.left - rect.width / 2) / scale;
      const wz = this.camZ + (this.mouseClientY - rect.top - rect.height / 2) / scale;
      this.aimYaw = Math.atan2(wx - this.boatX, wz - this.boatZ);
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
    } else {
      this.aimYaw = this.boatYaw;
    }

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

      this.projectiles.push({
        fromPlayer: true,
        x: sx,
        z: sz,
        vx: Math.sin(yaw) * projSpd,
        vz: Math.cos(yaw) * projSpd,
        yaw,
        radius: isCrit ? 0.45 : 0.36,
        damage: isCrit ? Math.round(this.stats.damage * 1.85) : this.stats.damage,
        life: 1.45,
        maxLife: 1.45,
        isCrit,
        pierce: isCrit ? 2 : 1,
        hitIds: [],
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
    const yaw = Math.atan2(this.boatX - sx, this.boatZ - sz);
    const isCroc = kind === 'croc_gena';

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
    });

    this.spawnBurst(sx, sz, isCroc ? 10 : 6, 'splash', 5);
    soundEngine.playMonsterSpawn(kind);
  }

  private updateMonsters(dt: number) {
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      m.swimPhase += dt * (m.isLunging ? 18 : 8.5);
      if (m.hitFlash > 0) m.hitFlash = Math.max(0, m.hitFlash - dt);

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
          if (m.telegraphTimer <= 0) {
            m.isLunging = true;
            m.lungeTimer = 0.42;
            const lungeSpd = m.speed * 2.85;
            m.vx = Math.sin(m.telegraphYaw) * lungeSpd;
            m.vz = Math.cos(m.telegraphYaw) * lungeSpd;
            soundEngine.playMonsterLunge(false);
          }
        } else {
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

        m.stateTimer -= dt;
        if (m.telegraphTimer > 0) {
          m.telegraphTimer -= dt;
          if (m.telegraphTimer <= 0) {
            this.particles.push({
              x: m.x,
              z: m.z,
              vx: 0,
              vz: 0,
              life: 0.4,
              maxLife: 0.4,
              startR: 0.9,
              endR: 8.2,
              color: '#00e5ff',
              kind: 'shockwave',
            });
            this.spawnBurst(m.x, m.z, 10, 'spark', 7);
            soundEngine.playElectricZap();
            m.stateTimer = 4.2 + Math.random() * 1.2;

            if (d <= 8.2) {
              const knockYaw = Math.atan2(this.boatX - m.x, this.boatZ - m.z);
              this.stunTimer = Math.max(this.stunTimer, 0.85);
              if (this.invulnTimer <= 0) {
                this.hurtPlayer(Math.round(m.damage * 0.85), knockYaw, 1.5);
              } else {
                this.boatVx += Math.sin(knockYaw) * 14;
                this.boatVz += Math.cos(knockYaw) * 14;
              }
              this.eventBannerText = 'Угорь-искра: электроразряд! Мотор оглушён';
              this.eventBannerTimer = 1.8;
            }
          }
        } else if (d < 7.8 && m.stateTimer <= 0) {
          m.telegraphTimer = 0.42;
        }

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
          if (m.telegraphTimer <= 0) {
            m.isLunging = true;
            m.lungeTimer = 0.65;
            const dashSpd = m.speed * 3.1;
            m.vx = Math.sin(m.telegraphYaw) * dashSpd;
            m.vz = Math.cos(m.telegraphYaw) * dashSpd;
            soundEngine.playMonsterLunge(true);
          }
        } else {
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
            this.spawnBurst(m.x, m.z, 10, 'splash', 5.5);
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
            this.spawnBurst(m.x, m.z, 8, 'splash', 4.2);
            soundEngine.playMonsterLunge(false);
          }
        }

        m.shootCooldown -= dt;
        if (m.shootCooldown <= 0 && d < 32 && !m.isJumping) {
          m.shootCooldown = 1.85 + Math.random() * 0.6;
          this.spawnEnemyOrb(m.x, m.z, yawToBoat, 13.8, m.damage, true, false);
          soundEngine.playMonsterShot(true, false);
        }
      } else if (m.kind === 'ersh') {
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
        let moveYaw = yawToBoat;
        if (d < 8.5) moveYaw = yawToBoat + Math.PI * 0.72 * (m.id % 2 === 0 ? 1 : -1);
        m.yaw = lerpAngle(m.yaw, yawToBoat, dt * 4);
        m.vx += (Math.sin(moveYaw) * m.speed - m.vx) * Math.min(1, dt * 3.2);
        m.vz += (Math.cos(moveYaw) * m.speed - m.vz) * Math.min(1, dt * 3.2);

        m.shootCooldown -= dt;
        if (m.shootCooldown <= 0 && d < 25) {
          m.shootCooldown = 2.45 + Math.random() * 0.8;
          this.spawnEnemyOrb(m.x, m.z, yawToBoat, 12.2, m.damage, false, true, true);
          soundEngine.playMonsterShot(false, false);
        }
      } else if (m.kind === 'peskar') {
        const weave = Math.sin(m.swimPhase * 0.9 + m.id) * 0.72;
        m.yaw = lerpAngle(m.yaw, yawToBoat + weave, dt * 8);
        m.vx += (Math.sin(m.yaw) * m.speed - m.vx) * Math.min(1, dt * 5.2);
        m.vz += (Math.cos(m.yaw) * m.speed - m.vz) * Math.min(1, dt * 5.2);
      } else if (m.kind === 'karas') {
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
          if (m.telegraphTimer <= 0) {
            m.isLunging = true;
            m.lungeTimer = 0.52;
            const ramSpd = m.speed * 2.95;
            m.vx = Math.sin(m.telegraphYaw) * ramSpd;
            m.vz = Math.cos(m.telegraphYaw) * ramSpd;
            soundEngine.playMonsterLunge(true);
          }
        } else {
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

      m.x = clamp(m.x + m.vx * dt, -ARENA_HALF_W + m.radius, ARENA_HALF_W - m.radius);
      m.z = clamp(m.z + m.vz * dt, -ARENA_HALF_H + m.radius, ARENA_HALF_H - m.radius);

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

      if (Math.hypot(m.x - this.boatX, m.z - this.boatZ) < m.radius + this.boatRadius * 0.85) {
        if (this.invulnTimer <= 0) {
          const knockYaw = Math.atan2(this.boatX - m.x, this.boatZ - m.z);
          const hasSpines = m.kind === 'ersh' || m.kind === 'puffer' || m.kind === 'karas';
          const isVenomous = m.kind === 'puffer' || m.kind === 'ersh';
          const knockMult = m.kind === 'karas' ? 1.8 : m.kind === 'ersh' ? 1.35 : 1.0;

          this.hurtPlayer(m.damage, knockYaw, knockMult);
          if (hasSpines) soundEngine.playSpinePrick();
          if (isVenomous) {
            this.poisonTimer = Math.max(this.poisonTimer, 3.2);
            this.poisonTickTimer = Math.max(this.poisonTickTimer, 0.9);
            soundEngine.playPoisonHit();
            this.eventBannerText =
              m.kind === 'puffer'
                ? 'Ядовитые шипы Иглобрюха! 1 Бульба или Чеснок снимут яд'
                : 'Укол ядовитых шипов Ерша! Катер отравлен';
            this.eventBannerTimer = 2.0;
          }
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
    isSlime = false,
    isVenomous = false
  ) {
    this.projectiles.push({
      fromPlayer: false,
      x,
      z,
      vx: Math.sin(yaw) * speed,
      vz: Math.cos(yaw) * speed,
      yaw,
      radius: isBitcoin ? 0.42 : isSlime ? 0.44 : 0.35,
      damage,
      life: 2.8,
      maxLife: 2.8,
      isCrit: false,
      isBitcoin,
      isSlime,
      isVenomous,
      pierce: 1,
      hitIds: [],
    });
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.life -= dt;

      if (p.life <= 0 || Math.abs(p.x) > ARENA_HALF_W + 2 || Math.abs(p.z) > ARENA_HALF_H + 2) {
        if (p.fromPlayer) this.spawnBurst(p.x, p.z, 5, 'splash', 4);
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
        this.spawnBurst(p.x, p.z, 5, 'splash', 4);
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
              this.projectiles.splice(i, 1);
              removed = true;
              break;
            }
          }
        }
        if (removed) continue;
      } else if (Math.hypot(p.x - this.boatX, p.z - this.boatZ) <= this.boatRadius * 0.85 + p.radius) {
        if (this.invulnTimer <= 0) {
          this.hurtPlayer(p.damage, p.yaw);
          if (p.isVenomous) {
            this.poisonTimer = Math.max(this.poisonTimer, 3.2);
            this.poisonTickTimer = Math.max(this.poisonTickTimer, 0.9);
            soundEngine.playPoisonHit();
            this.eventBannerText = 'Токсичный яд! Соберите 1 Бульбу или Чеснок';
            this.eventBannerTimer = 1.9;
          }
        }
        this.spawnBurst(p.x, p.z, 6, 'splash', 5);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private damageMonster(index: number, amount: number, isCrit: boolean) {
    const m = this.monsters[index];
    if (!m) return;
    m.hp -= amount;
    m.hitFlash = 0.11;
    this.spawnBurst(m.x, m.z, isCrit ? 9 : 5, isCrit ? 'spark' : 'splash', isCrit ? 6.5 : 4.5);

    if (m.hp <= 0) {
      soundEngine.playHit(true);
      this.handleMonsterDeath(m, index);
    } else {
      soundEngine.playHit(false);
    }
  }

  private handleMonsterDeath(m: Monster2D, index: number) {
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
        // ignore
      }
    }

    this.spawnBurst(m.x, m.z, m.kind === 'leviathan' ? 20 : 10, 'splash', 7);
    this.particles.push({
      x: m.x,
      z: m.z,
      vx: 0,
      vz: 0,
      life: 0.45,
      maxLife: 0.45,
      startR: m.radius * 0.5,
      endR: m.radius * 2.4,
      color: m.kind === 'leviathan' ? '#fbbf24' : '#7dd3fc',
      kind: m.kind === 'leviathan' ? 'shockwave' : 'ring',
    });

    if (m.kind === 'catfish') {
      for (let k = 0; k < 2; k++) {
        const off = k === 0 ? -1.1 : 1.1;
        this.spawnMonster('minnow', m.x + off, m.z + off * 0.6);
      }
    } else if (m.kind === 'puffer') {
      soundEngine.playMonsterShot(false, false);
      for (let k = 0; k < 8; k++) {
        this.spawnEnemyOrb(m.x, m.z, (k / 8) * Math.PI * 2, 12, Math.round(m.damage * 0.65), false, true, true);
      }
    }

    const coinDropCount = m.kind === 'leviathan' ? 7 : m.kind === 'minnow' ? 1 : 2;
    const perCoin = Math.max(1, Math.round(m.coinValue / coinDropCount));
    for (let c = 0; c < coinDropCount; c++) {
      this.spawnPickup('coin', m.x, m.z, perCoin);
    }

    if (m.kind === 'croc_gena') {
      const gRoll = Math.random();
      if (gRoll < 0.36) this.spawnPickup('bulba_heal', m.x + 0.6, m.z, 25);
      else if (gRoll < 0.7) this.spawnPickup('garlic_overdrive', m.x - 0.6, m.z, 8);
      else this.spawnPickup('harpoon_power', m.x, m.z + 0.6, 4);
    } else if (m.kind === 'leviathan') {
      this.spawnPickup('bulba_heal', m.x + 0.7, m.z, 25);
      this.spawnPickup('harpoon_power', m.x - 0.7, m.z, 4);
    } else {
      const roll = Math.random();
      if (roll < 0.08) this.spawnPickup('bulba_heal', m.x + 0.6, m.z, 25);
      else if (roll < 0.13) this.spawnPickup('garlic_overdrive', m.x - 0.6, m.z, 8);
      else if (roll < 0.17) this.spawnPickup('harpoon_power', m.x, m.z + 0.6, 4);
    }
  }

  private spawnPickup(kind: Pickup2D['kind'], x: number, z: number, value: number) {
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
    this.spawnBurst(this.boatX, this.boatZ, 12, 'spark', 6.5);

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
        this.pickups.splice(i, 1);
        continue;
      }

      pk.vx *= Math.exp(-5 * dt);
      pk.vz *= Math.exp(-5 * dt);

      const dx = this.boatX - pk.x;
      const dz = this.boatZ - pk.z;
      const d = Math.hypot(dx, dz);
      const magnet = pk.kind === 'coin' ? 8.5 : 5.8;
      if (d < magnet && d > 0.05) {
        const pull = 16 * (1 - d / magnet);
        pk.vx += (dx / d) * pull * dt * 8;
        pk.vz += (dz / d) * pull * dt * 8;
      }

      pk.x += pk.vx * dt;
      pk.z += pk.vz * dt;

      if (d < this.boatRadius + 0.85) {
        if (pk.kind === 'coin') {
          this.coins += pk.value;
          soundEngine.playPickup('coin');
        } else if (pk.kind === 'bulba_heal') {
          this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + pk.value);
          const cured = this.poisonTimer > 0;
          this.poisonTimer = 0;
          this.poisonTickTimer = 0;
          soundEngine.playPickup('repair');
          this.eventBannerText = cured
            ? `1 Бульба! +${pk.value} к корпусу и яд снят`
            : `1 Бульба! +${pk.value} к корпусу`;
          this.eventBannerTimer = 2.0;
          this.emitHud();
        } else if (pk.kind === 'garlic_overdrive') {
          soundEngine.playPickup('overdrive');
          this.overdriveTimer = pk.value;
          const cured = this.poisonTimer > 0;
          this.poisonTimer = 0;
          this.poisonTickTimer = 0;
          this.particles.push({
            x: this.boatX,
            z: this.boatZ,
            vx: 0,
            vz: 0,
            life: 0.45,
            maxLife: 0.45,
            startR: 1.0,
            endR: 9.0,
            color: '#e2e8f0',
            kind: 'shockwave',
          });
          for (const m of this.monsters) {
            const md = Math.hypot(m.x - this.boatX, m.z - this.boatZ);
            if (md <= 9.0 && md > 0.01) {
              const pushYaw = Math.atan2(m.x - this.boatX, m.z - this.boatZ);
              const force = m.kind === 'leviathan' ? 7 : 18;
              m.vx += Math.sin(pushYaw) * force;
              m.vz += Math.cos(pushYaw) * force;
            }
          }
          this.eventBannerText = cured
            ? 'Чеснок! Форсаж, волна и яд очищен'
            : 'Чеснок! Форсаж и чесночная волна';
          this.eventBannerTimer = 2.2;
          this.emitHud();
        } else {
          soundEngine.playPickup('overdrive');
          this.stats.damage += pk.value;
          this.eventBannerText = `Сила гарпуна +${pk.value} (урон: ${this.stats.damage})`;
          this.eventBannerTimer = 2.2;
          this.emitHud();
        }
        this.pickups.splice(i, 1);
      }
    }
  }

  private updateFishermen(dt: number) {
    if (this.globalShoutCooldown > 0) {
      this.globalShoutCooldown = Math.max(0, this.globalShoutCooldown - dt);
    }

    for (const f of this.fishermen) {
      if (f.cooldownTimer > 0) f.cooldownTimer = Math.max(0, f.cooldownTimer - dt);
      if (f.shoutTimer > 0) f.shoutTimer = Math.max(0, f.shoutTimer - dt);

      const dist = Math.hypot(this.boatX - f.worldX, this.boatZ - f.worldZ);
      if (this.globalShoutCooldown <= 0 && f.cooldownTimer <= 0 && dist <= f.triggerRadius) {
        const text = pickFishermanPhraseFromContext(
          {
            hpRatio: this.stats.maxHp > 0 ? this.stats.hp / this.stats.maxHp : 1,
            weather: this.weather,
            bossAlive: this.monsters.some((m) => m.kind === 'leviathan'),
            tourRoster: this.currentTour.roster,
          },
          this.recentPhrases
        );
        f.shoutText = text;
        f.shoutTimer = 4.4;
        f.cooldownTimer = 17;
        this.globalShoutCooldown = 7.5;
        this.npcShout = { speaker: f.speaker, text, timer: 4.4 };
        soundEngine.playFishermanCall(f.seed);
        this.emitHud();
        break;
      }
    }
  }

  private spawnBurst(x: number, z: number, count: number, kind: 'splash' | 'spark', speed: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.35 + Math.random() * 0.65) * speed;
      this.particles.push({
        x,
        z,
        vx: Math.sin(a) * sp,
        vz: Math.cos(a) * sp,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        startR: kind === 'spark' ? 0.16 : 0.18,
        endR: 0.03,
        color: kind === 'spark' ? '#fbbf24' : '#bae6fd',
        kind,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.z += pt.vz * dt;
      pt.vx *= Math.exp(-3 * dt);
      pt.vz *= Math.exp(-3 * dt);
    }
  }

  private updateCamera2D(dt: number) {
    const targetZoom = this.cameraPreset === 'close' ? 1.24 : this.cameraPreset === 'tactical' ? 0.74 : 1.0;
    this.camZoom += (targetZoom - this.camZoom) * Math.min(1, dt * 6);

    const leadX = Math.sin(this.aimYaw) * 3.2;
    const leadZ = Math.cos(this.aimYaw) * 3.2;
    this.camX += (this.boatX + leadX - this.camX) * Math.min(1, dt * 6.5);
    this.camZ += (this.boatZ + leadZ - this.camZ) * Math.min(1, dt * 6.5);
  }

  private render2D() {
    const ctx = this.ctx;
    const biome = TOUR_BIOMES[this.currentTour.biome];

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Clear forest void outside the lake
    ctx.fillStyle = '#06110e';
    ctx.fillRect(0, 0, this.width, this.height);

    const scale = PX_PER_METER * this.camZoom;
    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake * 18 : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake * 18 : 0;

    ctx.save();
    ctx.translate(this.width / 2 + shakeX, this.height / 2 + shakeY);
    ctx.scale(scale, scale);
    ctx.translate(-this.camX, -this.camZ);

    // 1. Lake water area & gentle animated ripple grid
    ctx.fillStyle = biome.waterTint;
    ctx.fillRect(-ARENA_HALF_W, -ARENA_HALF_H, ARENA_HALF_W * 2, ARENA_HALF_H * 2);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
    ctx.lineWidth = 0.08;
    const waveShift = Math.sin(this.worldTime * 1.4) * 0.45;
    for (let x = -ARENA_HALF_W + 4; x < ARENA_HALF_W; x += 6) {
      for (let z = -ARENA_HALF_H + 4; z < ARENA_HALF_H; z += 6) {
        const wOff = Math.sin(this.worldTime * 1.8 + x * 0.3 + z * 0.25) * 0.3;
        ctx.beginPath();
        ctx.moveTo(x - 1.1, z + wOff);
        ctx.quadraticCurveTo(x, z - 0.35 + waveShift, x + 1.1, z + wOff);
        ctx.stroke();
      }
    }

    // Shoreline rim
    ctx.strokeStyle = '#1f362c';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-ARENA_HALF_W - 0.4, -ARENA_HALF_H - 0.4, ARENA_HALF_W * 2 + 0.8, ARENA_HALF_H * 2 + 0.8);

    // Perimeter Pine Trees around lake border
    ctx.fillStyle = biome.foliageColor;
    for (let px = -ARENA_HALF_W - 2; px <= ARENA_HALF_W + 2; px += 4.2) {
      this.drawTopPine(px, -ARENA_HALF_H - 2.2, 1.45);
      this.drawTopPine(px, ARENA_HALF_H + 2.2, 1.45);
    }
    for (let pz = -ARENA_HALF_H + 2; pz <= ARENA_HALF_H - 2; pz += 4.2) {
      this.drawTopPine(-ARENA_HALF_W - 2.2, pz, 1.45);
      this.drawTopPine(ARENA_HALF_W + 2.2, pz, 1.45);
    }

    // 2. Islands with campfires, sitting alcoholics, pines & reefs
    for (const isl of this.currentTour.islands) {
      this.drawIsland2D(isl.x, isl.z, isl.radius, isl.alcoholicsCount, isl.seed, biome);
    }
    for (const reef of this.currentTour.reefs) {
      this.drawReef2D(reef.x, reef.z, reef.radius);
    }

    // 3. Water rings & splash particles beneath actors
    for (const pt of this.particles) {
      const t = 1 - pt.life / pt.maxLife;
      const alpha = Math.max(0, 1 - t);
      if (pt.kind === 'ring' || pt.kind === 'shockwave') {
        const r = pt.startR + (pt.endR - pt.startR) * t;
        ctx.strokeStyle = pt.color;
        ctx.globalAlpha = alpha * (pt.kind === 'shockwave' ? 0.85 : 0.42);
        ctx.lineWidth = pt.kind === 'shockwave' ? 0.24 : 0.09;
        ctx.beginPath();
        ctx.arc(pt.x, pt.z, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const r = pt.startR + (pt.endR - pt.startR) * t;
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(pt.x, pt.z, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // 4. Pickups (Coins, 1 Bulba, Garlic, Harpoon Power)
    for (const pk of this.pickups) {
      this.drawPickup2D(pk);
    }

    // 5. Monsters
    for (const m of this.monsters) {
      this.drawMonster2D(m);
    }

    // 6. Baron Sasha's Boat & Lantern Cone
    this.drawBoat2D();

    // 7. Projectiles
    for (const p of this.projectiles) {
      this.drawProjectile2D(p);
    }

    // 8. Fisherman Speech Bubbles in 2D World Space
    for (const f of this.fishermen) {
      this.drawFisherman2D(f);
    }

    // 9. World-space drifting biome & weather fog wisps floating across lake and islands
    const rInt = Math.round(this.fogR);
    const gInt = Math.round(this.fogG);
    const bInt = Math.round(this.fogB);
    for (const w of this.fogWisps) {
      const pulse = 0.8 + 0.2 * Math.sin(this.worldTime * 0.7 + w.phase);
      const peakAlpha = clamp(this.mistBankOpacity2D * w.alpha * pulse, 0.02, 0.52);
      const wispGrad = ctx.createRadialGradient(w.x, w.z, w.radius * 0.1, w.x, w.z, w.radius);
      wispGrad.addColorStop(0, `rgba(${rInt}, ${gInt}, ${bInt}, ${peakAlpha.toFixed(3)})`);
      wispGrad.addColorStop(0.55, `rgba(${rInt}, ${gInt}, ${bInt}, ${(peakAlpha * 0.45).toFixed(3)})`);
      wispGrad.addColorStop(1, `rgba(${rInt}, ${gInt}, ${bInt}, 0)`);
      ctx.fillStyle = wispGrad;
      ctx.beginPath();
      ctx.arc(w.x, w.z, w.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 10. Screen-space Dynamic Biome & Weather Fog Shroud centered on Baron Sasha's Lantern
    const boatScreenX = this.width / 2 + shakeX + (this.boatX - this.camX) * scale;
    const boatScreenY = this.height / 2 + shakeY + (this.boatZ - this.camZ) * scale;
    const lanternClearPx = Math.max(
      95,
      (this.stats.lanternRadius / 22 + (this.overdriveTimer > 0 ? 3.5 : 0)) * scale * 0.72
    );
    const outerFogPx = Math.max(this.width, this.height) * (this.weather === 'mist' ? 0.58 : 0.74);

    // Subtle full-screen atmospheric biome haze
    const ambientHaze = clamp(this.fogDensity2D * 0.24, 0.03, 0.22);
    ctx.fillStyle = `rgba(${rInt}, ${gInt}, ${bInt}, ${ambientHaze.toFixed(3)})`;
    ctx.fillRect(0, 0, this.width, this.height);

    // Thickened outer Black Lake fog around the boat's searchlight perimeter
    const shroudR = Math.max(4, Math.round(rInt * 0.42));
    const shroudG = Math.max(8, Math.round(gInt * 0.42));
    const shroudB = Math.max(12, Math.round(bInt * 0.45));
    const edgeFogAlpha = clamp(0.42 + this.fogDensity2D * 0.56, 0.42, 0.9);
    const midFogAlpha = clamp(this.fogDensity2D * 0.42, 0.08, 0.48);

    const fogGrad = ctx.createRadialGradient(
      boatScreenX,
      boatScreenY,
      lanternClearPx * 0.55,
      boatScreenX,
      boatScreenY,
      outerFogPx
    );
    fogGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fogGrad.addColorStop(0.45, `rgba(${rInt}, ${gInt}, ${bInt}, ${midFogAlpha.toFixed(3)})`);
    fogGrad.addColorStop(1, `rgba(${shroudR}, ${shroudG}, ${shroudB}, ${edgeFogAlpha.toFixed(3)})`);
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 11. Screen-space Rain / Storm Streaks
    if (this.weather === 'rain' || this.weather === 'storm') {
      ctx.strokeStyle = this.weather === 'storm' ? 'rgba(186, 230, 253, 0.36)' : 'rgba(148, 163, 184, 0.26)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const drop of this.raindrops) {
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - drop.len * 0.22, drop.y + drop.len);
      }
      ctx.stroke();
    }

    if (this.lightningFlash > 0) {
      ctx.fillStyle = `rgba(224, 242, 254, ${this.lightningFlash * 0.45})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.restore();
  }

  private drawTopPine(x: number, z: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, z, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(5, 18, 12, 0.35)';
    ctx.beginPath();
    ctx.arc(x + 0.15, z + 0.15, r * 0.52, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawIsland2D(
    ix: number,
    iz: number,
    radius: number,
    alcoholicsCount: number,
    seed: number,
    biome: (typeof TOUR_BIOMES)['midnight_pine']
  ) {
    const ctx = this.ctx;
    const awayAngle = Math.atan2(iz, ix);

    // Shoreline foam ring
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    ctx.arc(ix, iz, radius * 1.07, 0, Math.PI * 2);
    ctx.stroke();

    // Soil shore
    ctx.fillStyle = biome.islandSoilColor;
    ctx.beginPath();
    ctx.arc(ix, iz, radius, 0, Math.PI * 2);
    ctx.fill();

    // Grass top cap
    ctx.fillStyle = biome.foliageColor;
    ctx.beginPath();
    ctx.arc(ix, iz, radius * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Pine trees on back edge
    for (let t = 0; t < 2; t++) {
      const ta = awayAngle + (t === 0 ? -0.52 : 0.52);
      const td = radius * 0.56;
      ctx.fillStyle = '#0c2319';
      this.drawTopPine(ix + Math.cos(ta) * td, iz + Math.sin(ta) * td, 1.25);
    }

    // Campfire warm glow
    const fx = ix - Math.cos(awayAngle) * 0.35;
    const fz = iz - Math.sin(awayAngle) * 0.35;
    const flicker = 0.88 + Math.sin(this.worldTime * 15 + seed) * 0.14;
    const fireGrad = ctx.createRadialGradient(fx, fz, 0.2, fx, fz, 4.4 * flicker);
    fireGrad.addColorStop(0, 'rgba(251, 146, 60, 0.65)');
    fireGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = fireGrad;
    ctx.beginPath();
    ctx.arc(fx, fz, 4.4 * flicker, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(fx, fz, 0.42 * flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(fx, fz, 0.22 * flicker, 0, Math.PI * 2);
    ctx.fill();

    // Sitting Alcoholics around the fire (top-down with coat, ushanka & green bottle)
    const coatColors = ['#7c2d12', '#1e3a5f', '#365314'];
    for (let aIdx = 0; aIdx < alcoholicsCount; aIdx++) {
      const seatAngle = awayAngle + Math.PI + (aIdx - (alcoholicsCount - 1) / 2) * 1.45;
      const sx = fx + Math.cos(seatAngle) * 1.42;
      const sz = fz + Math.sin(seatAngle) * 1.42;
      const sway = Math.sin(this.worldTime * 2 + seed + aIdx) * 0.1;

      ctx.save();
      ctx.translate(sx, sz);
      ctx.rotate(Math.atan2(fx - sx, fz - sz) + sway);
      // Shoulders
      ctx.fillStyle = coatColors[(seed + aIdx) % coatColors.length];
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.32, 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head/hat
      ctx.fillStyle = '#27272a';
      ctx.beginPath();
      ctx.arc(0, 0, 0.18, 0, Math.PI * 2);
      ctx.fill();
      // Rosy nose facing fire
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.arc(0, 0.16, 0.06, 0, Math.PI * 2);
      ctx.fill();
      // Green bottle
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(0.24, 0.22, 0.075, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawReef2D(rx: number, rz: number, radius: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 0.15;
    ctx.beginPath();
    ctx.arc(rx, rz, radius * 1.15, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(rx, rz, radius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(rx - radius * 0.2, rz - radius * 0.2, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawFisherman2D(f: IslandFisherman2D) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(f.worldX, f.worldZ);

    const bob = Math.sin(this.worldTime * 2 + f.phase) * 0.08;
    // Yellow slicker shoulders + Sou'wester hat
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.34, 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#a16207';
    ctx.beginPath();
    ctx.arc(0, 0, 0.26, 0, Math.PI * 2);
    ctx.fill();

    // Fishing rod & red bobber
    const rodAngle = Math.atan2(-f.worldZ, -f.worldX);
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const tipX = Math.cos(rodAngle) * (2.1 + bob);
    const tipZ = Math.sin(rodAngle) * (2.1 + bob);
    ctx.lineTo(tipX, tipZ);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(tipX, tipZ, 0.11, 0, Math.PI * 2);
    ctx.fill();

    // Floating 2D speech bubble above fisherman
    if (f.shoutTimer > 0 && f.shoutText) {
      const alpha = f.shoutTimer < 0.65 ? f.shoutTimer / 0.65 : 1;
      ctx.globalAlpha = alpha;
      ctx.font = '600 0.5px system-ui, sans-serif';
      const label = f.shoutText.length > 44 ? `${f.shoutText.slice(0, 42)}…` : f.shoutText;
      const boxW = Math.min(11, Math.max(5.5, label.length * 0.26));
      const boxH = 1.45;
      ctx.fillStyle = 'rgba(7, 15, 25, 0.92)';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -2.35, boxW, boxH, 0.25);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.font = 'bold 0.42px system-ui, sans-serif';
      ctx.fillText(f.speaker, 0, -1.8);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 0.42px system-ui, sans-serif';
      ctx.fillText(label, 0, -1.22);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private drawBoat2D() {
    const ctx = this.ctx;
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 18) % 2 === 0 && this.dashTimer <= 0) {
      return;
    }

    // Lantern cone beam in aim direction
    ctx.save();
    ctx.translate(this.boatX, this.boatZ);
    ctx.rotate(-this.aimYaw + Math.PI / 2);
    const beamLen = 11 + this.upgradeLevels.lantern_crit * 2.2;
    const beamGrad = ctx.createRadialGradient(0, 0, 0.8, 0, 0, beamLen);
    beamGrad.addColorStop(0, 'rgba(253, 224, 71, 0.34)');
    beamGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, beamLen, -0.38, 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Boat hull
    ctx.save();
    ctx.translate(this.boatX, this.boatZ);
    ctx.rotate(-this.boatYaw + Math.PI / 2);

    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 0.11;
    ctx.beginPath();
    ctx.moveTo(1.55, 0);
    ctx.quadraticCurveTo(0.8, 0.78, -1.25, 0.65);
    ctx.lineTo(-1.35, -0.65);
    ctx.quadraticCurveTo(0.8, -0.78, 1.55, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Baron Sasha inside boat (fur coat + golden cap)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-0.15, 0, 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(-0.1, 0, 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Aimable Harpoon Turret
    ctx.save();
    ctx.translate(this.boatX, this.boatZ);
    ctx.rotate(-this.aimYaw + Math.PI / 2);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0.2 - this.recoil, -0.1, 1.15, 0.2);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(1.5 - this.recoil, 0);
    ctx.lineTo(1.18 - this.recoil, 0.2);
    ctx.lineTo(1.18 - this.recoil, -0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawMonster2D(m: Monster2D) {
    const ctx = this.ctx;

    // Telegraph lunge line for Pike, Karas & Leviathan (and electric charge halo for Eel)
    if (m.kind === 'eel' && m.telegraphTimer > 0) {
      ctx.save();
      ctx.translate(m.x, m.z);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      const sparks = 10;
      for (let k = 0; k <= sparks; k++) {
        const a = (k / sparks) * Math.PI * 2;
        const rr = m.radius * (1.45 + (k % 2 === 0 ? 0.5 : -0.15) + Math.sin(this.worldTime * 35 + k) * 0.2);
        const px = Math.cos(a) * rr;
        const pz = Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(px, pz);
        else ctx.lineTo(px, pz);
      }
      ctx.stroke();
      ctx.restore();
    } else if (m.telegraphTimer > 0) {
      ctx.save();
      ctx.translate(m.x, m.z);
      ctx.rotate(-m.telegraphYaw + Math.PI / 2);
      ctx.strokeStyle = m.kind === 'karas' ? 'rgba(249, 115, 22, 0.72)' : 'rgba(239, 68, 68, 0.72)';
      ctx.lineWidth = 0.18;
      ctx.setLineDash([0.5, 0.35]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(14, 0);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    const jumpScale = 1 + m.jumpY * 0.08;
    ctx.translate(m.x, m.z - m.jumpY * 0.22);
    ctx.rotate(-m.yaw + Math.PI / 2);
    ctx.scale(jumpScale, jumpScale);

    const flash = m.hitFlash > 0;
    const wag = Math.sin(m.swimPhase) * 0.24;

    let bodyColor = '#166534';
    let accentColor = '#facc15';
    if (m.kind === 'catfish') {
      bodyColor = '#3f3f46';
      accentColor = '#a1a1aa';
    } else if (m.kind === 'ersh') {
      bodyColor = '#65a30d';
      accentColor = '#fef08a';
    } else if (m.kind === 'lin') {
      bodyColor = '#15803d';
      accentColor = '#a3e635';
    } else if (m.kind === 'peskar') {
      bodyColor = '#d97706';
      accentColor = '#fde68a';
    } else if (m.kind === 'karas') {
      bodyColor = '#b45309';
      accentColor = '#fb923c';
    } else if (m.kind === 'eel') {
      bodyColor = '#0f766e';
      accentColor = '#38bdf8';
    } else if (m.kind === 'puffer') {
      bodyColor = '#7e22ce';
      accentColor = '#e879f9';
    } else if (m.kind === 'minnow') {
      bodyColor = '#b91c1c';
      accentColor = '#fca5a5';
    } else if (m.kind === 'croc_gena') {
      bodyColor = '#16a34a';
      accentColor = '#dc2626';
    } else if (m.kind === 'leviathan') {
      bodyColor = '#064e3b';
      accentColor = '#34d399';
    }

    // Tail fin
    ctx.fillStyle = flash ? '#ffffff' : accentColor;
    ctx.beginPath();
    ctx.moveTo(-m.radius * 0.7, 0);
    ctx.lineTo(-m.radius * 1.45, -m.radius * 0.55 + wag * m.radius);
    ctx.lineTo(-m.radius * 1.45, m.radius * 0.55 + wag * m.radius);
    ctx.closePath();
    ctx.fill();

    // Main body
    ctx.fillStyle = flash ? '#ffffff' : bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, m.radius, m.radius * (m.kind === 'eel' ? 0.42 : 0.68), 0, 0, Math.PI * 2);
    ctx.fill();

    // Species signature details: fin-ray spines, aposematic venom glands & electric organs
    if (m.kind === 'ersh' || m.kind === 'puffer') {
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 0.11;
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * m.radius * 0.68, Math.sin(a) * m.radius * 0.5);
        ctx.lineTo(Math.cos(a) * m.radius * 1.32, Math.sin(a) * m.radius * 1.08);
        ctx.stroke();

        // Glowing venom gland sacs at spine bases
        ctx.fillStyle = m.kind === 'puffer' ? '#d946ef' : '#a855f7';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * m.radius * 0.72, Math.sin(a) * m.radius * 0.52, m.radius * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (m.kind === 'lin') {
      // Bright warning lime stripe + glowing venom glands on cheeks
      ctx.fillStyle = '#bef264';
      ctx.fillRect(-m.radius * 0.5, -m.radius * 0.11, m.radius * 0.95, m.radius * 0.22);
      ctx.beginPath();
      ctx.arc(m.radius * 0.22, -m.radius * 0.52, m.radius * 0.16, 0, Math.PI * 2);
      ctx.arc(m.radius * 0.22, m.radius * 0.52, m.radius * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else if (m.kind === 'eel') {
      // Bio-electric cyan organ rings along body
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 0.12;
      for (const ox of [-0.45, -0.1, 0.25]) {
        ctx.beginPath();
        ctx.moveTo(m.radius * ox, -m.radius * 0.36);
        ctx.lineTo(m.radius * ox, m.radius * 0.36);
        ctx.stroke();
      }
    } else if (m.kind === 'pike' || m.kind === 'karas') {
      // Rigid dorsal/pectoral fin-ray spines
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 0.1;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(m.radius * 0.1, side * m.radius * 0.5);
        ctx.lineTo(-m.radius * 0.2, side * m.radius * 1.15);
        ctx.stroke();
      }
      if (m.kind === 'karas') {
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(m.radius * 0.62, 0, m.radius * 0.42, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
      }
    } else if (m.kind === 'croc_gena') {
      // Red coat & hat
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(-m.radius * 0.35, -m.radius * 0.52, m.radius * 0.85, m.radius * 1.04);
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(m.radius * 0.25, 0, m.radius * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }

    // Unique Predator Eye Color per species
    ctx.fillStyle = MONSTER_EYE_COLORS[m.kind];
    ctx.beginPath();
    ctx.arc(m.radius * 0.52, -m.radius * 0.26, m.radius * 0.15, 0, Math.PI * 2);
    ctx.arc(m.radius * 0.52, m.radius * 0.26, m.radius * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Small overhead HP bar when damaged (not boss)
    if (m.hp < m.maxHp && m.kind !== 'leviathan') {
      const bw = m.radius * 1.8;
      const ratio = clamp(m.hp / m.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(m.x - bw / 2, m.z - m.radius - 0.65, bw, 0.22);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(m.x - bw / 2, m.z - m.radius - 0.65, bw * ratio, 0.22);
    }
  }

  private drawProjectile2D(p: Projectile2D) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(p.x, p.z);
    if (p.fromPlayer) {
      ctx.rotate(-p.yaw + Math.PI / 2);
      ctx.fillStyle = p.isCrit ? '#fbbf24' : '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(0.55, 0);
      ctx.lineTo(-0.35, 0.16);
      ctx.lineTo(-0.35, -0.16);
      ctx.closePath();
      ctx.fill();
    } else if (p.isBitcoin) {
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(0, 0, 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 0.48px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('₿', 0, 0.03);
    } else {
      ctx.fillStyle = p.isSlime ? '#4ade80' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPickup2D(pk: Pickup2D) {
    const ctx = this.ctx;
    const bob = Math.sin(pk.bobPhase) * 0.12;
    ctx.save();
    ctx.translate(pk.x, pk.z + bob);
    if (pk.kind === 'coin') {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, 0, 0.34, 0, Math.PI * 2);
      ctx.fill();
    } else if (pk.kind === 'bulba_heal') {
      // 1 Bulba red/pink oil-potato vial with emerald cross glow
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#fecaca';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(0, 0, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.08, -0.26, 0.16, 0.52);
      ctx.fillRect(-0.26, -0.08, 0.52, 0.16);
    } else if (pk.kind === 'garlic_overdrive') {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.arc(0, 0, 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.moveTo(0.55, 0);
      ctx.lineTo(-0.35, 0.32);
      ctx.lineTo(-0.35, -0.32);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
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
      poisonTimer: this.poisonTimer,
      stunTimer: this.stunTimer,
      bossName: boss ? boss.name : null,
      bossHp: boss ? boss.hp : 0,
      bossMaxHp: boss ? boss.maxHp : 0,
      waveBannerTimer: this.waveBannerTimer,
      waveBannerText: this.waveBannerText,
      eventBannerTimer: this.eventBannerTimer,
      eventBannerText: this.eventBannerText,
      weather: this.weather,
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
