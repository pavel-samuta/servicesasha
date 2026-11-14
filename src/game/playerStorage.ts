import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { ACHIEVEMENTS, AchievementId, PlayerRecords } from './achievements';
import { BASE_PLAYER_STATS, HIGH_SCORE_STORAGE_KEY } from './constants';
import {
  Difficulty,
  MonsterKind,
  PlayerStats,
  RenderMode,
  RunCarryoverState,
  UpgradeId,
  WeatherKind,
} from './types';

export interface SavedRunSnapshot extends RunCarryoverState {
  renderMode: RenderMode;
  savedAt: string;
}

export interface PlayerAccountSession {
  kind: 'cloud' | 'local' | 'guest';
  uid: string;
  username: string;
  authMode: 'password' | 'google' | 'guest';
  records: PlayerRecords;
  savedRun: SavedRunSnapshot | null;
}

export class ProviderDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderDisabledError';
  }
}

const VALID_MONSTER_KEYS: MonsterKind[] = [
  'pike',
  'catfish',
  'eel',
  'puffer',
  'minnow',
  'ersh',
  'lin',
  'peskar',
  'karas',
  'glass_ghost',
  'mirage_ray',
  'chrono_morok',
  'sky_jelly',
  'turtle_rift',
  'leviathan',
  'croc_gena',
];

const VALID_UPGRADE_KEYS: UpgradeId[] = [
  'multishot',
  'heavy_harpoon',
  'rapid_loader',
  'reinforced_hull',
  'turboprop',
  'depth_charges',
  'lantern_crit',
  'hull_insulation',
];

const VALID_ACHIEVEMENT_KEYS: AchievementId[] = ACHIEVEMENTS.map((a) => a.id);

const GUEST_RUN_STORAGE_KEY = 'black_lake_guest_saved_run_v1';
const LOCAL_PROFILES_KEY = 'black_lake_local_profiles_v1';
const ACTIVE_LOCAL_SESSION_KEY = 'black_lake_active_local_uid_v1';

interface LocalProfileRecord {
  uid: string;
  username: string;
  normalizedName: string;
  salt: string;
  passwordHash: string;
  records: PlayerRecords;
  savedRun: SavedRunSnapshot | null;
  updatedAt: string;
}

function clampInt(val: unknown, min: number, max: number, fallback = min): number {
  const n = Math.round(Number(val));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampNum(val: unknown, min: number, max: number, fallback = min): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function createEmptyRecords(fallbackHigh = 0): PlayerRecords {
  return {
    highScore: clampInt(fallbackHigh, 0, 1000000000, 0),
    bestWave: 0,
    totalMonstersKilled: 0,
    bestRunKills: 0,
    bestCombo: 0,
    leviathansDefeated: 0,
    crocsDefeated: 0,
    defeatedByKind: {},
    unlocked: {},
  };
}

function sanitizeMonsterMap(raw: unknown): Partial<Record<MonsterKind, number>> {
  const out: Partial<Record<MonsterKind, number>> = {};
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  for (const key of VALID_MONSTER_KEYS) {
    if (key in obj) {
      const count = clampInt(obj[key], 0, 10000000, 0);
      if (count > 0) out[key] = count;
    }
  }
  return out;
}

function sanitizeUnlockedMap(raw: unknown): Partial<Record<AchievementId, string>> {
  const out: Partial<Record<AchievementId, string>> = {};
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  for (const key of VALID_ACHIEVEMENT_KEYS) {
    const v = obj[key];
    if (typeof v === 'string' && v.length > 0 && v.length <= 40) {
      out[key] = v;
    }
  }
  return out;
}

function sanitizeStats(raw: unknown): PlayerStats {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    maxHp: clampNum(s.maxHp, 1, 10000, BASE_PLAYER_STATS.maxHp),
    hp: clampNum(s.hp, 0, 10000, BASE_PLAYER_STATS.hp),
    speed: clampNum(s.speed, 50, 2000, BASE_PLAYER_STATS.speed),
    damage: clampNum(s.damage, 1, 10000, BASE_PLAYER_STATS.damage),
    fireRate: clampNum(s.fireRate, 0.2, 50, BASE_PLAYER_STATS.fireRate),
    projectileCount: clampInt(s.projectileCount, 1, 20, BASE_PLAYER_STATS.projectileCount),
    projectileSpeed: clampNum(s.projectileSpeed, 100, 3000, BASE_PLAYER_STATS.projectileSpeed),
    dashCooldown: clampNum(s.dashCooldown, 0.2, 30, BASE_PLAYER_STATS.dashCooldown),
    depthCharges: clampInt(s.depthCharges, 0, 50, BASE_PLAYER_STATS.depthCharges),
    maxDepthCharges: clampInt(s.maxDepthCharges, 1, 50, BASE_PLAYER_STATS.maxDepthCharges),
    depthRadius: clampNum(s.depthRadius, 50, 2000, BASE_PLAYER_STATS.depthRadius),
    critChance: clampNum(s.critChance, 0, 1, BASE_PLAYER_STATS.critChance),
    lanternRadius: clampNum(s.lanternRadius, 50, 2000, BASE_PLAYER_STATS.lanternRadius),
  };
}

