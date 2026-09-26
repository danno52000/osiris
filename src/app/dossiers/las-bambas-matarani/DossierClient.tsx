'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  DOSSIER_ID,
  INITIAL_FEED,
  reduceFeed,
  resolveView,
  type FeedEvent,
} from '@/lib/dossier';
import { REQUEST_TIMEOUT_MS, fetchDossierOnce as fetchDossierOnceFor } from '@/lib/dossier-client';
import { INITIAL_VULN_FEED, reduceVulnFeed, resolveVuln } from '@/lib/vulnerability';
import { fetchVulnerabilityOnce } from '@/lib/vulnerability-client';
import { INITIAL_UW_FEED, reduceUwFeed, resolveUw } from '@/lib/underwriting';
import { fetchUnderwritingOnce } from '@/lib/underwriting-client';
import { INITIAL_AN_FEED, reduceAnFeed, resolveAn } from '@/lib/analyst';
import { fetchAnalystOnce } from '@/lib/analyst-client';
import { DossierView } from './DossierView';

/**
 * Poll no faster than once a minute; the sidecar answers each request from the store (no
 * cache). Polling this page re-checks the current publication pointer only — it does NOT
 * refresh source evidence or run the E1 engine (no automatic dossier refresh is configured).
 */
export const POLL_MS = 60_000;
export { REQUEST_TIMEOUT_MS };

/** This page is the Las Bambas legacy full-DDD page: the shared client bound to that one id. */
export function fetchDossierOnce(
  generation: number,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<FeedEvent> {
  return fetchDossierOnceFor(DOSSIER_ID, generation, fetchImpl, timeoutMs);
}

export default function DossierClient() {
  const [feed, dispatch] = useReducer(reduceFeed, INITIAL_FEED);
  const [vulnFeed, dispatchVuln] = useReducer(reduceVulnFeed, INITIAL_VULN_FEED);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [vulnOn, setVulnOn] = useState(false);
  const [uwFeed, dispatchUw] = useReducer(reduceUwFeed, INITIAL_UW_FEED);
  const [uwOn, setUwOn] = useState(false);
  const [anFeed, dispatchAn] = useReducer(reduceAnFeed, INITIAL_AN_FEED);
  const anGeneration = useRef(0);
  const anInFlight = useRef(false);
  const generation = useRef(0);
  const vulnGeneration = useRef(0);
  const uwGeneration = useRef(0);
  const inFlight = useRef(false);
  const vulnInFlight = useRef(false);
  const uwInFlight = useRef(false);
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

  const loadVuln = useCallback(async () => {
    if (vulnInFlight.current) return;
    vulnInFlight.current = true;
    vulnGeneration.current += 1;
    try {
      const event = await fetchVulnerabilityOnce(vulnGeneration.current);
      if (mounted.current) dispatchVuln(event);
    } finally {
      vulnInFlight.current = false;
    }
  }, []);

  const loadUw = useCallback(async () => {
    if (uwInFlight.current) return;
    uwInFlight.current = true;
    uwGeneration.current += 1;
    try {
      const event = await fetchUnderwritingOnce(uwGeneration.current);
      if (mounted.current) dispatchUw(event);
    } finally {
      uwInFlight.current = false;
    }
  }, []);

  const loadAn = useCallback(async () => {
    if (anInFlight.current) return;
    anInFlight.current = true;
    anGeneration.current += 1;
    try {
      const event = await fetchAnalystOnce(DOSSIER_ID, anGeneration.current);
      if (mounted.current) dispatchAn(event);
    } finally {
      anInFlight.current = false;
    }
  }, []);

  // The analyst pyramid is default-visible on the full page: no toggle, polled like the dossier.
  useEffect(() => {
    const first = setTimeout(loadAn, 0);
    const iv = setInterval(loadAn, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [loadAn]);

  useEffect(() => {
    if (!uwOn) {
      dispatchUw({ type: 'reset', generation: uwGeneration.current });
      return;
    }
    const first = setTimeout(loadUw, 0);
    const iv = setInterval(loadUw, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [uwOn, loadUw]);

  useEffect(() => {
    if (!vulnOn) return;
    const first = setTimeout(loadVuln, 0);
    const iv = setInterval(loadVuln, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [vulnOn, loadVuln]);

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
      vulnerability={{ on: vulnOn, onToggle: setVulnOn, feed: vulnFeed, resolved: resolveVuln(vulnFeed) }}
      underwriting={{ on: uwOn, onToggle: setUwOn, feed: uwFeed, resolved: resolveUw(uwFeed) }}
      analyst={{ feed: anFeed, resolved: resolveAn(anFeed) }}
    />
  );
}
