/* К-47 — процедурный звук: эффекты, эмбиент, музыка (WebAudio) */
'use strict';
(function () {
  const A = K.audio = {};
  let ac = null, master, sfxG, musG, ambG, noiseBuf = null;
  let ambNodes = [], musNodes = [], musTimer = null;
  A.vol = { sfx: 0.7, music: 0.45 };
  A.enabled = true;

  A.init = function () {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { A.enabled = false; return; }
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ac.destination);
    sfxG = ac.createGain(); sfxG.gain.value = A.vol.sfx; sfxG.connect(master);
    musG = ac.createGain(); musG.gain.value = A.vol.music; musG.connect(master);
    ambG = ac.createGain(); ambG.gain.value = A.vol.music * 0.9; ambG.connect(master);
    const len = ac.sampleRate * 2;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  };
  A.setVol = function (sfx, music) {
    A.vol.sfx = sfx; A.vol.music = music;
    if (!ac) return;
    sfxG.gain.value = sfx; musG.gain.value = music; ambG.gain.value = music * 0.9;
  };

  function noise(dur, t0) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    s.loop = true; s.loopStart = Math.random(); s.start(t0, Math.random(), dur + 0.1);
    return s;
  }
  function env(g, t0, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dcy);
  }
  function burst(t0, o) {
    const n = noise(o.dur, t0);
    const f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq; f.Q.value = o.q || 0.8;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t0 + o.dur);
    const g = ac.createGain(); env(g, t0, o.a || 0.002, o.peak || 0.8, o.dur);
    n.connect(f); f.connect(g); g.connect(o.dest || sfxG);
  }
  function tone(t0, o) {
    const osc = ac.createOscillator(); osc.type = o.wave || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
    const g = ac.createGain(); env(g, t0, o.a || 0.005, o.peak || 0.4, o.dur);
    let node = osc;
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.dest || sfxG);
    osc.start(t0); osc.stop(t0 + (o.a || 0.005) + o.dur + 0.05);
  }
  const lastPlay = {};

  A.sfx = function (name) {
    if (!ac || !A.enabled || A.vol.sfx <= 0) return;
    const now = ac.currentTime;
    if (lastPlay[name] && now - lastPlay[name] < 0.03) return;
    lastPlay[name] = now;
    const t = now + 0.01;
    switch (name) {
      case 'click': tone(t, { f: 1800, dur: 0.03, peak: 0.12, wave: 'square', lp: 3000 }); break;
      case 'select': tone(t, { f: 660, f2: 990, dur: 0.07, peak: 0.12, wave: 'triangle' }); break;
      case 'deny': tone(t, { f: 220, f2: 160, dur: 0.12, peak: 0.18, wave: 'square', lp: 900 }); break;
      case 'steps': for (let i = 0; i < 4; i++) burst(t + i * 0.1, { dur: 0.05, freq: 1800 + Math.random() * 600, q: 1.2, peak: 0.12, type: 'highpass' }); break;
      case 'skitter': for (let i = 0; i < 7; i++) burst(t + i * 0.045, { dur: 0.03, freq: 3500, q: 4, peak: 0.08 }); break;
      case 'engine': tone(t, { f: 55, f2: 70, dur: 0.6, peak: 0.25, wave: 'sawtooth', lp: 300 }); burst(t, { dur: 0.6, freq: 200, peak: 0.12, type: 'lowpass' }); break;
      case 'jet': burst(t, { dur: 0.9, freq: 800, sweep: 2500, q: 0.6, peak: 0.3 }); break;
      case 'smg': for (let i = 0; i < 5; i++) { burst(t + i * 0.055, { dur: 0.06, freq: 1400, q: 0.7, peak: 0.55 }); tone(t + i * 0.055, { f: 140, f2: 60, dur: 0.05, peak: 0.25 }); } break;
      case 'rifle': for (let i = 0; i < 3; i++) { burst(t + i * 0.09, { dur: 0.09, freq: 1000, q: 0.6, peak: 0.6 }); tone(t + i * 0.09, { f: 120, f2: 50, dur: 0.08, peak: 0.3 }); } break;
      case 'mg': for (let i = 0; i < 9; i++) { burst(t + i * 0.042, { dur: 0.05, freq: 900, q: 0.6, peak: 0.55 }); tone(t + i * 0.042, { f: 100, f2: 45, dur: 0.05, peak: 0.3 }); } break;
      case 'shotgun': burst(t, { dur: 0.35, freq: 700, sweep: 200, q: 0.5, peak: 1 }); tone(t, { f: 90, f2: 35, dur: 0.25, peak: 0.6 }); burst(t + 0.25, { dur: 0.04, freq: 2500, q: 3, peak: 0.2 }); break;
      case 'sniper': burst(t, { dur: 0.5, freq: 1600, sweep: 300, q: 0.4, peak: 0.9 }); tone(t, { f: 180, f2: 40, dur: 0.35, peak: 0.5 }); break;
      case 'heavy': for (let i = 0; i < 3; i++) { burst(t + i * 0.12, { dur: 0.16, freq: 500, q: 0.5, peak: 0.9 }); tone(t + i * 0.12, { f: 70, f2: 30, dur: 0.15, peak: 0.5 }); } break;
      case 'laser': tone(t, { f: 2400, f2: 300, dur: 0.28, peak: 0.25, wave: 'sawtooth', lp: 4000 }); tone(t, { f: 1200, f2: 150, dur: 0.28, peak: 0.15, wave: 'square', lp: 2500 }); break;
      case 'plasma': burst(t, { dur: 0.5, freq: 300, sweep: 2400, q: 0.7, peak: 0.6 }); tone(t, { f: 80, f2: 220, dur: 0.45, peak: 0.35, wave: 'sawtooth', lp: 800 }); break;
      case 'claw': burst(t, { dur: 0.18, freq: 2500, sweep: 900, q: 1.5, peak: 0.45 }); break;
      case 'bite': burst(t, { dur: 0.12, freq: 600, q: 1, peak: 0.5 }); tone(t, { f: 90, f2: 60, dur: 0.1, peak: 0.3 }); break;
      case 'hit': burst(t, { dur: 0.08, freq: 400, q: 0.8, peak: 0.35, type: 'lowpass' }); break;
      case 'hitmetal': tone(t, { f: 1800 + Math.random() * 800, dur: 0.12, peak: 0.12, wave: 'triangle' }); burst(t, { dur: 0.05, freq: 3000, q: 2, peak: 0.25 }); break;
      case 'death': burst(t, { dur: 0.3, freq: 300, sweep: 120, q: 0.6, peak: 0.35, type: 'lowpass' }); break;
      case 'screech': tone(t, { f: 900, f2: 300, dur: 0.5, peak: 0.25, wave: 'sawtooth', lp: 2000 }); tone(t, { f: 1340, f2: 420, dur: 0.45, peak: 0.12, wave: 'square', lp: 1800 }); break;
      case 'explosion': burst(t, { dur: 1.3, freq: 900, sweep: 60, q: 0.4, peak: 1, type: 'lowpass' }); tone(t, { f: 60, f2: 25, dur: 1, peak: 0.8 }); break;
      case 'capture': tone(t, { f: 523, dur: 0.12, peak: 0.25, wave: 'triangle' }); tone(t + 0.13, { f: 784, dur: 0.2, peak: 0.25, wave: 'triangle' }); break;
      case 'alarm': for (let i = 0; i < 3; i++) tone(t + i * 0.22, { f: 880, f2: 660, dur: 0.18, peak: 0.2, wave: 'square', lp: 2000 }); break;
      case 'drill': tone(t, { f: 110, f2: 140, dur: 0.8, peak: 0.3, wave: 'sawtooth', lp: 1200 }); burst(t, { dur: 0.8, freq: 2400, q: 2, peak: 0.25 }); break;
      case 'scan': tone(t, { f: 1200, f2: 2400, dur: 0.25, peak: 0.12, wave: 'sine' }); tone(t + 0.3, { f: 1200, f2: 2400, dur: 0.25, peak: 0.08 }); break;
      case 'stim': burst(t, { dur: 0.15, freq: 5000, q: 1, peak: 0.25, type: 'highpass' }); tone(t + 0.05, { f: 300, f2: 900, dur: 0.2, peak: 0.1, wave: 'triangle' }); break;
      case 'heartbeat': for (let i = 0; i < 4; i++) { tone(t + i * 0.42, { f: 70, f2: 40, dur: 0.12, peak: 0.6 }); tone(t + i * 0.42 + 0.16, { f: 60, f2: 35, dur: 0.1, peak: 0.4 }); } break;
      case 'flatline': tone(t, { f: 1000, dur: 1.4, peak: 0.12, wave: 'sine' }); break;
      case 'hiss': burst(t, { dur: 1.2, freq: 5000, q: 0.5, peak: 0.35, type: 'highpass', a: 0.05 }); break;
      case 'pod': burst(t, { dur: 0.7, freq: 400, sweep: 3000, q: 0.5, peak: 0.4 }); burst(t + 0.7, { dur: 0.6, freq: 500, sweep: 80, q: 0.4, peak: 0.8, type: 'lowpass' }); break;
      case 'rumble': tone(t, { f: 35, f2: 28, dur: 2, peak: 0.8, wave: 'sawtooth', lp: 120 }); burst(t, { dur: 2, freq: 120, q: 0.5, peak: 0.6, type: 'lowpass' }); break;
      case 'endturn': tone(t, { f: 392, dur: 0.1, peak: 0.15, wave: 'triangle' }); tone(t + 0.1, { f: 294, dur: 0.18, peak: 0.15, wave: 'triangle' }); break;
      case 'type': burst(t, { dur: 0.015, freq: 3000, q: 3, peak: 0.08 }); break;
      case 'radio': burst(t, { dur: 0.25, freq: 1800, q: 1.5, peak: 0.12 }); tone(t + 0.05, { f: 1400, dur: 0.06, peak: 0.05, wave: 'square' }); break;
      case 'victory': [392, 523, 659, 784].forEach((f, i) => tone(t + i * 0.18, { f, dur: 0.6, peak: 0.2, wave: 'triangle' })); break;
      case 'defeat': [330, 262, 220, 165].forEach((f, i) => tone(t + i * 0.3, { f, dur: 0.8, peak: 0.18, wave: 'sawtooth', lp: 900 })); break;
      default: break;
    }
  };

  /* ---------- Эмбиент ---------- */
  A.ambient = function (kind) {
    if (!ac) return;
    ambNodes.forEach(n => { try { n.stop(); } catch (e) { /* уже остановлен */ } });
    ambNodes = [];
    if (!kind) return;
    const t = ac.currentTime;
    const mk = (f, type, gain, lp) => {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = f;
      const g = ac.createGain(); g.gain.value = gain;
      const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp;
      o.connect(fl); fl.connect(g); g.connect(ambG); o.start(t); ambNodes.push(o);
      return g;
    };
    if (kind === 'surface' || kind === 'storm') {
      const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
      const g = ac.createGain(); g.gain.value = kind === 'storm' ? 0.22 : 0.1;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.08;
      const lg = ac.createGain(); lg.gain.value = 300;
      lfo.connect(lg); lg.connect(f.frequency); lfo.start(t);
      n.connect(f); f.connect(g); g.connect(ambG); n.start(t);
      ambNodes.push(n, lfo);
      mk(41.2, 'sawtooth', 0.05, 160);
      mk(41.9, 'sawtooth', 0.05, 160);
    } else {
      mk(50, 'sawtooth', 0.06, 180);
      mk(100.5, 'sine', 0.02, 400);
      mk(33, 'sine', 0.08, 100);
      const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
      const g = ac.createGain(); g.gain.value = 0.12;
      n.connect(f); f.connect(g); g.connect(ambG); n.start(t); ambNodes.push(n);
    }
  };

  /* ---------- Музыка меню: медленные аккорды ---------- */
  A.music = function (on) {
    if (!ac) return;
    if (musTimer) { clearInterval(musTimer); musTimer = null; }
    musNodes.forEach(n => { try { n.stop(); } catch (e) { /* */ } });
    musNodes = [];
    if (!on) return;
    const chords = [[110, 130.8, 164.8], [87.3, 110, 130.8], [98, 116.5, 146.8], [82.4, 103.8, 123.5]];
    let i = 0;
    const play = () => {
      const t = ac.currentTime + 0.05;
      const ch = chords[i++ % chords.length];
      ch.forEach((f, k) => {
        [0, 3].forEach(det => {
          const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * (1 + det / 1000);
          const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 700;
          const g = ac.createGain();
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 2.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 7.6);
          o.connect(fl); fl.connect(g); g.connect(musG); o.start(t); o.stop(t + 7.8); musNodes.push(o);
        });
        void k;
      });
      if (Math.random() < 0.8) {
        const f = ch[Math.floor(Math.random() * 3)] * 4;
        const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t + 1.5); g.gain.exponentialRampToValueAtTime(0.06, t + 1.52); g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
        o.connect(g); g.connect(musG); o.start(t + 1.5); o.stop(t + 5.2); musNodes.push(o);
      }
      musNodes = musNodes.slice(-40);
    };
    play();
    musTimer = setInterval(play, 7000);
  };
})();