function sanitizeUpgradeLevels(raw: unknown): Record<UpgradeId, number> {
  const u = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Record<UpgradeId, number> = {
    multishot: 0,
    heavy_harpoon: 0,
    rapid_loader: 0,
    reinforced_hull: 0,
    turboprop: 0,
    depth_charges: 0,
    lantern_crit: 0,
    hull_insulation: 0,
  };
  for (const key of VALID_UPGRADE_KEYS) {
    out[key] = clampInt(u[key], 0, 10, 0);
  }
  return out;
}

export function sanitizeSavedRun(raw: unknown): SavedRunSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const diff: Difficulty =
    r.difficulty === 'calm' || r.difficulty === 'hunt' || r.difficulty === 'nightmare'
      ? r.difficulty
      : 'hunt';
  const renderMode: RenderMode = r.renderMode === '2d' || r.renderMode === '3d' ? r.renderMode : '3d';
  const weather: WeatherKind =
    r.weather === 'clear' || r.weather === 'mist' || r.weather === 'rain' || r.weather === 'storm'
      ? r.weather
      : 'clear';
  const savedAt =
    typeof r.savedAt === 'string' && r.savedAt.length >= 10 && r.savedAt.length <= 40
      ? r.savedAt
      : new Date().toISOString();

  return {
    difficulty: diff,
    renderMode,
    wave: clampInt(r.wave, 1, 20, 1),
    score: clampInt(r.score, 0, 1000000000, 0),
    coins: clampInt(r.coins, 0, 10000000, 0),
    weather,
    monstersKilled: clampInt(r.monstersKilled, 0, 10000000, 0),
    leviathansKilled: clampInt(r.leviathansKilled, 0, 1000000, 0),
    crocsKilled: clampInt(r.crocsKilled, 0, 1000000, 0),
    maxCombo: clampInt(r.maxCombo, 0, 100000, 0),
    stats: sanitizeStats(r.stats),
    upgradeLevels: sanitizeUpgradeLevels(r.upgradeLevels),
    killsByKind: sanitizeMonsterMap(r.killsByKind),
    savedAt,
  };
}

export function sanitizeRecords(raw: unknown, fallbackHigh = 0): PlayerRecords {
  if (!raw || typeof raw !== 'object') return createEmptyRecords(fallbackHigh);
  const p = raw as Record<string, unknown>;
  const leviathansDefeated = clampInt(p.leviathansDefeated, 0, 1000000, 0);
  const crocsDefeated = clampInt(p.crocsDefeated, 0, 1000000, 0);
  const defeatedByKind = sanitizeMonsterMap(p.defeatedByKind);
  if (leviathansDefeated > 0 && !defeatedByKind.leviathan) {
    defeatedByKind.leviathan = leviathansDefeated;
  }
  if (crocsDefeated > 0 && !defeatedByKind.croc_gena) {
    defeatedByKind.croc_gena = crocsDefeated;
  }

  return {
    highScore: Math.max(fallbackHigh, clampInt(p.highScore, 0, 1000000000, 0)),
    bestWave: clampInt(p.bestWave, 0, 20, 0),
    totalMonstersKilled: clampInt(p.totalMonstersKilled, 0, 100000000, 0),
    bestRunKills: clampInt(p.bestRunKills, 0, 10000000, 0),
    bestCombo: clampInt(p.bestCombo, 0, 100000, 0),
    leviathansDefeated,
    crocsDefeated,
    defeatedByKind,
    unlocked: sanitizeUnlockedMap(p.unlocked),
  };
}

