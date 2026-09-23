'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  INITIAL_FEED,
  PROXY_PATH,
  reduceFeed,
  resolveView,
  type BrowserFailure,
  type DossierResponse,
  type FeedEvent,
} from '@/lib/dossier';
import { DossierView } from './DossierView';

/**
 * Poll no faster than once a minute; the sidecar answers each request from the store (no
 * cache). Polling this page re-checks the current publication pointer only — it does NOT
 * refresh source evidence or run the E1 engine (no automatic dossier refresh is configured).
 */
export const POLL_MS = 60_000;
/** Browser-side request deadline; a hung proxy renders state-only unavailable, not old claims. */
export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * One bounded request: never rejects; returns the event for the reducer. `generation` is
 * the monotonic number of this request so a late answer can never overwrite a newer one.
 */
export async function fetchDossierOnce(
  generation: number,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<FeedEvent> {
  const at = () => new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(PROXY_PATH, { cache: 'no-store', signal: controller.signal });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { type: 'failure', reason: 'browser_response_malformed', at: at(), generation };
    }
    if (!body || typeof body !== 'object' || typeof (body as DossierResponse).state !== 'string') {
      return { type: 'failure', reason: 'browser_response_malformed', at: at(), generation };
    }
    return { type: 'response', body: body as DossierResponse, at: at(), generation };
  } catch (e) {
    const reason: BrowserFailure = e instanceof Error && e.name === 'AbortError' ? 'browser_fetch_timeout' : 'browser_fetch_failed';
    return { type: 'failure', reason, at: at(), generation };
  } finally {
    clearTimeout(timer);
  }
}

export default function DossierClient() {
  const [feed, dispatch] = useReducer(reduceFeed, INITIAL_FEED);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  // Serialized: a tick while a request is still in flight is skipped, never overlapped.
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    generation.current += 1;
    try {
      const event = await fetchDossierOnce(generation.current);
      if (mounted.current) dispatch(event);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const first = setTimeout(load, 0);
    const iv = setInterval(load, POLL_MS);
    return () => {
      mounted.current = false;
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [load]);

  return (
    <DossierView
      feed={feed}
      resolved={resolveView(feed)}
      selectedEdgeId={selectedEdgeId}
      onSelectEdge={setSelectedEdgeId}
    />
  );
}
