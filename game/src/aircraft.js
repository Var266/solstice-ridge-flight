// The Kestrel K-2: a high-wing single built from primitives, cream and
// vermilion, with a spinning prop, retracting gear, nav lights and a lit
// instrument panel for the cockpit view.
import * as THREE from '../vendor/three.module.min.js';

const CREAM = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.55, metalness: 0.08 });
const RED = new THREE.MeshStandardMaterial({ color: 0xc8402a, roughness: 0.5, metalness: 0.08 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.7, metalness: 0.2 });
const GLASS = new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.12, metalness: 0.4, transparent: true, opacity: 0.55 });
const TYRE = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.95 });

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function gaugeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#10141c';
  ctx.fillRect(0, 0, 512, 192);
  const dial = (cx, cy, r, label, needleAngle, colour) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1a2233';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#5a6c8c';
    ctx.stroke();
    ctx.strokeStyle = '#cfe3ff';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 10; i += 1) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
      ctx.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
      ctx.stroke();
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * r * 0.8, cy + Math.sin(needleAngle) * r * 0.8);
    ctx.stroke();
    ctx.fillStyle = '#cfe3ff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + r + 20);
  };
  dial(70, 80, 52, 'SPEED', Math.PI * 1.6, '#ffb454');
  dial(200, 80, 52, 'ALT', Math.PI * 1.2, '#7dffb0');
  dial(330, 80, 52, 'RPM', Math.PI * 1.85, '#ff7d6b');
  dial(450, 80, 44, 'FUEL', Math.PI * 1.1, '#7dd7ff');
  ctx.fillStyle = '#2a3852';
  ctx.fillRect(120, 150, 270, 26);
  ctx.fillStyle = '#9fd4e8';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('KESTREL K-2 · SOLSTICE RIDGE', 256, 169);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Build the aeroplane. Forward is -Z, up is +Y. Returns the group plus the
 * moving parts the flight loop animates.
 */
export function buildAircraft() {
  const plane = new THREE.Group();
  plane.name = 'kestrel-k2';

  // Fuselage: tapered cylinder along Z, nose toward -Z. After the X
  // rotation the cylinder's top faces +Z (the tail), so the tail radius
  // comes first: slim tail, full nose.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.62, 6.4, 14), CREAM);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  plane.add(fuselage);

  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.44, 1.1, 14), RED);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -3.6;
  nose.castShadow = true;
  plane.add(nose);

  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 12), DARK);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -4.35;
  plane.add(spinner);

  // Cabin glasshouse.
  const canopy = box(1.06, 0.62, 2.1, GLASS, 0, 0.52, -0.9);
  plane.add(canopy);
  const spine = box(0.5, 0.3, 2.6, CREAM, 0, 0.42, 1.6);
  plane.add(spine);

  // High wing with dihedral, red tips.
  const wingL = box(4.6, 0.14, 1.35, CREAM, -2.45, 0.78, -0.7);
  wingL.rotation.z = 0.055;
  const wingR = box(4.6, 0.14, 1.35, CREAM, 2.45, 0.78, -0.7);
  wingR.rotation.z = -0.055;
  const tipL = box(0.7, 0.15, 1.35, RED, -4.95, 0.9, -0.7);
  tipL.rotation.z = 0.055;
  const tipR = box(0.7, 0.15, 1.35, RED, 4.95, 0.9, -0.7);
  tipR.rotation.z = -0.055;
  plane.add(wingL, wingR, tipL, tipR);
  // Wing struts.
  for (const side of [-1, 1]) {
    const strut = box(0.07, 1.7, 0.07, DARK, side * 1.55, 0.05, -0.7);
    strut.rotation.z = side * 0.62;
    plane.add(strut);
  }

  // Tail feathers.
  const tailplane = box(3.1, 0.1, 1.0, CREAM, 0, 0.18, 3.15);
  const fin = box(0.1, 1.25, 1.15, RED, 0, 0.72, 3.1);
  fin.rotation.x = -0.12;
  plane.add(tailplane, fin);

  // Propeller: two blades plus a translucent disc that fades in with rpm.
  const prop = new THREE.Group();
  prop.position.z = -4.2;
  const bladeA = box(0.16, 2.3, 0.05, DARK);
  const bladeB = box(2.3, 0.16, 0.05, DARK);
  prop.add(bladeA, bladeB);
  plane.add(prop);
  const discMaterial = new THREE.MeshBasicMaterial({ color: 0x22262e, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.18, 28), discMaterial);
  disc.position.z = -4.2;
  plane.add(disc);

  // Landing gear: nose wheel + two mains, on struts that fold away.
  const gear = new THREE.Group();
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14);
  const makeWheel = (x, y, z) => {
    const leg = new THREE.Group();
    leg.position.set(x, y, z);
    const strut = box(0.09, 0.85, 0.09, DARK, 0, -0.4, 0);
    const wheel = new THREE.Mesh(wheelGeo, TYRE);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.y = -0.85;
    wheel.castShadow = true;
    leg.add(strut, wheel);
    return leg;
  };
  const gearNose = makeWheel(0, -0.45, -2.6);
  const gearLeft = makeWheel(-0.95, -0.5, 0.2);
  const gearRight = makeWheel(0.95, -0.5, 0.2);
  gear.add(gearNose, gearLeft, gearRight);
  plane.add(gear);

  // Nav lights: red port, green starboard, white tail, blinking strobe.
  const lamp = (colour, x, y, z, r = 0.09) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: colour }));
    m.position.set(x, y, z);
    plane.add(m);
    return m;
  };
  lamp(0xff3b30, -5.3, 0.92, -0.7);
  lamp(0x2ee66b, 5.3, 0.92, -0.7);
  lamp(0xffffff, 0, 0.3, 3.75);
  const strobe = lamp(0xffffff, 0, 1.45, 3.15, 0.07);

  // Cockpit: glareshield + lit panel, seen from the pilot's seat. The group
  // is only shown in cockpit view, so it can be sized for the pilot's eye
  // without poking through the fuselage from outside.
  const cockpit = new THREE.Group();
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.46, 0.08),
    new THREE.MeshBasicMaterial({ map: gaugeTexture() }),
  );
  panel.position.set(0, 0.38, -2.2);
  panel.rotation.x = 0.45;
  cockpit.add(panel);
  const glareshield = box(1.3, 0.06, 0.45, DARK, 0, 0.62, -2.25);
  cockpit.add(glareshield);
  const yoke = box(0.5, 0.06, 0.06, DARK, 0, 0.12, -1.7);
  cockpit.add(yoke);
  cockpit.visible = false;
  plane.add(cockpit);

  return { group: plane, prop, disc, discMaterial, gear, gearLegs: [gearNose, gearLeft, gearRight], strobe, cockpit };
}

/** Animate the moving parts from flight state. `t` is seconds since start. */
export function animateAircraft(parts, state, t) {
  const rpm = state.engineOn ? 0.25 + state.throttle * 0.75 : 0;
  parts.prop.rotation.z -= rpm * 55 * state.dt;
  parts.discMaterial.opacity = Math.max(0, (rpm - 0.35)) * 0.5;
  parts.prop.visible = rpm < 0.85;
  const gearT = state.gearAmount; // 1 = down, 0 = up
  for (const leg of parts.gearLegs) {
    leg.rotation.x = (1 - gearT) * 1.35;
    leg.visible = gearT > 0.03;
  }
  parts.strobe.visible = (t % 1.1) < 0.09;
}
