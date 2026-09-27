import { describe, expect, it } from 'vitest';
import { appendInputStep, createInputTranscript, sealInputTranscript } from '../src/game/inputTranscript';
import { advanceSimulation, createSimulationState, replayCampaign } from '../src/game/simulation';
import { createInitialLevelState } from '../src/game/worldState';

const idle = { left: false, right: false, jump: false, fire: false };

describe('shared campaign simulation', () => {
  it.each(['powerCell', 'plasma'])('keeps Nova grounded and able to jump after collecting %s', type => {
    const state = createSimulationState();
    state.world.platforms = [{ x: 0, y: 500, width: 800, height: 100, type: 'ground' }];
    state.world.enemies = [];
    state.world.coins = [];
    state.world.flag = null;
    state.world.powerUps = [{ x: 100, y: 458, type, spawned: true, collected: false }];
    state.player.y = 450;
    state.player.onGround = true;

    advanceSimulation(state, idle);
    expect(state.player).toMatchObject({ height: 65, y: 435, onGround: true });
    for (let step = 0; step < 10; step++) advanceSimulation(state, idle);
    expect(state.player.y + state.player.height).toBe(500);
    expect(state.player.onGround).toBe(true);
    expect(advanceSimulation(state, { ...idle, jump: true }).sounds).toContain('playJump');
  });

  it('preserves the old pickup position for runs replayed under earlier rules', () => {
    const state = createSimulationState();
    state.world.platforms = [{ x: 0, y: 500, width: 800, height: 100, type: 'ground' }];
    state.world.enemies = [];
    state.world.coins = [];
    state.world.flag = null;
    state.world.powerUps = [{ x: 100, y: 458, type: 'plasma', spawned: true, collected: false }];
    state.player.y = 450;
    state.player.onGround = true;

    advanceSimulation(state, idle, true);
    expect(state.player).toMatchObject({ height: 65, y: 450 });
  });

  it('awards pickups and returns presentation events without drawing or audio', () => {
    const state = createSimulationState();
    state.player.x = 310;
    state.player.y = 300;
    const result = advanceSimulation(state, idle);
    expect(result.shardsCollected).toBeGreaterThan(0);
    expect(result.scoreChanged).toBe(true);
    expect(result.sounds).toContain('playCoin');
    expect(state.ledger.events[0]).toMatchObject({ event: 'shard', level: 1, step: 1 });
    expect(state.world.coins.some(coin => coin.collected)).toBe(true);
  });

  it('adds one uncapped life from a heart and expires armor on the 600th step', () => {
    const state = createSimulationState();
    state.lives = 5;
    state.world.platforms = [];
    state.world.enemies = [];
    state.world.coins = [];
    state.world.flag = null;
    state.world.powerUps = [
      { x: 100, y: 300, type: 'heart', spawned: true, collected: false },
      { x: 100, y: 300, type: 'armor', spawned: true, collected: false },
    ];
    const first = advanceSimulation(state, idle);
    expect(first).toMatchObject({ livesChanged: true, sounds: ['playLife', 'playPowerUp'] });
    expect(state.lives).toBe(6);
    expect(state.player).toMatchObject({ powerUp: 'armor', height: 65, armorTimer: 599 });
    state.world.platforms = [{ x: 0, y: 500, width: 11_000, height: 100, type: 'ground' }];
    state.player.x = 10_000;
    state.player.y = 435;
    state.player.velocityY = 0;
    state.player.onGround = true;
    for (let step = 1; step < 599; step++) advanceSimulation(state, idle);
    expect(state.player.armorTimer).toBe(1);
    advanceSimulation(state, idle);
    expect(state.player).toMatchObject({ powerUp: 'small', height: 50, armorTimer: 0 });
    expect(state.lives).toBe(6);
  });

  it('reports a sector clear and a final life loss from the same rules used by the page', () => {
    const state = createSimulationState();
    state.player.x = state.world.flag.x;
    state.player.y = 400;
    const clear = advanceSimulation(state, idle);
    expect(clear.transition).toEqual({ state: 'levelcomplete', nextLevel: 2 });
    expect(state.ledger.events.at(-1)).toMatchObject({ event: 'sectorClear', level: 1 });
    expect(() => advanceSimulation(state, idle)).toThrow('ended sector');

    const next = createSimulationState();
    next.lives = 1;
    next.world.platforms = [];
    next.player.y = 710;
    const lost = advanceSimulation(next, idle);
    expect(lost.transition).toEqual({ state: 'gameover', nextLevel: null });
    expect(next.lives).toBe(0);
    expect(lost.sounds).toContain('playDie');
  });

  it('replays a completed input record to the same score and rejects a forged outcome', () => {
    const transcript = createInputTranscript();
    const live = createSimulationState();
    const held = { left: false, right: true, jump: true, fire: false };
    let transition = null;
    for (let i = 0; i < 12000; i++) {
      if (transition === 'levelcomplete') {
        const next = createInitialLevelState(live.level + 1);
        live.player = next.player;
        live.world = next.world;
        live.level++;
        live.runEnded = false;
      }
      appendInputStep(transcript, held);
      transition = advanceSimulation(live, held).transition?.state || null;
      if (transition === 'win' || transition === 'gameover') break;
    }
    expect(transition).toBe('win');
    sealInputTranscript(transcript, 'win');
    const verified = replayCampaign(transcript);
    expect(verified).toMatchObject({ outcome: 'win', score: live.ledger.total, level: 7, lives: live.lives });
    expect(verified.ledger.events).toEqual(live.ledger.events);
    expect(() => replayCampaign({ ...transcript, endedAs: 'gameover' })).toThrow('outcome differs');
    expect(() => replayCampaign({ ...transcript, mode: 'custom' })).toThrow('campaign transcript');
  });
});
