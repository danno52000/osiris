/** Render regressions for the E7 analyst pyramid (react-dom/server) plus drawer / full-page / report integration. */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AN_BASELINE_LABEL, INITIAL_AN_FEED, reduceAnFeed, resolveAn, anUnavailableResponse, type AnFeedState, type AnResponse } from '@/lib/analyst';
import { FIXTURE_CARD_IDS, FIXTURE_DRAFTS, FIXTURE_PUBLISHED, FIXTURE_UPDATE_FAILED, FIXTURE_WITHDRAWN, stateOnly } from '@/lib/analyst.test-fixture';
import { AnalystView } from './AnalystView';
import SupplyChainDossiersPanel from './SupplyChainDossiersPanel';
import { DossierView } from '@/app/dossiers/las-bambas-matarani/DossierView';
import AnalystReportClient from '@/app/dossiers/[dossierId]/analyst/AnalystReportClient';
import { INITIAL_FEED, resolveView } from '@/lib/dossier';
import { INITIAL_GEO_FEED, resolveGeo } from '@/lib/geography';
import { INITIAL_UW_FEED, resolveUw } from '@/lib/underwriting';

const LB = 'las-bambas-matarani';
function feedOf(body: AnResponse | null, failure?: 'browser_fetch_timeout' | 'browser_fetch_failed'): AnFeedState {
  if (failure) return reduceAnFeed(INITIAL_AN_FEED, { type: 'failure', reason: failure, at: 't', generation: 1 });
  if (!body) return INITIAL_AN_FEED;
  return reduceAnFeed(INITIAL_AN_FEED, { type: 'response', body, at: 't', generation: 1 });
}
function render(feed: AnFeedState, compact = false, dossierId = LB): string {
  return renderToStaticMarkup(<AnalystView dossierId={dossierId} feed={feed} resolved={resolveAn(feed)} compact={compact} linkToReport />);
}
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const STRESS = [
  'Conditional magnitude 3, assuming major impairment for 7 days',
  'Conditional magnitude 4, assuming major impairment for 21 days',
  'Conditional magnitude 2–3, assuming partial to major impairment for 3 days',
  'Conditional magnitude 5, assuming essential-function impairment for 45 days',
];