export function normalizePlayerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function validatePlayerCredentials(username: string, password: string): string | null {
  const clean = normalizePlayerName(username);
  if (clean.length < 2 || clean.length > 32) {
    return 'Имя игрока должно содержать от 2 до 32 символов.';
  }
  if (password.length < 6) {
    return 'Пароль должен содержать минимум 6 символов.';
  }
  return null;
}

/**
 * Deterministically maps any Cyrillic or Latin player name to a valid RFC email
 * for Firebase Email/Password authentication without collisions.
 */
function usernameToAuthEmail(username: string): string {
  const normalized = normalizePlayerName(username).toLowerCase();
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + i * 31;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `player_${hex1}${hex2}@players.blacklake.game`;
}

async function hashPasswordSha256(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}::${password}`);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let acc = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    acc ^= data[i];
    acc = Math.imul(acc, 0x01000193);
  }
  return (acc >>> 0).toString(16);
}

function loadLocalProfilesMap(): Record<string, LocalProfileRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LocalProfileRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalProfilesMap(map: Record<string, LocalProfileRecord>): void {
  try {
    localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

export function loadGuestSavedRun(): SavedRunSnapshot | null {
  try {
    const raw = localStorage.getItem(GUEST_RUN_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeSavedRun(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveGuestSavedRun(run: SavedRunSnapshot | null): void {
  try {
    if (run) {
      localStorage.setItem(GUEST_RUN_STORAGE_KEY, JSON.stringify(run));
    } else {
      localStorage.removeItem(GUEST_RUN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function getGuestFallbackHighScore(): number {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function restoreActiveLocalSession(): PlayerAccountSession | null {
  try {
    const uid = localStorage.getItem(ACTIVE_LOCAL_SESSION_KEY);
    if (!uid) return null;
    const map = loadLocalProfilesMap();
    const rec = map[uid];
    if (!rec) return null;
    return {
      kind: 'local',
      uid: rec.uid,
      username: rec.username,
      authMode: 'password',
      records: sanitizeRecords(rec.records),
      savedRun: sanitizeSavedRun(rec.savedRun),
    };
  } catch {
    return null;
  }
}

function buildFirestorePayload(
  uid: string,
  username: string,
  authMode: 'password' | 'google',
  records: PlayerRecords,
  savedRun: SavedRunSnapshot | null,
  isCreate: boolean
) {
  const cleanRecords = sanitizeRecords(records);
  const cleanRun = savedRun ? sanitizeSavedRun(savedRun) : null;
  const safeName = normalizePlayerName(username).slice(0, 32) || 'Барон Саша';
  const base = {
    uid,
    username: safeName.length >= 2 ? safeName : 'Саша',
    authMode,
    highScore: cleanRecords.highScore,
    bestWave: cleanRecords.bestWave,
    totalMonstersKilled: cleanRecords.totalMonstersKilled,
    bestRunKills: cleanRecords.bestRunKills,
    bestCombo: cleanRecords.bestCombo,
    leviathansDefeated: cleanRecords.leviathansDefeated,
    crocsDefeated: cleanRecords.crocsDefeated,
    defeatedByKind: cleanRecords.defeatedByKind,
    unlocked: cleanRecords.unlocked,
    hasSavedRun: cleanRun !== null,
    savedRun: cleanRun,
    updatedAt: serverTimestamp(),
  };
  return isCreate ? { ...base, createdAt: serverTimestamp() } : base;
}

function translateFirebaseAuthError(err: unknown): Error {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';

  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
    return new ProviderDisabledError(
      'Провайдер «Email/Password» ещё не включён в Firebase Console (Authentication → Sign-in method → Email/Password → Enable). Включите его в консоли или используйте вход через Google / локальный профиль.'
    );
  }
  if (code === 'auth/email-already-in-use') {
    return new Error('Игрок с таким именем уже существует. Переключитесь на вкладку «Войти».');
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return new Error('Неверное имя игрока или пароль.');
  }
  if (code === 'auth/weak-password') {
    return new Error('Пароль слишком короткий — минимум 6 символов.');
  }
  if (code === 'auth/too-many-requests') {
    return new Error('Слишком много попыток входа. Подождите минуту.');
  }
  if (code === 'auth/popup-closed-by-user') {
    return new Error('Окно входа через Google было закрыто.');
  }
  if (code === 'auth/network-request-failed') {
    return new Error('Нет связи с сервером Firebase. Проверьте интернет.');
  }
  return err instanceof Error ? err : new Error('Ошибка авторизации.');
}

async function fetchOrCreateCloudProfile(
  user: User,
  fallbackName: string,
  authMode: 'password' | 'google'
): Promise<PlayerAccountSession> {
  const path = `players/${user.uid}`;
  const docRef = doc(db, 'players', user.uid);
  let snap;
  try {
    snap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (snap && snap.exists()) {
    const data = snap.data() as Record<string, unknown>;
    const username =
      typeof data.username === 'string' && data.username.trim().length >= 2
        ? data.username
        : fallbackName;
    const records = sanitizeRecords(data);
    const savedRun = data.hasSavedRun === true ? sanitizeSavedRun(data.savedRun) : null;
    const mode: 'password' | 'google' =
      data.authMode === 'google' || data.authMode === 'password' ? data.authMode : authMode;
    return {
      kind: 'cloud',
      uid: user.uid,
      username,
      authMode: mode,
      records,
      savedRun,
    };
  }

  const cleanName = normalizePlayerName(fallbackName).slice(0, 32) || 'Барон Саша';
  const emptyRecords = createEmptyRecords(0);
  const createPayload = buildFirestorePayload(user.uid, cleanName, authMode, emptyRecords, null, true);

  try {
    await setDoc(docRef, createPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return {
    kind: 'cloud',
    uid: user.uid,
    username: cleanName.length >= 2 ? cleanName : 'Саша',
    authMode,
    records: emptyRecords,
    savedRun: null,
  };
}

export async function registerCloudPlayer(
  username: string,
  password: string
): Promise<PlayerAccountSession> {
  const validationError = validatePlayerCredentials(username, password);
  if (validationError) throw new Error(validationError);

  const cleanName = normalizePlayerName(username);
  const email = usernameToAuthEmail(cleanName);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: cleanName }).catch(() => undefined);
    try {
      localStorage.removeItem(ACTIVE_LOCAL_SESSION_KEY);
    } catch {
      // ignore
    }
    return await fetchOrCreateCloudProfile(cred.user, cleanName, 'password');
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('{"error":')) throw err;
    throw translateFirebaseAuthError(err);
  }
}

export async function loginCloudPlayer(
  username: string,
  password: string
): Promise<PlayerAccountSession> {
  const validationError = validatePlayerCredentials(username, password);
  if (validationError) throw new Error(validationError);

  const cleanName = normalizePlayerName(username);
  const email = usernameToAuthEmail(cleanName);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    try {
      localStorage.removeItem(ACTIVE_LOCAL_SESSION_KEY);
    } catch {
      // ignore
    }
    return await fetchOrCreateCloudProfile(
      cred.user,
      cred.user.displayName || cleanName,
      'password'
    );
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('{"error":')) throw err;
    throw translateFirebaseAuthError(err);
  }
}

export async function loginWithGooglePopup(): Promise<PlayerAccountSession> {
  try {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    try {
      localStorage.removeItem(ACTIVE_LOCAL_SESSION_KEY);
    } catch {
      // ignore
    }
    return await fetchOrCreateCloudProfile(
      cred.user,
      cred.user.displayName || 'Барон Саша',
      'google'
    );
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('{"error":')) throw err;
    throw translateFirebaseAuthError(err);
  }
}

export async function registerOrLoginLocalPlayer(
  username: string,
  password: string,
  mode: 'register' | 'login'
): Promise<PlayerAccountSession> {
  const validationError = validatePlayerCredentials(username, password);
  if (validationError) throw new Error(validationError);

  const cleanName = normalizePlayerName(username);
  const normalizedName = cleanName.toLowerCase();
  const map = loadLocalProfilesMap();
  const existing = Object.values(map).find((p) => p.normalizedName === normalizedName);

  if (mode === 'register') {
    if (existing) {
      throw new Error('Локальный профиль с таким именем уже существует. Нажмите «Войти».');
    }
    const uid = `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const salt = Math.random().toString(36).slice(2, 14);
    const passwordHash = await hashPasswordSha256(password, salt);
    const record: LocalProfileRecord = {
      uid,
      username: cleanName,
      normalizedName,
      salt,
      passwordHash,
      records: createEmptyRecords(0),
      savedRun: null,
      updatedAt: new Date().toISOString(),
    };
    map[uid] = record;
    saveLocalProfilesMap(map);
    try {
      localStorage.setItem(ACTIVE_LOCAL_SESSION_KEY, uid);
    } catch {
      // ignore
    }
    return {
      kind: 'local',
      uid,
      username: cleanName,
      authMode: 'password',
      records: record.records,
      savedRun: null,
    };
  }

  if (!existing) {
    throw new Error('Локальный профиль с таким именем не найден.');
  }
  const checkHash = await hashPasswordSha256(password, existing.salt);
  if (checkHash !== existing.passwordHash) {
    throw new Error('Неверное имя игрока или пароль.');
  }
  try {
    localStorage.setItem(ACTIVE_LOCAL_SESSION_KEY, existing.uid);
  } catch {
    // ignore
  }
  return {
    kind: 'local',
    uid: existing.uid,
    username: existing.username,
    authMode: 'password',
    records: sanitizeRecords(existing.records),
    savedRun: sanitizeSavedRun(existing.savedRun),
  };
}

