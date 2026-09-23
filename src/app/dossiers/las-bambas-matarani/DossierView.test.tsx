/**
 * Render/state regressions for the E2 dossier page, rendered with react-dom/server.
 * Test bodies are small hand-built e2-dossier/1.0 payloads; their counts are test
 * counts, not fixture or hosted counts.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  INITIAL_FEED,
  PROXY_PATH,
  describeChange,
  displayNarrative,
  formatUsd,
  formatLocator,
  groupPublication,
  isDossierResponse,
  reduceFeed,
  resolveView,
  safeHttpUrl,
  type DossierResponse,
  type FeedEvent,
  type FeedState,
} from '@/lib/dossier';
import { AVAILABLE, PUBLICATION, REC_FIN, STALE_FAILED, T2, stateOnly } from '@/lib/dossier.test-fixture';
import AVAILABLE_DOCUMENT_JSON from '@/lib/dossier-fixtures/available_document.json';
import PIN from '@/lib/dossier-fixtures/PIN.json';
import { DossierView } from './DossierView';
import { fetchDossierOnce } from './DossierClient';

/** Engine-generated accepted verified-document publication (Fusion public projection). */
const AVAILABLE_DOCUMENT = AVAILABLE_DOCUMENT_JSON as unknown as DossierResponse;

const plus = (s: number) => new Date(Date.parse(T2) + s * 1000).toISOString();

function render(feed: FeedState, _nowIso?: string, selectedEdgeId: string | null = null): string {
  void _nowIso;
  return renderToStaticMarkup(
    <DossierView feed={feed} resolved={resolveView(feed)} selectedEdgeId={selectedEdgeId} onSelectEdge={() => undefined} />,
  );
}

/** Deterministic JSON with sorted keys, matching Python's json.dumps(sort_keys=True). */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(', ')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}: ${canonical((v as Record<string, unknown>)[k])}`).join(', ')}}`;
  }
  if (typeof v === 'string') {
    // Python's ensure_ascii escapes everything outside 0x20..0x7e.
    return JSON.stringify(v).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  }
  return JSON.stringify(v);
}

