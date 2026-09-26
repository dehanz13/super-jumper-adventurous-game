import { useCallback, useEffect, useRef, useState } from 'react';
import { currentRunVersions } from './rankedRunVerifier';

export function useRankedRun(runClient, guestStore) {
  const sessionRef = useRef(null);
  const generationRef = useRef(0);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [rankState, setRankState] = useState(null);
  const [returningGuest, setReturningGuest] = useState(() => Boolean(guestStore?.read()));

  const start = useCallback(async profile => {
    const generation = ++generationRef.current;
    sessionRef.current = null;
    setRankState(null);
    setStartError('');
    if (!runClient) return true;
    setStarting(true);
    try {
      const credential = guestStore?.read();
      if (!credential && !profile) {
        setReturningGuest(false);
        setStartError('Your weekly guest session expired. Choose a public name and country to try again.');
        return false;
      }
      const identity = credential ? { guestCredential: credential } : { guestProfile: profile };
      const session = await runClient.start(identity);
      if (generation !== generationRef.current) return false;
      const versions = currentRunVersions();
      if (Object.keys(versions).some(key => session.versions?.[key] !== versions[key])) {
        setStartError('The game has updated. Refresh the page before starting a ranked run.');
        return false;
      }
      if (session.guestCredential) {
        guestStore?.save(session.guestCredential, session.guestCredentialExpiresAt);
        setReturningGuest(Boolean(guestStore?.read()));
      }
      sessionRef.current = { runId: session.runId, runToken: session.runToken };
      return true;
    } catch (error) {
      if (generation !== generationRef.current) return false;
      if (error?.code === 'invalid_guest_credential') {
        guestStore?.clear();
        setReturningGuest(false);
        setStartError('Your weekly guest session expired. Choose a public name and country to try again.');
      } else {
        setStartError('Ranking is unavailable right now. Try again or play locally.');
      }
      return false;
    } finally {
      if (generation === generationRef.current) setStarting(false);
    }
  }, [runClient, guestStore]);

  const startLocal = useCallback(() => {
    generationRef.current++;
    sessionRef.current = null;
    setStarting(false);
    setStartError('');
    setRankState(null);
  }, []);

  const complete = useCallback(async completion => {
    const session = sessionRef.current;
    if (!runClient || !session || !completion.submissionCandidate) return;
    const generation = generationRef.current;
    setRankState({ status: 'verifying' });
    try {
      const result = await runClient.finish(session, completion.transcript, completion.score);
      if (generation === generationRef.current) setRankState(result);
    } catch {
      try {
        const current = await runClient.getResult(session);
        const result = current.status === 'active'
          ? await runClient.finish(session, completion.transcript, completion.score) : current;
        if (generation === generationRef.current) setRankState(result);
      } catch {
        if (generation === generationRef.current) setRankState({ status: 'unavailable' });
      }
    }
  }, [runClient]);

  useEffect(() => {
    if (rankState?.status !== 'pending_write' || !sessionRef.current) return undefined;
    let active = true;
    const generation = generationRef.current;
    const timer = setTimeout(async () => {
      try {
        const result = await runClient.getResult(sessionRef.current);
        if (active && generation === generationRef.current) setRankState(result);
      } catch {
        if (active && generation === generationRef.current) setRankState(current => ({ ...current }));
      }
    }, 3000);
    return () => { active = false; clearTimeout(timer); };
  }, [rankState, runClient]);

  return { start, startLocal, complete, starting, startError, rankState, returningGuest };
}
