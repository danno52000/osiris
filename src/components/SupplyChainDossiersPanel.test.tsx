/**
 * Static renders of the right-rail Supply Chain Dossiers control with page-owned selection and
 * geography state: no selection, available geography with a selected feature/link, partial
 * (missing anchor) geography, withdrawn/unavailable geography, and the vector card.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SupplyChainDossiersPanel, { DOSSIER_LIST } from './SupplyChainDossiersPanel';
import { DossierGeographyView, DossierMapAttribution } from './DossierGeographyView';
import { VectorJudgmentCard } from './VectorJudgmentCard';
import { GEO_LEGEND, INITIAL_GEO_FEED, OSM_ATTRIBUTION, resolveGeo, type GeoFeedState, type GeoResponse } from '@/lib/geography';
import { MAGNITUDE_NA, VECTOR_DISCLAIMER, isVulnResponse, type VulnResponse } from '@/lib/vulnerability';
import geoFull from '@/lib/geography-fixtures/geo_full.json';
import geoPartial from '@/lib/geography-fixtures/geo_partial.json';
import geoWithdrawn from '@/lib/geography-fixtures/geo_withdrawn.json';
import vulnVector from '@/lib/geography-fixtures/vuln_vector.json';

const FULL = geoFull as unknown as GeoResponse;
const PARTIAL = geoPartial as unknown as GeoResponse;
const WITHDRAWN = geoWithdrawn as unknown as GeoResponse;
const VULN = vulnVector as unknown as VulnResponse;

function feedOf(body: GeoResponse | null, fetchError: GeoFeedState['fetchError'] = null): GeoFeedState {
  return { ...INITIAL_GEO_FEED, body, fetchError, fetchedAt: '2026-09-24T00:00:00Z', generation: 1 };
}
const noop = () => {};

describe('SupplyChainDossiersPanel', () => {
  it('lists exactly the one bounded dossier with no selection by default and draws nothing', () => {
    const html = renderToStaticMarkup(<SupplyChainDossiersPanel selected={null} onSelect={noop} />);
    expect(DOSSIER_LIST).toHaveLength(1);
    expect(DOSSIER_LIST[0]).toMatchObject({ id: 'las-bambas-matarani', href: '/dossiers/las-bambas-matarani' });
    expect(html).toContain('SUPPLY CHAIN DOSSIERS');
    expect(html).toContain('Nothing is drawn until then');
    expect((html.match(/data-dossier-id="/g) ?? []).length).toBe(1);
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('data-section="selected-dossier"');
    expect(html).not.toContain('data-toggle="vulnerability"');
    expect(html).not.toContain('data-geo-view');
  });

  it('with a selection renders the geography section, Locate, full-dossier link and lifecycle state', () => {
    const feed = feedOf(FULL);
    const html = renderToStaticMarkup(
      <SupplyChainDossiersPanel
        selected="las-bambas-matarani"
        onSelect={noop}
        geography={{ feed, resolved: resolveGeo(feed), selection: null, onSelectElement: noop, onLocate: noop }}
      />,
    );
    expect(html).toContain('data-section="selected-dossier"');
    expect(html).toContain('data-geo-view="available"');
    expect(html).toContain('data-action="locate-dossier"');
    expect(html).toContain('data-link="full-dossier"');
    expect(html).toContain('data-toggle="vulnerability"');
    expect(html).toContain('aria-pressed="true"');
  });
});

describe('DossierMapAttribution (fixed map-corner credit)', () => {
  it('renders one compact linked OSM credit + license link for ODbL attribution', () => {
    const feed = feedOf(FULL);
    const pub = resolveGeo(feed).publication!;
    const html = renderToStaticMarkup(<DossierMapAttribution attribution={pub.attribution} />);
    expect(html).toContain('data-attribution="odbl-map"');
    expect(html).toContain(`>${OSM_ATTRIBUTION}</a>`);
    expect(html).toContain('href="https://www.openstreetmap.org/copyright"');
    expect(html).toContain('href="https://opendatacommons.org/licenses/odbl/1-0/"');
    expect(html).toContain('whitespace-nowrap');
  });

  it('renders nothing when no ODbL-licensed anchors are published', () => {
    expect(renderToStaticMarkup(<DossierMapAttribution attribution={[]} />)).toBe('');
  });
});

describe('DossierGeographyView', () => {
  it('available: three anchors, two links, legend, ODbL attribution link, no card until selected', () => {
    const feed = feedOf(FULL);
    const html = renderToStaticMarkup(
      <DossierGeographyView feed={feed} resolved={resolveGeo(feed)} selection={null} onSelect={noop} onLocate={noop} vulnPublication={null} />,
    );
    expect((html.match(/data-geo-feature="/g) ?? []).length).toBe(3);
    expect((html.match(/data-geo-link="/g) ?? []).length).toBe(2);
    expect(html).toContain('Las Bambas · approximate mine location');
    expect(html).toContain('Pillones · rail-station vicinity');
    expect(html).toContain('Matarani · approximate port locality');
    expect(html).toContain('reported road connection');
    expect(html).toContain('reported rail connection');
    expect(html).toContain(GEO_LEGEND);
    expect(html).toContain('data-attribution="odbl"');
    expect(html).toContain(OSM_ATTRIBUTION.replace('©', '©'));
    expect(html).toContain('href="https://www.openstreetmap.org/copyright"');
    expect(html).not.toContain('data-card=');
    expect(html).not.toContain('data-section="geo-gaps"');
  });

  it('feature card: precision, source, caveats, fact vs inference, element-not-assessed with dossier-wide vector context', () => {
    const feed = feedOf(FULL);
    const pillones = FULL.publication!.features.find((f) => f.entity_id === 'facility:pillones-transfer-station')!;
    const html = renderToStaticMarkup(
      <DossierGeographyView
        feed={feed} resolved={resolveGeo(feed)}
        selection={{ kind: 'feature', id: pillones.feature_id }}
        onSelect={noop} onLocate={noop} vulnPublication={VULN.publication}
      />,
    );
    expect(html).toContain(`data-card="feature" data-feature-id="${pillones.feature_id}"`);
    expect(html).toContain('Transfer facility location unverified.');
    expect(html).toContain('rail-station vicinity</span> · -15.9832, -71.2161 (approximate, not a survey)');
    expect(html).toContain('node/7306696316</a> · v3 · modified 2021-09-17');
    expect(html).toContain('Reported fact:');
    expect(html).toContain('Analyst inference:');
    expect(html).toContain('not assessed for this element');
    expect(html).toContain('Dossier-wide context only: LOG');
    expect(html).toContain('LOW prioritisation confidence');
    expect(html).toContain('href="/dossiers/las-bambas-matarani#physical-route"');
    expect(html).not.toContain('-15.9831921'); // coordinates shown at honest 4-decimal precision only
  });

  it('link card: endpoints, mode, source-reported distance not calculated, evidence ref', () => {
    const feed = feedOf(FULL);
    const rail = FULL.publication!.links.find((l) => l.mode === 'rail')!;
    const html = renderToStaticMarkup(
      <DossierGeographyView
        feed={feed} resolved={resolveGeo(feed)}
        selection={{ kind: 'link', id: rail.link_id }}
        onSelect={noop} onLocate={noop} vulnPublication={VULN.publication}
      />,
    );
    expect(html).toContain(`data-card="link" data-link-id="${rail.link_id}"`);
    expect(html).toContain('mode rail');
    expect(html).toContain('285 km (source-reported');
    expect(html).toContain('not calculated from the drawn line');
    expect(html).toContain('excerpt:x-e3a-mmg-investor-2026-05-rail-01');
    expect(html).toContain('→');
    expect(html).toContain('schematic endpoint connector');
  });

  it('partial: missing Pillones yields explicit gaps, remaining anchors, no links needing it', () => {
    const feed = feedOf(PARTIAL);
    const html = renderToStaticMarkup(
      <DossierGeographyView feed={feed} resolved={resolveGeo(feed)} selection={null} onSelect={noop} onLocate={noop} vulnPublication={null} />,
    );
    expect(html).toContain('data-section="geo-gaps"');
    expect(html).toContain('no location for facility:pillones-transfer-station');
    expect((html.match(/data-geo-feature="/g) ?? []).length).toBe(PARTIAL.publication!.features.length);
    expect((html.match(/data-geo-link="/g) ?? []).length).toBe(0);
    expect(html).not.toContain('Pillones · rail-station vicinity');
  });

  it('withdrawn / unavailable / loading: state banner, no anchors, no Locate', () => {
    const w = feedOf(WITHDRAWN);
    const html = renderToStaticMarkup(
      <DossierGeographyView feed={w} resolved={resolveGeo(w)} selection={null} onSelect={noop} onLocate={noop} vulnPublication={null} />,
    );
    expect(html).toContain('data-geo-view="withdrawn"');
    expect(html).toContain('GEOGRAPHY WITHDRAWN');
    expect(html).toContain('eligibility_withdrawn');
    expect(html).not.toContain('data-geo-feature=');
    expect(html).not.toContain('data-action="locate-dossier"');

    const u = feedOf(null, 'browser_fetch_failed');
    const html2 = renderToStaticMarkup(
      <DossierGeographyView feed={u} resolved={resolveGeo(u)} selection={null} onSelect={noop} onLocate={noop} vulnPublication={null} />,
    );
    expect(html2).toContain('data-geo-view="unavailable"');
    expect(html2).toContain('browser_fetch_failed');
    expect(html2).not.toContain('data-geo-feature=');

    const l = INITIAL_GEO_FEED;
    const html3 = renderToStaticMarkup(
      <DossierGeographyView feed={l} resolved={resolveGeo(l)} selection={null} onSelect={noop} onLocate={noop} vulnPublication={null} />,
    );
    expect(html3).toContain('data-geo-view="loading"');
  });
});

describe('VectorJudgmentCard', () => {
  it('shows N/A magnitude beside LOG/LOW vector with disclaimer; no zero, no Low, no active-threat wording', () => {
    expect(isVulnResponse(VULN)).toBe(true);
    const html = renderToStaticMarkup(<VectorJudgmentCard publication={VULN.publication} />);
    expect(html).toContain(MAGNITUDE_NA);
    expect(html).toContain('data-vector="LOG"');
    expect(html).toContain('Logistics / corridor-access disruption');
    expect(html).toContain('prioritisation confidence LOW');
    expect(html).toContain('no secondary');
    expect(html).toContain(VECTOR_DISCLAIMER);
    expect(html).toContain('S03');
    expect(html).toContain('What would change this ranking');
    expect(html).not.toMatch(/magnitude 0\b|supported maximum 0|\bLow impact\b|blockade|active threat/i);
  });

  it('legacy 1.0 publication: magnitude N/A still shown, vector explicitly absent', () => {
    const legacy = { ...VULN.publication!, contract: 'e3b-vuln-1.0', vector_judgment: undefined };
    const html = renderToStaticMarkup(<VectorJudgmentCard publication={legacy} />);
    expect(html).toContain(MAGNITUDE_NA);
    expect(html).toContain('data-vector="none"');
    expect(html).toContain('No vector judgment in this publication (e3b-vuln-1.0)');
    expect(html).toContain('not an absence of risk');
  });

  it('renders nothing without a publication', () => {
    expect(renderToStaticMarkup(<VectorJudgmentCard publication={null} />)).toBe('');
  });
});
