import { Hammer } from 'lucide-react';

export function GameOverScreen({ score, level, onRestart }) {
  return (
    <div className="absolute inset-0 bg-black flex flex-col items-center justify-center" style={{ fontFamily: 'monospace' }}>
      <div className="text-[#E52521] text-5xl font-bold mb-4" style={{ textShadow: '3px 3px 0 #000' }}>
        GAME OVER
      </div>
      <div className="text-white text-2xl mb-2">SCORE: {String(score).padStart(6, '0')}</div>
      <div className="text-[#F8D830] text-xl mb-4">WORLD {level}-1</div>
      <button
        onClick={onRestart}
        className="mt-6 bg-[#E52521] hover:bg-[#FF6B6B] text-white font-bold px-8 py-4 border-4 border-black text-xl transition-colors"
        style={{ textShadow: '1px 1px 0 #000' }}
      >
        ▶ TRY AGAIN
      </button>
    </div>
  );
}

export function WinScreen({ score, onRestart }) {
  return (
    <div className="absolute inset-0 bg-black flex flex-col items-center justify-center" style={{ fontFamily: 'monospace' }}>
      <div className="text-[#F8D830] text-3xl font-bold mb-2" style={{ textShadow: '3px 3px 0 #C84C0C' }}>
        ★ CONGRATULATIONS ★
      </div>
      <div className="text-white text-5xl font-bold mb-4" style={{ textShadow: '3px 3px 0 #E52521' }}>
        YOU WIN!
      </div>
      <div className="text-white text-xl mb-2">ALL WORLDS COMPLETED!</div>
      <div className="text-[#F8D830] text-3xl mb-1">FINAL SCORE</div>
      <div className="text-white text-4xl mb-2">{String(score).padStart(6, '0')}</div>
      <button
        onClick={onRestart}
        className="mt-6 bg-[#F8D830] hover:bg-[#FFFF88] text-black font-bold px-8 py-4 border-4 border-black text-xl transition-colors"
      >
        ▶ PLAY AGAIN
      </button>
    </div>
  );
}

export function StartScreen({ onStart, onEnterEditor }) {
  return (
    <div className="absolute inset-0 bg-[#5C94FC] flex flex-col items-center justify-center" style={{ fontFamily: 'monospace' }}>
      <div className="mb-8 text-center">
        <div className="text-[#F8D830] text-2xl font-bold mb-2" style={{ textShadow: '3px 3px 0 #C84C0C' }}>SUPER</div>
        <div className="text-[#E52521] text-6xl font-black mb-1" style={{ textShadow: '4px 4px 0 #000, 6px 6px 0 #C84C0C', letterSpacing: '4px' }}>
          MARIO BROS.
        </div>
        <div className="text-white text-lg mt-4" style={{ textShadow: '2px 2px 0 #000' }}>CLONE EDITION</div>
      </div>

      <div className="text-white text-xl font-bold mb-4 cursor-pointer hover:text-[#F8D830] transition-colors"
        onClick={() => onStart(1)}
        style={{ textShadow: '2px 2px 0 #000', animation: 'pulse 1s infinite' }}
      >
        ▶ PRESS START ◀
      </div>

      <div className="bg-black/50 p-4 rounded-lg mb-4">
        <div className="text-white text-center mb-2" style={{ textShadow: '1px 1px 0 #000' }}>SELECT WORLD</div>
        <div className="flex flex-col gap-4 items-center">
          <div className="flex gap-4">
            {[1, 2, 3].map(lvl => (
              <button key={lvl} onClick={() => onStart(lvl)}
                className="bg-[#C84C0C] hover:bg-[#E8A060] text-white font-bold px-6 py-3 border-4 border-[#000] transition-colors"
                style={{ textShadow: '1px 1px 0 #000' }}>
                {lvl}-1
              </button>
            ))}
          </div>
          <button onClick={onEnterEditor}
            className="flex items-center gap-2 bg-[#00A800] hover:bg-[#00C800] text-white font-bold px-8 py-3 border-4 border-[#000] transition-colors"
            style={{ textShadow: '1px 1px 0 #000' }}>
            <Hammer className="w-5 h-5" /> LEVEL CREATOR
          </button>
        </div>
      </div>

      <div className="text-white text-center text-sm relative z-10 pb-4" style={{ textShadow: '1px 1px 0 #000' }}>
        <p className="mb-1">← → MOVE    ↑/SPACE JUMP</p>
        <p className="text-[#F8D830]">STOMP GOOMBAS • COLLECT COINS • REACH THE FLAG!</p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-16 bg-[#C84C0C]" />
      <div className="absolute bottom-12 left-0 right-0 h-4 bg-[#00A800]" />
    </div>
  );
}
