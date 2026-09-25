import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { soundController } from '../src/components/SoundController';

describe('game audio', () => {
  let nodes;

  beforeEach(() => {
    vi.useFakeTimers();
    nodes = [];
    const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
    const node = () => {
      const result = { frequency: parameter(), gain: parameter(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      nodes.push(result);
      return result;
    };
    vi.stubGlobal('AudioContext', class {
      state = 'suspended';
      currentTime = 1;
      destination = {};
      resume = vi.fn();
      createGain = node;
      createOscillator = node;
    });
    soundController.stopBGM();
    soundController.ctx = null;
    soundController.masterGain = null;
    soundController.isMuted = false;
  });

  afterEach(() => {
    soundController.stopBGM();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('initializes audio after interaction and suppresses effects while muted', () => {
    soundController.playJump();
    soundController.playLand();
    expect(nodes).toHaveLength(0);

    soundController.init();
    soundController.playJump();
    soundController.playLand();
    soundController.playCoin();
    soundController.playStomp();
    soundController.playFireball();
    soundController.playPowerUp();
    soundController.playBump();
    soundController.playKick();
    soundController.playDamage();
    soundController.playSelect();
    vi.runOnlyPendingTimers();
    expect(nodes.some(node => node.start.mock.calls.length > 0)).toBe(true);

    const beforeMute = nodes.length;
    expect(soundController.toggleMute()).toBe(true);
    soundController.playJump();
    expect(nodes).toHaveLength(beforeMute);
    expect(soundController.toggleMute()).toBe(false);
  });

  it('schedules each world soundtrack and stops it for finish sounds', () => {
    soundController.init();
    const openings = [];
    for (const level of [1, 2, 3]) {
      soundController.playBGM(level);
      expect(soundController.song.length).toBeGreaterThan(0);
      expect(soundController.isPlaying).toBe(true);
      expect(soundController.currentBgm).toBe(level);
      openings.push(soundController.song[0].f);
      vi.advanceTimersByTime(300);
    }
    expect(new Set(openings).size).toBe(3);

    soundController.playStageClear();
    expect(soundController.isPlaying).toBe(false);
    soundController.playBGM(1);
    soundController.playDie();
    expect(soundController.isPlaying).toBe(false);
  });

  it('keeps the music loop alive while muted and resumes audible notes', () => {
    soundController.init();
    soundController.playBGM(2);
    soundController.playDamage();
    expect(soundController.isPlaying).toBe(true);
    expect(soundController.toggleMute()).toBe(true);
    const before = nodes.length;
    vi.advanceTimersByTime(600);
    expect(soundController.isPlaying).toBe(true);
    expect(nodes).toHaveLength(before);

    expect(soundController.toggleMute()).toBe(false);
    vi.advanceTimersByTime(600);
    expect(nodes.length).toBeGreaterThan(before);
    soundController.stopBGM();
    expect(soundController.currentBgm).toBeNull();
  });

  it('stops music for a finish even when muted', () => {
    soundController.init();
    soundController.toggleMute();
    soundController.playBGM(3);
    expect(soundController.isPlaying).toBe(true);
    soundController.playStageClear();
    expect(soundController.isPlaying).toBe(false);
    soundController.playBGM(1);
    soundController.playDie();
    expect(soundController.isPlaying).toBe(false);
  });
});
