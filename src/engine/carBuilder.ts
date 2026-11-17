import * as THREE from 'three';
import { CarArchetype, PaintFinish, VehicleSpec } from '../types/game';
import { createContactShadowTexture } from './webglSetup';

export interface BuiltCar {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  paintMaterial: THREE.MeshPhysicalMaterial;
  accentMaterial: THREE.MeshStandardMaterial;
  brakeLightMaterial: THREE.MeshStandardMaterial;
  nitroFlames: THREE.Mesh[];
  wheelsSpin: THREE.Object3D[];
  frontSteerPivots: THREE.Object3D[];
  headlightGlows: THREE.Mesh[];
  setPaint: (color: string, finish: PaintFinish) => void;
  setBraking: (braking: boolean) => void;
  setNitroVisual: (active: boolean, time: number) => void;
  dispose: () => void;
}

interface ArchetypeDimensions {
  length: number;
  width: number;
  noseHeight: number;
  cabinHeight: number;
  rearHeight: number;
  spoilerStyle: 'gt_wing' | 'ducktail' | 'double_wing' | 'shark_fin' | 'none';
  hasRoofScoop: boolean;
  wheelRadius: number;
  wheelWidth: number;
}

function getArchetypeDims(archetype: CarArchetype): ArchetypeDimensions {
  switch (archetype) {
    case 'muscle_coupe':
      return {
        length: 4.5,
        width: 2.04,
        noseHeight: 0.64,
        cabinHeight: 1.24,
        rearHeight: 0.78,
        spoilerStyle: 'ducktail',
        hasRoofScoop: false,
        wheelRadius: 0.38,
        wheelWidth: 0.3,
      };
    case 'rally_evo':
      return {
        length: 4.25,
        width: 1.98,
        noseHeight: 0.66,
        cabinHeight: 1.28,
        rearHeight: 0.82,
        spoilerStyle: 'gt_wing',
        hasRoofScoop: true,
        wheelRadius: 0.39,
        wheelWidth: 0.31,
      };
    case 'cyber_wedge':
      return {
        length: 4.55,
        width: 2.08,
        noseHeight: 0.38,
        cabinHeight: 1.02,
        rearHeight: 0.72,
        spoilerStyle: 'shark_fin',
        hasRoofScoop: false,
        wheelRadius: 0.36,
        wheelWidth: 0.3,
      };
    case 'twin_turbo_r':
      return {
        length: 4.5,
        width: 2.06,
        noseHeight: 0.48,
        cabinHeight: 1.12,
        rearHeight: 0.74,
        spoilerStyle: 'double_wing',
        hasRoofScoop: true,
        wheelRadius: 0.37,
        wheelWidth: 0.32,
      };
    case 'concept_volt':
      return {
        length: 4.48,
        width: 2.05,
        noseHeight: 0.44,
        cabinHeight: 1.08,
        rearHeight: 0.7,
        spoilerStyle: 'ducktail',
        hasRoofScoop: false,
        wheelRadius: 0.38,
        wheelWidth: 0.29,
      };
    case 'hyper_blade':
      return {
        length: 4.62,
        width: 2.12,
        noseHeight: 0.4,
        cabinHeight: 1.04,
        rearHeight: 0.7,
        spoilerStyle: 'double_wing',
        hasRoofScoop: true,
        wheelRadius: 0.37,
        wheelWidth: 0.33,
      };
    case 'stealth_interceptor':
      return {
        length: 4.72,
        width: 2.1,
        noseHeight: 0.36,
        cabinHeight: 1.0,
        rearHeight: 0.74,
        spoilerStyle: 'shark_fin',
        hasRoofScoop: true,
        wheelRadius: 0.37,
        wheelWidth: 0.32,
      };
    case 'formula_apex':
      return {
        length: 4.78,
        width: 2.16,
        noseHeight: 0.34,
        cabinHeight: 0.96,
        rearHeight: 0.66,
        spoilerStyle: 'double_wing',
        hasRoofScoop: true,
        wheelRadius: 0.39,
        wheelWidth: 0.36,
      };
    case 'apex_legend':
      return {
        length: 4.68,
        width: 2.14,
        noseHeight: 0.38,
        cabinHeight: 1.03,
        rearHeight: 0.72,
        spoilerStyle: 'double_wing',
        hasRoofScoop: true,
        wheelRadius: 0.38,
        wheelWidth: 0.34,
      };
    case 'aerodynamic_gt':
    default:
      return {
        length: 4.42,
        width: 2.0,
        noseHeight: 0.5,
        cabinHeight: 1.14,
        rearHeight: 0.72,
        spoilerStyle: 'gt_wing',
        hasRoofScoop: false,
        wheelRadius: 0.36,
        wheelWidth: 0.29,
      };
  }
}

