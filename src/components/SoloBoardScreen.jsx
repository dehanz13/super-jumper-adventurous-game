import { useEffect, useState } from 'react';
import { nextUtcWeekBoundary } from '@/game/soloBoardClient';

export function SoloBoardScreen({ getBoard, onBack, rankedStatus = '' }) {
  const [board, setBoard] = useState('weekly');
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    setPage(null);
    void getBoard(board, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) {
        setPage(result);
        setState('ready');
      }
    }).catch(() => {
      if (!controller.signal.aborted) setState('error');
    });
    return () => controller.abort();
  }, [board, getBoard, refresh, rankedStatus]);

  useEffect(() => {
    if (board !== 'weekly') return undefined;
    const nowMs = Date.now();
    const timer = setTimeout(() => setRefresh(value => value + 1), nextUtcWeekBoundary(nowMs) - nowMs);
    return () => clearTimeout(timer);
  }, [board, refresh]);

  return (
    <section aria-label="Nova solo leaderboard" className="absolute inset-0 overflow-y-auto bg-[#10172E] px-4 py-5 text-white font-mono">
      <div className="mx-auto max-w-lg">
        <button onClick={onBack} aria-label="Back" className="text-[#28D9CF] underline mb-3">← Back</button>
        <h2 className="text-[#F4DB70] text-xl sm:text-3xl font-bold">NOVA SOLO RANKS</h2>
        <p className="text-sm mt-1 mb-4">Completed campaigns only</p>
        <div className="flex gap-2 mb-4" role="group" aria-label="Rank period">
          <button onClick={() => setBoard('weekly')} aria-pressed={board === 'weekly'} className={`px-3 py-2 border-2 ${board === 'weekly' ? 'border-[#28D9CF] bg-[#137F87]' : 'border-[#7788AC]'}`}>This week</button>
          <button onClick={() => setBoard('alltime')} aria-pressed={board === 'alltime'} className={`px-3 py-2 border-2 ${board === 'alltime' ? 'border-[#28D9CF] bg-[#137F87]' : 'border-[#7788AC]'}`}>All time</button>
          <button onClick={() => setRefresh(value => value + 1)} className="ml-auto px-2 py-2 text-[#28D9CF] underline">Refresh</button>
        </div>
        <p className="text-xs mb-3 text-[#B7C5DF]">{board === 'weekly' ? 'Guests and Hearso accounts • current UTC week' : 'Hearso accounts only'}</p>
        {state === 'loading' && <p role="status">Loading solo ranks…</p>}
        {state === 'error' && <p role="alert">Solo ranks are unavailable right now. Try Refresh.</p>}
        {state === 'ready' && page && <>
          <p className="text-xs mb-2">{page.playerCount === null ? 'Player count pending' : `${page.playerCount} ranked ${page.playerCount === 1 ? 'player' : 'players'}`}</p>
          {page.entries.length === 0 ? <p>No completed campaigns on this board yet.</p> :
            <ol className="space-y-1" aria-label="Solo rankings">
              {page.entries.map(entry => <li key={`${entry.rank}-${entry.displayName}`} className="grid grid-cols-[3rem_1fr_auto_auto] gap-2 border-b border-[#7788AC]/40 py-2 text-sm sm:text-base">
                <span>#{entry.rank}</span><span className="truncate">{entry.displayName}</span><span>{entry.country}</span><span>{entry.score.toLocaleString()}</span>
              </li>)}
            </ol>}
        </>}
      </div>
    </section>
  );
}
