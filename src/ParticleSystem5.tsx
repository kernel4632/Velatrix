import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const PARTICLE_COUNT = 25000;
const MAX_DIST = 15;

const particleVertexShader = `
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (180.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragmentShader = `
  varying vec3 vColor;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d);
    float core = pow(alpha, 2.0) * 4.0;
    gl_FragColor = vec4(vColor * (1.0 + core), alpha);
  }
`;

const NebulaScene = ({
	distance,
	pinchL,
	pinchR,
	handUL = 0,
	handUR = 0,
	handLL = 0,
	handLR = 0,
}: {
	distance: number;
	pinchL: number;
	pinchR: number;
	handUL?: number;
	handUR?: number;
	handLL?: number;
	handLR?: number;
}) => {
	const pointsRef = useRef<THREE.Points>(null);

	const stateRef = useRef({
		w_fusion: 0,
		v_fusion: 0,
		w_repel: 0,
		v_repel: 0,
		w_collapse: 0,
		v_collapse: 0,
		w_neutral: 1,
		v_neutral: 0,
		shockwave: 0,
	});

	const { positions, colors, velocities, baseData } = useMemo(() => {
		const pos = new Float32Array(PARTICLE_COUNT * 3);
		const col = new Float32Array(PARTICLE_COUNT * 3);
		const vel = new Float32Array(PARTICLE_COUNT * 3);
		const base = [];

		for (let i = 0; i < PARTICLE_COUNT; i++) {
			const type = i % 8;

			const r = Math.random() * 8.0 + 2.0;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(Math.random() * 2 - 1);

			pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
			pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
			pos[i * 3 + 2] = r * Math.cos(phi);

			vel[i * 3] = 0;
			vel[i * 3 + 1] = 0;
			vel[i * 3 + 2] = 0;

			let baseHue, baseSat, baseLight, influence;

			if (type === 0) {
				baseHue = 0.08 + Math.random() * 0.04;
				baseSat = 0.9;
				baseLight = 0.6;
				influence = 0.3;
			} else if (type === 1) {
				baseHue = 0.75 + Math.random() * 0.04;
				baseSat = 0.85;
				baseLight = 0.55;
				influence = 1.0;
			} else if (type === 2) {
				baseHue = 0.95 + Math.random() * 0.04;
				baseSat = 0.85;
				baseLight = 0.55;
				influence = 0.7;
			} else if (type === 3) {
				baseHue = 0.4 + Math.random() * 0.04;
				baseSat = 0.8;
				baseLight = 0.6;
				influence = 0.5;
			} else if (type === 4) {
				baseHue = 0.5 + Math.random() * 0.04;
				baseSat = 0.9;
				baseLight = 0.65;
				influence = 0.9;
			} else if (type === 5) {
				baseHue = 0.12 + Math.random() * 0.04;
				baseSat = 0.95;
				baseLight = 0.6;
				influence = 0.6;
			} else if (type === 6) {
				baseHue = 0.65 + Math.random() * 0.04;
				baseSat = 0.85;
				baseLight = 0.5;
				influence = 0.8;
			} else {
				baseHue = 0.15 + Math.random() * 0.04;
				baseSat = 0.7;
				baseLight = 0.85;
				influence = 0.4;
			}

			const u = Math.random() * Math.PI * 2;
			const v = Math.random() * Math.PI * 2;
			const w = Math.random() * Math.PI * 2;
			const spinDir = Math.random() > 0.5 ? 1 : -1;
			const spinSpeed = 0.5 + Math.random() * 1.0;

			base.push({
				type,
				u,
				v,
				w,
				spinDir,
				spinSpeed,
				baseHue,
				baseSat,
				baseLight,
				influence,
				freq: Math.random() * 1.5 + 0.5,
				glowOffset: Math.random() * Math.PI * 2,
			});
		}
		return { positions: pos, colors: col, velocities: vel, baseData: base };
	}, []);

	useFrame((state) => {
		if (!pointsRef.current) return;
		const time = state.clock.elapsedTime;
		const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
		const col = pointsRef.current.geometry.attributes.color.array as Float32Array;

		const prox = Math.max(0, 1 - distance / MAX_DIST);
		const pL = pinchL / 100;
		const pR = pinchR / 100;

		const hUL = handUL / 100;
		const hUR = handUR / 100;
		const hLL = handLL / 100;
		const hLR = handLR / 100;

		const target_fusion = prox * pL * pR;
		const target_repel = prox * (1 - pL) * (1 - pR);
		const target_collapse = prox * Math.abs(pL - pR);
		const target_neutral = 1.0 - prox;

		const s = stateRef.current;
		const spring = 0.08;
		const damp = 0.85;

		const totalDelta = Math.abs(target_fusion - s.w_fusion) + Math.abs(target_repel - s.w_repel) + Math.abs(target_collapse - s.w_collapse);

		if (totalDelta > 0.4 && s.shockwave < 0.1) {
			s.shockwave = 1.0;
		}
		s.shockwave *= 0.92;

		s.v_fusion += (target_fusion - s.w_fusion) * spring;
		s.v_fusion *= damp;
		s.w_fusion += s.v_fusion;

		s.v_repel += (target_repel - s.w_repel) * spring;
		s.v_repel *= damp;
		s.w_repel += s.v_repel;

		s.v_collapse += (target_collapse - s.w_collapse) * spring;
		s.v_collapse *= damp;
		s.w_collapse += s.v_collapse;

		s.v_neutral += (target_neutral - s.w_neutral) * spring;
		s.v_neutral *= damp;
		s.w_neutral += s.v_neutral;

		const { w_fusion, w_repel, w_collapse, w_neutral, shockwave } = s;

		const tempColor = new THREE.Color();
		const t = time * 0.05;

		const tiltX = (hUL + hUR) * 0.5;
		const tiltY = (hLL + hLR) * 0.5;
		const rollZ = (hUR - hUL) * 0.5;
		const pitchX = (hLR - hLL) * 0.5;

		for (let i = 0; i < PARTICLE_COUNT; i++) {
			const i3 = i * 3;
			const px = pos[i3];
			const py = pos[i3 + 1];
			const pz = pos[i3 + 2];
			let vx = velocities[i3];
			let vy = velocities[i3 + 1];
			let vz = velocities[i3 + 2];
			const data = baseData[i];
			const { type, u, v, w, spinDir, spinSpeed, influence } = data;

			const currentRadius = Math.sqrt(px * px + py * py + pz * pz) + 0.001;

			const p_dist = distance / MAX_DIST;
			const p_pinchL = pinchL / 100;
			const p_pinchR = pinchR / 100;

			let baseX = 0,
				baseY = 0,
				baseZ = 0;

			const ut = u + t * 0.15 * spinDir * spinSpeed;
			const vt = v + t * 0.1 * spinDir * spinSpeed;
			const wt = w + t * 0.08 * spinDir * spinSpeed;

			if (type === 0) {
				const p = 2.0 + p_pinchL * 5.0 + hLL * 2.0;
				const q = 3.0 + p_pinchR * 5.0 + hLR * 2.0;
				const r = 4.0 + Math.cos(q * ut) * (1.0 + p_dist * 2.0);
				const tubeR = 0.2 + p_dist * 0.5;

				baseX = r * Math.cos(p * ut) + tubeR * Math.cos(vt) - px;
				baseY = r * Math.sin(p * ut) + tubeR * Math.sin(vt) - py;
				baseZ = Math.sin(q * ut) * 4.0 + tubeR * Math.cos(vt) - pz;
			} else if (type === 1) {
				const m = 1.0 + Math.floor(p_pinchL * 6.0) + Math.floor(hUL * 4.0);
				const n = 1.0 + Math.floor(p_pinchR * 6.0) + Math.floor(hUR * 4.0);
				const r = 5.0 + Math.sin(m * ut) * Math.cos(n * vt) * (2.0 + p_dist * 5.0);

				baseX = r * Math.sin(ut) * Math.cos(vt) - px;
				baseY = r * Math.sin(ut) * Math.sin(vt) - py;
				baseZ = r * Math.cos(ut) - pz;
			} else if (type === 2) {
				const R = 7.0 + p_dist * 3.0 + hLL * 3.0;
				const twists = p_pinchL * 4.0 + rollZ * 3.0;
				const wVal = (v - Math.PI) * (0.5 + p_pinchR * 2.0);

				baseX = (R + wVal * Math.cos(twists * ut)) * Math.cos(ut) - px;
				baseY = (R + wVal * Math.cos(twists * ut)) * Math.sin(ut) - py;
				baseZ = wVal * Math.sin(twists * ut) - pz;
			} else if (type === 3) {
				const a = 1.0 + p_pinchL * 3.0 + tiltX * 2.0;
				const b = 2.0 + p_pinchR * 2.0 + tiltY * 2.0;
				const c = 3.0 + p_dist * 2.0;
				const A = 8.0 + p_dist * 4.0;

				baseX = A * Math.sin(a * ut + v) - px;
				baseY = A * Math.sin(b * ut + v) - py;
				baseZ = A * Math.cos(c * ut + v) - pz;
			} else if (type === 4) {
				const sigma = 10.0 + p_pinchL * 10.0 + hUL * 5.0;
				const beta = 8.0 / 3.0 + p_pinchR * 4.0 + hUR * 2.0;
				const rho = 28.0 + p_dist * 14.0 + pitchX * 10.0;

				baseX = sigma * (py - px) - px;
				baseY = px * (rho - pz) - py;
				baseZ = px * py - beta * pz - pz * 0.1;
			} else if (type === 5) {
				const phi = (Math.sqrt(5) + 1) / 2;
				const spiralFactor = 2.0 + p_pinchL * 3.0 + hLL * 2.0;
				const rFib = ((i % 1000) / 1000.0) * (5.0 + p_dist * 3.0);
				const angle = (i % 1000) * phi * Math.PI * 2 * spiralFactor;

				baseX = rFib * Math.cos(angle + wt) - px;
				baseY = rFib * Math.sin(angle + wt) - py;
				baseZ = ((i % 100) - 50) * 0.1 * (1.0 + p_pinchR) + hLR * 2.0 - pz;
			} else if (type === 6) {
				const a_ross = 0.2 + p_pinchL * 0.3 + hUL * 0.2;
				const b_ross = 0.2 + p_pinchR * 0.3 + hUR * 0.2;
				const c_ross = 5.0 + p_dist * 3.0 + pitchX * 2.0;

				baseX = -py - pz - px * 0.1;
				baseY = px + a_ross * py - px * 0.1;
				baseZ = b_ross + pz * (px - c_ross) - pz * 0.1;
			} else {
				const R1 = 6.0 + p_pinchL * 4.0 + hLL * 3.0;
				const R2 = 2.0 + p_pinchR * 3.0 + hLR * 2.0;
				const r = R1 + R2 * Math.cos(vt) + (hUL - hUR) * 2.0;
				const omega = 1.0 + spinSpeed * 0.5;

				baseX = r * Math.cos(omega * ut) - px;
				baseY = r * Math.sin(omega * ut) - py;
				baseZ = R2 * Math.sin(vt) + pitchX * 3.0 - pz;
			}

			const freq = data.freq * 0.2;
			const noiseX = Math.sin(py * freq + t * spinDir * spinSpeed + tiltY) * Math.cos(pz * freq);
			const noiseY = Math.sin(pz * freq + t * spinDir * spinSpeed + tiltX) * Math.cos(px * freq);
			const noiseZ = Math.sin(px * freq + t * spinDir * spinSpeed + rollZ) * Math.cos(py * freq);

			const torusR = 4.0 + type * 1.0;
			const tiltAngleX = tiltX * Math.PI * 0.5;
			const tiltAngleY = tiltY * Math.PI * 0.5;

			const rotatedX = px * Math.cos(tiltAngleY) + pz * Math.sin(tiltAngleY);
			const rotatedZ = -px * Math.sin(tiltAngleY) + pz * Math.cos(tiltAngleY);
			const rotatedY = py * Math.cos(tiltAngleX) - rotatedZ * Math.sin(tiltAngleX);
			const finalZ = py * Math.sin(tiltAngleX) + rotatedZ * Math.cos(tiltAngleX);

			const distRotatedXY = Math.sqrt(rotatedX * rotatedX + rotatedY * rotatedY) + 0.001;
			const dRingX = (rotatedX / distRotatedXY) * torusR - rotatedX;
			const dRingY = (rotatedY / distRotatedXY) * torusR - rotatedY;

			const orbitSpeed = (1.0 + type * 0.4) * spinDir * spinSpeed;
			const orbitX = -rotatedY * orbitSpeed;
			const orbitY = rotatedX * orbitSpeed;
			const orbitZ = Math.sin(rotatedX * 0.5 + t * spinDir) * (1.0 + type) + pitchX * 2.0;

			const unrotX = orbitX * Math.cos(-tiltAngleY) + orbitZ * Math.sin(-tiltAngleY);
			const unrotZ = -orbitX * Math.sin(-tiltAngleY) + orbitZ * Math.cos(-tiltAngleY);
			const unrotY = orbitY * Math.cos(-tiltAngleX) - unrotZ * Math.sin(-tiltAngleX);
			const finalOrbitZ = orbitY * Math.sin(-tiltAngleX) + unrotZ * Math.cos(-tiltAngleX);

			const fusX = dRingX * 1.5 + unrotX;
			const fusY = dRingY * 1.5 + unrotY;
			const fusZ = finalZ * 1.5 + finalOrbitZ;

			const repPush = (12.0 + type * 3.0) / (currentRadius + 1.0);
			const harmonicFreq = 1.0 + type;
			const repX = (px / currentRadius) * repPush + Math.sin(py * harmonicFreq + t * spinDir + tiltY) * 2.0;
			const repY = (py / currentRadius) * repPush + Math.sin(pz * harmonicFreq + t * spinDir + tiltX) * 2.0;
			const repZ = (pz / currentRadius) * repPush + Math.sin(px * harmonicFreq + t * spinDir + rollZ) * 2.0;

			const targetRadius = type * 1.0;
			const shellPull = (targetRadius - currentRadius) * 2.0;
			const aizawaX = Math.sin(py * spinDir + hLL) * 3.0 - px * 0.5;
			const aizawaY = Math.sin(pz * spinDir + hLR) * 3.0 - py * 0.5;
			const aizawaZ = Math.sin(px * spinDir + hUL) * 3.0 - pz * 0.5;
			const colX = (px / currentRadius) * shellPull + aizawaX * (0.5 + type * 0.15);
			const colY = (py / currentRadius) * shellPull + aizawaY * (0.5 + type * 0.15);
			const colZ = (pz / currentRadius) * shellPull + aizawaZ * (0.5 + type * 0.15);

			const forceScale = 0.0006 * (1.0 + shockwave * 5.0);
			const mathStrength = 0.006 * influence;

			const fx = (noiseX * w_neutral + fusX * w_fusion + repX * w_repel + colX * w_collapse) * forceScale + baseX * mathStrength * w_neutral;
			const fy = (noiseY * w_neutral + fusY * w_fusion + repY * w_repel + colY * w_collapse) * forceScale + baseY * mathStrength * w_neutral;
			const fz = (noiseZ * w_neutral + fusZ * w_fusion + repZ * w_repel + colZ * w_collapse) * forceScale + baseZ * mathStrength * w_neutral;

			vx += fx;
			vy += fy;
			vz += fz;

			const friction = 0.97;
			vx *= friction;
			vy *= friction;
			vz *= friction;

			const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
			const maxSpeed = 0.18 + shockwave * 0.25;
			if (speed > maxSpeed) {
				vx = (vx / speed) * maxSpeed;
				vy = (vy / speed) * maxSpeed;
				vz = (vz / speed) * maxSpeed;
			}

			pos[i3] = px + vx;
			pos[i3 + 1] = py + vy;
			pos[i3 + 2] = pz + vz;

			if (isNaN(pos[i3]) || !isFinite(pos[i3])) {
				pos[i3] = (Math.random() - 0.5) * 10;
				pos[i3 + 1] = (Math.random() - 0.5) * 10;
				pos[i3 + 2] = (Math.random() - 0.5) * 10;
				vx = 0;
				vy = 0;
				vz = 0;
			}

			velocities[i3] = vx;
			velocities[i3 + 1] = vy;
			velocities[i3 + 2] = vz;

			const speedSq = vx * vx + vy * vy + vz * vz;

			let h = data.baseHue + w_fusion * 0.1 - w_collapse * 0.1 + w_repel * 0.15 + (hLL - hLR) * 0.1;
			h = Math.abs(h % 1.0);

			const s_color = data.baseSat * (0.8 + speedSq * 10.0);
			const l = data.baseLight * (0.15 + w_fusion * 0.1 + w_collapse * 0.1 + speedSq * 3.0 + shockwave * 0.2);

			tempColor.setHSL(h, Math.min(1.0, s_color), Math.min(1.0, l));

			const intensity = 0.3 + speedSq * 80.0 + w_collapse * 0.5 + w_fusion * 0.5 + shockwave * 2.0 + Math.sin(t * 2.0 + data.glowOffset) * 0.2 + influence * 0.3;

			col[i3] = tempColor.r * intensity;
			col[i3 + 1] = tempColor.g * intensity;
			col[i3 + 2] = tempColor.b * intensity;
		}

		pointsRef.current.geometry.attributes.position.needsUpdate = true;
		pointsRef.current.geometry.attributes.color.needsUpdate = true;
	});

	return (
		<points ref={pointsRef}>
			<bufferGeometry>
				<bufferAttribute attach="attributes-position" args={[positions, 3]} />
				<bufferAttribute attach="attributes-color" args={[colors, 3]} />
			</bufferGeometry>
			<shaderMaterial
				vertexShader={particleVertexShader}
				fragmentShader={particleFragmentShader}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
				transparent={true}
				vertexColors={true}
			/>
		</points>
	);
};

export { NebulaScene };