export async function logoutPlayerAccount(): Promise<void> {
  try {
    localStorage.removeItem(ACTIVE_LOCAL_SESSION_KEY);
  } catch {
    // ignore
  }
  if (auth.currentUser) {
    await signOut(auth);
  }
}

export async function syncCloudPlayerMemory(
  session: PlayerAccountSession,
  records: PlayerRecords,
  savedRun: SavedRunSnapshot | null
): Promise<void> {
  if (session.kind === 'cloud') {
    const user = auth.currentUser;
    if (!user || user.uid !== session.uid) return;
    const path = `players/${user.uid}`;
    const docRef = doc(db, 'players', user.uid);
    const authMode = session.authMode === 'google' ? 'google' : 'password';
    const updatePayload = buildFirestorePayload(
      user.uid,
      session.username,
      authMode,
      records,
      savedRun,
      false
    );
    try {
      await updateDoc(docRef, updatePayload);
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      if (code === 'not-found') {
        try {
          const createPayload = buildFirestorePayload(
            user.uid,
            session.username,
            authMode,
            records,
            savedRun,
            true
          );
          await setDoc(docRef, createPayload);
          return;
        } catch (createErr) {
          handleFirestoreError(createErr, OperationType.CREATE, path);
        }
      }
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return;
  }

  if (session.kind === 'local') {
    const map = loadLocalProfilesMap();
    const rec = map[session.uid];
    if (!rec) return;
    rec.records = sanitizeRecords(records);
    rec.savedRun = savedRun ? sanitizeSavedRun(savedRun) : null;
    rec.updatedAt = new Date().toISOString();
    map[session.uid] = rec;
    saveLocalProfilesMap(map);
  }
}

export function subscribeFirebasePlayerAuth(
  onUserSession: (session: PlayerAccountSession | null, authReady: boolean) => void
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      onUserSession(null, true);
      return;
    }
    const providerId = user.providerData?.[0]?.providerId;
    const authMode: 'password' | 'google' = providerId === 'google.com' ? 'google' : 'password';
    try {
      const session = await fetchOrCreateCloudProfile(
        user,
        user.displayName || 'Барон Саша',
        authMode
      );
      onUserSession(session, true);
    } catch (err) {
      console.error('Failed loading cloud player profile:', err);
      onUserSession(null, true);
    }
  });
}

// Re-export Timestamp type reference check
export type { Timestamp };
