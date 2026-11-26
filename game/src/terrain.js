// Terrain: one seeded heightfield drives both the mesh and the ground the
// aeroplane collides with, so what you see is exactly what you can hit.
import * as THREE from '../vendor/three.module.min.js';
import { COLOURS, RUNWAY, WORLD } from './config.js';

/** Small deterministic PRNG (mulberry32) so every visit sees the same island. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(WORLD.seed);
const LATTICE = 64;
const lattice = new Float32Array(LATTICE * LATTICE);
for (let i = 0; i < lattice.length; i += 1) lattice[i] = rand();

function latticeAt(ix, iz) {
  const x = ((ix % LATTICE) + LATTICE) % LATTICE;
  const z = ((iz % LATTICE) + LATTICE) % LATTICE;
  return lattice[z * LATTICE + x];
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0,1] at world scale `scale` metres per lattice cell. */
function noise(x, z, scale) {
  const fx = x / scale;
  const fz = z / scale;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = smooth(fx - ix);
  const tz = smooth(fz - iz);
  const a = latticeAt(ix, iz);
  const b = latticeAt(ix + 1, iz);
  const c = latticeAt(ix, iz + 1);
  const d = latticeAt(ix + 1, iz + 1);
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}

function fbm(x, z) {
  let sum = 0;
  let amp = 0.55;
  let scale = 1500;
  for (let octave = 0; octave < 5; octave += 1) {
    sum += amp * noise(x, z, scale);
    amp *= 0.5;
    scale *= 0.46;
  }
  return sum; // roughly [0, 1.05]
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Distance from a point to the runway rectangle (0 when inside). The
 * rectangle runs well past both thresholds so the approach and departure
 * corridors stay clear of the hills. */
function runwayDistance(x, z) {
  const dx = Math.max(Math.abs(x - RUNWAY.x) - RUNWAY.width * 1.7, 0);
  const dz = Math.max(Math.abs(z - RUNWAY.z) - RUNWAY.length * 0.95, 0);
  return Math.hypot(dx, dz);
}

/**
 * Ground height in metres at (x, z). A radial island falloff drops the edges
 * under the sea; a smooth blend flattens the airfield plateau.
 */
export function heightAt(x, z) {
  const half = WORLD.size / 2;
  const r = Math.hypot(x, z) / half;
  const island = clamp01(1.25 - r * r * 1.15);
  let h = Math.pow(fbm(x, z), 1.6) * WORLD.maxHeight * island - 14;
  // A ridge spine running north-west to south-east gives the island its name.
  const ridge = Math.exp(-Math.pow((x * 0.62 + z * 0.78) / 520, 2)) * 150 * island;
  h += ridge * (0.55 + 0.45 * noise(x, z, 700));
  const d = runwayDistance(x, z);
  const blend = clamp01(d / 520);
  // Dead flat inside the airfield rectangle so the paved strip sits clean;
  // a whisper of noise returns with distance from it.
  const flat = RUNWAY.elevation + 2.5 * noise(x, z, 260) * clamp01(d / 140);
  return flat + (h - flat) * (blend * blend * (3 - 2 * blend));
}

/** True when (x, z) is on the paved strip itself. */
export function onRunway(x, z) {
  return Math.abs(x - RUNWAY.x) <= RUNWAY.width / 2 && Math.abs(z - RUNWAY.z) <= RUNWAY.length / 2;
}

/** Ground slope (rise over run) at a point, from finite differences. */
export function slopeAt(x, z) {
  const e = 6;
  const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
}

const C_SAND = new THREE.Color(COLOURS.sand);
const C_GRASS = new THREE.Color(COLOURS.grass);
const C_FOREST = new THREE.Color(COLOURS.forest);
const C_ROCK = new THREE.Color(COLOURS.rock);
const C_SNOW = new THREE.Color(COLOURS.snow);
const C_SEABED = new THREE.Color(0x8fae9a);

function colourFor(h, slope, x, z, out) {
  if (h < 1.5) out.copy(C_SEABED);
  else if (h < 7) out.copy(C_SAND);
  else if (h < 130) out.copy(C_GRASS).lerp(C_FOREST, clamp01((h - 40) / 90));
  else if (h < 300) out.copy(C_FOREST).lerp(C_ROCK, clamp01((h - 130) / 170));
  else out.copy(C_ROCK).lerp(C_SNOW, clamp01((h - 300) / 90));
  if (slope > 0.55 && h > 6) out.lerp(C_ROCK, clamp01((slope - 0.55) * 1.6));
  const jitter = 0.94 + 0.12 * noise(x * 3.1, z * 3.1, 90);
  out.multiplyScalar(jitter);
  return out;
}

/** The island mesh: flat-shaded, vertex-coloured, one draw call. */
export function buildTerrain() {
  const grid = WORLD.grid;
  const half = WORLD.size / 2;
  const step = WORLD.size / grid;
  const positions = new Float32Array((grid + 1) * (grid + 1) * 3);
  const colours = new Float32Array((grid + 1) * (grid + 1) * 3);
  const heights = new Float32Array((grid + 1) * (grid + 1));
  const colour = new THREE.Color();
  let p = 0;
  for (let iz = 0; iz <= grid; iz += 1) {
    for (let ix = 0; ix <= grid; ix += 1) {
      const x = -half + ix * step;
      const z = -half + iz * step;
      const h = heightAt(x, z);
      heights[iz * (grid + 1) + ix] = h;
      positions[p] = x;
      positions[p + 1] = h;
      positions[p + 2] = z;
      p += 3;
    }
  }
  p = 0;
  for (let iz = 0; iz <= grid; iz += 1) {
    for (let ix = 0; ix <= grid; ix += 1) {
      const x = -half + ix * step;
      const z = -half + iz * step;
      const h = heights[iz * (grid + 1) + ix];
      const hx = heights[iz * (grid + 1) + Math.min(ix + 1, grid)] - heights[iz * (grid + 1) + Math.max(ix - 1, 0)];
      const hz = heights[Math.min(iz + 1, grid) * (grid + 1) + ix] - heights[Math.max(iz - 1, 0) * (grid + 1) + ix];
      const slope = Math.hypot(hx, hz) / (2 * step);
      colourFor(h, slope, x, z, colour);
      colours[p] = colour.r;
      colours[p + 1] = colour.g;
      colours[p + 2] = colour.b;
      p += 3;
    }
  }
  const indices = new Uint32Array(grid * grid * 6);
  let q = 0;
  for (let iz = 0; iz < grid; iz += 1) {
    for (let ix = 0; ix < grid; ix += 1) {
      const a = iz * (grid + 1) + ix;
      const b = a + 1;
      const c = a + grid + 1;
      const d = c + 1;
      indices[q] = a; indices[q + 1] = c; indices[q + 2] = b;
      indices[q + 3] = b; indices[q + 4] = c; indices[q + 5] = d;
      q += 6;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  return mesh;
}
