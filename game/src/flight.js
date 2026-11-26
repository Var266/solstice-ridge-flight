// Flight model: an honest arcade model. Speed is earned with throttle and
// spent in climbs and turns; lift fades below the stall speed, which rises
// with bank angle, so turns ask for throttle discipline. Fuel burns, gear
// and flaps trade drag for control, and the ground keeps score.
import * as THREE from '../vendor/three.module.min.js';
import { PLANE, RUNWAY } from './config.js';
import { heightAt, onRunway, slopeAt } from './terrain.js';

export const EVENT_NONE = 0;
export const EVENT_TOUCHDOWN = 1;
export const EVENT_CRASH = 2;
export const EVENT_LIFTOFF = 4;
export const EVENT_STALL = 8;

const FORWARD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);
const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();

export function newFlightState() {
  return {
    position: new THREE.Vector3(RUNWAY.x, RUNWAY.elevation + PLANE.gearHeight, RUNWAY.z + 380),
    quaternion: new THREE.Quaternion(),
    speed: 0,               // m/s along the nose
    sink: 0,                // extra downward velocity while stalled
    throttle: 0,            // 0..1
    fuel: 1,                // 0..1
    damage: 0,              // 0..1, 1 = wrecked
    engineOn: true,
    onGround: true,
    gearDown: true,
    gearAmount: 1,          // animated 0..1
    flaps: false,
    brakes: false,
    stalled: false,
    verticalSpeed: 0,       // m/s, smoothed, for the HUD and touchdown scoring
    touchdown: null,        // { verticalSpeed, centreline, onRunway } of the last landing
    dt: 0,
  };
}

/** Place the aeroplane in the air, heading along -Z rotated by `heading`. */
export function placeAirborne(state, x, y, z, heading, speed, throttle = 0.65) {
  state.position.set(x, y, z);
  tmpEuler.set(0, heading, 0);
  state.quaternion.setFromEuler(tmpEuler);
  state.speed = speed;
  state.sink = 0;
  state.throttle = throttle;
  state.onGround = false;
  state.gearDown = true;
  state.gearAmount = 1;
  state.touchdown = null;
}

export function headingOf(state) {
  tmpForward.copy(FORWARD).applyQuaternion(state.quaternion);
  // Compass heading: 0 = north (-Z), 90 = east (+X), clockwise.
  let heading = Math.atan2(tmpForward.x, -tmpForward.z);
  if (heading < 0) heading += Math.PI * 2;
  return heading;
}

export function bankOf(state) {
  tmpRight.set(1, 0, 0).applyQuaternion(state.quaternion);
  return Math.asin(THREE.MathUtils.clamp(tmpRight.y, -1, 1));
}

export function pitchOf(state) {
  tmpForward.copy(FORWARD).applyQuaternion(state.quaternion);
  return Math.asin(THREE.MathUtils.clamp(tmpForward.y, -1, 1));
}

function rotate(state, axis, angle) {
  tmpQuat.setFromAxisAngle(axis, angle);
  state.quaternion.multiply(tmpQuat).normalize();
}

/**
 * Advance the flight by dt. `input` is { pitch, roll, yaw, throttleDelta,
 * toggleGear, toggleFlaps, brakes } with pitch/roll/yaw in [-1, 1]
 * (pitch +1 = nose up, roll +1 = bank right).
 * Returns an EVENT_* bitmask.
 */
