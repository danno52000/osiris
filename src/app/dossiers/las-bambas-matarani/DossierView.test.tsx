/**
 * Render/state regressions for the E2 dossier page, rendered with react-dom/server.
 * Test bodies are small hand-built e2-dossier/1.0 payloads; their counts are test
 * counts, not fixture or hosted counts.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  INITIAL_FEED,
  RETAINED_MAX_AGE_S,
  describeChange,
  groupPublication,
  reduceFeed,
  resolveView,
  type DossierResponse,
  type FeedState,
} from '@/lib/dossier';
import { AVAILABLE, PUBLICATION, REC_FIN, STALE_FAILED, T2, stateOnly } from '@/lib/dossier.test-fixture';
import { DossierView } from './DossierView';

const plus = (s: number) => new Date(Date.parse(T2) + s * 1000).toISOString();

function render(feed: FeedState, nowIso: string, selectedEdgeId: string | null = null): string {
  return renderToStaticMarkup(
    <DossierView feed={feed} resolved={resolveView(feed, nowIso)} selectedEdgeId={selectedEdgeId} onSelectEdge={() => undefined} />,
  );
}

function attr(html: string, name: string): string | null {
  const m = html.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

const fed = (body: DossierResponse, at = T2) => reduceFeed(INITIAL_FEED, { type: 'response', body, at });

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
    feed = reduceFeed(feed, { type: 'response', body: stateOnly('withdrawn', 'eligibility_withdrawn'), at: plus(60) });
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

  it('browser fetch failure after a good payload shows stale-from-browser, then unavailable past the limit', () => {
    const feed = reduceFeed(fed(AVAILABLE), { type: 'failure', message: 'Failed to fetch', at: plus(30) });
    let html = render(feed, plus(30));
    expect(attr(html, 'data-view-state')).toBe('stale');
    expect(attr(html, 'data-stale-origin')).toBe('browser');
    expect(html).toContain('Not fresh');
    expect(html).toContain('data-section="finance"');

    html = render(feed, plus(RETAINED_MAX_AGE_S + 1));
    expect(attr(html, 'data-view-state')).toBe('unavailable');
    expect(html).not.toContain('data-section="finance"');
  });

  it('a retained withdrawn body is never re-rendered as data on browser failure', () => {
    const feed = reduceFeed(fed(stateOnly('withdrawn', 'eligibility_withdrawn')), { type: 'failure', message: 'Failed to fetch', at: plus(30) });
    expect(attr(render(feed, plus(30)), 'data-view-state')).toBe('unavailable');
  });

  it('never renders port aggregates or restricted-source tokens', () => {
    const html = render(fed(AVAILABLE), T2, 'edge-fin-1').toLowerCase();
    for (const token of ['mds03', 'portwatch', 'pw-01', 'portcalls', 'iclac', 'redalc']) {
      expect(html).not.toContain(token);
    }
  });
});
