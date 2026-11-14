import { MonsterKind } from './types';

export type AchievementId =
  | 'first_catch'
  | 'clean_lake_40'
  | 'survive_5_waves'
  | 'slay_leviathan'
  | 'slay_croc_gena'
  | 'slay_new_trio'
  | 'combo_10'
  | 'score_5000'
  | 'abyss_hunter_150'
  | 'complete_20_tours';

export interface PlayerRecords {
  highScore: number;
  bestWave: number;
  totalMonstersKilled: number;
  bestRunKills: number;
  bestCombo: number;
  leviathansDefeated: number;
  crocsDefeated: number;
  defeatedByKind: Partial<Record<MonsterKind, number>>;
  unlocked: Partial<Record<AchievementId, string>>;
}

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  target: number;
  getValue: (records: PlayerRecords) => number;
}

const RECORDS_STORAGE_KEY = 'black_lake_sasha_records_v1';

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_catch',
    title: 'Первый улов',
    description: 'Уничтожить 10 монстров за один заплыв',
    target: 10,
    getValue: (r) => r.bestRunKills,
  },
  {
    id: 'clean_lake_40',
    title: 'Чистильщик озера',
    description: 'Уничтожить 40 монстров',
    target: 40,
    getValue: (r) => r.totalMonstersKilled,
  },
  {
    id: 'survive_5_waves',
    title: 'Стойкий барон',
    description: 'Продержаться 5 волн',
    target: 5,
    getValue: (r) => r.bestWave,
  },
  {
    id: 'slay_croc_gena',
    title: 'Антикрипто-барон',
    description: 'Победить злодейского крокодила Гену',
    target: 1,
    getValue: (r) => r.crocsDefeated,
  },
  {
    id: 'slay_leviathan',
    title: 'Укротитель бездны',
    description: 'Победить Левиафана Чёрного озера',
    target: 1,
    getValue: (r) => r.leviathansDefeated,
  },
  {
    id: 'slay_new_trio',
    title: 'Тройной улов',
    description: 'Победить Ержа Передрёша, Линя Жминя и Пескаря Натаскаря',
    target: 3,
    getValue: (r) =>
      ((r.defeatedByKind?.ersh ?? 0) > 0 ? 1 : 0) +
      ((r.defeatedByKind?.lin ?? 0) > 0 ? 1 : 0) +
      ((r.defeatedByKind?.peskar ?? 0) > 0 ? 1 : 0),
  },
  {
    id: 'combo_10',
    title: 'Точная рука',
    description: 'Набрать серию комбо x10',
    target: 10,
    getValue: (r) => r.bestCombo,
  },
  {
    id: 'score_5000',
    title: 'Гроза отмели',
    description: 'Набрать 5 000 очков за заплыв',
    target: 5000,
    getValue: (r) => r.highScore,
  },
  {
    id: 'abyss_hunter_150',
    title: 'Охотник ночи',
    description: 'Уничтожить 150 монстров всего',
    target: 150,
    getValue: (r) => r.totalMonstersKilled,
  },
  {
    id: 'complete_20_tours',
    title: 'Повелитель 20 туров',
    description: 'Пройти все 20 туров Чёрного озера',
    target: 20,
    getValue: (r) => r.bestWave,
  },
];

export function loadPlayerRecords(fallbackHighScore = 0): PlayerRecords {
  const empty: PlayerRecords = {
    highScore: fallbackHighScore,
    bestWave: 0,
    totalMonstersKilled: 0,
    bestRunKills: 0,
    bestCombo: 0,
    leviathansDefeated: 0,
    crocsDefeated: 0,
    defeatedByKind: {},
    unlocked: {},
  };
  try {
    const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<PlayerRecords>;
    const leviathansDefeated = Number(parsed.leviathansDefeated) || 0;
    const crocsDefeated = Number(parsed.crocsDefeated) || 0;
    const rawByKind =
      parsed.defeatedByKind && typeof parsed.defeatedByKind === 'object' ? parsed.defeatedByKind : {};
    const defeatedByKind: Partial<Record<MonsterKind, number>> = {};
    for (const [k, v] of Object.entries(rawByKind)) {
      const count = Number(v) || 0;
      if (count > 0) {
        defeatedByKind[k as MonsterKind] = count;
      }
    }
    if (leviathansDefeated > 0 && !defeatedByKind.leviathan) {
      defeatedByKind.leviathan = leviathansDefeated;
    }
    if (crocsDefeated > 0 && !defeatedByKind.croc_gena) {
      defeatedByKind.croc_gena = crocsDefeated;
    }
    return {
      highScore: Math.max(fallbackHighScore, Number(parsed.highScore) || 0),
      bestWave: Number(parsed.bestWave) || 0,
      totalMonstersKilled: Number(parsed.totalMonstersKilled) || 0,
      bestRunKills: Number(parsed.bestRunKills) || 0,
      bestCombo: Number(parsed.bestCombo) || 0,
      leviathansDefeated,
      crocsDefeated,
      defeatedByKind,
      unlocked: parsed.unlocked && typeof parsed.unlocked === 'object' ? parsed.unlocked : {},
    };
  } catch {
    return empty;
  }
}

export function savePlayerRecords(records: PlayerRecords): void {
  try {
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore storage quota errors
  }
}

export interface RunProgressDelta {
  score: number;
  wave: number;
  runKills: number;
  killsDelta: number;
  leviathansDelta: number;
  crocsDelta: number;
  killsByKindDelta?: Partial<Record<MonsterKind, number>>;
  maxCombo: number;
}

export function applyRunProgressToRecords(
  prev: PlayerRecords,
  delta: RunProgressDelta
): { next: PlayerRecords; newlyUnlocked: AchievementDefinition[] } {
  const defeatedByKind: Partial<Record<MonsterKind, number>> = { ...prev.defeatedByKind };
  if (delta.killsByKindDelta) {
    for (const [k, add] of Object.entries(delta.killsByKindDelta)) {
      const inc = Math.max(0, Number(add) || 0);
      if (inc > 0) {
        const kind = k as MonsterKind;
        defeatedByKind[kind] = (defeatedByKind[kind] ?? 0) + inc;
      }
    }
  }

  const next: PlayerRecords = {
    highScore: Math.max(prev.highScore, delta.score),
    bestWave: Math.max(prev.bestWave, delta.wave),
    totalMonstersKilled: prev.totalMonstersKilled + Math.max(0, delta.killsDelta),
    bestRunKills: Math.max(prev.bestRunKills, delta.runKills),
    bestCombo: Math.max(prev.bestCombo, delta.maxCombo),
    leviathansDefeated: prev.leviathansDefeated + Math.max(0, delta.leviathansDelta),
    crocsDefeated: prev.crocsDefeated + Math.max(0, delta.crocsDelta),
    defeatedByKind,
    unlocked: { ...prev.unlocked },
  };

  const newlyUnlocked: AchievementDefinition[] = [];
  const nowIso = new Date().toISOString();

  for (const ach of ACHIEVEMENTS) {
    if (!next.unlocked[ach.id] && ach.getValue(next) >= ach.target) {
      next.unlocked[ach.id] = nowIso;
      newlyUnlocked.push(ach);
    }
  }

  return { next, newlyUnlocked };
}
