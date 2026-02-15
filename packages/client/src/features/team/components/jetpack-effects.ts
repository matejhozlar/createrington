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
import astronautSkinUrl from "@/assets/skins/astronaut.png";

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

const PARTICLE_COUNT = 80;
const PARTICLE_LIFETIME = 1.0;

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
      opacity: 0.7,
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
      const emitInterval = 1 / 120;
      while (this.emitAccumulator >= emitInterval) {
        this.emitAccumulator -= emitInterval;
        this.spawnParticle(emitY);
      }
    }

    // Update existing particles
    const drag = 0.96;
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

      // Size grows as particle ages (texture gradient handles visual fade)
      const life = this.ages[i] / PARTICLE_LIFETIME;
      sizeArray[i] = 3 + life * 6;
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
    this.velocitiesY[slot] = -(12 + Math.random() * 8);
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

  // Canvas fly-out state
  private flyStarted = false;
  private flyDistance = 0;

  constructor(viewer: SkinViewerLib) {
    super();
    this.viewer = viewer;
    this.particles = new JetpackParticleSystem();
  }

  protected animate(player: PlayerObject, delta: number): void {
    // Swap skin on first frame
    if (!this.skinSwapped) {
      this.skinSwapped = true;
      this.viewer.loadSkin(astronautSkinUrl);
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

        // On first liftoff frame, calculate fly distance and apply styles
        if (!this.flyStarted) {
          this.flyStarted = true;
          const canvas = this.viewer.canvas;
          const rect = canvas.getBoundingClientRect();
          // Fly past the top of the viewport
          this.flyDistance = rect.top + rect.height + 200;
          canvas.style.zIndex = "9999";
          canvas.style.pointerEvents = "none";
        }

        // Fly the canvas upward using transform (stays in layout flow)
        const flyProgress = easeInCubic(t);
        this.viewer.canvas.style.transform = `translateY(${-this.flyDistance * flyProgress}px)`;

        // Small rise within 3D scene for launch feel (keep head in frame)
        const riseT = Math.min(t * 4, 1);
        player.position.y = -1.5 + 2 * easeInOutCubic(riseT);

        // Straighten pose during liftoff
        const straighten = Math.min(t * 3, 1);
        player.skin.leftLeg.rotation.x = 0.4 * (1 - straighten);
        player.skin.rightLeg.rotation.x = 0.4 * (1 - straighten);
        player.skin.body.rotation.x = 0.1 * (1 - straighten);
        player.skin.head.rotation.x = -0.15 - 0.2 * straighten; // look up
        player.skin.leftArm.rotation.x = -0.3 * (1 - straighten);
        player.skin.leftArm.rotation.z = 0.2 + 0.1 * straighten;
        player.skin.rightArm.rotation.x = -0.3 * (1 - straighten);
        player.skin.rightArm.rotation.z = -0.2 - 0.1 * straighten;

        // Shake dies out during liftoff
        const shakeDecay = Math.max(1 - t * 2, 0);
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
        // Hold final position, let remaining particles fade
        player.position.y = 5;
        player.position.x = 0;
        player.position.z = 0;
        this.particles.update(delta, player.position.y - 16);
        break;
      }
    }
  }

  dispose() {
    this.particles.stopEmitting();
    this.particles.dispose();

    // Reset player state
    this.viewer.playerObject.position.set(0, 0, 0);

    // Reset canvas styles from fly-out
    if (this.flyStarted) {
      const canvas = this.viewer.canvas;
      canvas.style.transform = "";
      canvas.style.zIndex = "";
      canvas.style.pointerEvents = "";
    }
  }
}
