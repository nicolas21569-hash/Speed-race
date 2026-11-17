import { ArrowLeft, RotateCcw, Settings, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { GameSettings } from '../types/game';

interface SettingsViewProps {
  settings: GameSettings;
  onBack: () => void;
  onUpdate: (next: GameSettings) => void;
  onResetProgress: () => void;
}

export function SettingsView({
  settings,
  onBack,
  onUpdate,
  onResetProgress,
}: SettingsViewProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  const patch = (partial: Partial<GameSettings>) => {
    const next = { ...settings, ...partial };
    soundEngine.applySettings(next);
    onUpdate(next);
  };

  return (
    <div className="relative z-20 w-full h-full bg-[#08090d]/92 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#0d1017] border border-white/15 rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
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
              <Settings className="w-5 h-5 text-sky-400" />
              Configuración
            </h2>
            <div className="text-xs text-zinc-400">
              Audio, gráficos, controles y datos guardados
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scroll space-y-6">
          {/* Audio */}
          <div className="space-y-4">
            <div className="text-xs font-semibold text-zinc-400 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-sky-400" /> Audio
            </div>
            <div className="space-y-3 bg-zinc-900/70 border border-white/10 rounded-lg p-4">
              <label className="flex items-center justify-between gap-4 text-sm text-zinc-200">
                <span>Volumen General</span>
                <div className="flex items-center gap-3 w-52">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.masterVolume}
                    onChange={(e) =>
                      patch({ masterVolume: parseFloat(e.target.value) })
                    }
                    className="w-full accent-red-500"
                  />
                  <span className="font-mono-tabular text-xs w-9 text-right">
                    {Math.round(settings.masterVolume * 100)}%
                  </span>
                </div>
              </label>

              <label className="flex items-center justify-between gap-4 text-sm text-zinc-200">
                <span>Efectos y Motor</span>
                <div className="flex items-center gap-3 w-52">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.sfxVolume}
                    onChange={(e) =>
                      patch({ sfxVolume: parseFloat(e.target.value) })
                    }
                    className="w-full accent-red-500"
                  />
                  <span className="font-mono-tabular text-xs w-9 text-right">
                    {Math.round(settings.sfxVolume * 100)}%
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Graphics & Camera */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-zinc-400">
              Gráficos y Cámara
            </div>
            <div className="bg-zinc-900/70 border border-white/10 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-sm text-zinc-200">
                <span>Sombras en tiempo real</span>
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    patch({ shadows: !settings.shadows });
                  }}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold cursor-pointer ${
                    settings.shadows
                      ? 'bg-sky-500 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {settings.shadows ? 'Activado' : 'Desactivado'}
                </button>
              </div>

              <div className="flex items-center justify-between text-sm text-zinc-200">
                <span>Partículas (Humo y Chispas)</span>
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    patch({ particles: !settings.particles });
                  }}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold cursor-pointer ${
                    settings.particles
                      ? 'bg-sky-500 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {settings.particles ? 'Activado' : 'Desactivado'}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-200 pt-1">
                <span>Cámara predeterminada</span>
                <div className="flex gap-1.5">
                  {(
                    [
                      ['chase', 'Persecución'],
                      ['far', 'Lejana'],
                      ['hood', 'Capó'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => {
                        soundEngine.playClick();
                        patch({ cameraMode: id });
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                        settings.cameraMode === id
                          ? 'bg-red-600 text-white'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-zinc-400">
              Controles Táctiles (Celulares / Android)
            </div>
            <div className="bg-zinc-900/70 border border-white/10 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-zinc-200">Botones en pantalla</span>
              <div className="flex gap-1.5">
                {(
                  [
                    ['auto', 'Automático'],
                    ['always', 'Siempre'],
                    ['off', 'Ocultar'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => {
                      soundEngine.playClick();
                      patch({ touchControls: id });
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                      settings.touchControls === id
                        ? 'bg-sky-500 text-zinc-950'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Save Management */}
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-zinc-400">
              El progreso se guarda automáticamente en este dispositivo.
            </div>
            {!confirmReset ? (
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setConfirmReset(true);
                }}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-red-950/50 border border-red-500/40 text-red-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reiniciar Progreso
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400 font-semibold">
                  ¿Borrar todo?
                </span>
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    onResetProgress();
                    setConfirmReset(false);
                  }}
                  className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-bold cursor-pointer"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
