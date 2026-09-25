import Link from 'next/link';
import {
  describeChange,
  describeReason,
  displayNarrative,
  formatLocator,
  formatTimestamp,
  groupPublication,
  isReplay,
  safeHttpUrl,
  type Assertion,
  type Edge,
  type EvidenceEntry,
  type FeedState,
  type Grouped,
  type ResolvedView,
  type ViewState,
} from '@/lib/dossier';
import { VulnerabilityView } from '@/components/VulnerabilityView';
import type { ResolvedVuln, VulnFeedState } from '@/lib/vulnerability';
import type { ResolvedUw, UwFeedState } from '@/lib/underwriting';
import { UnderwritingView } from '@/components/UnderwritingView';

const STATE_STYLE: Record<ViewState, { label: string; cls: string }> = {
  loading: { label: 'LOADING', cls: 'text-white/50 border-white/20' },
  available: { label: 'AVAILABLE', cls: 'text-[#00E676] border-[#00E676]/50' },
  stale: { label: 'STALE', cls: 'text-[#FFB74D] border-[#FFB74D]/50' },
  not_published: { label: 'NOT PUBLISHED', cls: 'text-white/60 border-white/20' },
  withdrawn: { label: 'WITHDRAWN', cls: 'text-[#FF5722] border-[#FF5722]/50' },
  unavailable: { label: 'UNAVAILABLE', cls: 'text-[#FF5722] border-[#FF5722]/50' },
};

export interface DossierViewProps {
  feed: FeedState;
  resolved: ResolvedView;
  /** Edge currently opened for evidence drill-down (null = closed). */
  selectedEdgeId: string | null;
  onSelectEdge: (edgeId: string | null) => void;
  /** E3B vulnerability view (opt-in). Omitted = control not rendered (e.g. static tests). */
  vulnerability?: { on: boolean; onToggle: (on: boolean) => void; feed: VulnFeedState; resolved: ResolvedVuln };
  /** E5 underwriting case portfolio (opt-in). Omitted = control not rendered. */
  underwriting?: { on: boolean; onToggle: (on: boolean) => void; feed: UwFeedState; resolved: ResolvedUw };
}

function EvidenceButton({ edge, selected, onSelect }: { edge: Edge; selected: boolean; onSelect: (id: string | null) => void }) {
  return (
    <button
      type="button"
      data-evidence-for={edge.id}
      aria-expanded={selected}
      aria-controls="evidence-drawer"
      onClick={() => onSelect(selected ? null : edge.id)}
      className={`px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider ${
        selected ? 'text-[var(--cyan-primary)] border-[var(--cyan-primary)]/60' : 'text-white/60 border-white/20 hover:text-white'
      }`}
    >
      evidence {edge.evidence.length}
    </button>
  );
}

function EvidenceRecord({ entry }: { entry: EvidenceEntry }) {
  if (entry.kind === 'document_locator') {
    const url = safeHttpUrl(entry.url);
    return (
      <li data-evidence-kind="document_locator" className="rounded border border-white/[0.08] p-2 text-[11px]">
        <div className="text-white/40 font-mono text-[10px]">{entry.source_id} · verified document · {entry.verification ?? 'unknown'}</div>
        <div className="text-white/85 break-words">{entry.document_id ?? 'document id unknown'}</div>
        <div className="text-white/60" data-field="locator">{formatLocator(entry.locator)}</div>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer noopener" className="text-[var(--cyan-primary)]/80 underline underline-offset-2 break-all">{url}</a>
        ) : (
          <div className="text-white/35">no public URL</div>
        )}
        <div className="font-mono text-[10px] text-white/40 break-all">document sha256 {entry.document_sha256 ?? 'unknown'}</div>
        <div className="font-mono text-[10px] text-white/40">
          quotation verified {formatTimestamp(entry.quotation_verified_at)} · published {formatTimestamp(entry.document_published_at)} · retrieved {formatTimestamp(entry.retrieved_at)}
        </div>
        <div className="text-[10px] text-white/35">Quoted text is not redistributed; the locator points into the document.</div>
      </li>
    );
  }
  if ((entry as { kind: string }).kind !== 'structured_record') {
    return <li data-evidence-kind="unsupported" className="rounded border border-white/[0.08] p-2 text-[11px] text-white/45">Evidence entry of an unsupported kind is not shown.</li>;
  }
  const nativeKey = entry.native_key && typeof entry.native_key === 'object' ? entry.native_key : {};
  return (
    <li data-evidence-kind="structured_record" className="rounded border border-white/[0.08] p-2 text-[11px]">
      <div className="text-white/40 font-mono text-[10px]">{entry.source_id} · {entry.table} · {entry.record_origin}{entry.release_label ? ` · ${entry.release_label}` : ''}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 mt-1">
        {Object.entries(nativeKey).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-white/40 font-mono">{k}</dt>
            <dd className="text-white/85 break-words">{v === '' ? <span className="text-white/35">(empty)</span> : v}</dd>
          </div>
        ))}
      </dl>
      <div className="font-mono text-[10px] text-white/40 break-all mt-1">payload sha256 {entry.payload_sha256}</div>
      {entry.attribution && <div className="text-[10px] text-white/45 mt-1">{entry.attribution}</div>}
    </li>
  );
}

