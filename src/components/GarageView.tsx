import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  Paintbrush,
  Sliders,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import {
  getUpgradeCost,
  PAINT_COLORS,
  PAINT_FINISHES,
  UPGRADE_CATALOG,
} from '../data/progression';
import { getVehicleById, VEHICLES } from '../data/vehicles';
import {
  createDefaultCustomization,
  getEffectiveVehicleStats,
} from '../services/storage';
import {
  PaintFinish,
  PlayerProgress,
  UpgradeKey,
} from '../types/game';
import { formatCoins, getRarityAccent } from '../utils/format';
import { ShowcaseViewport } from './ShowcaseViewport';

interface GarageViewProps {
  progress: PlayerProgress;
  onBack: () => void;
  onOpenShop: () => void;
  onSelectVehicle: (vehicleId: string) => void;
  onUpdatePaint: (vehicleId: string, color: string, finish: PaintFinish) => void;
  onUpgrade: (vehicleId: string, key: UpgradeKey, cost: number) => void;
}

export function GarageView({
  progress,
  onBack,
  onOpenShop,
  onSelectVehicle,
  onUpdatePaint,
  onUpgrade,
}: GarageViewProps) {
  const [inspectId, setInspectId] = useState<string>(progress.selectedVehicleId);
  const [tab, setTab] = useState<'vehicles' | 'paint' | 'upgrades'>('vehicles');
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const spec = getVehicleById(inspectId);
  const custom =
    progress.customizations[inspectId] ?? createDefaultCustomization(inspectId);
  const effectiveStats = getEffectiveVehicleStats(inspectId, custom);
  const isSelected = progress.selectedVehicleId === inspectId;

  return (
    <div className="relative w-full h-full bg-[#090b12] overflow-hidden">
      {/* Interactive 3D Viewport (Drag to Rotate) */}
      <ShowcaseViewport
        mode="garage_studio"
        vehicleId={inspectId}
        color={custom.color}
        finish={custom.finish}
      />

      {/* Minimal Top Bar */}
      <div className="relative z-10 pointer-events-none flex items-center justify-between gap-4 p-4 sm:p-6">
        <div className="pointer-events-auto flex items-center gap-3 bg-[#0d1017]/90 border border-white/10 px-4 py-2.5 rounded-xl">
          <button
            onClick={() => {
              soundEngine.playClick();
              onBack();
            }}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 cursor-pointer"
            aria-label="Volver al menú"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-white leading-none">
                {spec.name}
              </h2>
              <span className={`text-xs font-semibold ${getRarityAccent(spec.rarity)}`}>
                {spec.rarity}
              </span>
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              Arrastra el modelo 3D para rotar · {spec.brand}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-3">
          <div className="bg-[#0d1017]/90 border border-white/10 px-4 py-2.5 rounded-xl flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-mono-tabular font-bold text-sm text-white">
              {formatCoins(progress.coins)}
            </span>
          </div>
          <button
            onClick={() => {
              soundEngine.playClick();
              onSelectVehicle(inspectId);
            }}
            disabled={isSelected}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              isSelected
                ? 'bg-emerald-600/25 border border-emerald-500/40 text-emerald-300 cursor-default'
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{isSelected ? 'Equipado' : 'Seleccionar Auto'}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Bottom Control Dock (Zero Central Viewport Occlusion) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 w-[min(960px,95vw)] pointer-events-auto flex flex-col items-center">
        <button
          onClick={() => {
            soundEngine.playClick();
            setDockCollapsed((c) => !c);
          }}
          className="px-4 py-1.5 rounded-t-lg bg-[#0d1017]/95 border border-b-0 border-white/15 text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Mostrar Personalización
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Ocultar Controles
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="w-full bg-[#0d1017]/94 border border-white/15 rounded-xl p-4 shadow-2xl">
            {/* Tabs + Live Compact Stat Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setTab('vehicles');
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                    tab === 'vehicles'
                      ? 'bg-red-600 text-white'
                      : 'bg-zinc-900 text-zinc-300 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" /> Mis Vehículos ({progress.ownedVehicleIds.length})
                </button>
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setTab('paint');
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                    tab === 'paint'
                      ? 'bg-red-600 text-white'
                      : 'bg-zinc-900 text-zinc-300 hover:text-white'
                  }`}
                >
                  <Paintbrush className="w-3.5 h-3.5" /> Pintura
                </button>
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setTab('upgrades');
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                    tab === 'upgrades'
                      ? 'bg-red-600 text-white'
                      : 'bg-zinc-900 text-zinc-300 hover:text-white'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" /> Mejoras
                </button>
              </div>

              {/* Tabular Stats Strip */}
              <div className="flex flex-wrap items-center gap-4 text-xs">
                {[
                  ['Vel. Máx', effectiveStats.topSpeed],
                  ['Acel.', effectiveStats.acceleration],
                  ['Frenos', effectiveStats.braking],
                  ['Manejo', effectiveStats.handling],
                  ['Nitro', effectiveStats.nitro],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex items-center gap-1.5">
                    <span className="text-zinc-400">{label}</span>
                    <span className="font-mono-tabular font-bold text-sky-400">
                      {Math.round(Number(val))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="pt-3 max-h-[30vh] overflow-y-auto custom-scroll">
              {tab === 'vehicles' && (
                <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1 custom-scroll">
                  {progress.ownedVehicleIds.map((id) => {
                    const v = getVehicleById(id);
                    const active = id === inspectId;
                    const equipped = id === progress.selectedVehicleId;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          soundEngine.playClick();
                          setInspectId(id);
                        }}
                        className={`min-w-[180px] p-3 rounded-lg border text-left transition-colors shrink-0 cursor-pointer ${
                          active
                            ? 'bg-red-600/15 border-red-500'
                            : 'bg-zinc-900/80 border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div className="font-display font-bold text-sm text-white truncate">
                          {v.name}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          <span className={getRarityAccent(v.rarity)}>{v.rarity}</span>
                          {equipped ? ' · Equipado' : ''}
                        </div>
                      </button>
                    );
                  })}
                  {progress.ownedVehicleIds.length < VEHICLES.length && (
                    <button
                      onClick={() => {
                        soundEngine.playClick();
                        onOpenShop();
                      }}
                      className="min-w-[165px] p-3 rounded-lg border border-dashed border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      + Comprar más autos en Tienda
                    </button>
                  )}
                </div>
              )}

              {tab === 'paint' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {PAINT_COLORS.map((swatch) => {
                      const active = custom.color.toLowerCase() === swatch.hex.toLowerCase();
                      return (
                        <button
                          key={swatch.hex}
                          onClick={() => {
                            soundEngine.playClick();
                            onUpdatePaint(inspectId, swatch.hex, custom.finish);
                          }}
                          title={swatch.name}
                          className={`w-9 h-9 rounded-lg border-2 transition-transform cursor-pointer ${
                            active
                              ? 'border-white scale-110'
                              : 'border-white/20 hover:scale-105'
                          }`}
                          style={{ backgroundColor: swatch.hex }}
                          aria-label={swatch.name}
                        />
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {PAINT_FINISHES.map((fin) => (
                      <button
                        key={fin.id}
                        onClick={() => {
                          soundEngine.playClick();
                          onUpdatePaint(inspectId, custom.color, fin.id);
                        }}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                          custom.finish === fin.id
                            ? 'bg-sky-500 text-zinc-950 border-sky-400'
                            : 'bg-zinc-900 text-zinc-300 border-white/10 hover:border-white/25'
                        }`}
                      >
                        {fin.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'upgrades' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {UPGRADE_CATALOG.map((u) => {
                    const lvl = custom.upgrades[u.key];
                    const maxed = lvl >= 5;
                    const cost = getUpgradeCost(u.baseCost, lvl);
                    const canAfford = progress.coins >= cost;
                    return (
                      <div
                        key={u.key}
                        className="p-3 rounded-lg bg-zinc-900/90 border border-white/10 flex flex-col justify-between gap-2.5"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-white">
                              {u.label}
                            </span>
                            <span className="font-mono-tabular text-xs text-sky-400">
                              Nv. {lvl}/5
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-1">
                            {u.description}
                          </div>
                          <div className="flex gap-1 mt-2">
                            {[1, 2, 3, 4, 5].map((step) => (
                              <div
                                key={step}
                                className={`h-1.5 flex-1 rounded-sm ${
                                  step <= lvl ? 'bg-red-500' : 'bg-zinc-800'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <button
                          disabled={maxed || !canAfford}
                          onClick={() => {
                            soundEngine.playClick();
                            onUpgrade(inspectId, u.key, cost);
                          }}
                          className={`w-full py-1.5 rounded-md text-xs font-bold font-mono-tabular cursor-pointer ${
                            maxed
                              ? 'bg-zinc-800 text-zinc-500 cursor-default'
                              : canAfford
                                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                          }`}
                        >
                          {maxed ? 'MÁXIMO' : `Mejorar · ${formatCoins(cost)}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
