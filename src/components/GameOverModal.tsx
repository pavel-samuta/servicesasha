import { CheckCircle2, Home, Play, RotateCcw } from 'lucide-react';
import { AchievementDefinition } from '../game/achievements';
import { HudSnapshot } from '../game/types';

interface GameOverModalProps {
  mode: 'PAUSED' | 'GAME_OVER' | 'VICTORY';
  hud: HudSnapshot;
  sessionUnlocked?: AchievementDefinition[];
  onResume?: () => void;
  onRestart: () => void;
  onReturnToMenu: () => void;
}

export function GameOverModal({
  mode,
  hud,
  sessionUnlocked = [],
  onResume,
  onRestart,
  onReturnToMenu,
}: GameOverModalProps) {
  const isPaused = mode === 'PAUSED';
  const isVictory = mode === 'VICTORY';

  const subtitle = isPaused
    ? 'Игра приостановлена'
    : isVictory
      ? 'Барон Саша очистил все воды Чёрного озера!'
      : 'Судно Барона Саши затонуло';

  const heading = isPaused ? 'Пауза' : isVictory ? 'Победа! 20 туров пройдены' : 'Рейс окончен';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#040911]/85 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200/15 bg-[#0A1420] p-6 shadow-2xl">
        <div className="space-y-1.5 border-b border-slate-200/10 pb-4">
          <p className={`text-xs font-medium ${isVictory ? 'text-emerald-300' : 'text-amber-300'}`}>
            {subtitle}
          </p>
          <h2 className="font-display text-3xl font-bold text-slate-50">
            {heading}
          </h2>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 gap-4 py-5">
          <div>
            <div className="text-xs text-slate-400">Итоговый счёт</div>
            <div className="mt-0.5 font-mono-nums text-2xl font-bold text-amber-400">
              {hud.score.toLocaleString('ru-RU')}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Лучший рекорд</div>
            <div className="mt-0.5 font-mono-nums text-2xl font-bold text-slate-100">
              {hud.highScore.toLocaleString('ru-RU')}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Текущий тур</div>
            <div className="mt-0.5 font-mono-nums text-lg font-semibold text-slate-200">
              {hud.wave}/{hud.totalTours}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Уничтожено монстров</div>
            <div className="mt-0.5 font-mono-nums text-lg font-semibold text-slate-200">
              {hud.monstersKilled}
            </div>
          </div>
        </div>

        {/* Newly Unlocked Achievements in This Run */}
        {!isPaused && sessionUnlocked.length > 0 && (
          <div className="mb-4 space-y-2 border-t border-slate-200/10 pt-4">
            <div className="text-xs font-semibold text-emerald-300">
              Открыто за заплыв ({sessionUnlocked.length})
            </div>
            <div className="space-y-1.5">
              {sessionUnlocked.map((ach) => (
                <div
                  key={ach.id}
                  className="flex items-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-950/25 px-3 py-2 text-xs"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-100">{ach.title}</span>
                    <span className="mx-1.5 text-slate-500" aria-hidden="true">·</span>
                    <span className="text-slate-400">{ach.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2.5 border-t border-slate-200/10 pt-4">
          {isPaused && onResume && (
            <button
              type="button"
              onClick={onResume}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap"
            >
              <Play className="h-4 w-4 fill-slate-950" aria-hidden="true" />
              <span>Продолжить</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRestart}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap ${
              isPaused
                ? 'border border-slate-200/15 bg-slate-800/80 text-slate-100 hover:bg-slate-700'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
            }`}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Играть снова</span>
          </button>

          <button
            type="button"
            onClick={onReturnToMenu}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200/10 bg-transparent px-5 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Выйти в меню</span>
          </button>
        </div>
      </div>
    </div>
  );
}