function EvidenceDrawer({ edge, grouped, assertion, onClose }: { edge: Edge; grouped: Grouped; assertion: Assertion | undefined; onClose: () => void }) {
  const missing = edge.evidence.filter((ref) => !grouped.evidenceByRef.has(ref));
  return (
    <aside id="evidence-drawer" data-selected-edge={edge.id} aria-label="Evidence for the selected relationship" className="rounded-lg border border-[var(--cyan-primary)]/40 bg-white/[0.03] p-4 flex flex-col gap-2">
      <header className="flex items-start justify-between gap-2">
        <div className="text-[11px]">
          <div className="text-[10px] font-mono tracking-widest text-[var(--cyan-primary)]/80 uppercase">Evidence · {edge.predicate.replace('_', ' ')}</div>
          <div className="text-white/85">
            {grouped.entities.get(edge.subject)?.label ?? edge.subject} → {grouped.entities.get(edge.object)?.label ?? edge.object}
          </div>
          <div className="text-[10px] font-mono text-white/45">
            {edge.evidence_category} · version {edge.version}
            {edge.correction ? ` · corrected from v${edge.correction.from_version}` : ''}
            {assertion ? ` · currentness ${assertion.currentness} · confidence ${assertion.confidence ?? 'unknown'}` : ''}
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-[10px] font-mono text-white/50 hover:text-white underline underline-offset-2">close</button>
      </header>
      {edge.scope && Object.keys(edge.scope).length > 0 && (
        <div className="text-[10px] font-mono text-white/45" data-field="scope">
          scope: {Object.entries(edge.scope).map(([k, v]) => `${k}=${v === null || v === undefined ? 'unknown' : String(v)}`).join(' · ')}
        </div>
      )}
      {edge.value && typeof edge.value === 'object' && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] font-mono">
          {Object.entries(edge.value).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-white/40">{k}</dt>
              <dd className="text-white/80 break-words">{v === null || v === undefined ? <span className="text-white/35">unknown</span> : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      <ul className="flex flex-col gap-1.5">
        {edge.evidence.map((ref) => {
          const entry = grouped.evidenceByRef.get(ref);
          return entry ? <EvidenceRecord key={ref} entry={entry} /> : null;
        })}
      </ul>
      {missing.length > 0 && (
        <p className="text-[11px] text-[#FFB74D]">{missing.length} evidence reference(s) are not in the publication manifest and are not shown.</p>
      )}
    </aside>
  );
}

function Schematic({ grouped }: { grouped: Grouped }) {
  const asset = [...grouped.entities.values()].find((e) => e.kind === 'mining_asset');
  const owners = grouped.ownership.map((r) => `${r.holder} ${r.share}`);
  const lenders = [...new Set(grouped.finance.map((r) => r.lender))];
  const route = grouped.routeGaps.find((g) => g.kind === 'route_unpublished');
  const segments = grouped.routeGaps.filter((g) => g.kind === 'segment_unevidenced');
  return (
    <section aria-label="Dossier schematic" data-section="schematic" className="rounded-lg border border-white/[0.08] p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
      <div className="rounded border border-white/[0.08] p-3">
        <div className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Ownership → asset</div>
        <ul className="mt-1 flex flex-col gap-0.5 text-white/80">
          {owners.length ? owners.map((o) => <li key={o}>{o}</li>) : <li className="text-white/40">no published equity edges</li>}
        </ul>
        {grouped.operators.map((o) => <div key={o.edge.id} className="text-white/60 mt-1">operator: {o.operator}</div>)}
      </div>
      <div className="rounded border border-[var(--gold-primary)]/40 p-3">
        <div className="text-[10px] font-mono tracking-widest text-[var(--gold-primary)]/80 uppercase">Asset</div>
        <div className="text-white font-semibold">{asset?.label ?? 'unknown asset'}</div>
        <div className="text-white/50 mt-1">{grouped.finance.length} finance commitment edge(s) from {lenders.length} lender(s) · {grouped.roles.length} role edge(s)</div>
      </div>
      <div id="physical-route" data-section="physical" className="rounded border border-dashed border-[#FF8A65]/60 p-3">
        <div className="text-[10px] font-mono tracking-widest text-[#FF8A65] uppercase">Physical route → Pillones → Matarani</div>
        {grouped.physical.length === 0 || route ? (
          <p className="text-[#FFB74D] mt-1">
            <span className="font-bold">GAP — not published.</span>{' '}
            {route?.detail ?? 'No accepted, verified evidence links the mine to Pillones or the port of Matarani.'}
          </p>
        ) : (
          <p className="text-[10px] text-[#FFB74D] mt-1">Reported in accepted verified documents (quotation verified); not observed movement, schedules or port calls.</p>
        )}
        {grouped.physical.length > 0 && (
          <ul className="mt-1 text-white/80">
            {grouped.physical.map((r) => <li key={r.edge.id}>{r.from} → {r.to} <span className="text-white/45">({r.commodity}, {r.mode})</span></li>)}
          </ul>
        )}
        {segments.length > 0 && (
          <ul data-section="segments" className="mt-1 text-[10px] text-[#FFB74D]">
            {segments.map((g) => <li key={g.key ?? g.detail} data-segment={g.key ?? undefined}>segment {g.key ?? 'unknown'}: unevidenced — {g.detail}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

function RelationshipTable<T extends { edge: Edge }>({
  title, section, rows, columns, empty, selectedEdgeId, onSelectEdge,
}: {
  title: string;
  section: string;
  rows: T[];
  columns: { key: string; label: string; render: (row: T) => string; mono?: boolean }[];
  empty: string;
  selectedEdgeId: string | null;
  onSelectEdge: (id: string | null) => void;
}) {
  return (
    <section data-section={section} aria-labelledby={`${section}-heading`} className="rounded-lg border border-white/[0.08] p-4 flex flex-col gap-2">
      <h2 id={`${section}-heading`} className="text-sm font-semibold text-white">{title} <span className="text-white/40 font-mono text-[10px]">{rows.length}</span></h2>
      {rows.length === 0 ? (
        <p className="text-[11px] text-white/45">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="text-white/40 text-left">
                {columns.map((c) => <th key={c.key} scope="col" className="py-1 pr-3 font-normal whitespace-nowrap">{c.label}</th>)}
                <th scope="col" className="py-1 font-normal">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.edge.id} data-edge-id={row.edge.id} data-predicate={row.edge.predicate} className={`border-t border-white/[0.04] ${selectedEdgeId === row.edge.id ? 'bg-[var(--cyan-primary)]/10' : ''}`}>
                  {columns.map((c) => <td key={c.key} className={`py-1 pr-3 text-white/80 ${c.mono ? 'font-mono' : ''}`}>{c.render(row)}</td>)}
                  <td className="py-1"><EvidenceButton edge={row.edge} selected={selectedEdgeId === row.edge.id} onSelect={onSelectEdge} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function DossierView({ feed, resolved, selectedEdgeId, onSelectEdge, vulnerability, underwriting }: DossierViewProps) {
  const { view, staleOrigin, body } = resolved;
  const style = STATE_STYLE[view];
  const reasonText = describeReason(body?.reason);
  const pub = (view === 'available' || view === 'stale') && body?.publication ? body.publication : null;
  const grouped = pub ? groupPublication(pub) : null;
  const selectedEdge = grouped && selectedEdgeId ? pub!.edges.find((e) => e.id === selectedEdgeId) ?? null : null;
  const replay = body ? isReplay(body) : true;
  const cur = body?.currentness ?? null;

  return (
    <div className="docs-root min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] antialiased">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <div className="text-[10px] font-mono tracking-[0.25em] text-[var(--gold-primary)]/80 uppercase">GIDEON · Dossier</div>
            <h1 className="text-xl font-semibold text-white">Las Bambas – Pillones – Matarani</h1>
            <p className="text-[12px] text-white/50 max-w-2xl">
              Read-only prospect dossier from accepted E1 publications: ownership, finance commitments and the physical
              route are shown separately, each with its evidence. Unknowns stay unknown; unsupported links are gaps, not edges.
            </p>
          </div>
          <nav className="flex items-center gap-3 text-[11px] font-mono">
            <Link href="/" className="text-white/60 hover:text-white underline underline-offset-2">← Tactical map</Link>
            <Link href="/data-admin" className="text-white/60 hover:text-white underline underline-offset-2">Data Admin</Link>
          </nav>
        </header>

        {replay && (
          <p data-banner="replay" role="note" className="rounded border border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/10 px-3 py-2 text-[11px] text-[var(--gold-primary)]">
            <span className="font-bold tracking-widest font-mono">REPLAY DEMONSTRATION</span> — this dossier is served from a replay
            publication store (retained AidData F01 slice, synthetic port observations excluded, unverified documents held as gaps).
            It is not hosted operational intelligence; counts are fixture counts.
          </p>
        )}
        {!replay && pub && body?.evidence_origins.includes('retained_source') && (
          <p data-banner="retained-source" role="note" className="rounded border border-white/20 px-3 py-2 text-xs text-white/75">
            <span className="font-bold tracking-widest font-mono">RETAINED REAL-SOURCE EVIDENCE</span>. This publication uses
            retained source originals, not demo fixtures or a fresh database query. Source release and event dates
            determine its coverage; publication checks do not independently confirm current ownership or debt balances.
          </p>
        )}

        <section data-view-state={view} data-stale-origin={staleOrigin ?? undefined} className={`rounded-lg border px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono bg-white/[0.02] ${style.cls}`}>
          <span className="font-bold tracking-widest">{style.label}</span>
          {view === 'loading' && <span className="text-white/50">Contacting the Fusion sidecar…</span>}
          {view === 'not_published' && <span className="text-white/60">{reasonText ?? 'No publication yet.'}</span>}
          {view === 'withdrawn' && (
            <span>
              {reasonText ?? 'The current publication was withdrawn.'}{' '}
              <span className="text-white/40">Withdrawn publications are not shown; history is not served as current. (reason code: {body?.reason ?? 'unknown'})</span>
            </span>
          )}
          {view === 'unavailable' && (
            <span>
              {feed.fetchError ? describeReason(feed.fetchError) : reasonText ?? 'The dossier is unavailable.'}{' '}
              <span className="text-white/40">
                No claims are shown while current eligibility cannot be checked; nothing is served from history. (reason code: {feed.fetchError ?? body?.reason ?? 'unknown'})
              </span>
            </span>
          )}
          {view === 'stale' && staleOrigin === 'server' && (
            <span>
              Showing publication {cur?.publication_no ?? '?'} (last confirmed {formatTimestamp(cur?.last_successful_refresh?.ended_at)});{' '}
              latest attempt {cur?.latest_attempt?.status ?? 'unknown'} at {formatTimestamp(cur?.latest_attempt?.ended_at ?? cur?.latest_attempt?.started_at)} — {reasonText ?? body?.reason}. Not fresh.
            </span>
          )}
          {view === 'available' && <span className="text-white/60">Checked {formatTimestamp(body?.checked_at)}</span>}
          <span className="ml-auto text-white/35">page fetched {formatTimestamp(feed.fetchedAt)}</span>
        </section>

        <p data-banner="refresh-not-configured" role="note" className="text-[10px] font-mono text-white/40">
          Automatic dossier refresh is not configured. This page re-checks the current publication pointer about once a minute;
          polling does not refresh source evidence, run the E1 engine or verify documents.
        </p>

        {pub && cur && grouped && (
          <>
            <section data-section="currentness" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[10px] font-mono text-white/50">
              <div className="rounded border border-white/[0.06] p-2">
                <div className="text-white/30 uppercase tracking-widest">Publication</div>
                <div className="text-white/80">#{pub.publication_no} · created {formatTimestamp(pub.created_at)}</div>
                <div className="truncate" title={pub.bundle_fingerprint}>bundle {pub.bundle_fingerprint.slice(0, 16)}… · {pub.contract}</div>
              </div>
              <div className="rounded border border-white/[0.06] p-2">
                <div className="text-white/30 uppercase tracking-widest">Eligibility established</div>
                <div className="text-white/80">{formatTimestamp(cur.eligibility_established_at)}{cur.restored ? ' · restored' : ''}</div>
              </div>
              <div className="rounded border border-white/[0.06] p-2">
                <div className="text-white/30 uppercase tracking-widest">Latest attempt</div>
                <div className={cur.latest_attempt?.outcome === 'qualifying_refresh' ? 'text-white/80' : 'text-[#FFB74D]'} data-field="latest-attempt">
                  {cur.latest_attempt ? `${cur.latest_attempt.status} · ${formatTimestamp(cur.latest_attempt.ended_at ?? cur.latest_attempt.started_at)}` : 'unknown'}
                </div>
              </div>
              <div className="rounded border border-white/[0.06] p-2">
                <div className="text-white/30 uppercase tracking-widest">Last successful refresh</div>
                <div className="text-white/80" data-field="last-success">{formatTimestamp(cur.last_successful_refresh?.ended_at)}</div>
              </div>
            </section>

            <p data-section="what-changed" className="text-[11px] text-white/70"><span className="text-white/40">What changed: </span>{describeChange(pub)}</p>

            <Schematic grouped={grouped} />

            {selectedEdge && <EvidenceDrawer edge={selectedEdge} grouped={grouped} assertion={grouped.assertionsByEdge.get(selectedEdge.id)} onClose={() => onSelectEdge(null)} />}

            <RelationshipTable
              title="Ownership (documented equity)" section="ownership" rows={grouped.ownership}
              empty="No published equity relationships."
              selectedEdgeId={selectedEdgeId} onSelectEdge={onSelectEdge}
              columns={[
                { key: 'holder', label: 'Equity holder', render: (r) => r.holder },
                { key: 'share', label: 'Share', render: (r) => r.share, mono: true },
                { key: 'type', label: 'Holder type', render: (r) => r.holderType },
                { key: 'origin', label: 'Origin', render: (r) => r.origin },
                { key: 'asof', label: 'As of', render: (r) => r.asOf },
              ]}
            />
            <RelationshipTable
              title="Operator" section="operators" rows={grouped.operators}
              empty="No published operator relationship."
              selectedEdgeId={selectedEdgeId} onSelectEdge={onSelectEdge}
              columns={[
                { key: 'op', label: 'Operator', render: (r) => r.operator },
                { key: 'type', label: 'Operator type', render: (r) => r.operatorType },
              ]}
            />
            <RelationshipTable
              title="Finance commitments (not payments or balances)" section="finance" rows={grouped.finance}
              empty="No published finance relationships."
              selectedEdgeId={selectedEdgeId} onSelectEdge={onSelectEdge}
              columns={[
                { key: 'lender', label: 'Lender', render: (r) => r.lender },
                { key: 'year', label: 'Commitment year', render: (r) => r.year, mono: true },
                { key: 'nominal', label: 'Nominal', render: (r) => r.nominal, mono: true },
                { key: 'flow', label: 'Flow', render: (r) => r.flowType },
                { key: 'status', label: 'Status', render: (r) => r.status },
                { key: 'event', label: 'Loan event', render: (r) => r.loanEventLabel + (r.tranche ? ` (tranche ${r.tranche})` : '') },
              ]}
            />
            <RelationshipTable
              title="Physical route links reported in verified documents (not observed movement)" section="transports" rows={grouped.physical}
              empty="No published route links: the mine–Pillones–Matarani chain remains a gap."
              selectedEdgeId={selectedEdgeId} onSelectEdge={onSelectEdge}
              columns={[
                { key: 'from', label: 'From', render: (r) => r.from },
                { key: 'to', label: 'To', render: (r) => r.to },
                { key: 'commodity', label: 'Commodity', render: (r) => r.commodity },
                { key: 'mode', label: 'Mode', render: (r) => r.mode, mono: true },
              ]}
            />
            <RelationshipTable
              title="Operating baseline reported in verified documents (as published; products and bases are not interchangeable)" section="operating" rows={grouped.operating}
              empty="No published operating figures: production, capacity, guidance and cargo share remain unreported here."
              selectedEdgeId={selectedEdgeId} onSelectEdge={onSelectEdge}
              columns={[
                { key: 'reporter', label: 'Reported by', render: (r) => r.reporter },
                { key: 'metric', label: 'Metric', render: (r) => r.metric, mono: true },
                { key: 'quantity', label: 'Quantity', render: (r) => r.quantity, mono: true },
                { key: 'product', label: 'Product', render: (r) => r.product },
                { key: 'basis', label: 'Basis', render: (r) => r.basis },
                { key: 'shareof', label: 'Share of', render: (r) => r.shareOf ?? '—' },
                { key: 'period', label: 'Reporting period', render: (r) => r.period, mono: true },
                { key: 'docdate', label: 'Document date', render: (r) => r.documentDate, mono: true },
              ]}
            />
            <RelationshipTable
              title="Reported events affecting route nodes (document-reported)" section="reported-events" rows={grouped.reportedEvents}
              empty="No published reported events."
              selectedEdgeId={selectedEdgeId} onSelectEdge={onSelectEdge}
              columns={[
                { key: 'event', label: 'Reported event', render: (r) => r.event },
                { key: 'affects', label: 'Affects', render: (r) => r.affects },
                { key: 'kind', label: 'Kind', render: (r) => r.kind, mono: true },
              ]}
            />
            <RelationshipTable
              title="Roles in dataset rows (context, not finance edges)" section="roles" rows={grouped.roles}
              empty="No published role relationships."
              selectedEdgeId={selectedEdgeId} onSelectEdge={onSelectEdge}
              columns={[
                { key: 'org', label: 'Organization', render: (r) => r.organization },
                { key: 'role', label: 'Role', render: (r) => r.role, mono: true },
                { key: 'rows', label: 'Rows', render: (r) => r.rows, mono: true },
              ]}
            />

            <section data-section="gaps" aria-labelledby="gaps-heading" className="rounded-lg border border-[#FFB74D]/40 p-4 flex flex-col gap-2">
              <h2 id="gaps-heading" className="text-sm font-semibold text-[#FFB74D]">Explicit gaps and unknowns <span className="text-white/40 font-mono text-[10px]">{grouped.gaps.length}</span></h2>
              <ul className="flex flex-col gap-1 text-[11px]">
                {grouped.gaps.map((g, i) => (
                  <li key={`${g.kind}-${g.key ?? i}`} data-gap-kind={g.kind} data-gap-key={g.key ?? undefined} className="flex gap-2">
                    <span className="font-mono text-[10px] text-[#FFB74D] whitespace-nowrap">{g.kind}{g.key ? ` [${g.key}]` : ''}</span>
                    <span className="text-white/75">{g.detail}{g.count !== null ? ` (${g.count})` : ''}</span>
                  </li>
                ))}
              </ul>
              {grouped.declaredUnknowns.length > 0 && (
                <p data-section="declared-unknowns" className="text-[10px] text-white/50">
                  {grouped.declaredUnknowns.length} declared unknown(s) (offtake, recovery, alternatives, baseline currentness) are operator-declared
                  and stay open until evidenced; this page never resolves them.
                </p>
              )}
            </section>

            <details className="rounded-lg border border-white/[0.08] p-4 text-[11px]">
              <summary className="cursor-pointer text-white/70">Narrative sentences ({pub.narrative.length}) and attribution</summary>
              <ul className="mt-2 flex flex-col gap-1 text-white/70">{pub.narrative.map((n, i) => <li key={i}>{displayNarrative(n)}</li>)}</ul>
              <ul className="mt-3 text-[10px] text-white/45">{pub.attribution.map((a) => <li key={a.source_id}>{a.source_id}: {a.attribution}</li>)}</ul>
            </details>
          </>
        )}

        {vulnerability && (
          <section data-section="vulnerability" aria-labelledby="vulnerability-heading" className="rounded-lg border border-white/[0.08] p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="vulnerability-heading" className="text-sm font-semibold text-white">Vulnerability assessment <span className="text-white/40 font-mono text-[10px]">e3b-vulnerability/1.0</span></h2>
              <label className="flex items-center gap-2 text-[11px] text-white/70 cursor-pointer select-none">
                <input type="checkbox" checked={vulnerability.on} onChange={(e) => vulnerability.onToggle(e.target.checked)} data-toggle="vulnerability" className="accent-[var(--gold-primary)]" />
                Show vulnerability view
              </label>
            </div>
            <p className="text-[11px] text-white/50 max-w-3xl">
              Read-only scenario dispositions bound to the exact dossier publication above. Magnitude is a rubric range
              from reviewed extent and duration bands, not a probability; null means accepted evidence does not bound it.
              Conditional scenarios are unscored and hidden from type cards until opted in. No actor, intent or attack
              procedure is asserted.
            </p>
            {vulnerability.on
              ? <VulnerabilityView feed={vulnerability.feed} resolved={vulnerability.resolved} />
              : <p data-vuln-view="off" className="font-mono text-[10px] text-white/40">Vulnerability view off — nothing is fetched or shown until switched on.</p>}
          </section>
        )}

        {underwriting && (
          <section data-section="underwriting" aria-labelledby="underwriting-heading" className="rounded-lg border border-white/[0.08] p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="underwriting-heading" className="text-sm font-semibold text-white">Underwriting cases <span className="text-white/40 font-mono text-[10px]">e5-underwriting/1.0</span></h2>
              <label className="flex items-center gap-2 text-[11px] text-white/70 cursor-pointer select-none">
                <input type="checkbox" checked={underwriting.on} onChange={(e) => underwriting.onToggle(e.target.checked)} data-toggle="underwriting" className="accent-[#B388FF]" />
                Show underwriting cases
              </label>
            </div>
            <p className="text-[11px] text-white/50 max-w-3xl">
              Hypothetical functional-disruption cases for continuity underwriting, bound to the exact dossier publication
              above. Each case carries two independent reviewed judgments — materialization difficulty and conditional
              magnitude — shown as a point, a range or explicit N/A with its reason. Assumption-led cases rest on labelled
              stress assumptions, not observed events. Nothing here is a probability, forecast, alert or combined risk.
            </p>
            {underwriting.on
              ? <UnderwritingView feed={underwriting.feed} resolved={underwriting.resolved} />
              : <p data-uw-view="off" className="font-mono text-[10px] text-white/40">Underwriting view off — nothing is fetched or shown until switched on.</p>}
          </section>
        )}

        <footer className="text-[10px] text-white/30 border-t border-white/[0.06] pt-3">
          Commitments are not payments, disbursements or outstanding balances. Dataset event dates are not source freshness.
          Only F01 structured records and verified documents are eligible evidence; port aggregates, port-call signals and
          restricted derivatives are excluded from this dossier by contract. Rules {pub?.rule_versions.mapping ?? '—'} · {pub?.rule_versions.projection ?? '—'}.
        </footer>
      </div>
    </div>
  );
}
