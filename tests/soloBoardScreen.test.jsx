import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SoloBoardScreen } from '../src/components/SoloBoardScreen';
import { currentUtcWeek } from '../src/game/soloBoardClient';

describe('solo leaderboard screen', () => {
  it('shows current weekly ranks, switches to accounts all-time, and returns', async () => {
    const getBoard = vi.fn(async board => ({
      period: board === 'weekly' ? 'weekly-2026-W39' : 'alltime', playerCount: board === 'weekly' ? 2 : 0,
      entries: board === 'weekly' ? [{ rank: 1, displayName: 'Nova', country: 'US', score: 420 }] : [],
    }));
    const onBack = vi.fn();
    render(<SoloBoardScreen getBoard={getBoard} onBack={onBack} />);
    expect(await screen.findByText('Nova')).toBeInTheDocument();
    expect(screen.getByText('2 ranked players')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All time' }));
    expect(await screen.findByText('No completed campaigns on this board yet.')).toBeInTheDocument();
    expect(screen.getByText('Hearso accounts only')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(getBoard).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows a safe retry state when the public read fails', async () => {
    const getBoard = vi.fn().mockRejectedValueOnce(new Error('secret response')).mockResolvedValueOnce({ period: 'weekly-2026-W39', playerCount: null, entries: [] });
    render(<SoloBoardScreen getBoard={getBoard} onBack={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
    expect(screen.queryByText('secret response')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Player count pending')).toBeInTheDocument();
  });

  it('replaces an open weekly page at Monday 00:00 UTC', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T23:59:59.800Z'));
    try {
      const getBoard = vi.fn(async () => ({
        period: currentUtcWeek(Date.now()), playerCount: 1,
        entries: [{ rank: 1, displayName: currentUtcWeek(Date.now()), country: 'US', score: 10 }],
      }));
      render(<SoloBoardScreen getBoard={getBoard} onBack={vi.fn()} />);
      await act(async () => {});
      expect(screen.getByText('weekly-2026-W39')).toBeInTheDocument();
      await act(async () => { vi.advanceTimersByTime(200); });
      expect(getBoard).toHaveBeenCalledTimes(2);
      expect(screen.getByText('weekly-2026-W40')).toBeInTheDocument();
      expect(screen.queryByText('weekly-2026-W39')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
