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
	const { positions, colors, baseData } = useMemo(() => {
		const pos = new Float32Array(PARTICLE_COUNT * 3);
		const col = new Float32Array(PARTICLE_COUNT * 3);
		const base = [];

		for (let i = 0; i < PARTICLE_COUNT; i++) {
			const type = i % 4; // 4 distinct mathematical layers
			let u = Math.random() * Math.PI * 2;
			let v = Math.random() * Math.PI * 2;

			if (type === 1) {
				// Uniform sphere distribution for u [0, PI]
				u = Math.acos(Math.random() * 2 - 1);
			}

			let baseHue, baseSat, baseLight;

			if (type === 0) {
				// Layer 0: Torus Knot (Golden/Orange)
				baseHue = 0.05 + Math.random() * 0.05;
				baseSat = 0.9;
				baseLight = 0.6;
			} else if (type === 1) {
				// Layer 1: Spherical Harmonics (Cyan/Blue)
				baseHue = 0.55 + Math.random() * 0.05;
				baseSat = 0.8;
				baseLight = 0.5;
			} else if (type === 2) {
				// Layer 2: Möbius Ribbon (Magenta/Purple)
				baseHue = 0.8 + Math.random() * 0.05;
				baseSat = 0.8;
				baseLight = 0.5;
			} else {
				// Layer 3: Lissajous Web (Emerald/Green)
				baseHue = 0.35 + Math.random() * 0.05;
				baseSat = 0.8;
				baseLight = 0.5;
			}

			// Initialize at origin, will snap to math path on first frame
			pos[i * 3] = 0;
			pos[i * 3 + 1] = 0;
			pos[i * 3 + 2] = 0;

			base.push({
				type,
				u,
				v,
				baseHue,
				baseSat,
				baseLight,
				glowOffset: Math.random() * Math.PI * 2,
			});
		}
		return { positions: pos, colors: col, baseData: base };
	}, []);

	useFrame((state) => {
		if (!pointsRef.current) return;
		const time = state.clock.elapsedTime;
		const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
		const col = pointsRef.current.geometry.attributes.color.array as Float32Array;

		// Map inputs to continuous parameters to deform the mathematical field
		const p_dist = distance / MAX_DIST; // 0 to 1
		const p_pinchL = pinchL / 100; // 0 to 1
		const p_pinchR = pinchR / 100; // 0 to 1

		const tempColor = new THREE.Color();
		const t = time * 0.1; // Master time scale - EXTREMELY SLOW AND ELEGANT

		for (let i = 0; i < PARTICLE_COUNT; i++) {
			const i3 = i * 3;
			const data = baseData[i];
			const { type, u, v } = data;

			let nx = 0,
				ny = 0,
				nz = 0;

			// --- 4 DISTINCT PURE MATHEMATICAL PARAMETRIC LAYERS ---
			if (type === 0) {
				// LAYER 0: The Golden Torus Knot
				// pinchL and pinchR continuously morph the winding numbers
				const p = 2.0 + p_pinchL * 5.0;
				const q = 3.0 + p_pinchR * 5.0;
				const ut = u + t * 0.2; // Flow along the knot
				const r = 4.0 + Math.cos(q * ut) * (1.0 + p_dist * 2.0);
				const tubeR = 0.2 + p_dist * 0.5; // Thickness of the knot

				nx = r * Math.cos(p * ut) + tubeR * Math.cos(v);
				ny = r * Math.sin(p * ut) + tubeR * Math.sin(v);
				nz = Math.sin(q * ut) * 4.0 + tubeR * Math.cos(v);
			} else if (type === 1) {
				// LAYER 1: Quantum Spherical Harmonics (Breathing Lotus)
				// Quantized frequencies for perfect symmetrical petal formations
				const m = 1.0 + Math.floor(p_pinchL * 6.0);
				const n = 1.0 + Math.floor(p_pinchR * 6.0);
				const vt = v + t * 0.1; // Slowly rotate the entire flower
				const r = 5.0 + Math.sin(m * u) * Math.cos(n * vt) * (2.0 + p_dist * 5.0);

				nx = r * Math.sin(u) * Math.cos(vt);
				ny = r * Math.sin(u) * Math.sin(vt);
				nz = r * Math.cos(u);
			} else if (type === 2) {
				// LAYER 2: The Möbius Ribbon (Twisting Space)
				// pinchL adds twists, pinchR widens the ribbon
				const R = 7.0 + p_dist * 3.0;
				const twists = p_pinchL * 4.0;
				const w = (v - Math.PI) * (0.5 + p_pinchR * 2.0); // Width from -w to w
				const ut = u + t * 0.15;

				nx = (R + w * Math.cos(twists * ut)) * Math.cos(ut);
				ny = (R + w * Math.cos(twists * ut)) * Math.sin(ut);
				nz = w * Math.sin(twists * ut);
			} else if (type === 3) {
				// LAYER 3: 3D Lissajous Interference Web
				// Inputs control the phase and frequencies of the bounding box
				const a = 1.0 + p_pinchL * 3.0;
				const b = 2.0 + p_pinchR * 2.0;
				const c = 3.0 + p_dist * 2.0;
				const A = 8.0 + p_dist * 4.0;
				const ut = u + t * 0.1;

				nx = A * Math.sin(a * ut + v);
				ny = A * Math.sin(b * ut + v);
				nz = A * Math.cos(c * ut + v);
			}

			// Calculate instantaneous speed for color intensity
			const dx = nx - pos[i3];
			const dy = ny - pos[i3 + 1];
			const dz = nz - pos[i3 + 2];

			// Ignore the massive jump on the very first frame
			const speedSq = time < 0.1 ? 0 : dx * dx + dy * dy + dz * dz;

			// Update position (Teleport to exact mathematical coordinate)
			pos[i3] = nx;
			pos[i3 + 1] = ny;
			pos[i3 + 2] = nz;

			// --- COLOR FORMULA ---
			// Hue shifts elegantly based on speed and distance
			const hueShift = speedSq * 2.0 + p_dist * 0.1;
			const h = Math.abs((data.baseHue + hueShift) % 1.0);

			const s = data.baseSat;
			const l = Math.min(1.0, data.baseLight + speedSq * 5.0);

			tempColor.setHSL(h, s, l);

			// Intensity pulses based on speed and individual offset
			const intensity = 1.5 + speedSq * 2000.0 + Math.sin(t * 2.0 + data.glowOffset) * 0.8;

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
