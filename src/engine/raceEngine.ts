import * as THREE from 'three';
import { soundEngine } from '../audio/soundEngine';
import { getTrackById } from '../data/tracks';
import { AI_RIVAL_NAMES, getVehicleById, VEHICLES } from '../data/vehicles';
import { getEffectiveVehicleStats } from '../services/storage';
import {
  DifficultyLevel,
  GameSettings,
  PaintFinish,
  RaceConfig,
  RaceFinishSummary,
  RacerHudEntry,
  RaceTelemetry,
  VehicleCustomization,
  VehicleSpec,
  VehicleStats,
} from '../types/game';
import { buildProceduralCar, BuiltCar } from './carBuilder';
import { RaceParticleSystem } from './particles';
import { buildProceduralTrack, BuiltTrack } from './trackBuilder';
import {
  afterDraw,
  attachStudioEnvironment,
  createConfiguredRenderer,
  detectSoftwareGl,
} from './webglSetup';

export interface RaceInputState {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  nitro: boolean;
  drift: boolean;
}

interface RacerEntity {
  id: string;
  name: string;
  isPlayer: boolean;
  spec: VehicleSpec;
  stats: VehicleStats;
  built: BuiltCar;
  color: string;
  position: THREE.Vector3;
  heading: number; // radians, 0 = facing -Z
  speed: number; // m/s (forward along heading)
  lateralVel: number; // m/s (drift slip)
  steerAngle: number;
  wheelSpinAccum: number;
  nitro: number; // 0..100
  isNitroActive: boolean;
  isDrifting: boolean;
  driftMeters: number;
  nitroSeconds: number;
  hintIndex: number;
  lastS: number;
  unwrappedProgress: number; // 0..laps
  lap: number;
  finished: boolean;
  finishTime: number;
  currentLapStart: number;
  bestLapTime: number | null;
  collisionCooldown: number;
  padCooldown: number;
  // AI fields
  aiBaseLane: number;
  aiTargetLane: number;
  aiSkillMult: number;
  aiMistakeTimer: number;
  aiMistakeOffset: number;
}

// Reusable math temporaries (zero per-frame GC)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camLook = new THREE.Vector3();

function getDifficultyScale(diff: DifficultyLevel): {
  speedMult: number;
  mistakeFreq: number;
  aggression: number;
} {
  switch (diff) {
    case 'Fácil':
      return { speedMult: 0.78, mistakeFreq: 0.35, aggression: 0.55 };
    case 'Normal':
      return { speedMult: 0.9, mistakeFreq: 0.2, aggression: 0.75 };
    case 'Difícil':
      return { speedMult: 1.0, mistakeFreq: 0.1, aggression: 0.92 };
    case 'Extremo':
      return { speedMult: 1.08, mistakeFreq: 0.04, aggression: 1.0 };
  }
}

export class RaceEngine {
  private container: HTMLElement;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envTex: THREE.Texture;
  private keyLight: THREE.DirectionalLight;
  private track: BuiltTrack;
  private particles: RaceParticleSystem | null = null;

  private racers: RacerEntity[] = [];
  private player!: RacerEntity;