function applyPaintFinish(
  mat: THREE.MeshPhysicalMaterial,
  color: string,
  finish: PaintFinish,
): void {
  mat.color.set(color);
  if (finish === 'matte') {
    mat.metalness = 0.25;
    mat.roughness = 0.68;
    mat.clearcoat = 0.08;
    mat.clearcoatRoughness = 0.55;
    mat.iridescence = 0;
  } else if (finish === 'pearl') {
    mat.metalness = 0.65;
    mat.roughness = 0.2;
    mat.clearcoat = 1.0;
    mat.clearcoatRoughness = 0.06;
    mat.iridescence = 0.75;
    mat.iridescenceIOR = 1.35;
  } else {
    // metallic
    mat.metalness = 0.85;
    mat.roughness = 0.24;
    mat.clearcoat = 1.0;
    mat.clearcoatRoughness = 0.09;
    mat.iridescence = 0;
  }
  mat.needsUpdate = true;
}

/**
 * Builds a composite 10+ part procedural 3D sports car oriented facing -Z (forward),
 * with bottom-center pivot at y=0 (tires touching the road).
 */
export function buildProceduralCar(
  spec: VehicleSpec,
  colorHex?: string,
  finish: PaintFinish = 'metallic',
  isSoftwareGl = false,
): BuiltCar {
  const dims = getArchetypeDims(spec.archetype);
  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

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

  // Materials with strong roughness/metalness contrast (>= 0.25 difference)
  const paintMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: colorHex ?? spec.defaultColor,
      metalness: 0.85,
      roughness: 0.24,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    }),
  );
  applyPaintFinish(paintMaterial, colorHex ?? spec.defaultColor, finish);

  const carbonMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x16181f,
      metalness: 0.25,
      roughness: 0.62,
    }),
  );

  const accentMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.accentColor,
      metalness: 0.7,
      roughness: 0.22,
      emissive: new THREE.Color(spec.accentColor),
      emissiveIntensity: 0.22,
    }),
  );

  const glassMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b1220,
      metalness: 0.1,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: isSoftwareGl ? 0.82 : 0.88,
    }),
  );

  const rimMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd4d8e0,
      metalness: 0.92,
      roughness: 0.18,
    }),
  );

  const tireMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x141519,
      metalness: 0.05,
      roughness: 0.88,
    }),
  );

  const headlightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0xbae6fd,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    }),
  );

  const brakeLightMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xff1e38,
      emissive: 0xef4444,
      emissiveIntensity: 1.3,
      roughness: 0.15,
    }),
  );

  const flameMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  // 1. Primary Silhouette: Sculpted extruded side-profile body (extruded along X, rotated so nose is -Z)
  const halfL = dims.length * 0.5;
  const bodyProfile = new THREE.Shape();
  bodyProfile.moveTo(-halfL, 0.22);
  bodyProfile.lineTo(halfL, 0.22);
  bodyProfile.lineTo(halfL + 0.08, dims.noseHeight); // Front bumper lip
  bodyProfile.lineTo(halfL * 0.42, dims.noseHeight + 0.14); // Hood line
  bodyProfile.lineTo(halfL * 0.12, dims.cabinHeight); // Windshield
  bodyProfile.lineTo(-halfL * 0.34, dims.cabinHeight); // Roofline
  bodyProfile.lineTo(-halfL * 0.78, dims.rearHeight + 0.08); // Fastback deck
  bodyProfile.lineTo(-halfL - 0.04, dims.rearHeight); // Rear deck
  bodyProfile.lineTo(-halfL, 0.22);

  const bodyW = dims.width * 0.88;
  const mainBodyGeo = trackGeo(
    new THREE.ExtrudeGeometry(bodyProfile, {
      steps: 1,
      depth: bodyW,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.06,
      bevelSegments: 2,
    }),
  );
  // Center along extrusion Z, then rotate Y so X_shape (front = +halfL) faces -Z
  mainBodyGeo.translate(0, 0, -bodyW * 0.5);
  mainBodyGeo.rotateY(Math.PI / 2);
  const mainBodyMesh = new THREE.Mesh(mainBodyGeo, paintMaterial);
  mainBodyMesh.castShadow = true;
  mainBodyMesh.receiveShadow = true;
  chassisGroup.add(mainBodyMesh);

  // 2. Sculpted side fenders / wheel arches
  const fenderGeo = trackGeo(
    new THREE.BoxGeometry(dims.width, 0.34, dims.length * 0.84),
  );
  const fenderMesh = new THREE.Mesh(fenderGeo, paintMaterial);
  fenderMesh.position.set(0, 0.42, 0);
  fenderMesh.castShadow = true;
  fenderMesh.receiveShadow = true;
  chassisGroup.add(fenderMesh);

  // 3. Lower carbon aero floor / front splitter & side skirts
  const splitterGeo = trackGeo(
    new THREE.BoxGeometry(dims.width * 1.03, 0.08, dims.length * 1.05),
  );
  const splitterMesh = new THREE.Mesh(splitterGeo, carbonMaterial);
  splitterMesh.position.set(0, 0.2, 0);
  splitterMesh.castShadow = true;
  chassisGroup.add(splitterMesh);

  // 4. Glass Canopy & Windshield Inset
  const canopyProfile = new THREE.Shape();
  canopyProfile.moveTo(halfL * 0.35, dims.noseHeight + 0.14);
  canopyProfile.lineTo(halfL * 0.1, dims.cabinHeight + 0.015);
  canopyProfile.lineTo(-halfL * 0.33, dims.cabinHeight + 0.015);
  canopyProfile.lineTo(-halfL * 0.68, dims.rearHeight + 0.08);
  canopyProfile.lineTo(halfL * 0.35, dims.noseHeight + 0.14);

  const canopyW = bodyW * 0.78;
  const canopyGeo = trackGeo(
    new THREE.ExtrudeGeometry(canopyProfile, {
      steps: 1,
      depth: canopyW,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 2,
    }),
  );
  canopyGeo.translate(0, 0, -canopyW * 0.5);
  canopyGeo.rotateY(Math.PI / 2);
  const canopyMesh = new THREE.Mesh(canopyGeo, glassMaterial);
  chassisGroup.add(canopyMesh);

  // 5. Roof scoop (for race/hyper archetypes)
  if (dims.hasRoofScoop) {
    const scoopGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.13, 0.72));
    const scoop = new THREE.Mesh(scoopGeo, carbonMaterial);
    scoop.position.set(0, dims.cabinHeight + 0.06, 0.18);
    scoop.castShadow = true;
    chassisGroup.add(scoop);
  }

  // 6. Accent Racing Stripe / Side Trim
  const stripeGeo = trackGeo(
    new THREE.BoxGeometry(0.18, 0.03, dims.length * 0.94),
  );
  const stripeMesh = new THREE.Mesh(stripeGeo, accentMaterial);
  stripeMesh.position.set(0, dims.noseHeight + 0.12, -0.05);
  chassisGroup.add(stripeMesh);

  // 7. Rear Spoiler / Wing (differentiated by archetype)
  if (dims.spoilerStyle === 'gt_wing' || dims.spoilerStyle === 'double_wing') {
    const pylonGeo = trackGeo(new THREE.BoxGeometry(0.06, 0.32, 0.24));
    const pylonL = new THREE.Mesh(pylonGeo, carbonMaterial);
    const pylonR = new THREE.Mesh(pylonGeo, carbonMaterial);
    pylonL.position.set(-dims.width * 0.28, dims.rearHeight + 0.15, halfL - 0.28);
    pylonR.position.set(dims.width * 0.28, dims.rearHeight + 0.15, halfL - 0.28);
    chassisGroup.add(pylonL, pylonR);

    const wingGeo = trackGeo(new THREE.BoxGeometry(dims.width * 1.02, 0.06, 0.34));
    const wing = new THREE.Mesh(wingGeo, carbonMaterial);
    wing.position.set(0, dims.rearHeight + 0.31, halfL - 0.24);
    wing.rotation.x = 0.08;
    wing.castShadow = true;
    chassisGroup.add(wing);

    const endplateGeo = trackGeo(new THREE.BoxGeometry(0.04, 0.22, 0.38));
    const epL = new THREE.Mesh(endplateGeo, accentMaterial);
    const epR = new THREE.Mesh(endplateGeo, accentMaterial);
    epL.position.set(-dims.width * 0.51, dims.rearHeight + 0.3, halfL - 0.24);
    epR.position.set(dims.width * 0.51, dims.rearHeight + 0.3, halfL - 0.24);
    chassisGroup.add(epL, epR);

    if (dims.spoilerStyle === 'double_wing') {
      const upperWingGeo = trackGeo(
        new THREE.BoxGeometry(dims.width * 0.94, 0.045, 0.22),
      );
      const upperWing = new THREE.Mesh(upperWingGeo, paintMaterial);
      upperWing.position.set(0, dims.rearHeight + 0.42, halfL - 0.18);
      upperWing.rotation.x = 0.12;
      chassisGroup.add(upperWing);
    }
  } else if (dims.spoilerStyle === 'ducktail') {
    const lipGeo = trackGeo(new THREE.BoxGeometry(dims.width * 0.92, 0.14, 0.24));
    const lip = new THREE.Mesh(lipGeo, paintMaterial);
    lip.position.set(0, dims.rearHeight + 0.07, halfL - 0.14);
    lip.rotation.x = -0.35;
    chassisGroup.add(lip);
  } else if (dims.spoilerStyle === 'shark_fin') {
    const finGeo = trackGeo(new THREE.BoxGeometry(0.06, 0.34, 1.05));
    const fin = new THREE.Mesh(finGeo, accentMaterial);
    fin.position.set(0, dims.rearHeight + 0.2, halfL - 0.65);
    chassisGroup.add(fin);
  }

  // 8. Headlights (at -Z front) & Taillight LED bar (at +Z rear)
  const headlightGlows: THREE.Mesh[] = [];
  const hlGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.1, 0.08));
  const hlL = new THREE.Mesh(hlGeo, headlightMat);
  const hlR = new THREE.Mesh(hlGeo, headlightMat);
  hlL.position.set(-dims.width * 0.32, dims.noseHeight - 0.04, -halfL - 0.02);
  hlR.position.set(dims.width * 0.32, dims.noseHeight - 0.04, -halfL - 0.02);
  chassisGroup.add(hlL, hlR);
  headlightGlows.push(hlL, hlR);

  const tlGeo = trackGeo(new THREE.BoxGeometry(dims.width * 0.82, 0.08, 0.08));
  const tlBar = new THREE.Mesh(tlGeo, brakeLightMaterial);
  tlBar.position.set(0, dims.rearHeight - 0.1, halfL + 0.02);
  chassisGroup.add(tlBar);

  // 9. Twin Exhausts + Nitro Flame Cones (at +Z rear)
  const nitroFlames: THREE.Mesh[] = [];
  const pipeGeo = trackGeo(
    new THREE.CylinderGeometry(0.075, 0.075, 0.22, 12),
  );
  pipeGeo.rotateX(Math.PI / 2);
  const flameGeo = trackGeo(new THREE.ConeGeometry(0.11, 0.85, 10));
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 0.42);

  [-0.34, 0.34].forEach((offsetX) => {
    const pipe = new THREE.Mesh(pipeGeo, rimMaterial);
    pipe.position.set(offsetX, 0.28, halfL + 0.02);
    chassisGroup.add(pipe);

    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(offsetX, 0.28, halfL + 0.08);
    flame.visible = false;
    chassisGroup.add(flame);
    nitroFlames.push(flame);
  });

  // 10. Four Composite Wheels (Tire + Alloy Rim + Brake Disc)
  const wheelsSpin: THREE.Object3D[] = [];
  const frontSteerPivots: THREE.Object3D[] = [];

  const tireGeo = trackGeo(
    new THREE.CylinderGeometry(
      dims.wheelRadius,
      dims.wheelRadius,
      dims.wheelWidth,
      20,
    ),
  );
  tireGeo.rotateZ(Math.PI / 2);

  const rimGeo = trackGeo(
    new THREE.CylinderGeometry(
      dims.wheelRadius * 0.64,
      dims.wheelRadius * 0.64,
      dims.wheelWidth + 0.018,
      10,
    ),
  );
  rimGeo.rotateZ(Math.PI / 2);

  const hubGeo = trackGeo(
    new THREE.CylinderGeometry(
      dims.wheelRadius * 0.24,
      dims.wheelRadius * 0.24,
      dims.wheelWidth + 0.04,
      8,
    ),
  );
  hubGeo.rotateZ(Math.PI / 2);

  const wheelTrackX = dims.width * 0.47;
  const frontZ = -halfL * 0.62;
  const rearZ = halfL * 0.62;

  const wheelSpecs = [
    { x: -wheelTrackX, z: frontZ, isFront: true },
    { x: wheelTrackX, z: frontZ, isFront: true },
    { x: -wheelTrackX, z: rearZ, isFront: false },
    { x: wheelTrackX, z: rearZ, isFront: false },
  ];

  for (const wSpec of wheelSpecs) {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wSpec.x, dims.wheelRadius, wSpec.z);

    const spinGroup = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMaterial);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMaterial);
    const hub = new THREE.Mesh(hubGeo, accentMaterial);
    spinGroup.add(tire, rim, hub);
    steerPivot.add(spinGroup);
    root.add(steerPivot);

    wheelsSpin.push(spinGroup);
    if (wSpec.isFront) frontSteerPivots.push(steerPivot);
  }

  // 11. Grounded radial contact shadow beneath chassis (prevents floating look)
  const shadowTex = createContactShadowTexture();
  textures.push(shadowTex);
  const contactShadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    }),
  );
  const contactGeo = trackGeo(
    new THREE.PlaneGeometry(dims.width * 1.45, dims.length * 1.32),
  );
  contactGeo.rotateX(-Math.PI / 2);
  const contactShadow = new THREE.Mesh(contactGeo, contactShadowMat);
  contactShadow.position.y = 0.025;
  root.add(contactShadow);

  return {
    root,
    chassisGroup,
    paintMaterial,
    accentMaterial,
    brakeLightMaterial,
    nitroFlames,
    wheelsSpin,
    frontSteerPivots,
    headlightGlows,
    setPaint: (color, nextFinish) => {
      applyPaintFinish(paintMaterial, color, nextFinish);
    },
    setBraking: (braking) => {
      brakeLightMaterial.emissiveIntensity = braking ? 3.8 : 1.1;
    },
    setNitroVisual: (active, time) => {
      flameMat.opacity = active ? 0.78 + Math.sin(time * 42) * 0.18 : 0;
      for (const flame of nitroFlames) {
        flame.visible = active;
        if (active) {
          const s = 0.9 + Math.sin(time * 55) * 0.25;
          flame.scale.set(1, 1, s);
        }
      }
    },
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
