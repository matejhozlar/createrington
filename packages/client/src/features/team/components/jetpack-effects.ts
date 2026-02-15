import type { PlayerObject, SkinViewer as SkinViewerLib } from "skinview3d";
import { PlayerAnimation } from "skinview3d";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Points,
  PointsMaterial,
  type Scene,
} from "three";

// ── Astronaut skin generator ───────────────────────────────────────

/** Creates a 64×64 Minecraft skin canvas with a simple astronaut suit. */
export function createAstronautSkin(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  // biome-ignore lint/style/noNonNullAssertion: canvas we just created always returns a context
  const ctx = canvas.getContext("2d")!;

  // Fill entire canvas transparent first
  ctx.clearRect(0, 0, 64, 64);

  const suit = "#e8e8e8"; // white suit
  const suitShade = "#c8c8c8"; // suit shading
  const visor = "#1a3a5c"; // dark blue visor
  const visorGlow = "#3a7abd"; // visor reflection
  const boot = "#6b6b6b"; // gray boots
  const glove = "#808080"; // gray gloves
  const accent = "#cc3030"; // red accent patch
  const backpack = "#a0a0a0"; // jetpack backpack

  // Helper to fill a rect
  const fill = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  // ── Head (8×8 at 8,0) ─────────────────────────────────────────
  // Helmet base
  fill(suit, 8, 0, 8, 8);
  // Visor (front face area)
  fill(visor, 10, 2, 4, 4);
  fill(visorGlow, 10, 2, 2, 1); // reflection highlight
  // Helmet top highlight
  fill(suitShade, 8, 0, 8, 1);

  // Head top (texture region 8,0 is already covered)
  // Head right (0,8 — 8×8)
  fill(suit, 0, 8, 8, 8);
  fill(visor, 2, 10, 4, 4);
  // Head front (8,8 — 8×8)
  fill(suit, 8, 8, 8, 8);
  fill(visor, 10, 10, 4, 4);
  fill(visorGlow, 10, 10, 2, 1);
  // Head left (16,8 — 8×8)
  fill(suit, 16, 8, 8, 8);
  fill(visor, 18, 10, 4, 4);
  // Head back (24,8 — 8×8)
  fill(suit, 24, 8, 8, 8);
  fill(suitShade, 26, 10, 4, 4);

  // ── Body (8×12 at 20,16→front) ────────────────────────────────
  // Body top (20,16 — 8×4)
  fill(suit, 20, 16, 8, 4);
  // Body right (16,20 — 4×12)
  fill(suit, 16, 20, 4, 12);
  fill(backpack, 17, 22, 2, 6);
  // Body front (20,20 — 8×12)
  fill(suit, 20, 20, 8, 12);
  fill(accent, 22, 21, 4, 2); // chest patch
  fill(suitShade, 20, 28, 8, 4); // belt area
  // Body left (28,20 — 4×12)
  fill(suit, 28, 20, 4, 12);
  fill(backpack, 29, 22, 2, 6);
  // Body back (32,20 — 8×12)
  fill(suit, 32, 20, 8, 12);
  fill(backpack, 34, 22, 4, 6); // jetpack on back
  fill("#555555", 35, 23, 2, 4); // jetpack detail

  // ── Right arm (4×12 at 44,16→front) ───────────────────────────
  // Arm top (44,16 — 4×4)
  fill(suit, 44, 16, 4, 4);
  // Arm right (40,20 — 4×12)
  fill(suit, 40, 20, 4, 12);
  fill(glove, 40, 28, 4, 4);
  // Arm front (44,20 — 4×12)
  fill(suit, 44, 20, 4, 12);
  fill(glove, 44, 28, 4, 4);
  // Arm left (48,20 — 4×12)
  fill(suit, 48, 20, 4, 12);
  fill(glove, 48, 28, 4, 4);
  // Arm back (52,20 — 4×12)
  fill(suit, 52, 20, 4, 12);
  fill(glove, 52, 28, 4, 4);

  // ── Right leg (4×12 at 4,16→front) ────────────────────────────
  // Leg top (4,16 — 4×4)
  fill(suit, 4, 16, 4, 4);
  // Leg right (0,20 — 4×12)
  fill(suit, 0, 20, 4, 12);
  fill(boot, 0, 28, 4, 4);
  // Leg front (4,20 — 4×12)
  fill(suit, 4, 20, 4, 12);
  fill(boot, 4, 28, 4, 4);
  // Leg left (8,20 — 4×12)
  fill(suit, 8, 20, 4, 12);
  fill(boot, 8, 28, 4, 4);
  // Leg back (12,20 — 4×12)
  fill(suit, 12, 20, 4, 12);
  fill(boot, 12, 28, 4, 4);

  // ── Left arm (second layer: 4×12 at 36,48→front) ─────────────
  fill(suit, 36, 48, 4, 4); // top
  fill(suit, 32, 52, 4, 12); // right
  fill(glove, 32, 60, 4, 4);
  fill(suit, 36, 52, 4, 12); // front
  fill(glove, 36, 60, 4, 4);
  fill(suit, 40, 52, 4, 12); // left
  fill(glove, 40, 60, 4, 4);
  fill(suit, 44, 52, 4, 12); // back
  fill(glove, 44, 60, 4, 4);

  // ── Left leg (second layer: 4×12 at 20,48→front) ─────────────
  fill(suit, 20, 48, 4, 4); // top
  fill(suit, 16, 52, 4, 12); // right
  fill(boot, 16, 60, 4, 4);
  fill(suit, 20, 52, 4, 12); // front
  fill(boot, 20, 60, 4, 4);
  fill(suit, 24, 52, 4, 12); // left
  fill(boot, 24, 60, 4, 4);
  fill(suit, 28, 52, 4, 12); // back
  fill(boot, 28, 60, 4, 4);

  return canvas;
}

