import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/animation';

export default function IntroScreen({ introPhase, onSkip }) {
  const rootRef = useRef(null);

  useGSAP(() => {
    if (introPhase !== 3 || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    gsap.timeline({ defaults: { ease: 'power2.out' } })
      .fromTo('.intro-logo', { autoAlpha: 0, scale: 0.4, y: 24 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.8, ease: 'back.out(1.5)' })
      .fromTo('.intro-planet', { rotation: -12 }, { rotation: 8, duration: 1.2, ease: 'sine.inOut' }, 0);
  }, { scope: rootRef, dependencies: [introPhase], revertOnUpdate: true });

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 bg-black flex items-center justify-center cursor-pointer overflow-hidden"
      onClick={(e) => { e.preventDefault(); onSkip(); }}
    >
      {/* Animated starfield and distant planet */}
      <div className="absolute inset-0" style={{ background: introPhase >= 1 ? '#15274D' : '#000', transition: 'background 1s ease-out' }}>
        {introPhase >= 1 && (
          <>
            <div className="absolute inset-0 animate-scroll-slow">
              {Array.from({ length: 25 }, (_, i) => (
                <div key={i} className="absolute bg-[#E7FAFF]" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 29) % 70}%`, width: i % 4 === 0 ? 3 : 2, height: i % 4 === 0 ? 3 : 2 }} />
              ))}
            </div>
            <div className="intro-planet absolute top-[18%] right-[12%] w-24 h-24 sm:w-40 sm:h-40 rounded-full bg-[#7788AC] border-8 border-[#28D9CF]/70" />
            <div className="absolute bottom-0 w-full h-24 bg-[#6756B8]">
              <div className="w-full h-4 bg-[#28D9CF]" />
            </div>
          </>
        )}
      </div>

      {/* Nova crosses the opening scene in an explorer suit. */}
      {introPhase >= 1 && (
        <div className="absolute bottom-24 z-10" style={{ left: introPhase >= 2 ? '35%' : '-15%', transition: 'left 2s ease-out' }}>
          <div className="animate-bounce-run">
            <svg width="72" height="88" viewBox="0 0 13 13" aria-hidden="true" style={{ imageRendering: 'pixelated' }}>
              <rect x="6" y="0" width="1" height="2" fill="#F4DB70" />
              <rect x="3" y="2" width="7" height="5" fill="#17243F" />
              <rect x="4" y="3" width="5" height="3" fill="#E7FAFF" />
              <rect x="4" y="4" width="5" height="1" fill="#28D9CF" />
              <rect x="3" y="7" width="7" height="4" fill="#6756B8" />
              <rect x="6" y="8" width="2" height="2" fill="#28D9CF" />
              <rect x="1" y="8" width="2" height="3" fill="#17243F" />
              <rect x="10" y="8" width="2" height="3" fill="#17243F" />
              <rect x="3" y="11" width="3" height="2" fill="#2E405A" />
              <rect x="7" y="11" width="3" height="2" fill="#2E405A" />
            </svg>
          </div>
        </div>
      )}

      {/* Star shards flying */}
      {introPhase >= 2 && (
        <>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="absolute animate-coin-fly" style={{ left: `${20 + i * 12}%`, top: '30%', animationDelay: `${i * 0.15}s` }}>
              <div className="w-6 h-8 bg-[#F4DB70] rotate-45 border-2 border-[#E7FAFF] animate-spin-coin" />
            </div>
          ))}
        </>
      )}

      {/* Logo */}
      <div className="intro-logo absolute z-20 flex flex-col items-center" style={{ opacity: introPhase >= 3 ? 1 : 0 }}>
        <div className="text-4xl sm:text-6xl font-black mb-2 tracking-wider" style={{ color: '#F4DB70', textShadow: '4px 4px 0 #6756B8, 6px 6px 0 #000', fontFamily: 'system-ui' }}>NOVA'S</div>
        <div className="text-5xl sm:text-8xl font-black tracking-wide text-center" style={{ background: 'linear-gradient(180deg, #28D9CF 0%, #28D9CF 45%, #8878D7 55%, #8878D7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(5px 5px 0 #000)', fontFamily: 'system-ui' }}>ORBIT JUMP</div>
        {introPhase >= 4 && <div className="text-white text-xl mt-4 animate-pulse" style={{ textShadow: '2px 2px 0 #000' }}>★ A COSMIC ADVENTURE ★</div>}
      </div>

      {introPhase === 3 && <div className="absolute inset-0 bg-white animate-flash pointer-events-none z-30" />}

      {introPhase >= 4 && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="absolute text-[#F8D830] text-2xl animate-star-burst" style={{ left: '50%', top: '45%', animationDelay: `${i * 0.05}s`, transform: `rotate(${i * 30}deg)` }}>★</div>
          ))}
        </div>
      )}

      <div className="absolute bottom-4 text-white/70 text-xs z-40" style={{ fontFamily: 'monospace' }}>TAP OR CLICK TO SKIP</div>

      <style>{`
        @keyframes scroll-slow { 0% { transform: translateX(0); } 100% { transform: translateX(-400px); } }
        @keyframes scroll-medium { 0% { transform: translateX(0); } 100% { transform: translateX(-200px); } }
        @keyframes bounce-run { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes coin-fly { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-100px) scale(0.5); opacity: 0; } }
        @keyframes spin-coin { 0% { transform: scaleX(1); } 50% { transform: scaleX(0.2); } 100% { transform: scaleX(1); } }
        @keyframes flash { 0% { opacity: 0.8; } 100% { opacity: 0; } }
        @keyframes star-burst { 0% { transform: rotate(var(--r, 0deg)) translateX(0) scale(1); opacity: 1; } 100% { transform: rotate(var(--r, 0deg)) translateX(150px) scale(0); opacity: 0; } }
        .animate-scroll-slow { animation: scroll-slow 8s linear infinite; }
        .animate-scroll-medium { animation: scroll-medium 6s linear infinite; }
        .animate-bounce-run { animation: bounce-run 0.3s ease-in-out infinite; }
        .animate-coin-fly { animation: coin-fly 1s ease-out forwards; }
        .animate-spin-coin { animation: spin-coin 0.3s linear infinite; }
        .animate-flash { animation: flash 0.3s ease-out forwards; }
        .animate-star-burst { animation: star-burst 0.8s ease-out forwards; }
      `}</style>
    </div>
  );
}
