import { ArrowLeft, Coins, Lock, Play, Trophy } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { CHAMPIONSHIPS } from '../data/progression';
import { getTrackById } from '../data/tracks';
import { ChampionshipSpec, PlayerProgress } from '../types/game';
import { formatCoins } from '../utils/format';

interface ChampionshipsViewProps {
  progress: PlayerProgress;
  onBack: () => void;
  onStartChampionshipRace: (championship: ChampionshipSpec) => void;
}

export function ChampionshipsView({
  progress,
  onBack,
  onStartChampionshipRace,
}: ChampionshipsViewProps) {
  return (
    <div className="relative z-20 w-full h-full bg-[#08090d]/92 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl bg-[#0d1017] border border-white/15 rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                soundEngine.playClick();
                onBack();
              }}
              className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 cursor-pointer"
              aria-label="Volver"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-red-500" />
                Campeonatos Oficiales
              </h2>
              <div className="text-xs text-zinc-400">
                Compite en series de múltiples circuitos y gana grandes premios
              </div>
            </div>
          </div>

          <div className="text-xs text-zinc-300 font-mono-tabular">
            Nivel actual: {progress.level}
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scroll grid grid-cols-1 md:grid-cols-3 gap-5">
          {CHAMPIONSHIPS.map((champ) => {
            const locked = progress.level < champ.entryRequirementLevel;
            const cProg = progress.championships[champ.id];
            const currentStage = cProg ? cProg.currentRaceIndex : 0;
            const playerPts = cProg?.pointsByRacer?.player ?? 0;

            return (
              <div
                key={champ.id}
                className="bg-zinc-900/80 border border-white/10 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-bold"
                      style={{ color: champ.badgeColor }}
                    >
                      {champ.difficulty}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono-tabular">
                      Nv. req. {champ.entryRequirementLevel}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display font-bold text-lg text-white">
                      {champ.name}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">{champ.subtitle}</p>
                  </div>

                  <div className="pt-2 border-t border-white/10 space-y-1.5">
                    <div className="text-xs font-semibold text-zinc-300">
                      Etapas ({champ.tracks.length} carreras · {champ.lapsPerRace} vueltas)
                    </div>
                    {champ.tracks.map((tid, idx) => {
                      const t = getTrackById(tid);
                      const done = cProg && !cProg.completed && idx < currentStage;
                      const current = cProg && !cProg.completed && idx === currentStage;
                      return (
                        <div
                          key={`${champ.id}_${idx}`}
                          className={`text-xs flex items-center justify-between ${
                            current
                              ? 'text-sky-400 font-semibold'
                              : done
                                ? 'text-emerald-400'
                                : 'text-zinc-400'
                          }`}
                        >
                          <span>
                            {idx + 1}. {t.name}
                          </span>
                          <span>{done ? 'OK' : current ? 'Siguiente' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Premio Campeón</span>
                    <span className="font-mono-tabular font-bold text-amber-400 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" />
                      {formatCoins(champ.prizeCoins)}
                    </span>
                  </div>

                  {cProg && !cProg.completed && currentStage > 0 && (
                    <div className="text-xs text-sky-400 font-mono-tabular">
                      Puntos acumulados: {playerPts} pts
                    </div>
                  )}

                  {cProg?.completed && (
                    <div className="text-xs text-emerald-400 font-semibold">
                      Mejor resultado: {cProg.bestRank ?? '-'}º lugar
                    </div>
                  )}

                  <button
                    disabled={locked}
                    onClick={() => {
                      soundEngine.playClick();
                      onStartChampionshipRace(champ);
                    }}
                    className={`w-full py-2.5 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 cursor-pointer ${
                      locked
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                  >
                    {locked ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Requiere Nivel {champ.entryRequirementLevel}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>
                          {cProg && !cProg.completed && currentStage > 0
                            ? `Continuar (Carrera ${currentStage + 1}/${champ.tracks.length})`
                            : 'Iniciar Campeonato'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
