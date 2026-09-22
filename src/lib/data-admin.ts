/**
 * GIDEON Data Admin contract — safe aggregate operational metadata for the
 * eight public-source families, served by the Fusion sidecar
 * (`GET /api/v1/foundation/data-admin`) and reached through the
 * `/api/fusion/data-admin` proxy. No raw source records, documents, hosts,
 * roles or credentials ever appear in this payload.
 */

export type FoundationState = 'disabled' | 'unconfigured' | 'unavailable' | 'available';

export type Provenance = 'live' | 'evidence' | 'configured' | 'unknown';

export type CountKind = 'live_count' | 'published_count' | 'source_count' | 'unknown';

export interface FlagValue {
  /** true / false, or null when there is no independent evidence either way. */
  value: boolean | null;
  provenance: Provenance;
  evidence_at?: string | null;
  evidence_url?: string | null;
  cron?: string | null;
  cadence_text?: string | null;
  note?: string | null;
  rule?: string | null;
  /** Live `loaded` only: which source-specific evidence decided the value. */
  basis?: string | null;
  observed_at?: string | null;
}

export type FlagName =
  | 'implemented'
  | 'loaded'
  | 'repeat_verified'
  | 'refresh_configured'
  | 'automatic_run_verified';

export const FLAG_ORDER: readonly FlagName[] = [
  'implemented',
  'loaded',
  'repeat_verified',
  'refresh_configured',
  'automatic_run_verified',
];

export const FLAG_LABELS: Record<FlagName, string> = {
  implemented: 'Implemented',
  loaded: 'Loaded',
  repeat_verified: 'Repeat verified',
  refresh_configured: 'Refresh configured',
  automatic_run_verified: 'Automatic run verified',
};

export interface DatasetCount {
  dataset_id: string;
  name: string;
  grain: string;
  declared_count_kind: CountKind;
  count_kind: CountKind;
  /** null = unknown (never rendered as zero). */
  count: number | null;
  observed_at: string;
}

export interface SourcePeriod {
  kind: string;
  /** Publisher-side period; null = unknown (never substituted with GIDEON `published_at`). */
  value: string | Record<string, unknown> | null;
  note?: string | null;
  release_last_modified?: string | null;
  /** Declared coverage from the reviewed manifest (evidence), kept apart from `value`. */
  declared_coverage?: string | null;
  declared_coverage_provenance?: Provenance | null;
}

export interface LastAttempt {
  run_status: string | null;
  started_at: string | null;
  ended_at: string | null;
  error_code: string | null;
  acquisition_outcome: string | null;
  acquisition_failure_category: string | null;
  acquisition_at: string | null;
}

export interface EvidenceLink {
  label: string;
  url: string;
  restricted: boolean;
}

export interface DataAdminSource {
  source_id: string;
  family: string;
  name: string;
  publisher: string;
  disposition: string;
  record_type: string;
  coverage: {
    declared_scope: string;
    geography: string;
    time_coverage: string;
  };
  datasets: DatasetCount[];
  flags: Record<FlagName, FlagValue>;
  cadence: {
    configured: boolean | null;
    cron: string | null;
    text: string | null;
    provenance: Provenance;
    evidence_at: string | null;
  };
  source_period: SourcePeriod | null;
  published_at: string | null;
  last_success_at: string | null;
  last_attempt: LastAttempt | null;
  last_failure: { at: string | null; error_code: string | null } | null;
  live_observation: { checked_at: string; provenance: Provenance } | null;
  run_totals?: { succeeded: number | null; failed: number | null };
  partitions?: Record<string, {
    complete: number | null;
    total: number | null;
    failed_last_attempts: number | null;
    last_attempt_at: string | null;
  }>;
  scope_version?: string | null;
  blocker: string | null;
  next_action: string | null;
  display_clearance: string;
  evidence_links: EvidenceLink[];
}

export interface DataAdminManifestInfo {
  version: string;
  sha256: string;
  database_commit: string;
  reviewed_at: string;
}

