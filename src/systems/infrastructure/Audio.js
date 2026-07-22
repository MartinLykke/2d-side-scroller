export const Audio = {
  ctx: null,
  enabled: true,
  master: null,
  reverbNode: null,
  reverbGain: null,
  ambGain: null,
  ambOsc: null,
  ambFilter: null,

  // MP3 sample buffers & ambient loop nodes
  _buffers: {},
  _birdsSource: null,
  _birdsGain: null,
  _fireSource: null,
  _fireGain: null,
  _birdsTarget: 0,
  _fireTarget: 0,

  async _loadBuffer(name, url) {
    try {
      const resp = await fetch(url);
      const ab = await resp.arrayBuffer();
      this._buffers[name] = await this.ctx.decodeAudioData(ab);
    } catch (e) { /* silent: sound just won't play */ }
  },

  _playSample(name, vol = 0.3) {
    if (!this.ctx || !this.enabled || !this._buffers[name]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._buffers[name];
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.master);
    src.start();
  },

  _startAmbientLoop(bufferName, gainProp, srcProp, vol) {
    if (!this._buffers[bufferName] || this[srcProp]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._buffers[bufferName];
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(g);
    g.connect(this.master);
    src.start();
    this[srcProp] = src;
    this[gainProp] = g;
  },

  updateAmbientZones(playerX, baseX, forestStartDist) {
    if (!this.ctx || !this.enabled) return;
    const distFromBase = Math.abs(playerX - baseX);
    const inForest = distFromBase > forestStartDist;
    const nearBase = distFromBase < 350;

    this._birdsTarget = inForest ? 0.35 : 0;
    this._fireTarget = nearBase ? 0.25 : 0;

    this._startAmbientLoop("birds", "_birdsGain", "_birdsSource", 0.35);
    this._startAmbientLoop("fire", "_fireGain", "_fireSource", 0.25);

    if (this._birdsGain) {
      const g = this._birdsGain.gain;
      g.value += (this._birdsTarget - g.value) * 0.04;
    }
    if (this._fireGain) {
      const g = this._fireGain.gain;
      g.value += (this._fireTarget - g.value) * 0.04;
    }
  },

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);

      this._loadBuffer("birds", "assets/sounds/birdssound.mp3");
      this._loadBuffer("fire", "assets/sounds/firesound.mp3");
      this._loadBuffer("bowLoad", "assets/sounds/bow loading.mp3");
      this._loadBuffer("bowRelease", "assets/sounds/bow release.mp3");

      // Reverb via convolver
      this._buildReverb();

      // Ambient drone - richer layered sound
      this.ambGain = this.ctx.createGain();
      this.ambGain.gain.value = 0.0;
      this.ambFilter = this.ctx.createBiquadFilter();
      this.ambFilter.type = 'lowpass';
      this.ambFilter.frequency.value = 200;
      this.ambFilter.Q.value = 1;
      this.ambGain.connect(this.ambFilter);
      this.ambFilter.connect(this.master);

      // Deep drone
      this.ambOsc = this.ctx.createOscillator();
      this.ambOsc.type = 'sine';
      this.ambOsc.frequency.value = 55;
      this.ambOsc.connect(this.ambGain);
      this.ambOsc.start();

      // Harmonic layer
      const amb2 = this.ctx.createOscillator();
      amb2.type = 'sine';
      amb2.frequency.value = 82.5;
      const g2 = this.ctx.createGain();
      g2.gain.value = 0.3;
      amb2.connect(g2);
      g2.connect(this.ambGain);
      amb2.start();

      // Sub bass rumble
      const amb3 = this.ctx.createOscillator();
      amb3.type = 'triangle';
      amb3.frequency.value = 36;
      const g3 = this.ctx.createGain();
      g3.gain.value = 0.2;
      amb3.connect(g3);
      g3.connect(this.ambGain);
      amb3.start();

    } catch (e) { this.ctx = null; }
  },

  _buildReverb() {
    const length = this.ctx.sampleRate * 1.5;
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = impulse;
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.25;
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.master);
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  // --- Core synthesis helpers ---

  _noise(duration, vol, filter, filterFreq, Q, dest) {
    const bufSize = this.ctx.sampleRate * duration;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(g);
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = filter;
      f.frequency.value = filterFreq || 1000;
      f.Q.value = Q || 1;
      g.connect(f);
      f.connect(dest || this.master);
    } else {
      g.connect(dest || this.master);
    }
    src.start(t);
    src.stop(t + duration);
    return { src, gain: g };
  },

  _osc(freq, dur, type, vol, envelope, dest) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (envelope) {
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(vol, t + (envelope.attack || 0.01));
      g.gain.setValueAtTime(vol, t + (envelope.attack || 0.01));
      if (envelope.decay) {
        g.gain.exponentialRampToValueAtTime(
          vol * (envelope.sustain || 0.5),
          t + (envelope.attack || 0.01) + envelope.decay
        );
      }
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    } else {
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    }
    o.connect(g);
    g.connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
    return { osc: o, gain: g };
  },

  _pitchOsc(freq, endFreq, dur, type, vol, dest) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
    return { osc: o, gain: g };
  },

  // --- Game sound effects ---

  chirp() {
    if (!this.ctx || !this.enabled) return;
    // quick two-note songbird flutter as a startled bird takes off
    const base = 2300 + Math.random() * 900;
    this._pitchOsc(base, base * 1.45, 0.06, 'sine', 0.045);
    setTimeout(() => {
      if (this.ctx && this.enabled) this._pitchOsc(base * 1.2, base * 0.85, 0.08, 'sine', 0.035);
    }, 70 + Math.random() * 50);
  },

  coin() {
    if (!this.ctx || !this.enabled) return;
    // Metallic chime with harmonics
    this._osc(1200, 0.12, 'sine', 0.15, { attack: 0.005, decay: 0.05, sustain: 0.3 });
    this._osc(1800, 0.08, 'sine', 0.08, { attack: 0.005, decay: 0.03, sustain: 0.2 });
    this._osc(2400, 0.06, 'triangle', 0.05, { attack: 0.003 });
    // Tiny metallic noise burst
    this._noise(0.04, 0.06, 'bandpass', 4000, 5);
  },

  pay() {
    if (!this.ctx || !this.enabled) return;
    // Softer coin-like tink
    this._osc(900, 0.08, 'sine', 0.1, { attack: 0.003, decay: 0.03, sustain: 0.3 });
    this._osc(1350, 0.06, 'sine', 0.06, { attack: 0.003 });
    this._noise(0.03, 0.04, 'highpass', 3000, 2);
  },

  build() {
    if (!this.ctx || !this.enabled) return;
    // Heavy thunk + wood creak
    this._pitchOsc(200, 60, 0.2, 'square', 0.2);
    this._noise(0.15, 0.18, 'lowpass', 400, 2);
    setTimeout(() => {
      this._noise(0.08, 0.1, 'bandpass', 800, 3);
      this._osc(120, 0.1, 'triangle', 0.08);
    }, 60);
  },

  _bowLast: 0,
  _bowCount: 0,

  bowLoad() {
    if (!this.ctx || !this.enabled) return;
    this._playSample("bowLoad", 0.25);
  },

  bow() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (t - this._bowLast < 0.05) { this._bowCount++; if (this._bowCount > 3) return; }
    else { this._bowCount = 0; }
    this._bowLast = t;

    if (this._buffers.bowRelease) {
      this._playSample("bowRelease", Math.max(0.08, 0.25 - this._bowCount * 0.05));
    } else {
      const vol = Math.max(0.04, 0.1 - this._bowCount * 0.02);
      this._noise(0.07, vol * 0.6, 'bandpass', 900 + Math.random() * 300, 1.8);
    }
  },

  arrowHit() {
    if (!this.ctx || !this.enabled) return;
    // Thud + impact
    this._pitchOsc(300, 80, 0.08, 'sine', 0.15);
    this._noise(0.06, 0.12, 'lowpass', 600, 2);
  },

  hit() {
    if (!this.ctx || !this.enabled) return;
    // Melee impact — chunky
    this._pitchOsc(250, 60, 0.12, 'square', 0.18);
    this._noise(0.1, 0.2, 'lowpass', 500, 1.5);
    this._noise(0.05, 0.08, 'bandpass', 1200, 4);
  },

  playerHit() {
    if (!this.ctx || !this.enabled) return;
    // Pain impact — deeper, with crunch
    this._pitchOsc(180, 40, 0.15, 'square', 0.22);
    this._noise(0.12, 0.25, 'lowpass', 350, 1);
    this._osc(100, 0.1, 'sine', 0.15, { attack: 0.005, decay: 0.05, sustain: 0.3 });
    // Send to reverb for weight
    this._noise(0.08, 0.1, 'lowpass', 600, 2, this.reverbNode);
  },

  enemyDie() {
    if (!this.ctx || !this.enabled) return;
    // Descending screech + thud
    this._pitchOsc(400, 80, 0.25, 'sawtooth', 0.15);
    this._noise(0.2, 0.15, 'lowpass', 300, 1);
    setTimeout(() => {
      this._pitchOsc(120, 40, 0.12, 'square', 0.1);
      this._noise(0.08, 0.1, 'lowpass', 200, 1);
    }, 100);
  },

  swordSwing() {
    if (!this.ctx || !this.enabled) return;
    // Fast swoosh
    this._noise(0.12, 0.12, 'bandpass', 1500, 4);
    this._pitchOsc(600, 200, 0.1, 'sine', 0.04);
  },

  spell() {
    if (!this.ctx || !this.enabled) return;
    // Magical shimmer + whoosh
    this._osc(600, 0.3, 'sine', 0.1, { attack: 0.02, decay: 0.1, sustain: 0.5 });
    this._osc(900, 0.25, 'sine', 0.06, { attack: 0.03, decay: 0.08, sustain: 0.4 });
    this._pitchOsc(1200, 400, 0.35, 'triangle', 0.05);
    this._noise(0.2, 0.06, 'highpass', 3000, 2, this.reverbNode);
    // Sparkle
    setTimeout(() => {
      this._osc(1600, 0.08, 'sine', 0.04);
      this._osc(2000, 0.06, 'sine', 0.03);
    }, 80);
  },

  fireball() {
    if (!this.ctx || !this.enabled) return;
    // Whoosh + crackle
    this._pitchOsc(200, 80, 0.3, 'sawtooth', 0.12);
    this._noise(0.25, 0.15, 'bandpass', 800, 2);
    this._noise(0.3, 0.08, 'highpass', 2000, 3, this.reverbNode);
    this._osc(100, 0.2, 'sine', 0.1, { attack: 0.02, decay: 0.1, sustain: 0.4 });
  },

  explosion() {
    if (!this.ctx || !this.enabled) return;
    // Big boom + debris
    this._pitchOsc(100, 20, 0.4, 'square', 0.3);
    this._noise(0.4, 0.35, 'lowpass', 300, 0.5);
    this._noise(0.3, 0.15, 'bandpass', 600, 2, this.reverbNode);
    setTimeout(() => {
      this._noise(0.3, 0.12, 'lowpass', 200, 1);
      this._pitchOsc(60, 20, 0.3, 'sine', 0.15);
    }, 80);
    setTimeout(() => {
      this._noise(0.2, 0.06, 'highpass', 1500, 3);
    }, 200);
  },

  recruit() {
    if (!this.ctx || !this.enabled) return;
    // Cheerful ascending chime
    this._osc(523, 0.12, 'triangle', 0.15, { attack: 0.01, decay: 0.04, sustain: 0.5 });
    setTimeout(() => {
      this._osc(659, 0.12, 'triangle', 0.15, { attack: 0.01, decay: 0.04, sustain: 0.5 });
    }, 80);
    setTimeout(() => {
      this._osc(784, 0.18, 'triangle', 0.18, { attack: 0.01, decay: 0.06, sustain: 0.5 });
      this._osc(1568, 0.1, 'sine', 0.05);
    }, 160);
  },

  upgrade() {
    if (!this.ctx || !this.enabled) return;
    // Triumphant fanfare
    this._osc(523, 0.14, 'triangle', 0.18, { attack: 0.01, decay: 0.05, sustain: 0.6 });
    setTimeout(() => {
      this._osc(659, 0.14, 'triangle', 0.18, { attack: 0.01, decay: 0.05, sustain: 0.6 });
    }, 100);
    setTimeout(() => {
      this._osc(784, 0.14, 'triangle', 0.2, { attack: 0.01, decay: 0.05, sustain: 0.6 });
    }, 200);
    setTimeout(() => {
      this._osc(1047, 0.25, 'triangle', 0.22, { attack: 0.01, decay: 0.1, sustain: 0.5 });
      this._osc(1568, 0.15, 'sine', 0.06);
      this._noise(0.08, 0.04, 'highpass', 4000, 3, this.reverbNode);
    }, 300);
  },

  horn() {
    if (!this.ctx || !this.enabled) return;
    // War horn - deep and ominous with vibrato
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t);
    o.frequency.linearRampToValueAtTime(90, t + 0.8);
    // Vibrato via LFO
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 5;
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + 1.2);

    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.15);
    g.gain.setValueAtTime(0.25, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    o.connect(g);
    g.connect(this.master);
    g.connect(this.reverbNode);
    o.start(t);
    o.stop(t + 1.3);

    // Sub harmonic
    this._osc(55, 1.0, 'sine', 0.12, { attack: 0.15, decay: 0.3, sustain: 0.4 });
  },

  wallBreak() {
    if (!this.ctx || !this.enabled) return;
    // Crumbling stone
    this._pitchOsc(150, 30, 0.3, 'square', 0.2);
    this._noise(0.35, 0.25, 'lowpass', 400, 1, this.reverbNode);
    this._noise(0.2, 0.15, 'bandpass', 900, 3);
    setTimeout(() => {
      this._noise(0.25, 0.1, 'lowpass', 250, 1);
    }, 120);
  },

  treeFall() {
    if (!this.ctx || !this.enabled) return;
    // Creaking wood + crash
    this._pitchOsc(200, 100, 0.3, 'sawtooth', 0.08);
    this._noise(0.15, 0.1, 'bandpass', 600, 4);
    setTimeout(() => {
      this._pitchOsc(100, 30, 0.2, 'square', 0.15);
      this._noise(0.25, 0.2, 'lowpass', 400, 1);
    }, 200);
  },

  pickup() {
    if (!this.ctx || !this.enabled) return;
    // Quick satisfying pop + shimmer
    this._pitchOsc(400, 800, 0.08, 'sine', 0.12);
    this._osc(1200, 0.06, 'sine', 0.05);
    this._noise(0.03, 0.04, 'highpass', 5000, 3);
  },

  chest() {
    if (!this.ctx || !this.enabled) return;
    // Creaky open + sparkle reveal
    this._noise(0.15, 0.1, 'bandpass', 400, 5);
    this._pitchOsc(100, 200, 0.12, 'triangle', 0.06);
    setTimeout(() => {
      this._osc(800, 0.1, 'sine', 0.08, { attack: 0.02, decay: 0.03, sustain: 0.4 });
      this._osc(1200, 0.08, 'sine', 0.05, { attack: 0.03 });
      this._osc(1600, 0.06, 'sine', 0.03, { attack: 0.04 });
      this._noise(0.05, 0.03, 'highpass', 4000, 4);
    }, 120);
  },

  levelUp() {
    if (!this.ctx || !this.enabled) return;
    // Majestic ascending arpeggio with shimmer
    const notes = [523, 659, 784, 1047, 1318];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this._osc(freq, 0.2 + i * 0.04, 'triangle', 0.14 - i * 0.01, { attack: 0.01, decay: 0.05, sustain: 0.5 });
        this._osc(freq * 2, 0.1, 'sine', 0.03);
      }, i * 70);
    });
    setTimeout(() => {
      this._noise(0.1, 0.04, 'highpass', 5000, 3, this.reverbNode);
    }, 350);
  },

  death() {
    if (!this.ctx || !this.enabled) return;
    // Dramatic descending + reverb tail
    this._pitchOsc(300, 60, 0.6, 'sawtooth', 0.2, this.reverbNode);
    this._noise(0.4, 0.2, 'lowpass', 250, 1);
    this._osc(80, 0.5, 'sine', 0.15, { attack: 0.05, decay: 0.2, sustain: 0.3 });
    setTimeout(() => {
      this._pitchOsc(100, 30, 0.4, 'square', 0.12, this.reverbNode);
    }, 200);
  },

  footstep() {
    if (!this.ctx || !this.enabled) return;
    // Subtle crunch
    const pitch = 80 + Math.random() * 40;
    this._noise(0.06, 0.06 + Math.random() * 0.02, 'lowpass', 300 + Math.random() * 100, 1);
    this._pitchOsc(pitch, pitch * 0.5, 0.04, 'sine', 0.03);
  },

  jump() {
    if (!this.ctx || !this.enabled) return;
    // Ascending whoosh
    this._pitchOsc(150, 400, 0.12, 'sine', 0.08);
    this._noise(0.08, 0.06, 'bandpass', 1500, 3);
  },

  land() {
    if (!this.ctx || !this.enabled) return;
    // Thud
    this._pitchOsc(120, 40, 0.08, 'sine', 0.1);
    this._noise(0.06, 0.08, 'lowpass', 300, 1);
  },

  portalSpawn() {
    if (!this.ctx || !this.enabled) return;
    // Eerie rising drone
    this._pitchOsc(80, 200, 0.4, 'sawtooth', 0.1, this.reverbNode);
    this._osc(150, 0.3, 'sine', 0.08, { attack: 0.1, decay: 0.1, sustain: 0.5 });
    this._noise(0.3, 0.06, 'bandpass', 1000, 5, this.reverbNode);
  },

  dragonRoar() {
    if (!this.ctx || !this.enabled) return;
    // Monstrous roar — layered
    const t = this.ctx.currentTime;
    // Core growl with pitch drop
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.8);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.1);
    g.gain.setValueAtTime(0.25, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g);
    g.connect(this.master);
    g.connect(this.reverbNode);
    o.start(t);
    o.stop(t + 1.0);
    // Noise layer
    this._noise(0.7, 0.2, 'lowpass', 500, 1, this.reverbNode);
    this._noise(0.5, 0.08, 'bandpass', 1200, 3);
    // Sub rumble
    this._osc(40, 0.8, 'sine', 0.15, { attack: 0.1, decay: 0.3, sustain: 0.4 });
  },

  // Arcanum staff cast voices — one per school, layered over spell().
  arcanumCast(school) {
    if (!this.ctx || !this.enabled) return;
    switch (school) {
      case "bramble": // creaking, splitting growth
        this._noise(0.24, 0.09, 'bandpass', 420, 3);
        this._pitchOsc(190, 85, 0.3, 'triangle', 0.06);
        break;
      case "prism": // struck glass splitting into overtones
        this._osc(1600, 0.2, 'sine', 0.05, { attack: 0.004, decay: 0.07, sustain: 0.3 });
        this._osc(2150, 0.15, 'sine', 0.035);
        this._noise(0.1, 0.04, 'highpass', 6000, 2, this.reverbNode);
        break;
      case "spore": // a wet, sour rupture
        this._noise(0.32, 0.11, 'lowpass', 700, 1.2);
        this._pitchOsc(240, 110, 0.34, 'sawtooth', 0.05);
        break;
      case "gravitywell": // the room inhaling
        this._pitchOsc(70, 210, 0.55, 'sine', 0.15);
        this._noise(0.4, 0.06, 'lowpass', 260, 0.8, this.reverbNode);
        break;
      case "leech": // two thick heartbeats
        this._pitchOsc(150, 60, 0.2, 'sine', 0.12);
        setTimeout(() => this._pitchOsc(130, 55, 0.16, 'sine', 0.08), 140);
        break;
      case "resonance": // a bell with a long tail
        this._osc(880, 0.9, 'sine', 0.09, { attack: 0.004, decay: 0.3, sustain: 0.35 });
        this._osc(1320, 0.7, 'sine', 0.05, { attack: 0.004, decay: 0.25, sustain: 0.3 });
        this._osc(2640, 0.4, 'sine', 0.022);
        this._noise(0.12, 0.05, 'highpass', 4000, 2, this.reverbNode);
        break;
    }
  },

  // Procedural staff cast flourish — one of five textures (haze/hum/
  // heartbeat/sparks/motes), pitched by the rolled element's voice.
  spellFlourish(kind, pitch = 500) {
    if (!this.ctx || !this.enabled) return;
    switch (kind) {
      case "haze":
        this._noise(0.3, 0.08, 'bandpass', pitch * 0.8, 1.4, this.reverbNode);
        this._pitchOsc(pitch * 0.6, pitch * 1.3, 0.35, 'sine', 0.03);
        break;
      case "hum":
        this._osc(pitch, 0.4, 'sine', 0.07, { attack: 0.05, decay: 0.2, sustain: 0.6 });
        this._osc(pitch * 1.5, 0.3, 'sine', 0.03, { attack: 0.08 });
        break;
      case "heartbeat":
        this._pitchOsc(pitch * 0.25, pitch * 0.15, 0.1, 'sine', 0.14);
        setTimeout(() => { if (this.ctx && this.enabled) this._pitchOsc(pitch * 0.22, pitch * 0.12, 0.09, 'sine', 0.1); }, 140);
        break;
      case "sparks":
        for (let i = 0; i < 4; i++) {
          setTimeout(() => { if (this.ctx && this.enabled) this._noise(0.03, 0.05, 'highpass', pitch * (1 + Math.random()), 6); }, i * 35);
        }
        break;
      case "motes":
        this._osc(pitch, 0.1, 'sine', 0.05, { attack: 0.01 });
        setTimeout(() => { if (this.ctx && this.enabled) this._osc(pitch * 1.25, 0.1, 'sine', 0.04); }, 60);
        setTimeout(() => { if (this.ctx && this.enabled) this._osc(pitch * 1.5, 0.12, 'sine', 0.035); }, 120);
        break;
    }
  },

  // --- Ambient control ---

  setNight(isNight) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.ambGain.gain.cancelScheduledValues(t);
    this.ambGain.gain.linearRampToValueAtTime(isNight ? 0.12 : 0.04, t + 3);
    this.ambOsc.frequency.linearRampToValueAtTime(isNight ? 45 : 55, t + 3);
    this.ambFilter.frequency.linearRampToValueAtTime(isNight ? 150 : 250, t + 3);
  },

  toggle() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.value = this.enabled ? 0.4 : 0;
    return this.enabled;
  },
};
