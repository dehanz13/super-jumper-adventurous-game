import { resolvePlayerEnemyContact } from './combat';
import { collectShards, resolveBlockHit, stepPowerUps } from './collectibles';
import { isSignalSnareActive, stepEnemyMotion } from './enemyMotion';
import { creatureHurtbox, playerHurtbox, rectanglesOverlap } from './geometry';
import { replayInputTranscript } from './inputTranscript';
import { stepPlayerPhysics } from './playerPhysics';
import { stepEnemyProjectile, stepPlayerPlasma, tryFirePlasma } from './projectiles';
import { resolveCourseClear, resolveLifeLoss } from './runProgress';
import { createScoreLedger, recordScoreEvent } from './scoreLedger';
import { createInitialLevelState } from './worldState';

export function createSimulationState(level = 1) {
  const { player, world } = createInitialLevelState(level);
  return { player, world, level, lives: 3, step: 0, runEnded: false, ledger: createScoreLedger() };
}

// The caller owns presentation. This mutates only the supplied simulation state.
export function advanceSimulation(state, input) {
  if (state.runEnded) throw new Error('Cannot advance an ended sector');
  const { player, world } = state;
  const result = { sounds: [], scoreChanged: false, shardsCollected: 0, livesChanged: false, transition: null };
  state.step++;

  const award = (event, count = 1) => {
    recordScoreEvent(state.ledger, event, count, state.level, state.step);
    result.scoreChanged = true;
  };
  const loseLife = () => {
    if (state.runEnded) return;
    const outcome = resolveLifeLoss(state.lives, player, world);
    state.lives = outcome.remainingLives;
    result.livesChanged = true;
    result.sounds.push(outcome.sound);
    if (outcome.state === 'gameover') {
      state.runEnded = true;
      result.transition = { state: 'gameover', nextLevel: null };
    }
  };
  const applyContact = outcome => {
    if (!outcome) return;
    if (outcome.scoreEvent) award(outcome.scoreEvent);
    if (outcome.sound) result.sounds.push(outcome.sound);
    if (outcome.loseLife) loseLife();
  };

  const movement = stepPlayerPhysics(player, input, world.platforms);
  Object.assign(player, movement.player);
  if (movement.jumped) result.sounds.push('playJump');
  movement.headHits.forEach(index => {
    const platform = world.platforms[index];
    const outcome = resolveBlockHit(platform, world.powerUps);
    if (outcome?.kind === 'powerUpReleased') {
      platform.bounceY = -10;
      result.sounds.push('playPowerUp');
    } else if (outcome?.kind === 'shardReleased') {
      platform.bounceY = -10;
      world.effects.push(outcome.effect);
      award('blockShard');
      result.sounds.push('playCoin');
    } else if (outcome?.kind === 'brickBump' || outcome?.kind === 'usedBump') {
      if (outcome.kind === 'brickBump') platform.bounceY = -5;
      result.sounds.push('playBump');
    }
  });
  if (movement.landed) result.sounds.push('playLand');

  result.shardsCollected = collectShards(world.coins, player);
  if (result.shardsCollected) {
    award('shard', result.shardsCollected);
    for (let i = 0; i < result.shardsCollected; i++) result.sounds.push('playCoin');
  }
  world.effects = world.effects.filter(effect => ++effect.frame < 30);
  world.platforms.forEach(platform => {
    if (platform.bounceY) {
      platform.bounceY *= 0.8;
      if (Math.abs(platform.bounceY) < 0.5) platform.bounceY = 0;
    }
  });

  const powerUps = stepPowerUps(world.powerUps, world.platforms, player);
  if (powerUps.length) {
    award('powerUp', powerUps.length);
    powerUps.forEach(() => result.sounds.push('playPowerUp'));
  }
  if (player.starTimer > 0 && --player.starTimer <= 0) player.isInvincible = false;
  if (player.invincibleTimer > 0 && --player.invincibleTimer <= 0) player.isInvincible = false;

  if (tryFirePlasma(player, input.fire)) result.sounds.push('playFireball');
  // Projectile lifetime follows a canonical 800px view, independent of screen size.
  const simulationOffset = Math.max(0, player.x - 300);
  stepPlayerPlasma(player, world.platforms, world.enemies, simulationOffset).forEach(applyContact);
  world.enemyProjectiles = world.enemyProjectiles.filter(projectile => {
    const outcome = stepEnemyProjectile(projectile, player, simulationOffset);
    applyContact(outcome.contact);
    return outcome.keep;
  });

  world.enemies.forEach(enemy => {
    if (!enemy.alive) return;
    const outcome = stepEnemyMotion(enemy, player, world.platforms, world.enemies);
    if (outcome.spawnedEnemy) world.enemies.push(outcome.spawnedEnemy);
    if (outcome.projectile) {
      world.enemyProjectiles.push(outcome.projectile);
      result.sounds.push('playFireball');
    }
    if (outcome.shellDefeats) {
      award('creatureDefeat', outcome.shellDefeats);
      for (let i = 0; i < outcome.shellDefeats; i++) result.sounds.push('playKick');
    }
    if (enemy.type === 'signalSnare') {
      if (isSignalSnareActive(enemy)) {
        const body = { x: enemy.x, y: enemy.baseY - 20, width: 48, height: 50 };
        if (rectanglesOverlap(playerHurtbox(player), body)) applyContact(resolvePlayerEnemyContact(player, enemy));
      }
    } else if (rectanglesOverlap(playerHurtbox(player), creatureHurtbox(enemy))) {
      applyContact(resolvePlayerEnemyContact(player, enemy));
    }
  });
  world.enemies = world.enemies.filter(enemy => enemy.y < 700 && enemy.alive);

  const clear = resolveCourseClear(player, world.flag, state.level, state.runEnded);
  if (clear) {
    state.runEnded = true;
    award(clear.scoreEvent);
    result.sounds.push(clear.sound);
    result.transition = { state: clear.state, nextLevel: clear.nextLevel };
  }
  if (player.y > 700) loseLife();
  return result;
}

export function replayCampaign(transcript) {
  if (transcript.mode !== 'campaign') throw new RangeError('Campaign replay requires a campaign transcript');
  const state = createSimulationState();
  let outcome = null;
  for (const input of replayInputTranscript(transcript)) {
    if (outcome === 'levelcomplete') {
      const next = createInitialLevelState(state.level + 1);
      state.player = next.player;
      state.world = next.world;
      state.level++;
      state.runEnded = false;
      outcome = null;
    }
    if (state.runEnded) throw new Error('Transcript continues after campaign ended');
    const result = advanceSimulation(state, input);
    outcome = result.transition?.state || null;
  }
  if (outcome !== transcript.endedAs) throw new Error('Transcript outcome differs from simulation');
  return { outcome, score: state.ledger.total, ledger: state.ledger, level: state.level, lives: state.lives };
}
