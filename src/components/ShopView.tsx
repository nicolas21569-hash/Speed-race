import { ArrowLeft, Check, Coins, Lock, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { getVehicleById, VEHICLES } from '../data/vehicles';
import { createDefaultCustomization } from '../services/storage';
import { PlayerProgress } from '../types/game';
import { formatCoins, getRarityAccent } from '../utils/format';
import { ShowcaseViewport } from './ShowcaseViewport';

interface ShopViewProps {
  progress: PlayerProgress;
  onBack: () => void;
  onBuyVehicle: (vehicleId: string) => void;
  onSelectVehicle: (vehicleId: string) => void;
}

export function ShopView({
  progress,
  onBack,
  onBuyVehicle,
  onSelectVehicle,
}: ShopViewProps) {
  const [previewId, setPreviewId] = useState<string>(VEHICLES[1].id);
  const spec = getVehicleById(previewId);
  const custom = progress.customizations[previewId] ?? createDefaultCustomization(previewId);
  const owned = progress.ownedVehicleIds.includes(previewId);
  const equipped = progress.selectedVehicleId === previewId;
  const canAfford = progress.coins >= spec.price;

  return (
    <div className="relative w-full h-full bg-[#090b12] overflow-hidden">
      <ShowcaseViewport
        mode="garage_studio"
        vehicleId={previewId}
        color={custom.color}
        finish={custom.finish}
      />

      {/* Top Header */}
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
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              <h2 className="font-display font-bold text-lg text-white leading-none">
                Concesionario Oficial
              </h2>
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              10 Deportivos · Vista previa 3D interactiva
            </div>
          </div>
        </div>

        <div className="pointer-events-auto bg-[#0d1017]/90 border border-white/10 px-4 py-2.5 rounded-xl flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="font-mono-tabular font-bold text-base text-white">
            {formatCoins(progress.coins)}
          </span>
        </div>
      </div>

      {/* Bottom Dock: Vehicle Specs + 10-Car Catalog */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 w-[min(1020px,95vw)] pointer-events-auto bg-[#0d1017]/94 border border-white/15 rounded-xl p-4 shadow-2xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div className="max-w-lg">
            <div className="flex items-center gap-2.5">
              <h3 className="font-display font-bold text-xl text-white">
                {spec.name}
              </h3>
              <span className={`text-xs font-semibold ${getRarityAccent(spec.rarity)}`}>
                {spec.rarity}
              </span>
              <span className="text-xs text-zinc-400">· {spec.brand}</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">{spec.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="grid grid-cols-5 gap-3 text-center">
              {[
                ['VEL', spec.stats.topSpeed],
                ['ACE', spec.stats.acceleration],
                ['FRE', spec.stats.braking],
                ['MAN', spec.stats.handling],
                ['NIT', spec.stats.nitro],
              ].map(([k, val]) => (
                <div key={String(k)}>
                  <div className="text-[10px] text-zinc-400">{k}</div>
                  <div className="font-mono-tabular font-bold text-sm text-sky-400">
                    {val}
                  </div>
                </div>
              ))}
            </div>

            {owned ? (
              <button
                disabled={equipped}
                onClick={() => {
                  soundEngine.playClick();
                  onSelectVehicle(spec.id);
                }}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  equipped
                    ? 'bg-emerald-600/25 border border-emerald-500/40 text-emerald-300 cursor-default'
                    : 'bg-sky-500 hover:bg-sky-400 text-zinc-950'
                }`}
              >
                <Check className="w-4 h-4" />
                {equipped ? 'Equipado' : 'Equipar Auto'}
              </button>
            ) : (
              <button
                disabled={!canAfford}
                onClick={() => {
                  soundEngine.playClick();
                  onBuyVehicle(spec.id);
                }}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  canAfford
                    ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                {canAfford ? (
                  <Coins className="w-4 h-4" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>Comprar · {formatCoins(spec.price)}</span>
              </button>
            )}
          </div>
        </div>

        {/* Horizontal Scrollable 10-Car Picker */}
        <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1 custom-scroll">
          {VEHICLES.map((v) => {
            const isOwned = progress.ownedVehicleIds.includes(v.id);
            const active = v.id === previewId;
            return (
              <button
                key={v.id}
                onClick={() => {
                  soundEngine.playClick();
                  setPreviewId(v.id);
                }}
                className={`min-w-[175px] p-3 rounded-lg border text-left shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-red-600/15 border-red-500'
                    : 'bg-zinc-900/80 border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-xs text-white truncate">
                    {v.name}
                  </span>
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                    style={{ backgroundColor: v.defaultColor }}
                  />
                </div>
                <div className="text-[11px] mt-1 flex items-center justify-between">
                  <span className={getRarityAccent(v.rarity)}>{v.rarity}</span>
                  <span className="font-mono-tabular text-amber-400 font-semibold">
                    {isOwned ? 'En Garaje' : formatCoins(v.price)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
