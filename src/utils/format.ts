import { RarityTier } from '../types/game';

export function formatRaceTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return '--:--.--';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds * 100) % 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export function formatCoins(amount: number): string {
  return Math.round(amount).toLocaleString('es-ES');
}

export function getRarityAccent(rarity: RarityTier): string {
  switch (rarity) {
    case 'Común':
      return 'text-zinc-300';
    case 'Raro':
      return 'text-sky-400';
    case 'Épico':
      return 'text-amber-400';
    case 'Legendario':
      return 'text-red-400';
    case 'Mítico':
      return 'text-cyan-300';
  }
}
