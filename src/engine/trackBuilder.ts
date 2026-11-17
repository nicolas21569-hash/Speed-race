import * as THREE from 'three';
import { TrackSpec } from '../types/game';
import { createAsphaltTexture, createCheckerTexture } from './webglSetup';

export interface TrackSample {
  s: number; // 0..1
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
}

export interface TrackObstacle {
  position: THREE.Vector3;
  radius: number;
  s: number;
  lateralOffset: number;
}

export interface NitroPad {
  position: THREE.Vector3;
  s: number;
  lateralOffset: number;
  radius: number;
}

export interface BuiltTrack {
  spec: TrackSpec;
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  samples: TrackSample[];
  obstacles: TrackObstacle[];
  nitroPads: NitroPad[];
  minimapPoints: Array<{ x: number; z: number }>;
  totalLength: number;
  getClosestSample: (pos: THREE.Vector3, hintIndex?: number) => {
    index: number;
    sample: TrackSample;
    lateralOffset: number;
    distSq: number;
  };
  dispose: () => void;
}

const UP = new THREE.Vector3(0, 1, 0);

export function buildProceduralTrack(
  spec: TrackSpec,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): BuiltTrack {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Scene atmosphere & fog matched to track
  scene.background = new THREE.Color(spec.skyColor);
  scene.fog = new THREE.FogExp2(spec.fogColor, spec.fogDensity);

  // Spline setup
  const rawPts = spec.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(rawPts, true, 'catmullrom', 0.45);
  const totalLength = curve.getLength();

  const sampleCount = 360;
  const samples: TrackSample[] = [];
  const minimapPoints: Array<{ x: number; z: number }> = [];

  for (let i = 0; i < sampleCount; i++) {
    const s = i / sampleCount;
    const point = curve.getPointAt(s);
    const tangent = curve.getTangentAt(s).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, UP).normalize();
    samples.push({ s, point, tangent, right });
    if (i % 4 === 0) {
      minimapPoints.push({ x: point.x, z: point.z });
    }
  }

  // 1. Continuous Road Ribbon Mesh + Side Guardrails
  const halfW = spec.roadWidth * 0.5;
  const roadVerts: number[] = [];
  const roadNorms: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  const curbVerts: number[] = [];
  const curbNorms: number[] = [];
  const curbIndices: number[] = [];

  const railHeight = 0.72;
  const railOffset = halfW + 0.55;

  for (let i = 0; i <= sampleCount; i++) {
    const smp = samples[i % sampleCount];
    const pL = smp.point.clone().addScaledVector(smp.right, -halfW);
    const pR = smp.point.clone().addScaledVector(smp.right, halfW);

    roadVerts.push(pL.x, pL.y + 0.04, pL.z);
    roadVerts.push(pR.x, pR.y + 0.04, pR.z);
    roadNorms.push(0, 1, 0, 0, 1, 0);

    const vCoord = (i / sampleCount) * (totalLength / 14);
    roadUvs.push(0, vCoord, 1, vCoord);

    // Side barriers (left outer + right outer)
    const bL = smp.point.clone().addScaledVector(smp.right, -railOffset);
    const bR = smp.point.clone().addScaledVector(smp.right, railOffset);

    curbVerts.push(
      bL.x, bL.y - 0.5, bL.z,
      bL.x, bL.y + railHeight, bL.z,
      bR.x, bR.y - 0.5, bR.z,
      bR.x, bR.y + railHeight, bR.z,
    );
    curbNorms.push(
      smp.right.x, 0, smp.right.z,
      smp.right.x, 0, smp.right.z,
      -smp.right.x, 0, -smp.right.z,
      -smp.right.x, 0, -smp.right.z,
    );

    if (i < sampleCount) {
      const rBase = i * 2;
      roadIndices.push(rBase, rBase + 2, rBase + 1);
      roadIndices.push(rBase + 1, rBase + 2, rBase + 3);

      const cBase = i * 4;
      // Left wall facing inward
      curbIndices.push(cBase, cBase + 1, cBase + 4);
      curbIndices.push(cBase + 1, cBase + 5, cBase + 4);
      // Right wall facing inward
      curbIndices.push(cBase + 2, cBase + 6, cBase + 3);
      curbIndices.push(cBase + 3, cBase + 6, cBase + 7);
    }
  }

  const roadGeo = trackGeo(new THREE.BufferGeometry());
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVerts, 3));
  roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNorms, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);

  const asphaltBase =
    spec.id === 'desert'
      ? '#262322'
      : spec.id === 'tropical_coast'
        ? '#262930'
        : '#181a22';
  const asphaltTex = createAsphaltTexture(renderer, spec.accentNeon, asphaltBase);
  textures.push(asphaltTex);

  const roadMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: spec.id === 'futuristic_city' ? 0.35 : 0.72,
      metalness: spec.id === 'futuristic_city' ? 0.25 : 0.08,
    }),
  );
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Road support deck beneath ribbon (gives thickness on elevated sections)
  const deckGeo = trackGeo(roadGeo.clone());
  deckGeo.translate(0, -0.45, 0);
  const deckMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e222e,
      roughness: 0.85,
      metalness: 0.2,
      side: THREE.DoubleSide,
    }),
  );
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  group.add(deckMesh);

  // Guardrails
  const barrierGeo = trackGeo(new THREE.BufferGeometry());
  barrierGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbVerts, 3));
  barrierGeo.setAttribute('normal', new THREE.Float32BufferAttribute(curbNorms, 3));
  barrierGeo.setIndex(curbIndices);
  const barrierMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.id === 'futuristic_city' || spec.id === 'futuristic_highway' ? 0x111827 : 0x334155,
      emissive: new THREE.Color(spec.accentNeon),
      emissiveIntensity:
        spec.id === 'futuristic_city' || spec.id === 'futuristic_highway' ? 0.35 : 0.06,
      roughness: 0.45,
      metalness: 0.55,
      side: THREE.DoubleSide,
    }),
  );
  const barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
  barrierMesh.castShadow = true;
  barrierMesh.receiveShadow = true;
  group.add(barrierMesh);

  // 2. Start / Finish Line & Gantry Arch
  const startSmp = samples[0];
  const checkerTex = createCheckerTexture(renderer);
  textures.push(checkerTex);
  const finishLineGeo = trackGeo(new THREE.PlaneGeometry(spec.roadWidth * 0.94, 4.2));
  finishLineGeo.rotateX(-Math.PI / 2);
  const finishLineMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: checkerTex,
      roughness: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
  finishLine.position.copy(startSmp.point).add(new THREE.Vector3(0, 0.08, 0));
  finishLine.lookAt(
    startSmp.point.x + startSmp.tangent.x,
    startSmp.point.y + 0.08,
    startSmp.point.z + startSmp.tangent.z,
  );
  group.add(finishLine);

  const gantryGroup = new THREE.Group();
  gantryGroup.position.copy(startSmp.point);
  const startYaw = Math.atan2(-startSmp.tangent.x, -startSmp.tangent.z);
  gantryGroup.rotation.y = startYaw;

  const pillarGeo = trackGeo(new THREE.BoxGeometry(0.9, 8.5, 0.9));
  const gantryMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.7,
      roughness: 0.3,
    }),
  );
  const neonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.accentNeon,
      emissive: new THREE.Color(spec.accentNeon),
      emissiveIntensity: 2.0,
    }),
  );
  const pLeft = new THREE.Mesh(pillarGeo, gantryMat);
  pLeft.position.set(-halfW - 0.6, 4.25, 0);
  const pRight = new THREE.Mesh(pillarGeo, gantryMat);
  pRight.position.set(halfW + 0.6, 4.25, 0);
  const topBeamGeo = trackGeo(new THREE.BoxGeometry(spec.roadWidth + 2.4, 1.35, 1.2));
  const topBeam = new THREE.Mesh(topBeamGeo, gantryMat);
  topBeam.position.set(0, 8.3, 0);
  const topStripGeo = trackGeo(new THREE.BoxGeometry(spec.roadWidth + 1.4, 0.28, 1.3));
  const topStrip = new THREE.Mesh(topStripGeo, neonMat);
  topStrip.position.set(0, 8.3, 0);
  gantryGroup.add(pLeft, pRight, topBeam, topStrip);
  group.add(gantryGroup);

  // 3. Outer World Ground / Ocean extending beyond playable perimeter to horizon fog
  const groundColor =
    spec.id === 'desert'
      ? 0xb45309
      : spec.id === 'tropical_coast'
        ? 0x0284c7
        : spec.id === 'mountains'
          ? 0x334155
          : 0x090d16;
  const groundGeo = trackGeo(new THREE.PlaneGeometry(2400, 2400));
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: groundColor,
      roughness: spec.id === 'tropical_coast' ? 0.18 : 0.9,
      metalness: spec.id === 'tropical_coast' ? 0.45 : 0.05,
    }),
  );
  const groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.position.y = -1.6;
  groundPlane.receiveShadow = true;
  group.add(groundPlane);

  // For tropical coast, add a sandy island shoulder under the road area
  if (spec.id === 'tropical_coast') {
    const sandGeo = trackGeo(new THREE.RingGeometry(95, 265, 48));
    sandGeo.rotateX(-Math.PI / 2);
    const sandMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe7c68b,
        roughness: 0.92,
      }),
    );
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.position.y = -0.35;
    sandMesh.receiveShadow = true;
    group.add(sandMesh);
  }

  // 4. Track Obstacles (dodgeable chicane pylons/barriers) & Nitro Pads
  const obstacles: TrackObstacle[] = [];
  const nitroPads: NitroPad[] = [];

  const obsMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.55,
      roughness: 0.35,
    }),
  );
  const obsGeo = trackGeo(new THREE.CylinderGeometry(0.45, 0.72, 1.35, 10));

  const obsFractions = [0.14, 0.29, 0.46, 0.63, 0.79, 0.91];
  obsFractions.forEach((frac, idx) => {
    const smpIdx = Math.floor(frac * sampleCount) % sampleCount;
    const smp = samples[smpIdx];
    const lat = (idx % 2 === 0 ? 1 : -1) * (halfW * 0.48);
    const pos = smp.point.clone().addScaledVector(smp.right, lat);
    const mesh = new THREE.Mesh(obsGeo, obsMat);
    mesh.position.set(pos.x, pos.y + 0.68, pos.z);
    mesh.castShadow = true;
    group.add(mesh);
    obstacles.push({
      position: pos,
      radius: 0.95,
      s: frac,
      lateralOffset: lat,
    });
  });

  const padGeo = trackGeo(new THREE.PlaneGeometry(3.2, 6.2));
  padGeo.rotateX(-Math.PI / 2);
  const padMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x00d2ff,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const padFractions = [0.09, 0.37, 0.55, 0.74, 0.86];
  padFractions.forEach((frac, idx) => {
    const smpIdx = Math.floor(frac * sampleCount) % sampleCount;
    const smp = samples[smpIdx];
    const lat = (idx % 2 === 0 ? -1 : 1) * (halfW * 0.25);
    const pos = smp.point.clone().addScaledVector(smp.right, lat);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(pos.x, pos.y + 0.09, pos.z);
    pad.lookAt(
      pos.x + smp.tangent.x,
      pos.y + 0.09,
      pos.z + smp.tangent.z,
    );
    group.add(pad);
    nitroPads.push({
      position: pos,
      s: frac,
      lateralOffset: lat,
      radius: 3.1,
    });
  });

  // 5. Instanced Scenery Props tailored to each of the 5 circuits
  populateTrackScenery(
    spec,
    samples,
    halfW,
    group,
    trackGeo,
    trackMat,
  );

  scene.add(group);

  // Fast closest-sample spatial query (local window if hintIndex given, else full scan)
  const getClosestSample = (pos: THREE.Vector3, hintIndex?: number) => {
    let bestIdx = 0;
    let bestDistSq = Infinity;

    if (hintIndex !== undefined && hintIndex >= 0) {
      const windowRadius = 26;
      for (let offset = -windowRadius; offset <= windowRadius; offset++) {
        const idx = (hintIndex + offset + sampleCount) % sampleCount;
        const p = samples[idx].point;
        const dx = pos.x - p.x;
        const dz = pos.z - p.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = idx;
        }
      }
      // Fallback full scan if vehicle teleported / deviated far
      if (bestDistSq > 1600) {
        for (let i = 0; i < sampleCount; i++) {
          const p = samples[i].point;
          const dx = pos.x - p.x;
          const dz = pos.z - p.z;
          const dSq = dx * dx + dz * dz;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestIdx = i;
          }
        }
      }
    } else {
      for (let i = 0; i < sampleCount; i++) {
        const p = samples[i].point;
        const dx = pos.x - p.x;
        const dz = pos.z - p.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = i;
        }
      }
    }

    const smp = samples[bestIdx];
    const relX = pos.x - smp.point.x;
    const relZ = pos.z - smp.point.z;
    const lateralOffset = relX * smp.right.x + relZ * smp.right.z;

    return {
      index: bestIdx,
      sample: smp,
      lateralOffset,
      distSq: bestDistSq,
    };
  };

  return {
    spec,
    group,
    curve,
    samples,
    obstacles,
    nitroPads,
    minimapPoints,
    totalLength,
    getClosestSample,
    dispose: () => {
      scene.remove(group);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

function populateTrackScenery(
  spec: TrackSpec,
  samples: TrackSample[],
  halfW: number,
  group: THREE.Group,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
): void {
  const dummy = new THREE.Object3D();
  const propCount = 96;

  // Deterministic pseudo-random helper per track so tracks look consistent
  let seed = spec.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 17);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const isInsideRoadSafetyZone = (x: number, z: number): boolean => {
    const minSq = (halfW + 7.5) * (halfW + 7.5);
    for (let i = 0; i < samples.length; i += 3) {
      const p = samples[i].point;
      const dx = x - p.x;
      const dz = z - p.z;
      if (dx * dx + dz * dz < minSq) return true;
    }
    return false;
  };

  const placements: Array<{
    x: number;
    y: number;
    z: number;
    scale: number;
    rotY: number;
  }> = [];

  for (let i = 0; i < propCount * 2 && placements.length < propCount; i++) {
    const smp = samples[Math.floor((i / (propCount * 2)) * samples.length)];
    const side = i % 2 === 0 ? 1 : -1;
    const dist = halfW + 10 + rand() * 58;
    const x = smp.point.x + smp.right.x * side * dist + (rand() - 0.5) * 8;
    const z = smp.point.z + smp.right.z * side * dist + (rand() - 0.5) * 8;
    if (isInsideRoadSafetyZone(x, z)) continue;
    placements.push({
      x,
      y: -1.5,
      z,
      scale: 0.75 + rand() * 0.7,
      rotY: rand() * Math.PI * 2,
    });
  }

  if (placements.length === 0) return;

  if (spec.id === 'futuristic_city') {
    const bGeo = trackGeo(new THREE.BoxGeometry(11, 1, 11));
    bGeo.translate(0, 0.5, 0);
    const bMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x111827,
        metalness: 0.75,
        roughness: 0.25,
      }),
    );
    const inst = new THREE.InstancedMesh(bGeo, bMat, placements.length);
    const trimGeo = trackGeo(new THREE.BoxGeometry(11.3, 0.65, 11.3));
    const trimMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x00d2ff,
        emissive: 0x00d2ff,
        emissiveIntensity: 1.5,
      }),
    );
    const trimInst = new THREE.InstancedMesh(trimGeo, trimMat, placements.length);

    placements.forEach((p, idx) => {
      const h = 24 + (idx % 6) * 14 * p.scale;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.scale.set(p.scale, h, p.scale);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(p.x, p.y + h * 0.85, p.z);
      dummy.scale.set(p.scale, 1, p.scale);
      dummy.updateMatrix();
      trimInst.setMatrixAt(idx, dummy.matrix);
      trimInst.setColorAt(
        idx,
        new THREE.Color(idx % 3 === 0 ? 0xef4444 : 0x00d2ff),
      );
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    trimInst.instanceMatrix.needsUpdate = true;
    if (trimInst.instanceColor) trimInst.instanceColor.needsUpdate = true;
    trimInst.computeBoundingSphere();
    group.add(inst, trimInst);
  } else if (spec.id === 'desert') {
    const rockGeo = trackGeo(new THREE.DodecahedronGeometry(6.5, 0));
    const rockMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xc2410c,
        roughness: 0.92,
        metalness: 0.05,
        flatShading: true,
      }),
    );
    const inst = new THREE.InstancedMesh(rockGeo, rockMat, placements.length);
    placements.forEach((p, idx) => {
      dummy.position.set(p.x, p.y + 2.2 * p.scale, p.z);
      dummy.rotation.set(0.1 * idx, p.rotY, 0);
      dummy.scale.set(p.scale * 1.4, p.scale * (1.2 + (idx % 3) * 0.7), p.scale);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
      inst.setColorAt(
        idx,
        new THREE.Color(idx % 2 === 0 ? 0xc2410c : 0x9a3412),
      );
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  } else if (spec.id === 'tropical_coast') {
    const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.46, 8.5, 7));
    trunkGeo.translate(0, 4.25, 0);
    const trunkMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }),
    );
    const crownGeo = trackGeo(new THREE.ConeGeometry(3.4, 2.2, 7));
    const crownMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.75 }),
    );
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, placements.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, placements.length);

    placements.forEach((p, idx) => {
      dummy.position.set(p.x, p.y + 0.8, p.z);
      dummy.rotation.set(0.08, p.rotY, 0.06);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(p.x + 0.4 * p.scale, p.y + 0.8 + 8.3 * p.scale, p.z);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      crowns.setMatrixAt(idx, dummy.matrix);
    });
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
    group.add(trunks, crowns);
  } else if (spec.id === 'mountains') {
    const pineGeo = trackGeo(new THREE.ConeGeometry(3.5, 13, 7));
    pineGeo.translate(0, 6.5, 0);
    const pineMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x14532d,
        roughness: 0.85,
        flatShading: true,
      }),
    );
    const inst = new THREE.InstancedMesh(pineGeo, pineMat, placements.length);
    placements.forEach((p, idx) => {
      dummy.position.set(p.x, p.y + 0.6, p.z);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.scale.set(p.scale, p.scale * (0.9 + (idx % 3) * 0.3), p.scale);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);

    // Distant alpine peaks ring
    const peakGeo = trackGeo(new THREE.ConeGeometry(42, 72, 6));
    const peakMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.9,
        flatShading: true,
      }),
    );
    const peaks = new THREE.InstancedMesh(peakGeo, peakMat, 18);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const dist = 340 + (i % 3) * 45;
      dummy.position.set(Math.cos(a) * dist, 28, Math.sin(a) * dist);
      dummy.rotation.set(0, a, 0);
      dummy.scale.set(1.2, 1 + (i % 4) * 0.35, 1.2);
      dummy.updateMatrix();
      peaks.setMatrixAt(i, dummy.matrix);
    }
    peaks.instanceMatrix.needsUpdate = true;
    peaks.computeBoundingSphere();
    group.add(peaks);
  } else {
    // futuristic_highway: Glowing energy arches along the track + outer pylons
    const archGeo = trackGeo(new THREE.TorusGeometry(halfW + 3.5, 0.38, 8, 24, Math.PI));
    const archMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 1.6,
      }),
    );
    const archCount = 16;
    const arches = new THREE.InstancedMesh(archGeo, archMat, archCount);
    for (let i = 0; i < archCount; i++) {
      const smp = samples[Math.floor((i / archCount) * samples.length)];
      const yaw = Math.atan2(-smp.tangent.x, -smp.tangent.z);
      dummy.position.copy(smp.point);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      arches.setMatrixAt(i, dummy.matrix);
      arches.setColorAt(
        i,
        new THREE.Color(i % 2 === 0 ? 0xef4444 : 0x00d2ff),
      );
    }
    arches.instanceMatrix.needsUpdate = true;
    if (arches.instanceColor) arches.instanceColor.needsUpdate = true;
    arches.computeBoundingSphere();
    group.add(arches);
  }
}
