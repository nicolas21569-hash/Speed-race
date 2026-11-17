import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { getVehicleById } from '../data/vehicles';
import { PaintFinish } from '../types/game';
import { buildProceduralCar, BuiltCar } from './carBuilder';
import {
  afterDraw,
  attachStudioEnvironment,
  createConfiguredRenderer,
  detectSoftwareGl,
} from './webglSetup';

export type ShowcaseMode = 'menu_city' | 'garage_studio';

/**
 * Interactive 3D showroom engine used for both the animated Main Menu futuristic
 * city backdrop and the interactive Garage / Shop 3D vehicle inspector.
 */
export class ShowcaseScene {
  private container: HTMLElement;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls | null = null;
  private envTex: THREE.Texture;
  private turntable: THREE.Group;
  private currentCar: BuiltCar | null = null;
  private mode: ShowcaseMode;
  private clock = new THREE.Clock();
  private disposed = false;
  private frameId = 0;
  private timers: number[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  constructor(
    container: HTMLElement,
    mode: ShowcaseMode,
    vehicleId: string,
    color?: string,
    finish: PaintFinish = 'metallic',
  ) {
    this.container = container;
    this.mode = mode;
    this.isSoftwareGl = detectSoftwareGl();
    this.renderer = createConfiguredRenderer(container, this.isSoftwareGl, true);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(mode === 'menu_city' ? 0x050814 : 0x090b12);
    this.scene.fog = new THREE.FogExp2(
      mode === 'menu_city' ? 0x050814 : 0x090b12,
      mode === 'menu_city' ? 0.015 : 0.025,
    );
    this.envTex = attachStudioEnvironment(this.renderer, this.scene);

    const w = container.clientWidth || 1280;
    const h = container.clientHeight || 720;
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.2, 300);

    if (mode === 'menu_city') {
      this.camera.position.set(4.8, 2.05, 5.8);
    } else {
      this.camera.position.set(4.6, 2.1, 5.2);
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enablePan = false;
      this.controls.minDistance = 3.6;
      this.controls.maxDistance = 9.5;
      this.controls.minPolarAngle = 0.25;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.06;
      this.controls.enableDamping = !this.isSoftwareGl;
      this.controls.dampingFactor = 0.07;
      this.controls.autoRotate = !this.isSoftwareGl;
      this.controls.autoRotateSpeed = 0.7;
      this.controls.target.set(0, 0.55, 0);
      this.controls.update();
    }

    this.setupLighting();
    this.turntable = new THREE.Group();
    this.scene.add(this.turntable);
    this.buildEnvironment();
    this.setVehicle(vehicleId, color, finish);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    this.clock.start();
    this.tick();
  }

