export const Audio = {
  ctx: null,
  enabled: true,
  master: null,
  ambGain: null,
  ambOsc: null,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.ambGain = this.ctx.createGain();
      this.ambGain.gain.value = 0.0;
      this.ambGain.connect(this.master);
      this.ambOsc = this.ctx.createOscillator();
      this.ambOsc.type = "sine";
      this.ambOsc.frequency.value = 110;
      const amb2 = this.ctx.createOscillator();
      amb2.type = "sine"; amb2.frequency.value = 110 * 1.5;
      const g2 = this.ctx.createGain(); g2.gain.value = 0.4;
      this.ambOsc.connect(this.ambGain);
      amb2.connect(g2); g2.connect(this.ambGain);
      this.ambOsc.start(); amb2.start();
    } catch (e) { this.ctx = null; }
  },

  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },

  blip(freq, dur, type = "square", vol = 0.3, slideTo = null) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  coin()     { this.blip(880, 0.09, "triangle", 0.25, 1320); },
  pay()      { this.blip(660, 0.06, "triangle", 0.18, 990); },
  build()    { this.blip(150, 0.12, "square", 0.25, 80); },
  bow()      { this.blip(420, 0.08, "sawtooth", 0.12, 180); },
  hit()      { this.blip(200, 0.07, "square", 0.2, 90); },
  enemyDie() { this.blip(140, 0.18, "sawtooth", 0.22, 50); },
  recruit()  { this.blip(523, 0.08, "triangle", 0.22); setTimeout(() => this.blip(784, 0.12, "triangle", 0.22), 80); },
  upgrade()  {
    this.blip(523, 0.1, "triangle", 0.25);
    setTimeout(() => this.blip(659, 0.1, "triangle", 0.25), 90);
    setTimeout(() => this.blip(880, 0.16, "triangle", 0.28), 180);
  },
  horn()     { this.blip(160, 0.6, "sawtooth", 0.3, 130); setTimeout(() => this.blip(120, 0.8, "sawtooth", 0.28, 100), 120); },

  setNight(isNight) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.ambGain.gain.cancelScheduledValues(t);
    this.ambGain.gain.linearRampToValueAtTime(isNight ? 0.10 : 0.04, t + 2);
    this.ambOsc.frequency.linearRampToValueAtTime(isNight ? 70 : 110, t + 2);
  },

  toggle() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.value = this.enabled ? 0.35 : 0;
    return this.enabled;
  },
};
