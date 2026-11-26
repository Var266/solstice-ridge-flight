// Missions: three sorties with different goals over the same island, plus
// free flight. Each mission owns its start pose, its objective line, its
// progress checks and its score.
import * as THREE from '../vendor/three.module.min.js';
import { RUNWAY } from './config.js';
import { placeAirborne } from './flight.js';
import { HARBOUR_GATE, RIDGE_GATE } from './world.js';

export const MISSION_FREE = 'free';
export const MISSION_RINGS = 'rings';
export const MISSION_LANDING = 'landing';
export const MISSION_MAIL = 'mail';

const tmpVec = new THREE.Vector3();

function crossedRing(state, ring, previousSide) {
  tmpVec.copy(state.position).sub(ring.centre);
  const side = Math.sign(tmpVec.dot(ring.normal));
  const radial = tmpVec.clone().addScaledVector(ring.normal, -tmpVec.dot(ring.normal)).length();
  const through = previousSide !== 0 && side !== 0 && side !== previousSide && radial < 17;
  return { through, side };
}

function nearGate(state, gate, radius) {
  return state.position.distanceTo(gate.centre) < radius;
}

export function createMission(kind, world) {
  const mission = {
    kind,
    name: 'FREE FLIGHT',
    objective: 'Take off and explore the ridge.',
    score: 0,
    time: 0,
    done: false,
    failed: false,
    detail: '',
    ringIndex: 0,
    ringSide: 0,
    carrying: false,
    delivered: false,
    tookOff: false,

    start(state) {
      mission.score = 0;
      mission.time = 0;
      mission.done = false;
      mission.failed = false;
      mission.ringIndex = 0;
      mission.ringSide = 0;
      mission.carrying = false;
      mission.delivered = false;
      mission.tookOff = false;
      state.fuel = kind === MISSION_MAIL ? 0.62 : 1;
      state.damage = 0;
      state.engineOn = true;
      state.flaps = false;
      if (kind === MISSION_RINGS) {
        mission.name = 'RING RUNNER';
        mission.objective = 'Fly through ring 1 of 8 — follow the green ring.';
        placeAirborne(state, 0, 170, 60, 0, 46, 0.7);
      } else if (kind === MISSION_LANDING) {
        mission.name = 'SHORT FINAL';
        mission.objective = 'Land on runway 27: soft, centred, and stop on the strip.';
        placeAirborne(state, -60, 260, 2400, 0, 34, 0.35);
        state.flaps = true;
      } else if (kind === MISSION_MAIL) {
        mission.name = 'MAIL RUN';
        mission.objective = 'Take off, snatch the mail at the blue harbour gate, deliver it to the amber ridge gate, then land.';
        state.position.set(RUNWAY.x, RUNWAY.elevation + 1.15, RUNWAY.z + 380);
        state.quaternion.identity();
        state.speed = 0;
        state.throttle = 0;
        state.onGround = true;
        state.gearDown = true;
        state.gearAmount = 1;
      } else {
        mission.name = 'FREE FLIGHT';
        mission.objective = 'Take off and explore the ridge. Rings and gates are open.';
        state.position.set(RUNWAY.x, RUNWAY.elevation + 1.15, RUNWAY.z + 380);
        state.quaternion.identity();
        state.speed = 0;
        state.throttle = 0;
        state.onGround = true;
        state.gearDown = true;
        state.gearAmount = 1;
      }
      mission.paintRings();
    },

    paintRings() {
      world.rings.forEach((ring, index) => {
        if (kind !== MISSION_RINGS && kind !== MISSION_FREE) {
          ring.material.color.set(0x8a5a2e);
          ring.material.emissive.set(0x8a5a2e);
          ring.material.emissiveIntensity = 0.25;
          return;
        }
        if (index === mission.ringIndex && !mission.done) {
          ring.material.color.set(0x51ff8a);
          ring.material.emissive.set(0x51ff8a);
          ring.material.emissiveIntensity = 1.5;
        } else if (index < mission.ringIndex) {
          ring.material.color.set(0x3a6ea5);
          ring.material.emissive.set(0x3a6ea5);
          ring.material.emissiveIntensity = 0.3;
        } else {
          ring.material.color.set(0xff9a3d);
          ring.material.emissive.set(0xff9a3d);
          ring.material.emissiveIntensity = 0.55;
        }
      });
    },

    /** Returns 'ring' | 'pickup' | 'deliver' | 'complete' | 'fail' | null for sound/effects. */
    update(state, dt, events) {
      if (mission.done || mission.failed) return null;
      mission.time += dt;
      if (!state.onGround) mission.tookOff = true;

      if (state.damage >= 1) {
        mission.failed = true;
        mission.detail = 'The Kestrel is wrecked. The island keeps it.';
        return 'fail';
      }

      if (kind === MISSION_RINGS || kind === MISSION_FREE) {
        const ring = world.rings[mission.ringIndex];
        if (ring) {
          const { through, side } = crossedRing(state, ring, mission.ringSide);
          mission.ringSide = side;
          if (through) {
            mission.score += 1000;
            mission.ringIndex += 1;
            mission.ringSide = 0;
            mission.paintRings();
            if (mission.ringIndex >= world.rings.length) {
              if (kind === MISSION_RINGS) {
                mission.done = true;
                mission.score = Math.max(0, mission.score - Math.round(mission.time) * 10);
                mission.detail = `All 8 rings in ${mission.time.toFixed(1)} s. The ridge approves.`;
                return 'complete';
              }
              mission.ringIndex = 0;
              mission.paintRings();
            } else if (kind === MISSION_RINGS) {
              mission.objective = `Fly through ring ${mission.ringIndex + 1} of 8 — follow the green ring.`;
            }
            return 'ring';
          }
        }
      }

      if (kind === MISSION_MAIL) {
        if (!mission.carrying && nearGate(state, world.harbour, 26)) {
          mission.carrying = true;
          mission.score += 1500;
          mission.objective = 'Mail aboard. Deliver it through the amber ridge gate.';
          return 'pickup';
        }
        if (mission.carrying && !mission.delivered && nearGate(state, world.ridge, 26)) {
          mission.delivered = true;
          mission.score += 2500;
          mission.objective = 'Delivered. Bring her home and land on the strip.';
          return 'deliver';
        }
        if (mission.delivered && state.onGround && state.touchdown?.onRunway && state.speed < 2) {
          mission.done = true;
          mission.score += 1000 + Math.round(state.fuel * 1000);
          mission.detail = 'Mail delivered and the Kestrel is home. Fuel to spare counts.';
          return 'complete';
        }
      }

      if (kind === MISSION_LANDING && state.onGround && state.touchdown && state.speed < 2) {
        const td = state.touchdown;
        if (td.onRunway) {
          const softness = Math.max(0, 1 - Math.abs(td.verticalSpeed) / 4.2);
          const centred = Math.max(0, 1 - td.centreline / 23);
          mission.score = Math.round(2000 * softness + 1500 * centred);
          mission.done = true;
          mission.detail = `Touchdown at ${Math.abs(td.verticalSpeed).toFixed(1)} m/s, ${td.centreline.toFixed(0)} m off centre.`;
          return 'complete';
        }
        mission.failed = true;
        mission.detail = 'Down, but not on the strip. The tower is unimpressed.';
        return 'fail';
      }

      return null;
    },
  };
  return mission;
}

export { HARBOUR_GATE, RIDGE_GATE };
