export interface BgmNote {
  note: string;
  time: number;
  duration: number;
  track: 'melody' | 'bass' | 'arp';
  type?: OscillatorType;
}

export interface BgmDrum {
  type: 'kick' | 'snare' | 'hihat' | 'perc';
  time: number;
}

export interface MusicComposition {
  title: string;
  tempo: number;
  key?: string;
  mood?: string;
  totalBeats: number;
  notes: BgmNote[];
  drumPattern?: BgmDrum[];
}

export const DEFAULT_BGM_COMPOSITION: MusicComposition = {
  title: 'Starmon Celestial Odyssey (AI Theme)',
  tempo: 124,
  key: 'D Minor',
  mood: 'Heroic Fantasy RPG',
  totalBeats: 16,
  notes: [
    // Bassline
    { note: 'D2', time: 0, duration: 1.8, track: 'bass', type: 'triangle' },
    { note: 'D2', time: 2, duration: 1.8, track: 'bass', type: 'triangle' },
    { note: 'Bb1', time: 4, duration: 1.8, track: 'bass', type: 'triangle' },
    { note: 'Bb1', time: 6, duration: 1.8, track: 'bass', type: 'triangle' },
    { note: 'C2', time: 8, duration: 1.8, track: 'bass', type: 'triangle' },
    { note: 'C2', time: 10, duration: 1.8, track: 'bass', type: 'triangle' },
    { note: 'A1', time: 12, duration: 1.8, track: 'bass', type: 'triangle' },
    { note: 'A1', time: 14, duration: 1.8, track: 'bass', type: 'triangle' },
    // Melody
    { note: 'D4', time: 0, duration: 0.8, track: 'melody', type: 'sine' },
    { note: 'F4', time: 1, duration: 0.8, track: 'melody', type: 'sine' },
    { note: 'A4', time: 2, duration: 1.2, track: 'melody', type: 'sine' },
    { note: 'G4', time: 3.5, duration: 0.4, track: 'melody', type: 'sine' },
    { note: 'F4', time: 4, duration: 0.8, track: 'melody', type: 'sine' },
    { note: 'D4', time: 5, duration: 0.8, track: 'melody', type: 'sine' },
    { note: 'E4', time: 6, duration: 1.6, track: 'melody', type: 'sine' },
    { note: 'F4', time: 8, duration: 0.8, track: 'melody', type: 'sine' },
    { note: 'G4', time: 9, duration: 0.8, track: 'melody', type: 'sine' },
    { note: 'A4', time: 10, duration: 1.2, track: 'melody', type: 'sine' },
    { note: 'C5', time: 11.5, duration: 0.4, track: 'melody', type: 'sine' },
    { note: 'D5', time: 12, duration: 1.5, track: 'melody', type: 'sine' },
    { note: 'A4', time: 14, duration: 1.5, track: 'melody', type: 'sine' },
    // Arpeggios
    { note: 'D3', time: 0, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'A3', time: 0.5, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'D4', time: 1, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'F4', time: 1.5, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'Bb3', time: 4, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'D4', time: 4.5, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'F4', time: 5, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'Bb4', time: 5.5, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'C3', time: 8, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'E3', time: 8.5, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'G3', time: 9, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'C4', time: 9.5, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'A3', time: 12, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'C#4', time: 12.5, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'E4', time: 13, duration: 0.4, track: 'arp', type: 'triangle' },
    { note: 'A4', time: 13.5, duration: 0.4, track: 'arp', type: 'triangle' },
  ],
  drumPattern: [
    { type: 'kick', time: 0 },
    { type: 'hihat', time: 0.5 },
    { type: 'snare', time: 1 },
    { type: 'hihat', time: 1.5 },
    { type: 'kick', time: 2 },
    { type: 'hihat', time: 2.5 },
    { type: 'snare', time: 3 },
    { type: 'hihat', time: 3.5 },
    { type: 'kick', time: 4 },
    { type: 'hihat', time: 4.5 },
    { type: 'snare', time: 5 },
    { type: 'hihat', time: 5.5 },
    { type: 'kick', time: 6 },
    { type: 'kick', time: 6.5 },
    { type: 'snare', time: 7 },
    { type: 'hihat', time: 7.5 },
    { type: 'kick', time: 8 },
    { type: 'hihat', time: 8.5 },
    { type: 'snare', time: 9 },
    { type: 'hihat', time: 9.5 },
    { type: 'kick', time: 10 },
    { type: 'hihat', time: 10.5 },
    { type: 'snare', time: 11 },
    { type: 'hihat', time: 11.5 },
    { type: 'kick', time: 12 },
    { type: 'hihat', time: 12.5 },
    { type: 'snare', time: 13 },
    { type: 'hihat', time: 13.5 },
    { type: 'kick', time: 14 },
    { type: 'kick', time: 14.5 },
    { type: 'snare', time: 15 },
    { type: 'hihat', time: 15.5 },
  ],
};