function attr(html: string, name: string): string | null {
  const m = html.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

let gen = 0;
const fed = (body: DossierResponse, at = T2) => reduceFeed(INITIAL_FEED, { type: 'response', body, at, generation: ++gen });
type Ungenerated<E> = E extends { generation: number } ? Omit<E, 'generation'> : never;
const next = (prev: FeedState, event: Ungenerated<FeedEvent>, generation = prev.generation + 1) =>
  reduceFeed(prev, { ...event, generation } as FeedEvent);

describe('dossier grouping', () => {
  it('separates ownership, operator, finance, role and physical relationships', () => {
    const g = groupPublication(PUBLICATION);
    expect(g.ownership.map((r) => [r.holder, r.share])).toEqual([['CITIC Metal Co. Ltd.', '15 %']]);
    expect(g.operators[0].operator).toBe('Minera Las Bambas S.A.C.');
    expect(g.finance[0]).toMatchObject({ lender: 'Album Enterprises Limited', nominal: 'USD 350,000,000', year: '2022', loanEvent: 'loan_event:f01:7296' });
    expect(g.finance[0].loanEventLabel).toBe('Album Enterprises USD 350m loan to Minera Las Bambas');
    expect(g.roles[0]).toMatchObject({ role: 'Funding_Agencies', rows: '1' });
    expect(g.physical).toEqual([]);
    expect(g.routeGaps.map((x) => x.kind).sort()).toEqual(['document_unverified', 'route_unpublished']);
    expect(g.loanEvents).toHaveLength(1);
  });

  it('keeps unknown values unknown and drops unknown predicates rather than guessing', () => {
    const pub = {
      ...PUBLICATION,
      edges: [
        { ...PUBLICATION.edges[0], value: {}, temporal: null },
        { ...PUBLICATION.edges[1], id: 'x', predicate: 'ships_via' as never },
      ],
    };
    const g = groupPublication(pub);
    expect(g.ownership[0]).toMatchObject({ share: 'unknown', holderType: 'unknown', asOf: 'unknown' });
    expect(g.finance).toEqual([]);
    expect(g.physical).toEqual([]);
  });

  it('describes the initial publication as having no qualifying changes', () => {
    expect(describeChange(PUBLICATION)).toMatch(/no qualifying changes in reviewed evidence/i);
    expect(describeChange({ ...PUBLICATION, what_changed: { kind: 'revision', previous_publication_no: 1, edges_added: ['a'], edges_removed: [], edges_reversioned: ['b'] } }))
      .toBe('Revision of publication 1: 1 added, 0 removed, 1 reversioned relationship(s).');
  });
});

describe('DossierView', () => {
  it('labels retained real evidence, preserves fixture warnings, and displays missing values honestly', () => {
    const real = structuredClone(AVAILABLE);
    real.origin = 'retained_source';
    real.evidence_origins = ['retained_source'];
    const pub = real.publication!;
    pub.evidence_manifest.forEach((m) => {
      if (m.kind === 'structured_record') m.record_origin = 'retained_source';
    });
    pub.narrative = ['A debt rescheduling commitment of USD None (nominal).'];
    pub.gap_register = [{ kind: 'context_withheld', detail: 'a restricted-source context input exists but is not part of this projection', key: null, count: null }];
    const finance = pub.edges.find((e) => e.predicate === 'finances')!;
    finance.value!.amount_nominal_usd_native = null;
    const html = render(fed(real), T2);
    expect(html).toContain('RETAINED REAL-SOURCE EVIDENCE');
    expect(html).not.toContain('REPLAY DEMONSTRATION');
    expect(html).not.toContain('synthetic');
    expect(html).toContain('No additional context is included in this publication.');
    expect(html).not.toContain('context input exists');
    expect(html).toContain('Not reported');
    expect(html).not.toContain('USD None');
    expect(pub.narrative[0]).toContain('USD None'); // original evidence unchanged
    expect(formatUsd('0')).toBe('USD 0');
    expect(formatUsd(null)).toBe('Not reported');
    expect(displayNarrative('USD 350000000 (nominal)')).toBe('USD 350000000 (nominal)');
    real.evidence_origins.push('replay_fixture');
    expect(render(fed(real), T2)).toContain('REPLAY DEMONSTRATION');
  });
  it('renders an available dossier with replay banner, separate sections, currentness and gaps', () => {
    const html = render(fed(AVAILABLE), T2);
    expect(attr(html, 'data-view-state')).toBe('available');
    expect(html).toContain('data-banner="replay"');
    expect(html).toContain('REPLAY DEMONSTRATION');
    for (const s of ['schematic', 'physical', 'ownership', 'operators', 'finance', 'roles', 'gaps', 'currentness', 'what-changed']) {
      expect(html).toContain(`data-section="${s}"`);
    }
    expect(html).toContain('GAP — not published.');
    expect(html).toContain('data-gap-kind="route_unpublished"');
    expect(html).toContain('data-gap-kind="document_unverified"');
    expect(html).toContain('no qualifying changes in reviewed evidence');
    expect(html).toContain('USD 350,000,000');
    expect(html).toContain('15 %');
    expect(html).toContain('data-predicate="holds_role_in"');
    expect(html).toContain('2026-09-22 00:00:01Z');
    expect(html).not.toContain('id="evidence-drawer"');
  });

  it('opens the evidence drawer for a selected edge with manifest records only', () => {
    const html = render(fed(AVAILABLE), T2, 'edge-fin-1');
    expect(html).toContain('id="evidence-drawer"');
    expect(html).toContain('data-selected-edge="edge-fin-1"');
    expect(html).toContain('aiddata_financial_contributions');
    expect(html).toContain('aiddata_loan_events');
    expect(html).toContain('AidData_Record_ID');
    expect(html).toContain('payload sha256 bbbb');
    expect(html).toContain('commitment');
    expect(html).toContain('payment, disbursement, outstanding_balance');
    expect(html).toContain('currentness current');
    expect(html.match(/data-evidence-kind="structured_record"/g)).toHaveLength(2);
  });

  it('reports an evidence reference missing from the manifest instead of inventing it', () => {
    const body: DossierResponse = {
      ...AVAILABLE,
      publication: { ...PUBLICATION, evidence_manifest: PUBLICATION.evidence_manifest.filter((m) => m.ref !== REC_FIN) },
    };
    const html = render(fed(body), T2, 'edge-fin-1');
    expect(html).toContain('1 evidence reference(s) are not in the publication manifest');
    expect(html.match(/data-evidence-kind="structured_record"/g)).toHaveLength(1);
  });

  it('renders sidecar stale (failed refresh after success) with the retained publication and both timestamps', () => {
    const html = render(fed(STALE_FAILED), T2);
    expect(attr(html, 'data-view-state')).toBe('stale');
    expect(attr(html, 'data-stale-origin')).toBe('server');
    expect(html).toContain('latest attempt failed');
    expect(html).toContain('The latest refresh attempt failed');
    expect(html).toContain('data-section="finance"');
    expect(html).toContain('2026-09-22 06:00:00Z');
    expect(html).toContain('2026-09-22 00:00:01Z');
  });

  it('withdrawal after availability removes the dossier body and serves nothing from history', () => {
    let feed = fed(AVAILABLE);
    feed = next(feed, { type: 'response', body: stateOnly('withdrawn', 'eligibility_withdrawn'), at: plus(60) });
    const html = render(feed, plus(60));
    expect(attr(html, 'data-view-state')).toBe('withdrawn');
    expect(html).toContain('history is not served as current');
    expect(html).not.toContain('data-section="finance"');
    expect(html).not.toContain('USD 350,000,000');
    expect(html).toContain('eligibility_withdrawn');
  });

  it.each([
    ['not_published', 'no_publication', 'No prospect publication has been produced'],
    ['unavailable', 'publication_missing', 'pointed-to publication file is missing'],
    ['unavailable', 'feature_disabled', 'GIDEON_DOSSIER_ENABLED=0'],
  ] as const)('renders %s/%s as state-only', (state, reason, text) => {
    const html = render(fed(stateOnly(state, reason)), T2);
    expect(attr(html, 'data-view-state')).toBe(state);
    expect(html).toContain(text);
    expect(html).not.toContain('data-section="ownership"');
  });

  it('renders a degraded proxy answer as unavailable even if it echoes a publication', () => {
    const html = render(fed({ ...AVAILABLE, degraded: true }), T2);
    expect(attr(html, 'data-view-state')).toBe('unavailable');
    expect(html).not.toContain('data-section="ownership"');
  });

  it('browser fetch failure after a good payload is state-only unavailable: no claims from history', () => {
    const feed = next(fed(AVAILABLE), { type: 'failure', reason: 'browser_fetch_failed', at: plus(30) });
    const html = render(feed, plus(30));
    expect(attr(html, 'data-view-state')).toBe('unavailable');
    expect(attr(html, 'data-stale-origin')).toBeNull();
    expect(html).not.toContain('data-section="finance"');
    expect(html).not.toContain('USD 350,000,000');
    expect(html).toContain('browser_fetch_failed');
    expect(html).toContain('nothing is served from history');
    expect(feed.body).toBeNull();
  });

  it('browser timeout is unavailable with the timeout reason, then recovers only on a new successful answer', () => {
    let feed = next(fed(AVAILABLE), { type: 'failure', reason: 'browser_fetch_timeout', at: plus(30) });
    let html = render(feed);
    expect(attr(html, 'data-view-state')).toBe('unavailable');
    expect(html).toContain('browser_fetch_timeout');
    // another failure keeps it unavailable
    feed = next(feed, { type: 'failure', reason: 'browser_response_malformed', at: plus(60) });
    expect(attr(render(feed), 'data-view-state')).toBe('unavailable');
    // recovery requires a fresh server answer
    feed = next(feed, { type: 'response', body: AVAILABLE, at: plus(90) });
    html = render(feed);
    expect(attr(html, 'data-view-state')).toBe('available');
    expect(html).toContain('data-section="finance"');
  });

  it('a late older available answer cannot overwrite a newer withdrawal (generation guard)', () => {
    let feed = fed(AVAILABLE);
    const g0 = feed.generation;
    feed = next(feed, { type: 'response', body: stateOnly('withdrawn', 'eligibility_withdrawn'), at: plus(60) }, g0 + 2);
    const late = next(feed, { type: 'response', body: AVAILABLE, at: plus(61) }, g0 + 1);
    expect(late).toBe(feed);
    expect(attr(render(late), 'data-view-state')).toBe('withdrawn');
    // and an older failure cannot clear a newer good answer either
    const good = next(feed, { type: 'response', body: AVAILABLE, at: plus(120) }, g0 + 3);
    const staleFailure = next(good, { type: 'failure', reason: 'browser_fetch_failed', at: plus(121) }, g0 + 2);
    expect(staleFailure).toBe(good);
    expect(attr(render(staleFailure), 'data-view-state')).toBe('available');
  });

  it('out-of-order responses: the newest generation wins regardless of arrival order', () => {
    let feed = fed(AVAILABLE);
    const g0 = feed.generation;
    feed = next(feed, { type: 'response', body: STALE_FAILED, at: plus(30) }, g0 + 2);
    feed = next(feed, { type: 'response', body: AVAILABLE, at: plus(31) }, g0 + 1);
    expect(feed.body?.state).toBe('stale');
    feed = next(feed, { type: 'response', body: stateOnly('unavailable', 'publication_missing'), at: plus(40) }, g0 + 3);
    expect(attr(render(feed), 'data-view-state')).toBe('unavailable');
  });

  it('server-confirmed stale is preserved; browsers never originate stale', () => {
    const feed = fed(STALE_FAILED);
    const r = resolveView(feed);
    expect(r.view).toBe('stale');
    expect(r.staleOrigin).toBe('server');
    expect(resolveView(next(feed, { type: 'failure', reason: 'browser_fetch_failed', at: plus(5) }))).toEqual({ view: 'unavailable', staleOrigin: null, body: null });
  });

  it('a retained withdrawn body is never re-rendered as data on browser failure', () => {
    const feed = next(fed(stateOnly('withdrawn', 'eligibility_withdrawn')), { type: 'failure', reason: 'browser_fetch_failed', at: plus(30) });
    expect(attr(render(feed, plus(30)), 'data-view-state')).toBe('unavailable');
  });

  it('labels that automatic refresh is not configured and polling does not refresh evidence', () => {
    for (const feed of [fed(AVAILABLE), fed(stateOnly('withdrawn', 'eligibility_withdrawn')), INITIAL_FEED]) {
      const html = render(feed);
      expect(html).toContain('data-banner="refresh-not-configured"');
      expect(html).toContain('Automatic dossier refresh is not configured');
      expect(html).toContain('polling does not refresh source evidence');
    }
  });

  it('never renders port aggregates or restricted-source tokens', () => {
    const docEdge = AVAILABLE_DOCUMENT.publication!.edges.find((e) => e.predicate === 'transports_to')!;
    for (const html of [render(fed(AVAILABLE), T2, 'edge-fin-1'), render(fed(AVAILABLE_DOCUMENT), T2, docEdge.id)]) {
      const lower = html.toLowerCase();
      for (const token of ['mds03', 'portwatch', 'pw-01', 'portcalls', 'iclac', 'redalc', 'quotation_verified_by', 'orchestrator']) {
        expect(lower).not.toContain(token);
      }
    }
  });
});

describe('accepted verified-document publication (engine-generated fixture, API → UI)', () => {
  const pub = AVAILABLE_DOCUMENT.publication!;

  it('is the pinned Fusion projection of the gideon-database available_document fixture', () => {
    const digest = createHash('sha256').update(canonical(pub)).digest('hex');
    expect(digest).toBe(PIN.projection_sha256_available_document);
    expect(AVAILABLE_DOCUMENT.schema_version).toBe('e2-dossier/1.0');
    expect(AVAILABLE_DOCUMENT.state).toBe('available');
    expect(AVAILABLE_DOCUMENT.evidence_origins).toEqual(['replay_fixture', 'verified_document']);
    expect(pub.publication_no).toBe(2);
  });

  it('groups transports_to / reported_event_affects with document entity kinds and closed references', () => {
    const g = groupPublication(pub);
    expect(g.physical.map((r) => [r.from, r.to, r.commodity, r.mode])).toEqual([
      ['Las Bambas Copper Mine', 'Pillones transfer station (reported)', 'copper concentrate', 'road'],
      ['Pillones transfer station (reported)', 'Matarani (PE MRI)', 'copper concentrate', 'rail'],
    ]);
    expect(g.reportedEvents.map((r) => [r.event, r.affects, r.kind])).toEqual([
      ['Reported southern-corridor road blockades', 'Pillones transfer station (reported)', 'reported_disruption'],
    ]);
    const kinds = new Set(pub.entities.map((e) => e.kind));
    expect(kinds.has('logistics_facility')).toBe(true);
    expect(kinds.has('reported_event')).toBe(true);
    for (const e of pub.entities.filter((x) => x.sources.includes('DOC'))) expect(e.resolution).toBe('as_named_in_document');
    const ids = new Set(pub.entities.map((e) => e.id));
    const refs = new Set(pub.evidence_manifest.map((m) => m.ref));
    for (const e of pub.edges) {
      expect(ids.has(e.subject)).toBe(true);
      expect(ids.has(e.object)).toBe(true);
      for (const r of e.evidence) expect(refs.has(r)).toBe(true);
    }
    expect(g.routeGaps).toEqual([]);
  });

  it('renders the route as document-reported links and opens the drawer on a document_locator without throwing', () => {
    const edge = pub.edges.find((e) => e.predicate === 'transports_to')!;
    let html = '';
    expect(() => { html = render(fed(AVAILABLE_DOCUMENT), T2, edge.id); }).not.toThrow();
    expect(attr(html, 'data-view-state')).toBe('available');
    expect(html).toContain('data-section="transports"');
    expect(html).toContain('data-section="reported-events"');
    expect(html).not.toContain('GAP — not published.');
    expect(html).toContain('not observed movement');
    expect(html).toContain('id="evidence-drawer"');
    expect(html).toContain('data-evidence-kind="document_locator"');
    expect(html).toContain('quotation_verified');
    expect(html).toContain('mmg-las-bambas-operation-page');
    expect(html).toContain('web_page · section “operation overview / logistics”');
    expect(html).toContain('href="https://www.mmg.com/our-business/las-bambas/"');
    expect(html).toContain(`document sha256 ${'b'.repeat(64)}`);
    expect(html).toContain('quotation verified 2026-09-21 09:00:00Z');
    expect(html).toContain('scope: commodity=copper concentrate · mode=road');
    expect(html).toContain('Quoted text is not redistributed');
  });

  it('opens every edge of the document publication without throwing', () => {
    const feed = fed(AVAILABLE_DOCUMENT);
    for (const e of pub.edges) expect(() => render(feed, T2, e.id)).not.toThrow();
  });

  it('renders locators as text and links only http(s) URLs', () => {
    expect(formatLocator({ kind: 'pdf', page: null, section: null })).toBe('pdf');
    expect(formatLocator({ kind: 'pdf', page: 12, section: 'Annex B' })).toBe('pdf · page 12 · section “Annex B”');
    expect(formatLocator(null)).toBe('locator unknown');
    expect(formatLocator(undefined)).toBe('locator unknown');
    expect(safeHttpUrl('https://example.org/x')).toBe('https://example.org/x');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('file:///etc/passwd')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();

    const edge = pub.edges.find((e) => e.predicate === 'reported_event_affects')!;
    const manifest = pub.evidence_manifest.map((m) =>
      m.kind === 'document_locator' && m.ref === edge.evidence[0]
        ? { ...m, url: 'javascript:alert(1)', locator: null }
        : m,
    );
    const html = render(fed({ ...AVAILABLE_DOCUMENT, publication: { ...pub, evidence_manifest: manifest } }), T2, edge.id);
    expect(html).not.toContain('javascript:');
    expect(html).toContain('no public URL');
    expect(html).toContain('locator unknown');
  });
});

describe('isDossierResponse (bounded render-contract guard)', () => {
  it('accepts every well-formed shape the sidecar emits, including the engine-generated document fixture', () => {
    expect(isDossierResponse(AVAILABLE)).toBe(true);
    expect(isDossierResponse(STALE_FAILED)).toBe(true);
    expect(isDossierResponse(AVAILABLE_DOCUMENT)).toBe(true);
    expect(isDossierResponse(stateOnly('not_published', 'no_publication'))).toBe(true);
    expect(isDossierResponse({ ...stateOnly('unavailable', 'sidecar_unreachable'), degraded: true })).toBe(true);
    // withdrawn/not_published carry a currentness object with a null publication_no
    expect(isDossierResponse({
      ...stateOnly('withdrawn', 'eligibility_withdrawn'),
      currentness: { publication_no: null, eligibility_established_at: null, eligibility_changed_at: T2, restored: false, latest_attempt: AVAILABLE.currentness!.latest_attempt, last_successful_refresh: null },
    })).toBe(true);
  });

  it('rejects claim-bearing bodies whose render contract is broken, and state-only bodies carrying a publication', () => {
    const pub = AVAILABLE.publication!;
    expect(isDossierResponse({ ...AVAILABLE, publication: {} })).toBe(false);
    expect(isDossierResponse({ ...AVAILABLE, publication: { ...pub, entities: undefined } })).toBe(false);
    expect(isDossierResponse({ ...AVAILABLE, publication: { ...pub, assertions: {} } })).toBe(false);
    expect(isDossierResponse({ ...AVAILABLE, publication: { ...pub, edges: [{ ...pub.edges[0], subject: 7 }] } })).toBe(false);
    expect(isDossierResponse({ ...AVAILABLE, publication: { ...pub, edges: [{ ...pub.edges[0], evidence: ['ok', 3] }] } })).toBe(false);
    expect(isDossierResponse({ ...AVAILABLE, publication: { ...pub, evidence_manifest: [{ ...pub.evidence_manifest[0], native_key: 'k=v' }] } })).toBe(false);
    expect(isDossierResponse({ ...AVAILABLE, publication: { ...pub, attribution: [{ source_id: 'F01' }] } })).toBe(false);
    expect(isDossierResponse({ ...AVAILABLE, currentness: { ...AVAILABLE.currentness, latest_attempt: 'done' } })).toBe(false);
    expect(isDossierResponse({ ...AVAILABLE, currentness: { ...AVAILABLE.currentness, publication_no: null } })).toBe(false);
    expect(isDossierResponse({ ...STALE_FAILED, publication: {} })).toBe(false);
    expect(isDossierResponse({ ...stateOnly('withdrawn', 'eligibility_withdrawn'), publication: pub })).toBe(false);
    expect(isDossierResponse({ ...AVAILABLE, evidence_origins: 'replay' })).toBe(false);
    expect(isDossierResponse(null)).toBe(false);
    expect(isDossierResponse([])).toBe(false);
  });
});

describe('fetchDossierOnce (bounded browser request)', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('requests the literal proxy path with no-store and returns a response event carrying its generation', async () => {
    const f = vi.fn().mockResolvedValue(json(AVAILABLE));
    const ev = await fetchDossierOnce(7, f as unknown as typeof fetch);
    expect(ev).toMatchObject({ type: 'response', generation: 7 });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(PROXY_PATH);
    expect(url).toBe('/api/fusion/dossiers/las-bambas-matarani');
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps a network failure to browser_fetch_failed (never rejects)', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchDossierOnce(1, f as unknown as typeof fetch)).toMatchObject({ type: 'failure', reason: 'browser_fetch_failed', generation: 1 });
  });

  it('aborts a hung request at the deadline and reports browser_fetch_timeout', async () => {
    const f = vi.fn((_: string, init?: RequestInit) => new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const ev = await fetchDossierOnce(2, f as unknown as typeof fetch, 20);
    expect(ev).toMatchObject({ type: 'failure', reason: 'browser_fetch_timeout', generation: 2 });
  });

  it('maps a non-JSON or foreign body to browser_response_malformed', async () => {
    const f = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }));
    expect(await fetchDossierOnce(3, f as unknown as typeof fetch)).toMatchObject({ type: 'failure', reason: 'browser_response_malformed' });
    const g = vi.fn().mockResolvedValue(json({ hello: 'world' }));
    expect(await fetchDossierOnce(4, g as unknown as typeof fetch)).toMatchObject({ type: 'failure', reason: 'browser_response_malformed' });
  });

  it('R6: available -> structurally malformed claim (publication: {}) -> unavailable with no claims -> recovery only on a newer valid answer', async () => {
    const malformed = { ...AVAILABLE, publication: {} };
    // Precondition: the defect is real — this body reaches render code only via the generic error boundary.
    expect(() => render(fed(malformed as unknown as DossierResponse))).toThrow();

    const f = vi.fn()
      .mockResolvedValueOnce(json(AVAILABLE))
      .mockResolvedValueOnce(json(malformed))
      .mockResolvedValueOnce(json({ ...AVAILABLE, currentness: { publication_no: 1 } }))
      .mockResolvedValueOnce(json(AVAILABLE));
    const fetchImpl = f as unknown as typeof fetch;

    let feed = reduceFeed(INITIAL_FEED, await fetchDossierOnce(1, fetchImpl));
    let html = render(feed);
    expect(attr(html, 'data-view-state')).toBe('available');
    expect(html).toContain('data-section="finance"');

    const bad = await fetchDossierOnce(2, fetchImpl);
    expect(bad).toMatchObject({ type: 'failure', reason: 'browser_response_malformed', generation: 2 });
    feed = reduceFeed(feed, bad);
    expect(feed.body).toBeNull();
    html = render(feed);
    expect(attr(html, 'data-view-state')).toBe('unavailable');
    expect(attr(html, 'data-stale-origin')).toBeNull();
    expect(html).toContain('browser_response_malformed');
    expect(html).not.toContain('data-section="finance"');
    expect(html).not.toContain('USD 350,000,000');

    // a second malformed shape (bad currentness) keeps it unavailable
    feed = reduceFeed(feed, await fetchDossierOnce(3, fetchImpl));
    expect(attr(render(feed), 'data-view-state')).toBe('unavailable');

    // a late (older-generation) valid answer cannot recover it
    feed = reduceFeed(feed, { type: 'response', body: AVAILABLE, at: plus(1), generation: 1 });
    expect(attr(render(feed), 'data-view-state')).toBe('unavailable');

    // recovery: newer structurally valid success
    feed = reduceFeed(feed, await fetchDossierOnce(4, fetchImpl));
    html = render(feed);
    expect(attr(html, 'data-view-state')).toBe('available');
    expect(html).toContain('data-section="finance"');
  });

  it('a 503 state-only proxy answer is a response event (server authority), rendered unavailable', async () => {
    const f = vi.fn().mockResolvedValue(json(stateOnly('unavailable', 'sidecar_unreachable'), 503));
    const ev = await fetchDossierOnce(5, f as unknown as typeof fetch);
    expect(ev.type).toBe('response');
    const feed = reduceFeed(fed(AVAILABLE), { ...ev, generation: 99 });
    expect(attr(render(feed), 'data-view-state')).toBe('unavailable');
    expect(feed.body?.publication).toBeNull();
  });
});

