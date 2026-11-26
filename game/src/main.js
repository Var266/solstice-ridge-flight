// Solstice Ridge: golden-hour flying over one stubborn island.
// This file wires the world together: renderer, screens, the fixed-step
// flight loop, effects and sound triggers, and the screenshot mode.
import * as THREE from '../vendor/three.module.min.js';
import { animateAircraft, buildAircraft } from './aircraft.js';
import { createAudio } from './audio.js';
import { createCameraRig, VIEW_COCKPIT, VIEW_ORBIT } from './camera.js';
import { RUNWAY } from './config.js';
import { createEffects } from './effects.js';
import { EVENT_CRASH, EVENT_LIFTOFF, EVENT_STALL, EVENT_TOUCHDOWN, newFlightState, stepFlight } from './flight.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createMission, MISSION_FREE, MISSION_LANDING, MISSION_MAIL, MISSION_RINGS } from './missions.js';
import { stageShot } from './shots.js';
import { buildTerrain } from './terrain.js';
import { buildWorld } from './world.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 12000);

scene.add(buildTerrain());
const world = buildWorld(scene);
const aircraft = buildAircraft();
scene.add(aircraft.group);
const effects = createEffects(scene);
const audio = createAudio();
const hud = createHud();
const input = createInput(canvas);
const rig = createCameraRig(camera);
const state = newFlightState();

let screen = 'title';
let mission = createMission(MISSION_FREE, world);
let missionKind = MISSION_FREE;
let endTimer = -1;
let stallBeepAt = 0;
let smokeAt = 0;
let elapsed = 0;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function showScreen(name) {
  screen = name;
  document.getElementById('title-screen').classList.toggle('hidden', name !== 'title');
  document.getElementById('pause-screen').classList.toggle('hidden', name !== 'paused');
  document.getElementById('end-screen').classList.toggle('hidden', name !== 'ended');
  if (name === 'playing' || name === 'paused' || name === 'ended') hud.show();
  else hud.hide();
}

function startMission(kind) {
  missionKind = kind;
  mission = createMission(kind, world);
  mission.start(state);
  aircraft.group.position.copy(state.position);
  aircraft.group.quaternion.copy(state.quaternion);
  rig.view = 0;
  rig.snapTo(state);
  endTimer = -1;
  audio.start();
  showScreen('playing');
  document.getElementById('status').textContent = `${mission.name}: ${mission.objective}`;
}

document.querySelectorAll('.mission-card').forEach((card) => {
  card.addEventListener('click', () => startMission(card.dataset.mission));
});

const MISSION_KEYS = { 1: MISSION_RINGS, 2: MISSION_LANDING, 3: MISSION_MAIL, 4: MISSION_FREE };

const wingtip = new THREE.Vector3();
function emitFlightEffects(dt) {
  if (state.damage > 0.25 && !state.onGround) {
    smokeAt -= dt;
    if (smokeAt <= 0) {
      smokeAt = 0.05;
      wingtip.set(0, 0.2, -3.4).applyQuaternion(state.quaternion).add(state.position);
      effects.smokePuff(wingtip, state.damage > 0.6);
    }
  }
  const bank = Math.abs(Math.asin(THREE.MathUtils.clamp(new THREE.Vector3(1, 0, 0).applyQuaternion(state.quaternion).y, -1, 1)));
  if (!state.onGround && bank > 0.62 && state.speed > 34) {
    for (const side of [-5.2, 5.2]) {
      wingtip.set(side, 0.9, -0.7).applyQuaternion(state.quaternion).add(state.position);
      effects.wingtipVapour(wingtip);
    }
  }
}

function stepSimulation(dt, controls) {
  const events = stepFlight(state, controls, dt);
  effects.update(dt);
  const missionEvent = mission.update(state, dt, events);
  if (events & EVENT_TOUCHDOWN) {
    effects.touchdownDust(state.position, Math.min(1, Math.abs(state.verticalSpeed) / 4));
    audio.touchdown(Math.abs(state.verticalSpeed) > 2.6);
    if (state.touchdown?.onRunway && missionKind !== MISSION_LANDING) hud.banner('TOUCHDOWN');
  }
  if (events & EVENT_CRASH) {
    effects.crashFire(state.position);
    audio.crash();
    hud.banner('CRASHED', 3);
  }
  if (events & EVENT_LIFTOFF) hud.banner('AIRBORNE', 1.4);
  if ((events & EVENT_STALL) && elapsed > stallBeepAt) {
    stallBeepAt = elapsed + 0.55;
    audio.stallBeep();
  }
  if (missionEvent === 'ring') {
    const ring = world.rings[Math.max(0, mission.ringIndex - 1)];
    if (ring) effects.ringBurst(ring.centre);
    audio.ring();
    hud.banner(`RING ${mission.ringIndex} OF 8`);
  } else if (missionEvent === 'pickup') {
    effects.ringBurst(world.harbour.centre);
    audio.pickup();
    hud.banner('MAIL ABOARD');
  } else if (missionEvent === 'deliver') {
    effects.ringBurst(world.ridge.centre);
    audio.pickup();
    hud.banner('DELIVERED');
  } else if (missionEvent === 'complete') {
    audio.complete();
    endTimer = 1.6;
  } else if (missionEvent === 'fail') {
    endTimer = 2.2;
  }
  emitFlightEffects(dt);
  return events;
}

