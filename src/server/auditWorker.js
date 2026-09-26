const MAX_BATCH = 25;

function retryDelay(attemptCount) {
  return Math.min(5 * 60 * 1000, 5000 * 2 ** Math.min(Math.max(attemptCount - 1, 0), 6));
}

// Both destinations must be idempotent by eventId. A successful send can be
// repeated when the process dies before its DynamoDB acknowledgement is saved.
export async function processAuditBatch({
  listDueAudit, claimAudit, markAuditSinkDelivered, rescheduleAudit, markAuditComplete,
  writeHistory, publishKafka, now = Date.now, limit = MAX_BATCH,
}) {
  if ([listDueAudit, claimAudit, markAuditSinkDelivered, rescheduleAudit, markAuditComplete,
    writeHistory, publishKafka, now].some(callback => typeof callback !== 'function')
    || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH) {
    throw new TypeError('valid audit worker dependencies are required');
  }
  const items = await listDueAudit({ nowMs: now(), limit });
  const counts = { examined: 0, delivered: 0, retried: 0, contended: 0 };
  for (const candidate of items) {
    counts.examined++;
    const claim = await claimAudit({ runId: candidate.runId, nowMs: now() });
    if (!claim) { counts.contended++; continue; }

    let failedSink;
    if (claim.event?.eventId !== claim.runId || claim.event?.eventType !== 'nova.run.verified'
      || claim.event?.eventVersion !== 1) {
      failedSink = 'audit_record_invalid';
    }
    if (!failedSink && claim.historyDeliveredAtMs === undefined) {
      try { await writeHistory({ event: claim.event, playerId: claim.playerId }); }
      catch { failedSink = 'history_unavailable'; }
      if (!failedSink) {
        const saved = await markAuditSinkDelivered({
          runId: claim.runId, claimToken: claim.claimToken, sink: 'history', nowMs: now(),
        });
        if (!saved) { counts.contended++; continue; }
      }
    }
    if (!failedSink && claim.kafkaDeliveredAtMs === undefined) {
      try { await publishKafka(claim.event); }
      catch { failedSink = 'kafka_unavailable'; }
      if (!failedSink) {
        const saved = await markAuditSinkDelivered({
          runId: claim.runId, claimToken: claim.claimToken, sink: 'kafka', nowMs: now(),
        });
        if (!saved) { counts.contended++; continue; }
      }
    }
    if (failedSink) {
      const changed = await rescheduleAudit({
        runId: claim.runId, claimToken: claim.claimToken,
        nextAttemptAtMs: now() + retryDelay(claim.attemptCount), failureCode: failedSink,
      });
      counts[changed ? 'retried' : 'contended']++;
      continue;
    }
    const changed = await markAuditComplete({ runId: claim.runId, claimToken: claim.claimToken, nowMs: now() });
    counts[changed ? 'delivered' : 'contended']++;
  }
  return counts;
}
