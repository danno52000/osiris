'use client';

import { useCallback, useEffect, useReducer } from 'react';
import {
  INITIAL_FEED,
  reduceFeed,
  resolveView,
  type DataAdminResponse,
} from '@/lib/data-admin';
import { DataAdminView } from './DataAdminView';

/** Poll no faster than once a minute; the sidecar caches for 300 s anyway. */
const POLL_MS = 60_000;

export default function DataAdminClient() {
  const [feed, dispatch] = useReducer(reduceFeed, INITIAL_FEED);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/fusion/data-admin', { cache: 'no-store' });
      const body = (await res.json()) as DataAdminResponse;
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
  return <DataAdminView feed={feed} resolved={resolved} />;
}