function noteToFreq(note: string): number {
  const noteRegex = /^([A-G][#b]?)([0-8])$/;
  const match = note.match(noteRegex);
  if (!match) return 440;

  const pitch = match[1];
  const octave = parseInt(match[2], 10);

  const semitones: Record<string, number> = {
    'C': -9, 'C#': -8, 'Db': -8,
    'D': -7, 'D#': -6, 'Eb': -6,
    'E': -5,
    'F': -4, 'F#': -3, 'Gb': -3,
    'G': -2, 'G#': -1, 'Ab': -1,
    'A': 0, 'A#': 1, 'Bb': 1,
    'B': 2,
  };

  const semitoneOffset = semitones[pitch] ?? 0;
  const n = semitoneOffset + (octave - 4) * 12;
  return 440 * Math.pow(2, n / 12);
}

// Web Audio API Synthesizer with full AI BGM support
class SoundService {
  private ctx: AudioContext | null = null;
  private musicGainNode: GainNode | null = null;
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;
  private volume: number = 0.7;

  // Music sequencer state
  private currentComposition: MusicComposition = DEFAULT_BGM_COMPOSITION;
  private isBgmPlaying: boolean = false;
  private loopTimeoutId: any = null;
  private activeLoopStartTime: number = 0;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.musicGainNode = this.ctx.createGain();
        this.musicGainNode.gain.setValueAtTime(this.volume * 0.45, this.ctx.currentTime);
        this.musicGainNode.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (enabled) {
      this.startBgmLoop();
    } else {
      this.stopBgm();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.musicGainNode && this.ctx) {
      this.musicGainNode.gain.setTargetAtTime(this.volume * 0.45, this.ctx.currentTime, 0.05);
    }
  }

  public isSoundEnabled() {
    return this.soundEnabled;
  }

  public isMusicEnabled() {
    return this.musicEnabled;
  }

  public getVolume() {
    return this.volume;
  }

  public getCurrentBgm(): MusicComposition {
    return this.currentComposition;
  }

  public setAiBgmComposition(composition: MusicComposition) {
    this.currentComposition = composition;
    if (this.musicEnabled) {
      this.stopBgm();
      this.startBgmLoop();
    }
  }

  // Generate new background music via server Gemini endpoint
  public async generateAiBgm(prompt: string, mood?: string): Promise<MusicComposition> {
    const res = await fetch('/api/generate-bgm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, mood }),
    });
    if (!res.ok) {
      throw new Error(`Failed to generate music: ${res.statusText}`);
    }
    const data: MusicComposition = await res.json();
    this.setAiBgmComposition(data);
    return data;
  }

  public stopBgm() {
    this.isBgmPlaying = false;
    if (this.loopTimeoutId) {
      clearTimeout(this.loopTimeoutId);
      this.loopTimeoutId = null;
    }
  }

  public startBgmLoop() {
    if (!this.musicEnabled) return;
    this.initContext();
    if (!this.ctx || !this.musicGainNode) return;

    this.stopBgm();
    this.isBgmPlaying = true;
    this.scheduleNextLoop();
  }

  private scheduleNextLoop() {
    if (!this.isBgmPlaying || !this.ctx || !this.musicGainNode) return;

    const comp = this.currentComposition;
    const secondsPerBeat = 60 / Math.max(60, comp.tempo || 120);
    const loopDuration = (comp.totalBeats || 16) * secondsPerBeat;
    const startTime = this.ctx.currentTime + 0.05;
    this.activeLoopStartTime = startTime;

    // Schedule Synth Notes
    comp.notes.forEach(item => {
      const noteTime = startTime + item.time * secondsPerBeat;
      const noteDuration = (item.duration || 0.5) * secondsPerBeat;
      const freq = noteToFreq(item.note);

      try {
        const osc = this.ctx!.createOscillator();
        const noteGain = this.ctx!.createGain();

        osc.type = item.type || (item.track === 'bass' ? 'triangle' : item.track === 'melody' ? 'sine' : 'sawtooth');
        osc.frequency.setValueAtTime(freq, noteTime);

        let targetVol = 0.18;
        if (item.track === 'bass') targetVol = 0.28;
        if (item.track === 'arp') targetVol = 0.09;

        noteGain.gain.setValueAtTime(0.001, noteTime);
        noteGain.gain.linearRampToValueAtTime(targetVol, noteTime + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, noteTime + noteDuration);

        osc.connect(noteGain);
        noteGain.connect(this.musicGainNode!);

        osc.start(noteTime);
        osc.stop(noteTime + noteDuration + 0.05);
      } catch {}
    });

    // Schedule Drums
    if (comp.drumPattern) {
      comp.drumPattern.forEach(drum => {
        const drumTime = startTime + drum.time * secondsPerBeat;
        try {
          if (drum.type === 'kick') {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.frequency.setValueAtTime(140, drumTime);
            osc.frequency.exponentialRampToValueAtTime(35, drumTime + 0.12);

            gain.gain.setValueAtTime(0.35, drumTime);
            gain.gain.exponentialRampToValueAtTime(0.001, drumTime + 0.14);

            osc.connect(gain);
            gain.connect(this.musicGainNode!);
            osc.start(drumTime);
            osc.stop(drumTime + 0.15);
          } else if (drum.type === 'snare') {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, drumTime);
            osc.frequency.exponentialRampToValueAtTime(70, drumTime + 0.1);

            gain.gain.setValueAtTime(0.18, drumTime);
            gain.gain.exponentialRampToValueAtTime(0.001, drumTime + 0.12);

            osc.connect(gain);
            gain.connect(this.musicGainNode!);
            osc.start(drumTime);
            osc.stop(drumTime + 0.13);
          } else if (drum.type === 'hihat') {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1200, drumTime);
            osc.frequency.exponentialRampToValueAtTime(8000, drumTime + 0.04);

            gain.gain.setValueAtTime(0.05, drumTime);
            gain.gain.exponentialRampToValueAtTime(0.001, drumTime + 0.05);

            osc.connect(gain);
            gain.connect(this.musicGainNode!);
            osc.start(drumTime);
            osc.stop(drumTime + 0.06);
          }
        } catch {}
      });
    }

    // Schedule next seamless loop slightly before current loop ends
    const waitMs = Math.max(500, (loopDuration - 0.1) * 1000);
    this.loopTimeoutId = setTimeout(() => {
      if (this.isBgmPlaying) {
        this.scheduleNextLoop();
      }
    }, waitMs);
  }

  // Play click / tap UI sound
  public playClick() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.15 * this.volume, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch {
      // Ignore audio errors
    }
  }

  // Play swoosh / screen transition
  public playSwoosh() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(250, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, this.ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.12 * this.volume, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.19);
    } catch {}
  }

  // Play pack tear / crackle
  public playPackTear() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const bufferSize = this.ctx.sampleRate * 0.25;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
      filter.Q.setValueAtTime(3, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25 * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start();
      whiteNoise.stop(this.ctx.currentTime + 0.26);
    } catch {}
  }

  // Play reward fanfare / sparkles
  public playRewardFanfare() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.1);

        gain.gain.setValueAtTime(0, this.ctx!.currentTime + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.2 * this.volume, this.ctx!.currentTime + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.1 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(this.ctx!.currentTime + idx * 0.1);
        osc.stop(this.ctx!.currentTime + idx * 0.1 + 0.45);
      });
    } catch {}
  }

  // Play Level Up sound
  public playLevelUp() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0.22 * this.volume, this.ctx!.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(this.ctx!.currentTime + idx * 0.08);
        osc.stop(this.ctx!.currentTime + idx * 0.08 + 0.4);
      });
    } catch {}
  }

  // Play Match-3 pop
  public playMatchPop(count: number = 3) {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const baseFreq = 480 + Math.min(count, 8) * 60;
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.22 * this.volume, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch {}
  }

  // Play Attack Impact
  public playAttackHit() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.2 * this.volume, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.19);
    } catch {}
  }

  // Play Spell / Skill Explosion
  public playSkillCast() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, this.ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.2 * this.volume, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch {}
  }

  // Play Shield / Defense barrier sound
  public playShield() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(640, this.ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.2 * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.32);
    } catch {}
  }

  // Play Skill Charge / Summoning sound
  public playSkillCharge() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.2 * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.36);
    } catch {}
  }

  // Play Correct Quiz chime
  public playCorrect() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
      osc2.frequency.setValueAtTime(880, this.ctx.currentTime + 0.08); // A5

      gain.gain.setValueAtTime(0.2 * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start();
      osc1.stop(this.ctx.currentTime + 0.15);
      osc2.start(this.ctx.currentTime + 0.08);
      osc2.stop(this.ctx.currentTime + 0.35);
    } catch {}
  }

  // Play Wrong Buzzer
  public playWrong() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, this.ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.18 * this.volume, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.23);
    } catch {}
  }
}

export const sound = new SoundService();
