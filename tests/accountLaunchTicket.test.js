import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  AccountTicketError, mintAccountLaunchTicket, startAccountRun, verifyAccountLaunchTicket,
} from '../src/server/accountLaunchTicket';
import { createRunApiHandler } from '../src/server/runApiHandler';

const secret = 'nova-current-secret-with-at-least-32-bytes';
const previous = 'nova-previous-secret-with-at-least-32-bytes';
const nowMs = Date.UTC(2026, 8, 26, 12);
const claims = {
  jti: '01K62BR8AY7M0MJKR7HKZ8XKK1', playerId: 'hearso_player_1',
  displayName: 'Explorer', country: 'US', issuedAtMs: nowMs,
};
const ticket = mintAccountLaunchTicket(claims, secret);
const fixedVector = 'v1.eyJ2IjoxLCJqdGkiOiIwMUs2MkJSOEFZN00wTUpLUjdIS1o4WEtLMSIsInN1YiI6ImhlYXJzb19wbGF5ZXJfMSIsIm5hbWUiOiJFeHBsb3JlciIsImNvdW50cnkiOiJVUyIsImF1ZCI6Im5vdmEtb3JiaXQtanVtcCIsImlhdCI6MTc5MDQyNDAwMDAwMCwiZXhwIjoxNzkwNDI0MDMwMDAwfQ.s5UzyXXncCrPoi71rQIlk_ixj68RT3oBs_lFUryL2A8';

describe('Hearso account launch ticket', () => {
  it('pins the signed payload and accepts a rotated key', () => {
    expect(ticket).toBe(fixedVector);
    expect(ticket.split('.')).toHaveLength(3);
    expect(Buffer.from(ticket.split('.')[1], 'base64url').toString()).toBe(JSON.stringify({
      v: 1, jti: claims.jti, sub: claims.playerId, name: claims.displayName,
      country: claims.country, aud: 'nova-orbit-jump', iat: nowMs, exp: nowMs + 30_000,
    }));
    expect(verifyAccountLaunchTicket(ticket, { secrets: [previous, secret], nowMs }))
      .toMatchObject({ sub: claims.playerId, name: claims.displayName });
  });

  it('rejects tampering, wrong audience, wrong key, bad shape, and time bounds', () => {
    const check = (value, time = nowMs) => verifyAccountLaunchTicket(value, { secrets: [secret], nowMs: time });
    expect(() => check(`${ticket.slice(0, -1)}${ticket.at(-1) === 'A' ? 'B' : 'A'}`)).toThrow(AccountTicketError);
    expect(() => check(mintAccountLaunchTicket(claims, previous))).toThrow(AccountTicketError);
    expect(() => check('v1.bad.signature')).toThrow(AccountTicketError);
    expect(() => check(ticket, nowMs - 5_001)).toThrow(AccountTicketError);
    expect(() => check(ticket, nowMs + 35_001)).toThrow(AccountTicketError);
    expect(() => check(mintAccountLaunchTicket({ ...claims, displayName: '' }, secret))).not.toThrow();
    const payload = JSON.parse(Buffer.from(ticket.split('.')[1], 'base64url').toString());
    const signed = `v1.${Buffer.from(JSON.stringify({ ...payload, aud: 'hearso-rt' })).toString('base64url')}`;
    const wrongAudience = `${signed}.${createHmac('sha256', secret).update(signed).digest('base64url')}`;
    expect(() => check(wrongAudience)).toThrow(AccountTicketError);
  });

  it('consumes one ticket once and stores account identity without the ticket', async () => {
    const runs = [];
    const used = new Set();
    const consumeLaunchTicketAndSaveRun = vi.fn(async ({ jti, record }) => {
      if (used.has(jti)) return false;
      used.add(jti);
      runs.push(record);
      return true;
    });
    const first = await startAccountRun({ launchTicket: ticket, secrets: [secret], consumeLaunchTicketAndSaveRun, nowMs });
    expect(first).toMatchObject({ runId: expect.any(String), runToken: expect.any(String) });
    expect(runs[0]).toMatchObject({ playerClass: 'account', playerId: claims.playerId, displayName: 'Explorer', country: 'US' });
    expect(JSON.stringify(runs[0])).not.toContain(ticket);
    await expect(startAccountRun({ launchTicket: ticket, secrets: [secret], consumeLaunchTicketAndSaveRun, nowMs }))
      .rejects.toThrow(AccountTicketError);
    expect(runs).toHaveLength(1);
  });

  it('uses safe HTTP failures and keeps the account branch unavailable without a secret', async () => {
    const store = {
      consumeLaunchTicketAndSaveRun: vi.fn(async () => true),
    };
    const request = { requestContext: { http: { method: 'POST' } }, rawPath: '/v1/runs',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ launchTicket: ticket }) };
    const unavailable = createRunApiHandler({ store, gameId: 'nova-orbit-jump', now: () => nowMs });
    expect((await unavailable(request)).statusCode).toBe(501);
    const handler = createRunApiHandler({ store, gameId: 'nova-orbit-jump', ticketSecrets: [secret], now: () => nowMs });
    const response = await handler(request);
    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).not.toHaveProperty('guestCredential');
    expect((await handler({ ...request, body: JSON.stringify({ launchTicket: 'invalid' }) })).statusCode).toBe(401);
    expect((await handler({ ...request, body: JSON.stringify({ launchTicket: mintAccountLaunchTicket({ ...claims, displayName: '' }, secret) }) })).statusCode).toBe(401);
    expect(store.consumeLaunchTicketAndSaveRun).toHaveBeenCalledTimes(1);
  });
});
