export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  private started = false;
  muted = false;

  start() {
    this.ensure();
    if (this.started || !this.ctx || !this.master) return;
    this.started = true;
    const ctx = this.ctx;

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 52;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 380;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();

    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.035;
    const padA = ctx.createOscillator();
    const padB = ctx.createOscillator();
    padA.type = "sine";
    padB.type = "sine";
    padA.frequency.value = 110;
    padB.frequency.value = 164.81;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 640;
    padA.connect(padFilter);
    padB.connect(padFilter);
    padFilter.connect(this.padGain).connect(this.master);
    padA.start();
    padB.start();

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(padFilter.frequency);
    lfo.start();

    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = "sine";
    bass.frequency.value = 55;
    bassGain.gain.value = 0.0001;
    bass.connect(bassGain).connect(this.master);
    bass.start();
    const pulse = () => {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      bassGain.gain.cancelScheduledValues(t);
      bassGain.gain.setValueAtTime(0.05, t);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    };
    pulse();
    setInterval(pulse, 1800);

    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer();
    noise.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = "highpass";
    rainFilter.frequency.value = 900;
    noise.connect(rainFilter).connect(this.rainGain).connect(this.master);
    noise.start();

    this.applyMute();
  }

  setEngine(speed: number) {
    if (!this.engineOsc || !this.engineGain) return;
    const moving = speed > 0.4;
    this.engineOsc.frequency.value = 46 + speed * 5.2;
    this.engineGain.gain.value = this.muted || !moving ? 0 : 0.012 + speed * 0.0018;
  }

  setRain(on: boolean) {
    if (!this.rainGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.rainGain.gain.cancelScheduledValues(t);
    this.rainGain.gain.linearRampToValueAtTime(this.muted || !on ? 0 : 0.045, t + 0.4);
  }

  beep(freq: number, dur = 0.12, type: OscillatorType = "square", gain = 0.05) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!this.master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  orderPing() {
    this.beep(784, 0.09, "sine", 0.05);
    setTimeout(() => this.beep(1046, 0.14, "sine", 0.05), 90);
  }

  pickup() {
    this.beep(660, 0.07, "sine", 0.05);
    setTimeout(() => this.beep(880, 0.08, "sine", 0.05), 70);
    setTimeout(() => this.beep(1320, 0.12, "sine", 0.045), 140);
  }

  success() {
    this.beep(523, 0.08, "sine", 0.055);
    setTimeout(() => this.beep(659, 0.09, "sine", 0.05), 80);
    setTimeout(() => this.beep(784, 0.1, "sine", 0.05), 160);
    setTimeout(() => this.beep(1046, 0.22, "sine", 0.055), 250);
  }

  crash() {
    this.beep(70, 0.22, "sawtooth", 0.07);
    this.beep(42, 0.28, "square", 0.04);
  }

  nearMiss() {
    this.beep(240, 0.05, "sine", 0.03);
    setTimeout(() => this.beep(420, 0.08, "sine", 0.035), 40);
  }

  combo(n: number) {
    this.beep(420 + Math.min(n, 12) * 40, 0.06, "triangle", 0.03);
  }

  engine(speed: number) {
    this.setEngine(speed);
  }

  applyMute() {
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
  }

  private ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private noiseBuffer() {
    const ctx = this.ctx!;
    const n = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
