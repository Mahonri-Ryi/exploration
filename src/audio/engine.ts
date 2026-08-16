export type SfxName =
  | "ui_click"
  | "ui_hover"
  | "place"
  | "demolish"
  | "error"
  | "coin"
  | "unlock"
  | "whoosh"
  | "construction";

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
];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private dayGain: GainNode | null = null;
  private nightGain: GainNode | null = null;
  private ready = false;
  muted = false;
  masterVolume = 0.85;

  async unlock(): Promise<void> {
    if (this.ready) {
      await this.ctx?.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.gain.value = 0.7;
    this.musicBus.gain.value = 0.38;
    this.master.gain.value = this.masterVolume;
    this.sfxBus.connect(this.master);
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
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = buffer;
    src.playbackRate.value = opts?.rate ?? 0.94 + Math.random() * 0.12;
    gain.gain.value = opts?.volume ?? 1;
    src.connect(gain);
    gain.connect(this.sfxBus);
    src.start();
  }
}
