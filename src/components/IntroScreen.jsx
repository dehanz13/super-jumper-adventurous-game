export default function IntroScreen({ introPhase, onSkip }) {
  return (
    <div
      className="absolute inset-0 bg-black flex items-center justify-center cursor-pointer overflow-hidden"
      onClick={(e) => { e.preventDefault(); onSkip(); }}
    >
      {/* Animated Background */}
      <div className="absolute inset-0" style={{ background: introPhase >= 1 ? '#5C94FC' : '#000', transition: 'background 1s ease-out' }}>
        {introPhase >= 1 && (
          <>
            <div className="absolute animate-scroll-slow" style={{ top: '15%' }}>
              {[0, 200, 450, 700, 950, 1200].map((x, i) => (
                <div key={i} className="absolute bg-white rounded-full" style={{ left: x, width: 80, height: 40, boxShadow: '30px -10px 0 white, 60px 0 0 white' }} />
              ))}
            </div>
            <div className="absolute bottom-24 w-full">
              <svg viewBox="0 0 800 100" className="w-full animate-scroll-medium">
                <ellipse cx="100" cy="100" rx="120" ry="80" fill="#00A800"/>
                <ellipse cx="350" cy="100" rx="80" ry="60" fill="#00A800"/>
                <ellipse cx="550" cy="100" rx="100" ry="70" fill="#00A800"/>
                <ellipse cx="750" cy="100" rx="90" ry="65" fill="#00A800"/>
              </svg>
            </div>
            <div className="absolute bottom-0 w-full h-24 bg-[#C84C0C]">
              <div className="w-full h-4 bg-[#00A800]" />
            </div>
          </>
        )}
      </div>

      {/* Mario Running */}
      {introPhase >= 1 && (
        <div className="absolute bottom-24 z-10" style={{ left: introPhase >= 2 ? '35%' : '-15%', transition: 'left 2s ease-out' }}>
          <div className="animate-bounce-run">
            <svg width="80" height="96" viewBox="0 0 16 20" style={{ imageRendering: 'pixelated' }}>
              <rect x="5" y="0" width="6" height="1" fill="#E52521"/>
              <rect x="3" y="1" width="10" height="1" fill="#E52521"/>
              <rect x="3" y="2" width="10" height="1" fill="#E52521"/>
              <rect x="3" y="3" width="3" height="1" fill="#6B3E08"/>
              <rect x="6" y="3" width="3" height="1" fill="#FFA54F"/>
              <rect x="9" y="3" width="1" height="1" fill="#6B3E08"/>
              <rect x="10" y="3" width="1" height="1" fill="#FFA54F"/>
              <rect x="2" y="4" width="1" height="1" fill="#6B3E08"/>
              <rect x="3" y="4" width="1" height="1" fill="#FFA54F"/>
              <rect x="4" y="4" width="1" height="1" fill="#6B3E08"/>
              <rect x="5" y="4" width="4" height="1" fill="#FFA54F"/>
              <rect x="9" y="4" width="1" height="1" fill="#6B3E08"/>
              <rect x="10" y="4" width="2" height="1" fill="#FFA54F"/>
              <rect x="4" y="5" width="6" height="1" fill="#FFA54F"/>
              <rect x="3" y="6" width="3" height="1" fill="#E52521"/>
              <rect x="6" y="6" width="3" height="1" fill="#0033CC"/>
              <rect x="9" y="6" width="3" height="1" fill="#E52521"/>
              <rect x="2" y="7" width="4" height="1" fill="#E52521"/>
              <rect x="6" y="7" width="4" height="1" fill="#0033CC"/>
              <rect x="10" y="7" width="3" height="1" fill="#E52521"/>
              <rect x="3" y="8" width="4" height="1" fill="#0033CC"/>
              <rect x="8" y="8" width="4" height="1" fill="#0033CC"/>
              <rect x="2" y="9" width="4" height="1" fill="#6B3E08"/>
              <rect x="9" y="9" width="4" height="1" fill="#6B3E08"/>
            </svg>
          </div>
        </div>
      )}

      {/* Coins flying */}
      {introPhase >= 2 && (
        <>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="absolute animate-coin-fly" style={{ left: `${20 + i * 12}%`, top: '30%', animationDelay: `${i * 0.15}s` }}>
              <div className="w-6 h-8 bg-[#F8D830] rounded-full border-2 border-[#C87820] animate-spin-coin" />
            </div>
          ))}
        </>
      )}

      {/* Logo */}
      <div className="absolute z-20 flex flex-col items-center" style={{ opacity: introPhase >= 3 ? 1 : 0, transform: `scale(${introPhase >= 3 ? 1 : 0.3})`, transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        <div className="text-6xl font-black mb-2 tracking-wider" style={{ color: '#F8D830', textShadow: '4px 4px 0 #E52521, 6px 6px 0 #000', fontFamily: 'system-ui' }}>SUPER</div>
        <div className="text-8xl font-black tracking-wide" style={{ background: 'linear-gradient(180deg, #E52521 0%, #E52521 45%, #00A800 55%, #00A800 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(5px 5px 0 #000)', fontFamily: 'system-ui' }}>MARIO</div>
        {introPhase >= 4 && <div className="text-white text-xl mt-4 animate-pulse" style={{ textShadow: '2px 2px 0 #000' }}>★ CLONE EDITION ★</div>}
      </div>

      {introPhase === 3 && <div className="absolute inset-0 bg-white animate-flash pointer-events-none z-30" />}

      {introPhase >= 4 && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="absolute text-[#F8D830] text-2xl animate-star-burst" style={{ left: '50%', top: '45%', animationDelay: `${i * 0.05}s`, transform: `rotate(${i * 30}deg)` }}>★</div>
          ))}
        </div>
      )}

      <div className="absolute bottom-4 text-white/50 text-xs z-40" style={{ fontFamily: 'monospace' }}>CLICK TO SKIP</div>

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