// ── Smoke texture generator ────────────────────────────────────────

function createSmokeTexture(): HTMLCanvasElement {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  // biome-ignore lint/style/noNonNullAssertion: canvas we just created always returns a context
  const ctx = canvas.getContext("2d")!;
  const center = size / 2;
  const gradient = ctx.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center,
  );
  gradient.addColorStop(0, "rgba(255, 200, 80, 1)");
  gradient.addColorStop(0.3, "rgba(255, 140, 40, 0.7)");
  gradient.addColorStop(0.6, "rgba(180, 180, 180, 0.3)");
  gradient.addColorStop(1, "rgba(100, 100, 100, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

// ── Particle system ────────────────────────────────────────────────

const PARTICLE_COUNT = 60;
const PARTICLE_LIFETIME = 0.8;

export class JetpackParticleSystem {
  private geometry: BufferGeometry;
  private material: PointsMaterial;
  private points: Points;
  private scene: Scene | null = null;

  // Per-particle data
  private ages: Float32Array;
  private velocitiesX: Float32Array;
  private velocitiesY: Float32Array;
  private velocitiesZ: Float32Array;
  private alive: Uint8Array;

  private emitting = false;
  private emitAccumulator = 0;

  constructor() {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    this.ages = new Float32Array(PARTICLE_COUNT);
    this.velocitiesX = new Float32Array(PARTICLE_COUNT);
    this.velocitiesY = new Float32Array(PARTICLE_COUNT);
    this.velocitiesZ = new Float32Array(PARTICLE_COUNT);
    this.alive = new Uint8Array(PARTICLE_COUNT);

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new BufferAttribute(positions, 3));
    this.geometry.setAttribute("size", new BufferAttribute(sizes, 1));

    const texture = new CanvasTexture(createSmokeTexture());

    this.material = new PointsMaterial({
      map: texture,
      size: 4,
      sizeAttenuation: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      opacity: 0.8,
    });

    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  addToScene(scene: Scene) {
    this.scene = scene;
    scene.add(this.points);
  }

  startEmitting() {
    this.emitting = true;
    this.emitAccumulator = 0;
  }

  stopEmitting() {
    this.emitting = false;
  }

  update(dt: number, emitY: number) {
    const positions = this.geometry.attributes.position as BufferAttribute;
    const posArray = positions.array as Float32Array;
    const sizes = this.geometry.attributes.size as BufferAttribute;
    const sizeArray = sizes.array as Float32Array;

    // Emit new particles
    if (this.emitting) {
      this.emitAccumulator += dt;
      const emitInterval = 1 / 120; // ~120 particles per second
      while (this.emitAccumulator >= emitInterval) {
        this.emitAccumulator -= emitInterval;
        this.spawnParticle(emitY);
      }
    }

    // Update existing particles
    const drag = 0.97;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (!this.alive[i]) continue;

      this.ages[i] += dt;
      if (this.ages[i] >= PARTICLE_LIFETIME) {
        this.alive[i] = 0;
        sizeArray[i] = 0;
        continue;
      }

      // Apply drag
      this.velocitiesX[i] *= drag;
      this.velocitiesY[i] *= drag;
      this.velocitiesZ[i] *= drag;

      // Update position
      const idx = i * 3;
      posArray[idx] += this.velocitiesX[i] * dt;
      posArray[idx + 1] += this.velocitiesY[i] * dt;
      posArray[idx + 2] += this.velocitiesZ[i] * dt;

      // Fade size based on age
      const life = this.ages[i] / PARTICLE_LIFETIME;
      sizeArray[i] = 3 + life * 5; // grow as they fade
      this.material.opacity = 0.8 * (1 - life * life);
    }

    positions.needsUpdate = true;
    sizes.needsUpdate = true;
  }

  private spawnParticle(emitY: number) {
    // Find a dead particle slot
    let slot = -1;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (!this.alive[i]) {
        slot = i;
        break;
      }
    }
    if (slot === -1) return;

    const positions = this.geometry.attributes.position as BufferAttribute;
    const posArray = positions.array as Float32Array;
    const idx = slot * 3;

    // Spawn near feet with some horizontal spread
    const spread = 1.5;
    posArray[idx] = (Math.random() - 0.5) * spread;
    posArray[idx + 1] = emitY;
    posArray[idx + 2] = (Math.random() - 0.5) * spread;

    // Velocity: mostly downward with outward spread
    this.velocitiesX[slot] = (Math.random() - 0.5) * 8;
    this.velocitiesY[slot] = -(15 + Math.random() * 10);
    this.velocitiesZ[slot] = (Math.random() - 0.5) * 8;

    this.ages[slot] = 0;
    this.alive[slot] = 1;
  }

  dispose() {
    if (this.scene) {
      this.scene.remove(this.points);
      this.scene = null;
    }
    this.geometry.dispose();
    this.material.map?.dispose();
    this.material.dispose();
  }
}

