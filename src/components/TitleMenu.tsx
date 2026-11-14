import { useState } from 'react';
import { Anchor, Award, BookOpen, Box, CheckCircle2, Cloud, Compass, HardDrive, Layers, Lock, Play, RotateCcw, Trophy, User } from 'lucide-react';
import { ACHIEVEMENTS, PlayerRecords } from '../game/achievements';
import {
  BESTIARY_ENTRIES,
  DIFFICULTIES,
  HERO_ART_PATH,
  HERO_TITLE,
} from '../game/constants';
import { PlayerAccountSession, SavedRunSnapshot } from '../game/playerStorage';
import { TOTAL_TOURS } from '../game/tours';
import { Difficulty, MonsterKind, RenderMode } from '../game/types';
import { BestiarySection } from './BestiarySection';

interface TitleMenuProps {
  difficulty: Difficulty;
  renderMode: RenderMode;
  records: PlayerRecords;
  playerSession: PlayerAccountSession | null;
  savedRun: SavedRunSnapshot | null;
  onSelectDifficulty: (d: Difficulty) => void;
  onSelectRenderMode: (mode: RenderMode) => void;
  onStartGame: () => void;
  onContinueSavedRun: () => void;
  onOpenAccountModal: () => void;
}

type MenuTab = 'overview' | 'bestiary';

