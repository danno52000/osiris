/** Render regressions for the E5 underwriting view (react-dom/server) plus panel/full-page integration. */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CHART_EMPTY_TEXT, INITIAL_UW_FEED, reduceUwFeed, resolveUw, uwUnavailableResponse, type UwFeedState, type UwResponse } from '@/lib/underwriting';
import { CORRIDOR_CASE_ID, REAL_PARTIAL, REAL_PUBLISHED, REAL_UPDATE_FAILED, SYNTHETIC_SCORED, TERMINAL_CASE_ID, stateOnly } from '@/lib/underwriting.test-fixture';
import { UnderwritingView } from './UnderwritingView';
import SupplyChainDossiersPanel from './SupplyChainDossiersPanel';
import { DossierView } from '@/app/dossiers/las-bambas-matarani/DossierView';
import { INITIAL_FEED, resolveView } from '@/lib/dossier';
import { INITIAL_GEO_FEED, resolveGeo } from '@/lib/geography';

function feedOf(body: UwResponse | null, failure?: 'browser_fetch_timeout'): UwFeedState {
  if (failure) return reduceUwFeed(INITIAL_UW_FEED, { type: 'failure', reason: failure, at: 't', generation: 1 });
  if (!body) return INITIAL_UW_FEED;
  return reduceUwFeed(INITIAL_UW_FEED, { type: 'response', body, at: 't', generation: 1 });
}
function render(feed: UwFeedState, compact = false): string {
  return renderToStaticMarkup(<UnderwritingView feed={feed} resolved={resolveUw(feed)} compact={compact} />);
}
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe('UnderwritingView', () => {
  it('real draft portfolio: five visible cases, no plotted point, exact chart empty text, independent N/A axes, corridor 3/LOW', () => {
    const html = render(feedOf(REAL_PUBLISHED));
    expect(html).toContain('data-uw-state="available"');
    expect(count(html, /data-case="/g)).toBe(5);
    expect(html).toContain('data-plotted="0"');
    expect(html).toContain(CHART_EMPTY_TEXT);
    expect(count(html, /data-chart-case="/g)).toBe(0);
    expect(count(html, /data-unplotted-case="/g)).toBe(5);
    expect(html).toContain('data-banner="hypothetical"');
    expect(html).toContain('data-banner="ordering"');
    expect(html).toContain('not a ranking');
    // every difficulty N/A; four magnitudes N/A; corridor magnitude 3 with LOW confidence, never combined
    expect(count(html, /data-field="difficulty" data-scored="false"/g)).toBe(5);
    expect(count(html, /data-field="magnitude" data-scored="false"/g)).toBe(4);
    expect(count(html, /data-field="magnitude" data-scored="true"/g)).toBe(1);
    expect(html).toContain(`data-case="${CORRIDOR_CASE_ID}"`);
    expect(html).toContain('data-case-kind="assumption_led"');
    expect(count(html, /data-case-kind="evidence_limited"/g)).toBe(4);
    expect(count(html, /data-case-kind="assumption_led"/g)).toBe(1);
    expect(html).toContain('assumed, not observed');
    expect(html).toContain('data-section="uw-binding"');
    expect(html).toContain('data-section="uw-coverage"');
    expect(count(html, /data-coverage="S/g)).toBe(32);
    expect(html).toContain('data-coverage="S32" data-disposition="modifier"');
    expect(html).not.toMatch(/data-field="(probability|expected_loss|composite_risk|dossier_aggregate_score)"/);
    expect(html).toContain('No probability, expected loss, imminence or combined risk is published');
  });

  it('synthetic chart fixture (test-only): two plotted cases — two dashed ranges — keyboard-focusable', () => {
    const html = render(feedOf(SYNTHETIC_SCORED));
    expect(html).toContain('data-plotted="2"');
    expect(html).not.toContain(CHART_EMPTY_TEXT);
    expect(html).toContain(`data-chart-case="${CORRIDOR_CASE_ID}" data-chart-shape="range"`);
    expect(html).toContain(`data-chart-case="${TERMINAL_CASE_ID}" data-chart-shape="range"`);
    expect(html).toContain('difficulty 2–3 (LOW), magnitude 3 (LOW)');
    expect(count(html, /data-chart-case="[^"]*"[^>]*role="button"[^>]*tabindex="0"/g)).toBe(2);
    expect(count(html, /data-unplotted-case="/g)).toBe(3);
    expect(html).toContain('1–5');
  });

  it('partial publication lists the pending corridor case as not published, still showing four cases', () => {
    const html = render(feedOf(REAL_PARTIAL));
    expect(count(html, /data-case="/g)).toBe(4);
    expect(html).toContain('data-section="uw-not-published"');
    expect(html).not.toContain(`data-case="${CORRIDOR_CASE_ID}"`);
  });

  it('stale update_failed keeps the same-DDD retained publication with a stale banner', () => {
    const html = render(feedOf(REAL_UPDATE_FAILED));
    expect(html).toContain('data-uw-state="stale"');
    expect(html).toContain('last published portfolio');
    expect(count(html, /data-case="/g)).toBe(5);
  });

  it('withdrawn / not_published / unavailable / browser failure / loading show state only — no case content', () => {
    for (const [feed, state] of [
      [feedOf(stateOnly('withdrawn', 'ddd_mismatch')), 'withdrawn'],
      [feedOf(stateOnly('withdrawn', 'eligibility_withdrawn')), 'withdrawn'],
      [feedOf(stateOnly('not_published', 'no_publication')), 'not_published'],
      [feedOf(uwUnavailableResponse('feature_disabled')), 'unavailable'],
      [feedOf(null, 'browser_fetch_timeout'), 'unavailable'],
      [feedOf(null), 'loading'],
    ] as const) {
      const html = render(feed);
      expect(html).toContain(`data-uw-state="${state}"`);
      expect(html).not.toContain('data-case="');
      expect(html).not.toContain('data-chart-case="');
      expect(html).not.toContain(CORRIDOR_CASE_ID);
    }
    expect(render(feedOf(stateOnly('withdrawn', 'ddd_mismatch')))).toContain('withheld');
  });

  it('case cards are buttons with aria-expanded, initially collapsed', () => {
    const html = render(feedOf(REAL_PUBLISHED), true);
    expect(count(html, /data-case="[^"]*"[^>]*data-selected="false"[^>]*>\s*<button[^>]*aria-expanded="false"[^>]*aria-pressed="false"/g)).toBe(5);
    expect(html).not.toContain('data-case-detail=');
    expect(html).not.toContain('data-action="clear-highlight"');
  });
});

describe('integration surfaces', () => {
  const noop = () => {};
  it('panel: underwriting checkbox off by default; when on, compact view renders beside geography without altering OSM legend text', () => {
    const geoFeed = INITIAL_GEO_FEED;
    const html = renderToStaticMarkup(
      <SupplyChainDossiersPanel selected="las-bambas-matarani" onSelect={noop}
        geography={{ feed: geoFeed, resolved: resolveGeo(geoFeed), selection: null, onSelectElement: noop, onLocate: noop, onHighlight: noop }} />,
    );
    expect(html).toContain('data-toggle="underwriting"');
    expect(html).not.toContain('data-uw-view=');
    expect(html).toContain('data-toggle="vulnerability"');
  });

  it('full page: underwriting section absent without the prop, toggle + off text with it, view when on', () => {
    const base = { feed: INITIAL_FEED, resolved: resolveView(INITIAL_FEED), selectedEdgeId: null, onSelectEdge: noop };
    expect(renderToStaticMarkup(<DossierView {...base} />)).not.toContain('data-section="underwriting"');
    const off = renderToStaticMarkup(<DossierView {...base} underwriting={{ on: false, onToggle: noop, feed: INITIAL_UW_FEED, resolved: resolveUw(INITIAL_UW_FEED) }} />);
    expect(off).toContain('data-section="underwriting"');
    expect(off).toContain('data-uw-view="off"');
    const feed = feedOf(REAL_PUBLISHED);
    const on = renderToStaticMarkup(<DossierView {...base} underwriting={{ on: true, onToggle: noop, feed, resolved: resolveUw(feed) }} />);
    expect(on).toContain('data-uw-state="available"');
    expect(count(on, /data-case="/g)).toBe(5);
    expect(on).toContain('Underwriting cases');
  });
});
