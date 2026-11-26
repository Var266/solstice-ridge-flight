// Audio: everything is synthesised with WebAudio — engine note tied to the
// throttle, wind tied to airspeed, chimes for rings, a thump for touchdown
// and a beeper for the stall. No audio files, no network.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx = null;
      return;
    }
    // Engine: two detuned saws through a lowpass.
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const sub = ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 28;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    engineOsc.connect(filter);
    sub.connect(subGain);
    subGain.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    sub.start();
    engineOsc._sub = sub;
    engineOsc._filter = filter;

    // Wind: looping filtered noise.
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    wind.start();
  }

  function blip(freq, time, dur, type = 'sine', gainValue = 0.12) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue, ctx.currentTime + time);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + time);
    osc.stop(ctx.currentTime + time + dur + 0.05);
  }

  return {
    start: ensure,
    update(state) {
      if (!ctx) return;
      const rpm = state.engineOn ? 0.3 + state.throttle * 0.7 : 0;
      const freq = 48 + rpm * 95;
      engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
      engineOsc._sub.frequency.setTargetAtTime(freq / 2, ctx.currentTime, 0.08);
      engineOsc._filter.frequency.setTargetAtTime(300 + rpm * 650, ctx.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(state.engineOn ? 0.05 + rpm * 0.09 : 0, ctx.currentTime, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.16, (state.speed / 80) * 0.16), ctx.currentTime, 0.15);
    },
    ring() {
      blip(880, 0, 0.18);
      blip(1318, 0.09, 0.24);
    },
    pickup() {
      blip(659, 0, 0.16);
      blip(988, 0.1, 0.2);
      blip(1318, 0.2, 0.3);
    },
    touchdown(hard) {
      blip(hard ? 70 : 95, 0, 0.22, 'sine', hard ? 0.3 : 0.18);
      if (hard) blip(52, 0.05, 0.4, 'triangle', 0.25);
    },
    crash() {
      blip(46, 0, 0.7, 'sawtooth', 0.3);
      blip(90, 0.02, 0.5, 'square', 0.18);
    },
    stallBeep() {
      blip(1560, 0, 0.09, 'square', 0.05);
    },
    complete() {
      blip(523, 0, 0.2);
      blip(659, 0.14, 0.2);
      blip(784, 0.28, 0.34);
    },
  };
}