describe('AnalystView (published fixture)', () => {
  it('pyramid default-visible: takeaway, exactly three collapsed cards, conditions and magnitude labels before any click', () => {
    for (const compact of [true, false]) {
      const html = render(feedOf(FIXTURE_PUBLISHED), compact);
      expect(html).toContain('data-analyst-state="available"');
      expect(html).toContain('data-field="takeaway"');
      expect(count(html, /data-analyst-card="/g)).toBe(3);
      for (const id of FIXTURE_CARD_IDS) expect(html).toContain(`id="analyst-${id}" data-analyst-card="${id}"`);
      expect(count(html, /data-expanded="false"/g)).toBe(3);
      expect(html).not.toContain('data-card-detail=');
      // qualitative conditions visible on every collapsed card, no attack-difficulty axis
      expect(count(html, /data-field="conditions"/g)).toBe(3);
      expect(count(html, /data-condition-frame="/g)).toBeGreaterThanOrEqual(9);
      expect(html).not.toMatch(/data-field="difficulty"/);
      // null baseline on every card + all four stress labels with extent and duration
      expect(count(html, new RegExp(esc(AN_BASELINE_LABEL), 'g'))).toBe(3);
      for (const s of STRESS) expect(count(html, new RegExp(esc(s), 'g'))).toBe(1);
      expect(count(html, /data-action="select-stress"/g)).toBe(4);
      expect(html).not.toContain('data-action="reset-stress"'); // only after a selection
      expect(html).toContain('data-banner="analyst-hypothetical"');
      expect(html).toContain('data-banner="analyst-fixture"');
      expect(html).toContain('data-banner="not-additive"');
      expect(html).not.toMatch(/data-field="(difficulty|probability|likelihood)"/);
    }
  });

  it('thirteen-family taxonomy, source register with verification + rights, gaps and audit are rendered (collapsed details)', () => {
    const html = render(feedOf(FIXTURE_PUBLISHED));
    expect(html).toContain('data-section="analyst-taxonomy"');
    expect(count(html, /data-disposition="/g)).toBe(13);
    expect(count(html, /data-disposition="conditional_hypothesis"/g)).toBe(3);
    expect(count(html, /data-disposition="research_gap"/g)).toBe(10);
    expect(html).toContain('data-section="analyst-sources"');
    expect(count(html, /data-verification="reviewed_paraphrase"/g)).toBe(9);
    expect(count(html, /data-rights="open_attribution"/g)).toBe(9);
    expect(count(html, /id="analyst-source-/g)).toBe(9);
    expect(html).toContain('data-section="analyst-gaps"');
    expect(count(html, /data-gap="/g)).toBe(3);
    expect(html).toContain('data-section="analyst-audit"');
    expect(html).toContain(`sha256 ${FIXTURE_PUBLISHED.publication!.ddd.publication_sha256.slice(0, 16)}`);
    // source citations deep-link into the report's source register; card anchors are exposed as element ids
    expect(html).toContain(`href="/dossiers/${LB}/analyst#analyst-source-MMG_Q1_2023"`);
    for (const id of FIXTURE_CARD_IDS) expect(html).toContain(`id="analyst-${id}"`);
  });

  it('state-only bodies render banners and no cards: not_published, withdrawn, unavailable, browser failure; stale keeps served content', () => {
    const drafts = render(feedOf(FIXTURE_DRAFTS));
    expect(drafts).toContain('data-analyst-state="not_published"');
    expect(drafts).not.toContain('data-analyst-card=');
    const withdrawn = render(feedOf(FIXTURE_WITHDRAWN));
    expect(withdrawn).toContain('data-analyst-state="withdrawn"');
    expect(withdrawn).not.toContain('data-analyst-card=');
    for (const reason of ['feature_disabled', 'dossier_not_enabled', 'store_not_configured']) {
      const html = render(feedOf(stateOnly('unavailable', reason)));
      expect(html).toContain('data-analyst-state="unavailable"');
      expect(html).not.toContain('data-analyst-card=');
    }
    expect(render(feedOf(anUnavailableResponse('sidecar_unreachable')))).toContain('data-analyst-state="unavailable"');
    expect(render(feedOf(null, 'browser_fetch_timeout'))).toContain('data-analyst-state="unavailable"');
    expect(render(feedOf(null))).toContain('data-analyst-state="loading"');
    const stale = render(feedOf(FIXTURE_UPDATE_FAILED));
    expect(stale).toContain('data-analyst-state="stale"');
    expect(count(stale, /data-analyst-card="/g)).toBe(3);
    // a reserved id never shows Las Bambas cards
    const reserved = render(feedOf(stateOnly('unavailable', 'dossier_not_enabled', 'toromocho')), false, 'toromocho');
    expect(reserved).toContain('data-dossier-id="toromocho"');
    expect(reserved).not.toContain('data-analyst-card=');
  });
});

describe('integration surfaces', () => {
  const noop = () => {};
  it('drawer: analyst section default-visible with report link; legacy E3B/E5 controls only inside a collapsed details', () => {
    const html = renderToStaticMarkup(
      <SupplyChainDossiersPanel selected={LB} onSelect={noop}
        geography={{ feed: INITIAL_GEO_FEED, resolved: resolveGeo(INITIAL_GEO_FEED), selection: null, onSelectElement: noop, onLocate: noop, onHighlight: noop }} />,
    );
    expect(html).toContain('data-section="analyst"');
    expect(html).toMatch(new RegExp(`<a[^>]*data-link="analyst-report"[^>]*href="/dossiers/${LB}/analyst"`));
    expect(html).toContain('data-analyst-state="loading"');
    expect(html).toMatch(/<details data-section="legacy"[^>]*><summary[^>]*>LEGACY ASSESSMENTS/);
    expect(html.indexOf('data-section="analyst"')).toBeLessThan(html.indexOf('data-section="legacy"'));
    expect(html.indexOf('data-toggle="vulnerability"')).toBeGreaterThan(html.indexOf('data-section="legacy"'));
    expect(html.indexOf('data-toggle="underwriting"')).toBeGreaterThan(html.indexOf('data-section="legacy"'));
    expect(html).not.toContain('data-toggle="analyst"');
    expect(html).not.toContain('data-banner="vector-unavailable"');
  });

  it('full page: analyst section rendered when the prop is present, before the collapsed legacy block', () => {
    const base = { feed: INITIAL_FEED, resolved: resolveView(INITIAL_FEED), selectedEdgeId: null, onSelectEdge: noop };
    expect(renderToStaticMarkup(<DossierView {...base} />)).not.toContain('data-section="analyst"');
    const feed = feedOf(FIXTURE_PUBLISHED);
    const html = renderToStaticMarkup(
      <DossierView {...base} analyst={{ feed, resolved: resolveAn(feed) }}
        underwriting={{ on: false, onToggle: noop, feed: INITIAL_UW_FEED, resolved: resolveUw(INITIAL_UW_FEED) }} />,
    );
    expect(html).toContain('data-section="analyst"');
    expect(html).toContain('data-analyst-state="available"');
    expect(count(html, /data-analyst-card="/g)).toBe(3);
    expect(html).toMatch(new RegExp(`<a[^>]*data-link="analyst-report"[^>]*href="/dossiers/${LB}/analyst"`));
    expect(html).toMatch(/<details data-section="legacy"/);
    expect(html.indexOf('data-section="underwriting"')).toBeGreaterThan(html.indexOf('data-section="legacy"'));
    expect(html.indexOf('data-section="analyst"')).toBeLessThan(html.indexOf('data-section="legacy"'));
  });

  it('report page client: header, reserved note for unlisted ids, loading state, no Las Bambas link for other ids', () => {
    const lb = renderToStaticMarkup(<AnalystReportClient dossierId={LB} title="Las Bambas – Pillones – Matarani" listed />);
    expect(lb).toContain(`data-page="analyst-report" data-dossier-id="${LB}"`);
    expect(lb).toContain('data-analyst-state="loading"');
    expect(lb).toMatch(new RegExp(`<a[^>]*data-link="full-dossier"[^>]*href="/dossiers/${LB}"`));
    expect(lb).not.toContain('data-banner="reserved-dossier"');
    const rs = renderToStaticMarkup(<AnalystReportClient dossierId="toromocho" title="toromocho (reserved, not published)" listed={false} />);
    expect(rs).toContain('data-banner="reserved-dossier"');
    expect(rs).not.toContain('data-link="full-dossier"');
    expect(rs).not.toContain('data-analyst-card=');
  });
});
