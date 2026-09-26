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
  type OverlayHighlight,
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
  /** Requested E5 case highlight (verified against the publication before drawing). */
  highlight: OverlayHighlight | null;
  setHighlight: (h: OverlayHighlight | null) => void;
}

/**
 * Page-owned geography state for the selected dossier. Loads the requested id while a dossier is
 * selected, resets feed/selection/fit counter on deselection or dossier change so nothing stale
 * (or from the previous dossier, including a late answer) survives, and bumps the fit counter
 * exactly once per selection (plus once per explicit Locate); the counter is monotonic.
 */
export function useDossierGeography(selectedDossier: string | null): DossierGeographyController {
  const [feed, dispatch] = useReducer(reduceGeoFeed, INITIAL_GEO_FEED);
  const [selection, setSelection] = useState<DossierSelection | null>(null);
  const [fitSeq, setFitSeq] = useState(0);
  const [highlight, setHighlight] = useState<OverlayHighlight | null>(null);
  const gen = useRef(0);
  const inFlight = useRef<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (dossierId: string) => {
    if (inFlight.current === dossierId) return;
    inFlight.current = dossierId;
    gen.current += 1;
    try {
      const ev = await fetchGeographyOnce(dossierId, gen.current);
      if (mounted.current) dispatch(ev);
    } finally {
      if (inFlight.current === dossierId) inFlight.current = null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    dispatch({ type: 'reset', generation: gen.current });
    if (!selectedDossier) return;
    const run = () => load(selectedDossier);
    const first = setTimeout(() => {
      setFitSeq((n) => n + 1);
      run();
    }, 0);
    const iv = setInterval(run, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
      setSelection(null);
      setHighlight(null);
    };
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
    return overlayFromPublication(resolved.publication, resolved.view === 'stale', effectiveSelection, fitSeq, highlight, selectedDossier);
  }, [selectedDossier, resolved, effectiveSelection, fitSeq, highlight]);

  const locate = useCallback(() => setFitSeq((n) => n + 1), []);

  return { feed, resolved, selection: effectiveSelection, select: setSelection, locate, overlay, highlight, setHighlight };
}
