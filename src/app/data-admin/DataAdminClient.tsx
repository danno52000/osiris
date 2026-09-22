'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  EXPECTED_SOURCE_COUNT,
  FLAG_LABELS,
  FLAG_ORDER,
  deriveViewState,
  describeReason,
  flagText,
  formatCount,
  formatCountKind,
  formatSourcePeriod,
  formatTimestamp,
  isNonLive,
  type DataAdminResponse,
  type DataAdminSource,
  type FlagValue,
  type ViewState,
} from '@/lib/data-admin';

/** Poll no faster than once a minute; the sidecar caches for 300 s anyway. */
const POLL_MS = 60_000;

const STATE_STYLE: Record<ViewState, { label: string; cls: string }> = {
  loading: { label: 'LOADING', cls: 'text-white/50 border-white/20' },
  disabled: { label: 'DISABLED', cls: 'text-white/60 border-white/20' },
  unconfigured: { label: 'UNCONFIGURED', cls: 'text-[#FFB74D] border-[#FFB74D]/50' },
  unavailable: { label: 'UNAVAILABLE', cls: 'text-[#FF5722] border-[#FF5722]/50' },
  stale: { label: 'STALE', cls: 'text-[#FFB74D] border-[#FFB74D]/50' },
  available: { label: 'AVAILABLE', cls: 'text-[#00E676] border-[#00E676]/50' },
  empty: { label: 'EMPTY', cls: 'text-[#FFB74D] border-[#FFB74D]/50' },
};

const DISPOSITION_STYLE: Record<string, string> = {
  loaded: 'text-[#00E676] border-[#00E676]/40',
  loaded_manual: 'text-[#80CBC4] border-[#80CBC4]/40',
  blocked: 'text-[#FF5722] border-[#FF5722]/40',
  deferred: 'text-white/50 border-white/20',
};

function dispositionLabel(source: DataAdminSource): string {
  switch (source.disposition) {
    case 'loaded': return 'LOADED';
    case 'loaded_manual': return 'LOADED · MANUAL ONLY';
    case 'blocked': return 'BLOCKED · NOT LOADED';
    case 'deferred': return 'DEFERRED';
    default: return source.disposition.toUpperCase();
  }
}

