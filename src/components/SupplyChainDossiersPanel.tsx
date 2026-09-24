'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { DOSSIER_ID, INITIAL_FEED, reduceFeed, resolveView } from '@/lib/dossier';
import { fetchDossierOnce } from '@/app/dossiers/las-bambas-matarani/DossierClient';
import { INITIAL_VULN_FEED, reduceVulnFeed, resolveVuln } from '@/lib/vulnerability';
import { fetchVulnerabilityOnce } from '@/lib/vulnerability-client';
import type { DossierSelection, GeoFeedState, ResolvedGeo } from '@/lib/geography';
import { VulnerabilityView } from './VulnerabilityView';
import { VectorJudgmentCard } from './VectorJudgmentCard';
import { DossierGeographyView } from './DossierGeographyView';

/**
 * Right-rail "Supply Chain Dossiers" control: a one-entry list of bounded GIDEON dossiers,
 * the selected dossier's read-only state, the geography section (lifecycle, Locate, anchor /
 * link list and cards), the magnitude + hypothetical-vector summary, a link to the full page
 * and an opt-in full vulnerability view. Selection and geography are owned by the page so the
 * map overlay and this panel read the same state; the panel never geocodes or invents geometry.
 */

export const DOSSIER_LIST: ReadonlyArray<{ id: string; title: string; href: string }> = [
  { id: DOSSIER_ID, title: 'Las Bambas – Pillones – Matarani', href: `/dossiers/${DOSSIER_ID}` },
];

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
  } | null;
}

export default function SupplyChainDossiersPanel({ selected, onSelect, geography = null }: SupplyChainDossiersPanelProps) {
  const [vulnOn, setVulnOn] = useState(false);
  const [feed, dispatch] = useReducer(reduceFeed, INITIAL_FEED);
  const [vulnFeed, dispatchVuln] = useReducer(reduceVulnFeed, INITIAL_VULN_FEED);
  const gen = useRef(0);
  const vulnGen = useRef(0);
  const inFlight = useRef(false);
  const vulnInFlight = useRef(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    gen.current += 1;
    try {
      const ev = await fetchDossierOnce(gen.current);
      if (mounted.current) dispatch(ev);
    } finally {
      inFlight.current = false;
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

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const first = setTimeout(load, 0);
    const iv = setInterval(load, POLL_MS);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [selected, load]);

  // The magnitude/vector summary needs the vulnerability publication whenever a dossier is
  // selected; the checkbox only expands the full matrix view.
  useEffect(() => {
    if (!selected) return;
    const first = setTimeout(loadVuln, 0);
    const iv = setInterval(loadVuln, POLL_MS);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [selected, loadVuln]);

  const entry = DOSSIER_LIST.find((d) => d.id === selected) ?? null;
  const resolved = resolveView(feed);
  const pub = (resolved.view === 'available' || resolved.view === 'stale') ? resolved.body?.publication ?? null : null;
  const cur = resolved.body?.currentness ?? null;
  const resolvedVuln = resolveVuln(vulnFeed);
  const vulnPub = (resolvedVuln.view === 'available' || resolvedVuln.view === 'stale') ? resolvedVuln.publication : null;
  const geoDrawn = !!geography && (geography.resolved.view === 'available' || geography.resolved.view === 'stale');

  return (
    <div data-panel="supply-chain-dossiers" className="rounded-lg border border-white/10 bg-black/80 backdrop-blur-md p-3 flex flex-col gap-2 text-[10px] max-h-[70vh] overflow-y-auto">
      <div className="flex items-baseline justify-between">
        <span className="font-mono tracking-[0.2em] text-[var(--gold-primary)] text-[10px]">SUPPLY CHAIN DOSSIERS</span>
        <span className="font-mono text-white/40">{DOSSIER_LIST.length} dossier</span>
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
              onClick={() => { onSelect(selected === d.id ? null : d.id); setVulnOn(false); }}
              aria-pressed={selected === d.id}
              data-dossier-id={d.id}
              className={`w-full text-left rounded border px-2 py-1.5 transition-colors ${selected === d.id ? 'border-[var(--gold-primary)]/60 bg-[var(--gold-primary)]/10 text-white' : 'border-white/10 text-white/70 hover:bg-white/5'}`}
            >
              <div className="font-semibold">{d.title}</div>
              <div className="font-mono text-[9px] text-white/40">{d.id} · copper concentrate corridor (Peru)</div>
            </button>
          </li>
        ))}
      </ul>

      {entry && (
        <div data-section="selected-dossier" className="flex flex-col gap-2 border-t border-white/10 pt-2">
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
              Reported connectivity (road to Pillones, rail to Matarani) remains readable in the full dossier; nothing is drawn while geography is not available.
            </p>
          )}

          {!vulnOn && <VectorJudgmentCard publication={vulnPub} compact brief />}
          {!vulnPub && resolvedVuln.view !== 'loading' && (
            <p data-banner="vector-unavailable" className="font-mono text-[9px] text-white/50">
              Magnitude / vector summary not shown: vulnerability assessment {resolvedVuln.view.replace('_', ' ')} (reason code: {vulnFeed.fetchError ?? resolvedVuln.body?.reason ?? 'unknown'}).
            </p>
          )}

          <div className="flex items-center gap-3">
            <Link href={entry.href} data-link="full-dossier" className="font-mono text-[10px] text-[var(--cyan-primary)] underline underline-offset-2">Open full dossier →</Link>
            <label className="flex items-center gap-1.5 text-white/70 cursor-pointer select-none ml-auto">
              <input type="checkbox" checked={vulnOn} onChange={(e) => setVulnOn(e.target.checked)} data-toggle="vulnerability" className="accent-[var(--gold-primary)]" />
              Vulnerability view
            </label>
          </div>
          {vulnOn && <VulnerabilityView feed={vulnFeed} resolved={resolvedVuln} compact geographyDrawn={geoDrawn} />}
        </div>
      )}
    </div>
  );
}
