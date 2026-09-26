'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { INITIAL_FEED, reduceFeed, resolveView } from '@/lib/dossier';
import { fetchDossierOnce } from '@/lib/dossier-client';
import { dossierRegistryEntry, isDossierListed, rosterDossiers, type DossierRegistryEntry } from '@/lib/dossier-registry';
import { INITIAL_VULN_FEED, reduceVulnFeed, resolveVuln } from '@/lib/vulnerability';
import { fetchVulnerabilityOnce } from '@/lib/vulnerability-client';
import type { DossierSelection, GeoFeedState, OverlayHighlight, ResolvedGeo } from '@/lib/geography';
import { INITIAL_UW_FEED, reduceUwFeed, resolveUw, type UwHighlight } from '@/lib/underwriting';
import { fetchUnderwritingOnce } from '@/lib/underwriting-client';
import { INITIAL_AN_FEED, reduceAnFeed, resolveAn, analystReportPath } from '@/lib/analyst';
import { fetchAnalystOnce } from '@/lib/analyst-client';
import { AnalystView } from './AnalystView';
import { VulnerabilityView } from './VulnerabilityView';
import { UnderwritingView } from './UnderwritingView';
import { VectorJudgmentCard } from './VectorJudgmentCard';
import { DossierGeographyView } from './DossierGeographyView';

/**
 * Right-rail "Supply Chain Dossiers" control: the finite registry roster of bounded GIDEON
 * dossiers (Las Bambas by default), the selected dossier's read-only DDD state, the geography
 * section (lifecycle, Locate, anchor / link list and cards), the default-visible E7 analyst
 * pyramid and — only for dossiers that have them — a link to the full legacy page and the legacy
 * E3B/E5 views behind collapsed controls. Every fetch is for the selected id; changing or clearing
 * the selection resets every feed so nothing from the previous dossier (including a late answer)
 * survives, and no legacy Las Bambas endpoint is requested for another dossier. Selection and
 * geography are owned by the page so the map overlay and this panel read the same state; the
 * panel never geocodes or invents geometry.
 */

export const DOSSIER_LIST: ReadonlyArray<DossierRegistryEntry> = rosterDossiers();

const POLL_MS = 60_000;

export interface SupplyChainDossiersPanelProps {
  selected: string | null;
  onSelect: (id: string | null) => void;
  geography?: {
    feed: GeoFeedState;
    resolved: ResolvedGeo;
    selection: DossierSelection | null;
    onSelectElement: (sel: DossierSelection | null) => void;
    onLocate: () => void;
    /** E5: emphasise published anchors/links for the open underwriting case; null clears. */
    onHighlight?: (h: OverlayHighlight | null) => void;
  } | null;
}

