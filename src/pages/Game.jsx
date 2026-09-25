import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { RotateCcw, Play, Pause, Volume2, VolumeX, Grid, Save, Plus, Eraser } from "lucide-react";
import { soundController } from "@/components/SoundController";
import { GameOverScreen, WinScreen, StartScreen } from '@/components/GameScreens';
import IntroScreen from '@/components/IntroScreen';
import { drawCreature, drawExplorer } from '@/game/characterArt';
import { drawBeacon, drawPickup, drawSpaceBackdrop, drawStarShard, drawTerrain } from '@/game/worldArt';
import { createEditorCreature } from '@/game/geometry';
import { DIRECTION_KEYS, directionAtPoint, readGameplayInput } from '@/game/input';
import { appendInputStep, createInputTranscript, sealInputTranscript } from '@/game/inputTranscript';
import { takeFixedSteps } from '@/game/fixedStep';
import { createScoreLedger } from '@/game/scoreLedger';
import { advanceSimulation } from '@/game/simulation';
import { createLocalRunCompletion } from '@/game/runCompletion';
import { createEmptyWorldState, createInitialLevelState, createPlayerState } from '@/game/worldState';

export default function Game({ onRunComplete = null }) {
  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);
  const keysRef = useRef({});
  const directionPointerRef = useRef(null);
  const jumpPointersRef = useRef(new Set());
  const simulationClockRef = useRef({ lastTimestamp: null, accumulator: 0 });
  const livesRef = useRef(3);
  const runEndedRef = useRef(false);
  const runStepRef = useRef(0);
  const scoreLedgerRef = useRef(createScoreLedger());
  const inputTranscriptRef = useRef(createInputTranscript());

  const [gameState, setGameState] = useState('intro'); // intro, start, playing, paused, gameover, win
  const [introPhase, setIntroPhase] = useState(0);
  const [score, setScore] = useState(0);
  const [shards, setShards] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Editor state
  const [selectedTool, setSelectedTool] = useState('brush'); // brush, eraser, hand
  const [selectedItem, setSelectedItem] = useState({ type: 'platform', subType: 'brick' });
  const [showGrid, setShowGrid] = useState(true);
  const customLevelRef = useRef(null);

  const playerRef = useRef(createPlayerState());
  const worldRef = useRef(createEmptyWorldState());

  const initLevel = useCallback(
    /** @param {number | 'custom'} levelNum */
    (levelNum = 1) => {
      runEndedRef.current = false;
      const state = createInitialLevelState(levelNum, customLevelRef.current);
      playerRef.current = state.player;
      worldRef.current = state.world;
    }, []);

  const drawEffect = (ctx, effect, offset) => {
    const screenX = effect.x - offset;
    if (effect.type === 'coin_pop') {
       const yOffset = Math.sin(effect.frame * 0.2) * 40;
       const coinY = effect.y - yOffset;

       // A released shard keeps the same silhouette as collectible shards.
       ctx.fillStyle = '#F4DB70';
       ctx.beginPath();
       ctx.moveTo(screenX, coinY - 14);
       ctx.lineTo(screenX + 8, coinY);
       ctx.lineTo(screenX, coinY + 14);
       ctx.lineTo(screenX - 8, coinY);
       ctx.closePath();
       ctx.fill();

       // Sparkles
       if (effect.frame > 5) {
          ctx.fillStyle = '#FFF';
          ctx.fillRect(screenX - 10, coinY - 10, 2, 2);
          ctx.fillRect(screenX + 10, coinY + 10, 2, 2);
          ctx.fillRect(screenX + 10, coinY - 10, 2, 2);
          ctx.fillRect(screenX - 10, coinY + 10, 2, 2);
       }
    }
  };

  const drawFireball = (ctx, fireball, offset) => {
    const screenX = fireball.x - offset;
    const rotation = Date.now() / 180;

    ctx.save();
    ctx.translate(screenX, fireball.y);
    ctx.rotate(rotation);

    // Plasma bolt with a four-point silhouette.
    ctx.fillStyle = '#28D9CF';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#E7FAFF';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(-2, -2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const gameLoop = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const player = playerRef.current;
    const world = worldRef.current;
    if (gameState === 'editor') {
        // Editor render loop
        drawSpaceBackdrop(ctx, world.offset, 1);

        // Grid
        if (showGrid) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            const gridSize = 32;
            const offsetX = world.offset % gridSize;
            for(let x = -offsetX; x < canvas.width; x += gridSize) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
            }
            for(let y = 0; y < canvas.height; y += gridSize) {
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
            }
            ctx.stroke();
        }

        world.platforms.forEach(p => drawTerrain(ctx, p, world.offset));
        world.coins.forEach(c => drawStarShard(ctx, c, world.offset));
        world.powerUps.forEach(p => drawPickup(ctx, p, world.offset));
        world.enemies.forEach(e => drawCreature(ctx, e, world.offset));
        if (world.flag) drawBeacon(ctx, world.flag, world.offset);

        // Draw cursor highlight
        if (mouseRef.current) {
            const mx = mouseRef.current.x;
            const my = mouseRef.current.y;
            const gridSize = 32;
            const gx = Math.floor((mx + world.offset) / gridSize) * gridSize - world.offset;
            const gy = Math.floor(my / gridSize) * gridSize;

            ctx.strokeStyle = selectedTool === 'eraser' ? 'red' : 'white';
            ctx.lineWidth = 2;
            ctx.strokeRect(gx, gy, gridSize, gridSize);
        }

        // Camera movement with arrow keys in editor
        if (keysRef.current['ArrowRight']) world.offset += 10;
        if (keysRef.current['ArrowLeft']) world.offset = Math.max(0, world.offset - 10);

        gameLoopRef.current = requestAnimationFrame(gameLoop);
        return;
    }

    const stepCount = takeFixedSteps(simulationClockRef.current, timestamp);
    for (let step = 0; step < stepCount; step++) {
    if (runEndedRef.current) break;
    const input = readGameplayInput(keysRef.current);
    appendInputStep(inputTranscriptRef.current, input);
    const simulation = {
      player, world, lives: livesRef.current, level,
      step: runStepRef.current, runEnded: runEndedRef.current,
      ledger: scoreLedgerRef.current,
    };
    const result = advanceSimulation(simulation, input);
    runStepRef.current = simulation.step;
    livesRef.current = simulation.lives;
    runEndedRef.current = simulation.runEnded;
    if (result.scoreChanged) setScore(simulation.ledger.total);
    if (result.shardsCollected) setShards(count => count + result.shardsCollected);
    if (result.livesChanged) setLives(simulation.lives);
    result.sounds.forEach(sound => soundController[sound]());
    if (result.transition) {
      if (result.transition.nextLevel) setLevel(result.transition.nextLevel);
      if (result.transition.state === 'win') sealInputTranscript(inputTranscriptRef.current, 'win');
      if (result.transition.state === 'gameover') sealInputTranscript(inputTranscriptRef.current, 'gameover');
      setGameState(result.transition.state);
      if (result.transition.state === 'win' || result.transition.state === 'gameover') {
        onRunComplete?.(createLocalRunCompletion(inputTranscriptRef.current, scoreLedgerRef.current));
      }
    }

    // Follow the explorer within the portion of the canvas actually visible.
    const drawnWidth = canvas.getBoundingClientRect().width || canvas.width;
    const viewportWidth = canvas.parentElement?.clientWidth || drawnWidth;
    const visibleWorldWidth = canvas.width * Math.min(1, viewportWidth / drawnWidth);
    const lead = Math.min(300, visibleWorldWidth * 0.4);
    const goalOffset = world.flag
      ? world.flag.x + world.flag.width - visibleWorldWidth + 40
      : 0;
    const maxOffset = Math.max(world.maxOffset || 2600, goalOffset);
    world.offset = Math.max(0, Math.min(player.x - lead, maxOffset));
    }

    // Draw everything
    drawSpaceBackdrop(ctx, world.offset, level);

    world.platforms.forEach(p => drawTerrain(ctx, p, world.offset));
    world.coins.forEach(c => drawStarShard(ctx, c, world.offset));
    world.powerUps.forEach(p => drawPickup(ctx, p, world.offset));
    world.enemies.forEach(e => drawCreature(ctx, e, world.offset));
    if (world.effects) world.effects.forEach(eff => drawEffect(ctx, eff, world.offset));

    // Draw enemy projectiles
    world.enemyProjectiles && world.enemyProjectiles.forEach(p => {
       // Warden energy orb
       const screenX = p.x - world.offset;
       const f = Math.floor(Date.now() / 100) % 3;
       ctx.fillStyle = ['#6756B8', '#8878D7', '#28D9CF'][f];
       ctx.beginPath();
       ctx.arc(screenX + 20, p.y + 10, 10, 0, Math.PI * 2);
       ctx.fill();
       ctx.fillStyle = '#E7FAFF';
       ctx.fillRect(screenX + (p.velocityX > 0 ? 20 : 10), p.y + 6, 6, 4);
    });

    player.fireballs.forEach(fb => drawFireball(ctx, fb, world.offset));
    if (world.flag) drawBeacon(ctx, world.flag, world.offset);
    drawExplorer(ctx, player, world.offset);

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, level, selectedTool, showGrid, onRunComplete]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      keysRef.current[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      keysRef.current[e.code] = false;
    };

    const handleBlur = () => {
      keysRef.current = {};
      directionPointerRef.current = null;
      jumpPointersRef.current.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    if (gameState === 'playing' || gameState === 'editor') {
      simulationClockRef.current = { lastTimestamp: null, accumulator: 0 };
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);

  useEffect(() => () => soundController.stopBGM(), []);

  // Editor Mouse Handling
  const mouseRef = useRef(null);

  const handleCanvasClick = (e) => {
    if (gameState !== 'editor') return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX + worldRef.current.offset;
    const y = (e.clientY - rect.top) * scaleY;

    const gridSize = 32;
    const gridX = Math.floor(x / gridSize) * gridSize;
    const gridY = Math.floor(y / gridSize) * gridSize;

    if (selectedTool === 'eraser') {
        const world = worldRef.current;
        // Remove logic
        world.platforms = world.platforms.filter(p =>
            !(x >= p.x && x < p.x + p.width && y >= p.y && y < p.y + p.height)
        );
        world.coins = world.coins.filter(c =>
            Math.hypot(c.x - x, c.y - y) > 20
        );
        world.enemies = world.enemies.filter(en =>
            !(x >= en.x && x < en.x + en.width && y >= en.y && y < en.y + en.height)
        );
        world.powerUps = world.powerUps.filter(p =>
            Math.hypot(p.x - x, p.y - y) > 20
        );
        return;
    }

    if (selectedTool === 'brush') {
        const world = worldRef.current;
        if (selectedItem.type === 'platform') {
            // Check overlap
            const exists = world.platforms.some(p => p.x === gridX && p.y === gridY && p.width === 32 && p.height === 32);
            if (!exists) {
                world.platforms.push({
                    x: gridX, y: gridY, width: 32, height: 32, type: selectedItem.subType
                });
            }
        } else if (selectedItem.type === 'coin') {
            world.coins.push({ x: gridX + 16, y: gridY + 16, collected: false });
        } else if (selectedItem.type === 'enemy') {
            world.enemies.push(createEditorCreature(selectedItem.subType, gridX, gridY));
        } else if (selectedItem.type === 'powerup') {
            const insideEnergyBlock = world.platforms.some(platform =>
                platform.type === 'question' &&
                gridX >= platform.x && gridX < platform.x + platform.width &&
                gridY <= platform.y && gridY >= platform.y - 50
            );
            world.powerUps.push({ x: gridX, y: gridY, type: selectedItem.subType, collected: false, spawned: !insideEnergyBlock });
        } else if (selectedItem.type === 'flag') {
            world.flag = { x: gridX, y: gridY - 200, width: 20, height: 300 };
        }
    }
  };

  const handleMouseMove = (e) => {
    if (gameState !== 'editor') return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };

    // Drag painting for blocks
    if (e.buttons === 1 && selectedTool === 'brush' && selectedItem.type === 'platform') {
        handleCanvasClick(e);
    }
  };

  const saveCustomLevel = () => {
      customLevelRef.current = JSON.parse(JSON.stringify(worldRef.current));
      // Clean up runtime props
      customLevelRef.current.offset = 0;
      alert("Level Saved! Click 'Test Level' to play.");
  };

  const enterEditor = () => {
      setGameState('editor');
      if (!customLevelRef.current) {
          initLevel('custom');
      } else {
          // Restore logic if needed, or just keep current world if we just paused testing
          worldRef.current = JSON.parse(JSON.stringify(customLevelRef.current));
          worldRef.current.offset = 0;
      }
  };

  // Intro animation sequence
  useEffect(() => {
    if (gameState === 'intro') {
      const timers = [
        setTimeout(() => setIntroPhase(1), 500),   // Nova arrives
        setTimeout(() => setIntroPhase(2), 1500),  // Logo appears
        setTimeout(() => setIntroPhase(3), 2500),  // Logo fully visible
        setTimeout(() => setIntroPhase(4), 3500),  // Shine effect
        setTimeout(() => {
          setGameState('start');
          setIntroPhase(0);
        }, 4500), // Go to start screen
      ];
      return () => timers.forEach(t => clearTimeout(t));
    }
  }, [gameState]);

  const resetRunScore = mode => {
    scoreLedgerRef.current = createScoreLedger(mode);
    inputTranscriptRef.current = createInputTranscript(mode);
    runStepRef.current = 0;
    setScore(0);
    setShards(0);
  };

  const startGame = () => {
    soundController.init();
    soundController.playSelect();
    soundController.playBGM(1);
    setLevel(1);
    initLevel(1);
    resetRunScore('campaign');
    setLives(3);
    livesRef.current = 3;
    setGameState('playing');
  };

  const nextLevel = () => {
    soundController.playSelect();
    soundController.playBGM(level);
    initLevel(level);
    setGameState('playing');
  };

  const togglePause = () => {
    soundController.playSelect();
    setGameState(s => {
      const next = s === 'playing' ? 'paused' : 'playing';
      if (next === 'paused') soundController.stopBGM();
      else soundController.playBGM(level);
      return next;
    });
  };

  const toggleMute = () => {
    const muted = soundController.toggleMute();
    setIsMuted(muted);
  };

  const updatePadDirection = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const direction = directionAtPoint(rect, event.clientX, event.clientY);
    DIRECTION_KEYS.forEach(key => { keysRef.current[key] = key === direction; });
  };

  const handlePadPointerDown = (event) => {
    if (directionPointerRef.current !== null) return;
    event.preventDefault();
    directionPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updatePadDirection(event);
  };

  const handlePadPointerMove = (event) => {
    if (directionPointerRef.current === event.pointerId) updatePadDirection(event);
  };

  const handlePadPointerEnd = (event) => {
    if (directionPointerRef.current !== event.pointerId) return;
    directionPointerRef.current = null;
    DIRECTION_KEYS.forEach(key => { keysRef.current[key] = false; });
  };

  const handleJumpPointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    jumpPointersRef.current.add(event.pointerId);
    keysRef.current['Space'] = true;
  };

  const handleJumpPointerEnd = (event) => {
    jumpPointersRef.current.delete(event.pointerId);
    keysRef.current['Space'] = jumpPointersRef.current.size > 0;
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-start sm:justify-center p-4">
      <div className="relative w-full max-w-[800px]">
        {/* Game Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-0 px-2 sm:px-4 py-3 bg-black border-b-4 border-[#6756B8]" style={{ fontFamily: 'monospace' }}>
          <div className="flex flex-wrap items-center gap-3 sm:gap-10">
            {[['NOVA', String(score).padStart(6,'0'), 'text-white'], ['SHARDS', `✦×${String(shards).padStart(2,'0')}`, 'text-[#F4DB70]'], ['SECTOR', `${level}-1`, 'text-white'], ['TIME', '∞', 'text-white'], ['LIVES', `×${lives}`, 'text-white']].map(([label, val, cls]) => (
              <div key={label} className="text-center"><span className="text-white font-bold text-xs block tracking-wider">{label}</span><div className={`${cls} font-bold text-lg tracking-wider`}>{val}</div></div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button aria-label="Toggle sound" onClick={toggleMute} variant="outline" size="icon" className="bg-black/40 border-white/20 hover:bg-white/10">{isMuted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}</Button>
            {gameState === 'playing' && <Button aria-label="Pause game" onClick={togglePause} variant="outline" size="icon" className="bg-black/40 border-white/20 hover:bg-white/10"><Pause className="h-4 w-4 text-white" /></Button>}
            <Button aria-label="Restart game" onClick={startGame} variant="outline" size="icon" className="bg-black/40 border-white/20 hover:bg-white/10"><RotateCcw className="h-4 w-4 text-white" /></Button>
          </div>
        </div>

        {/* Editor UI Toolbar */}
        {gameState === 'editor' && (
            <div className="absolute top-16 left-4 z-50 flex flex-col gap-2 bg-black/80 p-2 rounded-lg border border-[#6756B8]">
                <div className="text-white text-xs font-bold text-center mb-1">TOOLS</div>
                <Button aria-label="Brush tool" size="icon" variant={selectedTool === 'brush' ? "default" : "ghost"} onClick={() => setSelectedTool('brush')} className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
                <Button aria-label="Eraser tool" size="icon" variant={selectedTool === 'eraser' ? "default" : "ghost"} onClick={() => setSelectedTool('eraser')} className="h-8 w-8"><Eraser className="h-4 w-4" /></Button>
                <div className="h-px bg-white/20 my-1" />
                <Button aria-label="Toggle grid" size="icon" variant={showGrid ? "default" : "ghost"} onClick={() => setShowGrid(!showGrid)} className="h-8 w-8"><Grid className="h-4 w-4" /></Button>
                <Button aria-label="Save level" size="icon" variant="ghost" onClick={saveCustomLevel} className="h-8 w-8 text-green-400 hover:text-green-300"><Save className="h-4 w-4" /></Button>
                <Button size="sm" variant="destructive" onClick={() => { saveCustomLevel(); initLevel('custom'); resetRunScore('custom'); setGameState('playing'); }} className="mt-2 text-xs"><Play className="h-3 w-3 mr-1" /> TEST</Button>
            </div>
        )}

        {gameState === 'editor' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-black/80 p-2 rounded-lg border border-[#6756B8] overflow-x-auto max-w-[90vw]">
                {[
                    { type: 'platform', subType: 'ground', label: 'Terrain', color: '#6756B8' },
                    { type: 'platform', subType: 'brick', label: 'Alloy Block', color: '#7788AC' },
                    { type: 'platform', subType: 'question', label: '?', color: '#F4DB70' },
                    { type: 'coin', subType: 'coin', label: 'Star Shard', color: '#F4DB70' },
                    { type: 'enemy', subType: 'pebblit', label: 'Pebblit', color: '#90D77D' },
                    { type: 'enemy', subType: 'rollpod', label: 'Rollpod', color: '#28D9CF' },
                    { type: 'enemy', subType: 'signalSnare', label: 'Signal Snare', color: '#F38173' },
                    { type: 'enemy', subType: 'prismite', label: 'Prismite', color: '#F38173' },
                    { type: 'enemy', subType: 'hovermite', label: 'Hovermite', color: '#E7FAFF' },
                    { type: 'enemy', subType: 'warden', label: 'Warden', color: '#6756B8' },
                    { type: 'powerup', subType: 'powerCell', label: 'Power Cell', color: '#28D9CF' },
                    { type: 'powerup', subType: 'plasma', label: 'Plasma Core', color: '#F38173' },
                    { type: 'powerup', subType: 'spectrum', label: 'Spectrum Shield', color: '#F4DB70' },
                    { type: 'flag', subType: 'flag', label: 'Beacon', color: '#28D9CF' },
                ].map((item, i) => (
                    <button
                        key={i}
                        onClick={() => { setSelectedItem(item); setSelectedTool('brush'); }}
                        className={`flex flex-col items-center p-2 rounded min-w-[60px] transition-all ${
                            selectedItem.subType === item.subType && selectedTool === 'brush'
                            ? 'bg-white/20 ring-2 ring-white'
                            : 'hover:bg-white/10'
                        }`}
                    >
                        <div className="w-6 h-6 mb-1 border border-white/50" style={{ backgroundColor: item.color }}></div>
                        <span className="text-[10px] text-white font-mono">{item.label}</span>
                    </button>
                ))}
            </div>
        )}

        {/* Game Canvas */}
        <div className="relative overflow-hidden shadow-2xl shadow-black/50 border-4 border-[#6756B8]">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onMouseDown={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => mouseRef.current = null}
            className={`bg-sky-300 block w-[700px] max-w-none sm:w-full h-auto ${gameState === 'editor' ? 'cursor-none' : ''}`}
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Overlays */}
          {gameState === 'intro' && <IntroScreen introPhase={introPhase} onSkip={() => { setGameState('start'); setIntroPhase(0); }} />}
          {gameState === 'start' && <StartScreen onStart={startGame} onEnterEditor={enterEditor} />}
          {gameState === 'paused' && <div className="absolute inset-0 bg-[#10172E] flex flex-col items-center justify-center" style={{fontFamily:'monospace'}}><div className="text-white text-4xl font-bold mb-8" style={{textShadow:'3px 3px 0 #6756B8'}}>PAUSED</div><button onClick={togglePause} className="bg-[#6756B8] hover:bg-[#8878D7] text-white font-bold px-8 py-4 border-4 border-black text-xl transition-colors" style={{textShadow:'1px 1px 0 #000'}}>▶ CONTINUE</button></div>}
          {gameState === 'gameover' && <GameOverScreen score={score} level={level} onRestart={startGame} />}
          {gameState === 'levelcomplete' && <div className="absolute inset-0 bg-[#10172E] flex flex-col items-center justify-center" style={{fontFamily:'monospace'}}><div className="text-[#F4DB70] text-4xl font-bold mb-4" style={{textShadow:'3px 3px 0 #6756B8'}}>COURSE CLEAR!</div><div className="text-white text-xl mb-2">SECTOR {level - 1}-1 COMPLETED</div><div className="text-[#F4DB70] text-2xl mb-2">SCORE: {String(score).padStart(6,'0')}</div><div className="text-white text-lg mb-8">GET READY FOR SECTOR {level}-1</div><button onClick={nextLevel} className="bg-[#137F87] hover:bg-[#28D9CF] text-white font-bold px-8 py-4 border-4 border-black text-xl transition-colors" style={{textShadow:'1px 1px 0 #000'}}>▶ NEXT SECTOR</button></div>}
          {gameState === 'win' && <WinScreen score={score} onRestart={startGame} />}
        </div>
        {/* Mobile Controls */}
        <div className="touch-controls mt-4 justify-between items-center gap-2 sm:px-4" style={{fontFamily:'monospace'}}>
          <div
            className="relative w-32 h-32"
            onPointerDown={handlePadPointerDown}
            onPointerMove={handlePadPointerMove}
            onPointerUp={handlePadPointerEnd}
            onPointerCancel={handlePadPointerEnd}
            onLostPointerCapture={handlePadPointerEnd}
          >
            {[['ArrowUp','top-0 left-1/2 -translate-x-1/2','↑'],['ArrowDown','bottom-0 left-1/2 -translate-x-1/2','↓'],['ArrowLeft','left-0 top-1/2 -translate-y-1/2','←'],['ArrowRight','right-0 top-1/2 -translate-y-1/2','→']].map(([key,pos,glyph])=>(<button key={key} aria-label={key.replace('Arrow', 'Move ')} className={`absolute ${pos} w-10 h-10 bg-[#303030] active:bg-[#505050] border-2 border-black rounded-sm text-white text-xl font-bold`}>{glyph}</button>))}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-[#303030] border-2 border-black rounded-sm"/>
          </div>
          <div className="flex gap-4 items-center">
            <button aria-label="Jump A" className="w-14 h-14 rounded-full bg-[#A00000] active:bg-[#E52521] border-4 border-[#600000] text-white font-bold text-xl shadow-lg" onPointerDown={handleJumpPointerDown} onPointerUp={handleJumpPointerEnd} onPointerCancel={handleJumpPointerEnd} onLostPointerCapture={handleJumpPointerEnd}>A</button>
            <button aria-label="Jump B" className="w-14 h-14 rounded-full bg-[#A00000] active:bg-[#E52521] border-4 border-[#600000] text-white font-bold text-xl shadow-lg -mt-4" onPointerDown={handleJumpPointerDown} onPointerUp={handleJumpPointerEnd} onPointerCancel={handleJumpPointerEnd} onLostPointerCapture={handleJumpPointerEnd}>B</button>
          </div>
        </div>
      </div>
    </div>
  );
}
