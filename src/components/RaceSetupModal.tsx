import { ArrowLeft, Flag, Play } from 'lucide-react';
import { useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { TRACKS } from '../data/tracks';
import { getVehicleById } from '../data/vehicles';
import {
  DifficultyLevel,
  PlayerProgress,
  RaceConfig,
  TrackId,
} from '../types/game';
import { formatCoins, formatRaceTime } from '../utils/format';

interface RaceSetupModalProps {
  progress: PlayerProgress;
  onBack: () => void;
  onStartRace: (config: RaceConfig) => void;
}

const DIFFICULTIES: DifficultyLevel[] = ['Fácil', 'Normal', 'Difícil', 'Extremo'];

export function RaceSetupModal({
  progress,
  onBack,
  onStartRace,
}: RaceSetupModalProps) {
  const [selectedTrack, setSelectedTrack] = useState<TrackId>('futuristic_city');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Normal');
  const [laps, setLaps] = useState<number>(3);

  const track = TRACKS.find((t) => t.id === selectedTrack) ?? TRACKS[0];
  const car = getVehicleById(progress.selectedVehicleId);
  const record = progress.trackRecords[selectedTrack] ?? null;

  return (
    <div className="relative z-20 w-full h-full bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#0d1017] border border-white/15 rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
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
              <h2 className="font-display font-bold text-xl text-white">
                Configurar Carrera Rápida
              </h2>
              <div className="text-xs text-zinc-400">
                Vehículo seleccionado: {car.name}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scroll grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Circuit List */}
          <div className="lg:col-span-7 space-y-2.5">
            <div className="text-xs font-semibold text-zinc-400 mb-2">
              Selecciona Circuito (5 Escenarios 3D)
            </div>
            {TRACKS.map((t) => {
              const active = t.id === selectedTrack;
              const best = progress.trackRecords[t.id];
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    soundEngine.playClick();
                    setSelectedTrack(t.id);
                    setLaps(t.lapsDefault);
                  }}
                  className={`w-full text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'bg-red-600/15 border-red-500'
                      : 'bg-zinc-900/70 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-base text-white">
                      {t.name}
                    </span>
                    <span className="font-mono-tabular text-xs text-amber-400 font-semibold">
                      +{formatCoins(t.rewardBase)} base
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{t.subtitle}</p>
                  <div className="mt-2 text-xs text-zinc-500 flex items-center gap-2">
                    <span>{t.difficultyLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">
                      Récord: {best ? formatRaceTime(best) : 'Sin marca'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Panel: Settings & Launch */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-5 bg-zinc-900/60 border border-white/10 rounded-xl p-5">
            <div className="space-y-5">
              <div>
                <div className="text-xs font-semibold text-zinc-400 mb-2">
                  Dificultad de la IA (3 Rivales)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        soundEngine.playClick();
                        setDifficulty(d);
                      }}
                      className={`px-3 py-2.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                        difficulty === d
                          ? 'bg-sky-500 text-zinc-950 border-sky-400'
                          : 'bg-zinc-900 text-zinc-300 border-white/10 hover:border-white/25'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-400 mb-2">
                  Número de Vueltas
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[2, 3, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        soundEngine.playClick();
                        setLaps(n);
                      }}
                      className={`px-3 py-2.5 rounded-lg text-xs font-mono-tabular font-bold border cursor-pointer ${
                        laps === n
                          ? 'bg-red-600 text-white border-red-500'
                          : 'bg-zinc-900 text-zinc-300 border-white/10 hover:border-white/25'
                      }`}
                    >
                      {n} Vueltas
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-1.5 text-xs text-zinc-300">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Circuito</span>
                  <span className="font-semibold text-white">{track.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Mejor Tiempo</span>
                  <span className="font-mono-tabular text-sky-400">
                    {formatRaceTime(record)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Recompensa Est. 1.º</span>
                  <span className="font-mono-tabular text-amber-400 font-bold">
                    +{formatCoins(track.rewardBase + 500)} monedas
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                soundEngine.playClick();
                onStartRace({
                  trackId: selectedTrack,
                  difficulty,
                  laps,
                });
              }}
              className="w-full py-3.5 px-5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-display font-bold text-lg flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Flag className="w-5 h-5" />
              <span>INICIAR CARRERA</span>
              <Play className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
