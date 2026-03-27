import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Trash2, Info, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

const NebulaScene = ({ distance, pinchL, pinchR }: { distance: number, pinchL: number, pinchR: number }) => {
  const pointsRef = useRef<THREE.Points>(null);
  
  // Initialize particle data
  const { positions, colors, velocities, baseData } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3);
    const base = [];
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let type, index, totalForType;
      let baseHue, baseSat, baseLight, influence;

      if (i < PARTICLE_COUNT * 0.5) {
        // Layer 0: Galaxy Spiral (Fluid Core) - 50%
        type = 0;
        index = i;
        totalForType = PARTICLE_COUNT * 0.5;
        baseHue = 0.6; // Blue
        baseSat = 0.9;
        baseLight = 0.6;
        influence = 1.5; // Very strongly affected by fluid
      } else if (i < PARTICLE_COUNT * 0.8) {
        // Layer 1: Fibonacci Phyllotaxis Sphere - 30%
        type = 1;
        index = i - PARTICLE_COUNT * 0.5;
        totalForType = PARTICLE_COUNT * 0.3;
        baseHue = 0.05; // Orange/Red
        baseSat = 0.8;
        baseLight = 0.5;
        influence = 0.6; // Moderately affected
      } else if (i < PARTICLE_COUNT * 0.95) {
        // Layer 2: Torus Knot - 15%
        type = 2;
        index = i - PARTICLE_COUNT * 0.8;
        totalForType = PARTICLE_COUNT * 0.15;
        baseHue = 0.8; // Purple
        baseSat = 0.8;
        baseLight = 0.5;
        influence = 0.2; // Slightly affected
      } else {
        // Layer 3: Complex Harmonic Web (Lissajous) - 5%
        type = 3;
        index = i - PARTICLE_COUNT * 0.95;
        totalForType = PARTICLE_COUNT * 0.05;
        baseHue = 0.3; // Green
        baseSat = 0.9;
        baseLight = 0.6;
        influence = 0.02; // Barely affected, acts as rigid mathematical structure
      }

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

      base.push({
        type,
        index,
        totalForType,
        influence,
        u: Math.random() * Math.PI * 2,
        a: Math.random() * 3 + 1,
        b: Math.random() * 3 + 1,
        c: Math.random() * 3 + 1,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        phaseZ: Math.random() * Math.PI * 2,
        offsetY: (Math.random() - 0.5) * 2.0,
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
    
    const GOLDEN_ANGLE = 2.39996323; // Math.PI * (3 - sqrt(5))
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const px = pos[i3];
      const py = pos[i3+1];
      const pz = pos[i3+2];
      let vx = velocities[i3];
      let vy = velocities[i3+1];
      let vz = velocities[i3+2];
      const data = baseData[i];
      const { type, index, totalForType, influence, u, a, b, c, phaseX, phaseY, phaseZ, offsetY } = data;
      
      const currentRadius = Math.sqrt(px*px + py*py + pz*pz) + 0.001;
      const distXY = Math.sqrt(px*px + py*py) + 0.001;

      // ==========================================
      // PART 1: THE FLUID DYNAMICS (GESTURE FORCES)
      // ==========================================

      // --- 1. NEUTRAL STATE: Gentle Curl Noise Fluid ---
      const freq = data.freq * 0.2;
      const nX = Math.sin(py * freq + t) * Math.cos(pz * freq);
      const nY = Math.sin(pz * freq + t) * Math.cos(px * freq);
      const nZ = Math.sin(px * freq + t) * Math.cos(py * freq);

      // --- 2. FUSION STATE: Structured Torus Vortex ---
      const torusR = 5.0; 
      const dRingX = (px / distXY) * torusR - px;
      const dRingY = (py / distXY) * torusR - py;
      const dRingZ = -pz;
      const orbitX = -py;
      const orbitY = px;
      const orbitZ = Math.sin(distXY * 0.5 - t * 2.0) * 2.0;
      const fusX = dRingX * 0.8 + orbitX * 1.5;
      const fusY = dRingY * 0.8 + orbitY * 1.5;
      const fusZ = dRingZ * 0.8 + orbitZ;

      // --- 3. REPULSION STATE: Expanding Spherical Harmonics ---
      const repPush = 15.0 / (currentRadius + 0.5);
      const repX = (px / currentRadius) * repPush + Math.sin(py * 1.5 - t) * 2.0;
      const repY = (py / currentRadius) * repPush + Math.sin(pz * 1.5 - t) * 2.0;
      const repZ = (pz / currentRadius) * repPush + Math.sin(px * 1.5 - t) * 2.0;

      // --- 4. COLLAPSE STATE: Imploding Black Hole ---
      const colPull = -20.0 / (currentRadius + 1.0); // Strong pull to center
      const swirlSpeed = 8.0 / (currentRadius + 1.0); // Faster swirl near center
      const colX = (px / currentRadius) * colPull - py * swirlSpeed;
      const colY = (py / currentRadius) * colPull + px * swirlSpeed;
      const colZ = (pz / currentRadius) * colPull - Math.sign(pz) * swirlSpeed * 1.5; // Flatten to disk

      // Combine fluid forces
      const gX = (nX * w_neutral + fusX * w_fusion + repX * w_repel + colX * w_collapse);
      const gY = (nY * w_neutral + fusY * w_fusion + repY * w_repel + colY * w_collapse);
      const gZ = (nZ * w_neutral + fusZ * w_fusion + repZ * w_repel + colZ * w_collapse);


      // ==========================================
      // PART 2: THE MATHEMATICAL BASE PATHS (STRUCTURE)
      // ==========================================
      let baseX = 0, baseY = 0, baseZ = 0;

      if (type === 0) {
        // Layer 0: Galaxy Spiral
        const r = Math.sqrt(index / totalForType) * 12.0;
        const theta = r * 1.5 + t * 0.2;
        const tx = r * Math.cos(theta);
        const ty = offsetY * (1.0 - r/12.0) * 4.0;
        const tz = r * Math.sin(theta);
        baseX = (tx - px) * 0.008;
        baseY = (ty - py) * 0.008;
        baseZ = (tz - pz) * 0.008;
      } else if (type === 1) {
        // Layer 1: Fibonacci Phyllotaxis Sphere
        const phi = Math.acos(1 - 2 * (index + 0.5) / totalForType);
        const theta = GOLDEN_ANGLE * index + t * 0.1;
        const R = 7.0;
        const tx = R * Math.sin(phi) * Math.cos(theta);
        const ty = R * Math.sin(phi) * Math.sin(theta);
        const tz = R * Math.cos(phi);
        baseX = (tx - px) * 0.02;
        baseY = (ty - py) * 0.02;
        baseZ = (tz - pz) * 0.02;
      } else if (type === 2) {
        // Layer 2: Torus Knot
        const p = 3, q = 7;
        const ut = (index / totalForType) * Math.PI * 2 * 10 + t * 0.15;
        const R = 5.0, r = 2.0;
        const tx = (R + r * Math.cos(q * ut)) * Math.cos(p * ut);
        const ty = (R + r * Math.cos(q * ut)) * Math.sin(p * ut);
        const tz = r * Math.sin(q * ut);
        baseX = (tx - px) * 0.03;
        baseY = (ty - py) * 0.03;
        baseZ = (tz - pz) * 0.03;
      } else if (type === 3) {
        // Layer 3: Lissajous Web
        const A = 10.0;
        const tx = A * Math.sin(a * t * 0.05 + phaseX);
        const ty = A * Math.sin(b * t * 0.05 + phaseY);
        const tz = A * Math.sin(c * t * 0.05 + phaseZ);
        baseX = (tx - px) * 0.04;
        baseY = (ty - py) * 0.04;
        baseZ = (tz - pz) * 0.04;
      }

      // ==========================================
      // PART 3: SUPERPOSITION & INTEGRATION
      // ==========================================
      // The final force is the mathematical base structure PLUS the fluid gesture force
      // scaled by this specific particle's susceptibility (influence) to gestures.
      const gestureScale = 0.05;
      const fx = baseX + gX * gestureScale * influence;
      const fy = baseY + gY * gestureScale * influence;
      const fz = baseZ + gZ * gestureScale * influence;

      vx += fx;
      vy += fy;
      vz += fz;

      // High friction ensures particles glide smoothly and don't overshoot
      const friction = 0.95;
      vx *= friction;
      vy *= friction;
      vz *= friction;

      // Strict speed cap for ultimate elegance and slow motion
      const speed = Math.sqrt(vx*vx + vy*vy + vz*vz);
      const maxSpeed = 0.25;
      if (speed > maxSpeed) {
        vx = (vx / speed) * maxSpeed;
        vy = (vy / speed) * maxSpeed;
        vz = (vz / speed) * maxSpeed;
      }

      // Update position
      pos[i3] = px + vx;
      pos[i3+1] = py + vy;
      pos[i3+2] = pz + vz;

      // Robust NaN Recovery
      if (isNaN(pos[i3]) || !isFinite(pos[i3])) {
        pos[i3] = (Math.random() - 0.5) * 10;
        pos[i3+1] = (Math.random() - 0.5) * 10;
        pos[i3+2] = (Math.random() - 0.5) * 10;
        vx = 0; vy = 0; vz = 0;
      }

      velocities[i3] = vx;
      velocities[i3+1] = vy;
      velocities[i3+2] = vz;

      // --- COLOR FORMULA ---
      const speedSq = vx*vx + vy*vy + vz*vz;
      
      // Hue shifts smoothly between states, scaled by influence so structured layers keep their color better
      let h = data.baseHue + (w_fusion * 0.15 - w_collapse * 0.1 + w_repel * 0.2) * influence;
      h = (h + 1.0) % 1.0;
      
      const s = data.baseSat * (0.7 + speedSq * 5.0);
      const l = data.baseLight * (0.4 + w_fusion * 0.3 + w_collapse * 0.4 + speedSq * 2.0);
      
      tempColor.setHSL(h, Math.min(1.0, s), Math.min(1.0, l));
      
      // Intensity pulses based on state and speed
      const intensity = 1.0 + speedSq * 20.0 + (w_collapse * 2.0 + w_fusion * 1.5) * influence + Math.sin(t * 3.0 + data.glowOffset) * 0.5;
      
      col[i3] = tempColor.r * intensity;
      col[i3+1] = tempColor.g * intensity;
      col[i3+2] = tempColor.b * intensity;
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={PARTICLE_COUNT}
          array={colors}
          itemSize={3}
        />
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
