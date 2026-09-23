'use client';

import { useCallback, useEffect, useReducer, useState } from 'react';
import { INITIAL_FEED, reduceFeed, resolveView, type DossierResponse } from '@/lib/dossier';
import { DossierView } from './DossierView';

/** Poll no faster than once a minute; the sidecar answers each request from the store (no cache). */
const POLL_MS = 60_000;

export default function DossierClient() {
  const [feed, dispatch] = useReducer(reduceFeed, INITIAL_FEED);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/fusion/dossier', { cache: 'no-store' });
      const body = (await res.json()) as DossierResponse;
      dispatch({ type: 'response', body, at: new Date().toISOString() });
    } catch (e) {
      dispatch({
        type: 'failure',
        message: e instanceof Error ? e.message : 'request failed',
        at: new Date().toISOString(),
      });
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const iv = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [load]);

  const resolved = resolveView(feed, feed.fetchedAt ?? new Date().toISOString());
  return (
    <DossierView
      feed={feed}
      resolved={resolved}
      selectedEdgeId={selectedEdgeId}
      onSelectEdge={setSelectedEdgeId}
    />
  );
}