export function TitleMenu({
  difficulty,
  renderMode,
  records,
  playerSession,
  savedRun,
  onSelectDifficulty,
  onSelectRenderMode,
  onStartGame,
  onContinueSavedRun,
  onOpenAccountModal,
}: TitleMenuProps) {
  const [activeTab, setActiveTab] = useState<MenuTab>('overview');
  const [selectedBestiaryKind, setSelectedBestiaryKind] = useState<MonsterKind | null>(null);
  const [heroImgError, setHeroImgError] = useState(false);
  const [failedPortraits, setFailedPortraits] = useState<Record<string, boolean>>({});

  const unlockedCount = ACHIEVEMENTS.filter((a) => Boolean(records.unlocked[a.id])).length;
  const bestiaryUnlockedCount = BESTIARY_ENTRIES.filter(
    (entry) => (records.defeatedByKind?.[entry.kind] ?? 0) > 0
  ).length;

  const openBestiary = (kind?: MonsterKind) => {
    if (kind) {
      setSelectedBestiaryKind(kind);
    }
    setActiveTab('bestiary');
  };

  return (
    <div className="relative flex h-dvh w-full flex-col justify-between overflow-y-auto bg-[#060C12] text-slate-100">
      {/* Subtle Top Bar with Section Tabs */}
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-b border-slate-200/10 px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="font-display text-lg font-bold tracking-wide text-slate-100 whitespace-nowrap shrink-0">
            Чёрное озеро
          </span>

          <nav aria-label="Разделы главного меню" className="flex items-center gap-1 rounded-lg border border-slate-200/10 bg-[#0B1520] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Причал</span>
            </button>

            <button
              type="button"
              onClick={() => openBestiary()}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'bestiary'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Бестиарий</span>
              <span
                className={`ml-0.5 rounded px-1.5 py-0.5 font-mono-nums text-[10px] ${
                  activeTab === 'bestiary'
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-slate-800 text-amber-300'
                }`}
              >
                {bestiaryUnlockedCount}/{BESTIARY_ENTRIES.length}
              </span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
            <Trophy className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            <span>Рекорд:</span>
            <span className="font-mono-nums font-bold text-amber-300">
              {records.highScore.toLocaleString('ru-RU')}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenAccountModal}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200/15 bg-[#0B1520] px-3 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:border-amber-400/45 hover:text-amber-200 whitespace-nowrap shrink-0"
            title="Вход по имени и паролю для сохранения прогресса"
          >
            {playerSession ? (
              playerSession.kind === 'cloud' ? (
                <Cloud className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
              ) : (
                <HardDrive className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
              )
            ) : (
              <User className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
            )}
            <span className="max-w-[140px] truncate">
              {playerSession ? playerSession.username : 'Войти / Профиль'}
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-8">
        {activeTab === 'bestiary' ? (
          <BestiarySection
            records={records}
            initialKind={selectedBestiaryKind}
            onStartGame={onStartGame}
          />
        ) : (
          <>
            {/* Main Hero & Briefing Split */}
            <div className="grid w-full grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
              {/* Left Column: Title, Premise, Difficulty, Start CTA */}
              <section className="flex flex-col justify-between gap-6 lg:col-span-5">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-amber-300/90">
                    <span>{renderMode === '2d' ? '2D-бой на воде' : '3D-бой на воде'}</span>
                    <span aria-hidden="true" className="text-slate-500">·</span>
                    <span>{HERO_TITLE}</span>
                    <span aria-hidden="true" className="text-slate-500">·</span>
                    <span>20 туров и боссы</span>
                  </div>

                  <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-slate-50 sm:text-4xl lg:text-[2.6rem] text-balance">
                    {HERO_TITLE}: Герой в лодке
                  </h1>

                  <p className="text-sm leading-relaxed text-slate-300 sm:text-base max-w-[56ch]">
                    Ведите позолоченную лодку Барона Саши по ночным волнам, наводите турель с прожектором
                    и отбивайте атаки рыб, Левиафана и Крокодила Гены, палящего биткоинами из леса.
                  </p>

                  <p className="text-xs leading-relaxed text-slate-400 border-t border-slate-200/10 pt-3">
                    <span className="font-semibold text-slate-200">Подарки на воде:</span>{' '}
                    1 Бульба (+25 HP) · Чеснок (Форсаж и волна отброса) · Сила гарпуна (+4 урона)
                  </p>
                </div>

                {/* 2D / 3D Graphics Mode Selector */}
                <div className="space-y-2.5 border-t border-slate-200/10 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">Режим графики</span>
                    <span className="text-slate-400">
                      {renderMode === '2d' ? 'Классический вид сверху' : 'Объёмная 3D-графика'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200/10 bg-[#0B1520] p-1">
                    <button
                      type="button"
                      onClick={() => onSelectRenderMode('2d')}
                      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap ${
                        renderMode === '2d'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>2D Вид сверху</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectRenderMode('3d')}
                      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap ${
                        renderMode === '3d'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      <Box className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>3D Объёмный</span>
                    </button>
                  </div>
                </div>

                {/* Difficulty Selector */}
                <div className="space-y-3 border-t border-slate-200/10 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">Сложность воды</span>
                    <span className="text-slate-400">{DIFFICULTIES[difficulty].subtitle}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#0B1520] p-1 border border-slate-200/10">
                    {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => {
                      const item = DIFFICULTIES[key];
                      const active = difficulty === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => onSelectDifficulty(key)}
                          className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap ${
                            active
                              ? 'bg-amber-500 text-slate-950 shadow-sm'
                              : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Controls Summary */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-200/10 pt-5 text-xs text-slate-300">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Ход лодки</span>
                    <span className="font-mono-nums font-semibold text-slate-100">WASD / Стрелки</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Прицел и огонь</span>
                    <span className="font-mono-nums font-semibold text-slate-100">Мышь + ЛКМ</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Рывок на моторе</span>
                    <span className="font-mono-nums font-semibold text-slate-100">Пробел / ПКМ</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Заряд и камера</span>
                    <span className="font-mono-nums font-semibold text-slate-100">E · V</span>
                  </div>
                </div>

                {/* Primary Actions */}
                <div className="flex flex-col gap-2.5 pt-2">
                  {savedRun && (
                    <button
                      type="button"
                      onClick={onContinueSavedRun}
                      className="inline-flex w-full items-center justify-between gap-3 rounded-lg bg-amber-500 px-5 py-3.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                    >
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <Play className="h-4 w-4 fill-slate-950" aria-hidden="true" />
                        <span>Продолжить тур {savedRun.wave}/{TOTAL_TOURS}</span>
                      </span>
                      <span className="font-mono-nums text-xs font-semibold text-slate-900 whitespace-nowrap">
                        Счёт {savedRun.score.toLocaleString('ru-RU')} · {savedRun.renderMode.toUpperCase()}
                      </span>
                    </button>
                  )}

                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <button
                      type="button"
                      onClick={onStartGame}
                      className={`inline-flex flex-1 items-center justify-center gap-2.5 rounded-lg px-6 py-3.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 whitespace-nowrap ${
                        savedRun
                          ? 'border border-slate-200/15 bg-[#0B1520] text-slate-100 hover:border-amber-400/40 hover:bg-[#0F1E2E]'
                          : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      }`}
                    >
                      {savedRun ? (
                        <RotateCcw className="h-4 w-4 text-amber-400" aria-hidden="true" />
                      ) : (
                        <Play className="h-4 w-4 fill-slate-950" aria-hidden="true" />
                      )}
                      <span>{savedRun ? 'Начать заново' : 'Начать игру'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openBestiary()}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200/15 bg-[#0B1520] px-4 py-3.5 text-sm font-semibold text-slate-100 transition-colors hover:border-amber-400/40 hover:bg-[#0F1E2E] focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap"
                    >
                      <BookOpen className="h-4 w-4 text-amber-400" aria-hidden="true" />
                      <span>Бестиарий ({bestiaryUnlockedCount}/{BESTIARY_ENTRIES.length})</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Right Column: Hero Key Art + Bestiary Strip */}
              <section className="flex flex-col justify-between gap-5 lg:col-span-7">
                <div className="relative flex-1 overflow-hidden rounded-lg border border-slate-200/12 bg-[#0B1520] min-h-[240px]">
                  {!heroImgError ? (
                    <img
                      src={HERO_ART_PATH}
                      alt="Саша плывёт на моторной лодке с фонарём по ночному Чёрному озеру"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgError(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#0B1520] via-[#0F1E2E] to-[#060C12] p-8 text-center">
                      <Anchor className="h-10 w-10 text-amber-400" aria-hidden="true" />
                      <span className="font-display text-xl font-semibold text-slate-200">Чёрное озеро</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060C12]/90 via-[#060C12]/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-amber-300">Сектор · Северная отмель</p>
                      <p className="text-sm font-semibold text-slate-100">
                        Катер {HERO_TITLE} готов к выходу на глубину
                      </p>
                    </div>
                  </div>
                </div>

                {/* Monster Fish & Croc Quick Bestiary Preview */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">
                      Бестиарий озера · изучено {bestiaryUnlockedCount}/{BESTIARY_ENTRIES.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => openBestiary()}
                      className="font-semibold text-amber-300 hover:text-amber-200 transition-colors"
                    >
                      Смотреть 3D-модели →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {BESTIARY_ENTRIES.filter((e) =>
                      ['pike', 'catfish', 'eel', 'croc_gena', 'leviathan'].includes(e.kind)
                    ).map((entry) => {
                      const kills = records.defeatedByKind?.[entry.kind] ?? 0;
                      const unlocked = kills > 0;
                      return (
                        <button
                          key={entry.kind}
                          type="button"
                          onClick={() => openBestiary(entry.kind)}
                          className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-amber-400/35 ${
                            unlocked
                              ? 'border-emerald-500/25 bg-[#0C191A]/85'
                              : 'border-slate-200/10 bg-[#0B1520]/85'
                          } ${entry.kind === 'leviathan' ? 'sm:col-span-2' : ''}`}
                        >
                          {entry.portrait && !failedPortraits[entry.kind] ? (
                            <img
                              src={entry.portrait}
                              alt={entry.name}
                              referrerPolicy="no-referrer"
                              onError={() => setFailedPortraits((prev) => ({ ...prev, [entry.kind]: true }))}
                              className={`h-14 w-14 shrink-0 rounded-md border border-slate-200/15 object-cover ${
                                unlocked ? '' : 'opacity-65 grayscale'
                              }`}
                            />
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-slate-200/15 bg-slate-800/80 text-xs font-bold text-amber-300">
                              {entry.name.slice(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-semibold text-slate-100 truncate">{entry.name}</span>
                                <span className="text-slate-500" aria-hidden="true">·</span>
                                <span className="text-amber-300/90 whitespace-nowrap">{entry.threat}</span>
                              </div>
                              {unlocked ? (
                                <span className="font-mono-nums text-[11px] font-semibold text-emerald-300 whitespace-nowrap">
                                  ×{kills}
                                </span>
                              ) : (
                                <Lock className="h-3 w-3 shrink-0 text-slate-500" aria-hidden="true" />
                              )}
                            </div>
                            <p className="mt-1 text-xs leading-snug text-slate-400">{entry.behavior}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>

            {/* Records & Achievements Section */}
            <section className="border-t border-slate-200/10 pt-7">
              <div className="flex flex-wrap items-baseline justify-between gap-4 pb-5">
                <div className="flex items-center gap-2.5">
                  <Award className="h-5 w-5 text-amber-400" aria-hidden="true" />
                  <h2 className="font-display text-2xl font-bold tracking-tight text-slate-50">
                    Рекорды и достижения
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span>
                    Открыто:{' '}
                    <strong className="font-mono-nums text-slate-100">
                      {unlockedCount}/{ACHIEVEMENTS.length}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Макс. волна:{' '}
                    <strong className="font-mono-nums text-slate-100">{records.bestWave}</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Уничтожено рыб:{' '}
                    <strong className="font-mono-nums text-slate-100">
                      {records.totalMonstersKilled.toLocaleString('ru-RU')}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Макс. комбо:{' '}
                    <strong className="font-mono-nums text-slate-100">x{records.bestCombo}</strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ACHIEVEMENTS.map((ach) => {
                  const isUnlocked = Boolean(records.unlocked[ach.id]);
                  const current = Math.min(ach.target, ach.getValue(records));
                  const ratio = ach.target > 0 ? Math.min(1, current / ach.target) : 0;

                  return (
                    <div
                      key={ach.id}
                      className={`flex flex-col justify-between gap-3 rounded-lg border p-3.5 transition-colors ${
                        isUnlocked
                          ? 'border-emerald-500/35 bg-[#0C1D1A]/75'
                          : 'border-slate-200/10 bg-[#0B1520]/80'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-100 truncate">
                            {ach.title}
                          </span>
                          {isUnlocked ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 whitespace-nowrap shrink-0">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Открыто</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-mono-nums text-xs text-slate-400 whitespace-nowrap shrink-0">
                              <Lock className="h-3 w-3 text-slate-500" aria-hidden="true" />
                              <span>
                                {current}/{ach.target}
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-snug text-slate-400">{ach.description}</p>
                      </div>

                      <div className="h-1 w-full overflow-hidden rounded-xs bg-slate-800">
                        <div
                          className={`h-full origin-left transition-transform duration-200 ${
                            isUnlocked ? 'bg-emerald-400' : 'bg-amber-400/80'
                          }`}
                          style={{ transform: `scaleX(${ratio})` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
