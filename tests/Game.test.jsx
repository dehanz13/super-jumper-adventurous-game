import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/pages/Game';
import { soundController } from '../src/components/SoundController';

vi.mock('../src/components/SoundController', () => ({
  soundController: {
    init: vi.fn(), playBGM: vi.fn(), stopBGM: vi.fn(), toggleMute: vi.fn(() => true),
    playJump: vi.fn(), playPowerUp: vi.fn(), playCoin: vi.fn(), playStomp: vi.fn(),
    playDie: vi.fn(), playStageClear: vi.fn(), playFireball: vi.fn(),
    playBump: vi.fn(), playKick: vi.fn(),
  },
}));

describe('game entry and first frame', () => {
  let frames;
  let stroke;
  let strokeRect;
  let nextFrameId;
  let fillStyles;

  const stepFrames = (count) => {
    act(() => {
      for (let i = 0; i < count; i++) {
        const next = frames.entries().next().value;
        if (!next) break;
        const [id, frame] = next;
        frames.delete(id);
        frame();
      }
    });
  };

  const openEditor = () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 800, height: 600,
    });
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));
    return container.querySelector('canvas');
  };

  const paint = (canvas, item, x, y) => {
    fireEvent.click(screen.getByText(item));
    fireEvent.mouseDown(canvas, { clientX: x, clientY: y });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    frames = new Map();
    nextFrameId = 0;
    stroke = vi.fn();
    strokeRect = vi.fn();
    fillStyles = [];
    const gradient = { addColorStop: vi.fn() };
    const context = new Proxy({}, {
      get: (_target, property) => property === 'createLinearGradient'
        ? () => gradient
        : property === 'stroke' ? stroke
          : property === 'strokeRect' ? strokeRect : () => {},
      set: (_target, property, value) => {
        if (property === 'fillStyle') fillStyles.push(value);
        return true;
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    vi.stubGlobal('requestAnimationFrame', callback => {
      const id = ++nextFrameId;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', id => frames.delete(id));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens a selected world and accepts keyboard movement', () => {
    render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: '1-1' }));

    expect(screen.getByText('WORLD')).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    stepFrames(1);
    fireEvent.keyUp(window, { code: 'ArrowRight' });
    expect(frames.size).toBeGreaterThan(0);
  });

  it('switches the animation loop into editor drawing mode', () => {
    render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));

    expect(screen.getByText('TOOLS')).toBeInTheDocument();
    stepFrames(1);
    expect(stroke).toHaveBeenCalled();
  });

  it.each([1, 2, 3])('renders movement through world %i', (world) => {
    render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: `${world}-1` }));

    fireEvent.keyDown(window, { code: 'ArrowRight' });
    stepFrames(40);
    fireEvent.keyUp(window, { code: 'ArrowRight' });
    stepFrames(2);

    expect(screen.getByText(`${world}-1`)).toBeInTheDocument();
  });

  it('paints an editor level, saves it, and starts a test run', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 800, height: 600,
    });
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));
    const canvas = container.querySelector('canvas');

    for (const [index, item] of ['Ground', 'Brick', '?', 'Coin', 'Goomba', 'Koopa', 'Plant', 'Spiny', 'Lakitu', 'Bowser', 'Mushroom', 'Fire Flower', 'Star', 'Flag'].entries()) {
      fireEvent.click(screen.getByText(item));
      fireEvent.mouseDown(canvas, { clientX: 64 + index * 48, clientY: 320 });
    }
    stepFrames(1);
    fireEvent.click(screen.getByRole('button', { name: 'Brush tool' }));
    fireEvent.mouseMove(canvas, { buttons: 1, clientX: 96, clientY: 320 });
    fireEvent.click(screen.getByRole('button', { name: 'Eraser tool' }));
    fireEvent.mouseDown(canvas, { clientX: 96, clientY: 320 });
    fireEvent.click(screen.getByRole('button', { name: 'Toggle grid' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save level' }));

    expect(window.alert).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /test/i }));
    stepFrames(3);
    expect(screen.queryByText('TOOLS')).not.toBeInTheDocument();
  });

  it('jumps, pauses, resumes, mutes, and restarts a run', () => {
    render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: '1-1' }));
    stepFrames(30);

    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'Space' });
    stepFrames(120);
    fireEvent.keyUp(window, { code: 'Space' });
    fireEvent.keyUp(window, { code: 'ArrowRight' });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle sound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause game' }));
    expect(screen.getByText('PAUSED')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart game' }));
    expect(screen.getByText('WORLD')).toBeInTheDocument();
  });

  it('finishes a custom course and continues to the next world', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 800, height: 600,
    });
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));
    fireEvent.click(screen.getByText('Flag'));
    fireEvent.mouseDown(container.querySelector('canvas'), { clientX: 96, clientY: 320 });
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    stepFrames(1);
    expect(screen.getByText('COURSE CLEAR!')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next world/i }));
    expect(screen.getByText('2-1')).toBeInTheDocument();
  });

  it('ends a run after repeated falls and allows a restart', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 800, height: 600,
    });
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Eraser tool' }));
    fireEvent.mouseDown(container.querySelector('canvas'), { clientX: 100, clientY: 500 });
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    for (let i = 0; i < 180 && !screen.queryByText('GAME OVER'); i++) stepFrames(1);
    expect(screen.getByText('GAME OVER')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.queryByText('GAME OVER')).not.toBeInTheDocument();
  });

  it('resolves contact with a nearby enemy', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 800, height: 600,
    });
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));
    fireEvent.click(screen.getByText('Goomba'));
    fireEvent.mouseDown(container.querySelector('canvas'), { clientX: 128, clientY: 448 });
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    for (let i = 0; i < 50; i++) stepFrames(1);
    const score = screen.getByText('MARIO').parentElement.textContent;
    expect(score).toBe('MARIO000200');
  });

  it('releases a power-up by hitting a question block', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 800, height: 600,
    });
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));
    const canvas = container.querySelector('canvas');
    fireEvent.click(screen.getByText('?'));
    fireEvent.mouseDown(canvas, { clientX: 96, clientY: 352 });
    fireEvent.click(screen.getByText('Mushroom'));
    fireEvent.mouseDown(canvas, { clientX: 96, clientY: 320 });
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    fireEvent.keyDown(window, { code: 'ArrowRight' });
    for (let i = 0; i < 25; i++) stepFrames(1);
    fireEvent.keyUp(window, { code: 'ArrowRight' });
    for (let i = 0; i < 15; i++) stepFrames(1);
    fireEvent.keyDown(window, { code: 'ArrowLeft' });
    for (let i = 0; i < 22; i++) stepFrames(1);
    fireEvent.keyUp(window, { code: 'ArrowLeft' });
    fireEvent.keyDown(window, { code: 'Space' });
    for (let i = 0; i < 30; i++) stepFrames(1);
    fireEvent.keyUp(window, { code: 'Space' });

    expect(soundController.playPowerUp).toHaveBeenCalled();
  });

  it('lets a nearby boss fire a projectile', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 800, height: 600,
    });
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));
    fireEvent.click(screen.getByText('Bowser'));
    fireEvent.mouseDown(container.querySelector('canvas'), { clientX: 512, clientY: 448 });
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    for (let i = 0; i < 190; i++) stepFrames(1);
    expect(soundController.playFireball).toHaveBeenCalled();
  });

  it('spawns a spiny from a nearby cloud enemy', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 800, height: 600,
    });
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));
    fireEvent.click(screen.getByText('Lakitu'));
    fireEvent.mouseDown(container.querySelector('canvas'), { clientX: 160, clientY: 80 });
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    for (let i = 0; i < 190; i++) stepFrames(1);
    expect(fillStyles).toContain('#A01010');
  });

  it.each([
    ['Koopa', 'score'],
    ['Spiny', 'damage'],
    ['Plant', 'damage'],
    ['Bowser', 'damage'],
  ])('resolves an encounter with %s', (enemy, outcome) => {
    const canvas = openEditor();
    paint(canvas, enemy, 128, 448);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    for (let i = 0; i < 55; i++) stepFrames(1);
    const score = screen.getByText('MARIO').parentElement.textContent;
    const lives = screen.getByText('LIVES').parentElement.textContent;
    if (outcome === 'score') expect(score).not.toBe('MARIO000000');
    else expect(lives).not.toBe('LIVES×3');
  });

  it('collects an editor power-up and fires at an enemy', () => {
    const canvas = openEditor();
    paint(canvas, 'Fire Flower', 96, 320);
    paint(canvas, 'Goomba', 192, 320);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    stepFrames(1);
    expect(screen.getByText('001000')).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'KeyX' });
    for (let i = 0; i < 12; i++) stepFrames(1);
    fireEvent.keyUp(window, { code: 'KeyX' });

    expect(soundController.playFireball).toHaveBeenCalled();
    expect(screen.getByText('001200')).toBeInTheDocument();
  });

  it.each(['Mushroom', 'Star'])('collects a placed %s', (item) => {
    const canvas = openEditor();
    paint(canvas, item, 96, 320);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    stepFrames(1);
    expect(screen.getByText('001000')).toBeInTheDocument();
    expect(soundController.playPowerUp).toHaveBeenCalled();
  });

  it('pops a coin from an empty question block', () => {
    const canvas = openEditor();
    paint(canvas, '?', 96, 352);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    fireEvent.keyDown(window, { code: 'ArrowRight' });
    for (let i = 0; i < 25; i++) stepFrames(1);
    fireEvent.keyUp(window, { code: 'ArrowRight' });
    for (let i = 0; i < 15; i++) stepFrames(1);
    fireEvent.keyDown(window, { code: 'ArrowLeft' });
    for (let i = 0; i < 22; i++) stepFrames(1);
    fireEvent.keyUp(window, { code: 'ArrowLeft' });
    fireEvent.keyDown(window, { code: 'Space' });
    for (let i = 0; i < 30; i++) stepFrames(1);
    fireEvent.keyUp(window, { code: 'Space' });

    expect(screen.getByText('000200')).toBeInTheDocument();
    expect(soundController.playCoin).toHaveBeenCalled();
  });

  it('uses star protection to defeat an enemy on contact', () => {
    const canvas = openEditor();
    paint(canvas, 'Star', 96, 320);
    paint(canvas, 'Goomba', 128, 300);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    stepFrames(2);
    expect(screen.getByText('001200')).toBeInTheDocument();
    expect(soundController.playKick).toHaveBeenCalled();
  });

  it('accepts touch movement and jump controls', () => {
    render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: '1-1' }));
    stepFrames(30);

    const right = screen.getByRole('button', { name: 'Move Right' });
    fireEvent.pointerDown(right, { pointerId: 1, clientX: 120, clientY: 64 });
    stepFrames(2);
    fireEvent.pointerUp(right, { pointerId: 1 });
    const jump = screen.getByRole('button', { name: 'Jump A' });
    fireEvent.pointerDown(jump, { pointerId: 2 });
    stepFrames(1);
    fireEvent.pointerUp(jump, { pointerId: 2 });

    expect(soundController.playJump).toHaveBeenCalled();
  });

  it('collects a coin placed in the player path', () => {
    const canvas = openEditor();
    paint(canvas, 'Coin', 96, 384);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    for (let i = 0; i < 20; i++) stepFrames(1);
    expect(screen.getByText('000100')).toBeInTheDocument();
    expect(soundController.playCoin).toHaveBeenCalled();
  });

  it('shows the editor cursor and pans with arrow keys', () => {
    const canvas = openEditor();
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    stepFrames(2);
    fireEvent.keyUp(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowLeft' });
    stepFrames(2);
    fireEvent.keyUp(window, { code: 'ArrowLeft' });

    expect(strokeRect).toHaveBeenCalled();
  });
});
