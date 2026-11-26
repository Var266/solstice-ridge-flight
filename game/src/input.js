// Input: keyboard flight controls plus mouse steering. One object the flight
// model reads each step; toggles are edge-triggered and consumed by main.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const input = {
    pitch: 0, roll: 0, yaw: 0, throttleDelta: 0,
    toggleGear: false, toggleFlaps: false, brakes: false,
    toggleCamera: false, togglePause: false, restart: false, toMenu: false,
    missionPick: 0, anyKey: false,
  };
  const mouse = { down: false, x: 0, y: 0, dx: 0, dy: 0, wheel: 0 };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    pressed.add(event.code);
    input.anyKey = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    mouse.down = true;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!mouse.down) return;
    mouse.dx += event.clientX - mouse.x;
    mouse.dy += event.clientY - mouse.y;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  canvas.addEventListener('pointerup', () => { mouse.down = false; });
  window.addEventListener('wheel', (event) => { mouse.wheel += Math.sign(event.deltaY); }, { passive: true });

  const held = (...codes) => codes.some((code) => keys.has(code));
  const hit = (...codes) => codes.some((code) => pressed.has(code));

  /** Refresh the input object for this frame; call once per simulation step. */
  function poll() {
    input.pitch = (held('ArrowUp') ? 1 : 0) + (held('ArrowDown') ? -1 : 0);
    input.roll = (held('ArrowRight') ? 1 : 0) + (held('ArrowLeft') ? -1 : 0);
    input.yaw = (held('KeyD') ? 1 : 0) + (held('KeyA') ? -1 : 0);
    input.throttleDelta = (held('KeyW', 'ShiftLeft', 'ShiftRight') ? 1 : 0) + (held('KeyS', 'ControlLeft', 'ControlRight') ? -1 : 0);
    if (mouse.down) {
      input.roll += Math.max(-1, Math.min(1, mouse.dx / 90));
      input.pitch += Math.max(-1, Math.min(1, -mouse.dy / 90));
    }
    if (mouse.wheel !== 0) input.throttleDelta += -mouse.wheel * 2.2;
    input.pitch = Math.max(-1, Math.min(1, input.pitch));
    input.roll = Math.max(-1, Math.min(1, input.roll));
    input.toggleGear = hit('KeyG');
    input.toggleFlaps = hit('KeyF');
    input.brakes = held('Space');
    input.toggleCamera = hit('KeyC');
    input.togglePause = hit('KeyP');
    input.restart = hit('KeyR');
    input.toMenu = hit('Escape');
    input.missionPick = hit('Digit1') ? 1 : hit('Digit2') ? 2 : hit('Digit3') ? 3 : hit('Digit4') ? 4 : 0;
    mouse.dx = 0;
    mouse.dy = 0;
    mouse.wheel = 0;
    pressed.clear();
    return input;
  }

  return { poll, state: input };
}
