// World dressing: gradient sky and sun, sea, clouds, the airfield (runway
// with painted markings, edge lights, hangars, windsock), instanced pines,
// the ring course and the two mail beacons.
import * as THREE from '../vendor/three.module.min.js';
import { COLOURS, RUNWAY, SUN, WORLD } from './config.js';
import { heightAt, mulberry32 } from './terrain.js';

export const RING_COURSE = [
  { x: 0, y: 150, z: -900 },
  { x: -700, y: 220, z: -1500 },
  { x: -1500, y: 320, z: -900 },
  { x: -1700, y: 260, z: 200 },
  { x: -900, y: 190, z: 1100 },
  { x: 200, y: 240, z: 1700 },
  { x: 1300, y: 300, z: 1100 },
  { x: 1500, y: 200, z: -200 },
];

export const HARBOUR_GATE = { x: 1750, y: 70, z: 1500 };
export const RIDGE_GATE = { x: -1250, y: 430, z: -1250 };

function skyDome() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(COLOURS.skyZenith) },
      horizon: { value: new THREE.Color(COLOURS.skyHorizon) },
      sunDir: { value: sunDirection() },
      sunColour: { value: new THREE.Color(COLOURS.sun) },
    },
    vertexShader: [
      'varying vec3 vDir;',
      'void main() {',
      '  vDir = normalize(position);',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  gl_Position = projectionMatrix * mv;',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColour;',
      'varying vec3 vDir;',
      'void main() {',
      '  float h = clamp(vDir.y, -0.08, 1.0);',
      '  vec3 sky = mix(horizon, top, pow(max(h, 0.0), 0.55));',
      '  float sunAmount = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 220.0);',
      '  float glow = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 6.0);',
      '  sky += sunColour * (sunAmount * 1.6 + glow * 0.32);',
      '  gl_FragColor = vec4(sky, 1.0);',
      '}',
    ].join('\n'),
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(8800, 32, 18), material);
  dome.name = 'sky';
  return dome;
}

export function sunDirection() {
  return new THREE.Vector3(
    Math.cos(SUN.elevation) * Math.sin(SUN.azimuth),
    Math.sin(SUN.elevation),
    Math.cos(SUN.elevation) * Math.cos(SUN.azimuth),
  );
}

function cloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(777);
  for (let i = 0; i < 26; i += 1) {
    const x = 40 + rand() * 176;
    const y = 44 + rand() * 44;
    const r = 16 + rand() * 30;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, 'rgba(255,244,230,0.55)');
    gradient.addColorStop(1, 'rgba(255,244,230,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildClouds() {
  const group = new THREE.Group();
  const texture = cloudTexture();
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.9 });
  const rand = mulberry32(4242);
  for (let i = 0; i < 52; i += 1) {
    const sprite = new THREE.Sprite(material);
    const angle = rand() * Math.PI * 2;
    const radius = 600 + rand() * 2400;
    sprite.position.set(Math.cos(angle) * radius, 480 + rand() * 260, Math.sin(angle) * radius);
    const w = 260 + rand() * 380;
    sprite.scale.set(w, w * 0.42, 1);
    group.add(sprite);
  }
  group.name = 'clouds';
  return group;
}

function runwayTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3c4148';
  ctx.fillRect(0, 0, 256, 2048);
  // Asphalt grain.
  const rand = mulberry32(99);
  for (let i = 0; i < 2600; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(rand() * 256, rand() * 2048, 2, 2);
  }
  ctx.fillStyle = '#e8e8e2';
  ctx.fillRect(10, 0, 5, 2048);
  ctx.fillRect(241, 0, 5, 2048);
  // Centreline dashes.
  for (let y = 60; y < 2048; y += 150) ctx.fillRect(124, y, 8, 80);
  // Threshold piano keys at both ends.
  for (let i = 0; i < 6; i += 1) {
    ctx.fillRect(24 + i * 38, 26, 22, 130);
    ctx.fillRect(24 + i * 38, 2048 - 156, 22, 130);
  }
  // Touchdown zone marks.
  for (const y of [330, 470, 610]) {
    ctx.fillRect(56, y, 26, 90);
    ctx.fillRect(174, y, 26, 90);
    ctx.fillRect(56, 2048 - y - 90, 26, 90);
    ctx.fillRect(174, 2048 - y - 90, 26, 90);
  }
  ctx.font = 'bold 120px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('27', 128, 300);
  ctx.save();
  ctx.translate(128, 2048 - 180);
  ctx.rotate(Math.PI);
  ctx.fillText('09', 0, 0);
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function buildAirfield() {
  const group = new THREE.Group();
  const y = RUNWAY.elevation + 0.3;

  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.width, RUNWAY.length),
    new THREE.MeshStandardMaterial({ map: runwayTexture(), roughness: 0.9 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(RUNWAY.x, y, RUNWAY.z);
  strip.receiveShadow = true;
  group.add(strip);

  // Apron and taxiway.
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 150),
    new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.95 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(150, y - 0.05, RUNWAY.z + 240);
  apron.receiveShadow = true;
  group.add(apron);

  // Edge lights down both sides.
  const lightGeo = new THREE.SphereGeometry(0.55, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd27d });
  const count = 22;
  const lights = new THREE.InstancedMesh(lightGeo, lightMat, count * 2);
  const matrix = new THREE.Matrix4();
  let li = 0;
  for (let i = 0; i < count; i += 1) {
    const z = RUNWAY.z - RUNWAY.length / 2 + (i / (count - 1)) * RUNWAY.length;
    for (const side of [-1, 1]) {
      matrix.setPosition(RUNWAY.x + side * (RUNWAY.width / 2 + 3), y + 0.5, z);
      lights.setMatrixAt(li, matrix);
      li += 1;
    }
  }
  group.add(lights);

  // PAPI-style approach lights: two white, two red.
  for (let i = 0; i < 4; i += 1) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.1, 1.1),
      new THREE.MeshBasicMaterial({ color: i < 2 ? 0xffffff : 0xff4444 }),
    );
    box.position.set(RUNWAY.x - RUNWAY.width / 2 - 14, y + 0.8, RUNWAY.z - RUNWAY.length / 2 + 130 + i * 9);
    group.add(box);
  }

  // Hangars and a small tower on the apron.
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0x7d8894, roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb0533a, roughness: 0.8 });
  for (const [hx, hz] of [[120, 190], [190, 290]]) {
    const hangar = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(34, 9, 26), hangarMat);
    walls.position.y = 4.5;
    walls.castShadow = true;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 13.5, 34, 12, 1, false, 0, Math.PI), roofMat);
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.y = 9;
    roof.castShadow = true;
    hangar.add(walls, roof);
    hangar.position.set(hx, y, RUNWAY.z + hz - 240);
    group.add(hangar);
  }
  const tower = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(6, 17, 6), hangarMat);
  shaft.position.y = 8.5;
  shaft.castShadow = true;
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(9, 3.4, 9),
    new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.15, metalness: 0.4 }),
  );
  cab.position.y = 18.5;
  tower.add(shaft, cab);
  tower.position.set(215, y, RUNWAY.z + 60);
  group.add(tower);

  // Windsock.
  const sockGroup = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7, 8), hangarMat);
  pole.position.y = 3.5;
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(0.65, 3.4, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xff7b2e, side: THREE.DoubleSide }),
  );
  sock.rotation.z = Math.PI / 2 - 0.18;
  sock.position.set(1.7, 6.7, 0);
  sockGroup.add(pole, sock);
  sockGroup.position.set(-70, y, RUNWAY.z + 420);
  group.add(sockGroup);

  group.name = 'airfield';
  return group;
}

