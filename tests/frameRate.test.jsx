import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/pages/Game';

const { positions } = vi.hoisted(() => ({ positions: [] }));

vi.mock('../src/game/characterArt', () => ({
  drawCreature: vi.fn(),
  drawExplorer: vi.fn((_ctx, player) => positions.push({ x: player.x, y: player.y })),
}));

vi.mock('../src/components/SoundController', () => ({
  soundController: new Proxy({}, { get: () => vi.fn() }),
}));

describe('game simulation speed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function runForFrames(refreshRate, frameCount, { jump = false, nextLevelFrames = 0 } = {}) {
    const frames = new Map();
    let nextId = 0;
    positions.length = 0;
    const gradient = { addColorStop: vi.fn() };
    const context = new Proxy({}, {
      get: (_target, key) => key === 'createLinearGradient'
        ? () => gradient : () => {},
      set: () => true,
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    vi.stubGlobal('requestAnimationFrame', callback => {
      const id = ++nextId;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', id => frames.delete(id));

    const view = render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /press start/i }));
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    if (jump) fireEvent.keyDown(window, { code: 'Space' });
    const advance = (start, end) => act(() => {
      for (let i = start; i <= end; i++) {
        const [id, callback] = frames.entries().next().value;
        frames.delete(id);
        callback(i * 1000 / refreshRate);
      }
    });
    advance(1, frameCount);
    if (nextLevelFrames) {
      fireEvent.click(screen.getByRole('button', { name: /next sector/i }));
      advance(frameCount + 1, frameCount + nextLevelFrames);
    }
    fireEvent.keyUp(window, { code: 'ArrowRight' });
    if (jump) fireEvent.keyUp(window, { code: 'Space' });
    const result = {
      x: positions.at(-1).x,
      lives: screen.getByText('LIVES').parentElement.textContent,
      clear: Boolean(screen.queryByText('COURSE CLEAR!')),
      sector3: Boolean(screen.queryByText('GET READY FOR SECTOR 3-1')),
      gameOver: Boolean(screen.queryByText('GAME OVER')),
    };
    view.unmount();
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    return result;
  }

  it('keeps movement consistent over 333 ms at 30, 60, and 120 Hz', () => {
    const at30Hz = runForFrames(30, 10).x - 100;
    const at60Hz = runForFrames(60, 20).x - 100;
    const at120Hz = runForFrames(120, 40).x - 100;
    expect(at120Hz).toBeCloseTo(at60Hz, 0);
    expect(Math.abs(at30Hz - at60Hz)).toBeLessThanOrEqual(5);
  });

  it('can complete the first course with normal controls', () => {
    const run = runForFrames(60, 900, { jump: true });
    expect(run.clear, JSON.stringify(run)).toBe(true);
  });

  it('can reach the second course beacon with normal controls', () => {
    const run = runForFrames(60, 900, { jump: true, nextLevelFrames: 1100 });
    expect(run.sector3, JSON.stringify(run)).toBe(true);
  });
});
