import { useRef, useState } from 'react';
import { Hammer } from 'lucide-react';
import { gsap, useGSAP } from '@/lib/animation';
import { ASSIGNED_COUNTRY_CODES } from '@/shared/assignedCountries';

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function OrbitPlanet({ className = '' }) {
  return <svg className={`orbit-planet pointer-events-none absolute right-[4%] top-[5%] w-[clamp(80px,24%,150px)] opacity-80 ${className}`} viewBox="0 0 160 160" aria-hidden="true">
    <defs>
      <linearGradient id="orbit-world" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#A595EA"/><stop offset=".55" stopColor="#6756B8"/><stop offset="1" stopColor="#27375F"/></linearGradient>
      <clipPath id="orbit-clip"><circle cx="80" cy="80" r="46"/></clipPath>
    </defs>
    <circle cx="80" cy="80" r="61" fill="none" stroke="#28D9CF" strokeOpacity=".18" strokeWidth="1" strokeDasharray="3 7"/>
    <ellipse cx="80" cy="83" rx="72" ry="24" fill="none" stroke="#17243F" strokeWidth="13" transform="rotate(-22 80 83)"/>
    <ellipse cx="80" cy="83" rx="72" ry="24" fill="none" stroke="#28D9CF" strokeWidth="6" transform="rotate(-22 80 83)"/>
    <circle cx="80" cy="80" r="46" fill="url(#orbit-world)" stroke="#17243F" strokeWidth="5"/>
    <g clipPath="url(#orbit-clip)" fill="none" stroke="#E7FAFF" strokeOpacity=".35" strokeWidth="6"><path d="M30 62q37-22 103 1M26 91q45-15 104 16M38 118q48-13 79 5"/></g>
    <g fill="#27375F" opacity=".5"><circle cx="64" cy="64" r="6"/><circle cx="96" cy="98" r="8"/><circle cx="99" cy="55" r="4"/></g>
    <path d="M15 106q59 24 130-46" fill="none" stroke="#E7FAFF" strokeWidth="3" strokeOpacity=".85"/>
    <path d="M132 21h5m-2-3v6M20 35h5m-2-3v6" stroke="#F4DB70" strokeWidth="2"/>
  </svg>;
}

export function GameOverScreen({ score, level, onRestart }) {
  return (
    <div className="absolute inset-0 bg-[#10172E] flex flex-col items-center justify-center" style={{ fontFamily: 'monospace' }}>
      <div className="text-[#F38173] text-5xl font-bold mb-4" style={{ textShadow: '3px 3px 0 #000' }}>
        GAME OVER
      </div>
      <div className="text-white text-2xl mb-2">SCORE: {String(score).padStart(6, '0')}</div>
      <div className="text-[#F4DB70] text-xl mb-4">SECTOR {level}-1</div>
      <button
        onClick={onRestart}
        className="mt-6 bg-[#6756B8] hover:bg-[#8878D7] text-white font-bold px-8 py-4 border-4 border-black text-xl transition-colors"
        style={{ textShadow: '1px 1px 0 #000' }}
      >
        ▶ TRY AGAIN
      </button>
    </div>
  );
}

export function WinScreen({ score, onRestart, onLeaderboard = null, rankState = null }) {
  return (
    <div className="absolute inset-0 bg-[#10172E] flex flex-col items-center justify-center" style={{ fontFamily: 'monospace' }}>
      <div className="text-[#F4DB70] text-3xl font-bold mb-2" style={{ textShadow: '3px 3px 0 #6756B8' }}>
        ★ CONGRATULATIONS ★
      </div>
      <div className="text-white text-5xl font-bold mb-4" style={{ textShadow: '3px 3px 0 #6756B8' }}>
        YOU WIN!
      </div>
      <div className="text-white text-xl mb-2">ALL SECTORS CLEARED!</div>
      <div className="text-[#F4DB70] text-3xl mb-1">FINAL SCORE</div>
      <div className="text-white text-4xl mb-2">{String(score).padStart(6, '0')}</div>
      {rankState && <div role="status" className="text-white text-sm text-center px-4 mb-2">
        {rankState.status === 'verifying' && 'Verifying your campaign…'}
        {rankState.status === 'pending_write' && 'Score verified. Publishing your weekly rank…'}
        {rankState.status === 'ranked' && (rankState.ranks?.find(rank => rank.board === 'weekly')
          ? `Weekly rank #${rankState.ranks.find(rank => rank.board === 'weekly').rank}`
          : 'Score published to the weekly board.')}
        {rankState.status === 'rejected' && 'This run could not be verified for ranking.'}
        {rankState.status === 'delivery_failed' && 'Score verified, but leaderboard delivery failed.'}
        {rankState.status === 'unavailable' && 'Ranking is unavailable. Your local score is still shown.'}
      </div>}
      {onLeaderboard && <button onClick={onLeaderboard} className="text-[#28D9CF] underline px-4 py-2">View solo ranks</button>}
      <button
        onClick={onRestart}
        className="mt-6 bg-[#28D9CF] hover:bg-[#E7FAFF] text-[#17243F] font-bold px-8 py-4 border-4 border-black text-xl transition-colors"
      >
        ▶ PLAY AGAIN
      </button>
    </div>
  );
}

