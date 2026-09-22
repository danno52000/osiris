/**
 * Render/state-transition regressions for the Data Admin page (C1 correction 1):
 * a browser fetch failure after a good payload must not keep rendering fresh AVAILABLE,
 * the badge must follow the live loaded flag, and ICLAC must not present GIDEON
 * published_at as source freshness. Rendered with react-dom/server (no DOM needed).
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  INITIAL_FEED,
  RETAINED_MAX_AGE_S,
  reduceFeed,
  resolveView,
  type DataAdminResponse,
  type DataAdminSource,
  type FeedState,
  type FlagValue,
} from '@/lib/data-admin';
import { DataAdminView } from './DataAdminView';

const T0 = '2026-09-22T20:00:00.000Z';
const plus = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();

const flag = (value: boolean | null, extra: Partial<FlagValue> = {}): FlagValue => ({
  value,
  provenance: value === null ? 'unknown' : 'live',
  ...extra,
});

function source(over: Partial<DataAdminSource>): DataAdminSource {
  return {
    source_id: 'C05',
    family: 'C05',
    name: 'GLEIF',
    publisher: 'GLEIF',
    disposition: 'loaded',
    record_type: 'legal entity',
    coverage: { declared_scope: 'scope', geography: 'CN + LATAM', time_coverage: 'current snapshot' },
    datasets: [
      { dataset_id: 'gleif_entities', name: 'Entities', grain: 'entity', declared_count_kind: 'published_count', count_kind: 'published_count', count: 40219, observed_at: T0 },
    ],
    flags: {
      implemented: flag(true, { provenance: 'evidence' }),
      loaded: flag(true, { basis: 'current snapshot row exists', observed_at: T0 }),
      repeat_verified: flag(true, { provenance: 'evidence' }),
      refresh_configured: flag(true, { provenance: 'configured' }),
      automatic_run_verified: flag(null),
    },
    cadence: { configured: true, cron: '30 4 * * 2', text: 'weekly', provenance: 'configured', evidence_at: T0 },
    source_period: { kind: 'publisher_release', value: '2026-09-16' },
    published_at: '2026-09-20T05:10:00Z',
    last_success_at: '2026-09-20T05:10:00Z',
    last_attempt: null,
    last_failure: null,
    live_observation: { checked_at: T0, provenance: 'live' },
    blocker: null,
    next_action: null,
    display_clearance: 'aggregate metadata only',
    evidence_links: [],
    ...over,
  };
}

function available(sources: DataAdminSource[] = [source({})], over: Partial<DataAdminResponse> = {}): DataAdminResponse {
  return {
    state: 'available',
    reason: null,
    checked_at: T0,
    schema_revision_expected: '0012',
    schema_revision_observed: '0012',
    stale: false,
    cache_age_s: 0,
    served_from_cache: false,
    manifest: { version: '1.0.0', sha256: 'f'.repeat(64), database_commit: '3cdedd5edd017b4b05e790866102dcf70de0b15c', reviewed_at: T0 },
    sources,
    ...over,
  };
}

function render(feed: FeedState, nowIso: string): string {
  return renderToStaticMarkup(<DataAdminView feed={feed} resolved={resolveView(feed, nowIso)} />);
}

const viewState = (html: string) => /data-view-state="([a-z]+)"/.exec(html)?.[1];
const staleOrigin = (html: string) => /data-stale-origin="([a-z]+)"/.exec(html)?.[1];

describe('browser fetch failure after a successful fetch', () => {
  it('renders AVAILABLE after the first good payload', () => {
    const feed = reduceFeed(INITIAL_FEED, { type: 'response', body: available(), at: plus(1) });
    const html = render(feed, plus(1));
    expect(viewState(html)).toBe('available');
    expect(html).toContain('AVAILABLE');
    expect(html).toContain('data-source-id="C05"');
  });

  it('renders STALE (browser origin) with retained data, never fresh AVAILABLE, after a later fetch failure', () => {
    let feed = reduceFeed(INITIAL_FEED, { type: 'response', body: available(), at: plus(1) });
    feed = reduceFeed(feed, { type: 'failure', message: 'TypeError: Failed to fetch', at: plus(61) });
    const html = render(feed, plus(61));
    expect(viewState(html)).toBe('stale');
    expect(staleOrigin(html)).toBe('browser');
    expect(html).toContain('STALE');
    expect(html).not.toMatch(/>AVAILABLE</);
    expect(html).toContain('Browser fetch failed');
    expect(html).toContain('Failed to fetch');
    expect(html).toContain('Not fresh');
    expect(html).toContain('data-source-id="C05"');
    expect(html).toContain('2026-09-22 20:00:00Z');
  });

  it('JSON parse failure is a failure too and reports the retained age', () => {
    let feed = reduceFeed(INITIAL_FEED, { type: 'response', body: available([], { cache_age_s: 120 }), at: plus(0) });
    feed = reduceFeed(feed, { type: 'failure', message: 'Unexpected token < in JSON', at: plus(300) });
    const r = resolveView(feed, plus(300));
    expect(r.view).toBe('stale');
    expect(r.retainedAgeS).toBe(420);
  });

  it('drops the retained payload once it ages past the sidecar stale policy', () => {
    let feed = reduceFeed(INITIAL_FEED, { type: 'response', body: available(), at: plus(0) });
    feed = reduceFeed(feed, { type: 'failure', message: 'network down', at: plus(RETAINED_MAX_AGE_S + 1) });
    const html = render(feed, plus(RETAINED_MAX_AGE_S + 1));
    expect(viewState(html)).toBe('unavailable');
    expect(html).toContain('UNAVAILABLE');
    expect(html).not.toContain('data-source-id=');
    expect(html).toContain('no retained payload within the 6 h stale limit');
  });

  it('a failure with no prior good payload is unavailable, and a failure after disabled does not retain', () => {
    const cold = reduceFeed(INITIAL_FEED, { type: 'failure', message: 'boom', at: plus(1) });
    expect(viewState(render(cold, plus(1)))).toBe('unavailable');

    let feed = reduceFeed(INITIAL_FEED, {
      type: 'response',
      body: { state: 'disabled', reason: 'foundation_disabled', checked_at: T0, schema_revision_expected: '0012', sources: [] },
      at: plus(1),
    });
    feed = reduceFeed(feed, { type: 'failure', message: 'boom', at: plus(2) });
    expect(viewState(render(feed, plus(2)))).toBe('unavailable');
  });

  it('a successful refresh clears the browser-stale state and shows recovered', () => {
    let feed = reduceFeed(INITIAL_FEED, { type: 'response', body: available(), at: plus(0) });
    feed = reduceFeed(feed, { type: 'failure', message: 'network down', at: plus(60) });
    expect(resolveView(feed, plus(60)).view).toBe('stale');
    feed = reduceFeed(feed, { type: 'response', body: available([source({})], { checked_at: plus(120) }), at: plus(120) });
    const html = render(feed, plus(120));
    expect(viewState(html)).toBe('available');
    expect(staleOrigin(html)).toBeUndefined();
    expect(feed.fetchError).toBeNull();
    expect(feed.recovered).toBe(true);
    expect(html).toContain('recovered');
    expect(html).toContain('2026-09-22 20:02:00Z');
  });

  it('server-side stale (sidecar refresh failed) keeps its own wording', () => {
    const feed = reduceFeed(INITIAL_FEED, {
      type: 'response',
      body: available([source({})], { stale: true, cache_age_s: 400, refresh_error: 'timeout' }),
      at: plus(0),
    });
    const html = render(feed, plus(0));
    expect(viewState(html)).toBe('stale');
    expect(staleOrigin(html)).toBe('server');
    expect(html).toContain('latest sidecar refresh failed');
    expect(html).not.toContain('Browser fetch failed');
  });
});

describe('source badge follows the live loaded flag', () => {
  const badgeOf = (html: string, id: string) => {
    const card = html.slice(html.indexOf(`data-source-id="${id}"`));
    return /data-badge-tone="([a-z_]+)" data-loaded-live="([a-z]+)"[^>]*>([^<]+)</.exec(card);
  };

  it('LOADED only when the live flag is true; NOT LOADED / UNKNOWN otherwise, static dispositions unchanged', () => {
    const body = available([
      source({ source_id: 'C05' }),
      source({ source_id: 'F04', name: 'ICLAC', flags: { ...source({}).flags, loaded: flag(false, { basis: 'current snapshot row exists' }) } }),
      source({ source_id: 'T06', name: 'Comex', flags: { ...source({}).flags, loaded: flag(null) } }),
      source({ source_id: 'F05', name: 'Red ALC', disposition: 'loaded_manual', flags: { ...source({}).flags, loaded: flag(true) } }),
      source({ source_id: 'N03', name: 'CNPJ', disposition: 'blocked', datasets: [], flags: { ...source({}).flags, loaded: flag(false, { provenance: 'evidence' }) } }),
      source({ source_id: 'X13', name: 'USGS', disposition: 'deferred', datasets: [], flags: { ...source({}).flags, loaded: flag(false, { provenance: 'evidence' }) } }),
    ]);
    const html = render(reduceFeed(INITIAL_FEED, { type: 'response', body, at: plus(0) }), plus(0));

    expect(badgeOf(html, 'C05')?.slice(1)).toEqual(['loaded', 'true', 'LOADED']);
    expect(badgeOf(html, 'F04')?.slice(1)).toEqual(['not_loaded', 'false', 'NOT LOADED']);
    expect(badgeOf(html, 'T06')?.slice(1)).toEqual(['unknown', 'unknown', 'LOADED: UNKNOWN']);
    expect(badgeOf(html, 'F05')?.slice(1)).toEqual(['loaded', 'true', 'LOADED · MANUAL ONLY']);
    expect(badgeOf(html, 'N03')?.slice(1)).toEqual(['blocked', 'unknown', 'BLOCKED · NOT LOADED']);
    expect(badgeOf(html, 'X13')?.slice(1)).toEqual(['deferred', 'unknown', 'DEFERRED']);

    // A "loaded" disposition with a false live flag never reads LOADED anywhere in its card.
    const f04 = html.slice(html.indexOf('data-source-id="F04"'), html.indexOf('data-source-id="T06"'));
    expect(f04).not.toMatch(/>LOADED</);
    expect(f04).toContain('basis: current snapshot row exists');
  });
});

describe('ICLAC source period vs GIDEON published_at', () => {
  it('shows publisher period unknown with the note, declared coverage as manifest evidence, and published_at only as ingestion', () => {
    const iclac = source({
      source_id: 'F04',
      name: 'ICLAC',
      source_period: {
        kind: 'publisher_release',
        value: null,
        declared_coverage: 'Projects dated 1997-2025 in the current inventory (declared coverage)',
        declared_coverage_provenance: 'evidence',
        note: 'Publisher provides no release date, so source freshness is unknown; published_at is GIDEON publication time, not a source period',
      },
      published_at: '2026-09-21T04:45:00Z',
    });
    const html = render(reduceFeed(INITIAL_FEED, { type: 'response', body: available([iclac]), at: plus(0) }), plus(0));
    const period = /data-field="source-period">([\s\S]*?)<\/dd>/.exec(html)?.[1] ?? '';
    const coverage = /data-field="declared-coverage">([\s\S]*?)<\/dd>/.exec(html)?.[1] ?? '';
    const published = /data-field="published-at">([\s\S]*?)<\/dd>/.exec(html)?.[1] ?? '';

    expect(period.startsWith('unknown')).toBe(true);
    expect(period).toContain('Publisher provides no release date');
    expect(period).not.toContain('2026-09-21');
    expect(coverage).toContain('1997-2025');
    expect(coverage).toContain('evidence, not source freshness');
    expect(published).toBe('2026-09-21 04:45:00Z');
    expect(html).toContain('Source period (publisher)');
    expect(html).toContain('Published in GIDEON (ingestion)');
  });

  it('a source with no declared coverage renders no declared-coverage row', () => {
    const html = render(reduceFeed(INITIAL_FEED, { type: 'response', body: available(), at: plus(0) }), plus(0));
    expect(html).not.toContain('data-field="declared-coverage"');
    expect(html).toContain('2026-09-16');
  });
});
