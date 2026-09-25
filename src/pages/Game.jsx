import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { RotateCcw, Play, Pause, Volume2, VolumeX, Grid, Save, Plus, Eraser } from "lucide-react";
import { soundController } from "@/components/SoundController";
import { GameOverScreen, WinScreen, StartScreen } from '@/components/GameScreens';
import IntroScreen from '@/components/IntroScreen';
import { alignGroundEnemy, enemySpriteYOffset, playerSpriteBounds } from '@/game/geometry';
import { DIRECTION_KEYS, directionAtPoint } from '@/game/input';

const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const MOVE_SPEED = 5;

export default function Game() {
  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);
  const keysRef = useRef({});
  const directionPointerRef = useRef(null);
  const jumpPointersRef = useRef(new Set());

  const [gameState, setGameState] = useState('intro'); // intro, start, playing, paused, gameover, win
  const [introPhase, setIntroPhase] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Editor state
  const [selectedTool, setSelectedTool] = useState('brush'); // brush, eraser, hand
  const [selectedItem, setSelectedItem] = useState({ type: 'platform', subType: 'brick' });
  const [showGrid, setShowGrid] = useState(true);
  const customLevelRef = useRef(null);

  const playerRef = useRef({
    x: 100,
    y: 300,
    width: 40,
    height: 50,
    velocityX: 0,
    velocityY: 0,
    onGround: false,
    facingRight: true,
    isJumping: false,
    frame: 0,
    powerUp: 'small', // small, big, fire
    isInvincible: false,
    invincibleTimer: 0,
    starTimer: 0,
    lastFireball: 0,
    fireballs: []
  });

  const worldRef = useRef({
    offset: 0,
    platforms: [],
    coins: [],
    enemies: [],
    powerUps: [],
    enemyProjectiles: [],
    effects: [],
    maxOffset: 0,
    levelName: '',
    flag: null
  });

  const getLevelData = useCallback((levelNum) => {
    const levels = {
      // LEVEL 1 - Green Meadows (Easy - Introduction)
      1: {
        name: "Green Meadows",
        maxOffset: 2600,
        platforms: [
          // Ground sections - generous spacing
          { x: 0, y: 500, width: 800, height: 100, type: 'ground' },
          { x: 900, y: 500, width: 600, height: 100, type: 'ground' },
          { x: 1600, y: 500, width: 800, height: 100, type: 'ground' },
          { x: 2500, y: 500, width: 1000, height: 100, type: 'ground' },

          // Floating platforms - easy jumps
          { x: 300, y: 380, width: 100, height: 30, type: 'brick' },
          { x: 450, y: 300, width: 50, height: 30, type: 'question' },
          { x: 550, y: 300, width: 100, height: 30, type: 'brick' },
          { x: 700, y: 220, width: 50, height: 30, type: 'question' },

          { x: 1000, y: 350, width: 150, height: 30, type: 'brick' },
          { x: 1200, y: 280, width: 100, height: 30, type: 'brick' },
          { x: 1350, y: 200, width: 50, height: 30, type: 'question' },

          { x: 1700, y: 380, width: 200, height: 30, type: 'brick' },
          { x: 1950, y: 300, width: 100, height: 30, type: 'brick' },
          { x: 2100, y: 220, width: 150, height: 30, type: 'brick' },

          { x: 2600, y: 350, width: 100, height: 30, type: 'question' },
          { x: 2800, y: 280, width: 150, height: 30, type: 'brick' },
          { x: 3000, y: 200, width: 100, height: 30, type: 'brick' },
        ],
        coins: [
          { x: 320, y: 330, collected: false },
          { x: 360, y: 330, collected: false },
          { x: 465, y: 250, collected: false },
          { x: 570, y: 250, collected: false },
          { x: 610, y: 250, collected: false },
          { x: 715, y: 170, collected: false },
          { x: 1050, y: 300, collected: false },
          { x: 1100, y: 300, collected: false },
          { x: 1230, y: 230, collected: false },
          { x: 1365, y: 150, collected: false },
          { x: 1780, y: 330, collected: false },
          { x: 1830, y: 330, collected: false },
          { x: 1980, y: 250, collected: false },
          { x: 2150, y: 170, collected: false },
          { x: 2200, y: 170, collected: false },
          { x: 2630, y: 300, collected: false },
          { x: 2860, y: 230, collected: false },
          { x: 2910, y: 230, collected: false },
          { x: 3030, y: 150, collected: false },
        ],
        enemies: [
          { x: 500, y: 455, width: 40, height: 40, velocityX: -1.5, alive: true, type: 'goomba' },
          { x: 800, y: 455, width: 40, height: 48, velocityX: -1.5, alive: true, type: 'koopa', isShell: false, shellVelocity: 0 },
          { x: 1100, y: 455, width: 40, height: 40, velocityX: -1.5, alive: true, type: 'goomba' },
          { x: 1300, y: 455, width: 40, height: 40, velocityX: -2, alive: true, type: 'goomba' },
          { x: 1500, y: 455, width: 40, height: 48, velocityX: -1.5, alive: true, type: 'koopa', isShell: false, shellVelocity: 0 },
          { x: 1800, y: 455, width: 40, height: 40, velocityX: -1.5, alive: true, type: 'goomba' },
          { x: 2000, y: 455, width: 40, height: 40, velocityX: -2, alive: true, type: 'goomba' },
          { x: 2400, y: 455, width: 40, height: 48, velocityX: -1.5, alive: true, type: 'koopa', isShell: false, shellVelocity: 0 },
          { x: 2700, y: 455, width: 40, height: 40, velocityX: -1.5, alive: true, type: 'goomba' },
          { x: 2900, y: 455, width: 40, height: 40, velocityX: -2, alive: true, type: 'goomba' },
          { x: 450, y: 436, width: 48, height: 64, velocityX: 0, alive: true, type: 'piranha', baseY: 436, timer: 0 },
          { x: 1150, y: 404, width: 48, height: 64, velocityX: 0, alive: true, type: 'piranha', baseY: 404, timer: 60 },
          { x: 3050, y: 436, width: 64, height: 64, velocityX: 0, alive: true, type: 'bowser', hp: 5, maxHp: 5, fireTimer: 0, jumpTimer: 0, facingLeft: true },
        ],
        powerUps: [
          { x: 465, y: 270, type: 'mushroom', collected: false, velocityX: 1, spawned: false },
          { x: 715, y: 190, type: 'fire', collected: false, spawned: false },
          { x: 1365, y: 170, type: 'star', collected: false, velocityX: 2, spawned: false },
          { x: 2630, y: 320, type: 'mushroom', collected: false, velocityX: 1, spawned: false },
        ],
        flag: { x: 3200, y: 200, width: 20, height: 300 }
      },

      // LEVEL 2 - Underground Caverns (Medium - More gaps, faster enemies)
      2: {
        name: "Underground Caverns",
        maxOffset: 3200,
        platforms: [
          // Ground sections with larger gaps
          { x: 0, y: 500, width: 500, height: 100, type: 'ground' },
          { x: 650, y: 500, width: 400, height: 100, type: 'ground' },
          { x: 1200, y: 500, width: 300, height: 100, type: 'ground' },
          { x: 1700, y: 500, width: 500, height: 100, type: 'ground' },
          { x: 2400, y: 500, width: 400, height: 100, type: 'ground' },
          { x: 3000, y: 500, width: 800, height: 100, type: 'ground' },

          // Staircase platforms
          { x: 200, y: 420, width: 80, height: 30, type: 'brick' },
          { x: 300, y: 350, width: 80, height: 30, type: 'brick' },
          { x: 400, y: 280, width: 80, height: 30, type: 'question' },

          // Floating platform bridge over gap
          { x: 520, y: 380, width: 60, height: 30, type: 'brick' },
          { x: 600, y: 350, width: 60, height: 30, type: 'brick' },

          // Vertical challenge section
          { x: 750, y: 400, width: 100, height: 30, type: 'brick' },
          { x: 850, y: 320, width: 50, height: 30, type: 'question' },
          { x: 950, y: 240, width: 100, height: 30, type: 'brick' },
          { x: 1050, y: 160, width: 50, height: 30, type: 'question' },

          // Platform path over large gap
          { x: 1100, y: 350, width: 60, height: 30, type: 'brick' },
          { x: 1180, y: 300, width: 60, height: 30, type: 'brick' },

          // Zigzag platforms
          { x: 1350, y: 400, width: 100, height: 30, type: 'brick' },
          { x: 1500, y: 320, width: 100, height: 30, type: 'question' },
          { x: 1650, y: 400, width: 100, height: 30, type: 'brick' },

          // Challenge tower
          { x: 1850, y: 420, width: 120, height: 30, type: 'brick' },
          { x: 1880, y: 340, width: 60, height: 30, type: 'brick' },
          { x: 1850, y: 260, width: 120, height: 30, type: 'question' },
          { x: 1880, y: 180, width: 60, height: 30, type: 'brick' },

          // Bridge to final section
          { x: 2050, y: 350, width: 80, height: 30, type: 'brick' },
          { x: 2150, y: 320, width: 80, height: 30, type: 'brick' },
          { x: 2250, y: 350, width: 80, height: 30, type: 'brick' },
          { x: 2350, y: 380, width: 80, height: 30, type: 'brick' },

          // Descending platforms
          { x: 2500, y: 400, width: 100, height: 30, type: 'brick' },
          { x: 2650, y: 350, width: 50, height: 30, type: 'question' },
          { x: 2750, y: 300, width: 100, height: 30, type: 'brick' },
          { x: 2900, y: 250, width: 50, height: 30, type: 'question' },

          // Final approach
          { x: 3100, y: 380, width: 150, height: 30, type: 'brick' },
          { x: 3300, y: 320, width: 100, height: 30, type: 'brick' },
          { x: 3450, y: 260, width: 100, height: 30, type: 'brick' },
        ],
        coins: [
          // Staircase coins
          { x: 230, y: 370, collected: false },
          { x: 330, y: 300, collected: false },
          { x: 430, y: 230, collected: false },
          // Bridge coins
          { x: 540, y: 330, collected: false },
          { x: 620, y: 300, collected: false },
          // Vertical section
          { x: 790, y: 350, collected: false },
          { x: 865, y: 270, collected: false },
          { x: 990, y: 190, collected: false },
          { x: 1065, y: 110, collected: false },
          // Gap crossing
          { x: 1120, y: 300, collected: false },
          { x: 1200, y: 250, collected: false },
          // Zigzag
          { x: 1390, y: 350, collected: false },
          { x: 1540, y: 270, collected: false },
          { x: 1690, y: 350, collected: false },
          // Tower
          { x: 1900, y: 370, collected: false },
          { x: 1900, y: 290, collected: false },
          { x: 1900, y: 210, collected: false },
          { x: 1900, y: 130, collected: false },
          // Bridge
          { x: 2080, y: 300, collected: false },
          { x: 2180, y: 270, collected: false },
          { x: 2280, y: 300, collected: false },
          { x: 2380, y: 330, collected: false },
          // Descending
          { x: 2540, y: 350, collected: false },
          { x: 2665, y: 300, collected: false },
          { x: 2790, y: 250, collected: false },
          { x: 2915, y: 200, collected: false },
          // Final
          { x: 3160, y: 330, collected: false },
          { x: 3340, y: 270, collected: false },
          { x: 3490, y: 210, collected: false },
        ],
        enemies: [
          { x: 300, y: 455, width: 40, height: 40, velocityX: -2, alive: true, type: 'goomba' },
          { x: 600, y: 455, width: 40, height: 48, velocityX: -2, alive: true, type: 'koopa', isShell: false, shellVelocity: 0 },
          { x: 900, y: 455, width: 40, height: 40, velocityX: -2, alive: true, type: 'goomba' },
          { x: 1100, y: 455, width: 36, height: 36, velocityX: -1.5, alive: true, type: 'spiny' },
          { x: 1400, y: 455, width: 40, height: 40, velocityX: -2, alive: true, type: 'goomba' },
          { x: 1600, y: 455, width: 40, height: 48, velocityX: -2.5, alive: true, type: 'koopa', isShell: false, shellVelocity: 0 },
          { x: 1800, y: 455, width: 40, height: 40, velocityX: -2, alive: true, type: 'goomba' },
          { x: 2000, y: 455, width: 36, height: 36, velocityX: -2, alive: true, type: 'spiny' },
          { x: 2200, y: 455, width: 40, height: 48, velocityX: -2.5, alive: true, type: 'koopa', isShell: false, shellVelocity: 0 },
          { x: 2500, y: 455, width: 40, height: 40, velocityX: -2.5, alive: true, type: 'goomba' },
          { x: 2700, y: 455, width: 36, height: 36, velocityX: -2.5, alive: true, type: 'spiny' },
          { x: 3100, y: 455, width: 40, height: 40, velocityX: -2.5, alive: true, type: 'goomba' },
          { x: 3300, y: 455, width: 40, height: 48, velocityX: -3, alive: true, type: 'koopa', isShell: false, shellVelocity: 0 },
          { x: 3450, y: 436, width: 64, height: 64, velocityX: 0, alive: true, type: 'bowser', hp: 8, maxHp: 8, fireTimer: 0, jumpTimer: 0, facingLeft: true },
        ],
        powerUps: [
          { x: 430, y: 250, type: 'mushroom', collected: false, velocityX: 1, spawned: false },
          { x: 865, y: 290, type: 'fire', collected: false, spawned: false },
          { x: 1540, y: 290, type: 'star', collected: false, velocityX: 2, spawned: false },
          { x: 2665, y: 320, type: 'mushroom', collected: false, velocityX: 1, spawned: false },
          { x: 2915, y: 220, type: 'fire', collected: false, spawned: false },
        ],
        flag: { x: 3600, y: 200, width: 20, height: 300 }
      },

      // LEVEL 3 - Sky Fortress (Hard - Precision jumps, many enemies, narrow platforms)
      3: {
        name: "Sky Fortress",
        maxOffset: 3800,
        platforms: [
          // Starting area
          { x: 0, y: 500, width: 300, height: 100, type: 'ground' },

          // Sky bridge - narrow platforms
          { x: 380, y: 450, width: 50, height: 30, type: 'brick' },
          { x: 480, y: 400, width: 50, height: 30, type: 'brick' },
          { x: 580, y: 350, width: 50, height: 30, type: 'question' },
          { x: 680, y: 300, width: 50, height: 30, type: 'brick' },
          { x: 780, y: 250, width: 50, height: 30, type: 'brick' },

          // Floating island
          { x: 880, y: 300, width: 200, height: 100, type: 'ground' },

          // Descending challenge
          { x: 1150, y: 350, width: 40, height: 30, type: 'brick' },
          { x: 1230, y: 400, width: 40, height: 30, type: 'brick' },
          { x: 1310, y: 450, width: 40, height: 30, type: 'question' },

          // Ground section
          { x: 1400, y: 500, width: 250, height: 100, type: 'ground' },

          // Vertical tower climb
          { x: 1700, y: 450, width: 60, height: 30, type: 'brick' },
          { x: 1650, y: 380, width: 60, height: 30, type: 'brick' },
          { x: 1720, y: 310, width: 60, height: 30, type: 'question' },
          { x: 1650, y: 240, width: 60, height: 30, type: 'brick' },
          { x: 1720, y: 170, width: 60, height: 30, type: 'brick' },
          { x: 1650, y: 100, width: 60, height: 30, type: 'question' },

          // High bridge
          { x: 1800, y: 150, width: 40, height: 30, type: 'brick' },
          { x: 1880, y: 150, width: 40, height: 30, type: 'brick' },
          { x: 1960, y: 150, width: 40, height: 30, type: 'brick' },
          { x: 2040, y: 150, width: 40, height: 30, type: 'brick' },

          // Descending staircase
          { x: 2120, y: 200, width: 50, height: 30, type: 'brick' },
          { x: 2200, y: 260, width: 50, height: 30, type: 'brick' },
          { x: 2280, y: 320, width: 50, height: 30, type: 'question' },
          { x: 2360, y: 380, width: 50, height: 30, type: 'brick' },

          // Ground checkpoint
          { x: 2450, y: 500, width: 200, height: 100, type: 'ground' },

          // Gauntlet - alternating heights
          { x: 2720, y: 420, width: 40, height: 30, type: 'brick' },
          { x: 2800, y: 350, width: 40, height: 30, type: 'brick' },
          { x: 2880, y: 280, width: 40, height: 30, type: 'question' },
          { x: 2960, y: 350, width: 40, height: 30, type: 'brick' },
          { x: 3040, y: 420, width: 40, height: 30, type: 'brick' },
          { x: 3120, y: 350, width: 40, height: 30, type: 'brick' },
          { x: 3200, y: 280, width: 40, height: 30, type: 'question' },
          { x: 3280, y: 350, width: 40, height: 30, type: 'brick' },

          // Tiny platforms finale
          { x: 3380, y: 380, width: 30, height: 30, type: 'brick' },
          { x: 3450, y: 340, width: 30, height: 30, type: 'brick' },
          { x: 3520, y: 300, width: 30, height: 30, type: 'brick' },
          { x: 3590, y: 260, width: 30, height: 30, type: 'question' },

          // Final platform
          { x: 3700, y: 300, width: 150, height: 30, type: 'brick' },
          { x: 3900, y: 500, width: 300, height: 100, type: 'ground' },
        ],
        coins: [
          // Sky bridge
          { x: 395, y: 400, collected: false },
          { x: 495, y: 350, collected: false },
          { x: 595, y: 300, collected: false },
          { x: 695, y: 250, collected: false },
          { x: 795, y: 200, collected: false },
          // Floating island
          { x: 920, y: 250, collected: false },
          { x: 970, y: 250, collected: false },
          { x: 1020, y: 250, collected: false },
          // Descending
          { x: 1160, y: 300, collected: false },
          { x: 1240, y: 350, collected: false },
          { x: 1320, y: 400, collected: false },
          // Tower climb
          { x: 1720, y: 400, collected: false },
          { x: 1670, y: 330, collected: false },
          { x: 1740, y: 260, collected: false },
          { x: 1670, y: 190, collected: false },
          { x: 1740, y: 120, collected: false },
          { x: 1670, y: 50, collected: false },
          // High bridge
          { x: 1815, y: 100, collected: false },
          { x: 1895, y: 100, collected: false },
          { x: 1975, y: 100, collected: false },
          { x: 2055, y: 100, collected: false },
          // Descending staircase
          { x: 2135, y: 150, collected: false },
          { x: 2215, y: 210, collected: false },
          { x: 2295, y: 270, collected: false },
          { x: 2375, y: 330, collected: false },
          // Gauntlet
          { x: 2735, y: 370, collected: false },
          { x: 2815, y: 300, collected: false },
          { x: 2895, y: 230, collected: false },
          { x: 2975, y: 300, collected: false },
          { x: 3055, y: 370, collected: false },
          { x: 3135, y: 300, collected: false },
          { x: 3215, y: 230, collected: false },
          { x: 3295, y: 300, collected: false },
          // Finale
          { x: 3390, y: 330, collected: false },
          { x: 3460, y: 290, collected: false },
          { x: 3530, y: 250, collected: false },
          { x: 3600, y: 210, collected: false },
          // Final platform bonus
          { x: 3750, y: 250, collected: false },
          { x: 3800, y: 250, collected: false },
        ],
        enemies: [
          // Early enemies
          { x: 200, y: 455, width: 40, height: 40, velocityX: -2, alive: true, type: 'goomba' },
          // Floating island enemies
          { x: 920, y: 255, width: 36, height: 36, velocityX: -2.5, alive: true, type: 'spiny' },
          { x: 1000, y: 255, width: 40, height: 48, velocityX: 2.5, alive: true, type: 'koopa', isShell: false, shellVelocity: 0 },
          // Ground section
          { x: 1450, y: 455, width: 40, height: 40, velocityX: -3, alive: true, type: 'goomba' },
          { x: 1550, y: 455, width: 36, height: 36, velocityX: -2.5, alive: true, type: 'spiny' },
          // Lakitu in sky
          { x: 1700, y: 80, width: 40, height: 48, velocityX: 1.5, alive: true, type: 'lakitu', spawnTimer: 0 },
          // Checkpoint area
          { x: 2480, y: 455, width: 40, height: 48, velocityX: -3, alive: true, type: 'koopa', isShell: false, shellVelocity: 0 },
          { x: 2550, y: 455, width: 36, height: 36, velocityX: -2.5, alive: true, type: 'spiny' },
          { x: 2620, y: 455, width: 40, height: 40, velocityX: -3, alive: true, type: 'goomba' },
          // Final ground
          { x: 3950, y: 455, width: 36, height: 36, velocityX: -3.5, alive: true, type: 'spiny' },
          { x: 4050, y: 455, width: 40, height: 48, velocityX: -3, alive: true, type: 'koopa', isShell: false, shellVelocity: 0 },
          { x: 4100, y: 455, width: 40, height: 40, velocityX: -3.5, alive: true, type: 'goomba' },
          { x: 4000, y: 436, width: 64, height: 64, velocityX: 0, alive: true, type: 'bowser', hp: 10, maxHp: 10, fireTimer: 0, jumpTimer: 0, facingLeft: true },
        ],
        powerUps: [
          { x: 595, y: 320, type: 'mushroom', collected: false, velocityX: 1, spawned: false },
          { x: 1320, y: 420, type: 'star', collected: false, velocityX: 2, spawned: false },
          { x: 1740, y: 280, type: 'fire', collected: false, spawned: false },
          { x: 2295, y: 290, type: 'star', collected: false, velocityX: 2, spawned: false },
          { x: 2895, y: 250, type: 'fire', collected: false, spawned: false },
          { x: 3600, y: 230, type: 'mushroom', collected: false, velocityX: 1, spawned: false },
        ],
        flag: { x: 4150, y: 200, width: 20, height: 300 }
      }
    };

    return levels[levelNum] || levels[1];
  }, []);

  const initLevel = useCallback(
    /** @param {number | 'custom'} levelNum */
    (levelNum = 1) => {
    let levelData;
    if (levelNum === 'custom') {
      levelData = customLevelRef.current || {
        name: "Custom Level",
        maxOffset: 2000,
        platforms: [{ x: 0, y: 500, width: 800, height: 100, type: 'ground' }],
        coins: [],
        enemies: [],
        powerUps: [],
        flag: { x: 1800, y: 200, width: 20, height: 300 }
      };
    } else {
      levelData = getLevelData(levelNum);
    }

    worldRef.current = {
      offset: 0,
      platforms: levelData.platforms.map(p => ({...p, isUsed: false, bounceY: 0})),
      coins: levelData.coins.map(c => ({...c, collected: false})),
      enemies: levelData.enemies.map(e => ({...alignGroundEnemy(e, levelData.platforms), alive: true})),
      powerUps: (levelData.powerUps || []).map(p => ({
        ...p,
        collected: false,
        spawned: levelNum === 'custom' ? Boolean(p.spawned) : false,
        velocityY: 0
      })),
      enemyProjectiles: [],
      effects: [],
      flag: {...levelData.flag},
      maxOffset: levelData.maxOffset,
      levelName: levelData.name
    };

    playerRef.current = {
      x: 100,
      y: 300,
      width: 40,
      height: 50,
      velocityX: 0,
      velocityY: 0,
      onGround: false,
      facingRight: true,
      isJumping: false,
      frame: 0,
      powerUp: 'small',
      isInvincible: false,
      invincibleTimer: 0,
      starTimer: 0,
      lastFireball: 0,
      fireballs: []
    };
    }, [getLevelData]);

  const drawPlayer = (ctx, player, offset) => {
    const sprite = playerSpriteBounds(player);
    const screenX = sprite.x - offset;
    const px = sprite.pixelSize;
    const starFlash = player.starTimer > 0 && Math.floor(Date.now() / 50) % 4;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Invincibility flash
    if (player.isInvincible && !player.starTimer && Math.floor(Date.now() / 100) % 2 === 0) {
      ctx.restore();
      return;
    }

    const isRunning = player.onGround && Math.abs(player.velocityX) > 0.5;
    const frame = Math.floor(Date.now() / 100) % 3;
    const flip = !player.facingRight;

    const yOffset = sprite.y;

    const drawPixel = (x, y, color) => {
      // Star rainbow effect
      if (player.starTimer > 0) {
        const colors = ['#E52521', '#F8D830', '#00A800', '#5C94FC'];
        color = colors[(starFlash + Math.floor(x / 3)) % 4];
      }
      ctx.fillStyle = color;
      const px_x = flip ? screenX + sprite.width - (x + 1) * px : screenX + x * px;
      ctx.fillRect(px_x, yOffset + y * px, px, px);
    };

    // Mario colors - Fire Mario has white/red instead of red/blue
    const RED = player.powerUp === 'fire' ? '#FFFFFF' : '#E52521';
    const SKIN = '#FFA54F';
    const BROWN = '#6B3E08';
    const BLUE = player.powerUp === 'fire' ? '#E52521' : '#0033CC';

    // Hat (row 0-2)
    for (let i = 3; i <= 7; i++) drawPixel(i, 0, RED);
    for (let i = 2; i <= 10; i++) drawPixel(i, 1, RED);
    for (let i = 2; i <= 11; i++) drawPixel(i, 2, RED);

    // Face (row 3-6)
    for (let i = 2; i <= 4; i++) drawPixel(i, 3, BROWN);
    for (let i = 5; i <= 7; i++) drawPixel(i, 3, SKIN);
    drawPixel(8, 3, BROWN);
    drawPixel(9, 3, SKIN);

    drawPixel(1, 4, BROWN);
    drawPixel(2, 4, SKIN);
    drawPixel(3, 4, BROWN);
    for (let i = 4; i <= 7; i++) drawPixel(i, 4, SKIN);
    drawPixel(8, 4, BROWN);
    for (let i = 9; i <= 11; i++) drawPixel(i, 4, SKIN);

    drawPixel(1, 5, BROWN);
    drawPixel(2, 5, SKIN);
    drawPixel(3, 5, BROWN);
    drawPixel(4, 5, BROWN);
    for (let i = 5; i <= 8; i++) drawPixel(i, 5, SKIN);
    drawPixel(9, 5, BROWN);
    drawPixel(10, 5, BROWN);
    drawPixel(11, 5, BROWN);

    for (let i = 3; i <= 9; i++) drawPixel(i, 6, SKIN);

    // Shirt/overalls (row 7-11)
    for (let i = 2; i <= 4; i++) drawPixel(i, 7, RED);
    for (let i = 5; i <= 7; i++) drawPixel(i, 7, BLUE);
    for (let i = 8; i <= 10; i++) drawPixel(i, 7, RED);

    for (let i = 1; i <= 3; i++) drawPixel(i, 8, RED);
    for (let i = 4; i <= 8; i++) drawPixel(i, 8, BLUE);
    for (let i = 9; i <= 11; i++) drawPixel(i, 8, RED);

    for (let i = 0; i <= 2; i++) drawPixel(i, 9, RED);
    for (let i = 3; i <= 9; i++) drawPixel(i, 9, BLUE);
    for (let i = 10; i <= 12; i++) drawPixel(i, 9, RED);

    drawPixel(0, 10, SKIN);
    drawPixel(1, 10, SKIN);
    for (let i = 2; i <= 4; i++) drawPixel(i, 10, BLUE);
    for (let i = 5; i <= 7; i++) drawPixel(i, 10, BROWN);
    for (let i = 8; i <= 10; i++) drawPixel(i, 10, BLUE);
    drawPixel(11, 10, SKIN);
    drawPixel(12, 10, SKIN);

    // Legs/feet (row 11-13)
    if (!player.onGround) {
      // Jumping pose
      for (let i = 1; i <= 3; i++) drawPixel(i, 11, BLUE);
      for (let i = 9; i <= 11; i++) drawPixel(i, 11, BLUE);
      for (let i = 0; i <= 3; i++) drawPixel(i, 12, BROWN);
      for (let i = 9; i <= 12; i++) drawPixel(i, 12, BROWN);
    } else if (isRunning && frame === 1) {
      // Running frame 1
      for (let i = 3; i <= 5; i++) drawPixel(i, 11, BLUE);
      for (let i = 7; i <= 9; i++) drawPixel(i, 11, BLUE);
      for (let i = 2; i <= 5; i++) drawPixel(i, 12, BROWN);
      for (let i = 7; i <= 10; i++) drawPixel(i, 12, BROWN);
    } else {
      // Standing/running frame 0,2
      for (let i = 2; i <= 4; i++) drawPixel(i, 11, BLUE);
      for (let i = 8; i <= 10; i++) drawPixel(i, 11, BLUE);
      for (let i = 1; i <= 4; i++) drawPixel(i, 12, BROWN);
      for (let i = 8; i <= 11; i++) drawPixel(i, 12, BROWN);
    }

    ctx.restore();
  };

  const drawEffect = (ctx, effect, offset) => {
    const screenX = effect.x - offset;
    if (effect.type === 'coin_pop') {
       const yOffset = Math.sin(effect.frame * 0.2) * 40;
       const coinY = effect.y - yOffset;

       // Draw Coin
       ctx.fillStyle = '#F8B800';
       ctx.beginPath();
       ctx.ellipse(screenX, coinY, 8, 14, 0, 0, Math.PI * 2);
       ctx.fill();
       ctx.fillStyle = '#F8D830';
       ctx.beginPath();
       ctx.ellipse(screenX, coinY, 6, 10, 0, 0, Math.PI * 2);
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

  const drawPlatform = (ctx, platform, offset) => {
    const screenX = platform.x - offset;
    const drawY = platform.y + (platform.bounceY || 0);

    if (platform.type === 'ground') {
      const blockSize = 32;
      const cols = Math.ceil(platform.width / blockSize);
      const rows = Math.ceil(platform.height / blockSize);

      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const bx = screenX + col * blockSize;
          const by = drawY + row * blockSize;

          // SMB ground block pattern
          ctx.fillStyle = '#C84C0C';
          ctx.fillRect(bx, by, blockSize, blockSize);

          // Brick pattern inside
          ctx.fillStyle = '#E8A060';
          ctx.fillRect(bx + 2, by + 2, blockSize - 4, 12);
          ctx.fillRect(bx + 2, by + 18, 12, 12);
          ctx.fillRect(bx + 18, by + 18, 12, 12);

          // Black mortar lines
          ctx.fillStyle = '#000';
          ctx.fillRect(bx, by, blockSize, 2);
          ctx.fillRect(bx, by + 14, blockSize, 2);
          ctx.fillRect(bx, by + blockSize - 2, blockSize, 2);
          ctx.fillRect(bx, by, 2, blockSize);
          ctx.fillRect(bx + blockSize - 2, by, 2, blockSize);
          ctx.fillRect(bx + 14, by + 16, 2, 16);
        }
      }
    } else if (platform.type === 'brick') {
      const blockSize = platform.height;
      const numBlocks = Math.ceil(platform.width / blockSize);

      for (let i = 0; i < numBlocks; i++) {
        const bx = screenX + i * blockSize;
        const by = drawY;

        // SMB brick block
        ctx.fillStyle = '#C84C0C';
        ctx.fillRect(bx, by, blockSize, blockSize);

        // Brick highlights - classic 4 brick pattern
        ctx.fillStyle = '#E8A060';
        // Top row - 2 half bricks
        ctx.fillRect(bx + 2, by + 2, blockSize / 2 - 3, blockSize / 2 - 3);
        ctx.fillRect(bx + blockSize / 2 + 1, by + 2, blockSize / 2 - 3, blockSize / 2 - 3);
        // Bottom row - offset
        ctx.fillRect(bx + 2, by + blockSize / 2 + 1, blockSize / 4 - 2, blockSize / 2 - 3);
        ctx.fillRect(bx + blockSize / 4 + 1, by + blockSize / 2 + 1, blockSize / 2 - 2, blockSize / 2 - 3);
        ctx.fillRect(bx + blockSize * 3 / 4 + 1, by + blockSize / 2 + 1, blockSize / 4 - 3, blockSize / 2 - 3);

        // Black mortar/outline
        ctx.fillStyle = '#000';
        ctx.fillRect(bx, by, blockSize, 2);
        ctx.fillRect(bx, by + blockSize - 2, blockSize, 2);
        ctx.fillRect(bx, by, 2, blockSize);
        ctx.fillRect(bx + blockSize - 2, by, 2, blockSize);
        ctx.fillRect(bx, by + blockSize / 2 - 1, blockSize, 2);
        ctx.fillRect(bx + blockSize / 2 - 1, by, 2, blockSize / 2);
        ctx.fillRect(bx + blockSize / 4 - 1, by + blockSize / 2, 2, blockSize / 2);
        ctx.fillRect(bx + blockSize * 3 / 4 - 1, by + blockSize / 2, 2, blockSize / 2);
      }
    } else if (platform.type === 'question') {
      const blockSize = platform.height;
      const numBlocks = Math.ceil(platform.width / blockSize);
      const bounce = !platform.isUsed ? Math.sin(Date.now() / 200) * 2 : 0;

      for (let i = 0; i < numBlocks; i++) {
        const bx = screenX + i * blockSize;
        const by = drawY + bounce;

        if (platform.isUsed) {
            // Used block (empty)
            ctx.fillStyle = '#6B3E08'; // Dark brown
            ctx.fillRect(bx, by, blockSize, blockSize);

            // Inner rivets
            ctx.fillStyle = '#000';
            ctx.fillRect(bx + 4, by + 4, 4, 4);
            ctx.fillRect(bx + blockSize - 8, by + 4, 4, 4);
            ctx.fillRect(bx + 4, by + blockSize - 8, 4, 4);
            ctx.fillRect(bx + blockSize - 8, by + blockSize - 8, 4, 4);

            // Border
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, by, blockSize, blockSize);
        } else {
            // SMB Question block
            ctx.fillStyle = '#E8A010';
            ctx.fillRect(bx, by, blockSize, blockSize);

            // Inner area
            ctx.fillStyle = '#F8D830';
            ctx.fillRect(bx + 3, by + 3, blockSize - 6, blockSize - 6);

            // Corner rivets
            ctx.fillStyle = '#E8A010';
            ctx.fillRect(bx + 4, by + 4, 4, 4);
            ctx.fillRect(bx + blockSize - 8, by + 4, 4, 4);
            ctx.fillRect(bx + 4, by + blockSize - 8, 4, 4);
            ctx.fillRect(bx + blockSize - 8, by + blockSize - 8, 4, 4);

            // Shine effect
            ctx.fillStyle = '#FFF';
            ctx.fillRect(bx + 5, by + 5, 2, 2);

            // Question mark - pixel style
            ctx.fillStyle = '#C87820';
            // Top of ?
            ctx.fillRect(bx + blockSize/2 - 5, by + 6, 10, 3);
            ctx.fillRect(bx + blockSize/2 + 2, by + 8, 3, 4);
            // Middle curve
            ctx.fillRect(bx + blockSize/2 - 2, by + 11, 5, 3);
            ctx.fillRect(bx + blockSize/2 - 2, by + 14, 3, 2);
            // Dot
            ctx.fillRect(bx + blockSize/2 - 2, by + 19, 3, 3);

            // Black border
            ctx.fillStyle = '#000';
            ctx.fillRect(bx, by, blockSize, 2);
            ctx.fillRect(bx, by + blockSize - 2, blockSize, 2);
            ctx.fillRect(bx, by, 2, blockSize);
            ctx.fillRect(bx + blockSize - 2, by, 2, blockSize);
        }
      }
    }
  };

  const drawCoin = (ctx, coin, offset) => {
    if (coin.collected) return;

    const screenX = coin.x - offset;
    const frame = Math.floor(Date.now() / 150) % 4;
    const widths = [12, 8, 4, 8];
    const coinWidth = widths[frame];

    // Coin body
    ctx.fillStyle = '#F8B800';
    ctx.beginPath();
    ctx.ellipse(screenX, coin.y, coinWidth, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner circle
    if (coinWidth > 6) {
      ctx.fillStyle = '#F8D830';
      ctx.beginPath();
      ctx.ellipse(screenX, coin.y, coinWidth - 3, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shine
      ctx.fillStyle = '#FFF8B8';
      ctx.beginPath();
      ctx.ellipse(screenX - 2, coin.y - 4, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outline
    ctx.strokeStyle = '#C87820';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(screenX, coin.y, coinWidth, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  };

  const drawEnemy = (ctx, enemy, offset) => {
    if (!enemy.alive) return;

    const screenX = enemy.x - offset;
    const frame = Math.floor(Date.now() / 200) % 2;
    const px = 2;
    ctx.save();
    ctx.translate(0, enemySpriteYOffset(enemy));

    const drawPixel = (x, y, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(screenX + x * px, enemy.y + y * px, px, px);
    };

    if (enemy.type === 'goomba') {
      // Goomba colors
      const BROWN = '#A04000';
      const DARK_BROWN = '#601800';
      const TAN = '#F0B060';
      const WHITE = '#F8F8F8';
      const BLACK = '#000';

      // Head top (row 0-3)
      for (let i = 6; i <= 13; i++) drawPixel(i, 0, BROWN);
      for (let i = 4; i <= 15; i++) drawPixel(i, 1, BROWN);
      for (let i = 3; i <= 16; i++) drawPixel(i, 2, BROWN);
      for (let i = 2; i <= 17; i++) drawPixel(i, 3, BROWN);

      for (let i = 2; i <= 17; i++) drawPixel(i, 4, BROWN);

      for (let i = 2; i <= 5; i++) drawPixel(i, 5, BROWN);
      drawPixel(6, 5, BLACK);
      drawPixel(7, 5, WHITE);
      drawPixel(8, 5, WHITE);
      for (let i = 9; i <= 10; i++) drawPixel(i, 5, BROWN);
      drawPixel(11, 5, WHITE);
      drawPixel(12, 5, WHITE);
      drawPixel(13, 5, BLACK);
      for (let i = 14; i <= 17; i++) drawPixel(i, 5, BROWN);

      for (let i = 2; i <= 5; i++) drawPixel(i, 6, BROWN);
      drawPixel(6, 6, BLACK);
      drawPixel(7, 6, BLACK);
      drawPixel(8, 6, WHITE);
      for (let i = 9; i <= 10; i++) drawPixel(i, 6, BROWN);
      drawPixel(11, 6, WHITE);
      drawPixel(12, 6, BLACK);
      drawPixel(13, 6, BLACK);
      for (let i = 14; i <= 17; i++) drawPixel(i, 6, BROWN);

      for (let i = 2; i <= 17; i++) drawPixel(i, 7, BROWN);
      for (let i = 3; i <= 16; i++) drawPixel(i, 8, BROWN);

      for (let i = 4; i <= 15; i++) drawPixel(i, 9, TAN);
      for (let i = 3; i <= 16; i++) drawPixel(i, 10, TAN);
      for (let i = 2; i <= 17; i++) drawPixel(i, 11, TAN);

      drawPixel(7, 9, BLACK);
      drawPixel(12, 9, BLACK);
      for (let i = 8; i <= 11; i++) drawPixel(i, 10, BLACK);

      const footShift = frame === 0 ? 0 : 2;
      for (let i = 1 - footShift; i <= 6 - footShift; i++) if (i >= 0) drawPixel(i, 12, DARK_BROWN);
      for (let i = 0 - footShift; i <= 7 - footShift; i++) if (i >= 0) drawPixel(i, 13, DARK_BROWN);
      for (let i = 0 - footShift; i <= 7 - footShift; i++) if (i >= 0) drawPixel(i, 14, BLACK);
      for (let i = 13 + footShift; i <= 18 + footShift; i++) if (i <= 19) drawPixel(i, 12, DARK_BROWN);
      for (let i = 12 + footShift; i <= 19 + footShift; i++) if (i <= 19) drawPixel(i, 13, DARK_BROWN);
      for (let i = 12 + footShift; i <= 19 + footShift; i++) if (i <= 19) drawPixel(i, 14, BLACK);

    } else if (enemy.type === 'koopa') {
      const GREEN = '#00A800';
      const LIGHT_GREEN = '#80D010';
      const YELLOW = '#F8D830';
      const WHITE = '#FFF';
      const BLACK = '#000';

      if (enemy.isShell) {
        // Shell only
        ctx.fillStyle = GREEN;
        ctx.beginPath();
        ctx.ellipse(screenX + 20, enemy.y + 20, 18, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = LIGHT_GREEN;
        ctx.beginPath();
        ctx.ellipse(screenX + 20, enemy.y + 18, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = YELLOW;
        ctx.fillRect(screenX + 8, enemy.y + 28, 24, 8);
        ctx.strokeStyle = BLACK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(screenX + 20, enemy.y + 20, 18, 16, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Full Koopa
        // Shell
        ctx.fillStyle = GREEN;
        ctx.beginPath();
        ctx.ellipse(screenX + 20, enemy.y + 20, 16, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = LIGHT_GREEN;
        ctx.beginPath();
        ctx.ellipse(screenX + 20, enemy.y + 18, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = YELLOW;
        ctx.beginPath();
        ctx.arc(screenX + 28, enemy.y + 8, 10, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = WHITE;
        ctx.beginPath();
        ctx.arc(screenX + 30, enemy.y + 6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = BLACK;
        ctx.beginPath();
        ctx.arc(screenX + 31, enemy.y + 6, 2, 0, Math.PI * 2);
        ctx.fill();

        // Feet
        const footY = enemy.y + 32 + (frame * 3);
        ctx.fillStyle = YELLOW;
        ctx.fillRect(screenX + 8, footY, 10, 8);
        ctx.fillRect(screenX + 22, footY - (frame * 3), 10, 8);

        ctx.strokeStyle = BLACK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(screenX + 20, enemy.y + 20, 16, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

    } else if (enemy.type === 'spiny') {
      const RED = '#E52521';
      const DARK_RED = '#A01010';
      const WHITE = '#FFF';
      const BLACK = '#000';

      // Body
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.ellipse(screenX + 18, enemy.y + 20, 16, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Spikes
      ctx.fillStyle = WHITE;
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i - 2) * 0.5;
        const spikeX = screenX + 18 + Math.cos(angle) * 14;
        const spikeY = enemy.y + 20 + Math.sin(angle) * 12;
        ctx.beginPath();
        ctx.moveTo(spikeX, spikeY);
        ctx.lineTo(spikeX - 4, spikeY - 10);
        ctx.lineTo(spikeX + 4, spikeY - 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = DARK_RED;
        ctx.beginPath();
        ctx.arc(spikeX, spikeY - 12, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = WHITE;
      }

      // Eyes
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.arc(screenX + 12, enemy.y + 18, 5, 0, Math.PI * 2);
      ctx.arc(screenX + 24, enemy.y + 18, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.arc(screenX + 13, enemy.y + 18, 2, 0, Math.PI * 2);
      ctx.arc(screenX + 25, enemy.y + 18, 2, 0, Math.PI * 2);
      ctx.fill();

      // Feet
      ctx.fillStyle = DARK_RED;
      ctx.fillRect(screenX + 6, enemy.y + 28 + (frame * 2), 8, 6);
      ctx.fillRect(screenX + 22, enemy.y + 28 - (frame * 2), 8, 6);

    } else if (enemy.type === 'piranha') {
      const GREEN = '#00A800';
      const DARK_GREEN = '#006000';
      const RED = '#E52521';
      const WHITE = '#FFF';

      const popOffset = Math.sin(enemy.timer * 0.05) * 40;
      const drawY = enemy.baseY + 40 - Math.max(0, popOffset);

      if (popOffset > 5) {
        // Stem
        ctx.fillStyle = GREEN;
        ctx.fillRect(screenX + 16, drawY + 30, 16, 40);
        ctx.fillStyle = DARK_GREEN;
        ctx.fillRect(screenX + 16, drawY + 30, 4, 40);

        // Head
        ctx.fillStyle = RED;
        ctx.beginPath();
        ctx.ellipse(screenX + 24, drawY + 20, 20, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mouth
        ctx.fillStyle = '#800000';
        ctx.beginPath();
        ctx.ellipse(screenX + 24, drawY + 24, 14, 10, 0, 0, Math.PI);
        ctx.fill();

        // Teeth
        ctx.fillStyle = WHITE;
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(screenX + 12 + i * 5, drawY + 18, 3, 6);
        }

        // White dots
        ctx.beginPath();
        ctx.arc(screenX + 14, drawY + 10, 4, 0, Math.PI * 2);
        ctx.arc(screenX + 34, drawY + 10, 4, 0, Math.PI * 2);
        ctx.fill();

        // Lips
        ctx.fillStyle = GREEN;
        ctx.beginPath();
        ctx.ellipse(screenX + 24, drawY + 6, 16, 6, 0, Math.PI, 0);
        ctx.fill();
      }

    } else if (enemy.type === 'lakitu') {
      const WHITE = '#FFF';
      const GREEN = '#00A800';
      const YELLOW = '#F8D830';
      const BLACK = '#000';

      // Cloud
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.arc(screenX + 20, enemy.y + 35, 18, 0, Math.PI * 2);
      ctx.arc(screenX + 8, enemy.y + 38, 12, 0, Math.PI * 2);
      ctx.arc(screenX + 32, enemy.y + 38, 12, 0, Math.PI * 2);
      ctx.fill();

      // Lakitu body
      ctx.fillStyle = GREEN;
      ctx.beginPath();
      ctx.ellipse(screenX + 20, enemy.y + 20, 14, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shell pattern
      ctx.fillStyle = '#80D010';
      ctx.beginPath();
      ctx.ellipse(screenX + 20, enemy.y + 18, 8, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = YELLOW;
      ctx.beginPath();
      ctx.arc(screenX + 20, enemy.y + 6, 10, 0, Math.PI * 2);
      ctx.fill();

      // Goggles
      ctx.fillStyle = BLACK;
      ctx.fillRect(screenX + 8, enemy.y + 2, 24, 8);
      ctx.fillStyle = WHITE;
      ctx.fillRect(screenX + 10, enemy.y + 4, 8, 4);
      ctx.fillRect(screenX + 22, enemy.y + 4, 8, 4);
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.arc(screenX + 14, enemy.y + 6, 2, 0, Math.PI * 2);
      ctx.arc(screenX + 26, enemy.y + 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawPowerUp = (ctx, powerUp, offset) => {
    if (powerUp.collected || !powerUp.spawned) return;

    const screenX = powerUp.x - offset;
    const bounce = Math.sin(Date.now() / 200) * 2;

    if (powerUp.type === 'mushroom') {
      // Red mushroom
      ctx.fillStyle = '#E52521';
      ctx.beginPath();
      ctx.arc(screenX + 15, powerUp.y + 8 + bounce, 15, Math.PI, 0);
      ctx.fill();

      // White spots
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(screenX + 8, powerUp.y + 4 + bounce, 4, 0, Math.PI * 2);
      ctx.arc(screenX + 22, powerUp.y + 4 + bounce, 4, 0, Math.PI * 2);
      ctx.arc(screenX + 15, powerUp.y - 2 + bounce, 3, 0, Math.PI * 2);
      ctx.fill();

      // Stem
      ctx.fillStyle = '#F8D830';
      ctx.fillRect(screenX + 8, powerUp.y + 8 + bounce, 14, 14);

      // Eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(screenX + 10, powerUp.y + 12 + bounce, 3, 4);
      ctx.fillRect(screenX + 17, powerUp.y + 12 + bounce, 3, 4);

      // Outline
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX + 15, powerUp.y + 8 + bounce, 15, Math.PI, 0);
      ctx.stroke();
    } else if (powerUp.type === 'fire') {
      // Fire flower
      const petalBounce = Math.sin(Date.now() / 150) * 2;

      // Stem
      ctx.fillStyle = '#00A800';
      ctx.fillRect(screenX + 12, powerUp.y + 10 + bounce, 6, 18);

      // Leaves
      ctx.fillStyle = '#00A800';
      ctx.beginPath();
      ctx.ellipse(screenX + 6, powerUp.y + 18 + bounce, 8, 4, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(screenX + 24, powerUp.y + 18 + bounce, 8, 4, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Flower center
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(screenX + 15, powerUp.y + 6 + bounce + petalBounce, 6, 0, Math.PI * 2);
      ctx.fill();

      // Petals
      ctx.fillStyle = '#E52521';
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + Date.now() / 500;
        const px = screenX + 15 + Math.cos(angle) * 10;
        const py = powerUp.y + 6 + bounce + petalBounce + Math.sin(angle) * 10;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(screenX + 12, powerUp.y + 4 + bounce + petalBounce, 2, 3);
      ctx.fillRect(screenX + 16, powerUp.y + 4 + bounce + petalBounce, 2, 3);
    } else if (powerUp.type === 'star') {
      // Star - rainbow flashing
      const colors = ['#F8D830', '#E52521', '#00A800', '#5C94FC'];
      const colorIndex = Math.floor(Date.now() / 100) % 4;
      ctx.fillStyle = colors[colorIndex];

      // Draw star shape
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
        const x = screenX + 15 + Math.cos(angle) * 14;
        const y = powerUp.y + 14 + bounce + Math.sin(angle) * 14;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Inner star
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
        const x = screenX + 15 + Math.cos(angle) * 7;
        const y = powerUp.y + 14 + bounce + Math.sin(angle) * 7;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(screenX + 10, powerUp.y + 12 + bounce, 3, 3);
      ctx.fillRect(screenX + 17, powerUp.y + 12 + bounce, 3, 3);
    }
  };

  const drawFireball = (ctx, fireball, offset) => {
    const screenX = fireball.x - offset;
    const rotation = Date.now() / 50;

    ctx.save();
    ctx.translate(screenX, fireball.y);
    ctx.rotate(rotation);

    // Fireball
    ctx.fillStyle = '#E52521';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F8D830';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(-2, -2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const drawFlag = (ctx, flag, offset) => {
    const screenX = flag.x - offset;
    const baseY = flag.y + flag.height;

    // Castle in background
    const castleX = screenX + 60;
    const castleY = baseY - 128;

    // Castle main body
    ctx.fillStyle = '#C84C0C';
    ctx.fillRect(castleX, castleY + 32, 96, 96);
    ctx.fillStyle = '#E8A060';
    ctx.fillRect(castleX + 4, castleY + 36, 88, 88);
    ctx.fillStyle = '#C84C0C';
    ctx.fillRect(castleX + 8, castleY + 40, 80, 80);

    // Castle battlements
    ctx.fillStyle = '#C84C0C';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(castleX + i * 24 - 6, castleY, 18, 40);
      ctx.fillStyle = '#E8A060';
      ctx.fillRect(castleX + i * 24 - 2, castleY + 4, 10, 32);
      ctx.fillStyle = '#C84C0C';
    }

    // Castle door
    ctx.fillStyle = '#000';
    ctx.fillRect(castleX + 32, castleY + 72, 32, 56);
    ctx.fillStyle = '#C84C0C';
    ctx.beginPath();
    ctx.arc(castleX + 48, castleY + 72, 16, Math.PI, 0);
    ctx.fill();

    // Castle windows
    ctx.fillStyle = '#000';
    ctx.fillRect(castleX + 16, castleY + 52, 12, 16);
    ctx.fillRect(castleX + 68, castleY + 52, 12, 16);

    // Pole (white like SMB)
    ctx.fillStyle = '#B8B8B8';
    ctx.fillRect(screenX + 6, flag.y, 8, flag.height);

    // Pole highlight
    ctx.fillStyle = '#F8F8F8';
    ctx.fillRect(screenX + 6, flag.y, 3, flag.height);

    // Pole shadow
    ctx.fillStyle = '#686868';
    ctx.fillRect(screenX + 11, flag.y, 3, flag.height);

    // Ball on top (gold)
    ctx.fillStyle = '#F8D830';
    ctx.beginPath();
    ctx.arc(screenX + 10, flag.y - 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E8A010';
    ctx.beginPath();
    ctx.arc(screenX + 12, flag.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Flag (green with peace symbol like SMB)
    const wave = Math.sin(Date.now() / 300) * 2;
    ctx.fillStyle = '#00A800';
    ctx.fillRect(screenX + 14, flag.y + 10 + wave, 48, 32);

    // Flag highlight
    ctx.fillStyle = '#80D010';
    ctx.fillRect(screenX + 18, flag.y + 14 + wave, 20, 24);

    // Peace symbol on flag
    ctx.fillStyle = '#F8F8F8';
    ctx.beginPath();
    ctx.arc(screenX + 38, flag.y + 26 + wave, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00A800';
    ctx.beginPath();
    ctx.arc(screenX + 38, flag.y + 26 + wave, 6, 0, Math.PI * 2);
    ctx.fill();

    // Flag pole attachment
    ctx.fillStyle = '#000';
    ctx.fillRect(screenX + 12, flag.y + 8 + wave, 4, 36);

    // Base blocks (SMB style stacked)
    ctx.fillStyle = '#C84C0C';
    ctx.fillRect(screenX - 12, baseY - 32, 44, 32);
    ctx.fillStyle = '#E8A060';
    ctx.fillRect(screenX - 8, baseY - 28, 36, 24);
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(screenX - 12, baseY - 32, 44, 32);
  };

  const drawBackground = (ctx, offset, levelNum) => {
    // Classic SMB sky blue or underground black
    if (levelNum === 2) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 800, 600);
    } else if (levelNum === 3) {
      // Sky level - lighter blue with gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, 600);
      gradient.addColorStop(0, '#6B8CFF');
      gradient.addColorStop(1, '#5C94FC');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 600);
    } else {
      ctx.fillStyle = '#5C94FC';
      ctx.fillRect(0, 0, 800, 600);
    }

    // Draw SMB-style clouds (pixel blocks)
    const drawCloud = (x, y, size) => {
      const blockSize = size / 3;
      ctx.fillStyle = '#F8F8F8';

      // Top row
      ctx.fillRect(x + blockSize, y, blockSize * 3, blockSize);
      // Middle row
      ctx.fillRect(x, y + blockSize, blockSize * 5, blockSize);
      // Bottom row
      ctx.fillRect(x + blockSize, y + blockSize * 2, blockSize * 3, blockSize);

      // Eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(x + blockSize * 1.2, y + blockSize * 1.2, blockSize * 0.4, blockSize * 0.4);
      ctx.fillRect(x + blockSize * 3.2, y + blockSize * 1.2, blockSize * 0.4, blockSize * 0.4);

      // Highlight
      ctx.fillStyle = '#FFF';
      ctx.fillRect(x + blockSize * 0.5, y + blockSize * 0.5, blockSize * 0.5, blockSize * 0.3);
    };

    const clouds = [
      { x: 80, y: 60, s: 36 },
      { x: 350, y: 90, s: 30 },
      { x: 600, y: 50, s: 42 },
      { x: 950, y: 80, s: 33 },
      { x: 1300, y: 60, s: 39 },
      { x: 1650, y: 100, s: 30 },
      { x: 2000, y: 55, s: 36 },
      { x: 2400, y: 85, s: 33 },
      { x: 2800, y: 70, s: 39 },
      { x: 3200, y: 95, s: 30 },
      { x: 3600, y: 60, s: 36 },
      { x: 4000, y: 80, s: 33 },
    ];

    if (levelNum !== 2) {
      clouds.forEach(cloud => {
        const screenX = cloud.x - offset * 0.2;
        if (screenX > -80 && screenX < 850) {
          drawCloud(screenX, cloud.y, cloud.s);
        }
      });
    }

    // Draw SMB-style hills (layered semicircles)
    const drawHill = (x, y, size, isLarge) => {
      // Main hill body
      ctx.fillStyle = '#00A800';
      ctx.beginPath();
      ctx.arc(x, y, size, Math.PI, 0);
      ctx.fill();

      // Lighter stripe pattern
      ctx.fillStyle = '#80D010';
      const stripeCount = isLarge ? 5 : 3;
      for (let i = 0; i < stripeCount; i++) {
        const stripeY = y - size * 0.3 - i * (size * 0.15);
        ctx.fillRect(x - size * 0.6 + i * 8, stripeY, size * 0.15, size * 0.1);
        ctx.fillRect(x + size * 0.3 - i * 8, stripeY, size * 0.15, size * 0.1);
      }

      // Top highlight
      ctx.beginPath();
      ctx.arc(x, y - size * 0.6, size * 0.15, 0, Math.PI * 2);
      ctx.fill();
    };

    const hills = [
      { x: 120, y: 500, s: 80, large: true },
      { x: 380, y: 500, s: 50, large: false },
      { x: 700, y: 500, s: 90, large: true },
      { x: 1050, y: 500, s: 55, large: false },
      { x: 1400, y: 500, s: 85, large: true },
      { x: 1750, y: 500, s: 50, large: false },
      { x: 2100, y: 500, s: 90, large: true },
      { x: 2500, y: 500, s: 55, large: false },
      { x: 2900, y: 500, s: 80, large: true },
      { x: 3300, y: 500, s: 50, large: false },
      { x: 3700, y: 500, s: 85, large: true },
      { x: 4100, y: 500, s: 55, large: false },
    ];

    if (levelNum !== 2) {
      hills.forEach(hill => {
        const screenX = hill.x - offset * 0.3;
        if (screenX > -150 && screenX < 950) {
          drawHill(screenX, hill.y, hill.s, hill.large);
        }
      });
    }

    // Draw SMB-style bushes (same shape as clouds but green!)
    const drawBush = (x, y, size) => {
      const blockSize = size / 3;
      ctx.fillStyle = '#00A800';

      // Top row
      ctx.fillRect(x + blockSize, y, blockSize * 3, blockSize);
      // Middle row
      ctx.fillRect(x, y + blockSize, blockSize * 5, blockSize);

      // Lighter spots
      ctx.fillStyle = '#80D010';
      ctx.fillRect(x + blockSize * 0.5, y + blockSize * 0.3, blockSize * 0.4, blockSize * 0.4);
      ctx.fillRect(x + blockSize * 2.5, y + blockSize * 0.3, blockSize * 0.4, blockSize * 0.4);
      ctx.fillRect(x + blockSize * 4, y + blockSize * 0.5, blockSize * 0.4, blockSize * 0.4);
    };

    const bushes = [
      { x: 220, y: 475, s: 24 },
      { x: 550, y: 475, s: 30 },
      { x: 880, y: 475, s: 21 },
      { x: 1250, y: 475, s: 27 },
      { x: 1600, y: 475, s: 24 },
      { x: 1980, y: 475, s: 30 },
      { x: 2350, y: 475, s: 21 },
      { x: 2750, y: 475, s: 27 },
      { x: 3150, y: 475, s: 24 },
      { x: 3550, y: 475, s: 30 },
      { x: 3950, y: 475, s: 21 },
    ];

    if (levelNum !== 2) {
      bushes.forEach(bush => {
        const screenX = bush.x - offset * 0.5;
        if (screenX > -50 && screenX < 850) {
          drawBush(screenX, bush.y, bush.s);
        }
      });
    }

    // Draw pipes for decoration
    const drawPipe = (x, height) => {
      const pipeTop = 500 - height;

      // Pipe body
      ctx.fillStyle = '#00A800';
      ctx.fillRect(x, pipeTop + 24, 48, height - 24);

      // Pipe body highlight
      ctx.fillStyle = '#80D010';
      ctx.fillRect(x + 4, pipeTop + 24, 16, height - 24);

      // Pipe body shadow
      ctx.fillStyle = '#006000';
      ctx.fillRect(x + 36, pipeTop + 24, 8, height - 24);

      // Pipe top
      ctx.fillStyle = '#00A800';
      ctx.fillRect(x - 4, pipeTop, 56, 24);

      // Pipe top highlight
      ctx.fillStyle = '#80D010';
      ctx.fillRect(x, pipeTop + 4, 20, 16);

      // Pipe top shadow
      ctx.fillStyle = '#006000';
      ctx.fillRect(x + 40, pipeTop + 4, 8, 16);

      // Black outline
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 4, pipeTop, 56, 24);
      ctx.strokeRect(x, pipeTop + 24, 48, height - 24);
    };

    const pipes = [
      { x: 450, h: 64 },
      { x: 1150, h: 96 },
      { x: 1850, h: 64 },
      { x: 2650, h: 80 },
      { x: 3350, h: 64 },
    ];

    if (levelNum === 1) {
      pipes.forEach(pipe => {
        const screenX = pipe.x - offset;
        if (screenX > -60 && screenX < 860) {
          drawPipe(screenX, pipe.h);
        }
      });
    }
  };

  const checkCollision = (rect1, rect2) => {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
  };

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const player = playerRef.current;
    const world = worldRef.current;

    if (gameState === 'editor') {
        // Editor render loop
        drawBackground(ctx, world.offset, 1);

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

        world.platforms.forEach(p => drawPlatform(ctx, p, world.offset));
        world.coins.forEach(c => drawCoin(ctx, c, world.offset));
        world.powerUps.forEach(p => drawPowerUp(ctx, p, world.offset));
        world.enemies.forEach(e => drawEnemy(ctx, e, world.offset));
        if (world.flag) drawFlag(ctx, world.flag, world.offset);

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

    // Handle input
    if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) {
      player.velocityX = -MOVE_SPEED;
      player.facingRight = false;
    } else if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) {
      player.velocityX = MOVE_SPEED;
      player.facingRight = true;
    } else {
      player.velocityX *= 0.8;
    }

    if ((keysRef.current['ArrowUp'] || keysRef.current['KeyW'] || keysRef.current['Space']) && player.onGround) {
      player.velocityY = JUMP_FORCE;
      player.onGround = false;
      player.isJumping = true;
      soundController.playJump();
    }

    // Apply gravity
    player.velocityY += GRAVITY;

    // Update position
    player.x += player.velocityX;
    player.y += player.velocityY;

    // Platform collision
    player.onGround = false;
    world.platforms.forEach(platform => {
      if (checkCollision(player, platform)) {
        // Landing on top
        if (player.velocityY > 0 && player.y + player.height - player.velocityY <= platform.y) {
          player.y = platform.y - player.height;
          player.velocityY = 0;
          player.onGround = true;
          player.isJumping = false;
        }
        // Hitting from below
        else if (player.velocityY < 0 && player.y - player.velocityY >= platform.y + platform.height) {
          player.y = platform.y + platform.height;
          player.velocityY = 0;

          if (platform.type === 'question') {
              if (!platform.isUsed) {
                  platform.isUsed = true;
                  platform.bounceY = -10;

                  // Check for powerups in this block
                  const foundPowerUp = world.powerUps.find(p =>
                      !p.spawned &&
                      p.x >= platform.x && p.x < platform.x + platform.width &&
                      p.y <= platform.y && p.y >= platform.y - 50
                  );

                  if (foundPowerUp) {
                      foundPowerUp.spawned = true;
                      foundPowerUp.velocityY = -8; // Pop up
                      foundPowerUp.y = platform.y - 30; // Ensure it starts above
                      soundController.playPowerUp();
                  } else {
                      // Coin pop
                      world.effects.push({
                          x: platform.x + platform.width / 2,
                          y: platform.y,
                          type: 'coin_pop',
                          frame: 0
                      });
                      setScore(s => s + 200);
                      soundController.playCoin();
                  }
              } else {
                  soundController.playBump();
              }
          } else if (platform.type === 'brick') {
            platform.bounceY = -5;
            soundController.playBump();
          }
        }
        // Side collision
        else if (player.velocityX > 0) {
          player.x = platform.x - player.width;
        } else if (player.velocityX < 0) {
          player.x = platform.x + platform.width;
        }
      }
    });

    // Coin collection
    world.coins.forEach(coin => {
      if (!coin.collected) {
        const coinRect = { x: coin.x - 12, y: coin.y - 15, width: 24, height: 30 };
        if (checkCollision(player, coinRect)) {
          coin.collected = true;
          setScore(s => s + 100);
          soundController.playCoin();
        }
      }
    });

    // Update Effects (visual coins, etc)
    if (world.effects) {
        world.effects = world.effects.filter(effect => {
            effect.frame++;
            return effect.frame < 30;
        });
    }

    // Update platform bounce
    world.platforms.forEach(p => {
        if (p.bounceY) {
            p.bounceY *= 0.8;
            if (Math.abs(p.bounceY) < 0.5) p.bounceY = 0;
        }
    });

    // Power-up movement and collection
    world.powerUps.forEach(powerUp => {
      if (!powerUp.collected && powerUp.spawned) {
        // Moving power-ups (mushroom and star)
        if (powerUp.type === 'mushroom' || powerUp.type === 'star') {
          powerUp.x += powerUp.velocityX || 0;
          powerUp.velocityY = (powerUp.velocityY || 0) + GRAVITY;
          powerUp.y += powerUp.velocityY;

          // Platform collision for power-ups
          world.platforms.forEach(platform => {
            const puRect = { x: powerUp.x, y: powerUp.y, width: 30, height: 28 };
            if (checkCollision(puRect, platform)) {
              if (powerUp.velocityY > 0) {
                powerUp.y = platform.y - 28;
                powerUp.velocityY = powerUp.type === 'star' ? -8 : 0; // Stars bounce
              }
            }
          });

          // Reverse at edges
          if (powerUp.x < 0 || powerUp.y > 700) {
            powerUp.collected = true;
          }
        }

        // Collection
        const puRect = { x: powerUp.x, y: powerUp.y, width: 30, height: 28 };
        if (checkCollision(player, puRect)) {
          powerUp.collected = true;
          setScore(s => s + 1000);
          soundController.playPowerUp();

          if (powerUp.type === 'mushroom') {
            if (player.powerUp === 'small') {
              player.powerUp = 'big';
              player.height = 65;
            }
          } else if (powerUp.type === 'fire') {
            player.powerUp = 'fire';
            player.height = 65;
          } else if (powerUp.type === 'star') {
            player.starTimer = 600; // ~10 seconds at 60fps
            player.isInvincible = true;
          }
        }
      }
    });

    // Update star timer
    if (player.starTimer > 0) {
      player.starTimer--;
      if (player.starTimer <= 0) {
        player.isInvincible = false;
      }
    }

    // Update invincibility timer (after getting hit)
    if (player.invincibleTimer > 0) {
      player.invincibleTimer--;
      if (player.invincibleTimer <= 0) {
        player.isInvincible = false;
      }
    }

    // Fireball shooting (press X or Z key)
    if ((keysRef.current['KeyX'] || keysRef.current['KeyZ']) && player.powerUp === 'fire' && player.fireballs.length < 2) {
      if (!player.lastFireball || Date.now() - player.lastFireball > 300) {
        player.fireballs.push({
          x: player.x + (player.facingRight ? 40 : 0),
          y: player.y + 20,
          velocityX: player.facingRight ? 8 : -8,
          velocityY: 0
        });
        player.lastFireball = Date.now();
        soundController.playFireball();
      }
    }

    // Update fireballs
    player.fireballs = player.fireballs.filter(fb => {
      fb.x += fb.velocityX;
      fb.velocityY += GRAVITY * 0.5;
      fb.y += fb.velocityY;

      // Bounce off platforms
      world.platforms.forEach(platform => {
        const fbRect = { x: fb.x - 8, y: fb.y - 8, width: 16, height: 16 };
        if (checkCollision(fbRect, platform)) {
          if (fb.velocityY > 0) {
            fb.y = platform.y - 8;
            fb.velocityY = -6;
          }
        }
      });

      // Hit enemies (fireballs don't kill spinies)
      world.enemies.forEach(enemy => {
        if (enemy.alive && enemy.type !== 'spiny' && enemy.type !== 'piranha' && enemy.type !== 'lakitu') {
          const fbRect = { x: fb.x - 8, y: fb.y - 8, width: 16, height: 16 };
          if (checkCollision(fbRect, enemy)) {
            if (enemy.type === 'koopa') {
              enemy.isShell = true;
              enemy.height = 32;
              enemy.velocityX = 0;
              setScore(s => s + 200);
            } else if (enemy.type === 'bowser') {
              enemy.hp--;
              enemy.hitTimer = 10; // Flash frames
              if (enemy.hp <= 0) {
                enemy.alive = false;
                setScore(s => s + 5000);
                soundController.playStageClear(); // Satisfying kill sound logic?
              } else {
                soundController.playKick(); // Hit sound
              }
            } else {
              enemy.alive = false;
              setScore(s => s + 200);
            }
            fb.y = -100;
          }
        }
      });

      // Remove if off screen or too low
      return fb.x > world.offset - 50 && fb.x < world.offset + 850 && fb.y < 650;
    });

    // Update enemy projectiles (Bowser fire)
    world.enemyProjectiles = (world.enemyProjectiles || []).filter(proj => {
      proj.x += proj.velocityX;

      // Animate
      proj.frame = (proj.frame || 0) + 1;

      // Check collision with player
      const projRect = { x: proj.x, y: proj.y + 10, width: 40, height: 20 };
      if (checkCollision(player, projRect) && !player.isInvincible && !player.starTimer) {
         if (player.powerUp !== 'small') {
            player.powerUp = 'small';
            player.height = 50;
            player.isInvincible = true;
            player.invincibleTimer = 120;
            soundController.playDie();
          } else {
            setLives(l => {
              const newLives = l - 1;
              if (newLives <= 0) {
                  setGameState('gameover');
                  soundController.playDie();
              } else {
                  player.x = 100; player.y = 300; player.velocityX = 0; player.velocityY = 0; player.powerUp = 'small'; player.height = 50; world.offset = 0;
                  soundController.playDie();
              }
              return newLives;
            });
          }
      }

      return proj.x > world.offset - 100 && proj.x < world.offset + 900;
    });

    // Enemy collision
    world.enemies.forEach(enemy => {
      if (enemy.alive) {
        // Enemy-specific behavior
        if (enemy.type === 'piranha') {
          // Piranha plant pops in/out
          enemy.timer = (enemy.timer || 0) + 1;
          if (enemy.timer > 240) enemy.timer = 0;

          // Only collide when popped up
          const popOffset = Math.sin(enemy.timer * 0.05) * 40;
          if (popOffset > 10 && !player.isInvincible) {
            const piranhaRect = { x: enemy.x, y: enemy.baseY - 20, width: 48, height: 50 };
            if (checkCollision(player, piranhaRect)) {
              if (player.starTimer > 0) {
                enemy.alive = false;
                setScore(s => s + 200);
              } else if (player.powerUp !== 'small') {
                player.powerUp = 'small';
                player.height = 50;
                player.isInvincible = true;
                player.invincibleTimer = 120;
              } else {
                setLives(l => {
                  const newLives = l - 1;
                  if (newLives <= 0) setGameState('gameover');
                  else { player.x = 100; player.y = 300; player.velocityX = 0; player.velocityY = 0; player.powerUp = 'small'; player.height = 50; world.offset = 0; }
                  return newLives;
                });
              }
            }
          }
          return; // Skip normal movement for piranha
        }

        if (enemy.type === 'lakitu') {
          // Lakitu follows player and throws spinies
          const targetX = player.x + 50;
          if (enemy.x < targetX) enemy.velocityX = Math.abs(enemy.velocityX);
          else enemy.velocityX = -Math.abs(enemy.velocityX);
          enemy.x += enemy.velocityX;

          // Spawn spinies periodically
          enemy.spawnTimer = (enemy.spawnTimer || 0) + 1;
          if (enemy.spawnTimer > 180 && Math.abs(enemy.x - player.x) < 300) {
            enemy.spawnTimer = 0;
            world.enemies.push({
              x: enemy.x + 10, y: enemy.y + 50, width: 36, height: 36,
              velocityX: player.x > enemy.x ? 2 : -2, velocityY: 0,
              alive: true, type: 'spiny', spawned: true
            });
          }

          // Lakitu collision
          if (checkCollision(player, enemy)) {
            if (player.velocityY > 0 && player.y + player.height < enemy.y + 30) {
              enemy.alive = false;
              player.velocityY = JUMP_FORCE / 2;
              setScore(s => s + 800);
            } else if (player.starTimer > 0) {
              enemy.alive = false;
              setScore(s => s + 800);
            }
          }
          return;
        }

        if (enemy.type === 'bowser') {
          // Face player
          enemy.facingLeft = player.x < enemy.x;
          if (enemy.hitTimer > 0) enemy.hitTimer--;

          // Movement - patrol simple
          if (Math.abs(player.x - enemy.x) < 600) { // Only active when close
             // Jump logic
             enemy.jumpTimer++;
             if (enemy.jumpTimer > 120 + Math.random() * 100 && enemy.onGround) {
                enemy.velocityY = -10;
                enemy.onGround = false;
                enemy.jumpTimer = 0;
             }

             // Gravity
             enemy.velocityY = (enemy.velocityY || 0) + GRAVITY;
             enemy.y += enemy.velocityY;

             // Ground collision
             enemy.onGround = false;
             world.platforms.forEach(p => {
                if (enemy.y + enemy.height > p.y && enemy.y + enemy.height < p.y + 20 && enemy.x + enemy.width > p.x && enemy.x < p.x + p.width) {
                   enemy.y = p.y - enemy.height;
                   enemy.velocityY = 0;
                   enemy.onGround = true;
                }
             });
             if (enemy.y > 500) { // Fallback ground
                enemy.y = 500 - enemy.height;
                enemy.velocityY = 0;
                enemy.onGround = true;
             }

             // Move back and forth slightly
             enemy.velocityX = enemy.facingLeft ? -1 : 1;
             // Don't fall off left edge of screen area too much? nah just patrol

             // Fire logic
             enemy.fireTimer++;
             if (enemy.fireTimer > 180) { // Fire every ~3 seconds
                enemy.fireTimer = 0;
                soundController.playFireball();
                world.enemyProjectiles.push({
                   x: enemy.facingLeft ? enemy.x : enemy.x + enemy.width,
                   y: enemy.y + 20,
                   velocityX: enemy.facingLeft ? -6 : 6,
                   type: 'fire',
                   frame: 0
                });
             }
          }

          // Player collision (Body damage)
          if (checkCollision(player, enemy)) {
             if (player.starTimer > 0) {
                enemy.hp--;
                enemy.hitTimer = 10;
                if (enemy.hp <= 0) {
                   enemy.alive = false;
                   setScore(s => s + 5000);
                } else {
                   // Push back?
                   enemy.velocityX = player.x < enemy.x ? 5 : -5;
                }
             } else if (!player.isInvincible) {
                if (player.powerUp !== 'small') {
                    player.powerUp = 'small';
                    player.height = 50;
                    player.isInvincible = true;
                    player.invincibleTimer = 120;
                    soundController.playDie();
                } else {
                    setLives(l => {
                        const newLives = l - 1;
                        if (newLives <= 0) { setGameState('gameover'); soundController.playDie(); }
                        else { player.x = 100; player.y = 300; player.velocityX = 0; player.velocityY = 0; player.powerUp = 'small'; player.height = 50; world.offset = 0; soundController.playDie(); }
                        return newLives;
                    });
                }
             }
          }
          return;
        }

        // Koopa shell movement
        if (enemy.type === 'koopa' && enemy.isShell) {
          if (enemy.shellVelocity !== 0) {
            enemy.x += enemy.shellVelocity;
            // Shell kills other enemies
            world.enemies.forEach(other => {
              if (other !== enemy && other.alive && other.type !== 'piranha' && other.type !== 'lakitu') {
                if (checkCollision(enemy, other)) {
                  other.alive = false;
                  setScore(s => s + 200);
                }
              }
            });
          }
        } else {
          // Normal movement
          enemy.x += enemy.velocityX;
        }

        // Apply gravity for spawned spinies
        if (enemy.spawned && enemy.type === 'spiny') {
          enemy.velocityY = (enemy.velocityY || 0) + GRAVITY;
          enemy.y += enemy.velocityY;
        }

        // Reverse at edges or obstacles (except shells and lakitu)
        if (enemy.type !== 'lakitu' && !(enemy.type === 'koopa' && enemy.isShell && enemy.shellVelocity !== 0)) {
          const onPlatform = world.platforms.some(p =>
            enemy.x + enemy.width > p.x &&
            enemy.x < p.x + p.width &&
            enemy.y + enemy.height >= p.y &&
            enemy.y + enemy.height <= p.y + 10
          );

          if (!onPlatform || enemy.x < 0) {
            enemy.velocityX *= -1;
          }

          // Spawned spiny lands on platform
          if (enemy.spawned && enemy.type === 'spiny') {
            world.platforms.forEach(p => {
              if (enemy.velocityY > 0 && enemy.y + enemy.height > p.y && enemy.y < p.y + 10 &&
                  enemy.x + enemy.width > p.x && enemy.x < p.x + p.width) {
                enemy.y = p.y - enemy.height;
                enemy.velocityY = 0;
              }
            });
          }
        }

        // Player collision
        if (checkCollision(player, enemy)) {
          if (enemy.type === 'spiny') {
            // Spiny hurts on stomp too (unless star power)
            if (player.starTimer > 0) {
              enemy.alive = false;
              setScore(s => s + 200);
              soundController.playKick();
            } else if (!player.isInvincible) {
              if (player.powerUp !== 'small') {
                player.powerUp = 'small';
                player.height = 50;
                player.isInvincible = true;
                player.invincibleTimer = 120;
                soundController.playDie();
              } else {
                setLives(l => {
                  const newLives = l - 1;
                  if (newLives <= 0) {
                      setGameState('gameover');
                      soundController.playDie();
                  }
                  else {
                      player.x = 100; player.y = 300; player.velocityX = 0; player.velocityY = 0; player.powerUp = 'small'; player.height = 50; world.offset = 0;
                      soundController.playDie();
                  }
                  return newLives;
                });
              }
            }
          } else if (enemy.type === 'koopa') {
            if (player.velocityY > 0 && player.y + player.height < enemy.y + enemy.height / 2) {
              if (enemy.isShell) {
                // Kick the shell
                enemy.shellVelocity = player.x < enemy.x ? 10 : -10;
                soundController.playKick();
                player.velocityY = JUMP_FORCE / 2;
                setScore(s => s + 100);
                soundController.playKick();
              } else {
                // Turn into shell
                enemy.isShell = true;
                enemy.height = 32;
                enemy.velocityX = 0;
                soundController.playStomp();
                player.velocityY = JUMP_FORCE / 2;
                setScore(s => s + 100);
                soundController.playStomp();
              }
            } else if (enemy.isShell && enemy.shellVelocity === 0) {
              // Kick stationary shell
              enemy.shellVelocity = player.facingRight ? 10 : -10;
              soundController.playKick();
              soundController.playKick();
            } else if (player.starTimer > 0) {
              enemy.alive = false;
              setScore(s => s + 200);
              soundController.playKick();
            } else if (!player.isInvincible && enemy.shellVelocity !== 0) {
              // Moving shell hurts
              if (player.powerUp !== 'small') {
                player.powerUp = 'small';
                player.height = 50;
                player.isInvincible = true;
                player.invincibleTimer = 120;
                soundController.playDie();
              } else {
                setLives(l => {
                  const newLives = l - 1;
                  if (newLives <= 0) {
                      setGameState('gameover');
                      soundController.playDie();
                  }
                  else {
                      player.x = 100; player.y = 300; player.velocityX = 0; player.velocityY = 0; player.powerUp = 'small'; player.height = 50; world.offset = 0;
                      soundController.playDie();
                  }
                  return newLives;
                });
              }
            }
          } else {
            // Goomba - normal stomp
            if (player.velocityY > 0 && player.y + player.height < enemy.y + enemy.height / 2) {
              enemy.alive = false;
              player.velocityY = JUMP_FORCE / 2;
              setScore(s => s + 200);
              soundController.playStomp();
            } else if (player.starTimer > 0) {
              enemy.alive = false;
              setScore(s => s + 200);
              soundController.playKick();
              soundController.playKick();
            } else if (!player.isInvincible) {
              if (player.powerUp !== 'small') {
                player.powerUp = 'small';
                player.height = 50;
                player.isInvincible = true;
                player.invincibleTimer = 120;
                soundController.playDie();
              } else {
                setLives(l => {
                  const newLives = l - 1;
                  if (newLives <= 0) {
                      setGameState('gameover');
                      soundController.playDie();
                  }
                  else {
                      player.x = 100; player.y = 300; player.velocityX = 0; player.velocityY = 0; player.powerUp = 'small'; player.height = 50; world.offset = 0;
                      soundController.playDie();
                  }
                  return newLives;
                });
              }
            }
          }
        }
      }
    });

    // Remove enemies that fall off screen
    world.enemies = world.enemies.filter(e => e.y < 700 && e.alive);

    // Flag (win condition)
    if (world.flag && checkCollision(player, world.flag)) {
      soundController.playStageClear();
      if (level < 3) {
        // Next level
        setLevel(l => l + 1);
        setGameState('levelcomplete');
      } else {
        // Beat all levels
        setGameState('win');
      }
    }

    // Fall death
    if (player.y > 700) {
      setLives(l => {
        const newLives = l - 1;
        if (newLives <= 0) {
          setGameState('gameover');
        } else {
          player.x = 100;
          player.y = 300;
          player.velocityX = 0;
          player.velocityY = 0;
          world.offset = 0;
        }
        return newLives;
      });
    }

    // Camera follow
    const targetOffset = player.x - 300;
    world.offset = Math.max(0, Math.min(targetOffset, world.maxOffset || 2600));

    // Draw everything
    drawBackground(ctx, world.offset, level);

    world.platforms.forEach(p => drawPlatform(ctx, p, world.offset));
    world.coins.forEach(c => drawCoin(ctx, c, world.offset));
    world.powerUps.forEach(p => drawPowerUp(ctx, p, world.offset));
    world.enemies.forEach(e => drawEnemy(ctx, e, world.offset));
    if (world.effects) world.effects.forEach(eff => drawEffect(ctx, eff, world.offset));

    // Draw enemy projectiles
    world.enemyProjectiles && world.enemyProjectiles.forEach(p => {
       // Simple fire sprite
       const screenX = p.x - world.offset;
       const f = Math.floor(Date.now() / 100) % 3;
       ctx.fillStyle = ['#E52521', '#F8D830', '#FFFFFF'][f];
       ctx.beginPath();
       ctx.arc(screenX + 20, p.y + 10, 10, 0, Math.PI * 2);
       ctx.fill();
       ctx.fillStyle = '#FFF';
       ctx.fillRect(screenX + (p.velocityX > 0 ? 20 : 10), p.y + 6, 6, 4);
    });

    player.fireballs.forEach(fb => drawFireball(ctx, fb, world.offset));
    if (world.flag) drawFlag(ctx, world.flag, world.offset);
    drawPlayer(ctx, player, world.offset);

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, level, selectedTool, showGrid]);

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
            if (selectedItem.subType === 'bowser') {
                 world.enemies.push({
                    x: gridX, y: gridY - 32, width: 64, height: 64,
                    velocityX: 0, alive: true, type: 'bowser',
                    hp: 5, maxHp: 5, fireTimer: 0, jumpTimer: 0, facingLeft: true
                });
            } else {
                world.enemies.push({
                    x: gridX, y: gridY, width: 32, height: 32,
                    velocityX: -2, alive: true, type: selectedItem.subType,
                    ...(selectedItem.subType === 'piranha' ? { baseY: gridY, width: 48, height: 64, velocityX: 0 } : {})
                });
            }
        } else if (selectedItem.type === 'powerup') {
            world.powerUps.push({ x: gridX, y: gridY, type: selectedItem.subType, collected: false, spawned: true });
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
        setTimeout(() => setIntroPhase(1), 500),   // Mario slides in
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

  const startGame = (startLevel = 1) => {
    soundController.init();
    soundController.playBGM(startLevel);
    setLevel(startLevel);
    initLevel(startLevel);
    setScore(0);
    setLives(3);
    setGameState('playing');
  };

  const nextLevel = () => {
    soundController.playBGM(level);
    initLevel(level);
    setGameState('playing');
  };

  const togglePause = () => {
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
        <div className="flex flex-wrap items-center justify-between gap-2 mb-0 px-2 sm:px-4 py-3 bg-black border-b-4 border-[#C84C0C]" style={{ fontFamily: 'monospace' }}>
          <div className="flex flex-wrap items-center gap-3 sm:gap-10">
            {[['MARIO', String(score).padStart(6,'0'), 'text-white'], ['COINS', `¤×${String(Math.floor(score/100)).padStart(2,'0')}`, 'text-[#F8D830]'], ['WORLD', `${level}-1`, 'text-white'], ['TIME', '∞', 'text-white'], ['LIVES', `×${lives}`, 'text-white']].map(([label, val, cls]) => (
              <div key={label} className="text-center"><span className="text-white font-bold text-xs block tracking-wider">{label}</span><div className={`${cls} font-bold text-lg tracking-wider`}>{val}</div></div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button aria-label="Toggle sound" onClick={toggleMute} variant="outline" size="icon" className="bg-black/40 border-white/20 hover:bg-white/10">{isMuted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}</Button>
            {gameState === 'playing' && <Button aria-label="Pause game" onClick={togglePause} variant="outline" size="icon" className="bg-black/40 border-white/20 hover:bg-white/10"><Pause className="h-4 w-4 text-white" /></Button>}
            <Button aria-label="Restart game" onClick={() => startGame(1)} variant="outline" size="icon" className="bg-black/40 border-white/20 hover:bg-white/10"><RotateCcw className="h-4 w-4 text-white" /></Button>
          </div>
        </div>

        {/* Editor UI Toolbar */}
        {gameState === 'editor' && (
            <div className="absolute top-16 left-4 z-50 flex flex-col gap-2 bg-black/80 p-2 rounded-lg border border-[#C84C0C]">
                <div className="text-white text-xs font-bold text-center mb-1">TOOLS</div>
                <Button aria-label="Brush tool" size="icon" variant={selectedTool === 'brush' ? "default" : "ghost"} onClick={() => setSelectedTool('brush')} className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
                <Button aria-label="Eraser tool" size="icon" variant={selectedTool === 'eraser' ? "default" : "ghost"} onClick={() => setSelectedTool('eraser')} className="h-8 w-8"><Eraser className="h-4 w-4" /></Button>
                <div className="h-px bg-white/20 my-1" />
                <Button aria-label="Toggle grid" size="icon" variant={showGrid ? "default" : "ghost"} onClick={() => setShowGrid(!showGrid)} className="h-8 w-8"><Grid className="h-4 w-4" /></Button>
                <Button aria-label="Save level" size="icon" variant="ghost" onClick={saveCustomLevel} className="h-8 w-8 text-green-400 hover:text-green-300"><Save className="h-4 w-4" /></Button>
                <Button size="sm" variant="destructive" onClick={() => { saveCustomLevel(); initLevel('custom'); setGameState('playing'); }} className="mt-2 text-xs"><Play className="h-3 w-3 mr-1" /> TEST</Button>
            </div>
        )}

        {gameState === 'editor' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-black/80 p-2 rounded-lg border border-[#C84C0C] overflow-x-auto max-w-[90vw]">
                {[
                    { type: 'platform', subType: 'ground', label: 'Ground', color: '#C84C0C' },
                    { type: 'platform', subType: 'brick', label: 'Brick', color: '#C84C0C' },
                    { type: 'platform', subType: 'question', label: '?', color: '#E8A010' },
                    { type: 'coin', subType: 'coin', label: 'Coin', color: '#F8B800' },
                    { type: 'enemy', subType: 'goomba', label: 'Goomba', color: '#A04000' },
                    { type: 'enemy', subType: 'koopa', label: 'Koopa', color: '#00A800' },
                    { type: 'enemy', subType: 'piranha', label: 'Plant', color: '#00A800' },
                    { type: 'enemy', subType: 'spiny', label: 'Spiny', color: '#7B3486' },
                    { type: 'enemy', subType: 'lakitu', label: 'Lakitu', color: '#FFFFFF' },
                    { type: 'enemy', subType: 'bowser', label: 'Bowser', color: '#F8D830' },
                    { type: 'powerup', subType: 'mushroom', label: 'Mushroom', color: '#E52521' },
                    { type: 'powerup', subType: 'fire', label: 'Fire Flower', color: '#F8D830' },
                    { type: 'powerup', subType: 'star', label: 'Star', color: '#F8D830' },
                    { type: 'flag', subType: 'flag', label: 'Flag', color: '#00A800' },
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
        <div className="relative overflow-hidden shadow-2xl shadow-black/50 border-4 border-[#C84C0C]">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onMouseDown={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => mouseRef.current = null}
            className={`bg-sky-300 block w-full h-auto ${gameState === 'editor' ? 'cursor-none' : ''}`}
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Overlays */}
          {gameState === 'intro' && <IntroScreen introPhase={introPhase} onSkip={() => { setGameState('start'); setIntroPhase(0); }} />}
          {gameState === 'start' && <StartScreen onStart={startGame} onEnterEditor={enterEditor} />}
          {gameState === 'paused' && <div className="absolute inset-0 bg-black flex flex-col items-center justify-center" style={{fontFamily:'monospace'}}><div className="text-white text-4xl font-bold mb-8" style={{textShadow:'3px 3px 0 #C84C0C'}}>PAUSED</div><button onClick={togglePause} className="bg-[#C84C0C] hover:bg-[#E8A060] text-white font-bold px-8 py-4 border-4 border-black text-xl transition-colors" style={{textShadow:'1px 1px 0 #000'}}>▶ CONTINUE</button></div>}
          {gameState === 'gameover' && <GameOverScreen score={score} level={level} onRestart={() => startGame(1)} />}
          {gameState === 'levelcomplete' && <div className="absolute inset-0 bg-black flex flex-col items-center justify-center" style={{fontFamily:'monospace'}}><div className="text-[#F8D830] text-4xl font-bold mb-4" style={{textShadow:'3px 3px 0 #C84C0C'}}>COURSE CLEAR!</div><div className="text-white text-xl mb-2">WORLD {level - 1}-1 COMPLETED</div><div className="text-[#F8D830] text-2xl mb-2">SCORE: {String(score).padStart(6,'0')}</div><div className="text-white text-lg mb-8">GET READY FOR WORLD {level}-1</div><button onClick={nextLevel} className="bg-[#00A800] hover:bg-[#80D010] text-white font-bold px-8 py-4 border-4 border-black text-xl transition-colors" style={{textShadow:'1px 1px 0 #000'}}>▶ NEXT WORLD</button></div>}
          {gameState === 'win' && <WinScreen score={score} onRestart={() => startGame(1)} />}
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
