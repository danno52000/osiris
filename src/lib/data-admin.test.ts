import { describe, expect, it } from 'vitest';
import {
  deriveViewState,
  describeReason,
  flagText,
  formatCount,
  formatSourcePeriod,
  isNonLive,
  type DataAdminResponse,
} from './data-admin';

const base: DataAdminResponse = {
  state: 'available',
  reason: null,
  checked_at: '2026-09-22T17:00:00Z',
  schema_revision_expected: '0012',
  sources: [],
};

describe('deriveViewState', () => {
  it('distinguishes loading, disabled, unconfigured, unavailable, stale, available, empty', () => {
    expect(deriveViewState(null)).toBe('loading');
    expect(deriveViewState({ ...base, state: 'disabled', reason: 'foundation_disabled' })).toBe('disabled');
    expect(deriveViewState({ ...base, state: 'unconfigured', reason: 'dsn_missing' })).toBe('unconfigured');
    expect(deriveViewState({ ...base, state: 'unavailable', reason: 'timeout' })).toBe('unavailable');
    expect(deriveViewState({ ...base, state: 'available' })).toBe('empty');
    const src = { source_id: 'F01' } as unknown as DataAdminResponse['sources'][number];
    expect(deriveViewState({ ...base, sources: [src] })).toBe('available');
    expect(deriveViewState({ ...base, sources: [src], stale: true })).toBe('stale');
  });

  it('treats a degraded proxy answer as unavailable even if it claims available', () => {
    expect(deriveViewState({ ...base, degraded: true })).toBe('unavailable');
  });
});

describe('formatCount', () => {
  it('never renders unknown as zero', () => {
    expect(formatCount({ count: null, count_kind: 'unknown' })).toBe('unknown');
    expect(formatCount({ count: null, count_kind: 'live_count' })).toBe('unknown');
    expect(formatCount({ count: 0, count_kind: 'live_count' })).toBe('0');
    expect(formatCount({ count: 40219, count_kind: 'published_count' })).toBe('40,219');
  });
});

describe('flagText', () => {
  it('maps null to unknown, not to no', () => {
    expect(flagText(undefined)).toBe('unknown');
    expect(flagText({ value: null, provenance: 'unknown' })).toBe('unknown');
    expect(flagText({ value: false, provenance: 'evidence' })).toBe('no');
    expect(flagText({ value: true, provenance: 'live' })).toBe('yes');
  });
});

describe('formatSourcePeriod', () => {
  it('renders string, object and missing periods', () => {
    expect(formatSourcePeriod(null)).toBe('unknown');
    expect(formatSourcePeriod({ kind: 'latest_month', value: '2026-07' })).toBe('2026-07');
    expect(formatSourcePeriod({ kind: 'edition_years', value: { edition: '2026', years: [2024, 2025] } }))
      .toBe('edition: 2026 · years: 2024, 2025');
    expect(formatSourcePeriod({ kind: 'publisher_release', value: null })).toBe('unknown');
  });
});

describe('describeReason / isNonLive', () => {
  it('describes known codes and echoes unknown codes verbatim', () => {
    expect(describeReason('foundation_disabled')).toMatch(/switched off/);
    expect(describeReason('some_new_code')).toBe('some_new_code');
    expect(describeReason(null)).toBeNull();
  });

  it('marks blocked/deferred or table-less sources as non-live', () => {
    expect(isNonLive({ disposition: 'blocked', datasets: [] })).toBe(true);
    expect(isNonLive({ disposition: 'deferred', datasets: [] })).toBe(true);
    expect(isNonLive({ disposition: 'loaded', datasets: [] })).toBe(true);
    expect(isNonLive({ disposition: 'loaded', datasets: [{} as never] })).toBe(false);
  });
});
