// Cameras: a smoothed chase view that never fights the pilot, a cockpit
// seat over the lit panel, and a slow orbit for the title screen.
import * as THREE from '../vendor/three.module.min.js';
import { CAMERA } from './config.js';
import { heightAt } from './terrain.js';

const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
const tmpUp = new THREE.Vector3();

export const VIEW_CHASE = 0;
export const VIEW_COCKPIT = 1;
export const VIEW_ORBIT = 2;

export function createCameraRig(camera) {
  const chasePos = new THREE.Vector3(0, 80, 700);
  let view = VIEW_CHASE;

  function update(state, dt, t) {
    const planePos = state.position;
    if (view === VIEW_COCKPIT) {
      tmpPos.set(0, 0.78, -1.45).applyQuaternion(state.quaternion).add(planePos);
      camera.position.copy(tmpPos);
      tmpLook.set(0, 0.48, -30).applyQuaternion(state.quaternion).add(planePos);
      tmpUp.set(0, 1, 0).applyQuaternion(state.quaternion);
      camera.up.copy(tmpUp);
      camera.lookAt(tmpLook);
      camera.fov = CAMERA.fovBase + 6;
    } else if (view === VIEW_ORBIT) {
      const angle = t * 0.12;
      tmpPos.set(
        planePos.x + Math.sin(angle) * 17,
        planePos.y + 4.5,
        planePos.z + Math.cos(angle) * 17,
      );
      camera.position.copy(tmpPos);
      camera.up.set(0, 1, 0);
      camera.lookAt(planePos.x, planePos.y + 0.8, planePos.z);
      camera.fov = CAMERA.fovBase;
    } else {
      tmpPos.set(0, CAMERA.chaseHeight, CAMERA.chaseDistance).applyQuaternion(state.quaternion).add(planePos);
      // Never let the chase camera dip under the terrain.
      const floor = heightAt(tmpPos.x, tmpPos.z) + 1.6;
      if (tmpPos.y < floor) tmpPos.y = floor;
      const k = 1 - Math.exp(-CAMERA.chaseLag * dt);
      chasePos.lerp(tmpPos, k);
      camera.position.copy(chasePos);
      tmpLook.set(0, 1.2, -26).applyQuaternion(state.quaternion).add(planePos);
      camera.up.set(0, 1, 0);
      camera.lookAt(tmpLook);
      camera.fov = CAMERA.fovBase + CAMERA.fovSpeedGain * Math.min(1, state.speed / 70);
    }
    camera.updateProjectionMatrix();
  }

  return {
    update,
    get view() { return view; },
    set view(next) { view = next; },
    cycle() { view = view === VIEW_CHASE ? VIEW_COCKPIT : VIEW_CHASE; },
    snapTo(state) {
      tmpPos.set(0, CAMERA.chaseHeight, CAMERA.chaseDistance).applyQuaternion(state.quaternion).add(state.position);
      chasePos.copy(tmpPos);
    },
  };
}