/** Sidecar `/data-admin` body (200) or state-only body (503), plus proxy degradation. */
export interface DataAdminResponse {
  state: FoundationState;
  reason: string | null;
  checked_at: string;
  schema_revision_expected: string;
  schema_revision_observed?: string | null;
  schema_check?: string;
  query_ms?: number;
  stale?: boolean;
  cache_age_s?: number;
  served_from_cache?: boolean;
  refresh_error?: string | null;
  refresh_error_at?: string | null;
  manifest?: DataAdminManifestInfo;
  sources: DataAdminSource[];
  /** Set by the Next proxy when the sidecar itself could not be reached. */
  degraded?: boolean;
}

/** Reason code used by the proxy when the sidecar is unreachable or malformed. */
export const PROXY_UNAVAILABLE_REASON = 'sidecar_unreachable';

export const EXPECTED_SOURCE_COUNT = 8;

/** Rendering state derived from a response; distinct from the wire state. */
export type ViewState =
  | 'loading'
  | 'disabled'
  | 'unconfigured'
  | 'unavailable'
  | 'stale'
  | 'available'
  | 'empty';

export function deriveViewState(body: DataAdminResponse | null | undefined): ViewState {
  if (!body) return 'loading';
  if (body.degraded) return 'unavailable';
  switch (body.state) {
    case 'disabled':
      return 'disabled';
    case 'unconfigured':
      return 'unconfigured';
    case 'unavailable':
      return 'unavailable';
    case 'available':
      if (!Array.isArray(body.sources) || body.sources.length === 0) return 'empty';
      return body.stale ? 'stale' : 'available';
    default:
      return 'unavailable';
  }
}

/** Safe reason codes → operator wording. Unknown codes are shown verbatim (they are codes, not errors). */
const REASON_TEXT: Record<string, string> = {
  foundation_disabled: 'Foundation read API is switched off (GIDEON_FOUNDATION_ENABLED=0).',
  dsn_missing: 'No reader connection configured for the foundation API.',
  sidecar_unreachable: 'The Fusion sidecar did not answer in time.',
  timeout: 'The GIDEON database did not answer within the query budget.',
  connection_failed: 'The GIDEON database connection failed.',
  authentication_failed: 'The reader login was rejected by the GIDEON database.',
  insufficient_privilege: 'The reader login lacks a required grant.',
  relation_missing: 'A required GIDEON table or view is missing.',
  schema_mismatch: 'The GIDEON schema revision does not match the reviewed revision.',
  query_failed: 'A reviewed aggregate query failed.',
};

export function describeReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return REASON_TEXT[reason] ?? reason;
}

/** Format a count for display: unknown stays unknown, never "0". */
export function formatCount(ds: Pick<DatasetCount, 'count' | 'count_kind'>): string {
  if (ds.count === null || ds.count === undefined || ds.count_kind === 'unknown') return 'unknown';
  return ds.count.toLocaleString('en-US');
}

export function formatCountKind(kind: CountKind): string {
  switch (kind) {
    case 'live_count': return 'live count';
    case 'published_count': return 'published count';
    case 'source_count': return 'source count';
    default: return 'unknown';
  }
}

/** Compact flag glyph text (no colour dependence). */
export function flagText(flag: FlagValue | undefined): 'yes' | 'no' | 'unknown' {
  if (!flag || flag.value === null || flag.value === undefined) return 'unknown';
  return flag.value ? 'yes' : 'no';
}

export function formatSourcePeriod(period: SourcePeriod | null | undefined): string {
  if (!period || period.value === null || period.value === undefined) return 'unknown';
  if (typeof period.value === 'string') return period.value;
  const parts = Object.entries(period.value).map(([k, v]) => {
    const rendered = Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? 'unknown' : String(v);
    return `${k}: ${rendered}`;
  });
  return parts.length ? parts.join(' · ') : 'unknown';
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, 'Z');
}

/** Dispositions that mean the source has no live tables and must not show counts. */
export const NON_LIVE_DISPOSITIONS = new Set(['blocked', 'deferred']);

export function isNonLive(source: Pick<DataAdminSource, 'disposition' | 'datasets'>): boolean {
  return NON_LIVE_DISPOSITIONS.has(source.disposition) || source.datasets.length === 0;
}

export type LoadedBadgeTone = 'loaded' | 'not_loaded' | 'unknown' | 'blocked' | 'deferred';

export interface LoadedBadge {
  label: string;
  tone: LoadedBadgeTone;
  /** `flags.loaded.value` for live sources; static dispositions carry no live value. */
  liveValue: boolean | null;
}

