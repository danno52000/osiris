import { describe, expect, it, vi } from 'vitest';
import {
  GEO_LEGEND,
  INITIAL_GEO_FEED,
  OSM_ATTRIBUTION,
  deriveGeoViewState,
  formatReportedDistance,
  isGeoResponse,
  overlayBounds,
  overlayFromPublication,
  overlayGeoJSON,
  reduceGeoFeed,
  resolveGeo,
} from './geography';
import { fetchGeographyOnce } from './geography-client';
import { GEO_FULL, GEO_PARTIAL, GEO_WITHDRAWN, cloneGeo, geoStateOnly } from './geography.test-fixture';

describe('e4-geography/1.0 contract guard', () => {
  it('accepts the three pinned fixtures', () => {
    expect(isGeoResponse(GEO_FULL)).toBe(true);
    expect(isGeoResponse(GEO_PARTIAL)).toBe(true);
    expect(isGeoResponse(GEO_WITHDRAWN)).toBe(true);
  });

  it('full fixture: three approved anchors with honest labels, two links between served endpoints, ODbL attribution', () => {
    const pub = GEO_FULL.publication!;
    expect(pub.legend).toBe(GEO_LEGEND);
    expect(pub.features.map((f) => f.label)).toEqual([
      'Las Bambas · approximate mine location',
      'Pillones · rail-station vicinity',
      'Matarani · approximate port locality',
    ]);
    expect(pub.features[1].caveats).toContain('Transfer facility location unverified.');
    expect(pub.links.map((l) => [l.mode, l.label, l.reported_distance_km, l.distance_basis]).sort()).toEqual([
      ['rail', 'reported rail connection', 285, 'source_reported'],
      ['road', 'reported road connection', 438, 'source_reported'],
    ]);
    expect(pub.attribution[0].text).toBe(OSM_ATTRIBUTION);
    expect(pub.ddd.publication_sha256).toBe('3ea2b261bfae1da748afd2d40765d247eac8f43d496fd778c5c87e6e182ec6e6');
    expect(JSON.stringify(GEO_FULL)).not.toMatch(/portwatch|reviewer|decision_id|run_id/i);
  });

  it('partial fixture: Pillones missing -> no link is served, gap is explicit, the other anchors remain', () => {
    const pub = GEO_PARTIAL.publication!;
    expect(pub.features.map((f) => f.entity_id)).toEqual(['asset:aiddata-site-20', 'port:matarani-pe-mri']);
    expect(pub.links).toEqual([]);
    expect(pub.missing[0].entity_id).toBe('facility:pillones-transfer-station');
    expect(pub.omitted_links).toHaveLength(2);
  });

  it('rejects an unlocated-vertex bypass: a link whose endpoint is not a served feature', () => {
    const b = cloneGeo(GEO_FULL);
    b.publication!.features.splice(1, 1); // drop Pillones but keep both links
    expect(isGeoResponse(b)).toBe(false);
  });

  it('rejects a link that carries its own geometry or a non-schematic basis', () => {
    const b = cloneGeo(GEO_FULL);
    (b.publication!.links[0] as unknown as Record<string, unknown>).geometry_basis = 'surveyed';
    expect(isGeoResponse(b)).toBe(false);
  });

  it('rejects a distance without source-reported basis', () => {
    const b = cloneGeo(GEO_FULL);
    b.publication!.links[0].distance_basis = null;
    expect(isGeoResponse(b)).toBe(false);
    const c = cloneGeo(GEO_FULL);
    c.publication!.links[0].distance_source_ref = null;
    expect(isGeoResponse(c)).toBe(false);
  });

  it('rejects a label claiming exact/surveyed/verified precision', () => {
    for (const label of ['Matarani · exact terminal', 'Surveyed mine site', 'Pillones (verified)']) {
      const b = cloneGeo(GEO_FULL);
      b.publication!.features[2].label = label;
      expect(isGeoResponse(b)).toBe(false);
    }
  });

  it('rejects ODbL anchors without the OSM attribution entry or with altered attribution text', () => {
    const b = cloneGeo(GEO_FULL);
    b.publication!.attribution = [];
    expect(isGeoResponse(b)).toBe(false);
    const c = cloneGeo(GEO_FULL);
    c.publication!.attribution[0].text = 'OpenStreetMap';
    expect(isGeoResponse(c)).toBe(false);
    const d = cloneGeo(GEO_FULL);
    d.publication!.features[1].source.license = 'CC0-1.0';
    expect(isGeoResponse(d)).toBe(false);
  });

  it('rejects private fields, DDD binding mismatch, wrong legend, contradictory gaps, out-of-range coordinates', () => {
    const cases: Array<(b: typeof GEO_FULL) => void> = [
      (b) => { (b.publication!.features[0] as unknown as Record<string, unknown>).decision_id = 'fx-1'; },
      (b) => { (b.publication! as unknown as Record<string, unknown>).run_id = 'r'; },
      (b) => { b.ddd!.publication_no = 4; },
      (b) => { b.currentness!.publication_no = 2; },
      (b) => { b.publication!.legend = 'Schematic connections'; },
      (b) => { b.publication!.missing.push({ entity_id: 'asset:aiddata-site-20', reason: 'x' }); b.publication!.summary.missing_entities = 1; },
      (b) => { b.publication!.features[0].lon = -181; },
      (b) => { b.publication!.features[0].precision_text = 'exact'; },
      (b) => { b.publication!.summary.features_published = 2; },
      (b) => { b.schema_version = 'e4-geography/2.0'; },
      (b) => { (b as { state: string }).state = 'published'; },
      (b) => { b.dossier_id = 'other'; },
    ];
    for (const mutate of cases) {
      const b = cloneGeo(GEO_FULL); mutate(b);
      expect(isGeoResponse(b)).toBe(false);
    }
  });

  it('state-only bodies must not carry a publication; claim states must', () => {
    expect(isGeoResponse({ ...geoStateOnly('withdrawn', 'ddd_mismatch'), publication: GEO_FULL.publication })).toBe(false);
    expect(isGeoResponse({ ...GEO_FULL, publication: null })).toBe(false);
    expect(isGeoResponse({ ...GEO_FULL, state: 'stale', reason: 'update_failed' })).toBe(true);
  });
});