  private setupLighting(): void {
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x1e1b4b, 0.75);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff1e0, 2.1);
    key.position.set(7, 11, 6);
    key.castShadow = !this.isSoftwareGl;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);

    const rimRed = new THREE.DirectionalLight(0xef4444, 1.1);
    rimRed.position.set(-7, 4, -6);
    this.scene.add(rimRed);

    const rimCyan = new THREE.DirectionalLight(0x00d2ff, 1.0);
    rimCyan.position.set(6, 3, -7);
    this.scene.add(rimCyan);

    // Overhead studio softboxes (skipped on software WebGL)
    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const overhead = new THREE.RectAreaLight(0xe0f2fe, 4.5, 6, 3);
      overhead.position.set(0, 5.2, 0);
      overhead.lookAt(0, 0, 0);
      this.scene.add(overhead);
    }
  }

  private buildEnvironment(): void {
    // Reflective dark showroom floor
    const floorGeo = new THREE.PlaneGeometry(180, 180);
    floorGeo.rotateX(-Math.PI / 2);
    this.geometries.push(floorGeo);

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d16,
      roughness: 0.24,
      metalness: 0.65,
    });
    this.materials.push(floorMat);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Glowing turntable ring
    const ringGeo = new THREE.RingGeometry(2.9, 3.05, 64);
    ringGeo.rotateX(-Math.PI / 2);
    this.geometries.push(ringGeo);
    const ringMat = new THREE.MeshBasicMaterial({
      color: this.mode === 'menu_city' ? 0xef4444 : 0x00d2ff,
      side: THREE.DoubleSide,
    });
    this.materials.push(ringMat);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.02;
    this.scene.add(ring);

    const discGeo = new THREE.CylinderGeometry(2.9, 3.0, 0.08, 48);
    this.geometries.push(discGeo);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.75,
      roughness: 0.3,
    });
    this.materials.push(discMat);
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = -0.02;
    disc.receiveShadow = true;
    this.scene.add(disc);

    // Futuristic skyline buildings in background
    const towerCount = this.mode === 'menu_city' ? 48 : 24;
    const towerGeo = new THREE.BoxGeometry(5, 1, 5);
    towerGeo.translate(0, 0.5, 0);
    this.geometries.push(towerGeo);

    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.3,
    });
    this.materials.push(towerMat);

    const neonBandGeo = new THREE.BoxGeometry(5.15, 0.35, 5.15);
    this.geometries.push(neonBandGeo);
    const neonBandMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.materials.push(neonBandMat);

    const towers = new THREE.InstancedMesh(towerGeo, towerMat, towerCount);
    const bands = new THREE.InstancedMesh(neonBandGeo, neonBandMat, towerCount);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < towerCount; i++) {
      const angle = (i / towerCount) * Math.PI * 2;
      const dist = 26 + (i % 4) * 11;
      const h = 10 + ((i * 7) % 24);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(1 + (i % 2) * 0.4, h, 1 + (i % 3) * 0.3);
      dummy.updateMatrix();
      towers.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, h * 0.82, z);
      dummy.scale.set(1 + (i % 2) * 0.4, 1, 1 + (i % 3) * 0.3);
      dummy.updateMatrix();
      bands.setMatrixAt(i, dummy.matrix);
      bands.setColorAt(
        i,
        new THREE.Color(i % 2 === 0 ? 0x00d2ff : 0xef4444),
      );
    }
    towers.instanceMatrix.needsUpdate = true;
    towers.computeBoundingSphere();
    bands.instanceMatrix.needsUpdate = true;
    if (bands.instanceColor) bands.instanceColor.needsUpdate = true;
    bands.computeBoundingSphere();
    this.scene.add(towers, bands);
  }

  public setVehicle(
    vehicleId: string,
    color?: string,
    finish: PaintFinish = 'metallic',
  ): void {
    if (this.currentCar) {
      this.turntable.remove(this.currentCar.root);
      this.currentCar.dispose();
      this.currentCar = null;
    }
    const spec = getVehicleById(vehicleId);
    const built = buildProceduralCar(spec, color ?? spec.defaultColor, finish, this.isSoftwareGl);
    built.root.position.y = 0.02;
    this.turntable.add(built.root);
    this.currentCar = built;
  }

  public updatePaint(color: string, finish: PaintFinish): void {
    this.currentCar?.setPaint(color, finish);
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
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    if (this.mode === 'menu_city') {
      this.turntable.rotation.y += dt * 0.38;
      // Subtle cinematic camera breathing
      this.camera.position.x = 5.0 + Math.sin(elapsed * 0.35) * 0.6;
      this.camera.position.y = 2.0 + Math.cos(elapsed * 0.25) * 0.2;
      this.camera.lookAt(-1.2, 0.65, 0);
      if (this.currentCar) {
        this.currentCar.wheelsSpin.forEach((w) => {
          w.rotation.x -= dt * 2.5;
        });
      }
    } else if (this.controls) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      afterDraw(this.renderer, this.tick, (id) => this.timers.push(id));
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.timers.forEach((t) => clearTimeout(t));
    window.removeEventListener('resize', this.handleResize);
    this.controls?.dispose();
    this.currentCar?.dispose();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.envTex.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