/**
 * The card badge follows the live `loaded` flag, never the static disposition alone:
 * a `loaded` disposition with a false/unknown live flag must not read LOADED.
 */
export function loadedBadge(source: Pick<DataAdminSource, 'disposition' | 'datasets' | 'flags'>): LoadedBadge {
  if (source.disposition === 'blocked') return { label: 'BLOCKED · NOT LOADED', tone: 'blocked', liveValue: null };
  if (source.disposition === 'deferred') return { label: 'DEFERRED', tone: 'deferred', liveValue: null };
  const manual = source.disposition === 'loaded_manual' ? ' · MANUAL ONLY' : '';
  const value = source.flags?.loaded?.value ?? null;
  if (value === true) return { label: `LOADED${manual}`, tone: 'loaded', liveValue: true };
  if (value === false) return { label: `NOT LOADED${manual}`, tone: 'not_loaded', liveValue: false };
  return { label: `LOADED: UNKNOWN${manual}`, tone: 'unknown', liveValue: null };
}

/** Mirrors the sidecar's STALE_MAX_AGE_S: a retained payload older than this is dropped. */
export const RETAINED_MAX_AGE_S = 6 * 3600;

/** Browser-side feed state; the view is derived from it by `resolveView`, never from the body alone. */
export interface FeedState {
  body: DataAdminResponse | null;
  /** Wall-clock instant the current `body` was received by the browser. */
  bodyAt: string | null;
  fetchError: string | null;
  fetchedAt: string | null;
  recovered: boolean;
}

export const INITIAL_FEED: FeedState = { body: null, bodyAt: null, fetchError: null, fetchedAt: null, recovered: false };

export type FeedEvent =
  | { type: 'response'; body: DataAdminResponse; at: string }
  | { type: 'failure'; message: string; at: string };

export type StaleOrigin = 'server' | 'browser' | null;

export interface ResolvedView {
  view: ViewState;
  /** Which side failed when `view` is `stale`: the sidecar refresh or this browser's fetch. */
  staleOrigin: StaleOrigin;
  /** Seconds since the retained body was last confirmed good (sidecar cache age included). */
  retainedAgeS: number | null;
  /** Body safe to render (null once the retained payload has aged out). */
  body: DataAdminResponse | null;
}

function ageSeconds(fromIso: string | null, nowIso: string): number | null {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  const now = new Date(nowIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(now)) return null;
  return Math.max(0, Math.round((now - from) / 1000));
}

/**
 * A browser/network/JSON failure after a good payload renders `stale` (retained data,
 * explicit) while the retained payload is younger than RETAINED_MAX_AGE_S, otherwise
 * `unavailable`; it never renders the old body as fresh `available`.
 */
export function resolveView(state: FeedState, nowIso: string, maxAgeS: number = RETAINED_MAX_AGE_S): ResolvedView {
  const { body, bodyAt, fetchError } = state;
  if (!fetchError) {
    const view = deriveViewState(body);
    return { view, staleOrigin: view === 'stale' ? 'server' : null, retainedAgeS: body?.cache_age_s ?? null, body };
  }
  const retainedView = deriveViewState(body);
  const retainable = retainedView === 'available' || retainedView === 'stale' || retainedView === 'empty';
  const browserAge = ageSeconds(bodyAt, nowIso);
  if (!body || !retainable || browserAge === null) {
    return { view: 'unavailable', staleOrigin: null, retainedAgeS: null, body: null };
  }
  const retainedAgeS = browserAge + (body.cache_age_s ?? 0);
  if (retainedAgeS >= maxAgeS) return { view: 'unavailable', staleOrigin: null, retainedAgeS, body: null };
  return { view: 'stale', staleOrigin: 'browser', retainedAgeS, body };
}

export function reduceFeed(prev: FeedState, event: FeedEvent): FeedState {
  const prevView = resolveView(prev, event.at).view;
  if (event.type === 'failure') {
    return { ...prev, fetchError: event.message, fetchedAt: event.at, recovered: false };
  }
  const next: FeedState = { body: event.body, bodyAt: event.at, fetchError: null, fetchedAt: event.at, recovered: false };
  const nextView = deriveViewState(event.body);
  next.recovered = nextView === 'available' && (prevView === 'unavailable' || prevView === 'stale');
  return next;
}
