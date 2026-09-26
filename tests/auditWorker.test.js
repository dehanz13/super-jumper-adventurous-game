import { describe, expect, it, vi } from 'vitest';
import { processAuditBatch } from '../src/server/auditWorker';

const event = { eventId: 'run-1', runId: 'run-1', eventType: 'nova.run.verified', eventVersion: 1 };
function deps(overrides = {}) {
  return {
    listDueAudit: vi.fn(async () => [{ runId: 'run-1' }]),
    claimAudit: vi.fn(async () => ({ runId: 'run-1', claimToken: 'lease-1', attemptCount: 1, event, playerId: 'private-id' })),
    markAuditSinkDelivered: vi.fn(async () => true),
    rescheduleAudit: vi.fn(async () => true),
    markAuditComplete: vi.fn(async () => true),
    writeHistory: vi.fn(async () => {}),
    publishKafka: vi.fn(async () => {}),
    now: () => 1000,
    ...overrides,
  };
}

describe('Nova audit delivery', () => {
  it('saves each destination acknowledgement before completing the item', async () => {
    const d = deps();
    expect(await processAuditBatch(d)).toEqual({ examined: 1, delivered: 1, historyHandedOff: 0, retried: 0, contended: 0 });
    expect(d.writeHistory).toHaveBeenCalledWith({ event, playerId: 'private-id' });
    expect(d.publishKafka).toHaveBeenCalledWith(event);
    expect(d.markAuditSinkDelivered.mock.calls.map(call => call[0].sink)).toEqual(['history', 'kafka']);
    expect(d.markAuditComplete).toHaveBeenCalledWith({ runId: 'run-1', claimToken: 'lease-1', nowMs: 1000 });
  });

  it('hands off durable history to the relay without calling a direct Kafka producer', async () => {
    const d = deps({
      deliveryMode: 'history_relay', publishKafka: undefined,
      markAuditHistoryHandoff: vi.fn(async () => true),
    });
    expect(await processAuditBatch(d)).toEqual({
      examined: 1, delivered: 0, historyHandedOff: 1, retried: 0, contended: 0,
    });
    expect(d.markAuditSinkDelivered).toHaveBeenCalledWith(expect.objectContaining({ sink: 'history' }));
    expect(d.markAuditHistoryHandoff).toHaveBeenCalledWith({ runId: 'run-1', claimToken: 'lease-1', nowMs: 1000 });
    expect(d.markAuditComplete).not.toHaveBeenCalled();
  });

  it('does not report a history handoff when its lease is lost', async () => {
    const d = deps({
      deliveryMode: 'history_relay', publishKafka: undefined,
      markAuditHistoryHandoff: vi.fn(async () => false),
    });
    expect(await processAuditBatch(d)).toMatchObject({ historyHandedOff: 0, contended: 1 });
  });

  it('finishes a relay handoff after a crash following the history acknowledgement', async () => {
    const d = deps({
      deliveryMode: 'history_relay', publishKafka: undefined,
      claimAudit: vi.fn(async () => ({
        runId: 'run-1', claimToken: 'lease-2', attemptCount: 2,
        event, historyDeliveredAtMs: 900,
      })),
      markAuditHistoryHandoff: vi.fn(async () => true),
      writeHistory: vi.fn(async () => { throw new Error('history should not repeat'); }),
    });
    expect(await processAuditBatch(d)).toMatchObject({ historyHandedOff: 1, retried: 0 });
    expect(d.writeHistory).not.toHaveBeenCalled();
    expect(d.markAuditSinkDelivered).not.toHaveBeenCalled();
  });

  it('retries Kafka without writing history again after history is acknowledged', async () => {
    const d = deps({
      claimAudit: vi.fn(async () => ({
        runId: 'run-1', claimToken: 'lease-2', attemptCount: 2, event,
        playerId: 'private-id', historyDeliveredAtMs: 900,
      })),
      writeHistory: vi.fn(async () => { throw new Error('must not repeat'); }),
      publishKafka: vi.fn(async () => { throw new Error('broker down'); }),
    });
    expect(await processAuditBatch(d)).toMatchObject({ retried: 1, delivered: 0 });
    expect(d.writeHistory).not.toHaveBeenCalled();
    expect(d.rescheduleAudit).toHaveBeenCalledWith({
      runId: 'run-1', claimToken: 'lease-2', nextAttemptAtMs: 11000, failureCode: 'kafka_unavailable',
    });
    expect(d.markAuditComplete).not.toHaveBeenCalled();
  });

  it('finishes a recovered item whose destination acknowledgements were already saved', async () => {
    const d = deps({
      claimAudit: vi.fn(async () => ({
        runId: 'run-1', claimToken: 'lease-3', attemptCount: 3, event,
        historyDeliveredAtMs: 0, kafkaDeliveredAtMs: 0,
      })),
    });
    expect(await processAuditBatch(d)).toMatchObject({ delivered: 1 });
    expect(d.writeHistory).not.toHaveBeenCalled();
    expect(d.publishKafka).not.toHaveBeenCalled();
    expect(d.markAuditSinkDelivered).not.toHaveBeenCalled();
  });

  it('does not publish to Kafka when history fails, and keeps a corrupt event pending', async () => {
    const historyDown = deps({ writeHistory: vi.fn(async () => { throw new Error('database down'); }) });
    expect(await processAuditBatch(historyDown)).toMatchObject({ retried: 1 });
    expect(historyDown.publishKafka).not.toHaveBeenCalled();
    expect(historyDown.rescheduleAudit).toHaveBeenCalledWith(expect.objectContaining({ failureCode: 'history_unavailable' }));

    const invalid = deps({ claimAudit: vi.fn(async () => ({ runId: 'run-1', claimToken: 'lease', attemptCount: 1, event: {} })) });
    expect(await processAuditBatch(invalid)).toMatchObject({ retried: 1 });
    expect(invalid.writeHistory).not.toHaveBeenCalled();
    expect(invalid.rescheduleAudit).toHaveBeenCalledWith(expect.objectContaining({ failureCode: 'audit_record_invalid' }));
  });

  it('does not allow a lost lease or store failure to report delivery', async () => {
    const contended = deps({ markAuditSinkDelivered: vi.fn(async () => false) });
    expect(await processAuditBatch(contended)).toMatchObject({ contended: 1, delivered: 0 });
    expect(contended.publishKafka).not.toHaveBeenCalled();
    const storeDown = deps({ markAuditSinkDelivered: vi.fn(async () => { throw new Error('store down'); }) });
    await expect(processAuditBatch(storeDown)).rejects.toThrow('store down');
  });

  it('requires bounded worker dependencies and skips an already claimed item', async () => {
    await expect(processAuditBatch(deps({ limit: 26 }))).rejects.toThrow(TypeError);
    await expect(processAuditBatch(deps({ deliveryMode: 'history_relay' }))).rejects.toThrow(TypeError);
    const d = deps({ claimAudit: vi.fn(async () => null) });
    expect(await processAuditBatch(d)).toMatchObject({ contended: 1, examined: 1 });
    expect(d.writeHistory).not.toHaveBeenCalled();
  });
});