describe('view state / feed', () => {
  it('derives available/stale/not_published/withdrawn/unavailable and loading', () => {
    expect(deriveGeoViewState(null)).toBe('loading');
    expect(deriveGeoViewState(GEO_FULL)).toBe('available');
    expect(deriveGeoViewState({ ...GEO_FULL, state: 'stale' })).toBe('stale');
    expect(deriveGeoViewState(GEO_WITHDRAWN)).toBe('withdrawn');
    expect(deriveGeoViewState(geoStateOnly('not_published', 'no_publication'))).toBe('not_published');
    expect(deriveGeoViewState({ ...GEO_FULL, degraded: true })).toBe('unavailable');
  });

  it('reducer ignores stale generations and a browser failure clears the retained overlay', () => {
    let s = reduceGeoFeed(INITIAL_GEO_FEED, { type: 'response', body: GEO_FULL, at: 't1', generation: 1 });
    expect(resolveGeo(s).publication?.features).toHaveLength(3);
    s = reduceGeoFeed(s, { type: 'response', body: GEO_WITHDRAWN, at: 't0', generation: 0 });
    expect(resolveGeo(s).view).toBe('available');
    s = reduceGeoFeed(s, { type: 'failure', reason: 'browser_fetch_timeout', at: 't2', generation: 2 });
    expect(resolveGeo(s)).toEqual({ view: 'unavailable', body: null, publication: null });
    s = reduceGeoFeed(s, { type: 'response', body: GEO_WITHDRAWN, at: 't3', generation: 3 });
    expect(resolveGeo(s).view).toBe('withdrawn');
    expect(resolveGeo(s).publication).toBeNull();
  });
});

describe('overlay projection', () => {
  it('lines are exactly the two published endpoints; nothing interpolated', () => {
    const railLink = GEO_FULL.publication!.links.find((l) => l.mode === 'rail')!;
    const ov = overlayFromPublication(GEO_FULL.publication!, false, { kind: 'link', id: railLink.link_id }, 1);
    const gj = overlayGeoJSON(ov);
    expect(gj.points.features).toHaveLength(3);
    expect(gj.lines.features).toHaveLength(2);
    for (const l of gj.lines.features) expect(l.geometry.coordinates).toHaveLength(2);
    const rail = gj.lines.features.find((l) => l.properties?.mode === 'rail')!;
    const road = gj.lines.features.find((l) => l.properties?.mode === 'road')!;
    expect(rail.geometry.coordinates).toEqual([[-71.2161395, -15.9831921], [-72.097831, -17.0007604]]);
    expect(rail.properties?.selected).toBe(true);
    expect(road.properties?.selected).toBe(false);
  });

  it('partial publication draws two points and no line', () => {
    const gj = overlayGeoJSON(overlayFromPublication(GEO_PARTIAL.publication!, false, null, 1));
    expect(gj.points.features).toHaveLength(2);
    expect(gj.lines.features).toHaveLength(0);
  });

  it('bounds cover all anchors; empty when nothing published', () => {
    expect(overlayBounds(GEO_FULL.publication!.features)).toEqual([[-72.3197801, -17.0007604], [-71.2161395, -14.099024]]);
    expect(overlayBounds([])).toBeNull();
  });

  it('distance is presented as source-reported, never computed', () => {
    const road = GEO_FULL.publication!.links.find((l) => l.mode === 'road')!;
    expect(formatReportedDistance(road)).toBe('438 km (source-reported: excerpt:x-e3a-mmg-investor-2026-05-road-01)');
    expect(formatReportedDistance({ ...GEO_FULL.publication!.links[0], reported_distance_km: null })).toBe('no reported distance');
  });
});

describe('fetchGeographyOnce', () => {
  const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

  it('accepts a contract-valid body and rejects malformed / non-JSON / network / timeout without throwing', async () => {
    expect(await fetchGeographyOnce(1, () => json(GEO_FULL))).toMatchObject({ type: 'response', generation: 1 });
    const bad = cloneGeo(GEO_FULL); bad.publication!.features.pop();
    expect(await fetchGeographyOnce(2, () => json(bad))).toMatchObject({ type: 'failure', reason: 'browser_response_malformed' });
    expect(await fetchGeographyOnce(3, () => Promise.resolve(new Response('<html>', { status: 503 })))).toMatchObject({ type: 'failure', reason: 'browser_response_malformed' });
    expect(await fetchGeographyOnce(4, () => Promise.reject(new TypeError('net')))).toMatchObject({ type: 'failure', reason: 'browser_fetch_failed' });
    vi.useFakeTimers();
    const hung: typeof fetch = (_u, init) => new Promise((_r, rej) => init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' }))));
    const p = fetchGeographyOnce(5, hung, 50);
    vi.advanceTimersByTime(60);
    expect(await p).toMatchObject({ type: 'failure', reason: 'browser_fetch_timeout' });
    vi.useRealTimers();
  });
});
