import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Crosshair, Fish, Heart, Lock, Play, ShieldAlert, Skull, Zap } from 'lucide-react';
import { PlayerRecords } from '../game/achievements';
import { BESTIARY_ENTRIES } from '../game/constants';
import { MonsterKind } from '../game/types';
import { Bestiary3DViewer } from './Bestiary3DViewer';

interface BestiarySectionProps {
  records: PlayerRecords;
  initialKind?: MonsterKind | null;
  onStartGame: () => void;
}

export function BestiarySection({ records, initialKind, onStartGame }: BestiarySectionProps) {
  const getKillCount = (kind: MonsterKind) => records.defeatedByKind?.[kind] ?? 0;

  const firstUnlocked = BESTIARY_ENTRIES.find((e) => getKillCount(e.kind) > 0)?.kind;
  const [selectedKind, setSelectedKind] = useState<MonsterKind>(
    initialKind ?? firstUnlocked ?? BESTIARY_ENTRIES[0].kind
  );

  useEffect(() => {
    if (initialKind) {
      setSelectedKind(initialKind);
    }
  }, [initialKind]);

  const unlockedSpeciesCount = BESTIARY_ENTRIES.filter((e) => getKillCount(e.kind) > 0).length;
  const selectedEntry = BESTIARY_ENTRIES.find((e) => e.kind === selectedKind) ?? BESTIARY_ENTRIES[0];
  const selectedKills = getKillCount(selectedEntry.kind);
  const isUnlocked = selectedKills > 0;

  return (
    <section className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/10 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>Архив трофеев Чёрного озера</span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-50">
            Бестиарий монстров и крокодилов Гены
          </h1>
          <p className="max-w-[64ch] text-xs leading-relaxed text-slate-400 sm:text-sm">
            Побеждайте глубинных рыб и лесных крокодилов в бою, чтобы открывать их интерактивные 3D-модели,
            описания и боевые характеристики.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-slate-200/10 bg-[#0B1520] px-4 py-2.5 text-xs">
          <div>
            <span className="text-slate-400">Изучено видов:</span>{' '}
            <strong className="font-mono-nums text-amber-300">
              {unlockedSpeciesCount}/{BESTIARY_ENTRIES.length}
            </strong>
          </div>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <div>
            <span className="text-slate-400">Побеждено всего:</span>{' '}
            <strong className="font-mono-nums text-slate-100">
              {records.totalMonstersKilled.toLocaleString('ru-RU')}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Split: Roster List + 3D Viewer & Dossier */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Roster */}
        <div className="flex flex-col gap-2.5 lg:col-span-5">
          {BESTIARY_ENTRIES.map((entry) => {
            const kills = getKillCount(entry.kind);
            const unlocked = kills > 0;
            const active = entry.kind === selectedEntry.kind;

            return (
              <button
                key={entry.kind}
                type="button"
                onClick={() => setSelectedKind(entry.kind)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 ${
                  active
                    ? unlocked
                      ? 'border-amber-400/55 bg-[#0F1E2E]'
                      : 'border-slate-300/30 bg-[#0D1723]'
                    : unlocked
                      ? 'border-slate-200/12 bg-[#0B1520]/85 hover:border-slate-200/25 hover:bg-[#0D1A28]'
                      : 'border-slate-200/8 bg-[#081018]/75 hover:border-slate-200/18'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${
                      unlocked
                        ? entry.kind === 'croc_gena'
                          ? 'border-rose-400/35 bg-rose-950/40 text-rose-300'
                          : entry.kind === 'leviathan'
                            ? 'border-emerald-400/35 bg-emerald-950/40 text-emerald-300'
                            : 'border-amber-400/30 bg-amber-950/30 text-amber-300'
                        : 'border-slate-200/10 bg-slate-900/80 text-slate-500'
                    }`}
                  >
                    {unlocked ? (
                      entry.kind === 'croc_gena' ? (
                        <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Fish className="h-5 w-5" aria-hidden="true" />
                      )
                    ) : (
                      <Lock className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`truncate text-sm font-semibold ${
                          unlocked ? 'text-slate-100' : 'text-slate-400'
                        }`}
                      >
                        {entry.name}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                      <span className={unlocked ? 'text-amber-300/90' : 'text-slate-500'}>
                        {entry.category}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="truncate">{entry.threat}</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {unlocked ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-950/35 px-2 py-1 font-mono-nums text-xs font-semibold text-emerald-300 whitespace-nowrap">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{kills}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      <span>Закрыто</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Detail Panel: 3D Showcase + Lore */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {isUnlocked ? (
            <>
              <Bestiary3DViewer kind={selectedEntry.kind} name={selectedEntry.name} />

              <div className="rounded-lg border border-slate-200/12 bg-[#0B1520] p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/10 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-amber-300">{selectedEntry.category}</span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="text-slate-300">{selectedEntry.threat}</span>
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-bold text-slate-50">
                      {selectedEntry.name}
                    </h2>
                  </div>

                  <div className="rounded-md border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs">
                    <span className="text-emerald-200/80">Побеждено раз:</span>{' '}
                    <strong className="font-mono-nums text-emerald-300">{selectedKills}</strong>
                  </div>
                </div>

                <div className="space-y-2.5 text-sm leading-relaxed text-slate-300">
                  <p>{selectedEntry.lore}</p>
                  <p className="text-xs text-slate-400">
                    <strong className="text-slate-200">Тактика:</strong> {selectedEntry.behavior}
                  </p>
                  <p className="text-xs text-slate-400">
                    <strong className="text-slate-200">Появление:</strong> {selectedEntry.habitat}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-slate-200/10 pt-4 sm:grid-cols-4">
                  <div className="rounded-md border border-slate-200/10 bg-[#081019] p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Heart className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      <span>Прочность</span>
                    </div>
                    <div className="mt-1 font-mono-nums text-base font-bold text-slate-100">
                      {selectedEntry.stats.hp} HP
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200/10 bg-[#081019] p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Zap className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                      <span>Скорость</span>
                    </div>
                    <div className="mt-1 font-mono-nums text-base font-bold text-slate-100">
                      {selectedEntry.stats.speed.toFixed(1)} м/с
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200/10 bg-[#081019] p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Crosshair className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                      <span>Урон</span>
                    </div>
                    <div className="mt-1 font-mono-nums text-base font-bold text-slate-100">
                      {selectedEntry.stats.damage}
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200/10 bg-[#081019] p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Skull className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                      <span>Трофей</span>
                    </div>
                    <div className="mt-1 font-mono-nums text-base font-bold text-amber-300">
                      +{selectedEntry.stats.score}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-5 rounded-lg border border-slate-200/12 bg-[#07111b] p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200/15 bg-[#0B1520] text-slate-400">
                <Lock className="h-7 w-7" aria-hidden="true" />
              </div>

              <div className="max-w-md space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
                  Образец ещё не добыт
                </p>
                <h2 className="font-display text-2xl font-bold text-slate-100">
                  {selectedEntry.name}
                </h2>
                <p className="text-sm leading-relaxed text-slate-400">
                  Одолейте этого противника в бою на Чёрном озере, чтобы открыть его 3D-модель для осмотра
                  и полное описание в бестиарии.
                </p>
                <p className="pt-1 text-xs text-slate-500">
                  Где искать: <span className="text-slate-300">{selectedEntry.habitat}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={onStartGame}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <Play className="h-4 w-4 fill-slate-950" aria-hidden="true" />
                <span>Выйти на озеро</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
