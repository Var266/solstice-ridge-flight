// Effects: one pooled particle system for touchdown dust, engine smoke,
// crash fire and ring bursts, plus wingtip vapour when the wing is working.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32 } from './terrain.js';

const MAX = 900;

export function createEffects(scene) {
  const rand = mulberry32(5150);
  const positions = new Float32Array(MAX * 3);
  const colours = new Float32Array(MAX * 3);
  const sizes = new Float32Array(MAX);
  const particles = [];
  for (let i = 0; i < MAX; i += 1) {
    particles.push({ life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grow: 0, drag: 0, gravity: 0, r: 1, g: 1, b: 1, size: 1 });
    positions[i * 3 + 1] = -500;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const material = new THREE.PointsMaterial({
    size: 3.2, vertexColors: true, transparent: true, opacity: 0.85,
    depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = 'particles';
  scene.add(points);
  let cursor = 0;

  function spawn(x, y, z, opts) {
    const p = particles[cursor];
    const i = cursor;
    cursor = (cursor + 1) % MAX;
    p.life = p.maxLife = opts.life;
    p.vx = opts.vx; p.vy = opts.vy; p.vz = opts.vz;
    p.grow = opts.grow ?? 0;
    p.drag = opts.drag ?? 0.4;
    p.gravity = opts.gravity ?? 0;
    p.r = opts.r; p.g = opts.g; p.b = opts.b;
    p.size = opts.size;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    colours[i * 3] = opts.r;
    colours[i * 3 + 1] = opts.g;
    colours[i * 3 + 2] = opts.b;
    sizes[i] = opts.size;
  }

  const spread = (v) => (rand() - 0.5) * 2 * v;

  return {
    touchdownDust(pos, strength) {
      const n = Math.round(10 + strength * 22);
      for (let i = 0; i < n; i += 1) {
        spawn(pos.x + spread(2), pos.y + 0.3, pos.z + spread(2), {
          life: 0.7 + rand() * 0.8, vx: spread(5), vy: 1 + rand() * 2.5, vz: spread(5),
          r: 0.82, g: 0.76, b: 0.62, size: 2 + rand() * 2, grow: 3, gravity: -0.6,
        });
      }
    },
    ringBurst(pos) {
      for (let i = 0; i < 46; i += 1) {
        const a = rand() * Math.PI * 2;
        const speed = 6 + rand() * 13;
        spawn(pos.x, pos.y, pos.z, {
          life: 0.55 + rand() * 0.5, vx: Math.cos(a) * speed, vy: spread(7), vz: Math.sin(a) * speed,
          r: 1, g: 0.78, b: 0.3, size: 1.6 + rand() * 1.4, gravity: -3,
        });
      }
    },
    crashFire(pos) {
      for (let i = 0; i < 90; i += 1) {
        const fire = rand() > 0.45;
        spawn(pos.x + spread(2.4), pos.y + rand() * 1.4, pos.z + spread(2.4), {
          life: 0.7 + rand() * 1.6, vx: spread(6), vy: 2 + rand() * 6, vz: spread(6),
          r: fire ? 1 : 0.25, g: fire ? 0.5 + rand() * 0.3 : 0.24, b: fire ? 0.12 : 0.24,
          size: 2.4 + rand() * 2.6, grow: 2.2, gravity: fire ? 1.6 : 0.8,
        });
      }
    },
    smokePuff(pos, dark) {
      spawn(pos.x, pos.y, pos.z, {
        life: 0.9 + rand() * 0.7, vx: spread(0.7), vy: 0.8, vz: spread(0.7),
        r: dark ? 0.2 : 0.75, g: dark ? 0.2 : 0.74, b: dark ? 0.2 : 0.72,
        size: 1.1, grow: 2.6, gravity: 0.5,
      });
    },
    wingtipVapour(pos) {
      spawn(pos.x, pos.y, pos.z, {
        life: 0.5 + rand() * 0.4, vx: spread(0.4), vy: spread(0.4), vz: spread(0.4),
        r: 0.96, g: 0.97, b: 1, size: 0.9, grow: 1.8,
      });
    },
    update(dt) {
      for (let i = 0; i < MAX; i += 1) {
        const p = particles[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) {
          positions[i * 3 + 1] = -500;
          continue;
        }
        const dragK = Math.max(0, 1 - p.drag * dt);
        p.vx *= dragK; p.vz *= dragK;
        p.vy = p.vy * dragK + p.gravity * dt;
        positions[i * 3] += p.vx * dt;
        positions[i * 3 + 1] += p.vy * dt;
        positions[i * 3 + 2] += p.vz * dt;
        sizes[i] += p.grow * dt;
        const fade = Math.min(1, p.life / (p.maxLife * 0.55));
        colours[i * 3] = p.r * fade;
        colours[i * 3 + 1] = p.g * fade;
        colours[i * 3 + 2] = p.b * fade;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    },
  };
}