// ── Jetpack animation ──────────────────────────────────────────────

type JetpackPhase = "crouch" | "ignition" | "liftoff" | "gone";

const CROUCH_DURATION = 0.4;
const IGNITION_DURATION = 0.6;
const LIFTOFF_DURATION = 1.8;

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export class JetpackAnimation extends PlayerAnimation {
  private viewer: SkinViewerLib;
  private particles: JetpackParticleSystem;
  private phase: JetpackPhase = "crouch";
  private phaseStart = 0;
  private skinSwapped = false;
  private particlesAdded = false;

  constructor(viewer: SkinViewerLib, _uuid: string) {
    super();
    this.viewer = viewer;
    this.particles = new JetpackParticleSystem();
  }

  protected animate(player: PlayerObject, delta: number): void {
    // Swap skin on first frame
    if (!this.skinSwapped) {
      this.skinSwapped = true;
      const astronautSkin = createAstronautSkin();
      this.viewer.loadSkin(astronautSkin);
    }

    // Add particles to scene on first frame
    if (!this.particlesAdded) {
      this.particlesAdded = true;
      this.particles.addToScene(this.viewer.scene);
    }

    const elapsed = this.progress - this.phaseStart;

    switch (this.phase) {
      case "crouch": {
        const t = Math.min(elapsed / CROUCH_DURATION, 1);
        const e = easeInOutCubic(t);

        // Crouch: bend knees, lower body, arms brace
        player.skin.leftLeg.rotation.x = 0.4 * e;
        player.skin.rightLeg.rotation.x = 0.4 * e;
        player.skin.body.rotation.x = 0.1 * e;
        player.skin.head.rotation.x = -0.15 * e;
        player.position.y = -1.5 * e;
        // Arms brace outward/forward
        player.skin.leftArm.rotation.x = -0.3 * e;
        player.skin.leftArm.rotation.z = 0.2 * e;
        player.skin.rightArm.rotation.x = -0.3 * e;
        player.skin.rightArm.rotation.z = -0.2 * e;

        if (t >= 1) {
          this.phase = "ignition";
          this.phaseStart = this.progress;
        }
        break;
      }

      case "ignition": {
        const t = Math.min(elapsed / IGNITION_DURATION, 1);

        // Hold crouch pose
        player.skin.leftLeg.rotation.x = 0.4;
        player.skin.rightLeg.rotation.x = 0.4;
        player.skin.body.rotation.x = 0.1;
        player.skin.head.rotation.x = -0.15;
        player.position.y = -1.5;
        player.skin.leftArm.rotation.x = -0.3;
        player.skin.leftArm.rotation.z = 0.2;
        player.skin.rightArm.rotation.x = -0.3;
        player.skin.rightArm.rotation.z = -0.2;

        // Vibration/shake that intensifies
        const shakeIntensity = t * 0.4;
        const shakeX = Math.sin(this.progress * 60) * shakeIntensity;
        const shakeZ = Math.cos(this.progress * 45) * shakeIntensity * 0.5;
        player.position.x = shakeX;
        player.position.z = shakeZ;

        // Start particles partway through ignition
        if (t > 0.3) {
          this.particles.startEmitting();
        }

        this.particles.update(delta, player.position.y - 16);

        if (t >= 1) {
          this.phase = "liftoff";
          this.phaseStart = this.progress;
        }
        break;
      }

      case "liftoff": {
        const t = Math.min(elapsed / LIFTOFF_DURATION, 1);
        const accel = easeInCubic(t);

        // Straighten pose during liftoff
        const straighten = Math.min(t * 3, 1); // straighten quickly
        player.skin.leftLeg.rotation.x = 0.4 * (1 - straighten);
        player.skin.rightLeg.rotation.x = 0.4 * (1 - straighten);
        player.skin.body.rotation.x = 0.1 * (1 - straighten);
        player.skin.head.rotation.x = -0.15 - 0.2 * straighten; // look up
        // Arms to sides
        player.skin.leftArm.rotation.x = -0.3 * (1 - straighten);
        player.skin.leftArm.rotation.z = 0.2 + 0.1 * straighten;
        player.skin.rightArm.rotation.x = -0.3 * (1 - straighten);
        player.skin.rightArm.rotation.z = -0.2 - 0.1 * straighten;

        // Rise: from -1.5 to 40
        const targetY = -1.5 + 41.5 * accel;
        player.position.y = targetY;

        // Reduce shake during liftoff
        const shakeDecay = 1 - t;
        player.position.x = Math.sin(this.progress * 60) * 0.3 * shakeDecay;
        player.position.z = Math.cos(this.progress * 45) * 0.15 * shakeDecay;

        // Particles emit from feet
        this.particles.update(delta, player.position.y - 16);

        if (t >= 1) {
          this.phase = "gone";
          this.phaseStart = this.progress;
          this.particles.stopEmitting();
        }
        break;
      }

      case "gone": {
        // Player stays above viewport, particles finish fading
        player.position.y = 40;
        player.position.x = 0;
        player.position.z = 0;
        this.particles.update(delta, 24);
        break;
      }
    }
  }

  dispose() {
    this.particles.stopEmitting();
    this.particles.dispose();
  }
}
