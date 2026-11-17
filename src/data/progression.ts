import {
  AchievementSpec,
  ChampionshipSpec,
  MissionSpec,
  PaintFinish,
  UpgradeKey,
} from '../types/game';

export const CHAMPIONSHIPS: ChampionshipSpec[] = [
  {
    id: 'champ_neon_cup',
    name: 'Copa Neón Nocturna',
    subtitle: 'Serie urbana y costera ideal para pilotos en ascenso.',
    difficulty: 'Normal',
    tracks: ['futuristic_city', 'tropical_coast', 'futuristic_highway'],
    lapsPerRace: 3,
    entryRequirementLevel: 1,
    prizeCoins: 5500,
    prizeXp: 650,
    badgeColor: '#00d2ff',
  },
  {
    id: 'champ_horizon_tour',
    name: 'Tour Horizonte Extremo',
    subtitle: 'Duelo de resistencia entre cañones desérticos y pasos alpinos.',
    difficulty: 'Difícil',
    tracks: ['desert', 'mountains', 'tropical_coast'],
    lapsPerRace: 3,
    entryRequirementLevel: 2,
    prizeCoins: 11000,
    prizeXp: 1200,
    badgeColor: '#f59e0b',
  },
  {
    id: 'champ_apex_world',
    name: 'Serie Mundial Apex',
    subtitle: 'Los 5 circuitos oficiales contra la IA más agresiva del planeta.',
    difficulty: 'Extremo',
    tracks: [
      'futuristic_city',
      'desert',
      'tropical_coast',
      'mountains',
      'futuristic_highway',
    ],
    lapsPerRace: 3,
    entryRequirementLevel: 3,
    prizeCoins: 24000,
    prizeXp: 2600,
    badgeColor: '#ef4444',
  },
];

export const MISSIONS: MissionSpec[] = [
  {
    id: 'm_first_race',
    title: 'Bautismo de Asfalto',
    description: 'Completa 1 carrera oficial en cualquier circuito.',
    type: 'races',
    target: 1,
    rewardCoins: 800,
    rewardXp: 150,
  },
  {
    id: 'm_first_win',
    title: 'Rey del Podio',
    description: 'Consigue tu primera victoria en 1.er lugar.',
    type: 'wins',
    target: 1,
    rewardCoins: 1500,
    rewardXp: 250,
  },
  {
    id: 'm_drift_500',
    title: 'Maestro del Derrape',
    description: 'Acumula 500 metros de derrape controlado.',
    type: 'drifts',
    target: 500,
    rewardCoins: 1800,
    rewardXp: 300,
  },
  {
    id: 'm_nitro_30',
    title: 'Adicción al Nitro',
    description: 'Activa el nitro durante un total de 30 segundos.',
    type: 'nitro',
    target: 30,
    rewardCoins: 2000,
    rewardXp: 320,
  },
  {
    id: 'm_wins_5',
    title: 'Dominio Absoluto',
    description: 'Gana 5 carreras contra rivales con IA.',
    type: 'wins',
    target: 5,
    rewardCoins: 4500,
    rewardXp: 600,
  },
  {
    id: 'm_races_10',
    title: 'Veterano de Pista',
    description: 'Completa 10 carreras en cualquier modo.',
    type: 'races',
    target: 10,
    rewardCoins: 5000,
    rewardXp: 700,
  },
];

export const ACHIEVEMENTS: AchievementSpec[] = [
  {
    id: 'ach_collector_3',
    title: 'Garaje en Marcha',
    description: 'Posee 3 vehículos diferentes en tu colección.',
    rewardCoins: 2000,
    rewardXp: 300,
    check: (p) => p.ownedVehicleIds.length >= 3,
  },
  {
    id: 'ach_collector_6',
    title: 'Escudería de Élite',
    description: 'Desbloquea 6 vehículos deportivos.',
    rewardCoins: 6000,
    rewardXp: 800,
    check: (p) => p.ownedVehicleIds.length >= 6,
  },
  {
    id: 'ach_max_upgrade',
    title: 'Ingeniería al Límite',
    description: 'Lleva cualquier mejora de un auto al nivel máximo (5/5).',
    rewardCoins: 2500,
    rewardXp: 400,
    check: (p) =>
      Object.values(p.customizations).some(
        (c) =>
          c.upgrades.engine >= 5 ||
          c.upgrades.turbo >= 5 ||
          c.upgrades.brakes >= 5 ||
          c.upgrades.suspension >= 5,
      ),
  },
  {
    id: 'ach_level_5',
    title: 'Piloto Profesional',
    description: 'Alcanza el nivel 5 de experiencia.',
    rewardCoins: 3500,
    rewardXp: 0,
    check: (p) => p.level >= 5,
  },
  {
    id: 'ach_champion',
    title: 'Campeón Oficial',
    description: 'Finaliza en 1.er lugar en cualquier campeonato.',
    rewardCoins: 8000,
    rewardXp: 1000,
    check: (p) =>
      Object.values(p.championships).some((c) => c.completed && c.bestRank === 1),
  },
];

export const DAILY_REWARDS = [
  { day: 1, coins: 750, xp: 100 },
  { day: 2, coins: 1100, xp: 150 },
  { day: 3, coins: 1500, xp: 200 },
  { day: 4, coins: 2000, xp: 250 },
  { day: 5, coins: 2600, xp: 350 },
  { day: 6, coins: 3500, xp: 450 },
  { day: 7, coins: 6000, xp: 800 },
];

export const PAINT_COLORS = [
  { name: 'Rojo Racing', hex: '#e11d48' },
  { name: 'Azul Eléctrico', hex: '#0ea5e9' },
  { name: 'Negro Obsidiana', hex: '#18181b' },
  { name: 'Plata Titanio', hex: '#cbd5e1' },
  { name: 'Ámbar Solar', hex: '#f59e0b' },
  { name: 'Verde Esmeralda', hex: '#10b981' },
  { name: 'Cobalto Profundo', hex: '#2563eb' },
  { name: 'Blanco Polar', hex: '#f8fafc' },
  { name: 'Carmesí Oscuro', hex: '#991b1b' },
  { name: 'Cian Neón', hex: '#06b6d4' },
];

export const PAINT_FINISHES: Array<{ id: PaintFinish; label: string }> = [
  { id: 'metallic', label: 'Metálico' },
  { id: 'matte', label: 'Mate' },
  { id: 'pearl', label: 'Perlado' },
];

export const UPGRADE_CATALOG: Array<{
  key: UpgradeKey;
  label: string;
  description: string;
  statAffected: string;
  baseCost: number;
}> = [
  {
    key: 'engine',
    label: 'Motor',
    description: 'Aumenta la velocidad máxima y potencia en recta.',
    statAffected: 'Velocidad Máx.',
    baseCost: 900,
  },
  {
    key: 'turbo',
    label: 'Turbo y Nitro',
    description: 'Mejora la aceleración inicial y capacidad de nitro.',
    statAffected: 'Aceleración / Nitro',
    baseCost: 850,
  },
  {
    key: 'brakes',
    label: 'Frenos',
    description: 'Frenada más corta y precisa antes de las horquillas.',
    statAffected: 'Frenado',
    baseCost: 700,
  },
  {
    key: 'suspension',
    label: 'Suspensión',
    description: 'Mayor agarre lateral y estabilidad al derrapar.',
    statAffected: 'Manejo',
    baseCost: 800,
  },
];

export function getUpgradeCost(baseCost: number, currentLevel: number): number {
  return Math.round(baseCost * Math.pow(1.45, currentLevel));
}
