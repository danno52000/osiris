'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  INITIAL_GEO_FEED,
  overlayFromPublication,
  reduceGeoFeed,
  resolveGeo,
  type DossierOverlay,
  type DossierSelection,
  type GeoFeedState,
  type ResolvedGeo,
} from './geography';
import { fetchGeographyOnce } from './geography-client';

const POLL_MS = 60_000;

export interface DossierGeographyController {
  feed: GeoFeedState;
  resolved: ResolvedGeo;
  selection: DossierSelection | null;
  select: (sel: DossierSelection | null) => void;
  /** Request one more fit (the "Locate dossier" action). */
  locate: () => void;
  /** Null unless a dossier is selected and geography is available/stale; what the map draws. */
  overlay: DossierOverlay | null;
}

/**
 * Page-owned geography state for the selected dossier. Loads while a dossier is selected,
 * resets feed/selection/fit counter on deselection so nothing stale survives, and bumps the
 * fit counter exactly once per selection (plus once per explicit Locate).
 */
export function useDossierGeography(selectedDossier: string | null): DossierGeographyController {
  const [feed, dispatch] = useReducer(reduceGeoFeed, INITIAL_GEO_FEED);
  const [selection, setSelection] = useState<DossierSelection | null>(null);
  const [fitSeq, setFitSeq] = useState(0);
  const gen = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    gen.current += 1;
    try {
      const ev = await fetchGeographyOnce(gen.current);
      if (mounted.current) dispatch(ev);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!selectedDossier) {
      dispatch({ type: 'reset', generation: gen.current });
      setSelection(null);
      setFitSeq(0);
      return;
    }
    setFitSeq((n) => n + 1);
    const first = setTimeout(load, 0);
    const iv = setInterval(load, POLL_MS);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [selectedDossier, load]);

  const resolved = useMemo(() => resolveGeo(feed), [feed]);

  // A selection that no longer names a published element (withdrawal, partial refresh) is
  // treated as cleared rather than kept as a stale card.
  const effectiveSelection = useMemo<DossierSelection | null>(() => {
    if (!selection) return null;
    const pub = resolved.publication;
    const present = !!pub && (selection.kind === 'feature'
      ? pub.features.some((f) => f.feature_id === selection.id)
      : pub.links.some((l) => l.link_id === selection.id));
    return present ? selection : null;
  }, [resolved, selection]);

  const overlay = useMemo<DossierOverlay | null>(() => {
    if (!selectedDossier || !resolved.publication) return null;
    return overlayFromPublication(resolved.publication, resolved.view === 'stale', effectiveSelection, fitSeq);
  }, [selectedDossier, resolved, effectiveSelection, fitSeq]);

  const locate = useCallback(() => setFitSeq((n) => n + 1), []);

  return { feed, resolved, selection: effectiveSelection, select: setSelection, locate, overlay };
}
