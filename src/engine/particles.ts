import * as THREE from 'three';
import { createSoftGlowTexture } from './webglSetup';

interface ParticleSlot {
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
}

/**
 * Pooled particle renderer (tire drift smoke, nitro exhaust sparks, collision impacts)
 * with zero per-frame allocations.
 */
export class RaceParticleSystem {
  private readonly maxParticles = 320;
  private readonly slots: ParticleSlot[] = [];
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private readonly points: THREE.Points;
  private readonly spriteTex: THREE.CanvasTexture;
  private cursor = 0;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    for (let i = 0; i < this.maxParticles; i++) {
      this.slots.push({
        active: false,
        life: 0,
        maxLife: 1,
        vx: 0,
        vy: 0,
        vz: 0,
        x: 0,
        y: -999,
        z: 0,
        r: 1,
        g: 1,
        b: 1,
      });
      this.positions[i * 3 + 1] = -999;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3),
    );

    this.spriteTex = createSoftGlowTexture();
    this.material = new THREE.PointsMaterial({
      size: 1.45,
      map: this.spriteTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  public spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    r: number,
    g: number,
    b: number,
    maxLife = 0.55,
  ): void {
    const slot = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % this.maxParticles;
    slot.active = true;
    slot.life = maxLife;
    slot.maxLife = maxLife;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.r = r;
    slot.g = g;
    slot.b = b;
  }

  public spawnDriftSmoke(x: number, y: number, z: number): void {
    this.spawn(
      x + (Math.random() - 0.5) * 0.4,
      y + 0.18,
      z + (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 1.6,
      0.8 + Math.random() * 0.9,
      (Math.random() - 0.5) * 1.6,
      0.78,
      0.82,
      0.88,
      0.55,
    );
  }

  public spawnNitroTrail(x: number, y: number, z: number): void {
    this.spawn(
      x + (Math.random() - 0.5) * 0.25,
      y + 0.3,
      z + (Math.random() - 0.5) * 0.25,
      (Math.random() - 0.5) * 1.2,
      0.3 + Math.random() * 0.5,
      (Math.random() - 0.5) * 1.2,
      0.15,
      0.78,
      1.0,
      0.32,
    );
  }

  public spawnSparks(x: number, y: number, z: number, count = 14): void {
    for (let i = 0; i < count; i++) {
      this.spawn(
        x,
        y + 0.4,
        z,
        (Math.random() - 0.5) * 12,
        2.5 + Math.random() * 6,
        (Math.random() - 0.5) * 12,
        1.0,
        0.55 + Math.random() * 0.35,
        0.12,
        0.4,
      );
    }
  }

  public update(dt: number): void {
    for (let i = 0; i < this.maxParticles; i++) {
      const s = this.slots[i];
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        this.positions[i * 3 + 1] = -999;
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.vx *= 0.96;
      s.vz *= 0.96;
      const fade = s.life / s.maxLife;
      this.positions[i * 3] = s.x;
      this.positions[i * 3 + 1] = s.y;
      this.positions[i * 3 + 2] = s.z;
      this.colors[i * 3] = s.r * fade;
      this.colors[i * 3 + 1] = s.g * fade;
      this.colors[i * 3 + 2] = s.b * fade;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.spriteTex.dispose();
  }
}