export function StartScreen({ onStart, onEnterEditor, onLeaderboard = null, rankedEnabled = false, returningGuest = false, starting = false, startError = '', onLocalStart = null }) {
  const rootRef = useRef(null);
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('');

  useGSAP(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    gsap.timeline({ defaults: { ease: 'power2.out' } })
      .fromTo('.start-title', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7 })
      .fromTo('.start-actions', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5 }, '-=0.3');
    gsap.to('.orbit-planet', { y: -8, rotation: 3, duration: 4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }, { scope: rootRef });

  return (
    <div ref={rootRef} className="start-screen absolute inset-0 overflow-hidden" style={{ fontFamily: 'monospace', background: 'radial-gradient(circle at 78% 14%, #435382 0, #25385F 35%, #10172E 82%)' }}>
      <OrbitPlanet />
      <div className="start-title text-center relative z-10">
        <div className="text-[#F4DB70] text-base sm:text-2xl font-bold sm:mb-2" style={{ textShadow: '3px 3px 0 #17243F' }}>NOVA'S</div>
        <div className="text-[#28D9CF] text-2xl sm:text-6xl font-black mb-1" style={{ textShadow: '4px 4px 0 #000, 6px 6px 0 #6756B8', letterSpacing: '4px' }}>
          ORBIT JUMP
        </div>
        <div className="text-white text-xs sm:text-lg sm:mt-4" style={{ textShadow: '2px 2px 0 #000' }}>A COSMIC ADVENTURE</div>
      </div>

      <div className="start-menu relative z-10 flex flex-col items-center justify-center">
      {rankedEnabled && !returningGuest && <div className="start-actions start-identity relative z-10 mb-3 text-white text-sm">
        <div><label htmlFor="guest-name">Public name</label>
        <input id="guest-name" maxLength={32} autoComplete="nickname" value={displayName} onChange={event => setDisplayName(event.target.value)} className="bg-[#10172E] border border-[#28D9CF] px-2 py-1" /></div>
        <div><label htmlFor="guest-country">Country</label>
        <select id="guest-country" value={country} onChange={event => setCountry(event.target.value)} className="bg-[#10172E] border border-[#28D9CF] px-2 py-1">
          <option value="">Choose a country</option>
          {ASSIGNED_COUNTRY_CODES.map(code => <option key={code} value={code}>{countryNames.of(code)} ({code})</option>)}
        </select></div>
      </div>}
      {returningGuest && rankedEnabled && <p className="start-actions text-white text-sm mb-2 relative z-10">Continue your weekly guest rank</p>}
      <button className="start-actions text-white text-base sm:text-xl font-bold mb-5 sm:mb-4 cursor-pointer hover:text-[#F4DB70] transition-colors motion-safe:animate-pulse relative z-10 disabled:opacity-50"
        onClick={() => rankedEnabled && !returningGuest
          ? onStart({ displayName: displayName.trim(), country }) : onStart()}
        disabled={starting || (rankedEnabled && !returningGuest && (!displayName.trim() || !country))}
        style={{ textShadow: '2px 2px 0 #000' }}
      >
        {starting ? 'STARTING…' : '▶ PRESS START ◀'}
      </button>
      {startError && <div role="alert" className="relative z-10 text-[#F38173] text-sm mb-2 text-center px-4">{startError}</div>}
      {rankedEnabled && onLocalStart && <button onClick={onLocalStart} className="relative z-10 text-white text-sm underline mb-2">Play locally without ranking</button>}
      {onLeaderboard && <button onClick={onLeaderboard} className="start-actions relative z-10 text-[#28D9CF] text-sm underline mb-2">View solo ranks</button>}

      <div className="start-actions bg-[#10172E]/80 border border-[#28D9CF]/50 p-2 sm:p-4 rounded-lg text-center relative z-10">
        <div className="text-[#F4DB70] mb-2">STARTS IN SECTOR 1</div>
        <button onClick={onEnterEditor}
          className="flex items-center gap-2 bg-[#137F87] hover:bg-[#28D9CF] text-white font-bold px-4 py-1 sm:px-8 sm:py-3 border-4 border-[#17243F] transition-colors"
          style={{ textShadow: '1px 1px 0 #000' }}>
          <Hammer className="w-5 h-5" /> LEVEL CREATOR
        </button>
      </div>
      </div>

      <div className="start-instructions text-white text-center text-xs sm:text-sm relative z-10 space-y-1" style={{ textShadow: '1px 1px 0 #000' }}>
        <p className="mb-1"><span className="sm:hidden">←→ MOVE • A JUMP • B FIRE</span><span className="hidden sm:inline">← → MOVE • ↑/SPACE/A JUMP • X/Z/B FIRE</span></p>
        <p className="text-[#F4DB70]">BOUNCE OFF PEBBLITS • GATHER STARS • REACH THE BEACON!</p>
      </div>
    </div>
  );
}
