export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'UPGRADE_SHOP' | 'GAME_OVER' | 'VICTORY';

export type RenderMode = '2d' | '3d';

export type CameraPreset = 'chase' | 'close' | 'tactical';

export type WeatherKind = 'clear' | 'mist' | 'rain' | 'storm';

export type Difficulty = 'calm' | 'hunt' | 'nightmare';

export type MonsterKind =
  | 'pike'
  | 'catfish'
  | 'eel'
  | 'puffer'
  | 'minnow'
  | 'ersh'
  | 'lin'
  | 'peskar'
  | 'karas'
  | 'leviathan'
  | 'croc_gena';

export type UpgradeId =
  | 'multishot'
  | 'heavy_harpoon'
  | 'rapid_loader'
  | 'reinforced_hull'
  | 'turboprop'
  | 'depth_charges'
  | 'lantern_crit';

export interface UpgradeOption {
  id: UpgradeId;
  title: string;
  description: string;
  cost: number;
  maxLevel: number;
  statLabel: string;
}

export interface PlayerStats {
  maxHp: number;
  hp: number;
  speed: number;
  damage: number;
  fireRate: number; // shots per second
  projectileCount: number;
  projectileSpeed: number;
  dashCooldown: number;
  depthCharges: number;
  maxDepthCharges: number;
  depthRadius: number;
  critChance: number;
  lanternRadius: number;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  score: number;
  highScore: number;
  coins: number;
  wave: number;
  monstersRemaining: number;
  monstersKilled: number;
  leviathansKilled: number;
  crocsKilled: number;
  killsByKind: Partial<Record<MonsterKind, number>>;
  harpoonDamage: number;
  combo: number;
  maxCombo: number;
  dashCooldownRatio: number; // 0 = ready, 1 = full cooldown
  dashReady: boolean;
  depthCharges: number;
  maxDepthCharges: number;
  overdriveTimer: number;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  waveBannerTimer: number;
  waveBannerText: string;
  eventBannerTimer: number;
  eventBannerText: string;
  weather: WeatherKind;
  tourName: string;
  tourBiome: string;
  totalTours: number;
  islandCount: number;
  npcShout: { speaker: string; text: string; timer: number } | null;
}

export interface BoatEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  aimAngle: number;
  radius: number;
  invulnTimer: number;
  dashTimer: number;
  dashCooldownTimer: number;
  recoil: number;
  wakeTimer: number;
}

export interface MonsterEntity {
  id: number;
  kind: MonsterKind;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
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
  telegraphAngle: number;
  isLunging: boolean;
  lungeTimer: number;
  shootCooldown: number;
  colorPrimary: string;
  colorSecondary: string;
  eyeColor: string;
}

export interface ProjectileEntity {
  id: number;
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  isCrit: boolean;
  pierce: number;
  hitIds: number[];
}

export interface ParticleEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'splash' | 'wake' | 'spark' | 'ring' | 'ink' | 'shockwave';
}

export interface PickupEntity {
  id: number;
  kind: 'coin' | 'bulba_heal' | 'garlic_overdrive' | 'harpoon_power';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  bobPhase: number;
  value: number;
}

export interface FloatingTextEntity {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface LakeObstacle {
  x: number;
  y: number;
  radius: number;
  kind: 'rock' | 'snag';
  rotation: number;
  points: { x: number; y: number }[];
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onWaveClear: (wave: number, coins: number) => void;
  onGameOver: (finalHud: HudSnapshot) => void;
  onVictory?: (finalHud: HudSnapshot) => void;
  onContextLost?: () => void;
}

export interface RunCarryoverState {
  difficulty: Difficulty;
  wave: number;
  score: number;
  coins: number;
  stats: PlayerStats;
  upgradeLevels: Record<UpgradeId, number>;
  monstersKilled: number;
  leviathansKilled: number;
  crocsKilled: number;
  killsByKind: Partial<Record<MonsterKind, number>>;
  maxCombo: number;
  weather: WeatherKind;
}

export interface BlackLakeEngine {
  startNewGame(difficulty: Difficulty): void;
  exportRunState(): RunCarryoverState;
  importRunState(state: RunCarryoverState, paused?: boolean): void;
  launchNextWave(): void;
  setPaused(paused: boolean): void;
  setAutoFire(enabled: boolean): void;
  cycleCameraPreset(): CameraPreset;
  getCameraPreset(): CameraPreset;
  cycleWeather(): WeatherKind;
  getUpgradeLevels(): Record<UpgradeId, number>;
  getCoins(): number;
  getStats(): PlayerStats;
  getUpgradePrice(id: UpgradeId): number;
  applyUpgrade(id: UpgradeId): boolean;
  repairBoatWithCoins(): boolean;
  handleKeyDown(code: string): void;
  handleKeyUp(code: string): void;
  handleMouseMove(clientX: number, clientY: number): void;
  handleMouseDown(button: number): void;
  handleMouseUp(button: number): void;
  setTouchMove(dx: number, dy: number): void;
  triggerDash(): void;
  triggerDepthCharge(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
