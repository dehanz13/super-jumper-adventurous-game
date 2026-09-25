import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { RotateCcw, Play, Pause, Volume2, VolumeX, Grid, Save, Plus, Eraser } from "lucide-react";
import { soundController } from "@/components/SoundController";
import { GameOverScreen, WinScreen, StartScreen } from '@/components/GameScreens';
import IntroScreen from '@/components/IntroScreen';
import { drawCreature, drawExplorer } from '@/game/characterArt';
import { resolvePlasmaHit } from '@/game/combat';
import { drawBeacon, drawPickup, drawSpaceBackdrop, drawStarShard, drawTerrain } from '@/game/worldArt';
import { alignGroundEnemy, beaconFinishBounds, createEditorCreature, creatureHurtbox, isStomp, playerHurtbox } from '@/game/geometry';
import { DIRECTION_KEYS, directionAtPoint } from '@/game/input';
import { getLevelData, hasNextLevel } from '@/game/levels';
import { takeFixedSteps } from '@/game/fixedStep';

const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const MOVE_SPEED = 5;

export default function Game() {
  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);
  const keysRef = useRef({});
  const directionPointerRef = useRef(null);
  const jumpPointersRef = useRef(new Set());
  const simulationClockRef = useRef({ lastTimestamp: null, accumulator: 0 });
  const livesRef = useRef(3);
  const runEndedRef = useRef(false);

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


  const initLevel = useCallback(
    /** @param {number | 'custom'} levelNum */
    (levelNum = 1) => {
    runEndedRef.current = false;
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

  const checkCollision = (rect1, rect2) => {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
  };

  const loseLife = useCallback(() => {
    if (runEndedRef.current) return;
    const remaining = livesRef.current - 1;
    livesRef.current = remaining;
    setLives(remaining);
    if (remaining <= 0) {
      runEndedRef.current = true;
      setGameState('gameover');
      soundController.playDie();
      return;
    }

    const player = playerRef.current;
    player.x = 100;
    player.y = 300;
    player.velocityX = 0;
    player.velocityY = 0;
    player.powerUp = 'small';
    player.height = 50;
    player.isInvincible = true;
    player.invincibleTimer = 90;
    worldRef.current.offset = 0;
    soundController.playDamage();
  }, []);

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
    const wasOnGround = player.onGround;
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

    if (player.onGround && !wasOnGround) soundController.playLand();

    // Coin collection
    world.coins.forEach(coin => {
      if (!coin.collected) {
        const coinRect = { x: coin.x - 12, y: coin.y - 15, width: 24, height: 30 };
        if (checkCollision(player, coinRect)) {
          coin.collected = true;
          setShards(count => count + 1);
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
        // Moving pickups drift and bounce until collected.
        if (powerUp.type === 'powerCell' || powerUp.type === 'spectrum') {
          powerUp.x += powerUp.velocityX || 0;
          powerUp.velocityY = (powerUp.velocityY || 0) + GRAVITY;
          powerUp.y += powerUp.velocityY;

          // Platform collision for power-ups
          world.platforms.forEach(platform => {
            const puRect = { x: powerUp.x, y: powerUp.y, width: 30, height: 28 };
            if (checkCollision(puRect, platform)) {
              if (powerUp.velocityY > 0) {
                powerUp.y = platform.y - 28;
                powerUp.velocityY = powerUp.type === 'spectrum' ? -8 : 0; // Stars bounce
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

          if (powerUp.type === 'powerCell') {
            if (player.powerUp === 'small') {
              player.powerUp = 'big';
              player.height = 65;
            }
          } else if (powerUp.type === 'plasma') {
            player.powerUp = 'plasma';
            player.height = 65;
          } else if (powerUp.type === 'spectrum') {
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
    if ((keysRef.current['KeyX'] || keysRef.current['KeyZ']) && player.powerUp === 'plasma' && player.fireballs.length < 2) {
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

      // Apply projectile outcomes after the collision geometry matches.
      world.enemies.forEach(enemy => {
        if (enemy.alive) {
          const fbRect = { x: fb.x - 8, y: fb.y - 8, width: 16, height: 16 };
          if (checkCollision(fbRect, enemy)) {
            const outcome = resolvePlasmaHit(enemy);
            if (outcome) {
              if (outcome.points) setScore(s => s + outcome.points);
              if (outcome.sound) soundController[outcome.sound]();
              fb.y = -100;
            }
          }
        }
      });

      // Remove if off screen or too low
      return fb.x > world.offset - 50 && fb.x < world.offset + 850 && fb.y < 650;
    });

    // Update enemy projectiles (Warden fire)
    world.enemyProjectiles = (world.enemyProjectiles || []).filter(proj => {
      proj.x += proj.velocityX;

      // Animate
      proj.frame = (proj.frame || 0) + 1;

      // Check collision with player
      const projRect = { x: proj.x, y: proj.y + 10, width: 40, height: 20 };
      if (checkCollision(playerHurtbox(player), projRect) && !player.isInvincible && !player.starTimer) {
         if (player.powerUp !== 'small') {
            player.powerUp = 'small';
            player.height = 50;
            player.isInvincible = true;
            player.invincibleTimer = 120;
            soundController.playDamage();
          } else {
            loseLife();
          }
      }

      return proj.x > world.offset - 100 && proj.x < world.offset + 900;
    });

    // Enemy collision
    world.enemies.forEach(enemy => {
      if (enemy.alive) {
        // Enemy-specific behavior
        if (enemy.type === 'signalSnare') {
          // SignalSnare plant pops in/out
          enemy.timer = (enemy.timer || 0) + 1;
          if (enemy.timer > 240) enemy.timer = 0;

          // Only collide when popped up
          const popOffset = Math.sin(enemy.timer * 0.05) * 40;
          if (popOffset > 10 && !player.isInvincible) {
            const signalSnareRect = { x: enemy.x, y: enemy.baseY - 20, width: 48, height: 50 };
            if (checkCollision(playerHurtbox(player), signalSnareRect)) {
              if (player.starTimer > 0) {
                enemy.alive = false;
                setScore(s => s + 200);
                soundController.playKick();
              } else if (player.powerUp !== 'small') {
                player.powerUp = 'small';
                player.height = 50;
                player.isInvincible = true;
                player.invincibleTimer = 120;
                soundController.playDamage();
              } else {
                loseLife();
              }
            }
          }
          return; // Skip normal movement for signalSnare
        }

        if (enemy.type === 'hovermite') {
          // Hovermite follows player and throws spinies
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
              alive: true, type: 'prismite', spawned: true
            });
          }

          // Hovermite collision
          if (checkCollision(playerHurtbox(player), creatureHurtbox(enemy))) {
            if (player.velocityY > 0 && player.y + player.height < enemy.y + 30) {
              enemy.alive = false;
              player.velocityY = JUMP_FORCE / 2;
              setScore(s => s + 800);
              soundController.playStomp();
            } else if (player.starTimer > 0) {
              enemy.alive = false;
              setScore(s => s + 800);
              soundController.playKick();
            }
          }
          return;
        }

        if (enemy.type === 'warden') {
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
                   type: 'plasma',
                   frame: 0
                });
             }
          }

          // Player collision (Body damage)
          if (checkCollision(playerHurtbox(player), creatureHurtbox(enemy))) {
             if (player.starTimer > 0 && !enemy.hitTimer) {
                enemy.hp--;
                enemy.hitTimer = 10;
                soundController.playKick();
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
                    soundController.playDamage();
                } else {
                    loseLife();
                }
             }
          }
          return;
        }

        // Rollpod shell movement
        if (enemy.type === 'rollpod' && enemy.isShell) {
          if (enemy.shellVelocity !== 0) {
            enemy.x += enemy.shellVelocity;
            // Shell kills other enemies
            world.enemies.forEach(other => {
              if (other !== enemy && other.alive && other.type !== 'signalSnare' && other.type !== 'hovermite') {
                if (checkCollision(enemy, other)) {
                  other.alive = false;
                  setScore(s => s + 200);
                  soundController.playKick();
                }
              }
            });
          }
        } else {
          // Normal movement
          enemy.x += enemy.velocityX;
        }

        // Apply gravity for spawned spinies
        if (enemy.spawned && enemy.type === 'prismite') {
          enemy.velocityY = (enemy.velocityY || 0) + GRAVITY;
          enemy.y += enemy.velocityY;
        }

        // Reverse at edges or obstacles (except shells and hovermite)
        if (enemy.type !== 'hovermite' && !(enemy.type === 'rollpod' && enemy.isShell && enemy.shellVelocity !== 0)) {
          const onPlatform = world.platforms.some(p =>
            enemy.x + enemy.width > p.x &&
            enemy.x < p.x + p.width &&
            enemy.y + enemy.height >= p.y &&
            enemy.y + enemy.height <= p.y + 10
          );

          if (!onPlatform || enemy.x < 0) {
            enemy.velocityX *= -1;
          }

          // Spawned prismite lands on platform
          if (enemy.spawned && enemy.type === 'prismite') {
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
        if (checkCollision(playerHurtbox(player), creatureHurtbox(enemy))) {
          if (enemy.type === 'prismite') {
            // Prismite hurts on stomp too (unless star power)
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
                soundController.playDamage();
              } else {
                loseLife();
              }
            }
          } else if (enemy.type === 'rollpod') {
            if (isStomp(player, enemy)) {
              if (enemy.isShell) {
                // Kick the shell
                enemy.shellVelocity = player.x < enemy.x ? 10 : -10;
                soundController.playKick();
                player.velocityY = JUMP_FORCE / 2;
                setScore(s => s + 100);
              } else {
                // Turn into shell
                enemy.isShell = true;
                enemy.height = 32;
                enemy.velocityX = 0;
                soundController.playStomp();
                player.velocityY = JUMP_FORCE / 2;
                setScore(s => s + 100);
              }
            } else if (enemy.isShell && enemy.shellVelocity === 0) {
              // Kick stationary shell
              enemy.shellVelocity = player.facingRight ? 10 : -10;
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
                soundController.playDamage();
              } else {
                loseLife();
              }
            }
          } else {
            // Pebblit - normal stomp
            if (isStomp(player, enemy)) {
              enemy.alive = false;
              player.velocityY = JUMP_FORCE / 2;
              setScore(s => s + 200);
              soundController.playStomp();
            } else if (player.starTimer > 0) {
              enemy.alive = false;
              setScore(s => s + 200);
              soundController.playKick();
            } else if (!player.isInvincible) {
              if (player.powerUp !== 'small') {
                player.powerUp = 'small';
                player.height = 50;
                player.isInvincible = true;
                player.invincibleTimer = 120;
                soundController.playDamage();
              } else {
                loseLife();
              }
            }
          }
        }
      }
    });

    // Remove enemies that fall off screen
    world.enemies = world.enemies.filter(e => e.y < 700 && e.alive);

    // Flag (win condition)
    if (world.flag && checkCollision(player, beaconFinishBounds(world.flag))) {
      runEndedRef.current = true;
      soundController.playStageClear();
      if (hasNextLevel(level)) {
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
      loseLife();
    }

    // Camera follow
    const targetOffset = player.x - 300;
    world.offset = Math.max(0, Math.min(targetOffset, world.maxOffset || 2600));
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
  }, [gameState, level, selectedTool, showGrid, loseLife]);

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

  const startGame = () => {
    soundController.init();
    soundController.playSelect();
    soundController.playBGM(1);
    setLevel(1);
    initLevel(1);
    setScore(0);
    setShards(0);
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
                <Button size="sm" variant="destructive" onClick={() => { saveCustomLevel(); initLevel('custom'); setGameState('playing'); }} className="mt-2 text-xs"><Play className="h-3 w-3 mr-1" /> TEST</Button>
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
            className={`bg-sky-300 block w-full h-auto ${gameState === 'editor' ? 'cursor-none' : ''}`}
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
