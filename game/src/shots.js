// Screenshot staging behind ?shot=cover|approach|ring|touchdown. Each scene
// places the aeroplane, then flies the real simulation forward with scripted
// inputs, so the frame is what the game really looks like mid-flight.
import { RUNWAY } from './config.js';
import { placeAirborne } from './flight.js';
import { VIEW_CHASE, VIEW_COCKPIT } from './camera.js';

const STEP = 1 / 60;

function fly(api, seconds, input) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) api.step(STEP, input);
}

const LEVEL = { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, toggleGear: false, toggleFlaps: false, brakes: false };

export function stageShot(name, api) {
  const { state, mission, rig } = api;
  mission.start(state);

  if (name === 'approach') {
    // Cockpit seat on final for runway 27, panel lit, strip ahead.
    placeAirborne(state, -6, 110, 1200, 0, 31, 0.3);
    state.flaps = true;
    rig.view = VIEW_COCKPIT;
    fly(api, 2.0, { ...LEVEL, pitch: -0.05 });
    return;
  }

  if (name === 'ring') {
    // Banked over the ridge, turning onto the third ring.
    placeAirborne(state, -1280, 338, -715, 0.86, 52, 0.8);
    rig.view = VIEW_CHASE;
    fly(api, 0.8, { ...LEVEL, roll: 0.3, pitch: 0.05 });
    fly(api, 0.9, { ...LEVEL, pitch: 0.04 });
    return;
  }

  if (name === 'touchdown') {
    // A breath after the wheels kiss the strip: descend, flare, touch.
    placeAirborne(state, 2, RUNWAY.elevation + 2.6, 770, 0, 25, 0.05);
    state.flaps = true;
    rig.view = VIEW_CHASE;
    fly(api, 1.0, { ...LEVEL, pitch: -0.1 });
    fly(api, 0.9, { ...LEVEL, pitch: 0.08 });
    api.hud.banner('TOUCHDOWN', 30);
    return;
  }

  // cover: chase view north over the airfield, ring 1 glowing ahead.
  placeAirborne(state, 15, 178, 320, 0.03, 50, 0.72);
  rig.view = VIEW_CHASE;
  fly(api, 1.1, { ...LEVEL, roll: 0.16, pitch: 0.02 });
  fly(api, 1.2, { ...LEVEL, pitch: 0.02 });
}
