export type ScreenState =
  | 'menu'
  | 'race_setup'
  | 'racing'
  | 'garage'
  | 'shop'
  | 'championships'
  | 'settings';

export type RarityTier = 'Común' | 'Raro' | 'Épico' | 'Legendario' | 'Mítico';

export type CarArchetype =
  | 'aerodynamic_gt'
  | 'cyber_wedge'
  | 'muscle_coupe'
  | 'hyper_blade'
  | 'rally_evo'
  | 'formula_apex'
  | 'twin_turbo_r'
  | 'stealth_interceptor'
  | 'concept_volt'
  | 'apex_legend';

export type PaintFinish = 'metallic' | 'matte' | 'pearl';

export interface VehicleStats {
  topSpeed: number; // 0..100 normalized rating
  acceleration: number;
  braking: number;
  handling: number;
  nitro: number;
}

export interface VehicleSpec {
  id: string;
  name: string;
  brand: string;
  archetype: CarArchetype;
  rarity: RarityTier;
  price: number;
  defaultColor: string;
  accentColor: string;
  description: string;
  stats: VehicleStats;
}

export type UpgradeKey = 'engine' | 'turbo' | 'brakes' | 'suspension';

export interface VehicleUpgrades {
  engine: number; // 0..5
  turbo: number; // 0..5
  brakes: number; // 0..5
  suspension: number; // 0..5
}

export interface VehicleCustomization {
  color: string;
  finish: PaintFinish;
  upgrades: VehicleUpgrades;
}

export type TrackId =
  | 'futuristic_city'
  | 'desert'
  | 'tropical_coast'
  | 'mountains'
  | 'futuristic_highway';

export type DifficultyLevel = 'Fácil' | 'Normal' | 'Difícil' | 'Extremo';

export interface TrackSpec {
  id: TrackId;
  name: string;
  subtitle: string;
  lapsDefault: number;
  roadWidth: number;
  difficultyLabel: string;
  rewardBase: number;
  skyColor: string;
  fogColor: string;
  fogDensity: number;
  ambientSky: string;
  ambientGround: string;
  sunColor: string;
  sunIntensity: number;
  accentNeon: string;
  controlPoints: Array<[number, number, number]>;
}

export interface ChampionshipSpec {
  id: string;
  name: string;
  subtitle: string;
  difficulty: DifficultyLevel;
  tracks: TrackId[];
  lapsPerRace: number;
  entryRequirementLevel: number;
  prizeCoins: number;
  prizeXp: number;
  badgeColor: string;
}

export interface ChampionshipProgress {
  championshipId: string;
  currentRaceIndex: number;
  pointsByRacer: Record<string, number>;
  completed: boolean;
  bestRank: number | null;
}

export interface MissionSpec {
  id: string;
  title: string;
  description: string;
  type: 'races' | 'wins' | 'drifts' | 'nitro' | 'podiums';
  target: number;
  rewardCoins: number;
  rewardXp: number;
}

export interface AchievementSpec {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
  rewardXp: number;
  check: (progress: PlayerProgress) => boolean;
}

export interface GameSettings {
  masterVolume: number; // 0..1
  sfxVolume: number; // 0..1
  shadows: boolean;
  particles: boolean;
  touchControls: 'auto' | 'always' | 'off';
  cameraMode: 'chase' | 'far' | 'hood';
}

export interface PlayerProgress {
  coins: number;
  xp: number;
  level: number;
  ownedVehicleIds: string[];
  selectedVehicleId: string;
  customizations: Record<string, VehicleCustomization>;
  trackRecords: Partial<Record<TrackId, number>>; // best total race time in seconds
  totalRaces: number;
  totalWins: number;
  totalPodiums: number;
  totalDriftMeters: number;
  totalNitroSeconds: number;
  claimedMissions: string[];
  unlockedAchievements: string[];
  dailyStreak: number;
  lastDailyClaimDate: string | null; // YYYY-MM-DD
  championships: Record<string, ChampionshipProgress>;
  activeChampionshipId: string | null;
  settings: GameSettings;
}

export interface RacerHudEntry {
  id: string;
  name: string;
  isPlayer: boolean;
  position: number;
  lap: number;
  totalLaps: number;
  progressNormalized: number; // lap + s
  color: string;
  finished: boolean;
  finishTime: number;
}

export interface RaceTelemetry {
  countdown: number; // >0 counting down, 0 = GO!, -1 = racing
  speedKmh: number;
  rpmRatio: number; // 0..1
  gear: number;
  nitro: number; // 0..100
  isNitroActive: boolean;
  isDrifting: boolean;
  driftScore: number;
  lap: number;
  totalLaps: number;
  position: number;
  totalRacers: number;
  raceTime: number;
  currentLapTime: number;
  bestLapTime: number | null;
  wrongWay: boolean;
  standings: RacerHudEntry[];
  minimapPoints: Array<{ x: number; z: number }>;
  minimapRacers: Array<{ x: number; z: number; isPlayer: boolean; color: string }>;
}

export interface RaceFinishSummary {
  trackId: TrackId;
  difficulty: DifficultyLevel;
  laps: number;
  playerPosition: number;
  totalTime: number;
  bestLapTime: number | null;
  driftMeters: number;
  nitroSeconds: number;
  coinsEarned: number;
  positionBonus: number;
  driftBonus: number;
  xpEarned: number;
  newRecord: boolean;
  standings: RacerHudEntry[];
  newlyUnlockedAchievements: string[];
  championshipId?: string | null;
}

export interface RaceConfig {
  trackId: TrackId;
  difficulty: DifficultyLevel;
  laps: number;
  championshipId?: string | null;
}
