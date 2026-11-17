import { useCallback, useEffect, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { ChampionshipsView } from './components/ChampionshipsView';
import { GarageView } from './components/GarageView';
import { MainMenu } from './components/MainMenu';
import { RaceSetupModal } from './components/RaceSetupModal';
import { RaceView } from './components/RaceView';
import { SettingsView } from './components/SettingsView';
import { ShopView } from './components/ShopView';
import { ShowcaseViewport } from './components/ShowcaseViewport';
import { CHAMPIONSHIPS, MISSIONS } from './data/progression';
import { getVehicleById } from './data/vehicles';
import {
  addXpAndLevelUp,
  claimDailyReward,
  createDefaultCustomization,
  evaluateNewAchievements,
  getMissionProgressValue,
  loadProgress,
  resetProgressStorage,
  saveProgress,
} from './services/storage';
import {
  ChampionshipSpec,
  GameSettings,
  PaintFinish,
  PlayerProgress,
  RaceConfig,
  RaceFinishSummary,
  ScreenState,
  UpgradeKey,
} from './types/game';

export default function App() {
  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const [screen, setScreen] = useState<ScreenState>('menu');
  const [activeRaceConfig, setActiveRaceConfig] = useState<RaceConfig | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    soundEngine.applySettings(progress.settings);
  }, [progress.settings]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3200);
  }, []);

  const commitProgress = useCallback((updater: (prev: PlayerProgress) => PlayerProgress) => {
    setProgress((prev) => {
      const next = updater(prev);
      saveProgress(next);
      return next;
    });
  }, []);

  const handleClaimDaily = () => {
    const res = claimDailyReward(progress);
    if (res.reward) {
      setProgress(res.updated);
      showToast(
        `Recompensa Día ${res.reward.day}: +${res.reward.coins} monedas y +${res.reward.xp} XP`,
      );
    }
  };

  const handleClaimMission = (missionId: string) => {
    const mission = MISSIONS.find((m) => m.id === missionId);
    if (!mission) return;
    if (progress.claimedMissions.includes(missionId)) return;
    if (getMissionProgressValue(progress, mission.type) < mission.target) return;

    commitProgress((prev) => {
      let next: PlayerProgress = {
        ...prev,
        coins: prev.coins + mission.rewardCoins,
        claimedMissions: [...prev.claimedMissions, missionId],
      };
      next = addXpAndLevelUp(next, mission.rewardXp);
      return evaluateNewAchievements(next).updated;
    });
    showToast(`Misión completada: +${mission.rewardCoins} monedas`);
  };

  const handleSelectVehicle = (vehicleId: string) => {
    commitProgress((prev) => ({
      ...prev,
      selectedVehicleId: vehicleId,
      customizations: {
        ...prev.customizations,
        [vehicleId]:
          prev.customizations[vehicleId] ?? createDefaultCustomization(vehicleId),
      },
    }));
  };

  const handleBuyVehicle = (vehicleId: string) => {
    const spec = getVehicleById(vehicleId);
    if (progress.ownedVehicleIds.includes(vehicleId)) return;
    if (progress.coins < spec.price) return;

    commitProgress((prev) => {
      const next: PlayerProgress = {
        ...prev,
        coins: prev.coins - spec.price,
        ownedVehicleIds: [...prev.ownedVehicleIds, vehicleId],
        selectedVehicleId: vehicleId,
        customizations: {
          ...prev.customizations,
          [vehicleId]:
            prev.customizations[vehicleId] ?? createDefaultCustomization(vehicleId),
        },
      };
      return evaluateNewAchievements(next).updated;
    });
    showToast(`¡${spec.name} añadido a tu garaje!`);
  };

  const handleUpdatePaint = (
    vehicleId: string,
    color: string,
    finish: PaintFinish,
  ) => {
    commitProgress((prev) => {
      const cur =
        prev.customizations[vehicleId] ?? createDefaultCustomization(vehicleId);
      return {
        ...prev,
        customizations: {
          ...prev.customizations,
          [vehicleId]: {
            ...cur,
            color,
            finish,
          },
        },
      };
    });
  };

  const handleUpgrade = (vehicleId: string, key: UpgradeKey, cost: number) => {
    if (progress.coins < cost) return;
    commitProgress((prev) => {
      const cur =
        prev.customizations[vehicleId] ?? createDefaultCustomization(vehicleId);
      const curLvl = cur.upgrades[key];
      if (curLvl >= 5) return prev;
      const next: PlayerProgress = {
        ...prev,
        coins: prev.coins - cost,
        customizations: {
          ...prev.customizations,
          [vehicleId]: {
            ...cur,
            upgrades: {
              ...cur.upgrades,
              [key]: curLvl + 1,
            },
          },
        },
      };
      return evaluateNewAchievements(next).updated;
    });
  };

  const handleStartRace = (config: RaceConfig) => {
    setActiveRaceConfig(config);
    setScreen('racing');
  };

  const handleStartChampionshipRace = (champ: ChampionshipSpec) => {
    const existing = progress.championships[champ.id];
    let stageIdx = existing && !existing.completed ? existing.currentRaceIndex : 0;
    if (stageIdx >= champ.tracks.length) stageIdx = 0;

    if (!existing || existing.completed) {
      commitProgress((prev) => ({
        ...prev,
        activeChampionshipId: champ.id,
        championships: {
          ...prev.championships,
          [champ.id]: {
            championshipId: champ.id,
            currentRaceIndex: 0,
            pointsByRacer: { player: 0 },
            completed: false,
            bestRank: existing?.bestRank ?? null,
          },
        },
      }));
    } else {
      commitProgress((prev) => ({
        ...prev,
        activeChampionshipId: champ.id,
      }));
    }

    handleStartRace({
      trackId: champ.tracks[stageIdx],
      difficulty: champ.difficulty,
      laps: champ.lapsPerRace,
      championshipId: champ.id,
    });
  };

  const handleRaceFinished = useCallback(
    (rawSummary: RaceFinishSummary): RaceFinishSummary => {
      let enrichedSummary = { ...rawSummary };

      setProgress((prev) => {
        const prevRecord = prev.trackRecords[rawSummary.trackId];
        const isNewRecord =
          prevRecord === undefined || rawSummary.totalTime < prevRecord;
        enrichedSummary.newRecord = isNewRecord;

        let next: PlayerProgress = {
          ...prev,
          coins: prev.coins + rawSummary.coinsEarned,
          totalRaces: prev.totalRaces + 1,
          totalWins: prev.totalWins + (rawSummary.playerPosition === 1 ? 1 : 0),
          totalPodiums:
            prev.totalPodiums + (rawSummary.playerPosition <= 3 ? 1 : 0),
          totalDriftMeters: prev.totalDriftMeters + rawSummary.driftMeters,
          totalNitroSeconds: prev.totalNitroSeconds + rawSummary.nitroSeconds,
          trackRecords: {
            ...prev.trackRecords,
            [rawSummary.trackId]: isNewRecord
              ? rawSummary.totalTime
              : prevRecord,
          },
        };

        next = addXpAndLevelUp(next, rawSummary.xpEarned);

        // Update Championship progress if racing in a Championship
        if (rawSummary.championshipId) {
          const champ = CHAMPIONSHIPS.find((c) => c.id === rawSummary.championshipId);
          const cProg = next.championships[rawSummary.championshipId];
          if (champ && cProg && !cProg.completed) {
            const ptsTable = [10, 6, 4, 2];
            const ptsMap = { ...cProg.pointsByRacer };
            rawSummary.standings.forEach((entry) => {
              const key = entry.isPlayer ? 'player' : entry.name;
              const earned = ptsTable[entry.position - 1] ?? 1;
              ptsMap[key] = (ptsMap[key] ?? 0) + earned;
            });

            const nextStage = cProg.currentRaceIndex + 1;
            const finishedChamp = nextStage >= champ.tracks.length;
            let finalRank: number | null = cProg.bestRank;

            if (finishedChamp) {
              const sorted = Object.entries(ptsMap).sort((a, b) => b[1] - a[1]);
              const rank = sorted.findIndex(([k]) => k === 'player') + 1;
              finalRank =
                cProg.bestRank === null ? rank : Math.min(cProg.bestRank, rank);
              if (rank === 1) {
                next.coins += champ.prizeCoins;
                next = addXpAndLevelUp(next, champ.prizeXp);
                enrichedSummary.coinsEarned += champ.prizeCoins;
                enrichedSummary.xpEarned += champ.prizeXp;
              }
            }

            next.championships = {
              ...next.championships,
              [champ.id]: {
                ...cProg,
                currentRaceIndex: nextStage,
                pointsByRacer: ptsMap,
                completed: finishedChamp,
                bestRank: finalRank,
              },
            };
          }
        }

        const achRes = evaluateNewAchievements(next);
        enrichedSummary.newlyUnlockedAchievements = achRes.unlockedIds;
        saveProgress(achRes.updated);
        return achRes.updated;
      });

      return enrichedSummary;
    },
    [],
  );

  const handleNextChampionshipRace = () => {
    if (!activeRaceConfig?.championshipId) return;
    const champ = CHAMPIONSHIPS.find(
      (c) => c.id === activeRaceConfig.championshipId,
    );
    const cProg = progress.championships[activeRaceConfig.championshipId];
    if (!champ || !cProg || cProg.completed) {
      setScreen('championships');
      return;
    }
    const nextIdx = cProg.currentRaceIndex;
    if (nextIdx >= champ.tracks.length) {
      setScreen('championships');
      return;
    }
    handleStartRace({
      trackId: champ.tracks[nextIdx],
      difficulty: champ.difficulty,
      laps: champ.lapsPerRace,
      championshipId: champ.id,
    });
  };

  const selectedCustom =
    progress.customizations[progress.selectedVehicleId] ??
    createDefaultCustomization(progress.selectedVehicleId);

  const showMenuBackdrop =
    screen === 'menu' ||
    screen === 'race_setup' ||
    screen === 'championships' ||
    screen === 'settings';

  const canContinueChampionship =
    activeRaceConfig?.championshipId &&
    progress.championships[activeRaceConfig.championshipId] &&
    !progress.championships[activeRaceConfig.championshipId].completed;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#08090d]">
      {/* Animated 3D City & Sports Car Backdrop for Main Menu & Sub-Modals */}
      {showMenuBackdrop && (
        <ShowcaseViewport
          mode="menu_city"
          vehicleId={progress.selectedVehicleId}
          color={selectedCustom.color}
          finish={selectedCustom.finish}
        />
      )}

      {screen === 'menu' && (
        <MainMenu
          progress={progress}
          onNavigate={setScreen}
          onClaimDaily={handleClaimDaily}
          onClaimMission={handleClaimMission}
        />
      )}

      {screen === 'race_setup' && (
        <RaceSetupModal
          progress={progress}
          onBack={() => setScreen('menu')}
          onStartRace={handleStartRace}
        />
      )}

      {screen === 'garage' && (
        <GarageView
          progress={progress}
          onBack={() => setScreen('menu')}
          onOpenShop={() => setScreen('shop')}
          onSelectVehicle={handleSelectVehicle}
          onUpdatePaint={handleUpdatePaint}
          onUpgrade={handleUpgrade}
        />
      )}

      {screen === 'shop' && (
        <ShopView
          progress={progress}
          onBack={() => setScreen('menu')}
          onBuyVehicle={handleBuyVehicle}
          onSelectVehicle={handleSelectVehicle}
        />
      )}

      {screen === 'championships' && (
        <ChampionshipsView
          progress={progress}
          onBack={() => setScreen('menu')}
          onStartChampionshipRace={handleStartChampionshipRace}
        />
      )}

      {screen === 'settings' && (
        <SettingsView
          settings={progress.settings}
          onBack={() => setScreen('menu')}
          onUpdate={(next: GameSettings) =>
            commitProgress((prev) => ({ ...prev, settings: next }))
          }
          onResetProgress={() => {
            const fresh = resetProgressStorage();
            setProgress(fresh);
            showToast('Progreso reiniciado correctamente');
          }}
        />
      )}

      {screen === 'racing' && activeRaceConfig && (
        <RaceView
          config={activeRaceConfig}
          progress={progress}
          onRaceFinished={handleRaceFinished}
          onExitToMenu={() => setScreen('menu')}
          onNextChampionshipRace={
            canContinueChampionship ? handleNextChampionshipRace : undefined
          }
          onCameraModeChange={(cameraMode) =>
            commitProgress((prev) => ({
              ...prev,
              settings: { ...prev.settings, cameraMode },
            }))
          }
        />
      )}

      {/* Subtle Toast Feedback */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-lg bg-[#0d1017] border border-sky-500/50 text-sm font-semibold text-white shadow-xl pointer-events-none">
          {toast}
        </div>
      )}
    </main>
  );
}
