import { Box, Camera, CloudFog, CloudLightning, CloudRain, Crosshair, Layers, Moon, Pause, Play, Shield, Volume2, VolumeX, Zap, Bomb } from 'lucide-react';
import { HERO_SHORT_TITLE } from '../game/constants';
import { CameraPreset, HudSnapshot, RenderMode, WeatherKind } from '../game/types';
import { WEATHER_LABELS } from '../game/weather3d';

interface TopHudProps {
  hud: HudSnapshot;
  renderMode: RenderMode;
  muted: boolean;
  autoFire: boolean;
  paused: boolean;
  cameraPreset: CameraPreset;
  onToggleRenderMode: () => void;
  onToggleMute: () => void;
  onToggleAutoFire: () => void;
  onCycleCamera: () => void;
  onCycleWeather: () => void;
  onTogglePause: () => void;
  onTriggerDepthCharge: () => void;
}

const CAMERA_LABELS: Record<CameraPreset, string> = {
  chase: 'Камера: Погоня',
  close: 'Камера: Близко',
  tactical: 'Камера: Сверху',
};

function WeatherIcon({ weather }: { weather: WeatherKind }) {
  if (weather === 'mist') return <CloudFog className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />;
  if (weather === 'rain') return <CloudRain className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />;
  if (weather === 'storm') return <CloudLightning className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />;
  return <Moon className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />;
}

