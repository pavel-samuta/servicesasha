import { useCallback, useEffect, useRef, useState } from 'react';
import { Award, Bomb, Camera, MessageSquareQuote, Zap } from 'lucide-react';
import { GameOverModal } from './components/GameOverModal';
import { TitleMenu } from './components/TitleMenu';
import { TopHud } from './components/TopHud';
import { UpgradeShopModal } from './components/UpgradeShopModal';
import {
  AchievementDefinition,
  applyRunProgressToRecords,
  loadPlayerRecords,
  PlayerRecords,
  savePlayerRecords,
} from './game/achievements';
import { soundEngine } from './game/audio';
import { BASE_PLAYER_STATS, HIGH_SCORE_STORAGE_KEY } from './game/constants';
import { BlackLakeEngine2D } from './game/engine2d';
import { BlackLakeEngine3D } from './game/engine3d';
import { getTourDefinition, TOTAL_TOURS, TOUR_BIOMES } from './game/tours';
import {
  BlackLakeEngine,
  CameraPreset,
  Difficulty,
  GameState,
  HudSnapshot,
  MonsterKind,
  RenderMode,
  RunCarryoverState,
  UpgradeId,
} from './game/types';

function createInitialHud(highScore: number): HudSnapshot {
  const firstTour = getTourDefinition(1);
  return {
    hp: BASE_PLAYER_STATS.hp,
    maxHp: BASE_PLAYER_STATS.maxHp,
    score: 0,
    highScore,
    coins: 0,
    wave: 1,
    monstersRemaining: 0,
    monstersKilled: 0,
    leviathansKilled: 0,
    crocsKilled: 0,
    killsByKind: {},
    harpoonDamage: BASE_PLAYER_STATS.damage,
    combo: 0,
    maxCombo: 0,
    dashCooldownRatio: 0,
    dashReady: true,
    depthCharges: BASE_PLAYER_STATS.depthCharges,
    maxDepthCharges: BASE_PLAYER_STATS.maxDepthCharges,
    overdriveTimer: 0,
    bossName: null,
    bossHp: 0,
    bossMaxHp: 0,
    waveBannerTimer: 0,
    waveBannerText: '',
    eventBannerTimer: 0,
    eventBannerText: '',
    weather: firstTour.weather,
    tourName: firstTour.name,
    tourBiome: TOUR_BIOMES[firstTour.biome].label,
    totalTours: TOTAL_TOURS,
    islandCount: firstTour.islands.length,
    npcShout: null,
  };
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [difficulty, setDifficulty] = useState<Difficulty>('hunt');
  const [renderMode, setRenderMode] = useState<RenderMode>('3d');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('chase');
  const [muted, setMuted] = useState(false);
  const [autoFire, setAutoFire] = useState(false);
  const [webglError, setWebglError] = useState(false);

  const [records, setRecords] = useState<PlayerRecords>(() => {
    let legacyHigh = 0;
    try {
      const raw = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      legacyHigh = raw ? parseInt(raw, 10) || 0 : 0;
    } catch {
      legacyHigh = 0;
    }
    return loadPlayerRecords(legacyHigh);
  });

  const [hud, setHud] = useState<HudSnapshot>(() => createInitialHud(records.highScore));
  const [sessionUnlocked, setSessionUnlocked] = useState<AchievementDefinition[]>([]);
  const [activeToast, setActiveToast] = useState<AchievementDefinition | null>(null);
  const [, setShopTick] = useState(0);

  // Refs for stable callbacks inside 2D/3D engine loop
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BlackLakeEngine | null>(null);
  const carryoverRef = useRef<RunCarryoverState | null>(null);
  const carryoverPausedRef = useRef(false);
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  const recordsRef = useRef<PlayerRecords>(records);
  recordsRef.current = records;

  const lastRunKillsRef = useRef(0);
  const lastRunLeviathansRef = useRef(0);
  const lastRunCrocsRef = useRef(0);
  const lastRunKillsByKindRef = useRef<Partial<Record<MonsterKind, number>>>({});
  const toastTimerRef = useRef<number | null>(null);

  const joyTouchIdRef = useRef<number | null>(null);
  const joyOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const syncRecordsFromHud = useCallback((snapshot: HudSnapshot) => {
    const killsDelta = Math.max(0, snapshot.monstersKilled - lastRunKillsRef.current);
    const leviathansDelta = Math.max(0, snapshot.leviathansKilled - lastRunLeviathansRef.current);
    const crocsDelta = Math.max(0, snapshot.crocsKilled - lastRunCrocsRef.current);
    lastRunKillsRef.current = snapshot.monstersKilled;
    lastRunLeviathansRef.current = snapshot.leviathansKilled;
    lastRunCrocsRef.current = snapshot.crocsKilled;

    const killsByKindDelta: Partial<Record<MonsterKind, number>> = {};
    let hasKindDelta = false;
    for (const [k, rawCount] of Object.entries(snapshot.killsByKind || {})) {
      const kind = k as MonsterKind;
      const currentCount = Number(rawCount) || 0;
      const prevCount = lastRunKillsByKindRef.current[kind] ?? 0;
      const delta = Math.max(0, currentCount - prevCount);
      if (delta > 0) {
        killsByKindDelta[kind] = delta;
        lastRunKillsByKindRef.current[kind] = currentCount;
        hasKindDelta = true;
      }
    }

    const { next, newlyUnlocked } = applyRunProgressToRecords(recordsRef.current, {
      score: snapshot.score,
      wave: snapshot.wave,
      runKills: snapshot.monstersKilled,
      killsDelta,
      leviathansDelta,
      crocsDelta,
      killsByKindDelta,
      maxCombo: snapshot.maxCombo,
    });

    const changed =
      killsDelta > 0 ||
      leviathansDelta > 0 ||
      crocsDelta > 0 ||
      hasKindDelta ||
      next.highScore !== recordsRef.current.highScore ||
      next.bestWave !== recordsRef.current.bestWave ||
      next.bestCombo !== recordsRef.current.bestCombo ||
      newlyUnlocked.length > 0;

    if (changed) {
      recordsRef.current = next;
      setRecords(next);
      savePlayerRecords(next);
    }

    if (newlyUnlocked.length > 0) {
      setSessionUnlocked((prev) => [...prev, ...newlyUnlocked]);
      setActiveToast(newlyUnlocked[newlyUnlocked.length - 1]);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setActiveToast(null);
      }, 3600);
    }
  }, []);

  // Initialize & dispose active 2D/3D Engine when entering gameplay or switching renderMode
  useEffect(() => {
    if (gameState === 'TITLE_MENU') {
      carryoverRef.current = null;
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      return;
    }

    const mount = canvasMountRef.current;
    if (!mount) return;

    if (!engineRef.current) {
      try {
        setWebglError(false);
        const pendingCarryover = carryoverRef.current;
        const pendingPaused = carryoverPausedRef.current;
        carryoverRef.current = null;
        carryoverPausedRef.current = false;

        if (!pendingCarryover) {
          lastRunKillsRef.current = 0;
          lastRunLeviathansRef.current = 0;
          lastRunCrocsRef.current = 0;
          lastRunKillsByKindRef.current = {};
        }

        const callbacks = {
          onHudUpdate: (snapshot: HudSnapshot) => {
            setHud(snapshot);
            syncRecordsFromHud(snapshot);
          },
          onWaveClear: () => {
            setGameState('UPGRADE_SHOP');
          },
          onVictory: (finalHud: HudSnapshot) => {
            setHud(finalHud);
            syncRecordsFromHud(finalHud);
            setGameState('VICTORY');
          },
          onGameOver: (finalHud: HudSnapshot) => {
            setHud(finalHud);
            syncRecordsFromHud(finalHud);
            setGameState('GAME_OVER');
          },
          onContextLost: () => {
            setWebglError(true);
          },
        };

        const engine: BlackLakeEngine =
          renderMode === '2d'
            ? new BlackLakeEngine2D(mount, callbacks)
            : new BlackLakeEngine3D(mount, callbacks);

        engine.setAutoFire(autoFire);
        if (pendingCarryover) {
          engine.importRunState(pendingCarryover, pendingPaused);
        } else {
          engine.startNewGame(difficulty);
        }
        engineRef.current = engine;
      } catch {
        setWebglError(true);
        return;
      }
    }

    const handleResize = () => {
      if (canvasMountRef.current && engineRef.current) {
        engineRef.current.resize(canvasMountRef.current.clientWidth, canvasMountRef.current.clientHeight);
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(mount);
    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [gameState === 'TITLE_MENU', renderMode, syncRecordsFromHud]);

  useEffect(() => {
    engineRef.current?.setAutoFire(autoFire);
  }, [autoFire]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleCycleCamera = useCallback(() => {
    if (engineRef.current) {
      const next = engineRef.current.cycleCameraPreset();
      setCameraPreset(next);
    }
  }, []);

  const handleCycleWeather = useCallback(() => {
    engineRef.current?.cycleWeather();
  }, []);

  const handleToggleRenderMode = useCallback(() => {
    if (engineRef.current) {
      carryoverRef.current = engineRef.current.exportRunState();
      carryoverPausedRef.current =
        gameStateRef.current === 'PAUSED' || gameStateRef.current === 'UPGRADE_SHOP';
    }
    setWebglError(false);
    setRenderMode((prev) => (prev === '3d' ? '2d' : '3d'));
  }, []);

  // Global keyboard bindings during active gameplay
  useEffect(() => {
    if (gameState === 'TITLE_MENU') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameStateRef.current === 'PLAYING') {
          engineRef.current?.setPaused(true);
          setGameState('PAUSED');
        } else if (gameStateRef.current === 'PAUSED') {
          engineRef.current?.setPaused(false);
          setGameState('PLAYING');
        }
        return;
      }
      if (e.code === 'KeyV' && gameStateRef.current === 'PLAYING') {
        handleCycleCamera();
        return;
      }
      if (e.code === 'KeyG' && gameStateRef.current === 'PLAYING') {
        handleCycleWeather();
        return;
      }
      if (e.code === 'KeyM' && gameStateRef.current === 'PLAYING') {
        handleToggleRenderMode();
        return;
      }
      if (e.code === 'Space' && gameStateRef.current === 'PLAYING') {
        e.preventDefault();
      }
      engineRef.current?.handleKeyDown(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      engineRef.current?.handleKeyUp(e.code);
    };

    const onWindowBlur = () => {
      if (gameStateRef.current === 'PLAYING') {
        engineRef.current?.setPaused(true);
        setGameState('PAUSED');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [gameState === 'TITLE_MENU', handleCycleCamera, handleCycleWeather, handleToggleRenderMode]);

  const handleStartGame = useCallback(() => {
    soundEngine.unlock();
    setCameraPreset('chase');
    lastRunKillsRef.current = 0;
    lastRunLeviathansRef.current = 0;
    lastRunCrocsRef.current = 0;
    lastRunKillsByKindRef.current = {};
    setSessionUnlocked([]);
    setActiveToast(null);
    setHud(createInitialHud(recordsRef.current.highScore));
    setGameState('PLAYING');
  }, []);

  const handleRestart = useCallback(() => {
    soundEngine.unlock();
    lastRunKillsRef.current = 0;
    lastRunLeviathansRef.current = 0;
    lastRunCrocsRef.current = 0;
    lastRunKillsByKindRef.current = {};
    setSessionUnlocked([]);
    setActiveToast(null);
    if (engineRef.current) {
      engineRef.current.startNewGame(difficulty);
      setGameState('PLAYING');
    } else {
      setGameState('PLAYING');
    }
  }, [difficulty]);

  const handleReturnToMenu = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
    setActiveToast(null);
    setGameState('TITLE_MENU');
  }, []);

  const handleTogglePause = useCallback(() => {
    if (gameState === 'PLAYING') {
      engineRef.current?.setPaused(true);
      setGameState('PAUSED');
    } else if (gameState === 'PAUSED') {
      engineRef.current?.setPaused(false);
      setGameState('PLAYING');
    }
  }, [gameState]);

  const handleToggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  }, [muted]);

  const handleToggleAutoFire = useCallback(() => {
    setAutoFire((prev) => !prev);
  }, []);

  const handleBuyUpgrade = useCallback((id: UpgradeId) => {
    if (engineRef.current?.applyUpgrade(id)) {
      setShopTick((t) => t + 1);
    }
  }, []);

  const handleRepairBoat = useCallback(() => {
    if (engineRef.current?.repairBoatWithCoins()) {
      setShopTick((t) => t + 1);
    }
  }, []);

  const handleLaunchNextWave = useCallback(() => {
    engineRef.current?.launchNextWave();
    setGameState('PLAYING');
  }, []);

  if (gameState === 'TITLE_MENU') {
    return (
      <TitleMenu
        difficulty={difficulty}
        renderMode={renderMode}
        records={records}
        onSelectDifficulty={setDifficulty}
        onSelectRenderMode={setRenderMode}
        onStartGame={handleStartGame}
      />
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#040911] select-none">
      <TopHud
        hud={hud}
        renderMode={renderMode}
        muted={muted}
        autoFire={autoFire}
        paused={gameState === 'PAUSED'}
        cameraPreset={cameraPreset}
        onToggleRenderMode={handleToggleRenderMode}
        onToggleMute={handleToggleMute}
        onToggleAutoFire={handleToggleAutoFire}
        onCycleCamera={handleCycleCamera}
        onCycleWeather={handleCycleWeather}
        onTogglePause={handleTogglePause}
        onTriggerDepthCharge={() => engineRef.current?.triggerDepthCharge()}
      />

      {/* Active 2D/3D Game Viewport */}
      <div className="relative flex-1 w-full overflow-hidden">
        {/* Isolated empty Canvas/WebGL mount container */}
        <div
          ref={canvasMountRef}
          className="h-full w-full"
          onMouseMove={(e) => engineRef.current?.handleMouseMove(e.clientX, e.clientY)}
          onMouseDown={(e) => engineRef.current?.handleMouseDown(e.button)}
          onMouseUp={(e) => engineRef.current?.handleMouseUp(e.button)}
          onContextMenu={(e) => e.preventDefault()}
        />

        {webglError && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#060C12] p-6 text-center">
            <p className="text-base font-semibold text-slate-100">
              Не удалось запустить 3D-рендеринг WebGL.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setWebglError(false);
                  setRenderMode('2d');
                }}
                className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950"
              >
                Перейти в 2D-режим
              </button>
              <button
                type="button"
                onClick={handleReturnToMenu}
                className="rounded-lg border border-slate-200/20 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-100"
              >
                Вернуться в меню
              </button>
            </div>
          </div>
        )}

        {/* Boss Health Bar (Top Center Overlay when Leviathan is active) */}
        {hud.bossName && hud.bossHp > 0 && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-10 w-full max-w-md -translate-x-1/2 px-4">
            <div className="rounded-md border border-emerald-400/25 bg-[#07111A]/92 px-4 py-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-300">{hud.bossName}</span>
                <span className="font-mono-nums font-bold text-slate-200">
                  {hud.bossHp}/{hud.bossMaxHp}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-xs bg-slate-800">
                <div
                  className="h-full bg-emerald-400 transition-transform duration-100 origin-left"
                  style={{ transform: `scaleX(${Math.max(0, Math.min(1, hud.bossHp / hud.bossMaxHp))})` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Wave Announcement Banner */}
        {hud.waveBannerTimer > 0 && (
          <div className="pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2 px-4 text-center">
            <div className="rounded-md border border-amber-400/30 bg-[#08121D]/92 px-5 py-2 shadow-lg">
              <span className="font-display text-lg font-bold tracking-wide text-amber-300 sm:text-xl">
                {hud.waveBannerText}
              </span>
            </div>
          </div>
        )}

        {/* Pickup / Crocodile Gena Event Banner */}
        {hud.eventBannerTimer > 0 && hud.eventBannerText && (
          <div
            className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 px-4 text-center ${
              hud.waveBannerTimer > 0 ? 'top-34' : 'top-20'
            }`}
          >
            <div className="rounded-md border border-emerald-400/35 bg-[#071614]/92 px-4 py-1.5 shadow-lg">
              <span className="text-xs font-semibold tracking-wide text-emerald-300 sm:text-sm whitespace-nowrap">
                {hud.eventBannerText}
              </span>
            </div>
          </div>
        )}

        {/* Island NPC Fisherman Shout Subtitle */}
        {hud.npcShout && (
          <div
            className={`pointer-events-none absolute left-1/2 z-20 w-full max-w-lg -translate-x-1/2 px-4 ${
              activeToast ? 'bottom-36 md:bottom-20' : 'bottom-36 md:bottom-6'
            }`}
          >
            <div className="flex items-start gap-3 rounded-lg border border-amber-400/40 bg-[#08121D]/95 px-4 py-2.5 shadow-xl">
              <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
              <div className="min-w-0 text-xs leading-snug sm:text-sm">
                <span className="font-bold text-amber-300">{hud.npcShout.speaker}: </span>
                <span className="text-slate-100">«{hud.npcShout.text}»</span>
              </div>
            </div>
          </div>
        )}

        {/* Live Achievement Unlock Banner */}
        {activeToast && (
          <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 px-4">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-400/40 bg-[#081815]/95 px-4 py-2.5 shadow-xl">
              <Award className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
              <div className="text-xs whitespace-nowrap">
                <span className="font-semibold text-emerald-300">Достижение открыто</span>
                <span className="mx-1.5 text-slate-500" aria-hidden="true">·</span>
                <span className="font-semibold text-slate-100">{activeToast.title}</span>
              </div>
            </div>
          </div>
        )}

        {/* Overdrive Timer Readout */}
        {hud.overdriveTimer > 0 && (
          <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md border border-amber-500/35 bg-[#08121D]/92 px-3 py-1.5 text-xs">
            <span className="text-amber-300 font-semibold">Форсаж орудия</span>
            <span className="mx-1.5 text-slate-500" aria-hidden="true">·</span>
            <span className="font-mono-nums text-slate-100">{hud.overdriveTimer.toFixed(1)}с</span>
          </div>
        )}

        {/* Subtle Bottom-Right Camera, Mode & Weather Hint on Desktop */}
        <div className="pointer-events-none hidden xl:flex absolute bottom-4 right-4 z-10 items-center gap-2 rounded-md border border-slate-200/10 bg-[#081019]/85 px-3 py-1.5 text-xs text-slate-400">
          <Camera className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
          <span>2D/3D: M · Ракурс: V · Погода: G</span>
        </div>

        {/* Touch Controls for Mobile / Tablet */}
        <div className="md:hidden">
          <div
            className="absolute bottom-5 left-5 z-20 flex h-28 w-28 items-center justify-center rounded-full border border-slate-200/20 bg-[#081019]/75 touch-none"
            onTouchStart={(e) => {
              const t = e.changedTouches[0];
              if (!t) return;
              joyTouchIdRef.current = t.identifier;
              const rect = e.currentTarget.getBoundingClientRect();
              joyOriginRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
              setAutoFire(true);
              setJoyKnob({ x: 0, y: 0, active: true });
            }}
            onTouchMove={(e) => {
              for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === joyTouchIdRef.current) {
                  const dx = t.clientX - joyOriginRef.current.x;
                  const dy = t.clientY - joyOriginRef.current.y;
                  const maxR = 40;
                  const d = Math.hypot(dx, dy) || 1;
                  const clampedD = Math.min(maxR, d);
                  const nx = (dx / d) * (clampedD / maxR);
                  const ny = (dy / d) * (clampedD / maxR);
                  engineRef.current?.setTouchMove(nx, ny);
                  setJoyKnob({ x: (dx / d) * clampedD, y: (dy / d) * clampedD, active: true });
                }
              }
            }}
            onTouchEnd={() => {
              joyTouchIdRef.current = null;
              engineRef.current?.setTouchMove(0, 0);
              setJoyKnob({ x: 0, y: 0, active: false });
            }}
          >
            <div
              className="h-11 w-11 rounded-full border border-amber-300/60 bg-amber-500/40"
              style={{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }}
            />
          </div>

          <div className="absolute bottom-5 right-5 z-20 flex items-center gap-3">
            <button
              type="button"
              onClick={handleCycleCamera}
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200/20 bg-[#081019]/85 text-slate-200"
              aria-label="Сменить камеру"
            >
              <Camera className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => engineRef.current?.triggerDepthCharge()}
              disabled={hud.depthCharges <= 0}
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-amber-400/40 bg-[#081019]/85 text-amber-300 disabled:opacity-40"
              aria-label="Глубинный заряд"
            >
              <Bomb className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => engineRef.current?.triggerDash()}
              disabled={!hud.dashReady}
              className="flex h-14 w-14 items-center justify-center rounded-lg border border-amber-400/60 bg-amber-500/90 text-slate-950 disabled:opacity-40"
              aria-label="Рывок"
            >
              <Zap className="h-6 w-6 fill-slate-950" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {gameState === 'UPGRADE_SHOP' && engineRef.current && (
        <UpgradeShopModal
          wave={hud.wave}
          coins={engineRef.current.getCoins()}
          stats={engineRef.current.getStats()}
          upgradeLevels={engineRef.current.getUpgradeLevels()}
          getUpgradePrice={(id) => engineRef.current!.getUpgradePrice(id)}
          onBuyUpgrade={handleBuyUpgrade}
          onRepairBoat={handleRepairBoat}
          onNextWave={handleLaunchNextWave}
        />
      )}

      {(gameState === 'PAUSED' || gameState === 'GAME_OVER' || gameState === 'VICTORY') && (
        <GameOverModal
          mode={gameState}
          hud={hud}
          sessionUnlocked={sessionUnlocked}
          onResume={gameState === 'PAUSED' ? handleTogglePause : undefined}
          onRestart={handleRestart}
          onReturnToMenu={handleReturnToMenu}
        />
      )}
    </div>
  );
}