function buildTrees() {
  const rand = mulberry32(31337);
  const spots = [];
  let guard = 0;
  while (spots.length < 650 && guard < 9000) {
    guard += 1;
    const x = (rand() - 0.5) * (WORLD.size - 500);
    const z = (rand() - 0.5) * (WORLD.size - 500);
    const h = heightAt(x, z);
    if (h < 6 || h > 240) continue;
    if (Math.abs(x - RUNWAY.x) < 190 && Math.abs(z - RUNWAY.z) < RUNWAY.length * 0.75) continue;
    spots.push({ x, z, h, s: 0.7 + rand() * 0.9, rot: rand() * Math.PI * 2 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3.4, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4630, roughness: 1 });
  const canopyGeo = new THREE.ConeGeometry(2.6, 8.5, 7);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f6b33, roughness: 1, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  spots.forEach((spot, i) => {
    euler.set(0, spot.rot, 0);
    quat.setFromEuler(euler);
    scale.setScalar(spot.s);
    pos.set(spot.x, spot.h + 1.7 * spot.s, spot.z);
    matrix.compose(pos, quat, scale);
    trunks.setMatrixAt(i, matrix);
    pos.set(spot.x, spot.h + (3.4 + 4.2) * spot.s, spot.z);
    matrix.compose(pos, quat, scale);
    canopies.setMatrixAt(i, matrix);
  });
  trunks.name = 'tree-trunks';
  canopies.name = 'tree-canopies';
  canopies.castShadow = true;
  const group = new THREE.Group();
  group.add(trunks, canopies);
  return group;
}

function buildRings() {
  const group = new THREE.Group();
  const geometry = new THREE.TorusGeometry(17, 1.1, 10, 36);
  const rings = RING_COURSE.map((spot, index) => {
    const material = new THREE.MeshStandardMaterial({
      color: COLOURS.ringTodo, emissive: COLOURS.ringTodo, emissiveIntensity: 0.55, roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(spot.x, spot.y, spot.z);
    const next = RING_COURSE[(index + 1) % RING_COURSE.length];
    mesh.lookAt(next.x, next.y, next.z);
    mesh.name = `ring-${index + 1}`;
    group.add(mesh);
    return { mesh, material, centre: new THREE.Vector3(spot.x, spot.y, spot.z), normal: new THREE.Vector3() };
  });
  for (const ring of rings) ring.mesh.getWorldDirection(ring.normal);
  group.name = 'ring-course';
  return { group, rings };
}

function buildBeacon(gate, colour, name) {
  const group = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 260, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.set(gate.x, gate.y + 60, gate.z);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(13, 0.9, 10, 32),
    new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.8 }),
  );
  ring.position.set(gate.x, gate.y, gate.z);
  ring.rotation.x = Math.PI / 2.6;
  group.add(pillar, ring);
  group.name = name;
  return { group, ring, centre: new THREE.Vector3(gate.x, gate.y, gate.z) };
}

/** Assemble everything that is not the aeroplane. */
export function buildWorld(scene) {
  scene.fog = new THREE.Fog(COLOURS.fog, 1400, 8200);
  scene.add(skyDome());

  const sun = new THREE.DirectionalLight(COLOURS.sun, 3.1);
  sun.position.copy(sunDirection()).multiplyScalar(900);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.near = 100;
  sun.shadow.camera.far = 2200;
  scene.add(sun);
  scene.add(sun.target);
  const sky = new THREE.HemisphereLight(0xbcd7ff, 0x8a6b4a, 0.85);
  scene.add(sky);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(16000, 16000),
    new THREE.MeshStandardMaterial({ color: COLOURS.water, roughness: 0.32, metalness: 0.25, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 1.6;
  sea.name = 'sea';
  scene.add(sea);

  scene.add(buildClouds());
  scene.add(buildAirfield());
  scene.add(buildTrees());
  const { group: ringGroup, rings } = buildRings();
  scene.add(ringGroup);
  const harbour = buildBeacon(HARBOUR_GATE, 0x37c8ff, 'harbour-gate');
  const ridge = buildBeacon(RIDGE_GATE, 0xffb03a, 'ridge-gate');
  scene.add(harbour.group, ridge.group);

  return { sun, rings, harbour, ridge };
}