function FlagPill({ name, flag }: { name: keyof typeof FLAG_LABELS; flag: FlagValue | undefined }) {
  const text = flagText(flag);
  const cls =
    text === 'yes' ? 'text-[#00E676] border-[#00E676]/40'
    : text === 'no' ? 'text-[#FF5722] border-[#FF5722]/40'
    : 'text-white/45 border-white/15';
  const provenance = flag?.provenance ?? 'unknown';
  const when = flag?.observed_at ?? flag?.evidence_at ?? null;
  const title = [
    `${FLAG_LABELS[name]}: ${text}`,
    `provenance: ${provenance}`,
    when ? `as of ${formatTimestamp(when)}` : null,
    flag?.note ?? null,
    flag?.rule ?? null,
  ].filter(Boolean).join('\n');
  return (
    <span
      title={title}
      data-flag={name}
      data-value={text}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider ${cls}`}
    >
      <span className="text-white/60">{FLAG_LABELS[name]}</span>
      <span className="font-bold">{text}</span>
      <span className="text-white/30 normal-case">({provenance})</span>
    </span>
  );
}

function SourceCard({ source }: { source: DataAdminSource }) {
  const nonLive = isNonLive(source);
  const dispCls = DISPOSITION_STYLE[source.disposition] ?? 'text-white/60 border-white/20';
  return (
    <article
      data-source-id={source.source_id}
      className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col gap-3"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-mono text-white/40 tracking-widest">{source.source_id} · {source.family}</div>
          <h2 className="text-sm font-semibold text-white">{source.name}</h2>
          <div className="text-[11px] text-white/50">{source.publisher} · {source.record_type}</div>
        </div>
        <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold tracking-widest ${dispCls}`}>
          {dispositionLabel(source)}
        </span>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {FLAG_ORDER.map(name => <FlagPill key={name} name={name} flag={source.flags?.[name]} />)}
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        <dt className="text-white/40">Scope</dt>
        <dd className="text-white/80">{source.coverage.declared_scope}</dd>
        <dt className="text-white/40">Geography</dt>
        <dd className="text-white/80">{source.coverage.geography}</dd>
        <dt className="text-white/40">Time coverage</dt>
        <dd className="text-white/80">{source.coverage.time_coverage}</dd>
        <dt className="text-white/40">Cadence (configured)</dt>
        <dd className="text-white/80">
          {source.cadence.text ?? 'none'}
          {source.cadence.cron ? <span className="text-white/40 font-mono"> · {source.cadence.cron}</span> : null}
          <span className="text-white/30"> · configuration evidence, not proof of automatic runs</span>
        </dd>
        {!nonLive && (
          <>
            <dt className="text-white/40">Source period</dt>
            <dd className="text-white/80">{formatSourcePeriod(source.source_period)}</dd>
            <dt className="text-white/40">Published in GIDEON</dt>
            <dd className="text-white/80 font-mono">{formatTimestamp(source.published_at)}</dd>
            <dt className="text-white/40">Last successful run</dt>
            <dd className="text-white/80 font-mono">{formatTimestamp(source.last_success_at)}</dd>
            <dt className="text-white/40">Latest attempt</dt>
            <dd className="text-white/80 font-mono">
              {source.last_attempt
                ? `${source.last_attempt.run_status ?? 'unknown'} · ${formatTimestamp(source.last_attempt.ended_at ?? source.last_attempt.started_at)}${source.last_attempt.error_code ? ` · ${source.last_attempt.error_code}` : ''}`
                : 'unknown'}
            </dd>
            {source.last_failure && (
              <>
                <dt className="text-white/40">Last failure</dt>
                <dd className="text-[#FF8A65] font-mono">{formatTimestamp(source.last_failure.at)} · {source.last_failure.error_code ?? 'unknown'}</dd>
              </>
            )}
            <dt className="text-white/40">Live check</dt>
            <dd className="text-white/60 font-mono">{formatTimestamp(source.live_observation?.checked_at)}</dd>
          </>
        )}
      </dl>

      {!nonLive && (
        <table className="w-full text-[11px] border-t border-white/[0.06]">
          <caption className="sr-only">Datasets for {source.name}</caption>
          <thead>
            <tr className="text-white/40 text-left">
              <th className="py-1 font-normal">Dataset</th>
              <th className="py-1 font-normal">Grain</th>
              <th className="py-1 font-normal text-right">Count</th>
              <th className="py-1 font-normal text-right">Kind</th>
            </tr>
          </thead>
          <tbody>
            {source.datasets.map(ds => (
              <tr key={ds.dataset_id} data-dataset-id={ds.dataset_id} className="border-t border-white/[0.04]">
                <td className="py-1 text-white/80">{ds.name}</td>
                <td className="py-1 text-white/50">{ds.grain}</td>
                <td className={`py-1 text-right font-mono ${ds.count === null ? 'text-white/40' : 'text-white'}`}>{formatCount(ds)}</td>
                <td className="py-1 text-right text-white/40">{formatCountKind(ds.count_kind)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {source.partitions && (
        <div className="text-[10px] text-white/50 font-mono">
          {Object.entries(source.partitions).map(([layer, p]) => (
            <div key={layer}>
              {layer}: {p.complete ?? '?'}/{p.total ?? '?'} partitions complete
              {p.failed_last_attempts ? ` · ${p.failed_last_attempts} failed last attempt` : ''}
            </div>
          ))}
        </div>
      )}

      {nonLive && (
        <p className="text-[11px] text-white/50">
          No hosted typed tables for this source; counts are not shown because none exist.
        </p>
      )}

      {source.blocker && (
        <p className="text-[11px] text-[#FFB74D]"><span className="text-white/40">Blocker: </span>{source.blocker}</p>
      )}
      {source.next_action && (
        <p className="text-[11px] text-white/70"><span className="text-white/40">Next action: </span>{source.next_action}</p>
      )}
      <p className="text-[10px] text-white/35">Display clearance: {source.display_clearance}</p>

      {source.evidence_links?.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-[10px]">
          {source.evidence_links.map(link => (
            <li key={link.url}>
              {link.restricted ? (
                <span className="text-white/35" title="Restricted evidence; not linked from the public page">{link.label} (restricted)</span>
              ) : (
                <a href={link.url} target="_blank" rel="noreferrer noopener" className="text-[var(--cyan-primary)]/80 hover:text-[var(--cyan-primary)] underline underline-offset-2">
                  {link.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function DataAdminClient() {
  const [body, setBody] = useState<DataAdminResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);
  const previousView = useRef<ViewState>('loading');

  const load = useCallback(async () => {
    let next: ViewState;
    try {
      const res = await fetch('/api/fusion/data-admin', { cache: 'no-store' });
      const data = (await res.json()) as DataAdminResponse;
      next = deriveViewState(data);
      setBody(data);
      setFetchError(null);
    } catch (e) {
      next = 'unavailable';
      setFetchError(e instanceof Error ? e.message : 'request failed');
    } finally {
      setFetchedAt(new Date().toISOString());
    }
    // "Recovered" = a fresh available payload right after an unavailable/stale one.
    const prev = previousView.current;
    setRecovered(next === 'available' && (prev === 'unavailable' || prev === 'stale'));
    previousView.current = next;
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const iv = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [load]);

  const view: ViewState = fetchError && !body ? 'unavailable' : deriveViewState(body);

  const style = STATE_STYLE[view];
  const reasonText = describeReason(body?.refresh_error ?? body?.reason);
  const sources = body?.sources ?? [];

  return (
    <div className="docs-root min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] antialiased">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <div className="text-[10px] font-mono tracking-[0.25em] text-[var(--gold-primary)]/80 uppercase">GIDEON · Data Admin</div>
            <h1 className="text-xl font-semibold text-white">Public-source status</h1>
            <p className="text-[12px] text-white/50 max-w-2xl">
              Reviewed manifest metadata for {EXPECTED_SOURCE_COUNT} source families merged with live aggregate counts and
              freshness from the hosted GIDEON foundation database. Aggregate metadata only — no source records,
              documents, controls or credentials. Unknown values are shown as unknown, never as zero.
            </p>
          </div>
          <nav className="flex items-center gap-3 text-[11px] font-mono">
            <Link href="/" className="text-white/60 hover:text-white underline underline-offset-2">← Tactical map</Link>
            <Link href="/docs" className="text-white/60 hover:text-white underline underline-offset-2">Docs</Link>
          </nav>
        </header>

        <section
          data-view-state={view}
          className={`rounded-lg border px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono bg-white/[0.02] ${style.cls}`}
        >
          <span className="font-bold tracking-widest">{style.label}</span>
          {view === 'loading' && <span className="text-white/50">Contacting the Fusion sidecar…</span>}
          {view === 'disabled' && <span className="text-white/60">{reasonText ?? 'Foundation read API is off.'}</span>}
          {view === 'unconfigured' && <span>{reasonText ?? 'Reader connection not configured.'} <span className="text-white/40">(reason code: {body?.reason ?? 'unknown'})</span></span>}
          {view === 'unavailable' && (
            <span>
              {reasonText ?? fetchError ?? 'No data available.'}{' '}
              <span className="text-white/40">(reason code: {body?.reason ?? 'fetch_failed'})</span>
            </span>
          )}
          {view === 'stale' && (
            <span>
              Showing the last good payload from {formatTimestamp(body?.checked_at)} ({body?.cache_age_s ?? '?'} s old); latest refresh failed
              {body?.refresh_error ? ` — ${describeReason(body.refresh_error)} (${body.refresh_error})` : ''}.
            </span>
          )}
          {view === 'empty' && <span>Foundation API answered but reported no sources.</span>}
          {view === 'available' && (
            <span className="text-white/60">
              Checked {formatTimestamp(body?.checked_at)}
              {body?.served_from_cache ? ` · cached ${body.cache_age_s ?? 0} s` : ' · fresh'}
              {recovered ? <span className="text-[#00E676]"> · recovered</span> : null}
            </span>
          )}
          <span className="ml-auto text-white/35">page fetched {formatTimestamp(fetchedAt)}</span>
        </section>

        {body && (view === 'available' || view === 'stale' || view === 'empty') && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] font-mono text-white/50">
            <div className="rounded border border-white/[0.06] p-2">
              <div className="text-white/30 uppercase tracking-widest">Schema revision</div>
              <div className="text-white/80">expected {body.schema_revision_expected} · observed {body.schema_revision_observed ?? 'unknown'}</div>
            </div>
            <div className="rounded border border-white/[0.06] p-2">
              <div className="text-white/30 uppercase tracking-widest">Manifest</div>
              <div className="text-white/80">v{body.manifest?.version ?? '?'} · reviewed {formatTimestamp(body.manifest?.reviewed_at)}</div>
              <div className="truncate" title={body.manifest?.sha256}>sha256 {body.manifest?.sha256?.slice(0, 16) ?? '?'}… · db {body.manifest?.database_commit?.slice(0, 10) ?? '?'}</div>
            </div>
            <div className="rounded border border-white/[0.06] p-2">
              <div className="text-white/30 uppercase tracking-widest">Sources</div>
              <div className="text-white/80">
                {sources.length} of {EXPECTED_SOURCE_COUNT} families
                {sources.length !== EXPECTED_SOURCE_COUNT && sources.length > 0 ? <span className="text-[#FFB74D]"> · unexpected count</span> : null}
              </div>
            </div>
          </section>
        )}

        {sources.length > 0 && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sources.map(s => <SourceCard key={s.source_id} source={s} />)}
          </section>
        )}

        <footer className="text-[10px] text-white/30 border-t border-white/[0.06] pt-3">
          Configured schedules are workflow configuration evidence, not proof that a scheduled run executed;
          &ldquo;Automatic run verified&rdquo; stays unknown until an independent scheduled-run receipt exists.
          Counts come from source-specific snapshot or partition tables and are never summed across families.
        </footer>
      </div>
    </div>
  );
}