describe('E3A: operating baseline (C1), declared public-safe gaps (C2), required-segment route gaps (C3)', () => {
  const base = AVAILABLE_DOCUMENT.publication!;
  const doc = base.edges.find((e) => e.predicate === 'transports_to')!;
  const mine = doc.subject;
  const reporter = base.edges.find((e) => e.predicate === 'operates')?.subject ?? doc.subject;

  /** Test-local E3A shape on top of the engine fixture: a replay demonstration, not a real metric. */
  const withE3A = (edges: typeof base.edges, gaps: typeof base.gap_register): DossierResponse => ({
    ...AVAILABLE_DOCUMENT,
    publication: {
      ...base,
      edges: [...base.edges, ...edges],
      assertions: [
        ...base.assertions,
        ...edges.map((e) => ({ id: e.id, version: e.version, predicate: e.predicate, evidence_category: e.evidence_category, currentness: 'unknown' as const, confidence: null })),
      ],
      gap_register: [...base.gap_register, ...gaps],
    },
  });
  const metric = (id: string, value: Record<string, unknown>, temporal: Record<string, unknown>) => ({
    id, version: 1, predicate: 'reports_operating_metric' as const, subject: reporter, object: mine,
    evidence_category: 'reported', evidence: doc.evidence, value, temporal, scope: null, correction: null,
  });
  const production = metric('edge-op-prod', { metric: 'production', product: 'copper_contained', quantity: '410834', unit: 'tonnes', basis: 'actual' },
    { period_start: '2025-01-01', period_end: '2025-12-31', document_published_at: '2026-04-21' });
  const guidance = metric('edge-op-guid', { metric: 'guidance', product: 'copper_contained', quantity: '380000-400000', unit: 'tonnes', basis: 'guidance' },
    { period_start: '2026-01-01', period_end: '2026-12-31', document_published_at: null });
  const share = metric('edge-op-share', { metric: 'cargo_share', product: 'terminal_cargo', quantity: '17.7', unit: 'percent', basis: 'reported_share' },
    { period_start: null, period_end: '2025-12-31', document_published_at: null });
  const unquantified = metric('edge-op-cap', { metric: 'capacity', product: 'copper_concentrate', quantity: null, unit: null, basis: 'design' },
    { period_start: '2025-01-01', period_end: null, document_published_at: null });

  it('groups reports_operating_metric rows with products and bases kept distinct, never converted', () => {
    const g = groupPublication(withE3A([production, guidance, share, unquantified], []).publication!);
    expect(g.operating.map((r) => [r.metric, r.quantity, r.product, r.basis, r.period, r.documentDate])).toEqual([
      ['production', '410834 t', 'copper contained in concentrate (metal, not concentrate mass)', 'actual figure', '2025-01-01 → 2025-12-31', '2026-04-21'],
      ['guidance', '380000-400000 t', 'copper contained in concentrate (metal, not concentrate mass)', 'forward guidance, not actual output', '2026-01-01 → 2026-12-31', 'not established'],
      ['cargo_share', '17.7 %', 'terminal cargo', 'reported share, not a movement count', 'to 2025-12-31', 'not established'],
      ['capacity', 'Not published', 'copper concentrate (gross concentrate mass)', 'design/nameplate capacity, not actual output', 'from 2025-01-01', 'not established'],
    ]);
    // the operating edge never leaks into the physical route family
    expect(g.physical).toHaveLength(2);
    expect(g.reportedEvents).toHaveLength(1);
  });

  it('renders the operating baseline table and opens its evidence drawer (document_locator) without throwing', () => {
    const body = withE3A([production, guidance], []);
    expect(isDossierResponse(body)).toBe(true);
    let html = '';
    expect(() => { html = render(fed(body), T2, 'edge-op-prod'); }).not.toThrow();
    expect(html).toContain('data-section="operating"');
    expect(html).toContain('data-predicate="reports_operating_metric"');
    expect(html).toContain('410834 t');
    expect(html).toContain('metal, not concentrate mass');
    expect(html).toContain('forward guidance, not actual output');
    expect(html).toContain('data-selected-edge="edge-op-prod"');
    expect(html).toContain('data-evidence-kind="document_locator"');
    expect(html).toContain('Quoted text is not redistributed');
  });

  it('states that no operating figure is published rather than showing zero', () => {
    const html = render(fed(AVAILABLE_DOCUMENT), T2);
    expect(html).toContain('data-section="operating"');
    expect(html).toContain('No published operating figures');
    expect(html).not.toContain('data-predicate="reports_operating_metric"');
  });

  it('shows the five E3A declared gap kinds explicitly, keyed, and counts declared unknowns', () => {
    const gaps = [
      { kind: 'offtake_unknown', key: 'offtake', detail: 'Offtake counterparties are not published in the retained sources.', count: null },
      { kind: 'recovery_unknown', key: 'recovery', detail: 'Recovery paths after a disruption are not published.', count: null },
      { kind: 'alternatives_unknown', key: 'alternatives', detail: 'Alternative export routes are not evidenced.', count: null },
      { kind: 'baseline_currentness', key: 'baseline-2025', detail: 'The operating baseline is a 2025 annual figure and may not reflect current output.', count: null },
      { kind: 'segment_unevidenced', key: 'pillones->matarani', detail: 'No accepted primary evidence for the Pillones–Matarani rail segment.', count: null },
    ];
    const body = withE3A([], gaps);
    expect(isDossierResponse(body)).toBe(true);
    const g = groupPublication(body.publication!);
    expect(g.declaredUnknowns.map((x) => x.kind)).toEqual(['offtake_unknown', 'recovery_unknown', 'alternatives_unknown', 'baseline_currentness']);
    expect(g.routeGaps.map((x) => x.kind)).toEqual(['segment_unevidenced']);
    const html = render(fed(body), T2);
    for (const gap of gaps) {
      expect(html).toContain(`data-gap-kind="${gap.kind}"`);
      expect(html).toContain(`data-gap-key="${gap.key.replaceAll('>', '&gt;')}"`);
      expect(html).toContain(gap.detail);
    }
    expect(html).toContain('data-section="declared-unknowns"');
    expect(html).toContain('4 declared unknown(s)');
  });

  it('C3: one transport edge never clears the route gap; the missing segment stays named in the schematic', () => {
    const rail = base.edges.find((e) => e.predicate === 'transports_to' && e.scope?.mode === 'rail')!;
    const partial: DossierResponse = {
      ...AVAILABLE_DOCUMENT,
      publication: {
        ...base,
        edges: base.edges.filter((e) => e.id !== rail.id),
        assertions: base.assertions.filter((a) => a.id !== rail.id),
        gap_register: [
          ...base.gap_register,
          { kind: 'route_unpublished', key: null, detail: 'Required segment pillones->matarani is not evidenced; the route is not published.', count: null },
          { kind: 'segment_unevidenced', key: 'pillones->matarani', detail: 'Pillones -> Matarani (rail) has no accepted verified evidence.', count: null },
        ],
      },
    };
    expect(isDossierResponse(partial)).toBe(true);
    const g = groupPublication(partial.publication!);
    expect(g.physical).toHaveLength(1);
    expect(g.routeGaps.map((x) => x.kind).sort()).toEqual(['route_unpublished', 'segment_unevidenced']);
    const html = render(fed(partial), T2);
    expect(html).toContain('GAP — not published.');
    expect(html).toContain('data-section="segments"');
    expect(html).toContain('data-segment="pillones-&gt;matarani"');
    expect(html).toContain('segment pillones-&gt;matarani: unevidenced');
    // the single accepted road link is still listed as a reported link, not as a route
    expect(html).toContain('data-section="transports"');
    expect(html.match(/data-predicate="transports_to"/g)).toHaveLength(1);
  });

  it('withdrawal of the rail edge after a complete route restores the segment gap (route → gap, no history)', () => {
    const complete = render(fed(AVAILABLE_DOCUMENT), T2);
    expect(complete).not.toContain('GAP — not published.');
    expect(complete).not.toContain('data-section="segments"');
    const rail = base.edges.find((e) => e.predicate === 'transports_to' && e.scope?.mode === 'rail')!;
    const after: DossierResponse = {
      ...AVAILABLE_DOCUMENT,
      publication: {
        ...base,
        publication_no: 3,
        what_changed: { kind: 'revision', previous_publication_no: 2, edges_added: [], edges_removed: [rail.id], edges_reversioned: [] },
        edges: base.edges.filter((e) => e.id !== rail.id),
        assertions: base.assertions.filter((a) => a.id !== rail.id),
        gap_register: [
          ...base.gap_register,
          { kind: 'route_unpublished', key: null, detail: 'Required segment pillones->matarani is not evidenced.', count: null },
          { kind: 'segment_unevidenced', key: 'pillones->matarani', detail: 'Pillones -> Matarani (rail) has no accepted verified evidence.', count: null },
        ],
      },
      currentness: { ...AVAILABLE_DOCUMENT.currentness!, publication_no: 3 },
    };
    const feed = next(fed(AVAILABLE_DOCUMENT), { type: 'response', body: after, at: plus(60) });
    const html = render(feed, plus(60));
    expect(html).toContain('GAP — not published.');
    expect(html).toContain('data-segment="pillones-&gt;matarani"');
    expect(html).toContain('0 added, 1 removed');
    expect(html.match(/data-predicate="transports_to"/g)).toHaveLength(1);
  });
});
