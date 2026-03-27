import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 15000;
const MAX_DIST = 15;

// Custom shader material for soft glowing particles with intense core
const particleVertexShader = `
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Size attenuation based on depth
    gl_PointSize = (180.0 / -mvPosition.z); 
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragmentShader = `
  varying vec3 vColor;
  void main() {
    // Distance from center of point
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;
    
    // Soft edge
    float alpha = smoothstep(0.5, 0.0, d);
    // Intense bright core for strong glow
    float core = pow(alpha, 2.0) * 4.0; 
    
    // Output color with HDR boost at the core
    gl_FragColor = vec4(vColor * (1.0 + core), alpha);
  }
`;

const NebulaScene = ({ distance, pinchL, pinchR }: { distance: number; pinchL: number; pinchR: number }) => {
	const pointsRef = useRef<THREE.Points>(null);

	// State for elastic buffering and shockwaves
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

	// Initialize particle data
	const { positions, colors, velocities, baseData } = useMemo(() => {
		const pos = new Float32Array(PARTICLE_COUNT * 3);
		const col = new Float32Array(PARTICLE_COUNT * 3);
		const vel = new Float32Array(PARTICLE_COUNT * 3);
		const base = [];

		for (let i = 0; i < PARTICLE_COUNT; i++) {
			const type = i % 4; // 4 distinct mathematical layers

			// Initial positions: elegant sphere distribution
			const r = Math.random() * 8.0 + 2.0;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(Math.random() * 2 - 1);

			pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
			pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
			pos[i * 3 + 2] = r * Math.cos(phi);

			vel[i * 3] = 0;
			vel[i * 3 + 1] = 0;
			vel[i * 3 + 2] = 0;

			let baseHue, baseSat, baseLight;

			if (type === 0) {
				// Layer 0: Core/Collapse affinity (Red/Orange)
				baseHue = 0.95 + (Math.random() - 0.5) * 0.05;
				baseSat = 0.9;
				baseLight = 0.6;
			} else if (type === 1) {
				// Layer 1: Torus/Fusion affinity (Cyan/Blue)
				baseHue = 0.55 + (Math.random() - 0.5) * 0.05;
				baseSat = 0.8;
				baseLight = 0.5;
			} else if (type === 2) {
				// Layer 2: Fluid/Neutral affinity (Magenta/Purple)
				baseHue = 0.8 + (Math.random() - 0.5) * 0.05;
				baseSat = 0.8;
				baseLight = 0.5;
			} else {
				// Layer 3: Web/Repulsion affinity (Emerald/Green)
				baseHue = 0.35 + (Math.random() - 0.5) * 0.05;
				baseSat = 0.8;
				baseLight = 0.5;
			}

			base.push({
				type,
				baseHue,
				baseSat,
				baseLight,
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

		// Calculate target fluid state weights (0.0 to 1.0)
		const prox = Math.max(0, 1 - distance / MAX_DIST);
		const pL = pinchL / 100;
		const pR = pinchR / 100;

		const target_fusion = prox * pL * pR;
		const target_repel = prox * (1 - pL) * (1 - pR);
		const target_collapse = prox * Math.abs(pL - pR);
		const target_neutral = 1.0 - prox;

		// Elastic buffering (Spring physics for state transitions)
		const s = stateRef.current;
		const spring = 0.08; // Stiffness
		const damp = 0.85; // Damping

		// Detect major shifts for shockwave impact
		const totalDelta = Math.abs(target_fusion - s.w_fusion) + Math.abs(target_repel - s.w_repel) + Math.abs(target_collapse - s.w_collapse);

		if (totalDelta > 0.4 && s.shockwave < 0.1) {
			s.shockwave = 1.0; // Trigger shockwave
		}
		s.shockwave *= 0.92; // Decay shockwave

		// Apply spring physics to weights
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
		const t = time * 0.05; // Extremely slow time evolution

		for (let i = 0; i < PARTICLE_COUNT; i++) {
			const i3 = i * 3;
			const px = pos[i3];
			const py = pos[i3 + 1];
			const pz = pos[i3 + 2];
			let vx = velocities[i3];
			let vy = velocities[i3 + 1];
			let vz = velocities[i3 + 2];
			const data = baseData[i];
			const type = data.type; // 0, 1, 2, 3

			const currentRadius = Math.sqrt(px * px + py * py + pz * pz) + 0.001;
			const distXY = Math.sqrt(px * px + py * py) + 0.001;

			// --- 1. NEUTRAL STATE: Gentle Curl Noise Fluid ---
			const freq = data.freq * (0.2 + type * 0.05); // Different frequency per layer
			const nX = Math.sin(py * freq + t) * Math.cos(pz * freq);
			const nY = Math.sin(pz * freq + t) * Math.cos(px * freq);
			const nZ = Math.sin(px * freq + t) * Math.cos(py * freq);

			// --- 2. FUSION STATE: Structured Torus Vortex ---
			// Layer type offsets the ring radius slightly for layered rings
			const torusR = 2.0 + type * 2.0; // Rings at 2, 4, 6, 8
			const dRingX = (px / distXY) * torusR - px;
			const dRingY = (py / distXY) * torusR - py;
			const dRingZ = -pz;
			const orbitSpeed = 1.0 + type * 0.5;
			const orbitX = -py * orbitSpeed;
			const orbitY = px * orbitSpeed;
			const orbitZ = Math.sin(px * 0.5 + t) * (1.0 + type);
			const fusX = dRingX * 1.5 + orbitX;
			const fusY = dRingY * 1.5 + orbitY;
			const fusZ = dRingZ * 1.5 + orbitZ;

			// --- 3. REPULSION STATE: Expanding Spherical Harmonics ---
			const repPush = (15.0 + type * 5.0) / (currentRadius + 1.0);
			const harmonicFreq = 1.0 + type;
			const repX = (px / currentRadius) * repPush + Math.sin(py * harmonicFreq) * 2.0;
			const repY = (py / currentRadius) * repPush + Math.sin(pz * harmonicFreq) * 2.0;
			const repZ = (pz / currentRadius) * repPush + Math.sin(px * harmonicFreq) * 2.0;

			// --- 4. COLLAPSE STATE: Dense Core Aizawa Attractor ---
			// Instead of all going to 0, they go to concentric shells
			const targetRadius = type * 1.2; // Shells at 0, 1.2, 2.4, 3.6
			const shellPull = (targetRadius - currentRadius) * 2.0;
			const aizawaX = Math.sin(py) * 3.0 - px * 0.5;
			const aizawaY = Math.sin(pz) * 3.0 - py * 0.5;
			const aizawaZ = Math.sin(px) * 3.0 - pz * 0.5;
			const colX = (px / currentRadius) * shellPull + aizawaX * (0.5 + type * 0.2);
			const colY = (py / currentRadius) * shellPull + aizawaY * (0.5 + type * 0.2);
			const colZ = (pz / currentRadius) * shellPull + aizawaZ * (0.5 + type * 0.2);

			// --- CONTINUOUS FLUID INTEGRATION ---
			// Smoothly blend the mathematical vector fields based on current state weights
			// Shockwave temporarily boosts forces for impact
			const forceScale = 0.0008 * (1.0 + shockwave * 5.0);
			const fx = (nX * w_neutral + fusX * w_fusion + repX * w_repel + colX * w_collapse) * forceScale;
			const fy = (nY * w_neutral + fusY * w_fusion + repY * w_repel + colY * w_collapse) * forceScale;
			const fz = (nZ * w_neutral + fusZ * w_fusion + repZ * w_repel + colZ * w_collapse) * forceScale;

			vx += fx;
			vy += fy;
			vz += fz;

			// High friction ensures particles glide smoothly and don't overshoot
			const friction = 0.98;
			vx *= friction;
			vy *= friction;
			vz *= friction;

			// Strict speed cap for ultimate elegance and slow motion, boosted during shockwave
			const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
			const maxSpeed = 0.15 + shockwave * 0.2;
			if (speed > maxSpeed) {
				vx = (vx / speed) * maxSpeed;
				vy = (vy / speed) * maxSpeed;
				vz = (vz / speed) * maxSpeed;
			}

			// Update position
			pos[i3] = px + vx;
			pos[i3 + 1] = py + vy;
			pos[i3 + 2] = pz + vz;

			// Robust NaN Recovery
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

			// --- COLOR FORMULA ---
			const speedSq = vx * vx + vy * vy + vz * vz;

			// Hue shifts smoothly between states
			let h = data.baseHue + w_fusion * 0.1 - w_collapse * 0.1 + w_repel * 0.2;
			h = Math.abs(h % 1.0);

			const s = data.baseSat * (0.8 + speedSq * 10.0);

			// Drastically lower base lightness to prevent overexposure when aggregated
			const l = data.baseLight * (0.15 + w_fusion * 0.1 + w_collapse * 0.1 + speedSq * 2.0 + shockwave * 0.2);

			tempColor.setHSL(h, Math.min(1.0, s), Math.min(1.0, l));

			// Lower base intensity, boost with shockwave
			const intensity = 0.2 + speedSq * 50.0 + w_collapse * 0.5 + w_fusion * 0.5 + shockwave * 2.0 + Math.sin(t * 2.0 + data.glowOffset) * 0.2;

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
