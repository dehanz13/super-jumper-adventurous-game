class SoundController {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmOscillators = [];
    this.isMuted = false;
    this.currentBgm = null;
    this.nextNoteTime = 0;
    this.bgmTimer = null;
    this.isPlaying = false;
    this.tempo = 120;
    this.song = [];
    this.noteIndex = 0;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new window.AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : 0.3;
    }
    return this.isMuted;
  }

  // --- Sound Effects ---

  playJump() {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playCoin() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1174.66, t); // D6
    osc.frequency.setValueAtTime(1396.91, t + 0.08); // F6
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.setValueAtTime(0.2, t + 0.3);
    gain.gain.linearRampToValueAtTime(0, t + 0.4);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(t + 0.4);
  }

  playStomp() {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playFireball() {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playPowerUp() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    // Arpeggio
    [0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach((delay, i) => {
       setTimeout(() => {
           if(this.isMuted) return;
           osc.frequency.setValueAtTime(440 + i * 100, this.ctx.currentTime);
       }, delay * 1000);
    });
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.5);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.6);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(t + 0.6);
  }

  playBump() {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playKick() {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playDie() {
    if (!this.ctx || this.isMuted) return;
    this.stopBGM();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';

    osc.frequency.setValueAtTime(600, t);
    osc.frequency.setValueAtTime(500, t + 0.1);
    osc.frequency.setValueAtTime(400, t + 0.2);
    osc.frequency.linearRampToValueAtTime(100, t + 1.5);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.setValueAtTime(0.5, t + 2);
    gain.gain.linearRampToValueAtTime(0, t + 2.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(t + 2.1);
  }

  playStageClear() {
    if (!this.ctx || this.isMuted) return;
    this.stopBGM();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';

    // A rising whole-tone phrase for reaching a course beacon.
    const notes = [293.66, 329.63, 369.99, 415.3, 466.16, 523.25];
    notes.forEach((freq, i) => {
        osc.frequency.setValueAtTime(freq, t + i * 0.1);
    });
    osc.frequency.setValueAtTime(523.25, t + 0.6);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.setValueAtTime(0.3, t + 2);
    gain.gain.linearRampToValueAtTime(0, t + 3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(t + 3);
  }

  // --- Background Music (Simple Sequencer) ---

  stopBGM() {
    this.isPlaying = false;
    clearTimeout(this.bgmTimer);
    this.bgmOscillators.forEach(o => {
        try { o.stop(); o.disconnect(); } catch {}
    });
    this.bgmOscillators = [];
  }

  playBGM(levelType) {
    if (this.isMuted || !this.ctx) return;
    this.stopBGM();
    this.isPlaying = true;

    // Note frequencies
    const D3 = 146.83, F3 = 174.61, A3 = 220.00;
    const D4 = 293.66, F4 = 349.23, G4 = 392.00, A4 = 440.00;
    const C5 = 523.25, D5 = 587.33, F5 = 698.46;

    if (levelType === 2) { // Caverns
        this.tempo = 112;
        this.song = [
            {f: D3, d: 0.3}, {f: null, d: 0.1}, {f: F3, d: 0.15},
            {f: A3, d: 0.3}, {f: F3, d: 0.15}, {f: D3, d: 0.4},
            {f: null, d: 0.2}
        ];
    } else if (levelType === 3) { // High canopies
        this.tempo = 132;
        this.song = [
            {f: F5, d: 0.25}, {f: D5, d: 0.15}, {f: A4, d: 0.35},
            {f: null, d: 0.1}, {f: C5, d: 0.2}, {f: G4, d: 0.25},
            {f: D5, d: 0.4}, {f: null, d: 0.2}
        ];
    } else { // Meadow route
        this.tempo = 156;
        this.song = [
            {f: D4, d: 0.25}, {f: F4, d: 0.15}, {f: A4, d: 0.35},
            {f: null, d: 0.1}, {f: G4, d: 0.2}, {f: F4, d: 0.2},
            {f: C5, d: 0.3}, {f: A4, d: 0.4}, {f: null, d: 0.15}
        ];
    }

    this.noteIndex = 0;
    this.scheduleNote();
  }

  scheduleNote() {
    if (!this.isPlaying || !this.ctx || this.isMuted) return;

    const note = this.song[this.noteIndex];
    const nextNoteIndex = (this.noteIndex + 1) % this.song.length;

    if (note.f) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.value = note.f;

        gain.gain.value = 0.1;
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + note.d); // Decay

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + note.d);
        this.bgmOscillators.push(osc);

        // Clean up old oscillators
        if (this.bgmOscillators.length > 5) this.bgmOscillators.shift();
    }

    const interval = note.d * 1000 * (120 / this.tempo); // rough tempo adj

    this.bgmTimer = setTimeout(() => {
        this.noteIndex = nextNoteIndex;
        this.scheduleNote();
    }, interval);
  }
}

export const soundController = new SoundController();
