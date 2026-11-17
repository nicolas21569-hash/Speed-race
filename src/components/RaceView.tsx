import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Coins,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { ACHIEVEMENTS } from '../data/progression';
import { getTrackById } from '../data/tracks';
import { RaceEngine, RaceInputState } from '../engine/raceEngine';
import {
  GameSettings,
  PlayerProgress,
  RaceConfig,
  RaceFinishSummary,
  RaceTelemetry,
} from '../types/game';
import { formatCoins, formatRaceTime } from '../utils/format';

interface RaceViewProps {
  config: RaceConfig;
  progress: PlayerProgress;
  onRaceFinished: (summary: RaceFinishSummary) => RaceFinishSummary;
  onExitToMenu: () => void;
  onNextChampionshipRace?: () => void;
  onCameraModeChange: (mode: GameSettings['cameraMode']) => void;
}

const CAMERA_ORDER: GameSettings['cameraMode'][] = ['chase', 'far', 'hood'];

export function RaceView({
  config,
  progress,
  onRaceFinished,
  onExitToMenu,
  onNextChampionshipRace,
  onCameraModeChange,
}: RaceViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RaceEngine | null>(null);
  const inputRef = useRef<RaceInputState>({
    throttle: false,
    brake: false,
    left: false,
    right: false,
    nitro: false,
    drift: false,
  });

  const [telemetry, setTelemetry] = useState<RaceTelemetry | null>(null);
  const [paused, setPaused] = useState(false);
  const [finishSummary, setFinishSummary] = useState<RaceFinishSummary | null>(null);
  const [cameraMode, setCameraMode] = useState<GameSettings['cameraMode']>(
    progress.settings.cameraMode,
  );
  const [raceRunKey, setRaceRunKey] = useState(0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const trackSpec = useMemo(() => getTrackById(config.trackId), [config.trackId]);

  useEffect(() => {
    const coarse =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches ||
        'ontouchstart' in window ||
        window.innerWidth < 900);
    setIsTouchDevice(coarse);
  }, []);

  const showTouchControls =
    progress.settings.touchControls === 'always' ||
    (progress.settings.touchControls === 'auto' && isTouchDevice);

  // Mount / Remount RaceEngine
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setPaused(false);
    setFinishSummary(null);
    setTelemetry(null);

    const customization = progress.customizations[progress.selectedVehicleId];
    const engine = new RaceEngine(
      el,
      config,
      progress.selectedVehicleId,
      customization,
      progress.settings,
      (t) => setTelemetry(t),
      (rawSummary) => {
        const finalSummary = onRaceFinished(rawSummary);
        setFinishSummary(finalSummary);
      },
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // Intentionally tied to raceRunKey and config so UI state never resets WebGL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceRunKey, config.trackId, config.difficulty, config.laps]);

  // Keyboard Controls (WASD + Arrows + Shift/N Nitro + Space Drift + C Camera + Esc Pause)
  useEffect(() => {
    const syncKeys = (code: string, down: boolean) => {
      const inp = inputRef.current;
      switch (code) {
        case 'KeyW':
        case 'ArrowUp':
          inp.throttle = down;
          break;
        case 'KeyS':
        case 'ArrowDown':
          inp.brake = down;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          inp.left = down;
          break;
        case 'KeyD':
        case 'ArrowRight':
          inp.right = down;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyN':
          inp.nitro = down;
          break;
        case 'Space':
          inp.drift = down;
          break;
      }
      engineRef.current?.setInput(inp);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code,
        )
      ) {
        e.preventDefault();
      }
      if (e.code === 'Escape' && !finishSummary) {
        setPaused((prev) => {
          const next = !prev;
          engineRef.current?.setPaused(next);
          return next;
        });
        return;
      }
      if (e.code === 'KeyC' && !e.repeat) {
        cycleCamera();
        return;
      }
      syncKeys(e.code, true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      syncKeys(e.code, false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishSummary]);

  const cycleCamera = () => {
    setCameraMode((prev) => {
      const next = CAMERA_ORDER[(CAMERA_ORDER.indexOf(prev) + 1) % CAMERA_ORDER.length];
      engineRef.current?.setCameraMode(next);
      onCameraModeChange(next);
      return next;
    });
  };

  const setTouchInput = (key: keyof RaceInputState, active: boolean) => {
    inputRef.current[key] = active;
    engineRef.current?.setInput({ [key]: active });
  };

  const togglePause = () => {
    soundEngine.playClick();
    const next = !paused;
    setPaused(next);
    engineRef.current?.setPaused(next);
  };

  // Compute minimap SVG path from track points
  const minimapData = useMemo(() => {
    if (!telemetry || telemetry.minimapPoints.length === 0) return null;
    const pts = telemetry.minimapPoints;
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const pad = 25;
    const w = Math.max(1, maxX - minX + pad * 2);
    const h = Math.max(1, maxZ - minZ + pad * 2);
    const toSvg = (x: number, z: number) => ({
      sx: ((x - minX + pad) / w) * 110,
      sy: ((z - minZ + pad) / h) * 110,
    });
    const pathD =
      pts
        .map((p, idx) => {
          const { sx, sy } = toSvg(p.x, p.z);
          return `${idx === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`;
        })
        .join(' ') + ' Z';
    return { pathD, toSvg };
  }, [telemetry]);

  return (
    <div className="relative w-full h-full bg-[#06080e] overflow-hidden">
      {/* Isolated 3D WebGL Viewport */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Live Race HUD */}
      {telemetry && !finishSummary && (
        <div className="relative z-10 w-full h-full pointer-events-none flex flex-col justify-between p-3 sm:p-5">
          {/* Top HUD Row */}
          <div className="flex items-start justify-between gap-3">
            {/* Top-Left: Position, Lap, Timers & Minimap */}
            <div className="flex items-start gap-3">
              <div className="bg-[#0b0e16]/88 border border-white/12 rounded-xl px-4 py-3 flex items-center gap-4">
                <div>
                  <div className="text-[11px] text-zinc-400">Posición</div>
                  <div className="font-display font-bold text-3xl text-white leading-none mt-0.5 font-mono-tabular">
                    {telemetry.position}
                    <span className="text-base text-zinc-400">
                      /{telemetry.totalRacers}
                    </span>
                  </div>
                </div>
                <div className="h-9 w-px bg-white/10" />
                <div>
                  <div className="text-[11px] text-zinc-400">Vuelta</div>
                  <div className="font-display font-bold text-2xl text-sky-400 leading-none mt-0.5 font-mono-tabular">
                    {telemetry.lap}/{telemetry.totalLaps}
                  </div>
                </div>
                <div className="h-9 w-px bg-white/10 hidden sm:block" />
                <div className="hidden sm:block">
                  <div className="text-[11px] text-zinc-400">Tiempo</div>
                  <div className="font-mono-tabular font-bold text-lg text-white leading-tight">
                    {formatRaceTime(telemetry.raceTime)}
                  </div>
                  <div className="font-mono-tabular text-[11px] text-zinc-400">
                    Mejor: {formatRaceTime(telemetry.bestLapTime)}
                  </div>
                </div>
              </div>

              {/* Compact SVG Track Minimap */}
              {minimapData && (
                <div className="hidden md:block bg-[#0b0e16]/85 border border-white/12 rounded-xl p-2">
                  <svg width="110" height="110" viewBox="0 0 110 110">
                    <path
                      d={minimapData.pathD}
                      fill="none"
                      stroke="rgba(255,255,255,0.22)"
                      strokeWidth="5"
                      strokeLinejoin="round"
                    />
                    {telemetry.minimapRacers.map((r, i) => {
                      const { sx, sy } = minimapData.toSvg(r.x, r.z);
                      return (
                        <circle
                          key={i}
                          cx={sx}
                          cy={sy}
                          r={r.isPlayer ? 4.5 : 3.2}
                          fill={r.isPlayer ? '#ef4444' : r.color}
                          stroke="#ffffff"
                          strokeWidth={r.isPlayer ? 1.5 : 0.8}
                        />
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>

            {/* Top-Right: Track Name + Camera + Pause */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="hidden lg:block bg-[#0b0e16]/88 border border-white/12 rounded-lg px-3.5 py-2 text-xs text-zinc-300">
                {trackSpec.name} <span aria-hidden="true">·</span> {config.difficulty}
              </div>
              <button
                onClick={() => {
                  soundEngine.playClick();
                  cycleCamera();
                }}
                className="p-2.5 rounded-lg bg-[#0b0e16]/90 hover:bg-zinc-800 border border-white/15 text-zinc-100 cursor-pointer"
                title="Cambiar cámara (C)"
                aria-label="Cambiar cámara"
              >
                <Camera className="w-5 h-5" />
              </button>
              <button
                onClick={togglePause}
                className="p-2.5 rounded-lg bg-[#0b0e16]/90 hover:bg-zinc-800 border border-white/15 text-zinc-100 cursor-pointer"
                title="Pausar (Esc)"
                aria-label="Pausar"
              >
                <Pause className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center Alerts: Countdown & Wrong Way */}
          <div className="flex flex-col items-center justify-center my-auto">
            {telemetry.countdown >= 0 && (
              <div className="font-display font-bold italic text-7xl sm:text-8xl text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.85)]">
                {telemetry.countdown === 0 ? (
                  <span className="text-sky-400">¡YA!</span>
                ) : (
                  <span className="text-red-500">{telemetry.countdown}</span>
                )}
              </div>
            )}
            {telemetry.wrongWay && (
              <div className="mt-3 px-5 py-2 rounded-lg bg-red-600 text-white font-display font-bold text-lg tracking-wide">
                SENTIDO CONTRARIO
              </div>
            )}
            {telemetry.isDrifting && (
              <div className="mt-2 px-4 py-1.5 rounded-lg bg-[#0b0e16]/90 border border-amber-400/50 text-amber-400 font-display font-bold text-sm font-mono-tabular">
                DERRAPE · {telemetry.driftScore} m
              </div>
            )}
          </div>

          {/* Bottom HUD Row: Touch Controls (if enabled) + Speedometer & Nitro */}
          <div className="flex items-end justify-between gap-4">
            {/* Left Side: Mobile Steering Buttons or Live Standings */}
            {showTouchControls ? (
              <div className="flex items-center gap-3 pointer-events-auto">
                <button
                  onPointerDown={() => setTouchInput('left', true)}
                  onPointerUp={() => setTouchInput('left', false)}
                  onPointerLeave={() => setTouchInput('left', false)}
                  onPointerCancel={() => setTouchInput('left', false)}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-[#0d1017]/90 active:bg-sky-500 active:text-zinc-950 border border-white/20 flex items-center justify-center text-white touch-none"
                  aria-label="Girar izquierda"
                >
                  <ChevronLeft className="w-9 h-9" />
                </button>
                <button
                  onPointerDown={() => setTouchInput('right', true)}
                  onPointerUp={() => setTouchInput('right', false)}
                  onPointerLeave={() => setTouchInput('right', false)}
                  onPointerCancel={() => setTouchInput('right', false)}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-[#0d1017]/90 active:bg-sky-500 active:text-zinc-950 border border-white/20 flex items-center justify-center text-white touch-none"
                  aria-label="Girar derecha"
                >
                  <ChevronRight className="w-9 h-9" />
                </button>
              </div>
            ) : (
              <div className="hidden sm:block bg-[#0b0e16]/85 border border-white/10 rounded-xl px-3.5 py-2.5 w-52">
                <div className="text-[11px] text-zinc-400 mb-1.5">Clasificación</div>
                <div className="space-y-1">
                  {telemetry.standings.map((r) => (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between text-xs ${
                        r.isPlayer ? 'text-white font-bold' : 'text-zinc-400'
                      }`}
                    >
                      <span className="truncate">
                        <span className="font-mono-tabular mr-1.5">{r.position}.</span>
                        {r.name}
                      </span>
                      <span className="font-mono-tabular text-[11px]">
                        V{r.lap}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Right Side: Speedometer + Touch Pedals */}
            <div className="flex items-end gap-3 ml-auto">
              <div className="bg-[#0b0e16]/90 border border-white/12 rounded-xl px-4 py-3 min-w-[175px]">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-display font-bold text-4xl text-white font-mono-tabular leading-none">
                    {telemetry.speedKmh}
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-zinc-400">KM/H</div>
                    <div className="font-mono-tabular font-bold text-xs text-red-400">
                      {telemetry.gear === 0 ? 'R' : `M${telemetry.gear}`}
                    </div>
                  </div>
                </div>

                {/* RPM Bar */}
                <div className="mt-2.5 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      telemetry.rpmRatio > 0.85 ? 'bg-red-500' : 'bg-white'
                    }`}
                    style={{ width: `${Math.min(100, telemetry.rpmRatio * 100)}%` }}
                  />
                </div>

                {/* Nitro Gauge */}
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-sky-400 font-semibold flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> NITRO
                  </span>
                  <span className="font-mono-tabular text-zinc-300">
                    {telemetry.nitro}%
                  </span>
                </div>
                <div className="mt-1 h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      telemetry.isNitroActive ? 'bg-cyan-300' : 'bg-sky-500'
                    }`}
                    style={{ width: `${telemetry.nitro}%` }}
                  />
                </div>
              </div>

              {showTouchControls && (
                <div className="flex flex-col gap-2 pointer-events-auto">
                  <button
                    onPointerDown={() => setTouchInput('nitro', true)}
                    onPointerUp={() => setTouchInput('nitro', false)}
                    onPointerLeave={() => setTouchInput('nitro', false)}
                    onPointerCancel={() => setTouchInput('nitro', false)}
                    className="h-12 px-4 rounded-xl bg-sky-600/90 active:bg-cyan-400 active:text-zinc-950 border border-sky-300/40 text-white font-display font-bold text-xs flex items-center justify-center gap-1.5 touch-none"
                  >
                    <Flame className="w-4 h-4" />
                    NITRO
                  </button>
                  <div className="flex gap-2">
                    <button
                      onPointerDown={() => {
                        setTouchInput('brake', true);
                        setTouchInput('drift', true);
                      }}
                      onPointerUp={() => {
                        setTouchInput('brake', false);
                        setTouchInput('drift', false);
                      }}
                      onPointerLeave={() => {
                        setTouchInput('brake', false);
                        setTouchInput('drift', false);
                      }}
                      onPointerCancel={() => {
                        setTouchInput('brake', false);
                        setTouchInput('drift', false);
                      }}
                      className="w-16 h-16 rounded-xl bg-red-700/90 active:bg-red-500 border border-red-400/40 text-white font-bold text-xs touch-none"
                    >
                      FRENO
                    </button>
                    <button
                      onPointerDown={() => setTouchInput('throttle', true)}
                      onPointerUp={() => setTouchInput('throttle', false)}
                      onPointerLeave={() => setTouchInput('throttle', false)}
                      onPointerCancel={() => setTouchInput('throttle', false)}
                      className="w-16 h-16 rounded-xl bg-emerald-600/90 active:bg-emerald-400 active:text-zinc-950 border border-emerald-300/40 text-white font-bold text-xs touch-none"
                    >
                      GAS
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pause Overlay */}
      {paused && !finishSummary && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0d1017] border border-white/15 rounded-xl p-6 space-y-4 text-center">
            <h2 className="font-display font-bold text-2xl text-white">
              CARRERA PAUSADA
            </h2>
            <p className="text-xs text-zinc-400">
              {trackSpec.name} · Cámara:{' '}
              {cameraMode === 'chase'
                ? 'Persecución'
                : cameraMode === 'far'
                  ? 'Lejana'
                  : 'Capó'}
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={togglePause}
                className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> Reanudar
              </button>
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setRaceRunKey((k) => k + 1);
                }}
                className="w-full py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Reiniciar Carrera
              </button>
              <button
                onClick={() => {
                  soundEngine.playClick();
                  onExitToMenu();
                }}
                className="w-full py-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-semibold text-sm cursor-pointer"
              >
                Salir al Menú
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Race Results Modal */}
      {finishSummary && (
        <div className="fixed inset-0 z-30 bg-black/82 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0d1017] border border-white/15 rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="text-xs text-sky-400 font-semibold">
                  {trackSpec.name} · {finishSummary.difficulty}
                </div>
                <h2 className="font-display font-bold text-3xl text-white mt-0.5">
                  {finishSummary.playerPosition === 1
                    ? '¡VICTORIA EN 1.ER LUGAR!'
                    : `FINALIZASTE ${finishSummary.playerPosition}.º`}
                </h2>
              </div>
              <Trophy
                className={`w-10 h-10 ${
                  finishSummary.playerPosition === 1
                    ? 'text-amber-400'
                    : 'text-zinc-400'
                }`}
              />
            </div>

            <div className="p-6 overflow-y-auto custom-scroll space-y-5">
              {/* Rewards Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg bg-zinc-900 border border-white/10">
                  <div className="text-xs text-zinc-400">Monedas Ganadas</div>
                  <div className="font-mono-tabular font-bold text-xl text-amber-400 mt-1 flex items-center gap-1.5">
                    <Coins className="w-4 h-4" />+
                    {formatCoins(finishSummary.coinsEarned)}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-zinc-900 border border-white/10">
                  <div className="text-xs text-zinc-400">Experiencia</div>
                  <div className="font-mono-tabular font-bold text-xl text-sky-400 mt-1">
                    +{finishSummary.xpEarned} XP
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-zinc-900 border border-white/10">
                  <div className="text-xs text-zinc-400">Tiempo Total</div>
                  <div className="font-mono-tabular font-bold text-lg text-white mt-1">
                    {formatRaceTime(finishSummary.totalTime)}
                  </div>
                  {finishSummary.newRecord && (
                    <div className="text-[11px] text-emerald-400 font-semibold">
                      ¡Nuevo Récord!
                    </div>
                  )}
                </div>
              </div>

              {/* Standings Table */}
              <div className="border border-white/10 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-zinc-900/90 text-xs font-semibold text-zinc-400 flex justify-between">
                  <span>Clasificación Final</span>
                  <span>Tiempo</span>
                </div>
                <div className="divide-y divide-white/10">
                  {finishSummary.standings.map((row) => (
                    <div
                      key={row.id}
                      className={`px-4 py-2.5 flex items-center justify-between text-sm ${
                        row.isPlayer ? 'bg-red-600/15 font-bold text-white' : 'text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono-tabular w-5 text-zinc-400">
                          {row.position}.
                        </span>
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: row.color }}
                        />
                        <span>{row.name}</span>
                      </div>
                      <span className="font-mono-tabular text-xs">
                        {formatRaceTime(row.finishTime)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unlocked Achievements */}
              {finishSummary.newlyUnlockedAchievements.length > 0 && (
                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-400/40 text-xs text-amber-200">
                  Logros desbloqueados:{' '}
                  {finishSummary.newlyUnlockedAchievements
                    .map(
                      (id) => ACHIEVEMENTS.find((a) => a.id === id)?.title ?? id,
                    )
                    .join(', ')}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    onExitToMenu();
                  }}
                  className="px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 text-sm font-semibold cursor-pointer"
                >
                  Menú Principal
                </button>
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setRaceRunKey((k) => k + 1);
                  }}
                  className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold cursor-pointer"
                >
                  Correr de Nuevo
                </button>
                {onNextChampionshipRace && (
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      onNextChampionshipRace();
                    }}
                    className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold cursor-pointer"
                  >
                    Siguiente Carrera
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