export function TopHud({
  hud,
  renderMode,
  muted,
  autoFire,
  paused,
  cameraPreset,
  onToggleRenderMode,
  onToggleMute,
  onToggleAutoFire,
  onCycleCamera,
  onCycleWeather,
  onTogglePause,
  onTriggerDepthCharge,
}: TopHudProps) {
  const hpRatio = hud.maxHp > 0 ? Math.max(0, Math.min(1, hud.hp / hud.maxHp)) : 0;
  const hullState = hpRatio > 0.55 ? 'Норма' : hpRatio > 0.25 ? 'Повреждён' : 'Критично';
  const hullBarColor = hpRatio > 0.55 ? 'bg-emerald-500' : hpRatio > 0.25 ? 'bg-amber-500' : 'bg-red-500';
  const hullTextColor = hpRatio > 0.55 ? 'text-emerald-300' : hpRatio > 0.25 ? 'text-amber-300' : 'text-red-300';

  return (
    <header className="relative z-20 flex h-14 w-full items-center justify-between gap-4 border-b border-slate-200/10 bg-[#081019] px-4">
      {/* Left: Hull Integrity & Abilities */}
      <div className="flex items-center gap-5 min-w-0">
        <div className="flex items-center gap-2.5">
          <Shield className={`h-4 w-4 shrink-0 ${hullTextColor}`} aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs leading-none">
              <span className="font-semibold text-slate-100 whitespace-nowrap">{HERO_SHORT_TITLE}</span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className={`font-mono-nums font-semibold ${hullTextColor} whitespace-nowrap`}>
                {hud.hp}/{hud.maxHp}
              </span>
              <span className="hidden sm:inline text-slate-400 whitespace-nowrap">· {hullState}</span>
            </div>
            <div className="h-1.5 w-32 sm:w-40 overflow-hidden bg-slate-800 rounded-xs">
              <div
                className={`h-full transition-transform duration-150 origin-left ${hullBarColor}`}
                style={{ transform: `scaleX(${hpRatio})` }}
              />
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 border-l border-slate-200/10 pl-4 text-xs">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Zap
              className={`h-3.5 w-3.5 ${hud.dashReady ? 'text-amber-400' : 'text-slate-500'}`}
              aria-hidden="true"
            />
            <span className="text-slate-400">Рывок:</span>
            <span className={`font-mono-nums font-semibold ${hud.dashReady ? 'text-amber-300' : 'text-slate-400'}`}>
              {hud.dashReady ? 'Готов' : `${Math.round((1 - hud.dashCooldownRatio) * 100)}%`}
            </span>
          </div>

          <button
            type="button"
            onClick={onTriggerDepthCharge}
            disabled={hud.depthCharges <= 0}
            className="flex items-center gap-1.5 rounded-md border border-slate-200/15 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-200 transition-colors hover:border-amber-400/50 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
            title="Сбросить глубинный заряд (E)"
          >
            <Bomb className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            <span>Заряд [E]:</span>
            <span className="font-mono-nums font-semibold text-amber-300">
              {hud.depthCharges}/{hud.maxDepthCharges}
            </span>
          </button>
        </div>
      </div>

      {/* Center: Tour, Remaining & Score Metadata */}
      <div className="flex items-center gap-3 text-xs sm:text-sm min-w-0">
        <div className="flex items-center gap-1.5 whitespace-nowrap" title={`${hud.tourName} · ${hud.tourBiome} · Островов: ${hud.islandCount}`}>
          <span className="text-slate-400">Тур</span>
          <span className="font-mono-nums font-bold text-slate-100">
            {hud.wave}/{hud.totalTours}
          </span>
          <span className="hidden 2xl:inline text-xs text-slate-400 truncate max-w-[140px]">
            · {hud.tourName}
          </span>
        </div>
        <span className="text-slate-600" aria-hidden="true">·</span>
        <div className="hidden sm:flex items-center gap-2 whitespace-nowrap">
          <span className="text-slate-400">Рыб:</span>
          <span className="font-mono-nums font-semibold text-slate-200">{hud.monstersRemaining}</span>
        </div>
        <span className="hidden sm:inline text-slate-600" aria-hidden="true">·</span>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-slate-400">Счёт</span>
          <span className="font-mono-nums font-bold text-amber-400">{hud.score.toLocaleString('ru-RU')}</span>
        </div>
        <span className="hidden lg:inline text-slate-600" aria-hidden="true">·</span>
        <div className="hidden lg:flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-slate-400">Трофеи:</span>
          <span className="font-mono-nums font-semibold text-amber-300">{hud.coins}</span>
        </div>
        <span className="hidden xl:inline text-slate-600" aria-hidden="true">·</span>
        <div className="hidden xl:flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-slate-400">Гарпун:</span>
          <span className="font-mono-nums font-semibold text-slate-100">{hud.harpoonDamage}</span>
        </div>
        {hud.combo > 1 && (
          <>
            <span className="hidden md:inline text-slate-600" aria-hidden="true">·</span>
            <span className="hidden md:inline font-mono-nums text-xs font-bold text-amber-300 whitespace-nowrap">
              Комбо x{hud.combo}
            </span>
          </>
        )}
      </div>

      {/* Right: Functional Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleRenderMode}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-400/35 bg-amber-500/10 px-2.5 text-xs font-bold text-amber-200 transition-colors hover:border-amber-400/70 hover:bg-amber-500/20 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
          title={renderMode === '3d' ? 'Переключиться в 2D-режим (M)' : 'Переключиться в 3D-режим (M)'}
        >
          {renderMode === '3d' ? (
            <Box className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
          ) : (
            <Layers className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
          )}
          <span>{renderMode === '3d' ? '3D' : '2D'}</span>
        </button>

        <button
          type="button"
          onClick={onCycleWeather}
          className="hidden lg:inline-flex items-center gap-1.5 rounded-md border border-slate-200/15 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-amber-400/50 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
          title="Погода над озером меняется автоматически (клавиша G — сменить вручную)"
        >
          <WeatherIcon weather={hud.weather} />
          <span>{WEATHER_LABELS[hud.weather]}</span>
        </button>

        <button
          type="button"
          onClick={onCycleCamera}
          className="hidden xl:inline-flex items-center gap-1.5 rounded-md border border-slate-200/15 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-amber-400/50 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
          title={renderMode === '3d' ? 'Переключить 3D-камеру (V)' : 'Переключить масштаб 2D-камеры (V)'}
        >
          <Camera className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
          <span>{CAMERA_LABELS[cameraPreset]}</span>
        </button>

        <button
          type="button"
          onClick={onToggleAutoFire}
          aria-pressed={autoFire}
          className={`hidden sm:inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 ${
            autoFire
              ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
              : 'border-slate-200/15 bg-slate-800/80 text-slate-300 hover:text-white'
          }`}
          title="Переключить авто-огонь"
        >
          <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{autoFire ? 'Авто-огонь: Вкл' : 'Авто-огонь'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Включить звук' : 'Выключить звук'}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200/15 bg-slate-800/80 text-slate-200 transition-colors hover:border-slate-200/30 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400 shrink-0"
        >
          {muted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-amber-300" />}
        </button>

        <button
          type="button"
          onClick={onTogglePause}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200/15 bg-slate-800/90 px-3 text-xs font-semibold text-slate-100 transition-colors hover:border-amber-400/50 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{paused ? 'Продолжить' : 'Пауза'}</span>
        </button>
      </div>
    </header>
  );
}
