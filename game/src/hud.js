// HUD: heading ribbon, speed and altitude tapes, attitude ball, engine
// gauges and the mission panel. Everything updates from flight state.
import { FT, KT } from './config.js';
import { bankOf, headingOf, pitchOf } from './flight.js';

const el = (id) => document.getElementById(id);

function buildHeadingStrip() {
  const strip = el('heading-strip');
  const labels = ['N', '03', '06', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'];
  let html = '';
  for (let rep = 0; rep < 3; rep += 1) {
    for (const label of labels) html += `<span>${label}</span>`;
  }
  strip.innerHTML = html;
}

function buildTape(id, maxValue, step) {
  const strip = el(id);
  let html = '';
  for (let v = maxValue; v >= 0; v -= step) html += `<div>${v}</div>`;
  strip.innerHTML = html;
  return strip;
}

function drawAttitude(state) {
  const canvas = el('attitude');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = 68;
  const pitch = pitchOf(state);
  const bank = bankOf(state);
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(bank);
  const pitchPx = Math.max(-r, Math.min(r, pitch * 90));
  ctx.fillStyle = '#3a7bd5';
  ctx.fillRect(-r * 1.6, -r * 1.6 + pitchPx, r * 3.2, r * 1.6);
  ctx.fillStyle = '#8a5a33';
  ctx.fillRect(-r * 1.6, pitchPx, r * 3.2, r * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  for (const deg of [-20, -10, 10, 20]) {
    const y = pitchPx - deg * 1.6;
    ctx.beginPath();
    ctx.moveTo(-22, y);
    ctx.lineTo(22, y);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#ffd27d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 34, cy);
  ctx.lineTo(cx - 10, cy);
  ctx.lineTo(cx - 10, cy + 6);
  ctx.moveTo(cx + 34, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.lineTo(cx + 10, cy + 6);
  ctx.stroke();
  ctx.fillStyle = '#ffd27d';
  ctx.fillRect(cx - 2, cy - 2, 4, 4);
  ctx.strokeStyle = 'rgba(125,255,176,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function createHud() {
  buildHeadingStrip();
  const speedStrip = buildTape('speed-strip', 200, 10);
  const altStrip = buildTape('alt-strip', 5000, 100);
  let bannerTimer = 0;

  return {
    show() { el('hud').classList.remove('hidden'); },
    hide() { el('hud').classList.add('hidden'); },
    banner(text, seconds = 2.2) {
      const banner = el('banner');
      banner.textContent = text;
      banner.classList.remove('hidden');
      bannerTimer = seconds;
    },
    update(state, mission, dt) {
      const speedKt = state.speed * KT;
      const altFt = Math.max(0, state.position.y) * FT;
      const headingDeg = (headingOf(state) * 180) / Math.PI;

      el('heading-box').textContent = String(Math.round(headingDeg) % 360).padStart(3, '0');
      // Strip: 12 labels of 60px per 360 degrees, three copies; centre the middle copy.
      const pxPerDeg = 60 / 30;
      el('heading-strip').style.transform = `translateX(${170 - 720 - headingDeg * pxPerDeg}px)`;

      el('speed-box').textContent = String(Math.round(speedKt));
      speedStrip.style.transform = `translateY(${150 - (200 - speedKt) * 3 - 15}px)`;
      el('alt-box').textContent = String(Math.round(altFt));
      altStrip.style.transform = `translateY(${150 - (5000 - altFt) * 0.3 - 15}px)`;
      const vsFpm = Math.round(state.verticalSpeed * FT * 60);
      el('vs-box').textContent = `${vsFpm >= 0 ? '+' : ''}${vsFpm} FPM`;

      drawAttitude(state);

      el('thr-fill').style.width = `${Math.round(state.throttle * 100)}%`;
      el('thr-num').textContent = `${Math.round(state.throttle * 100)}%`;
      el('fuel-fill').style.width = `${Math.round(state.fuel * 100)}%`;
      el('fuel-num').textContent = `${Math.round(state.fuel * 100)}%`;
      el('hull-fill').style.width = `${Math.round((1 - state.damage) * 100)}%`;
      el('hull-num').textContent = `${Math.round((1 - state.damage) * 100)}%`;
      el('gear-lamp').classList.toggle('on', state.gearAmount > 0.8);
      el('flap-lamp').classList.toggle('on', state.flaps);
      el('brake-lamp').classList.toggle('on', state.brakes);

      el('mission-name').textContent = mission.name;
      el('mission-objective').textContent = mission.objective;
      el('mission-score').textContent = `SCORE ${mission.score}`;
      el('mission-time').textContent = formatTime(mission.time);

      el('warn-stall').classList.toggle('hidden', !state.stalled);
      el('warn-fuel').classList.toggle('hidden', state.fuel > 0.18 || !state.engineOn);
      el('warn-gear').classList.toggle('hidden', state.onGround || state.gearAmount > 0.5 || state.position.y > 190);

      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) el('banner').classList.add('hidden');
      }
    },
  };
}
