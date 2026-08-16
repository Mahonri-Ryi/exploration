export type SfxName =
  | "ui_click"
  | "ui_hover"
  | "place"
  | "demolish"
  | "error"
  | "coin"
  | "unlock"
  | "whoosh"
  | "construction"
  | "fire";

const SFX: SfxName[] = [
  "ui_click",
  "ui_hover",
  "place",
  "demolish",
  "error",
  "coin",
  "unlock",
  "whoosh",
  "construction",
  "fire",
];

const UI_SFX = new Set<SfxName>(["ui_click", "ui_hover"]);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private uiBus: GainNode | null = null;
  private worldBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private dayGain: GainNode | null = null;
  private nightGain: GainNode | null = null;
  private ready = false;
  muted = false;
  masterVolume = 0.82;
  lastPlayed: SfxName | null = null;
  private unlocking: Promise<void> | null = null;

  async unlock(): Promise<void> {
    if (this.ready) {
      await this.ctx?.resume();
      return;
    }
    if (this.unlocking) return this.unlocking;
    this.unlocking = this.init();
    try {
      await this.unlocking;
    } finally {
      this.unlocking = null;
    }
  }

  private async init(): Promise<void> {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.uiBus = ctx.createGain();
    this.worldBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.gain.value = 0.78;
    this.uiBus.gain.value = 0.62;
    this.worldBus.gain.value = 0.88;
    this.musicBus.gain.value = 0.34;
    this.master.gain.value = this.masterVolume;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 2.4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.16;

    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx, 0.16, 0.22);
    const wet = ctx.createGain();
    wet.gain.value = 0.14;
    const dry = ctx.createGain();
    dry.gain.value = 0.92;

    this.uiBus.connect(this.sfxBus);
    this.worldBus.connect(dry);
    this.worldBus.connect(convolver);
    convolver.connect(wet);
    dry.connect(this.sfxBus);
    wet.connect(this.sfxBus);
    this.sfxBus.connect(compressor);
    compressor.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(ctx.destination);

    const names = [...SFX, "ambient_day", "ambient_night"];
    await Promise.all(
      names.map(async (name) => {
        const res = await fetch(`./assets/audio/${name}.ogg`);
        const buf = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(buf.slice(0));
        this.buffers.set(name, decoded);
      }),
    );

    this.dayGain = ctx.createGain();
    this.nightGain = ctx.createGain();
    this.dayGain.gain.value = 1;
    this.nightGain.gain.value = 0;
    this.loop("ambient_day", this.dayGain);
    this.loop("ambient_night", this.nightGain);
    this.dayGain.connect(this.musicBus);
    this.nightGain.connect(this.musicBus);
    this.ready = true;
  }

  private loop(name: string, gain: GainNode): void {
    if (!this.ctx) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(gain);
    src.start();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.masterVolume;
  }

  setDayNight(night: number): void {
    if (!this.ctx || !this.dayGain || !this.nightGain) return;
    const n = Math.max(0, Math.min(1, night));
    const t = this.ctx.currentTime;
    this.dayGain.gain.cancelScheduledValues(t);
    this.nightGain.gain.cancelScheduledValues(t);
    this.dayGain.gain.linearRampToValueAtTime(1 - n, t + 0.4);
    this.nightGain.gain.linearRampToValueAtTime(n, t + 0.4);
  }

  play(name: SfxName, opts?: { volume?: number; rate?: number }): void {
    if (!this.ctx || !this.uiBus || !this.worldBus) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    this.lastPlayed = name;
    if (this.muted) return;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = buffer;
    const ui = UI_SFX.has(name);
    src.playbackRate.value = opts?.rate ?? (ui ? 1 : 0.98 + Math.random() * 0.04);
    gain.gain.value = opts?.volume ?? 1;
    src.connect(gain);
    gain.connect(ui ? this.uiBus : this.worldBus);
    src.start();
  }

  report(): {
    ready: boolean;
    muted: boolean;
    lastPlayed: SfxName | null;
    buffers: { name: string; duration: number; channels: number; sampleRate: number }[];
  } {
    const buffers = [...this.buffers.entries()].map(([name, buf]) => ({
      name,
      duration: buf.duration,
      channels: buf.numberOfChannels,
      sampleRate: buf.sampleRate,
    }));
    return { ready: this.ready, muted: this.muted, lastPlayed: this.lastPlayed, buffers };
  }
}

function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, 1.8) * decay;
      data[i] = (Math.random() * 2 - 1) * env;
    }
  }
  return ir;
}