export function stepFlight(state, input, dt) {
  state.dt = dt;
  let events = EVENT_NONE;

  if (input.toggleGear && !state.onGround) state.gearDown = !state.gearDown;
  if (input.toggleFlaps) state.flaps = !state.flaps;
  state.brakes = !!input.brakes;
  state.gearAmount += ((state.gearDown ? 1 : 0) - state.gearAmount) * Math.min(1, dt * 1.6);

  // Fuel and engine.
  if (state.engineOn) {
    const burn = PLANE.fuelBurnIdle + (PLANE.fuelBurnFull - PLANE.fuelBurnIdle) * state.throttle;
    state.fuel = Math.max(0, state.fuel - burn * dt);
    if (state.fuel <= 0) state.engineOn = false;
  }
  state.throttle = THREE.MathUtils.clamp(state.throttle + input.throttleDelta * dt * 0.55, 0, 1);
  const thrust = state.engineOn ? state.throttle * PLANE.maxThrust : 0;

  tmpForward.copy(FORWARD).applyQuaternion(state.quaternion);
  const bank = bankOf(state);
  const loadFactor = 1 / Math.max(0.35, Math.cos(bank));
  const stallSpeed = PLANE.stallSpeed * loadFactor * (state.flaps ? PLANE.flapStallFactor : 1);
  const authority = THREE.MathUtils.clamp(state.speed / (stallSpeed * 1.7), 0.15, 1);

  // Controls. In a stall the nose drops on its own and the ailerons go soft.
  // On the ground the nose stays down until rotation speed.
  state.stalled = !state.onGround && state.speed < stallSpeed;
  if (state.stalled) events |= EVENT_STALL;
  let pitchInput = state.stalled ? Math.min(input.pitch, 0.1) - 0.35 : input.pitch;
  if (state.onGround) pitchInput *= THREE.MathUtils.clamp(state.speed / PLANE.rotateSpeed, 0.2, 1);
  rotate(state, tmpRight.set(1, 0, 0), pitchInput * PLANE.pitchRate * authority * dt);
  rotate(state, tmpForward.copy(FORWARD), input.roll * PLANE.rollRate * authority * dt);
  rotate(state, tmpUp.set(0, 1, 0), -input.yaw * PLANE.yawRate * authority * dt);
  // Coordinated turn: bank becomes yaw, rate grows as speed falls.
  // bankOf is negative when banked right, so a right bank gives a negative
  // turnRate and a negative rotation about +Y, which swings the nose right.
  if (!state.onGround && state.speed > 4) {
    const turnRate = (PLANE.gravity * Math.tan(THREE.MathUtils.clamp(bank, -1.2, 1.2))) / Math.max(state.speed, 12);
    rotate(state, tmpUp.set(0, 1, 0), turnRate * dt);
  }
  // Gentle spiral stability: the wings drift level when hands are off.
  if (!state.onGround && Math.abs(input.roll) < 0.05) {
    rotate(state, tmpForward.copy(FORWARD), bank * 0.2 * dt);
  }

  // Speed: thrust against drag and the gravity component along the nose.
  tmpForward.copy(FORWARD).applyQuaternion(state.quaternion);
  let drag = 0.0011 * state.speed * state.speed;
  if (state.gearAmount > 0.5) drag *= 1 + PLANE.gearDrag;
  if (state.flaps) drag *= 1 + PLANE.flapDrag;
  if (state.brakes && !state.onGround) drag *= 2.4;
  const gravityAlong = -PLANE.gravity * tmpForward.y;
  state.speed = Math.max(0, state.speed + (thrust - drag + gravityAlong) * dt);
  if (state.speed > PLANE.maxSpeed * 1.35) state.speed = PLANE.maxSpeed * 1.35;

  // Sink while stalled: the wing stops flying and the aeroplane mushes down.
  const sinkTarget = state.stalled ? Math.min(9, (stallSpeed - state.speed) * 0.55) : 0;
  state.sink += (sinkTarget - state.sink) * Math.min(1, dt * 2.2);

  const previousY = state.position.y;
  state.position.addScaledVector(tmpForward, state.speed * dt);
  state.position.y -= state.sink * dt;
  state.verticalSpeed += (((state.position.y - previousY) / Math.max(dt, 1e-4)) - state.verticalSpeed) * Math.min(1, dt * 5);

  // Ground contact. While on the ground the aeroplane stays pinned to the
  // surface until the lift-off check below lets it leave.
  const ground = heightAt(state.position.x, state.position.z);
  const floorY = ground + PLANE.gearHeight * Math.max(state.gearAmount, 0.25);
  if (state.onGround || state.position.y <= floorY) {
    const slope = slopeAt(state.position.x, state.position.z);
    const hard = state.verticalSpeed < -4.2 || Math.abs(bank) > 0.5 || pitchOf(state) < -0.35 || slope > 0.8;
    const belly = state.gearAmount < 0.5;
    if (!state.onGround) {
      state.touchdown = {
        verticalSpeed: state.verticalSpeed,
        centreline: Math.abs(state.position.x - RUNWAY.x),
        onRunway: onRunway(state.position.x, state.position.z),
        speed: state.speed,
      };
      if (hard || (belly && state.speed > 14)) {
        state.damage = Math.min(1, state.damage + (hard ? 1 : 0.55));
        events |= EVENT_CRASH;
      } else {
        if (belly) state.damage = Math.min(1, state.damage + 0.25);
        else if (state.verticalSpeed < -2.6) state.damage = Math.min(1, state.damage + 0.3);
        else if (state.verticalSpeed < -1.6) state.damage = Math.min(1, state.damage + 0.12);
        events |= EVENT_TOUCHDOWN;
      }
      state.onGround = true;
    }
    state.position.y = floorY;
    state.sink = 0;
    // On the ground: roll straight, level the wings, let brakes and drag work.
    tmpEuler.setFromQuaternion(state.quaternion, 'YXZ');
    tmpEuler.x *= Math.max(0, 1 - dt * 3);
    tmpEuler.z *= Math.max(0, 1 - dt * 3);
    state.quaternion.setFromEuler(tmpEuler);
    if (state.brakes) state.speed = Math.max(0, state.speed - 6.5 * dt);
    state.speed = Math.max(0, state.speed - (state.speed * 0.05 + (slope > 0.3 ? 2.2 : 0)) * dt);
    // Lift-off: enough speed and a pull on the stick.
    if (state.speed > PLANE.rotateSpeed && input.pitch > 0.25 && state.damage < 1) {
      state.onGround = false;
      state.position.y = floorY + 0.4;
      events |= EVENT_LIFTOFF;
    }
  } else if (state.onGround) {
    state.onGround = false;
  }

  // Water is not a runway.
  if (state.position.y < 1.2 && ground < 1.2 && !state.onGround) {
    state.damage = 1;
    events |= EVENT_CRASH;
  }

  // Keep the aeroplane inside the world.
  const limit = 3050;
  state.position.x = THREE.MathUtils.clamp(state.position.x, -limit, limit);
  state.position.z = THREE.MathUtils.clamp(state.position.z, -limit, limit);
  state.position.y = Math.min(state.position.y, 1400);

  return events;
}
