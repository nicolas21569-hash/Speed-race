import {
  Award,
  Car,
  ChevronRight,
  Coins,
  Gift,
  Play,
  Settings,
  ShoppingBag,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { ACHIEVEMENTS, DAILY_REWARDS, MISSIONS } from '../data/progression';
import { getVehicleById } from '../data/vehicles';
import {
  canClaimDailyReward,
  getMissionProgressValue,
  xpRequiredForLevel,
} from '../services/storage';
import { PlayerProgress, ScreenState } from '../types/game';
import { formatCoins } from '../utils/format';

interface MainMenuProps {
  progress: PlayerProgress;
  onNavigate: (screen: ScreenState) => void;
  onClaimDaily: () => void;
  onClaimMission: (missionId: string) => void;
}

export function MainMenu({
  progress,
  onNavigate,
  onClaimDaily,
  onClaimMission,
}: MainMenuProps) {
  const [modalTab, setModalTab] = useState<'daily' | 'missions' | 'achievements' | null>(
    null,
  );
  const selectedCar = getVehicleById(progress.selectedVehicleId);
  const xpNeeded = xpRequiredForLevel(progress.level);
  const xpPct = Math.min(100, Math.round((progress.xp / xpNeeded) * 100));
  const dailyAvailable = canClaimDailyReward(progress);

  const claimableMissionsCount = MISSIONS.filter(
    (m) =>
      !progress.claimedMissions.includes(m.id) &&
      getMissionProgressValue(progress, m.type) >= m.target,
  ).length;

  const navClick = (screen: ScreenState) => {
    soundEngine.playClick();
    onNavigate(screen);
  };

  return (
    <div className="relative z-10 w-full h-full pointer-events-none flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Top Bar: Player Profile & Economy Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
        <div className="bg-[#0d1017]/90 border border-white/10 px-4 py-2.5 rounded-lg flex items-center gap-4">
          <div>
            <div className="text-xs text-zinc-400">
              Nivel {progress.level} <span aria-hidden="true">·</span>{' '}
              <span className="font-mono-tabular text-sky-400">
                {progress.xp}/{xpNeeded} XP
              </span>
            </div>
            <div className="w-36 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-sky-500 transition-all duration-300"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>
          <div className="h-7 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-mono-tabular font-bold text-base text-white">
              {formatCoins(progress.coins)}
            </span>
          </div>
        </div>

        {/* Quick Reward / Missions / Achievements Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundEngine.playClick();
              setModalTab('daily');
            }}
            className={`px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              dailyAvailable
                ? 'bg-amber-500 text-zinc-950 border-amber-400 hover:bg-amber-400'
                : 'bg-[#0d1017]/90 text-zinc-200 border-white/10 hover:border-white/25'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>{dailyAvailable ? 'Recompensa Diaria' : 'Diaria'}</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              setModalTab('missions');
            }}
            className="px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 bg-[#0d1017]/90 text-zinc-200 border border-white/10 hover:border-white/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Target className="w-4 h-4 text-sky-400" />
            <span>
              Misiones{claimableMissionsCount > 0 ? ` (${claimableMissionsCount})` : ''}
            </span>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              setModalTab('achievements');
            }}
            className="px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 bg-[#0d1017]/90 text-zinc-200 border border-white/10 hover:border-white/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Award className="w-4 h-4 text-red-400" />
            <span>Logros</span>
          </button>
        </div>
      </div>

      {/* Left Column Navigation Rail (Leaves Center-Right 3D Showcase Unobstructed) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 my-auto md:my-0">
        <div className="w-full max-w-sm pointer-events-auto flex flex-col gap-5">
          {/* Logo Header */}
          <div className="bg-[#0a0c12]/85 border border-white/10 p-5 rounded-xl">
            <div className="text-xs font-semibold tracking-wider text-sky-400 mb-1">
              Edición Definitiva 3D
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold italic tracking-tight text-white leading-none">
              SPEED <span className="text-red-500">RACE</span>
            </h1>
            <div className="text-xs tracking-[0.26em] text-zinc-400 font-semibold mt-1.5">
              ULTIMATE RACING
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-zinc-300">
              <span>Vehículo activo</span>
              <span className="font-semibold text-white">{selectedCar.name}</span>
            </div>
          </div>

          {/* Primary Menu Buttons */}
          <nav className="flex flex-col gap-2.5" aria-label="Menú principal">
            <button
              onClick={() => navClick('race_setup')}
              className="w-full px-5 py-3.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-display font-bold text-lg tracking-wide flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <Play className="w-5 h-5 fill-current" />
                JUGAR
              </span>
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => navClick('garage')}
                className="px-4 py-3 rounded-lg bg-[#0d1017]/90 hover:bg-[#161b26] border border-white/10 hover:border-sky-500/50 text-zinc-100 font-semibold text-sm flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Car className="w-4 h-4 text-sky-400 shrink-0" />
                <span>GARAJE</span>
              </button>

              <button
                onClick={() => navClick('shop')}
                className="px-4 py-3 rounded-lg bg-[#0d1017]/90 hover:bg-[#161b26] border border-white/10 hover:border-amber-500/50 text-zinc-100 font-semibold text-sm flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0" />
                <span>TIENDA</span>
              </button>

              <button
                onClick={() => navClick('championships')}
                className="px-4 py-3 rounded-lg bg-[#0d1017]/90 hover:bg-[#161b26] border border-white/10 hover:border-red-500/50 text-zinc-100 font-semibold text-sm flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-red-400 shrink-0" />
                <span>CAMPEONATOS</span>
              </button>

              <button
                onClick={() => navClick('settings')}
                className="px-4 py-3 rounded-lg bg-[#0d1017]/90 hover:bg-[#161b26] border border-white/10 hover:border-white/30 text-zinc-100 font-semibold text-sm flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4 text-zinc-300 shrink-0" />
                <span>CONFIGURACIÓN</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Bottom-Right Subtle Controls Reminder */}
        <div className="hidden md:block bg-[#0d1017]/85 border border-white/10 px-4 py-2.5 rounded-lg text-xs text-zinc-400">
          Controles: WASD o Flechas · Shift Nitro · Espacio Derrape · C Cámara
        </div>
      </div>

      {/* Modals for Daily Rewards / Missions / Achievements */}
      {modalTab && (
        <div className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-xl bg-[#0e1118] border border-white/15 rounded-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalTab('daily')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                    modalTab === 'daily'
                      ? 'bg-red-600 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Recompensa Diaria
                </button>
                <button
                  onClick={() => setModalTab('missions')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                    modalTab === 'missions'
                      ? 'bg-red-600 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Misiones
                </button>
                <button
                  onClick={() => setModalTab('achievements')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                    modalTab === 'achievements'
                      ? 'bg-red-600 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Logros
                </button>
              </div>
              <button
                onClick={() => setModalTab(null)}
                className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scroll space-y-3">
              {modalTab === 'daily' && (
                <>
                  <p className="text-sm text-zinc-300 mb-3">
                    Inicia sesión cada día para reclamar monedas y experiencia. Racha actual:{' '}
                    <span className="font-mono-tabular font-bold text-amber-400">
                      {progress.dailyStreak} días
                    </span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {DAILY_REWARDS.map((r) => {
                      const claimed = r.day <= progress.dailyStreak;
                      const isNext = r.day === (progress.dailyStreak % 7) + 1 && dailyAvailable;
                      return (
                        <div
                          key={r.day}
                          className={`p-3 rounded-lg border text-center ${
                            isNext
                              ? 'bg-amber-500/15 border-amber-400'
                              : claimed
                                ? 'bg-zinc-900/60 border-white/10 opacity-60'
                                : 'bg-zinc-900/90 border-white/10'
                          }`}
                        >
                          <div className="text-xs text-zinc-400">Día {r.day}</div>
                          <div className="font-mono-tabular font-bold text-amber-400 text-sm mt-1">
                            +{formatCoins(r.coins)}
                          </div>
                          <div className="font-mono-tabular text-xs text-sky-400">
                            +{r.xp} XP
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-3 flex justify-end">
                    <button
                      disabled={!dailyAvailable}
                      onClick={() => {
                        soundEngine.playClick();
                        onClaimDaily();
                      }}
                      className={`px-5 py-2.5 rounded-lg text-sm font-bold cursor-pointer ${
                        dailyAvailable
                          ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      {dailyAvailable ? 'Reclamar Recompensa Hoy' : 'Ya Reclamada Hoy'}
                    </button>
                  </div>
                </>
              )}

              {modalTab === 'missions' &&
                MISSIONS.map((m) => {
                  const val = getMissionProgressValue(progress, m.type);
                  const pct = Math.min(100, Math.round((val / m.target) * 100));
                  const isClaimed = progress.claimedMissions.includes(m.id);
                  const canClaim = !isClaimed && val >= m.target;
                  return (
                    <div
                      key={m.id}
                      className="p-4 rounded-lg bg-zinc-900/80 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-white">{m.title}</div>
                        <div className="text-xs text-zinc-400 mt-0.5">{m.description}</div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-sky-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono-tabular text-xs text-zinc-300">
                            {Math.min(val, m.target)}/{m.target}
                          </span>
                        </div>
                      </div>
                      <button
                        disabled={!canClaim}
                        onClick={() => {
                          soundEngine.playClick();
                          onClaimMission(m.id);
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold shrink-0 cursor-pointer ${
                          isClaimed
                            ? 'bg-zinc-800 text-zinc-500 cursor-default'
                            : canClaim
                              ? 'bg-sky-500 hover:bg-sky-400 text-zinc-950'
                              : 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                        }`}
                      >
                        {isClaimed
                          ? 'Completada'
                          : canClaim
                            ? `Reclamar +${formatCoins(m.rewardCoins)}`
                            : `+${formatCoins(m.rewardCoins)} monedas`}
                      </button>
                    </div>
                  );
                })}

              {modalTab === 'achievements' &&
                ACHIEVEMENTS.map((a) => {
                  const unlocked = progress.unlockedAchievements.includes(a.id);
                  return (
                    <div
                      key={a.id}
                      className={`p-4 rounded-lg border flex items-center justify-between gap-3 ${
                        unlocked
                          ? 'bg-red-950/25 border-red-500/40'
                          : 'bg-zinc-900/70 border-white/10 opacity-75'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm text-white">{a.title}</div>
                        <div className="text-xs text-zinc-400 mt-0.5">{a.description}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono-tabular text-xs font-bold text-amber-400">
                          +{formatCoins(a.rewardCoins)} monedas
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {unlocked ? 'Desbloqueado' : 'Bloqueado'}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
