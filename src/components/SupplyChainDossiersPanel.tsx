'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { DOSSIER_ID, INITIAL_FEED, reduceFeed, resolveView } from '@/lib/dossier';
import { fetchDossierOnce } from '@/app/dossiers/las-bambas-matarani/DossierClient';
import { INITIAL_VULN_FEED, NO_GEOMETRY_NOTE, reduceVulnFeed, resolveVuln } from '@/lib/vulnerability';
import { fetchVulnerabilityOnce } from '@/lib/vulnerability-client';
import { VulnerabilityView } from './VulnerabilityView';

/**
 * Right-rail "Supply Chain Dossiers" control: a one-entry list of bounded GIDEON dossiers,
 * the selected dossier's read-only state panel, a link to the full page and an opt-in
 * vulnerability view. It draws nothing on the map — the accepted dossier publishes no
 * coordinates and this panel never geocodes or invents geometry. Unmounting the panel
 * (turning the control off) clears the selection and both feeds.
 */

export const DOSSIER_LIST: ReadonlyArray<{ id: string; title: string; href: string }> = [
  { id: DOSSIER_ID, title: 'Las Bambas – Pillones – Matarani', href: `/dossiers/${DOSSIER_ID}` },
];

const POLL_MS = 60_000;

export default function SupplyChainDossiersPanel() {
  const [selected, setSelected] = useState<string | null>(null);
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

  useEffect(() => {
    if (!selected || !vulnOn) return;
    const first = setTimeout(loadVuln, 0);
    const iv = setInterval(loadVuln, POLL_MS);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [selected, vulnOn, loadVuln]);

  const entry = DOSSIER_LIST.find((d) => d.id === selected) ?? null;
  const resolved = resolveView(feed);
  const pub = (resolved.view === 'available' || resolved.view === 'stale') ? resolved.body?.publication ?? null : null;
  const cur = resolved.body?.currentness ?? null;

  return (
    <div data-panel="supply-chain-dossiers" className="rounded-lg border border-white/10 bg-black/80 backdrop-blur-md p-3 flex flex-col gap-2 text-[10px] max-h-[70vh] overflow-y-auto">
      <div className="flex items-baseline justify-between">
        <span className="font-mono tracking-[0.2em] text-[var(--gold-primary)] text-[10px]">SUPPLY CHAIN DOSSIERS</span>
        <span className="font-mono text-white/40">{DOSSIER_LIST.length} dossier</span>
      </div>
      <p role="note" data-banner="list-view" className="font-mono text-[9px] text-white/50">{NO_GEOMETRY_NOTE}</p>

      <ul data-section="dossier-list" className="flex flex-col gap-1">
        {DOSSIER_LIST.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => { setSelected(selected === d.id ? null : d.id); setVulnOn(false); }}
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
          <div className="flex items-center gap-3">
            <Link href={entry.href} data-link="full-dossier" className="font-mono text-[10px] text-[var(--cyan-primary)] underline underline-offset-2">Open full dossier →</Link>
            <label className="flex items-center gap-1.5 text-white/70 cursor-pointer select-none ml-auto">
              <input type="checkbox" checked={vulnOn} onChange={(e) => setVulnOn(e.target.checked)} data-toggle="vulnerability" className="accent-[var(--gold-primary)]" />
              Vulnerability view
            </label>
          </div>
          {vulnOn && <VulnerabilityView feed={vulnFeed} resolved={resolveVuln(vulnFeed)} compact />}
        </div>
      )}
    </div>
  );
}
