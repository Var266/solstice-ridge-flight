// Solstice Ridge: world, aeroplane and flight-model constants.
// Units are metres, seconds and radians inside the simulation; the HUD
// converts to knots and feet for display.

export const WORLD = {
  size: 6400,            // terrain spans this many metres, centred on origin
  grid: 220,             // heightfield segments per side
  seaLevel: 0,
  maxHeight: 420,
  seed: 20261126,
};

export const RUNWAY = {
  x: 0,
  z: 300,                // centre of the strip
  length: 980,
  width: 46,
  heading: 0,            // strip runs along -Z (take off toward -Z, "runway 27" is cosmetic)
  elevation: 46,         // plateau height the terrain is flattened to
};

export const PLANE = {
  maxSpeed: 78,          // m/s at full throttle, level (~152 kt)
  rotateSpeed: 24,       // m/s, lift-off with a gentle pull
  stallSpeed: 21,        // m/s at 1 g, clean
  flapStallFactor: 0.82, // flaps lower the stall speed
  gearDrag: 0.16,        // extra drag fraction with the gear down
  flapDrag: 0.22,
  maxThrust: 7.2,        // m/s^2 at full throttle, sea level
  gravity: 9.81,
  pitchRate: 1.15,       // rad/s at full deflection, full authority
  rollRate: 2.4,
  yawRate: 0.55,
  fuelBurnIdle: 0.0016,  // fraction per second at idle
  fuelBurnFull: 0.011,   // fraction per second at full throttle
  gearHeight: 1.15,      // metres from fuselage centre to wheel contact
};

export const COLOURS = {
  skyZenith: 0x2e5aa8,
  skyHorizon: 0xf6b26b,
  sun: 0xffd9a0,
  fog: 0xe8a97e,
  water: 0x2a7f8c,
  sand: 0xd9bd8a,
  grass: 0x6fae4e,
  forest: 0x3d7a3a,
  rock: 0x8a7f72,
  snow: 0xf4f6f8,
  runway: 0x3c4148,
  ringNext: 0x51ff8a,
  ringTodo: 0xff9a3d,
  ringDone: 0x3a6ea5,
};

export const SUN = {
  azimuth: -2.25,        // radians; low in the west-southwest
  elevation: 0.32,       // radians above the horizon
  distance: 5200,
};

export const CAMERA = {
  chaseDistance: 13.5,
  chaseHeight: 3.6,
  chaseLag: 4.2,         // 1/s smoothing
  fovBase: 62,
  fovSpeedGain: 10,
};

export const KT = 1.94384;   // m/s -> knots
export const FT = 3.28084;   // m -> feet
