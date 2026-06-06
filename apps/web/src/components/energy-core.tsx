'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { harmonyBand, harmonyState, type HarmonyState } from '@homebuddy/shared';

const SHOCK_DURATION = 1.6;
const BLOOM_DURATION = 2.2;
const PETAL_COUNT = 12;
const PARTICLE_COUNT = 220;

export interface MemberContribution {
  id: string;
  score: number;
  color?: string;
}

interface EnergyCoreProps {
  score: number;
  hasHeavyOverdue: boolean;
  bloomCount: number;
  pulseCount?: number;
  overdueCount?: number;
  trend?: number;
  memberContributions?: MemberContribution[];
}

const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 permute(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

const CORE_VERT = /* glsl */ `
uniform float uTime;
uniform float uNoiseAmt;
uniform float uRipple;
uniform float uBreath;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vNoise;
${NOISE_GLSL}
void main(){
  vec3 n = normalize(position);
  float f1 = snoise(n * 1.6 + vec3(uTime * 0.35));
  float f2 = snoise(n * 3.1 - vec3(uTime * 0.6)) * 0.5;
  float noiseSum = (f1 + f2) * uNoiseAmt;

  float ripple = sin(length(position.xz) * 6.0 - uRipple * 14.0) * uRipple * 0.35;
  float breathScale = 1.0 + uBreath;
  vec3 displaced = (position + n * (noiseSum + ripple)) * breathScale;

  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = worldPos.xyz;
  vNormal = normalize(normalMatrix * n);
  vNoise = f1;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const CORE_FRAG = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uEmissive;
uniform vec3 uRimColor;
uniform float uEmissiveStrength;
uniform float uScarStrength;
uniform float uBloom;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vNoise;
${NOISE_GLSL}
void main(){
  vec3 base = mix(uColorA, uColorB, smoothstep(-0.8, 1.2, vNoise) * 0.65);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fres = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.2);

  float scarMask = 0.0;
  if (uScarStrength > 0.0) {
    float veins = snoise(vWorldPos * 3.4 + vec3(uTime * 0.05));
    scarMask = smoothstep(0.55, 0.85, abs(veins));
    scarMask *= uScarStrength;
  }
  vec3 scarColor = vec3(0.95, 0.22, 0.18);

  vec3 col = base * 1.08;
  col += uEmissive * uEmissiveStrength * 0.35;
  col += uColorA * fres * 0.7 + uRimColor * fres * 0.55 * (0.6 + uBloom);
  col += scarColor * scarMask * (0.5 + sin(uTime * 5.0) * 0.18);
  col += vec3(0.85, 0.95, 0.78) * uBloom * 0.5;

  gl_FragColor = vec4(col, 1.0);
}
`;

const ATMO_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
void main(){
  vNormal = normalize(normalMatrix * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main(){
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fres = pow(1.0 - max(dot(normalize(-vNormal), viewDir), 0.0), 2.0);
  vec3 col = uColor * fres * uIntensity;
  gl_FragColor = vec4(col, fres);
}
`;

const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
void main(){
  float d = length(vUv - vec2(0.5));
  float a = smoothstep(0.5, 0.0, d) * uIntensity;
  gl_FragColor = vec4(uColor, a);
}
`;

const PARTICLE_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aSeed;
uniform float uTime;
uniform float uScatter;
varying float vAlpha;
void main(){
  vec3 p = position;
  float swirl = uTime * (0.25 + aSeed.x * 0.4);
  float c = cos(swirl);
  float s = sin(swirl);
  vec3 rotated = vec3(c * p.x - s * p.z, p.y + sin(uTime + aSeed.y * 6.28) * 0.12, s * p.x + c * p.z);
  rotated += normalize(p) * uScatter * (0.4 + aSeed.z);
  vAlpha = clamp(1.0 - uScatter * 0.4, 0.15, 1.0);
  vec4 mv = modelViewMatrix * vec4(rotated, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * (180.0 / -mv.z);
}
`;

const PARTICLE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  gl_FragColor = vec4(uColor, a);
}
`;

type U<T> = { value: T };
type CoreU = {
  uTime: U<number>;
  uNoiseAmt: U<number>;
  uRipple: U<number>;
  uBreath: U<number>;
  uColorA: U<THREE.Vector3>;
  uColorB: U<THREE.Vector3>;
  uEmissive: U<THREE.Vector3>;
  uRimColor: U<THREE.Vector3>;
  uEmissiveStrength: U<number>;
  uScarStrength: U<number>;
  uBloom: U<number>;
};
type AtmoU = { uColor: U<THREE.Vector3>; uIntensity: U<number> };
type GlowU = AtmoU;
type ParticleU = { uTime: U<number>; uScatter: U<number>; uColor: U<THREE.Vector3> };

function hexToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function beatPulse(phase: number, attack: number, decay: number): number {
  if (phase < 0 || phase > 1) return 0;
  if (phase < attack) {
    const p = phase / attack;
    return p * p * (3 - 2 * p);
  }
  return Math.exp(-(phase - attack) * decay);
}

function dampVec3(current: THREE.Vector3, target: THREE.Vector3, lambda: number, dt: number) {
  const k = 1 - Math.exp(-lambda * dt);
  current.x += (target.x - current.x) * k;
  current.y += (target.y - current.y) * k;
  current.z += (target.z - current.z) * k;
}

interface CoreSceneProps extends EnergyCoreProps {
  shockRef: React.MutableRefObject<number>;
  bloomRef: React.MutableRefObject<number>;
  petalRef: React.MutableRefObject<number>;
}

function CoreSphere({
  state,
  shockRef,
  bloomRef,
  scarTarget,
  trend,
}: {
  state: HarmonyState;
  shockRef: React.MutableRefObject<number>;
  bloomRef: React.MutableRefObject<number>;
  scarTarget: number;
  trend: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const noiseRef = useRef(state.noise);
  const speedRef = useRef(state.speed);
  const colorA = useRef(hexToVec3(state.color));
  const colorB = useRef(hexToVec3(state.emissive));
  const emissive = useRef(hexToVec3(state.emissive));
  const scarRef = useRef(0);
  const rotZRef = useRef(0);
  const beatRef = useRef(0);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uNoiseAmt: { value: state.noise },
      uRipple: { value: 0 },
      uBreath: { value: 0 },
      uColorA: { value: hexToVec3(state.color) },
      uColorB: { value: hexToVec3(state.emissive) },
      uEmissive: { value: hexToVec3(state.emissive) },
      uRimColor: { value: new THREE.Vector3(1.0, 0.92, 0.78) },
      uEmissiveStrength: { value: 0.5 },
      uScarStrength: { value: 0 },
      uBloom: { value: 0 },
      uTime2: { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return;
    const u = matRef.current.uniforms as unknown as CoreU;
    const t = u.uTime.value + delta;
    u.uTime.value = t;

    if (shockRef.current > 0) shockRef.current = Math.max(0, shockRef.current - delta / SHOCK_DURATION);
    if (bloomRef.current > 0) bloomRef.current = Math.max(0, bloomRef.current - delta / BLOOM_DURATION);

    const shock = shockRef.current;
    const bloom = bloomRef.current;

    const targetNoise = state.noise + shock * 0.9 - bloom * 0.45;
    noiseRef.current = damp(noiseRef.current, targetNoise, 6, delta);
    u.uNoiseAmt.value = noiseRef.current;
    u.uRipple.value = shock;

    const bpm = 60 + (1 - state.t01) * 70;
    const beatPeriod = 60 / bpm;
    const cyclePhase = (t % beatPeriod) / beatPeriod;
    const lub = beatPulse(cyclePhase, 0.09, 5.5);
    const dub = beatPulse(cyclePhase - 0.32, 0.07, 6.5) * 0.5;
    const rawBeat = lub + dub;
    const smoothedBeat = damp(beatRef.current, rawBeat, 30, delta);
    beatRef.current = smoothedBeat;
    const beatAmp = 0.06 + (1 - state.t01) * 0.05;
    const heartScale = 1 + smoothedBeat * beatAmp;
    meshRef.current.scale.setScalar(heartScale);
    u.uBreath.value = -bloom * 0.03 + shock * 0.04;

    const targetA = hexToVec3(state.color);
    const targetB = hexToVec3(state.emissive);
    const bloomColor = new THREE.Vector3(0.85, 0.95, 0.78);
    targetA.lerp(bloomColor, bloom * 0.45);
    targetB.lerp(bloomColor, bloom * 0.45);
    dampVec3(colorA.current, targetA, 3, delta);
    dampVec3(colorB.current, targetB, 3, delta);
    dampVec3(emissive.current, hexToVec3(state.emissive), 3, delta);
    u.uColorA.value.copy(colorA.current);
    u.uColorB.value.copy(colorB.current);
    u.uEmissive.value.copy(emissive.current);

    const trendBoost = trend > 0 ? Math.min(0.4, trend * 0.02) : 0;
    const trendDip = trend < 0 ? Math.max(-0.2, trend * 0.01) : 0;
    u.uEmissiveStrength.value = 0.55 + bloom * 1.1 + trendBoost + trendDip;

    scarRef.current = damp(scarRef.current, scarTarget, 2.5, delta);
    u.uScarStrength.value = scarRef.current;
    u.uBloom.value = bloom;

    const targetSpeed = bloom > 0 ? state.speed * (1 - bloom * 0.85) : shock > 0 ? state.speed * (1 + shock * 4) : state.speed;
    speedRef.current = damp(speedRef.current, targetSpeed, 8, delta);
    meshRef.current.rotation.y += delta * speedRef.current;
    meshRef.current.rotation.x += delta * speedRef.current * 0.3;
    if (shock > 0) {
      rotZRef.current += delta * speedRef.current * 1.5 * Math.sin(t * 18);
      meshRef.current.rotation.z = rotZRef.current;
    } else {
      rotZRef.current = damp(rotZRef.current, 0, 4, delta);
      meshRef.current.rotation.z = rotZRef.current;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 4]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={CORE_VERT}
        fragmentShader={CORE_FRAG}
        uniforms={uniforms}
      />
    </mesh>
  );
}

function Atmosphere({ state }: { state: HarmonyState }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const target = useRef(hexToVec3(state.color));

  const uniforms = useMemo(
    () => ({
      uColor: { value: hexToVec3(state.color) },
      uIntensity: { value: 0.9 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((_, delta) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms as unknown as AtmoU;
    dampVec3(target.current, hexToVec3(state.color), 3, delta);
    u.uColor.value.copy(target.current);
    u.uIntensity.value = 0.3 + state.t01 * 0.2;
  });

  return (
    <mesh scale={1.18}>
      <sphereGeometry args={[1, 48, 48]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={ATMO_VERT}
        fragmentShader={ATMO_FRAG}
        uniforms={uniforms}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function InnerCore({ state, bloomRef }: { state: HarmonyState; bloomRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return;
    const t = performance.now() * 0.001;
    const pulse = 0.5 + Math.sin(t * (0.6 + state.t01 * 0.6)) * 0.08;
    const target = pulse + bloomRef.current * 0.25;
    const next = damp(meshRef.current.scale.x, target, 5, delta);
    meshRef.current.scale.setScalar(next);
    matRef.current.color.lerp(new THREE.Color(state.emissive), delta * 2);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial ref={matRef} color={state.emissive} transparent opacity={0.55} />
    </mesh>
  );
}

function useIsDarkScheme(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setIsDark(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isDark;
}

function particleColorFor(state: HarmonyState, isDark: boolean): THREE.Vector3 {
  const c = new THREE.Color(isDark ? state.emissive : state.color);
  if (!isDark) c.multiplyScalar(0.5);
  return new THREE.Vector3(c.r, c.g, c.b);
}

function ParticleField({ state, shockRef }: { state: HarmonyState; shockRef: React.MutableRefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const isDark = useIsDarkScheme();
  const colorTarget = useRef(particleColorFor(state, isDark));

  const { positions, sizes, seeds } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const seeds = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = 2 * Math.PI * Math.random();
      const r = 1.8 + Math.pow(Math.random(), 0.7) * 2.4;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = 0.04 + Math.random() * 0.09;
      seeds[i * 3] = Math.random();
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = Math.random();
    }
    return { positions, sizes, seeds };
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScatter: { value: (1 - state.t01) * 0.6 },
      uColor: { value: particleColorFor(state, isDark) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((_, delta) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms as unknown as ParticleU;
    u.uTime.value = u.uTime.value + delta;
    const targetScatter = (1 - state.t01) * 0.6 + shockRef.current * 0.5;
    u.uScatter.value = damp(u.uScatter.value, targetScatter, 4, delta);
    dampVec3(colorTarget.current, particleColorFor(state, isDark), 3, delta);
    u.uColor.value.copy(colorTarget.current);
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 3]} />
      </bufferGeometry>
      <shaderMaterial
        key={isDark ? 'dark' : 'light'}
        ref={matRef}
        vertexShader={PARTICLE_VERT}
        fragmentShader={PARTICLE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={isDark ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  );
}

function GroundGlow({ state }: { state: HarmonyState }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const target = useRef(hexToVec3(state.color));

  const uniforms = useMemo(
    () => ({
      uColor: { value: hexToVec3(state.color) },
      uIntensity: { value: 0.6 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((_, delta) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms as unknown as GlowU;
    dampVec3(target.current, hexToVec3(state.color), 3, delta);
    u.uColor.value.copy(target.current);
    u.uIntensity.value = 0.35 + state.t01 * 0.4;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.45, 0]}>
      <planeGeometry args={[5, 5]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={GLOW_VERT}
        fragmentShader={GLOW_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function PetalBurst({ petalRef, state }: { petalRef: React.MutableRefObject<number>; state: HarmonyState }) {
  const groupRef = useRef<THREE.Group>(null);
  const petals = useMemo(
    () =>
      Array.from({ length: PETAL_COUNT }, (_, i) => {
        const angle = (i / PETAL_COUNT) * Math.PI * 2;
        const lat = (Math.random() - 0.5) * 0.6;
        return {
          dir: new THREE.Vector3(Math.cos(angle), lat, Math.sin(angle)).normalize(),
        };
      }),
    [],
  );

  useFrame(() => {
    if (!groupRef.current) return;
    const v = petalRef.current;
    groupRef.current.visible = v > 0;
    if (v <= 0) return;
    const progress = 1 - v;
    for (let i = 0; i < petals.length; i++) {
      const child = groupRef.current.children[i] as THREE.Mesh | undefined;
      const petal = petals[i];
      if (!child || !petal) continue;
      const dist = 1.0 + progress * 1.4;
      child.position.copy(petal.dir).multiplyScalar(dist);
      const scale = (1 - progress) * 0.22;
      child.scale.setScalar(Math.max(0, scale));
      const mat = child.material as THREE.MeshBasicMaterial;
      mat.opacity = v;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {petals.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color={state.color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function OrbitDots({ members }: { members: MemberContribution[] }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.25;
    groupRef.current.rotation.x = Math.sin(performance.now() * 0.0003) * 0.15;
  });

  if (members.length === 0) return null;

  return (
    <group ref={groupRef}>
      {members.map((m, i) => {
        const angle = (i / members.length) * Math.PI * 2;
        const x = Math.cos(angle) * 1.45;
        const z = Math.sin(angle) * 1.45;
        const y = Math.sin(angle * 2) * 0.15;
        const memberState = harmonyState(m.score);
        return (
          <mesh key={m.id} position={[x, y, z]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color={m.color ?? memberState.color} />
          </mesh>
        );
      })}
    </group>
  );
}

function Scene({
  score,
  hasHeavyOverdue,
  bloomCount,
  pulseCount = 0,
  overdueCount = 0,
  trend = 0,
  memberContributions = [],
  shockRef,
  bloomRef,
  petalRef,
}: CoreSceneProps) {
  const prevHeavy = useRef(hasHeavyOverdue);
  const prevBloom = useRef(0);
  const prevPulse = useRef(0);
  const state = useMemo(() => harmonyState(score), [score]);

  useEffect(() => {
    if (hasHeavyOverdue && !prevHeavy.current) shockRef.current = 1;
    prevHeavy.current = hasHeavyOverdue;
  }, [hasHeavyOverdue, shockRef]);

  useEffect(() => {
    if (bloomCount > prevBloom.current) {
      bloomRef.current = 1;
      petalRef.current = 1;
    }
    prevBloom.current = bloomCount;
  }, [bloomCount, bloomRef, petalRef]);

  useEffect(() => {
    if (pulseCount > prevPulse.current) {
      bloomRef.current = Math.max(bloomRef.current, 0.55);
    }
    prevPulse.current = pulseCount;
  }, [pulseCount, bloomRef]);

  useFrame((_, delta) => {
    if (petalRef.current > 0) petalRef.current = Math.max(0, petalRef.current - delta / 1.4);
  });

  const scarTarget = Math.min(1, overdueCount / 5) * (hasHeavyOverdue ? 1 : 0.65);

  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#f1ead8', '#1b1b22', 0.6]} />
      <pointLight position={[4, 4, 4]} intensity={1.1} color="#fff3e0" />
      <pointLight position={[-4, -2, -4]} intensity={0.45} color="#9fb7d6" />

      <CoreSphere state={state} shockRef={shockRef} bloomRef={bloomRef} scarTarget={scarTarget} trend={trend} />
      <ParticleField state={state} shockRef={shockRef} />
      <OrbitDots members={memberContributions} />
      <PetalBurst petalRef={petalRef} state={state} />
    </>
  );
}

export function EnergyCore({
  score,
  hasHeavyOverdue,
  bloomCount,
  pulseCount = 0,
  overdueCount = 0,
  trend = 0,
  memberContributions = [],
}: EnergyCoreProps) {
  const shockRef = useRef(0);
  const bloomRef = useRef(0);
  const petalRef = useRef(0);
  const band = harmonyBand(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="-mx-4 h-72 w-[calc(100%+2rem)] max-w-none sm:mx-0 sm:h-64 sm:w-full sm:max-w-sm">
        <Canvas
          camera={{ position: [0, 0.2, 4.2], fov: 42 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor(0x000000, 0);
            scene.background = null;
          }}
        >
          <Suspense fallback={null}>
            <Scene
              score={score}
              hasHeavyOverdue={hasHeavyOverdue}
              bloomCount={bloomCount}
              pulseCount={pulseCount}
              overdueCount={overdueCount}
              trend={trend}
              memberContributions={memberContributions}
              shockRef={shockRef}
              bloomRef={bloomRef}
              petalRef={petalRef}
            />
          </Suspense>
        </Canvas>
      </div>
      <p
        className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]"
        aria-live="polite"
      >
        {band.mood}
        {trend !== 0 && (
          <span
            className={`ml-2 ${trend > 0 ? 'text-[color:var(--color-state-ok,#6f9072)]' : 'text-[color:var(--color-state-overdue)]'}`}
            aria-label={trend > 0 ? 'trending up' : 'trending down'}
          >
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}
          </span>
        )}
        {hasHeavyOverdue && (
          <span className="ml-2 text-[color:var(--color-state-overdue)]">heavy overdue</span>
        )}
      </p>
    </div>
  );
}
