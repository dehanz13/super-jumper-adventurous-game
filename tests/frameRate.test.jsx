import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/pages/Game';

const { positions } = vi.hoisted(() => ({ positions: [] }));

vi.mock('../src/game/characterArt', () => ({
  drawCreature: vi.fn(),
  drawExplorer: vi.fn((_ctx, player) => positions.push(player.x)),
}));

vi.mock('../src/components/SoundController', () => ({
  soundController: new Proxy({}, { get: () => vi.fn() }),
}));

describe('game simulation speed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function distanceAfterFrames(refreshRate, frameCount) {
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
    act(() => {
      for (let i = 1; i <= frameCount; i++) {
        const [id, callback] = frames.entries().next().value;
        frames.delete(id);
        callback(i * 1000 / refreshRate);
      }
    });
    fireEvent.keyUp(window, { code: 'ArrowRight' });
    const distance = positions.at(-1) - 100;
    view.unmount();
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    return distance;
  }

  it('keeps movement consistent over 333 ms at 30, 60, and 120 Hz', () => {
    const at30Hz = distanceAfterFrames(30, 10);
    const at60Hz = distanceAfterFrames(60, 20);
    const at120Hz = distanceAfterFrames(120, 40);
    expect(at120Hz).toBeCloseTo(at60Hz, 0);
    expect(Math.abs(at30Hz - at60Hz)).toBeLessThanOrEqual(5);
  });
});
