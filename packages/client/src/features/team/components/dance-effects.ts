import { PlayerAnimation } from "skinview3d";
import type { PlayerObject } from "skinview3d";

// Repeating segment: 3.2s disco point + 0.8s spin = 4.0s
const SEGMENT = 4.0;
const POINT_IN_SEGMENT = 3.2;
const BEATS_PER_SEGMENT = 6;
const FADE = 0.25; // crossfade zone between point ↔ spin
// 4 full segments = 16s of dancing, then 2s bow
const DANCE_SEGMENTS = 4;
const DANCE_END = SEGMENT * DANCE_SEGMENTS; // 16s
const BOW_DURATION = 2.0;
const TOTAL_DURATION = DANCE_END + BOW_DURATION; // 18s

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Smoothstep 0→1 over the range [edge0, edge1]. */
function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, w: number): number {
	return a + (b - a) * w;
}

/**
 * Synchronized disco point dance — all members move in unison.
 *
 * Right arm sweeps from across the left hip up to upper-right sky.
 * Hips thrust side-to-side, knees bounce. Left arm stays relaxed.
 * Every 3.2s a 360° spin with arms out, crossfaded smoothly.
 * Ends with a coordinated bow.
 */
export class DiscoAnimation extends PlayerAnimation {
	protected animate(player: PlayerObject): void {
		const t = this.progress;

		let armLeftX = 0;
		let armLeftZ = 0.06;
		let armRightX = 0;
		let armRightZ = -0.06;
		let headX = 0;
		let headY = 0;
		let bodyX = 0;
		let bodyY = 0;
		let bodyZ = 0;
		let legLeftX = 0;
		let legRightX = 0;
		let posY = 0;
		let rotationY = 0;

		if (t < DANCE_END) {
			const segTime = t % SEGMENT;

			// Spin weight: 0 during point, 1 during spin, smoothly blended
			const spinW = smoothstep(
				POINT_IN_SEGMENT - FADE,
				POINT_IN_SEGMENT + FADE,
				segTime,
			) * (1 - smoothstep(SEGMENT - FADE, SEGMENT, segTime));

			// ── Compute point pose ──
			const phase = segTime / POINT_IN_SEGMENT;
			const beatT = Math.min(phase, 1) * BEATS_PER_SEGMENT;
			const sweep = (Math.sin(beatT * Math.PI - Math.PI / 2) + 1) / 2;

			const pArmRX = -0.8 * (1 - sweep) + -2.7 * sweep;
			const pArmRZ = 0.7 * (1 - sweep) + -0.4 * sweep;
			const pArmLX = -0.2;
			const pArmLZ = 0.12;
			const pHeadX = 0.15 * (1 - sweep) + -0.15 * sweep;
			const pHeadY = -0.2 * (1 - sweep) + 0.1 * sweep;
			const pBodyZ = Math.sin(beatT * Math.PI) * 0.12;
			const pBodyY = (sweep - 0.5) * -0.15;
			const bounce = Math.abs(Math.sin(beatT * Math.PI));
			const pPosY = -0.25 * bounce;
			const pLegLX = 0.12 * bounce;
			const pLegRX = 0.12 * bounce;

			// ── Compute spin pose ──
			const spinLocal = (segTime - POINT_IN_SEGMENT) / (SEGMENT - POINT_IN_SEGMENT);
			const spinE = easeInOutCubic(Math.max(0, Math.min(1, spinLocal)));
			const sRotY = spinE * Math.PI * 2;
			const sArmLX = -1.0;
			const sArmLZ = 0.7;
			const sArmRX = -1.0;
			const sArmRZ = -0.7;
			const sPosY = Math.sin(Math.max(0, Math.min(1, spinLocal)) * Math.PI) * 0.4;

			// ── Blend ──
			armRightX = lerp(pArmRX, sArmRX, spinW);
			armRightZ = lerp(pArmRZ, sArmRZ, spinW);
			armLeftX = lerp(pArmLX, sArmLX, spinW);
			armLeftZ = lerp(pArmLZ, sArmLZ, spinW);
			headX = lerp(pHeadX, 0, spinW);
			headY = lerp(pHeadY, 0, spinW);
			bodyY = lerp(pBodyY, 0, spinW);
			bodyZ = lerp(pBodyZ, 0, spinW);
			legLeftX = lerp(pLegLX, 0, spinW);
			legRightX = lerp(pLegRX, 0, spinW);
			posY = lerp(pPosY, sPosY, spinW);
			rotationY = sRotY * spinW;
		} else if (t < TOTAL_DURATION) {
			// ── Bow ──
			const bowT = (t - DANCE_END) / BOW_DURATION;

			if (bowT < 0.35) {
				const e = easeInOutCubic(bowT / 0.35);
				bodyX = 0.45 * e;
				headX = 0.3 * e;
				armLeftX = 0.3 * e;
				armLeftZ = 0.06 - 0.2 * e;
				armRightX = 0.3 * e;
				armRightZ = -0.06 + 0.2 * e;
				posY = -0.35 * e;
			} else if (bowT < 0.65) {
				bodyX = 0.45;
				headX = 0.3;
				armLeftX = 0.3;
				armLeftZ = -0.14;
				armRightX = 0.3;
				armRightZ = 0.14;
				posY = -0.35;
			} else {
				const e = easeInOutCubic((bowT - 0.65) / 0.35);
				bodyX = 0.45 * (1 - e);
				headX = 0.3 * (1 - e);
				armLeftX = 0.3 * (1 - e);
				armLeftZ = -0.14 + 0.2 * e;
				armRightX = 0.3 * (1 - e);
				armRightZ = 0.14 - 0.2 * e;
				posY = -0.35 * (1 - e);
			}
		}

		player.skin.head.rotation.x = headX;
		player.skin.head.rotation.y = headY;
		player.skin.head.rotation.z = 0;
		player.skin.body.rotation.x = bodyX;
		player.skin.body.rotation.y = bodyY;
		player.skin.body.rotation.z = bodyZ;
		player.skin.leftArm.rotation.x = armLeftX;
		player.skin.leftArm.rotation.z = armLeftZ;
		player.skin.rightArm.rotation.x = armRightX;
		player.skin.rightArm.rotation.z = armRightZ;
		player.skin.leftLeg.rotation.x = legLeftX;
		player.skin.leftLeg.rotation.z = 0;
		player.skin.rightLeg.rotation.x = legRightX;
		player.skin.rightLeg.rotation.z = 0;
		player.position.y = posY;
		player.rotation.y = rotationY;
	}
}