  private config: RaceConfig;
  private settings: GameSettings;
  private input: RaceInputState = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
    nitro: false,
    drift: false,
  };

  private clock = new THREE.Clock();
  private countdownTimer = 3.2;
  private lastCountdownInt = 4;
  private raceElapsed = 0;
  private paused = false;
  private disposed = false;
  private finishTriggered = false;
  private frameId = 0;
  private timers: number[] = [];
  private hudEmitAccum = 0;

  private onTelemetry: (t: RaceTelemetry) => void;
  private onFinish: (summary: RaceFinishSummary) => void;

  constructor(
    container: HTMLElement,
    config: RaceConfig,
    playerVehicleId: string,
    playerCustomization: VehicleCustomization | undefined,
    settings: GameSettings,
    onTelemetry: (t: RaceTelemetry) => void,
    onFinish: (summary: RaceFinishSummary) => void,
  ) {
    this.container = container;
    this.config = config;
    this.settings = { ...settings };
    this.onTelemetry = onTelemetry;
    this.onFinish = onFinish;

    this.isSoftwareGl = detectSoftwareGl();
    this.renderer = createConfiguredRenderer(
      container,
      this.isSoftwareGl,
      settings.shadows,
    );

    this.scene = new THREE.Scene();
    this.envTex = attachStudioEnvironment(this.renderer, this.scene);

    const w = container.clientWidth || 1280;
    const h = container.clientHeight || 720;
    this.camera = new THREE.PerspectiveCamera(64, w / h, 0.25, 1100);

    const trackSpec = getTrackById(config.trackId);
    this.track = buildProceduralTrack(trackSpec, this.renderer, this.scene);

    // Balanced outdoor 3-point lighting rig
    const hemi = new THREE.HemisphereLight(
      trackSpec.ambientSky,
      trackSpec.ambientGround,
      0.85,
    );
    this.scene.add(hemi);

    this.keyLight = new THREE.DirectionalLight(
      trackSpec.sunColor,
      trackSpec.sunIntensity,
    );
    this.keyLight.position.set(60, 95, 45);
    this.keyLight.castShadow = !this.isSoftwareGl && settings.shadows;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.left = -55;
    this.keyLight.shadow.camera.right = 55;
    this.keyLight.shadow.camera.top = 55;
    this.keyLight.shadow.camera.bottom = -55;
    this.keyLight.shadow.camera.near = 10;
    this.keyLight.shadow.camera.far = 240;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    const rimLight = new THREE.DirectionalLight(trackSpec.accentNeon, 0.65);
    rimLight.position.set(-50, 30, -60);
    this.scene.add(rimLight);

    if (settings.particles) {
      this.particles = new RaceParticleSystem(this.scene);
    }

    this.spawnRacers(playerVehicleId, playerCustomization);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    soundEngine.applySettings(settings);
    soundEngine.startRaceAudio();

    window.addEventListener('resize', this.handleResize);
    this.clock.start();
    this.tick();
  }

  private spawnRacers(
    playerVehicleId: string,
    playerCustomization?: VehicleCustomization,
  ): void {
    const startSmp = this.track.samples[0];
    const startYaw = Math.atan2(-startSmp.tangent.x, -startSmp.tangent.z);
    const diffScale = getDifficultyScale(this.config.difficulty);

    // Choose 3 distinct AI rival cars near player's tier
    const playerSpec = getVehicleById(playerVehicleId);
    const playerIdx = VEHICLES.findIndex((v) => v.id === playerSpec.id);
    const rivalIndices = [
      (playerIdx + 1) % VEHICLES.length,
      (playerIdx + 3) % VEHICLES.length,
      (playerIdx + 6) % VEHICLES.length,
    ];
    const rivalColors = ['#0ea5e9', '#f59e0b', '#10b981'];
    const gridOffsets = [
      { forward: -6, lateral: -3.2 },
      { forward: -6, lateral: 3.2 },
      { forward: -14, lateral: -3.2 },
      { forward: -14, lateral: 3.2 }, // Player starts P4 for exciting overtakes
    ];

    const createEntity = (
      id: string,
      name: string,
      isPlayer: boolean,
      spec: VehicleSpec,
      stats: VehicleStats,
      color: string,
      finish: PaintFinish,
      gridIdx: number,
      skillMult: number,
    ): RacerEntity => {
      const built = buildProceduralCar(spec, color, finish, this.isSoftwareGl);
      const slot = gridOffsets[gridIdx];
      const pos = startSmp.point
        .clone()
        .addScaledVector(startSmp.tangent, slot.forward)
        .addScaledVector(startSmp.right, slot.lateral);

      built.root.position.copy(pos);
      built.root.rotation.y = startYaw;
      this.scene.add(built.root);

      const closest = this.track.getClosestSample(pos);
      const initS = closest.sample.s;
      const startUnwrapped = initS > 0.5 ? initS - 1 : initS;

      return {
        id,
        name,
        isPlayer,
        spec,
        stats,
        built,
        color,
        position: pos,
        heading: startYaw,
        speed: 0,
        lateralVel: 0,
        steerAngle: 0,
        wheelSpinAccum: 0,
        nitro: 100,
        isNitroActive: false,
        isDrifting: false,
        driftMeters: 0,
        nitroSeconds: 0,
        hintIndex: closest.index,
        lastS: initS,
        unwrappedProgress: startUnwrapped,
        lap: 1,
        finished: false,
        finishTime: 0,
        currentLapStart: 0,
        bestLapTime: null,
        collisionCooldown: 0,
        padCooldown: 0,
        aiBaseLane: (gridIdx - 1) * 2.4,
        aiTargetLane: (gridIdx - 1) * 2.4,
        aiSkillMult: skillMult,
        aiMistakeTimer: 2 + gridIdx * 1.3,
        aiMistakeOffset: 0,
      };
    };

    // Spawn 3 AI Rivals in P1, P2, P3
    rivalIndices.forEach((vIdx, idx) => {
      const rSpec = VEHICLES[vIdx];
      const rColor = rivalColors[idx];
      const skill = diffScale.speedMult * (0.94 + idx * 0.045);
      const rival = createEntity(
        `ai_${idx}`,
        AI_RIVAL_NAMES[(playerIdx + idx) % AI_RIVAL_NAMES.length],
        false,
        rSpec,
        rSpec.stats,
        rColor,
        'metallic',
        idx,
        skill,
      );
      this.racers.push(rival);
    });

    // Spawn Player in P4
    const pColor = playerCustomization?.color ?? playerSpec.defaultColor;
    const pFinish = playerCustomization?.finish ?? 'metallic';
    const pStats = getEffectiveVehicleStats(playerSpec.id, playerCustomization);
    this.player = createEntity(
      'player',
      'Tú',
      true,
      playerSpec,
      pStats,
      pColor,
      pFinish,
      3,
      1,
    );
    this.racers.push(this.player);

    // Position camera smoothly behind player at start
    const backX = Math.sin(this.player.heading);
    const backZ = Math.cos(this.player.heading);
    this.camera.position.set(
      this.player.position.x + backX * 9.5,
      this.player.position.y + 4.2,
      this.player.position.z + backZ * 9.5,
    );
    this.camera.lookAt(
      this.player.position.x - backX * 8,
      this.player.position.y + 1.4,
      this.player.position.z - backZ * 8,
    );
  }

  public setInput(partial: Partial<RaceInputState>): void {
    Object.assign(this.input, partial);
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      soundEngine.updateRaceAudio(0, false, false, false, false);
    } else {
      this.clock.getDelta(); // flush paused delta
    }
  }

  public setCameraMode(mode: GameSettings['cameraMode']): void {
    this.settings.cameraMode = mode;
  }

  public updateSettings(next: GameSettings): void {
    this.settings = { ...next };
    soundEngine.applySettings(next);
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private tick = (): void => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    if (!this.paused) {
      this.stepSimulation(dt);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      afterDraw(this.renderer, this.tick, (id) => this.timers.push(id));
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private stepSimulation(dt: number): void {
    // Countdown phase
    if (this.countdownTimer > 0) {
      this.countdownTimer -= dt;
      const ceilVal = Math.ceil(this.countdownTimer);
      if (ceilVal !== this.lastCountdownInt && ceilVal >= 0) {
        this.lastCountdownInt = ceilVal;
        if (ceilVal >= 1 && ceilVal <= 3) {
          soundEngine.playCountdownBeep(false);
        } else if (ceilVal === 0) {
          soundEngine.playCountdownBeep(true);
        }
      }
      soundEngine.updateRaceAudio(
        this.input.throttle ? 0.55 : 0.12,
        this.input.throttle,
        false,
        false,
        false,
      );
      this.updateCamera(dt);
      this.hudEmitAccum += dt;
      if (this.hudEmitAccum >= 0.06) {
        this.hudEmitAccum = 0;
        this.emitTelemetry();
      }
      return;
    }

    this.raceElapsed += dt;

    for (const r of this.racers) {
      if (r.collisionCooldown > 0) r.collisionCooldown -= dt;
      if (r.padCooldown > 0) r.padCooldown -= dt;

      if (r.isPlayer && !r.finished) {
        this.stepPlayerPhysics(r, dt);
      } else {
        this.stepAiPhysics(r, dt);
      }
      this.constrainToTrackAndProgress(r, dt);
    }

    this.resolveCarCollisions();
    this.particles?.update(dt);
    this.updateCamera(dt);

    // Move shadow light with player for crisp shadows everywhere on track
    this.keyLight.position.set(
      this.player.position.x + 55,
      this.player.position.y + 85,
      this.player.position.z + 40,
    );
    this.keyLight.target.position.copy(this.player.position);

    // Update audio from player telemetry
    const maxSpeedMs = this.getMaxSpeedMs(this.player.stats, false);
    const rpmRatio = Math.min(1.1, Math.abs(this.player.speed) / maxSpeedMs);
    soundEngine.updateRaceAudio(
      rpmRatio,
      this.input.throttle,
      this.player.isDrifting,
      this.player.isNitroActive,
      this.input.brake,
    );

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.05) {
      this.hudEmitAccum = 0;
      this.emitTelemetry();
    }

    if (this.player.finished && !this.finishTriggered) {
      this.finishTriggered = true;
      this.completeRace();
    }
  }

  private getMaxSpeedMs(stats: VehicleStats, nitroActive: boolean): number {
    // 60..115 rating maps to ~58..92 m/s (~210..330 km/h arcade scale, +24% nitro)
    const base = 42 + stats.topSpeed * 0.44;
    return nitroActive ? base * (1.2 + stats.nitro * 0.0012) : base;
  }

  private stepPlayerPhysics(r: RacerEntity, dt: number): void {
    const accelRate = 17 + r.stats.acceleration * 0.24;
    const brakeRate = 28 + r.stats.braking * 0.34;
    const handlingRate = 1.65 + r.stats.handling * 0.014;

    const wantsNitro = this.input.nitro && r.nitro > 2 && this.input.throttle;
    r.isNitroActive = wantsNitro;
    if (wantsNitro) {
      r.nitro = Math.max(0, r.nitro - 24 * dt);
      r.nitroSeconds += dt;
    } else {
      r.nitro = Math.min(100, r.nitro + (2.5 + (r.isDrifting ? 11 : 0)) * dt);
    }

    const maxSpeed = this.getMaxSpeedMs(r.stats, wantsNitro);

    if (this.input.throttle) {
      const boostFactor = wantsNitro ? 1.55 : 1.0;
      r.speed += accelRate * boostFactor * dt;
    } else if (this.input.brake) {
      if (r.speed > 1.5) {
        r.speed -= brakeRate * dt;
      } else {
        r.speed -= accelRate * 0.65 * dt; // reverse
      }
    } else {
      // Natural aerodynamic drag & rolling resistance
      r.speed -= Math.sign(r.speed) * Math.min(Math.abs(r.speed), (5.5 + Math.abs(r.speed) * 0.16) * dt);
    }

    r.speed = THREE.MathUtils.clamp(r.speed, -18, maxSpeed);

    // Steering & Drifting
    const steerInput = (this.input.left ? 1 : 0) - (this.input.right ? 1 : 0);
    const speedFactor = THREE.MathUtils.clamp(Math.abs(r.speed) / 14, 0.22, 1.0);
    const reverseFlip = r.speed < -0.5 ? -1 : 1;
    const wantsDrift =
      (this.input.drift || (this.input.brake && Math.abs(r.speed) > 18)) &&
      Math.abs(steerInput) > 0 &&
      r.speed > 16;

    r.isDrifting = wantsDrift;

    const turnMult = wantsDrift ? 1.32 : 1.0;
    const targetSteer = steerInput * 0.42;
    r.steerAngle = THREE.MathUtils.damp(r.steerAngle, targetSteer, 12, dt);

    if (Math.abs(r.speed) > 0.6) {
      r.heading += steerInput * handlingRate * turnMult * speedFactor * reverseFlip * dt;
    }

    // Lateral velocity (drift slip)
    if (wantsDrift) {
      r.lateralVel = THREE.MathUtils.damp(
        r.lateralVel,
        -steerInput * r.speed * 0.34,
        4.5,
        dt,
      );
      r.driftMeters += Math.abs(r.speed) * dt * 0.65;
    } else {
      r.lateralVel = THREE.MathUtils.damp(r.lateralVel, 0, 10, dt);
    }

    // Apply movement along heading (-Z forward) + right (+X)
    const fwdX = -Math.sin(r.heading);
    const fwdZ = -Math.cos(r.heading);
    const rightX = Math.cos(r.heading);
    const rightZ = -Math.sin(r.heading);

    r.position.x += (fwdX * r.speed + rightX * r.lateralVel) * dt;
    r.position.z += (fwdZ * r.speed + rightZ * r.lateralVel) * dt;

    // Suspension visual pitch & roll
    const targetRoll = -steerInput * speedFactor * (wantsDrift ? 0.095 : 0.055);
    const targetPitch =
      this.input.throttle && !wantsDrift
        ? wantsNitro
          ? 0.04
          : 0.022
        : this.input.brake && r.speed > 2
          ? -0.045
          : 0;
    r.built.chassisGroup.rotation.z = THREE.MathUtils.damp(
      r.built.chassisGroup.rotation.z,
      targetRoll,
      10,
      dt,
    );
    r.built.chassisGroup.rotation.x = THREE.MathUtils.damp(
      r.built.chassisGroup.rotation.x,
      targetPitch,
      10,
      dt,
    );

    r.built.setBraking(this.input.brake && r.speed > 1);
    r.built.setNitroVisual(wantsNitro, this.raceElapsed);

    // Spawn drift smoke & nitro trail particles
    if (this.particles && wantsDrift && Math.random() < 0.7) {
      this.particles.spawnDriftSmoke(
        r.position.x - fwdX * 1.6,
        r.position.y,
        r.position.z - fwdZ * 1.6,
      );
    }
    if (this.particles && wantsNitro && Math.random() < 0.85) {
      this.particles.spawnNitroTrail(
        r.position.x - fwdX * 2.3,
        r.position.y,
        r.position.z - fwdZ * 2.3,
      );
    }
  }

  private stepAiPhysics(r: RacerEntity, dt: number): void {
    const samples = this.track.samples;
    const count = samples.length;
    const diffScale = getDifficultyScale(this.config.difficulty);

    // Lookahead along spline
    const lookSteps = 10;
    const targetIdx = (r.hintIndex + lookSteps) % count;
    const farIdx = (r.hintIndex + 22) % count;
    const targetSmp = samples[targetIdx];
    const farSmp = samples[farIdx];

    // Check corner curvature to modulate AI braking
    const dotAhead = targetSmp.tangent.dot(farSmp.tangent);
    const cornerSharpness = 1 - THREE.MathUtils.clamp(dotAhead, 0, 1);

    // Periodic realistic human-like micro-errors
    r.aiMistakeTimer -= dt;
    if (r.aiMistakeTimer <= 0) {
      r.aiMistakeTimer = 2.4 + Math.random() * 3.5;
      r.aiMistakeOffset =
        Math.random() < diffScale.mistakeFreq ? (Math.random() - 0.5) * 3.2 : 0;
    }

    // Obstacle avoidance + Overtaking lane shifts
    const halfW = this.track.spec.roadWidth * 0.5 - 2.3;
    let desiredLane = r.aiBaseLane + r.aiMistakeOffset;

    for (const obs of this.track.obstacles) {
      const ds = (obs.s - samples[r.hintIndex].s + 1) % 1;
      if (ds > 0 && ds < 0.06) {
        if (Math.abs(desiredLane - obs.lateralOffset) < 3.4) {
          desiredLane = obs.lateralOffset > 0 ? -halfW * 0.55 : halfW * 0.55;
        }
      }
    }

    // Overtake slower car directly ahead
    for (const other of this.racers) {
      if (other.id === r.id) continue;
      const dx = other.position.x - r.position.x;
      const dz = other.position.z - r.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < 180 && other.unwrappedProgress > r.unwrappedProgress) {
        desiredLane = other.position.distanceTo(targetSmp.point) > 1 ? -r.aiBaseLane : 3.2;
      }
    }

    desiredLane = THREE.MathUtils.clamp(desiredLane, -halfW, halfW);
    r.aiTargetLane = THREE.MathUtils.damp(r.aiTargetLane, desiredLane, 3.5, dt);

    _v1.copy(targetSmp.point).addScaledVector(targetSmp.right, r.aiTargetLane);

    const toTargetX = _v1.x - r.position.x;
    const toTargetZ = _v1.z - r.position.z;
    const targetHeading = Math.atan2(-toTargetX, -toTargetZ);

    let angleDiff = targetHeading - r.heading;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const steerCmd = THREE.MathUtils.clamp(angleDiff * 2.2, -1, 1);
    r.steerAngle = THREE.MathUtils.damp(r.steerAngle, steerCmd * 0.36, 10, dt);
    r.heading += steerCmd * (2.2 + r.stats.handling * 0.01) * dt;

    // Speed control with corner braking + occasional AI nitro on straights
    const baseMax = this.getMaxSpeedMs(r.stats, false) * r.aiSkillMult;
    const cornerLimit = baseMax * (1 - cornerSharpness * 1.15);
    const useNitro =
      !r.finished &&
      cornerSharpness < 0.06 &&
      r.nitro > 35 &&
      diffScale.aggression > 0.7 &&
      Math.random() < 0.025;

    if (useNitro) r.isNitroActive = true;
    if (r.isNitroActive) {
      r.nitro -= 25 * dt;
      if (r.nitro <= 8 || cornerSharpness > 0.14) r.isNitroActive = false;
    } else {
      r.nitro = Math.min(100, r.nitro + 3 * dt);
    }

    const desiredSpeed = r.finished
      ? baseMax * 0.45
      : Math.max(22, cornerLimit * (r.isNitroActive ? 1.18 : 1.0));
    const accel = 16 + r.stats.acceleration * 0.22;
    const braking = 26 + r.stats.braking * 0.25;

    if (r.speed < desiredSpeed) {
      r.speed = Math.min(desiredSpeed, r.speed + accel * dt);
    } else {
      r.speed = Math.max(desiredSpeed, r.speed - braking * dt);
    }

    const fwdX = -Math.sin(r.heading);
    const fwdZ = -Math.cos(r.heading);
    r.position.x += fwdX * r.speed * dt;
    r.position.z += fwdZ * r.speed * dt;

    r.built.setBraking(r.speed > desiredSpeed + 3);
    r.built.setNitroVisual(r.isNitroActive, this.raceElapsed);
    r.built.chassisGroup.rotation.z = THREE.MathUtils.damp(
      r.built.chassisGroup.rotation.z,
      -steerCmd * 0.045,
      8,
      dt,
    );
  }

  private constrainToTrackAndProgress(r: RacerEntity, dt: number): void {
    const closest = this.track.getClosestSample(r.position, r.hintIndex);
    r.hintIndex = closest.index;
    const smp = closest.sample;
    const maxLat = this.track.spec.roadWidth * 0.5 - 1.15;

    // Ground height follow
    r.position.y = THREE.MathUtils.damp(r.position.y, smp.point.y, 16, dt);

    // Guardrail containment & bounce
    if (Math.abs(closest.lateralOffset) > maxLat) {
      const sign = Math.sign(closest.lateralOffset);
      const clampedLat = sign * maxLat;
      r.position.x = smp.point.x + smp.right.x * clampedLat;
      r.position.z = smp.point.z + smp.right.z * clampedLat;
      r.speed *= 0.84;
      r.lateralVel *= -0.35;

      // Gently align heading back toward track tangent
      const trackYaw = Math.atan2(-smp.tangent.x, -smp.tangent.z);
      let diff = trackYaw - r.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      r.heading += diff * 0.25;

      if (r.isPlayer && r.collisionCooldown <= 0) {
        r.collisionCooldown = 0.35;
        soundEngine.playCollision(0.55);
        this.particles?.spawnSparks(r.position.x, r.position.y, r.position.z, 10);
      }
    }

    // Track obstacles collision
    for (const obs of this.track.obstacles) {
      const dx = r.position.x - obs.position.x;
      const dz = r.position.z - obs.position.z;
      const minDist = obs.radius + 1.1;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDist * minDist && dSq > 0.0001) {
        const d = Math.sqrt(dSq);
        const nx = dx / d;
        const nz = dz / d;
        r.position.x = obs.position.x + nx * minDist;
        r.position.z = obs.position.z + nz * minDist;
        r.speed *= 0.58;
        if (r.isPlayer && r.collisionCooldown <= 0) {
          r.collisionCooldown = 0.45;
          soundEngine.playCollision(0.85);
          this.particles?.spawnSparks(r.position.x, r.position.y, r.position.z, 18);
        }
      }
    }

    // Nitro recharge pads
    if (r.padCooldown <= 0) {
      for (const pad of this.track.nitroPads) {
        const dx = r.position.x - pad.position.x;
        const dz = r.position.z - pad.position.z;
        if (dx * dx + dz * dz < pad.radius * pad.radius) {
          r.padCooldown = 1.5;
          r.nitro = Math.min(100, r.nitro + 26);
          if (r.isPlayer) soundEngine.playClick();
          break;
        }
      }
    }

    // Monotonic spline progress tracking (handles 0.99 -> 0.01 wrap-around cleanly)
    const curS = smp.s;
    let ds = curS - r.lastS;
    if (ds < -0.5) ds += 1.0;
    else if (ds > 0.5) ds -= 1.0;
    r.lastS = curS;
    r.unwrappedProgress += ds;

    if (!r.finished) {
      const currentLapNum = Math.max(1, Math.floor(r.unwrappedProgress) + 1);
      if (currentLapNum > r.lap) {
        const lapDuration = this.raceElapsed - r.currentLapStart;
        if (lapDuration > 4 && (r.bestLapTime === null || lapDuration < r.bestLapTime)) {
          r.bestLapTime = lapDuration;
        }
        r.currentLapStart = this.raceElapsed;
        r.lap = currentLapNum;

        if (r.unwrappedProgress >= this.config.laps) {
          r.finished = true;
          r.finishTime = this.raceElapsed;
        }
      }
    }

    // Sync Three.js car transform & wheels
    r.built.root.position.copy(r.position);
    r.built.root.rotation.y = r.heading;

    // Slight drift yaw visual offset
    const driftVisual = r.isDrifting ? Math.sign(r.lateralVel) * 0.16 : 0;
    r.built.chassisGroup.rotation.y = THREE.MathUtils.damp(
      r.built.chassisGroup.rotation.y,
      driftVisual,
      10,
      dt,
    );

    r.wheelSpinAccum -= (r.speed / 0.37) * dt;
    for (const w of r.built.wheelsSpin) {
      w.rotation.x = r.wheelSpinAccum;
    }
    for (const pivot of r.built.frontSteerPivots) {
      pivot.rotation.y = r.steerAngle;
    }
  }

  private resolveCarCollisions(): void {
    const minDist = 2.35;
    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        const a = this.racers[i];
        const b = this.racers[j];
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDist * minDist && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const overlap = (minDist - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          a.position.x -= nx * overlap;
          a.position.z -= nz * overlap;
          b.position.x += nx * overlap;
          b.position.z += nz * overlap;

          const avg = (a.speed + b.speed) * 0.5;
          a.speed = THREE.MathUtils.lerp(a.speed, avg * 0.92, 0.35);
          b.speed = THREE.MathUtils.lerp(b.speed, avg * 0.92, 0.35);

          if ((a.isPlayer || b.isPlayer) && a.collisionCooldown <= 0 && b.collisionCooldown <= 0) {
            a.collisionCooldown = 0.35;
            b.collisionCooldown = 0.35;
            soundEngine.playCollision(0.75);
            this.particles?.spawnSparks(
              (a.position.x + b.position.x) * 0.5,
              a.position.y,
              (a.position.z + b.position.z) * 0.5,
              14,
            );
          }
        }
      }
    }
  }

  private updateCamera(dt: number): void {
    const p = this.player;
    const fwdX = -Math.sin(p.heading);
    const fwdZ = -Math.cos(p.heading);

    const targetFov =
      this.settings.cameraMode === 'hood'
        ? p.isNitroActive
          ? 80
          : 70
        : p.isNitroActive
          ? 76
          : 64;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }

    if (this.settings.cameraMode === 'hood') {
      _camTarget.set(
        p.position.x + fwdX * 0.4,
        p.position.y + 1.48,
        p.position.z + fwdZ * 0.4,
      );
      _camLook.set(
        p.position.x + fwdX * 20,
        p.position.y + 1.35,
        p.position.z + fwdZ * 20,
      );
      this.camera.position.copy(_camTarget);
      this.camera.lookAt(_camLook);
      return;
    }

    const distBack = this.settings.cameraMode === 'far' ? 12.2 : 8.8;
    const heightUp = this.settings.cameraMode === 'far' ? 4.8 : 3.4;

    _camTarget.set(
      p.position.x - fwdX * distBack,
      p.position.y + heightUp,
      p.position.z - fwdZ * distBack,
    );
    _camLook.set(
      p.position.x + fwdX * 9,
      p.position.y + 1.35,
      p.position.z + fwdZ * 9,
    );

    const lambda = 11;
    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      _camTarget.x,
      lambda,
      dt,
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      _camTarget.y,
      lambda,
      dt,
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      _camTarget.z,
      lambda,
      dt,
    );
    this.camera.lookAt(_camLook);
  }

  private getSortedStandings(): RacerHudEntry[] {
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.unwrappedProgress - a.unwrappedProgress;
    });

    return sorted.map((r, idx) => ({
      id: r.id,
      name: r.name,
      isPlayer: r.isPlayer,
      position: idx + 1,
      lap: Math.min(r.lap, this.config.laps),
      totalLaps: this.config.laps,
      progressNormalized: r.unwrappedProgress,
      color: r.color,
      finished: r.finished,
      finishTime: r.finishTime,
    }));
  }

  private emitTelemetry(): void {
    const standings = this.getSortedStandings();
    const playerStanding = standings.find((s) => s.isPlayer)!;
    const speedKmh = Math.round(Math.abs(this.player.speed) * 3.85);
    const maxKmh = Math.round(
      this.getMaxSpeedMs(this.player.stats, this.player.isNitroActive) * 3.85,
    );
    const speedRatio = THREE.MathUtils.clamp(speedKmh / Math.max(1, maxKmh), 0, 1);
    const gear =
      this.player.speed < -0.5
        ? 0
        : Math.min(6, Math.max(1, Math.ceil(speedRatio * 6)));
    const rpmRatio =
      speedKmh < 5
        ? 0.12
        : ((speedRatio * 6) % 1) * 0.55 + 0.45;

    // Check wrong-way against closest track tangent
    const smp = this.track.samples[this.player.hintIndex];
    _v2.set(-Math.sin(this.player.heading), 0, -Math.cos(this.player.heading));
    const wrongWay =
      this.player.speed > 5 && _v2.dot(smp.tangent) < -0.45;

    this.onTelemetry({
      countdown:
        this.countdownTimer > 0
          ? Math.ceil(this.countdownTimer)
          : this.raceElapsed < 0.9
            ? 0
            : -1,
      speedKmh,
      rpmRatio,
      gear,
      nitro: Math.round(this.player.nitro),
      isNitroActive: this.player.isNitroActive,
      isDrifting: this.player.isDrifting,
      driftScore: Math.round(this.player.driftMeters),
      lap: Math.min(this.player.lap, this.config.laps),
      totalLaps: this.config.laps,
      position: playerStanding.position,
      totalRacers: this.racers.length,
      raceTime: this.raceElapsed,
      currentLapTime: Math.max(0, this.raceElapsed - this.player.currentLapStart),
      bestLapTime: this.player.bestLapTime,
      wrongWay,
      standings,
      minimapPoints: this.track.minimapPoints,
      minimapRacers: this.racers.map((r) => ({
        x: r.position.x,
        z: r.position.z,
        isPlayer: r.isPlayer,
        color: r.color,
      })),
    });
  }

  private completeRace(): void {
    soundEngine.stopRaceAudio();
    const standings = this.getSortedStandings();

    // Estimate realistic finish time for unfinished AI cars from remaining distance & current pace
    const finalizedStandings = standings.map((entry) => {
      if (entry.finished) return entry;
      const racer = this.racers.find((r) => r.id === entry.id)!;
      const remainingFraction = Math.max(
        0.01,
        this.config.laps - racer.unwrappedProgress,
      );
      const remainingMeters = remainingFraction * this.track.totalLength;
      const estSpeed = Math.max(28, racer.speed);
      return {
        ...entry,
        finished: true,
        finishTime: this.raceElapsed + remainingMeters / estSpeed,
      };
    });

    const playerEntry = finalizedStandings.find((e) => e.isPlayer)!;
    const pos = playerEntry.position;
    soundEngine.playFinishFanfare(pos === 1);

    const trackSpec = this.track.spec;
    const diffMult =
      this.config.difficulty === 'Extremo'
        ? 1.6
        : this.config.difficulty === 'Difícil'
          ? 1.35
          : this.config.difficulty === 'Normal'
            ? 1.15
            : 1.0;

    const posMultiplier = pos === 1 ? 1.0 : pos === 2 ? 0.65 : pos === 3 ? 0.42 : 0.25;
    const baseCoins = Math.round(trackSpec.rewardBase * posMultiplier * diffMult);
    const positionBonus = pos === 1 ? 500 : pos === 2 ? 250 : pos === 3 ? 100 : 0;
    const driftBonus = Math.min(600, Math.round(this.player.driftMeters * 0.45));
    const coinsEarned = baseCoins + positionBonus + driftBonus;
    const xpEarned = Math.round((160 + (5 - pos) * 75) * diffMult);

    this.onFinish({
      trackId: this.config.trackId,
      difficulty: this.config.difficulty,
      laps: this.config.laps,
      playerPosition: pos,
      totalTime: this.player.finishTime,
      bestLapTime: this.player.bestLapTime,
      driftMeters: Math.round(this.player.driftMeters),
      nitroSeconds: Number(this.player.nitroSeconds.toFixed(1)),
      coinsEarned,
      positionBonus,
      driftBonus,
      xpEarned,
      newRecord: false, // computed by caller against LocalStorage
      standings: finalizedStandings,
      newlyUnlockedAchievements: [],
      championshipId: this.config.championshipId,
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.timers.forEach((t) => clearTimeout(t));
    window.removeEventListener('resize', this.handleResize);
    soundEngine.stopRaceAudio();
    this.racers.forEach((r) => r.built.dispose());
    this.track.dispose();
    this.particles?.dispose();
    this.envTex.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
