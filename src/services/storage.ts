import {
  ACHIEVEMENTS,
  DAILY_REWARDS,
  MISSIONS,
} from '../data/progression';
import { getVehicleById, VEHICLES } from '../data/vehicles';
import {
  PlayerProgress,
  VehicleCustomization,
  VehicleStats,
} from '../types/game';

const STORAGE_KEY = 'speed_race_ultimate_save_v1';

export function xpRequiredForLevel(level: number): number {
  return Math.round(450 * Math.pow(level, 1.35));
}

export function createDefaultCustomization(vehicleId: string): VehicleCustomization {
  const spec = getVehicleById(vehicleId);
  return {
    color: spec.defaultColor,
    finish: 'metallic',
    upgrades: {
      engine: 0,
      turbo: 0,
      brakes: 0,
      suspension: 0,
    },
  };
}

export function createDefaultProgress(): PlayerProgress {
  const starter = VEHICLES[0];
  return {
    coins: 2500,
    xp: 0,
    level: 1,
    ownedVehicleIds: [starter.id],
    selectedVehicleId: starter.id,
    customizations: {
      [starter.id]: createDefaultCustomization(starter.id),
    },
    trackRecords: {},
    totalRaces: 0,
    totalWins: 0,
    totalPodiums: 0,
    totalDriftMeters: 0,
    totalNitroSeconds: 0,
    claimedMissions: [],
    unlockedAchievements: [],
    dailyStreak: 0,
    lastDailyClaimDate: null,
    championships: {},
    activeChampionshipId: null,
    settings: {
      masterVolume: 0.7,
      sfxVolume: 0.8,
      shadows: true,
      particles: true,
      touchControls: 'auto',
      cameraMode: 'chase',
    },
  };
}

export function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProgress();
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    const defaults = createDefaultProgress();
    return {
      ...defaults,
      ...parsed,
      settings: {
        ...defaults.settings,
        ...(parsed.settings ?? {}),
      },
      customizations: {
        ...defaults.customizations,
        ...(parsed.customizations ?? {}),
      },
      trackRecords: {
        ...(parsed.trackRecords ?? {}),
      },
      championships: {
        ...(parsed.championships ?? {}),
      },
    };
  } catch {
    return createDefaultProgress();
  }
}

export function saveProgress(progress: PlayerProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota issues safely
  }
}

export function resetProgressStorage(): PlayerProgress {
  const fresh = createDefaultProgress();
  saveProgress(fresh);
  return fresh;
}

export function getEffectiveVehicleStats(
  vehicleId: string,
  customization?: VehicleCustomization,
): VehicleStats {
  const base = getVehicleById(vehicleId).stats;
  const up = customization?.upgrades ?? {
    engine: 0,
    turbo: 0,
    brakes: 0,
    suspension: 0,
  };
  return {
    topSpeed: Math.min(115, base.topSpeed + up.engine * 3.2 + up.turbo * 1.0),
    acceleration: Math.min(115, base.acceleration + up.turbo * 3.0 + up.engine * 1.4),
    braking: Math.min(115, base.braking + up.brakes * 3.6),
    handling: Math.min(115, base.handling + up.suspension * 3.5),
    nitro: Math.min(115, base.nitro + up.turbo * 3.8),
  };
}

export function addXpAndLevelUp(
  progress: PlayerProgress,
  xpGain: number,
): PlayerProgress {
  let xp = progress.xp + Math.max(0, Math.round(xpGain));
  let level = progress.level;
  while (xp >= xpRequiredForLevel(level)) {
    xp -= xpRequiredForLevel(level);
    level += 1;
  }
  return { ...progress, xp, level };
}

export function evaluateNewAchievements(
  progress: PlayerProgress,
): { updated: PlayerProgress; unlockedIds: string[] } {
  let next = { ...progress };
  const newlyUnlocked: string[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (!next.unlockedAchievements.includes(ach.id) && ach.check(next)) {
      newlyUnlocked.push(ach.id);
      next.unlockedAchievements = [...next.unlockedAchievements, ach.id];
      next.coins += ach.rewardCoins;
      next = addXpAndLevelUp(next, ach.rewardXp);
    }
  }
  return { updated: next, unlockedIds: newlyUnlocked };
}

export function getTodayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function canClaimDailyReward(progress: PlayerProgress): boolean {
  return progress.lastDailyClaimDate !== getTodayIsoDate();
}

export function claimDailyReward(progress: PlayerProgress): {
  updated: PlayerProgress;
  reward: { day: number; coins: number; xp: number } | null;
} {
  if (!canClaimDailyReward(progress)) {
    return { updated: progress, reward: null };
  }
  const nextStreak = (progress.dailyStreak % DAILY_REWARDS.length) + 1;
  const reward = DAILY_REWARDS[nextStreak - 1];
  let updated: PlayerProgress = {
    ...progress,
    coins: progress.coins + reward.coins,
    dailyStreak: nextStreak,
    lastDailyClaimDate: getTodayIsoDate(),
  };
  updated = addXpAndLevelUp(updated, reward.xp);
  const evalRes = evaluateNewAchievements(updated);
  saveProgress(evalRes.updated);
  return { updated: evalRes.updated, reward };
}

export function getMissionProgressValue(
  progress: PlayerProgress,
  type: (typeof MISSIONS)[number]['type'],
): number {
  switch (type) {
    case 'races':
      return progress.totalRaces;
    case 'wins':
      return progress.totalWins;
    case 'podiums':
      return progress.totalPodiums;
    case 'drifts':
      return Math.round(progress.totalDriftMeters);
    case 'nitro':
      return Math.round(progress.totalNitroSeconds);
  }
}