function syncAircraft(dt) {
  aircraft.group.position.copy(state.position);
  aircraft.group.quaternion.copy(state.quaternion);
  aircraft.cockpit.visible = rig.view === VIEW_COCKPIT;
  animateAircraft(aircraft, state, elapsed);
  // The shadow camera rides along so the island keeps its long shadows.
  world.sun.position.copy(state.position).add(new THREE.Vector3(-420, 300, 260));
  world.sun.target.position.copy(state.position);
  world.sun.target.updateMatrixWorld();
  // Pulse the next ring; spin the beacon rings.
  world.rings.forEach((ring, index) => {
    const active = index === mission.ringIndex && (missionKind === MISSION_RINGS || missionKind === MISSION_FREE);
    const s = active ? 1 + Math.sin(elapsed * 3.2) * 0.06 : 1;
    ring.mesh.scale.setScalar(s);
  });
  world.harbour.ring.rotation.z += dt * 0.7;
  world.ridge.ring.rotation.z -= dt * 0.7;
}

function finishMission() {
  const title = document.getElementById('end-title');
  const detail = document.getElementById('end-detail');
  const score = document.getElementById('end-score');
  title.textContent = mission.done ? 'MISSION COMPLETE' : 'MISSION FAILED';
  detail.textContent = mission.detail;
  score.textContent = `SCORE ${mission.score}`;
  showScreen('ended');
}

// Screenshot mode: stage one scene, render it, and tell the capture script.
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  mission = createMission(MISSION_FREE, world);
  missionKind = MISSION_FREE;
  const api = {
    state, mission, rig, hud,
    step: (dt, controls) => { elapsed += dt; stepSimulation(dt, controls); },
  };
  stageShot(shotName, api);
  syncAircraft(0);
  rig.snapTo(state);
  rig.update(state, 1 / 60, elapsed);
  hud.show();
  hud.update(state, mission, 0);
  showScreen('playing');
  document.getElementById('title-screen').classList.add('hidden');
  renderer.render(scene, camera);
  window.__shotReady = true;
  window.__game = { state, mission, renderer, scene, camera };
} else {
  // Title screen: the Kestrel parked on the apron, camera in a slow orbit.
  mission.start(state);
  state.position.set(150, RUNWAY.elevation + 1.15, RUNWAY.z + 60);
  state.quaternion.setFromEuler(new THREE.Euler(0, 0.7, 0));
  rig.view = VIEW_ORBIT;
  showScreen('title');

  let last = performance.now();
  let accumulator = 0;
  const SUBSTEP = 1 / 120;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    const controls = input.poll();

    if (screen === 'title') {
      if (controls.missionPick) startMission(MISSION_KEYS[controls.missionPick]);
      rig.update(state, dt, elapsed);
      syncAircraft(dt);
      effects.update(dt);
      renderer.render(scene, camera);
      return;
    }

    if (controls.toMenu) {
      showScreen('title');
      rig.view = VIEW_ORBIT;
      mission.start(state);
      state.position.set(150, RUNWAY.elevation + 1.15, RUNWAY.z + 60);
      state.quaternion.setFromEuler(new THREE.Euler(0, 0.7, 0));
      return;
    }
    if (controls.restart) startMission(missionKind);
    if (controls.togglePause && (screen === 'playing' || screen === 'paused')) {
      showScreen(screen === 'playing' ? 'paused' : 'playing');
    }
    if (controls.toggleCamera && screen === 'playing') rig.cycle();

    if (screen === 'playing') {
      accumulator += dt;
      while (accumulator >= SUBSTEP) {
        stepSimulation(SUBSTEP, controls);
        accumulator -= SUBSTEP;
      }
      if (endTimer > 0) {
        endTimer -= dt;
        if (endTimer <= 0) finishMission();
      }
    }

    rig.update(state, dt, elapsed);
    syncAircraft(dt);
    hud.update(state, mission, dt);
    audio.update(state);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  window.__game = { state, mission, renderer, scene, camera, startMission };
}
