// Procedural Web Audio: soft switch click, music-box lullaby, room tone / crickets, very faint breathing.
// Nothing is created until unlock() is called from a real user gesture. Master chain: gain -> compressor -> limiter.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// An original gentle pentatonic lullaby (MIDI notes), 2 bars of 8 swaying notes, looped. 0 = rest.
const MELODY = [76, 79, 81, 79, 76, 74, 72, 0, 74, 76, 79, 76, 74, 72, 69, 0, 72, 74, 76, 79, 81, 79, 76, 0, 74, 72, 74, 76, 72, 71, 72, 0];
const BASS = [48, 0, 55, 0, 52, 0, 55, 0];

export function createAudio() {
  const a = { ctx: null, muted: false, mood: 1, asleep: false, started: false, peakHold: 0, voices: 0, lastOne: {}, stats: { clicks: 0, blocked: 0, notes: 0 } };
  let master, comp, limiter, analyser, music, ambience, roomGain, cricketGain, breathGain, breathScale, buf;
  let nextTime = 0, step = 0, timer = 0;

  function noiseBuffer(ctx, secs, brown) {
    const b = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 1.5; } else d[i] = w; }
    return b;
  }

  function build() {
    const ctx = a.ctx;
    master = ctx.createGain(); master.gain.value = 0.55;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -26; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.005; comp.release.value = 0.25;
    limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -6; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.1;
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    master.connect(comp); comp.connect(limiter); limiter.connect(analyser); analyser.connect(ctx.destination);
    buf = new Float32Array(analyser.fftSize);

    music = ctx.createGain(); music.gain.value = 0.0; music.connect(master);
    ambience = ctx.createGain(); ambience.gain.value = 1; ambience.connect(master);

    // room tone: low brown noise
    const rt = ctx.createBufferSource(); rt.buffer = noiseBuffer(ctx, 4, true); rt.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    roomGain = ctx.createGain(); roomGain.gain.value = 0;
    rt.connect(lp); lp.connect(roomGain); roomGain.connect(ambience); rt.start();

    // crickets: two amplitude-modulated high sines
    cricketGain = ctx.createGain(); cricketGain.gain.value = 0; cricketGain.connect(ambience);
    for (const [f, rate, g] of [[4300, 5.2, 0.5], [4750, 3.7, 0.4]]) {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const am = ctx.createGain(); am.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = rate;
      const lg = ctx.createGain(); lg.gain.value = 0.5 * g;
      const dc = ctx.createConstantSource(); dc.offset.value = 0.5 * g;
      const sm = ctx.createBiquadFilter(); sm.type = 'lowpass'; sm.frequency.value = 40;   // soften the square LFO into chirps
      lfo.connect(sm); sm.connect(lg); lg.connect(am.gain); dc.connect(am.gain);
      o.connect(am); am.connect(cricketGain); o.start(); lfo.start(); dc.start();
    }

    // faint breathing (filtered noise with a slow LFO), only while asleep
    const bn = ctx.createBufferSource(); bn.buffer = noiseBuffer(ctx, 3, false); bn.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.7;
    breathGain = ctx.createGain(); breathGain.gain.value = 0;
    const blfo = ctx.createOscillator(); blfo.frequency.value = 0.24;
    const bl = ctx.createGain(); bl.gain.value = 0.0035; const bdc = ctx.createConstantSource(); bdc.offset.value = 0.004;
    blfo.connect(bl); bl.connect(breathGain.gain); bdc.connect(breathGain.gain);
    breathScale = ctx.createGain(); breathScale.gain.value = 0;
    bn.connect(bp); bp.connect(breathGain); breathGain.connect(breathScale); breathScale.connect(ambience); bn.start(); blfo.start(); bdc.start();
    applyMood(true);
  }

  /** Schedule one music-box note (bell-like: fundamental + weak inharmonic partial, exponential decay). */
  function note(midi, when, vel = 0.5, dur = 1.6) {
    if (!midi || a.voices > 8) return;
    const ctx = a.ctx, f = NOTE(midi);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vel * 0.2, when + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.76;
    const g2 = ctx.createGain(); g2.gain.value = 0.12;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(music);
    o1.start(when); o2.start(when); o1.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
    a.voices++; a.stats.notes++;
    o1.onended = () => { a.voices--; };
  }

  function schedule() {
    if (!a.ctx || a.ctx.state !== 'running') return;
    const spb = 0.62; // seconds per note: slow lullaby
    while (nextTime < a.ctx.currentTime + 0.8) {
      if (nextTime < a.ctx.currentTime) nextTime = a.ctx.currentTime + 0.05;
      const i = step % MELODY.length;
      note(MELODY[i], nextTime, i % 8 === 0 ? 0.7 : 0.5);
      if (i % 4 === 0) note(BASS[(i / 4) % BASS.length | 0] ? BASS[((i / 4) | 0) % BASS.length] : 0, nextTime, 0.35, 2.2);
      nextTime += spb * (i % 8 === 7 ? 1.5 : 1); step++;
    }
  }

  function applyMood(instant) {
    if (!a.ctx) return;
    const t = a.ctx.currentTime, k = instant ? 0.01 : 0.35, m = a.mood;
    const mute = a.muted ? 0 : 1;
    music.gain.setTargetAtTime((0.1 + 0.09 * m) * mute, t, k);
    roomGain.gain.setTargetAtTime(0.05 * m * mute, t, k);
    cricketGain.gain.setTargetAtTime(0.012 * (1 - m) * mute, t, k);
    breathScale.gain.setTargetAtTime((a.asleep ? 1 : 0) * mute, t, 0.6);
    ambience.gain.setTargetAtTime(mute, t, 0.1);
    master.gain.setTargetAtTime(0.55, t, 0.1);
  }

  /** One-shot guard: no two identical sounds closer than minGap seconds. */
  function guard(name, minGap) {
    const now = a.ctx.currentTime;
    if (now - (a.lastOne[name] ?? -9) < minGap) { a.stats.blocked++; return false; }
    a.lastOne[name] = now; return true;
  }

  Object.assign(a, {
    /** Call from a user gesture (pointerdown / keydown). Idempotent. */
    unlock() {
      if (a.started) { if (a.ctx.state === 'suspended') a.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      a.ctx = new AC({ latencyHint: 'interactive' }); a.started = true;
      build(); a.ctx.resume();
      nextTime = a.ctx.currentTime + 0.3; timer = setInterval(schedule, 150); schedule();
    },
    setMood(m, asleep) {
      a.mood = m; a.asleep = asleep;
      applyMood(false);
    },
    setMuted(v) { a.muted = v; applyMood(false); },
    /** Soft switch click: filtered noise tick + low thump. */
    click(on) {
      if (!a.ctx || a.muted || !guard('click', 0.09)) return;
      const ctx = a.ctx, t = ctx.currentTime + 0.005;
      const nb = ctx.createBufferSource(); nb.buffer = noiseBuffer(ctx, 0.05, false);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = on ? 2400 : 1700; bp.Q.value = 1.2;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      nb.connect(bp); bp.connect(g); g.connect(master); nb.start(t); nb.stop(t + 0.06);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(on ? 190 : 150, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.05);
      const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.06, t + 0.003); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g2); g2.connect(master); o.start(t); o.stop(t + 0.09);
      a.stats.clicks++;
    },
    /** Gentle two-tone train toot. */
    toot() {
      if (!a.ctx || a.muted || !guard('toot', 0.6)) return;
      const ctx = a.ctx, t = ctx.currentTime + 0.01;
      for (const [f, dt] of [[392, 0], [523, 0.17]]) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(0.12, t + dt + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.3);
        o.connect(lp); lp.connect(g); g.connect(master); o.start(t + dt); o.stop(t + dt + 0.35);
      }
    },
    /** Tiny squeak-free "boing" for the ear wiggle. */
    wiggle() {
      if (!a.ctx || a.muted || !guard('wiggle', 0.5)) return;
      const ctx = a.ctx, t = ctx.currentTime + 0.01, o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.12);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25);
    },
    /** Measure the current output peak (linear 0..1) and keep a running hold value. */
    peak() {
      if (!analyser) return 0;
      analyser.getFloatTimeDomainData(buf);
      let p = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > p) p = v; }
      a.peakHold = Math.max(a.peakHold, p); return p;
    },
    resetPeak() { a.peakHold = 0; },
  });
  return a;
}
