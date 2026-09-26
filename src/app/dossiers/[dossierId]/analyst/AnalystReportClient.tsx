'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import Link from 'next/link';
import { INITIAL_AN_FEED, reduceAnFeed, resolveAn, AN_CARD_COUNT, AN_FAMILY_COUNT } from '@/lib/analyst';
import { fetchAnalystOnce } from '@/lib/analyst-client';
import { DOSSIER_ID } from '@/lib/dossier';
import { AnalystView } from '@/components/AnalystView';

export const POLL_MS = 60_000;

export interface AnalystReportClientProps {
  dossierId: string;
  title: string;
  listed: boolean;
}

export default function AnalystReportClient({ dossierId, title, listed }: AnalystReportClientProps) {
  const [feed, dispatch] = useReducer(reduceAnFeed, INITIAL_AN_FEED);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    generation.current += 1;
    try {
      const event = await fetchAnalystOnce(dossierId, generation.current);
      if (mounted.current) dispatch(event);
    } finally {
      inFlight.current = false;
    }
  }, [dossierId]);

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

  const resolved = resolveAn(feed);
  const hasContent = resolved.view === 'available' || resolved.view === 'stale';
  const scrolledTo = useRef<string | null>(null);

  // Cards and sources render only after the publication arrives, so the browser's initial hash
  // jump finds no target; scroll once per hash after content is present (no-op without a hash).
  useEffect(() => {
    if (!hasContent) return;
    const hash = window.location.hash.slice(1);
    if (!hash || scrolledTo.current === hash) return;
    const target = document.getElementById(decodeURIComponent(hash));
    if (!target) return;
    scrolledTo.current = hash;
    target.scrollIntoView({ block: 'start' });
  }, [hasContent]);
  const legacyHref = dossierId === DOSSIER_ID ? `/dossiers/${DOSSIER_ID}` : null;

  return (
    <div className="docs-root min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] antialiased">
      <div data-page="analyst-report" data-dossier-id={dossierId} className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <div className="text-[10px] font-mono tracking-[0.25em] text-[#B388FF]/80 uppercase">GIDEON · Analyst report · e7-analyst/1.0</div>
            <h1 className="text-xl font-semibold text-white">{title}</h1>
            <p className="text-[12px] text-white/50 max-w-2xl">
              Read-only analyst supplement bound to the exact accepted dossier publication: {AN_CARD_COUNT} continuity
              narratives with qualitative enabling conditions, matrix-derived conditional magnitude under stated extent
              and duration assumptions (or an explicit unbounded baseline), {AN_FAMILY_COUNT} threat-vector family
              dispositions and a source register with per-source verification and rights. Nothing here is an alert,
              observed incident, probability or attack guidance.
            </p>
            {!listed && (
              <p data-banner="reserved-dossier" role="note" className="mt-1 font-mono text-[10px] text-[#FFB74D]">
                Reserved dossier id: registered for routing only, not enabled for publication; no other dossier is substituted.
              </p>
            )}
          </div>
          <nav className="flex items-center gap-3 text-[11px] font-mono">
            <Link href="/" className="text-white/60 hover:text-white underline underline-offset-2">← Tactical map</Link>
            {legacyHref && <Link href={legacyHref} data-link="full-dossier" className="text-white/60 hover:text-white underline underline-offset-2">Dossier (E1–E5)</Link>}
          </nav>
        </header>

        <p data-banner="refresh-not-configured" role="note" className="text-[10px] font-mono text-white/40">
          This report re-checks the current analyst pointer about once a minute; polling does not refresh sources,
          re-run any engine or verify documents. Page fetched {feed.fetchedAt ?? '—'}.
        </p>

        <AnalystView dossierId={dossierId} feed={feed} resolved={resolved} />

        <footer className="text-[10px] text-white/30 border-t border-white/[0.06] pt-3">
          Card anchors: <span className="font-mono">#analyst-&lt;card id&gt;</span>. Scores are never summed across cards or
          cases. Sources are listed with their reviewed verification and rights class; a URL alone is not verification.
        </footer>
      </div>
    </div>
  );
}
