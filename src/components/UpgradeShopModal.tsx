import { ArrowRight, Wrench } from 'lucide-react';
import { UPGRADE_CATALOG } from '../game/constants';
import { getTourDefinition, TOTAL_TOURS, TOUR_BIOMES } from '../game/tours';
import { PlayerStats, UpgradeId } from '../game/types';

interface UpgradeShopModalProps {
  wave: number;
  coins: number;
  stats: PlayerStats;
  upgradeLevels: Record<UpgradeId, number>;
  getUpgradePrice: (id: UpgradeId) => number;
  onBuyUpgrade: (id: UpgradeId) => void;
  onRepairBoat: () => void;
  onNextWave: () => void;
  onSaveAndExit?: () => void;
}

export function UpgradeShopModal({
  wave,
  coins,
  stats,
  upgradeLevels,
  getUpgradePrice,
  onBuyUpgrade,
  onRepairBoat,
  onNextWave,
  onSaveAndExit,
}: UpgradeShopModalProps) {
  const upgradeList = Object.values(UPGRADE_CATALOG);
  const repairCost = 18;
  const needsRepair = stats.hp < stats.maxHp;
  const currentTour = getTourDefinition(wave);
  const nextTour = getTourDefinition(Math.min(TOTAL_TOURS, wave + 1));

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#040911]/85 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200/15 bg-[#0A1420] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/10 px-6 py-4">
          <div>
            <p className="text-xs text-emerald-300">
              Тур {wave} из {TOTAL_TOURS} пройден · {currentTour.name}
            </p>
            <h2 className="font-display text-2xl font-bold text-slate-50">
              Мастерская у причала
            </h2>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <div className="text-xs text-slate-400">Корпус</div>
              <div className="font-mono-nums font-bold text-slate-100">
                {stats.hp}/{stats.maxHp}
              </div>
            </div>
            <div className="h-7 w-px bg-slate-200/10" aria-hidden="true" />
            <div className="text-right">
              <div className="text-xs text-slate-400">Трофеи</div>
              <div className="font-mono-nums font-bold text-amber-400">{coins}</div>
            </div>
          </div>
        </div>

        {/* Scrollable Upgrades Grid */}
        <div className="grid grid-cols-1 gap-3 overflow-y-auto p-6 sm:grid-cols-2">
          {/* Quick Hull Repair Option */}
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 sm:col-span-2 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Wrench className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                <span>Полевой ремонт лодки</span>
                <span className="text-slate-500" aria-hidden="true">·</span>
                <span className="text-xs font-medium text-emerald-300">+40 HP</span>
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Залатать пробоины судна Барона Саши перед выходом на следующий тур.
              </p>
            </div>
            <button
              type="button"
              onClick={onRepairBoat}
              disabled={!needsRepair || coins < repairCost}
              className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-emerald-400 whitespace-nowrap shrink-0"
            >
              {!needsRepair ? 'Корпус цел' : `Починить · ${repairCost}`}
            </button>
          </div>

          {upgradeList.map((upg) => {
            const level = upgradeLevels[upg.id];
            const isMax = level >= upg.maxLevel;
            const price = getUpgradePrice(upg.id);
            const canAfford = coins >= price && !isMax;

            return (
              <div
                key={upg.id}
                className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200/10 bg-[#0F1C2B] p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-100">{upg.title}</h3>
                    <span className="font-mono-nums text-xs text-slate-400 whitespace-nowrap">
                      Ур. {level}/{upg.maxLevel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{upg.description}</p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs font-medium text-amber-300">{upg.statLabel}</span>
                  <button
                    type="button"
                    onClick={() => onBuyUpgrade(upg.id)}
                    disabled={!canAfford}
                    className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3.5 py-1.5 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
                  >
                    {isMax ? 'Максимум' : `Улучшить · ${price}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer CTA */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/10 bg-[#081019] px-6 py-4">
          <div className="text-xs text-slate-400">
            <span className="text-slate-200 font-medium">
              Тур {nextTour.tour}: {nextTour.name}
            </span>
            <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
            <span>{TOUR_BIOMES[nextTour.biome].label}</span>
            <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
            <span>Островов: {nextTour.islands.length}</span>
            {nextTour.bossCount > 0 && (
              <span className="ml-1.5 font-semibold text-amber-300">
                · {nextTour.bossCount > 1 ? `Боссы: ${nextTour.bossCount} Левиафана` : 'Босс: Левиафан'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {onSaveAndExit && (
              <button
                type="button"
                onClick={onSaveAndExit}
                className="rounded-lg border border-slate-200/15 bg-slate-800/70 px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white whitespace-nowrap shrink-0"
              >
                Сохранить и в меню
              </button>
            )}
            <button
              type="button"
              onClick={onNextWave}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
            >
              <span>Выйти на тур {wave + 1}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
