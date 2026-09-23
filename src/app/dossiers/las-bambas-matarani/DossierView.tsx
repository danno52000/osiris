import Link from 'next/link';
import {
  RETAINED_MAX_AGE_S,
  describeChange,
  describeReason,
  formatTimestamp,
  groupPublication,
  isReplay,
  type Assertion,
  type Edge,
  type EvidenceEntry,
  type FeedState,
  type Grouped,
  type ResolvedView,
  type ViewState,
} from '@/lib/dossier';

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
  if (entry.kind === 'document') {
    return (
      <li data-evidence-kind="document" className="rounded border border-white/[0.08] p-2 text-[11px]">
        <div className="text-white/40 font-mono text-[10px]">{entry.source_id} · document · {entry.verification}</div>
        <a href={entry.locator} target="_blank" rel="noreferrer noopener" className="text-[var(--cyan-primary)]/80 underline underline-offset-2 break-all">{entry.locator}</a>
        <div className="font-mono text-[10px] text-white/40 break-all">sha256 {entry.sha256}</div>
      </li>
    );
  }
  return (
    <li data-evidence-kind="structured_record" className="rounded border border-white/[0.08] p-2 text-[11px]">
      <div className="text-white/40 font-mono text-[10px]">{entry.source_id} · {entry.table} · {entry.record_origin}{entry.release_label ? ` · ${entry.release_label}` : ''}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 mt-1">
        {Object.entries(entry.native_key).map(([k, v]) => (
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
      {edge.value && (
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
      <div data-section="physical" className="rounded border border-dashed border-[#FF8A65]/60 p-3">
        <div className="text-[10px] font-mono tracking-widest text-[#FF8A65] uppercase">Physical route → Pillones → Matarani</div>
        {grouped.physical.length === 0 ? (
          <p className="text-[#FFB74D] mt-1">
            <span className="font-bold">GAP — not published.</span>{' '}
            {route?.detail ?? 'No accepted, verified evidence links the mine to Pillones or the port of Matarani.'}
          </p>
        ) : (
          <ul className="mt-1 text-white/80">{grouped.physical.map((e) => <li key={e.id}>{e.predicate}: {grouped.entities.get(e.subject)?.label ?? e.subject} → {grouped.entities.get(e.object)?.label ?? e.object}</li>)}</ul>
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

export function DossierView({ feed, resolved, selectedEdgeId, onSelectEdge }: DossierViewProps) {
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
              {feed.fetchError
                ? `Browser fetch failed (${feed.fetchError}); no retained publication within the ${Math.round(RETAINED_MAX_AGE_S / 3600)} h stale limit.`
                : reasonText ?? 'The dossier is unavailable.'}{' '}
              <span className="text-white/40">(reason code: {feed.fetchError ? 'fetch_failed' : body?.reason ?? 'unknown'})</span>
            </span>
          )}
          {view === 'stale' && staleOrigin === 'server' && (
            <span>
              Showing publication {cur?.publication_no ?? '?'} (last confirmed {formatTimestamp(cur?.last_successful_refresh?.ended_at)});{' '}
              latest attempt {cur?.latest_attempt?.status ?? 'unknown'} at {formatTimestamp(cur?.latest_attempt?.ended_at ?? cur?.latest_attempt?.started_at)} — {reasonText ?? body?.reason}. Not fresh.
            </span>
          )}
          {view === 'stale' && staleOrigin === 'browser' && (
            <span>
              Browser fetch failed at {formatTimestamp(feed.fetchedAt)} ({feed.fetchError}); showing the publication received {formatTimestamp(feed.bodyAt)}. Not fresh.
            </span>
          )}
          {view === 'available' && <span className="text-white/60">Checked {formatTimestamp(body?.checked_at)}</span>}
          <span className="ml-auto text-white/35">page fetched {formatTimestamp(feed.fetchedAt)}</span>
        </section>

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
                  <li key={`${g.kind}-${g.key ?? i}`} data-gap-kind={g.kind} className="flex gap-2">
                    <span className="font-mono text-[10px] text-[#FFB74D] whitespace-nowrap">{g.kind}</span>
                    <span className="text-white/75">{g.detail}{g.count !== null ? ` (${g.count})` : ''}</span>
                  </li>
                ))}
              </ul>
            </section>

            <details className="rounded-lg border border-white/[0.08] p-4 text-[11px]">
              <summary className="cursor-pointer text-white/70">Narrative sentences ({pub.narrative.length}) and attribution</summary>
              <ul className="mt-2 flex flex-col gap-1 text-white/70">{pub.narrative.map((n, i) => <li key={i}>{n}</li>)}</ul>
              <ul className="mt-3 text-[10px] text-white/45">{pub.attribution.map((a) => <li key={a.source_id}>{a.source_id}: {a.attribution}</li>)}</ul>
            </details>
          </>
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
