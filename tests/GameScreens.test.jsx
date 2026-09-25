import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameOverScreen, StartScreen, WinScreen } from '../src/components/GameScreens';

describe('game screens', () => {
  it('starts the selected world and opens the level editor', () => {
    const onStart = vi.fn();
    const onEnterEditor = vi.fn();
    render(<StartScreen onStart={onStart} onEnterEditor={onEnterEditor} />);

    fireEvent.click(screen.getByText(/press start/i));
    fireEvent.click(screen.getByRole('button', { name: '2-1' }));
    fireEvent.click(screen.getByRole('button', { name: /level creator/i }));

    expect(onStart).toHaveBeenCalledWith(1);
    expect(onStart).toHaveBeenCalledWith(2);
    expect(onEnterEditor).toHaveBeenCalledOnce();
  });

  it('restarts after a game over and shows the final score', () => {
    const onRestart = vi.fn();
    render(<GameOverScreen score={125} level={3} onRestart={onRestart} />);

    expect(screen.getByText('SCORE: 000125')).toBeInTheDocument();
    expect(screen.getByText('SECTOR 3-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('restarts after winning and shows the final score', () => {
    const onRestart = vi.fn();
    render(<WinScreen score={4000} onRestart={onRestart} />);

    expect(screen.getByText('004000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /play again/i }));
    expect(onRestart).toHaveBeenCalledOnce();
  });
});
