// Replace these track definitions, or the SoundController renderer, without
// changing the gameplay events that request music.
const D3 = 146.83, F3 = 174.61, A3 = 220.00;
const D4 = 293.66, F4 = 349.23, G4 = 392.00, A4 = 440.00;
const C5 = 523.25, D5 = 587.33, F5 = 698.46;

export const AUDIO_TRACKS = {
  1: {
    tempo: 156,
    notes: [
      { f: D4, d: 0.25 }, { f: F4, d: 0.15 }, { f: A4, d: 0.35 },
      { f: null, d: 0.1 }, { f: G4, d: 0.2 }, { f: F4, d: 0.2 },
      { f: C5, d: 0.3 }, { f: A4, d: 0.4 }, { f: null, d: 0.15 },
    ],
  },
  2: {
    tempo: 112,
    notes: [
      { f: D3, d: 0.3 }, { f: null, d: 0.1 }, { f: F3, d: 0.15 },
      { f: A3, d: 0.3 }, { f: F3, d: 0.15 }, { f: D3, d: 0.4 },
      { f: null, d: 0.2 },
    ],
  },
  3: {
    tempo: 132,
    notes: [
      { f: F5, d: 0.25 }, { f: D5, d: 0.15 }, { f: A4, d: 0.35 },
      { f: null, d: 0.1 }, { f: C5, d: 0.2 }, { f: G4, d: 0.25 },
      { f: D5, d: 0.4 }, { f: null, d: 0.2 },
    ],
  },
};
