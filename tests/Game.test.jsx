import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/pages/Game';
import { soundController } from '../src/components/SoundController';
import { currentRunVersions } from '../src/game/rankedRunVerifier';

vi.mock('../src/components/SoundController', () => ({
  soundController: {
    init: vi.fn(), playBGM: vi.fn(), stopBGM: vi.fn(), toggleMute: vi.fn(() => true),
    playJump: vi.fn(), playPowerUp: vi.fn(), playCoin: vi.fn(), playStomp: vi.fn(),
    playDie: vi.fn(), playStageClear: vi.fn(), playFireball: vi.fn(), playLand: vi.fn(),
    playBump: vi.fn(), playKick: vi.fn(), playDamage: vi.fn(), playSelect: vi.fn(),
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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens sector selection when the intro finishes', () => {
    vi.useFakeTimers();
    render(<Game />);

    act(() => vi.advanceTimersByTime(4500));

    expect(screen.getByText('STARTS IN SECTOR 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /press start/i })).toBeInTheDocument();
  });

  it('opens a selected world and accepts keyboard movement', () => {
    render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /press start/i }));

    expect(screen.getByText('SECTOR')).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    stepFrames(1);
    fireEvent.keyUp(window, { code: 'ArrowRight' });
    expect(frames.size).toBeGreaterThan(0);
  });

  it('starts ranked play only after the guest run service issues a matching run', async () => {
    const runClient = { start: vi.fn(async () => ({
      runId: '123e4567-e89b-42d3-a456-426614174000', runToken: 'a'.repeat(43),
      versions: currentRunVersions(),
    })) };
    render(<Game runClient={runClient} />);
    fireEvent.click(screen.getByText(/skip/i));
    expect(screen.getByRole('button', { name: /press start/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Public name'), { target: { value: 'Nova' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'US' } });
    fireEvent.click(screen.getByRole('button', { name: /press start/i }));
    await waitFor(() => expect(runClient.start).toHaveBeenCalledWith({ guestProfile: { displayName: 'Nova', country: 'US' } }));
    await waitFor(() => expect(screen.getByRole('button', { name: /pause game/i })).toBeInTheDocument());
  });

  it('keeps local play available when the ranking service cannot start', async () => {
    const runClient = { start: vi.fn(async () => { throw new Error('offline'); }) };
    render(<Game runClient={runClient} />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.change(screen.getByLabelText('Public name'), { target: { value: 'Nova' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'US' } });
    fireEvent.click(screen.getByRole('button', { name: /press start/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Ranking is unavailable'));
    fireEvent.click(screen.getByRole('button', { name: /play locally/i }));
    expect(screen.getByRole('button', { name: /pause game/i })).toBeInTheDocument();
  });

  it('stops background music when the embedded game unmounts', () => {
    const view = render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /press start/i }));
    expect(soundController.playBGM).toHaveBeenCalledWith(1);

    view.unmount();
    expect(soundController.stopBGM).toHaveBeenCalledTimes(1);
  });

  it('switches the animation loop into editor drawing mode', () => {
    render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));

    expect(screen.getByText('TOOLS')).toBeInTheDocument();
    stepFrames(1);
    expect(stroke).toHaveBeenCalled();
  });

  it('starts the first sector and renders movement', () => {
    render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /press start/i }));

    fireEvent.keyDown(window, { code: 'ArrowRight' });
    stepFrames(40);
    fireEvent.keyUp(window, { code: 'ArrowRight' });
    stepFrames(2);

    expect(screen.getByText('1-1')).toBeInTheDocument();
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

    for (const [index, item] of ['Terrain', 'Alloy Block', '?', 'Star Shard', 'Pebblit', 'Rollpod', 'Signal Snare', 'Prismite', 'Hovermite', 'Warden', 'Power Cell', 'Plasma Core', 'Spectrum Shield', 'Beacon'].entries()) {
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
    fireEvent.click(screen.getByRole('button', { name: /press start/i }));
    stepFrames(30);

    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'Space' });
    stepFrames(120);
    fireEvent.keyUp(window, { code: 'Space' });
    fireEvent.keyUp(window, { code: 'ArrowRight' });
    expect(soundController.playLand).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle sound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause game' }));
    expect(screen.getByText('PAUSED')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart game' }));
    expect(screen.getByText('SECTOR')).toBeInTheDocument();
  });

  it('finishes a custom course and continues to the next world', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 800, height: 600,
    });
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));
    fireEvent.click(screen.getByText('Beacon'));
    fireEvent.mouseDown(container.querySelector('canvas'), { clientX: 96, clientY: 320 });
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    stepFrames(1);
    expect(screen.getByText('COURSE CLEAR!')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next sector/i }));
    expect(screen.getByText('2-1')).toBeInTheDocument();
  });

  it('ends a run after repeated falls and allows a restart', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 800, height: 600,
    });
    vi.stubGlobal('alert', vi.fn());
    const onRunComplete = vi.fn();
    const { container } = render(<Game onRunComplete={onRunComplete} />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Eraser tool' }));
    fireEvent.mouseDown(container.querySelector('canvas'), { clientX: 100, clientY: 500 });
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    for (let i = 0; i < 180 && !screen.queryByText('GAME OVER'); i++) stepFrames(1);
    expect(screen.getByText('GAME OVER')).toBeInTheDocument();
    expect(onRunComplete).toHaveBeenCalledTimes(1);
    expect(onRunComplete.mock.calls[0][0]).toMatchObject({
      transcript: { mode: 'custom', endedAs: 'gameover' }, submissionCandidate: false,
    });
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
    fireEvent.click(screen.getByText('Pebblit'));
    fireEvent.mouseDown(container.querySelector('canvas'), { clientX: 128, clientY: 448 });
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    for (let i = 0; i < 50; i++) stepFrames(1);
    const score = screen.getByText('NOVA').parentElement.textContent;
    expect(score).toBe('NOVA000200');
    expect(screen.getByText('SHARDS').parentElement.textContent).toBe('SHARDS✦×00');
  });

  it('awards a sector clear once when reaching the beacon', () => {
    const canvas = openEditor();
    paint(canvas, 'Beacon', 128, 320);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    stepFrames(4);
    expect(screen.getByText('COURSE CLEAR!')).toBeInTheDocument();
    expect(screen.getByText('SCORE: 001000')).toBeInTheDocument();
    expect(soundController.playStageClear).toHaveBeenCalledTimes(1);

    stepFrames(4);
    expect(screen.getByText('SCORE: 001000')).toBeInTheDocument();
    expect(soundController.playStageClear).toHaveBeenCalledTimes(1);
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
    fireEvent.click(screen.getByText('Power Cell'));
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
    fireEvent.click(screen.getByText('Warden'));
    fireEvent.mouseDown(container.querySelector('canvas'), { clientX: 512, clientY: 448 });
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    for (let i = 0; i < 190; i++) stepFrames(1);
    expect(soundController.playFireball).toHaveBeenCalled();
  });

  it('spawns a crystal creature from a nearby hovering enemy', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 800, height: 600,
    });
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));
    fireEvent.click(screen.getByText('Hovermite'));
    fireEvent.mouseDown(container.querySelector('canvas'), { clientX: 160, clientY: 80 });
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    for (let i = 0; i < 190; i++) stepFrames(1);
    expect(fillStyles).toContain('#F38173');
  });

  it.each([
    ['Rollpod', 'score'],
    ['Prismite', 'damage'],
    ['Signal Snare', 'damage'],
    ['Warden', 'damage'],
  ])('resolves an encounter with %s', (enemy, outcome) => {
    const canvas = openEditor();
    paint(canvas, enemy, 128, 448);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    for (let i = 0; i < 55; i++) stepFrames(1);
    const score = screen.getByText('NOVA').parentElement.textContent;
    const lives = screen.getByText('LIVES').parentElement.textContent;
    if (outcome === 'score') expect(score).not.toBe('NOVA000000');
    else expect(lives).not.toBe('LIVES×3');
  });

  it('collects an editor power-up and fires at an enemy', () => {
    const canvas = openEditor();
    paint(canvas, 'Plasma Core', 96, 320);
    paint(canvas, 'Pebblit', 192, 320);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    stepFrames(1);
    expect(screen.getByText('001000')).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'KeyX' });
    for (let i = 0; i < 12; i++) stepFrames(1);
    fireEvent.keyUp(window, { code: 'KeyX' });

    expect(soundController.playFireball).toHaveBeenCalled();
    expect(screen.getByText('001200')).toBeInTheDocument();
    expect(soundController.playStomp).not.toHaveBeenCalled();
  });

  it('spaces plasma shots by simulation steps while wall time stands still', () => {
    const canvas = openEditor();
    paint(canvas, 'Plasma Core', 96, 320);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));
    stepFrames(1);
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    fireEvent.keyDown(window, { code: 'KeyX' });
    stepFrames(1);
    expect(soundController.playFireball).toHaveBeenCalledTimes(1);
    stepFrames(17);
    expect(soundController.playFireball).toHaveBeenCalledTimes(1);
    stepFrames(1);
    expect(soundController.playFireball).toHaveBeenCalledTimes(2);
    fireEvent.keyUp(window, { code: 'KeyX' });
  });

  it('retracts a rollpod when a plasma shot hits it', () => {
    const canvas = openEditor();
    paint(canvas, 'Plasma Core', 96, 320);
    paint(canvas, 'Rollpod', 192, 320);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    stepFrames(1);
    fireEvent.keyDown(window, { code: 'KeyX' });
    stepFrames(12);
    fireEvent.keyUp(window, { code: 'KeyX' });

    expect(soundController.playFireball).toHaveBeenCalled();
    expect(screen.getByText('001200')).toBeInTheDocument();
    expect(soundController.playStomp).not.toHaveBeenCalled();
  });

  it('registers a plasma shot against the course warden', () => {
    const canvas = openEditor();
    paint(canvas, 'Plasma Core', 96, 320);
    paint(canvas, 'Warden', 224, 320);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    stepFrames(1);
    fireEvent.keyDown(window, { code: 'KeyX' });
    stepFrames(20);
    fireEvent.keyUp(window, { code: 'KeyX' });

    expect(soundController.playKick).toHaveBeenCalled();
  });

  it.each(['Power Cell', 'Spectrum Shield'])('collects a placed %s', (item) => {
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

    stepFrames(35);
    fireEvent.keyDown(window, { code: 'Space' });
    stepFrames(30);
    fireEvent.keyUp(window, { code: 'Space' });
    expect(soundController.playBump).toHaveBeenCalled();
  });

  it('uses star protection to defeat an enemy on contact', () => {
    const canvas = openEditor();
    paint(canvas, 'Spectrum Shield', 96, 320);
    paint(canvas, 'Pebblit', 128, 320);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    stepFrames(2);
    expect(screen.getByText('001200')).toBeInTheDocument();
    expect(soundController.playKick).toHaveBeenCalled();
  });

  it('lets the spectrum shield withstand a course warden encounter', () => {
    const canvas = openEditor();
    paint(canvas, 'Spectrum Shield', 96, 320);
    paint(canvas, 'Warden', 128, 320);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    stepFrames(2);
    expect(screen.getByText('LIVES').parentElement.textContent).toBe('LIVES×3');
    expect(soundController.playPowerUp).toHaveBeenCalled();
  });

  it('consumes a power cell instead of a life when hit by a prismite', () => {
    const canvas = openEditor();
    paint(canvas, 'Power Cell', 96, 320);
    paint(canvas, 'Prismite', 128, 320);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    stepFrames(2);
    expect(screen.getByText('LIVES').parentElement.textContent).toBe('LIVES×3');
    expect(soundController.playPowerUp).toHaveBeenCalled();
  });

  it('accepts touch movement and jump controls', () => {
    render(<Game />);
    fireEvent.click(screen.getByText(/skip/i));
    fireEvent.click(screen.getByRole('button', { name: /press start/i }));
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
    paint(canvas, 'Star Shard', 96, 384);
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    for (let i = 0; i < 20; i++) stepFrames(1);
    expect(screen.getByText('000100')).toBeInTheDocument();
    expect(screen.getByText('SHARDS').parentElement.textContent).toBe('SHARDS✦×01');
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
