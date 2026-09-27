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
    soundController.playSpawn();
    soundController.playDash();
    soundController.playArmorExpire();
    soundController.playLife();
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
    for (const [level, expected] of [[4, openings[0]], [5, openings[1]], [6, openings[2]], [7, openings[0]]]) {
      soundController.playBGM(level);
      expect(soundController.song[0].f).toBe(expected);
    }

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

  it('stops a sector-clear cue before the next soundtrack begins', () => {
    soundController.init();
    soundController.playStageClear();
    const clearCue = nodes.filter(node => node.start.mock.calls.length).at(-1);
    expect(clearCue.stop).toHaveBeenCalledTimes(1);

    soundController.playBGM(2);
    expect(clearCue.stop).toHaveBeenCalledTimes(2);
    expect(clearCue.disconnect).toHaveBeenCalled();
    expect(soundController.isPlaying).toBe(true);
  });

  it('stops a game-over cue when the game audio is torn down', () => {
    soundController.init();
    soundController.playDie();
    const gameOverCue = nodes.filter(node => node.start.mock.calls.length).at(-1);

    soundController.stopAll();
    expect(gameOverCue.stop).toHaveBeenCalledTimes(2);
    expect(gameOverCue.disconnect).toHaveBeenCalled();
    expect(soundController.isPlaying).toBe(false);
  });
});