export default function SupplyChainDossiersPanel({ selected, onSelect, geography = null }: SupplyChainDossiersPanelProps) {
  const [vulnOn, setVulnOn] = useState(false);
  const [uwOn, setUwOn] = useState(false);
  const [feed, dispatch] = useReducer(reduceFeed, INITIAL_FEED);
  const [vulnFeed, dispatchVuln] = useReducer(reduceVulnFeed, INITIAL_VULN_FEED);
  const [uwFeed, dispatchUw] = useReducer(reduceUwFeed, INITIAL_UW_FEED);
  const [anFeed, dispatchAn] = useReducer(reduceAnFeed, INITIAL_AN_FEED);
  const anGen = useRef(0);
  const anInFlight = useRef<string | null>(null);
  const gen = useRef(0);
  const vulnGen = useRef(0);
  const uwGen = useRef(0);
  const inFlight = useRef<string | null>(null);
  const vulnInFlight = useRef(false);
  const uwInFlight = useRef(false);
  const mounted = useRef(true);

  const load = useCallback(async (dossierId: string) => {
    if (inFlight.current === dossierId) return;
    inFlight.current = dossierId;
    gen.current += 1;
    try {
      const ev = await fetchDossierOnce(dossierId, gen.current);
      if (mounted.current) dispatch(ev);
    } finally {
      if (inFlight.current === dossierId) inFlight.current = null;
    }
  }, []);

  const loadVuln = useCallback(async () => {
    if (vulnInFlight.current) return;
    vulnInFlight.current = true;
    vulnGen.current += 1;
    try {
      const ev = await fetchVulnerabilityOnce(vulnGen.current);
      if (mounted.current) dispatchVuln(ev);
    } finally {
      vulnInFlight.current = false;
    }
  }, []);

  const loadUw = useCallback(async () => {
    if (uwInFlight.current) return;
    uwInFlight.current = true;
    uwGen.current += 1;
    try {
      const ev = await fetchUnderwritingOnce(uwGen.current);
      if (mounted.current) dispatchUw(ev);
    } finally {
      uwInFlight.current = false;
    }
  }, []);

  const loadAn = useCallback(async (dossierId: string) => {
    if (anInFlight.current === dossierId) return;
    anInFlight.current = dossierId;
    anGen.current += 1;
    try {
      const ev = await fetchAnalystOnce(dossierId, anGen.current);
      if (mounted.current) dispatchAn(ev);
    } finally {
      if (anInFlight.current === dossierId) anInFlight.current = null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // The analyst pyramid is default-visible: fetched for the requested dossier id whenever one is
  // selected (no toggle); deselection or a dossier change resets the feed so nothing outlives it.
  useEffect(() => {
    dispatchAn({ type: 'reset', generation: anGen.current });
    if (!selected) return;
    const run = () => loadAn(selected);
    const first = setTimeout(run, 0);
    const iv = setInterval(run, POLL_MS);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [selected, loadAn]);

  const entry = dossierRegistryEntry(selected);
  const legacy = !!entry && entry.legacyAssessments;

  // DDD state is fetched for the requested id only; deselection or a dossier change resets the
  // feed (and outdates any in-flight answer) so the previous dossier never shows under the new id.
  useEffect(() => {
    dispatch({ type: 'reset', generation: gen.current });
    if (!selected) return;
    const run = () => load(selected);
    const first = setTimeout(run, 0);
    const iv = setInterval(run, POLL_MS);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [selected, load]);

  // The magnitude/vector summary needs the vulnerability publication whenever a dossier with
  // legacy assessments (Las Bambas) is selected; the checkbox only expands the full matrix view.
  // No legacy endpoint is requested for any other dossier.
  useEffect(() => {
    if (!selected || !legacy) {
      dispatchVuln({ type: 'reset', generation: vulnGen.current });
      return;
    }
    const first = setTimeout(loadVuln, 0);
    const iv = setInterval(loadVuln, POLL_MS);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [selected, legacy, loadVuln]);

  // Underwriting is fetched only while its view is switched on for a selected legacy dossier;
  // switching off or changing dossier resets the feed so no case or highlight outlives its selection.
  useEffect(() => {
    if (!selected || !legacy || !uwOn) {
      dispatchUw({ type: 'reset', generation: uwGen.current });
      return;
    }
    const first = setTimeout(loadUw, 0);
    const iv = setInterval(loadUw, POLL_MS);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [selected, legacy, uwOn, loadUw]);

  const onHighlight = geography?.onHighlight;
  const handleHighlight = useCallback((h: UwHighlight | null) => {
    onHighlight?.(h ? { entityIds: h.entity_ids, edgeIds: h.edge_ids } : null);
  }, [onHighlight]);

  const resolved = resolveView(feed);
  const pub = (resolved.view === 'available' || resolved.view === 'stale') ? resolved.body?.publication ?? null : null;
  const cur = resolved.body?.currentness ?? null;
  const resolvedVuln = resolveVuln(vulnFeed);
  const vulnPub = (resolvedVuln.view === 'available' || resolvedVuln.view === 'stale') ? resolvedVuln.publication : null;
  const geoDrawn = !!geography && (geography.resolved.view === 'available' || geography.resolved.view === 'stale');
  const resolvedUw = resolveUw(uwFeed);
  const resolvedAn = resolveAn(anFeed);

  return (
    <div data-panel="supply-chain-dossiers" className="rounded-lg border border-white/10 bg-black/80 backdrop-blur-md p-3 flex flex-col gap-2 text-[10px] max-h-[70vh] overflow-y-auto">
      <div className="flex items-baseline justify-between">
        <span className="font-mono tracking-[0.2em] text-[var(--gold-primary)] text-[10px]">SUPPLY CHAIN DOSSIERS</span>
        <span className="font-mono text-white/40">{DOSSIER_LIST.length} {DOSSIER_LIST.length === 1 ? 'dossier' : 'dossiers'}</span>
      </div>
      <p role="note" data-banner="list-view" className="font-mono text-[9px] text-white/50">
        {selected
          ? 'Map shows approximate anchors and schematic reported connections from the separately reviewed geography supplement; the dossier publication itself carries no coordinates.'
          : 'Select a dossier to load its approximate geography (if published) and its read-only state. Nothing is drawn until then.'}
      </p>

      <ul data-section="dossier-list" className="flex flex-col gap-1">
        {DOSSIER_LIST.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => { onSelect(selected === d.id ? null : d.id); setVulnOn(false); setUwOn(false); }}
              aria-pressed={selected === d.id}
              data-dossier-id={d.id}
              className={`w-full text-left rounded border px-2 py-1.5 transition-colors ${selected === d.id ? 'border-[var(--gold-primary)]/60 bg-[var(--gold-primary)]/10 text-white' : 'border-white/10 text-white/70 hover:bg-white/5'}`}
            >
              <div className="font-semibold">{d.title}</div>
              <div className="font-mono text-[9px] text-white/40">{d.id} · {d.subtitle}</div>
            </button>
          </li>
        ))}
      </ul>

      {entry && (
        <div data-section="selected-dossier" data-dossier-id={entry.id} className="flex flex-col gap-2 border-t border-white/10 pt-2">
          <div data-field="selected-title" className="font-mono text-[9px] text-white/60">
            <span className="font-semibold text-white/80">{entry.title}</span>
            {!isDossierListed(entry.id) && <span className="ml-2 text-[#FFB300]/80">unlisted · not released</span>}
          </div>
          <div data-view-state={resolved.view} className="font-mono text-[10px] flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="font-bold tracking-widest">{resolved.view.toUpperCase().replace('_', ' ')}</span>
            {pub && cur && (
              <span className="text-white/60">publication {cur.publication_no} · {pub.entities.length} entities · {pub.edges.length} relationships · {pub.gap_register.length} gaps</span>
            )}
            {!pub && resolved.view !== 'loading' && (
              <span className="text-white/60">No dossier claims shown (reason code: {feed.fetchError ?? resolved.body?.reason ?? 'unknown'}).</span>
            )}
          </div>

          {geography && (
            <DossierGeographyView
              feed={geography.feed}
              resolved={geography.resolved}
              selection={geography.selection}
              onSelect={geography.onSelectElement}
              onLocate={geography.onLocate}
              vulnPublication={vulnPub}
            />
          )}
          {!geoDrawn && geography && geography.resolved.view !== 'loading' && (
            <p role="note" data-banner="text-connectivity" className="font-mono text-[9px] text-white/50">
              {entry.connectivityNote ?? 'No route, port or corridor is inferred for this dossier; nothing is drawn while geography is not available.'}
            </p>
          )}

          <section data-section="analyst" aria-label="Analyst supplement" className="flex flex-col gap-1 border-t border-white/10 pt-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono tracking-[0.15em] text-[#B388FF] text-[9px]">ANALYST SUPPLEMENT <span className="text-white/40 tracking-normal">e7-analyst/1.0</span></span>
              <Link href={analystReportPath(entry.id)} data-link="analyst-report" className="font-mono text-[9px] text-[var(--cyan-primary)] underline underline-offset-2">Full report →</Link>
            </div>
            <AnalystView key={selected} dossierId={entry.id} feed={anFeed} resolved={resolvedAn} compact linkToReport />
          </section>

          {entry.fullDossierHref && (
            <div className="flex items-center gap-3">
              <Link href={entry.fullDossierHref} data-link="full-dossier" className="font-mono text-[10px] text-[var(--cyan-primary)] underline underline-offset-2">Open full dossier →</Link>
            </div>
          )}
          {legacy && (
          <details data-section="legacy" className="border-t border-white/10 pt-2">
            <summary className="cursor-pointer font-mono text-[9px] tracking-[0.15em] text-white/50">LEGACY ASSESSMENTS <span className="tracking-normal text-white/35">e3b-vulnerability/1.0 · e5-underwriting/1.0 (unchanged)</span></summary>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-white/70 cursor-pointer select-none">
                <input type="checkbox" checked={vulnOn} onChange={(e) => setVulnOn(e.target.checked)} data-toggle="vulnerability" className="accent-[var(--gold-primary)]" />
                Vulnerability view
              </label>
              <label className="flex items-center gap-1.5 text-white/70 cursor-pointer select-none">
                <input type="checkbox" checked={uwOn} onChange={(e) => setUwOn(e.target.checked)} data-toggle="underwriting" className="accent-[#B388FF]" />
                Underwriting cases
              </label>
            </div>
            {!vulnOn && <VectorJudgmentCard publication={vulnPub} compact brief />}
            {!vulnPub && resolvedVuln.view !== 'loading' && (
              <p data-banner="vector-unavailable" className="font-mono text-[9px] text-white/50">
                Magnitude / vector summary not shown: vulnerability assessment {resolvedVuln.view.replace('_', ' ')} (reason code: {vulnFeed.fetchError ?? resolvedVuln.body?.reason ?? 'unknown'}).
              </p>
            )}
            {vulnOn && <VulnerabilityView feed={vulnFeed} resolved={resolvedVuln} compact geographyDrawn={geoDrawn} />}
            {uwOn && (
              <section data-section="underwriting" aria-label="Underwriting cases" className="flex flex-col gap-1 border-t border-white/10 pt-2 mt-1">
                <span className="font-mono tracking-[0.15em] text-[#B388FF] text-[9px]">UNDERWRITING CASES <span className="text-white/40 tracking-normal">e5-underwriting/1.0</span></span>
                <UnderwritingView key={selected} feed={uwFeed} resolved={resolvedUw} compact geographyDrawn={geoDrawn} onHighlight={onHighlight ? handleHighlight : undefined} />
              </section>
            )}
          </details>
          )}
        </div>
      )}
    </div>
  );
}
