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

		// Calculate continuous fluid state weights (0.0 to 1.0)
		const prox = Math.max(0, 1 - distance / MAX_DIST);
		const pL = pinchL / 100;
		const pR = pinchR / 100;

		const w_fusion = prox * pL * pR;
		const w_repel = prox * (1 - pL) * (1 - pR);
		const w_collapse = prox * Math.abs(pL - pR);
		const w_neutral = 1.0 - prox;

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

			const currentRadius = Math.sqrt(px * px + py * py + pz * pz) + 0.001;
			const distXY = Math.sqrt(px * px + py * py) + 0.001;

			// --- 1. NEUTRAL STATE: Gentle Curl Noise Fluid ---
			const freq = data.freq * 0.3;
			const nX = Math.sin(py * freq + t) * Math.cos(pz * freq);
			const nY = Math.sin(pz * freq + t) * Math.cos(px * freq);
			const nZ = Math.sin(px * freq + t) * Math.cos(py * freq);

			// --- 2. FUSION STATE: Structured Torus Vortex ---
			// Layer type offsets the ring radius slightly for layered rings
			const torusR = 4.0 + data.type * 1.5;
			const dRingX = (px / distXY) * torusR - px;
			const dRingY = (py / distXY) * torusR - py;
			const dRingZ = -pz;
			const orbitX = -py;
			const orbitY = px;
			const orbitZ = Math.sin(px * 0.5 + t) * 2.0;
			const fusX = dRingX * 1.5 + orbitX * 2.0;
			const fusY = dRingY * 1.5 + orbitY * 2.0;
			const fusZ = dRingZ * 1.5 + orbitZ;

			// --- 3. REPULSION STATE: Expanding Spherical Harmonics ---
			const repPush = 10.0 / (currentRadius + 1.0);
			const repX = (px / currentRadius) * repPush + Math.sin(py * 2.0) * 1.5;
			const repY = (py / currentRadius) * repPush + Math.sin(pz * 2.0) * 1.5;
			const repZ = (pz / currentRadius) * repPush + Math.sin(px * 2.0) * 1.5;

			// --- 4. COLLAPSE STATE: Dense Core Aizawa Attractor ---
			const colPull = -8.0 / (currentRadius + 0.1);
			const aizawaX = Math.sin(py) * 3.0 - px * 0.5;
			const aizawaY = Math.sin(pz) * 3.0 - py * 0.5;
			const aizawaZ = Math.sin(px) * 3.0 - pz * 0.5;
			const colX = (px / currentRadius) * colPull + aizawaX;
			const colY = (py / currentRadius) * colPull + aizawaY;
			const colZ = (pz / currentRadius) * colPull + aizawaZ;

			// --- CONTINUOUS FLUID INTEGRATION ---
			// Smoothly blend the mathematical vector fields based on current state weights
			const forceScale = 0.0008; // Extremely gentle forces for elegance
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

			// Strict speed cap for ultimate elegance and slow motion
			const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
			const maxSpeed = 0.15;
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

			const s = data.baseSat * (0.8 + speedSq * 20.0);
			const l = data.baseLight * (0.5 + w_fusion * 0.2 + w_collapse * 0.3 + speedSq * 10.0);

			tempColor.setHSL(h, Math.min(1.0, s), Math.min(1.0, l));

			// Intensity pulses based on state and speed
			const intensity = 1.0 + speedSq * 150.0 + w_collapse * 2.0 + w_fusion * 1.5 + Math.sin(t * 2.0 + data.glowOffset) * 0.5;

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
