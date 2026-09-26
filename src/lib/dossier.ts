/**
 * GIDEON E2 dossier contract (`e2-dossier/1.0`) — the prospect-safe, read-only
 * Las Bambas–Pillones–Matarani dossier served by the Fusion sidecar
 * (`GET /api/v1/foundation/dossiers/{dossier_id}`) and reached through the
 * same-origin `/api/fusion/dossiers/las-bambas-matarani` proxy. The payload is already an explicit
 * public allowlist (no reviewer/actor identities, excluded details, run ids,
 * raw errors or restricted-source derivatives); this module only types, groups
 * and formats it. Nothing here calls a model or joins demo data.
 */

import { DOSSIER_ID_TOKEN, LAS_BAMBAS_ID } from './dossier-registry';

export const DOSSIER_ID = LAS_BAMBAS_ID;
export const SCHEMA_VERSION = 'e2-dossier/1.0';

export type DossierState = 'available' | 'stale' | 'not_published' | 'withdrawn' | 'unavailable';

export const PROXY_PATH = '/api/fusion/dossiers/las-bambas-matarani';

/** F01 structured predicates plus the accepted-document (verified quotation) predicates. */
export type Predicate =
  | 'owns_equity'
  | 'has_accounting_parent'
  | 'finances'
  | 'holds_role_in'
  | 'operates'
  | 'transports_to'
  | 'reported_event_affects'
  | 'reports_operating_metric';

export type EntityKind =
  | 'organization'
  | 'mining_asset'
  | 'loan_event'
  | 'port'
  | 'transport_node'
  | 'logistics_facility'
  | 'reported_event';

export interface Attempt {
  started_at: string | null;
  ended_at: string | null;
  status: string;
  outcome: string;
}

export interface Currentness {
  /** null for the state-only states (withdrawn, not_published). */
  publication_no: number | null;
  eligibility_established_at: string | null;
  eligibility_changed_at: string | null;
  restored: boolean;
  latest_attempt: Attempt | null;
  last_successful_refresh: Attempt | null;
}

export interface Entity {
  id: string;
  version: number;
  kind: EntityKind;
  label: string | null;
  resolution: string;
  sources: string[];
  evidence: string[];
}

export interface Edge {
  id: string;
  version: number;
  predicate: Predicate;
  subject: string;
  object: string;
  evidence_category: string;
  evidence: string[];
  value: Record<string, unknown> | null;
  temporal: Record<string, unknown> | null;
  scope: Record<string, unknown> | null;
  correction: { from_version: number } | null;
}

export interface Assertion {
  id: string;
  version: number;
  predicate: Predicate;
  evidence_category: string;
  currentness: 'current' | 'historical' | 'unknown';
  confidence: string | null;
}

export interface Gap {
  key: string | null;
  kind: string;
  detail: string;
  count: number | null;
}

export interface StructuredRecordEvidence {
  ref: string;
  kind: 'structured_record';
  source_id: string;
  table: string;
  native_key: Record<string, string>;
  release_label: string | null;
  record_origin: string;
  payload_sha256: string;
  attribution: string | null;
}

/** Textual locator inside a verified document; rendered as text, never as a link. */
export interface DocumentLocator {
  kind: string | null;
  page: string | number | null;
  section: string | null;
}

/**
 * E1 verified-quotation evidence as projected by Fusion: digest and verification
 * timestamp are structurally required upstream; the verifier identity and the quoted
 * text are never in the payload.
 */
export interface DocumentLocatorEvidence {
  ref: string;
  kind: 'document_locator';
  source_id: 'DOC' | string;
  document_id: string;
  url: string | null;
  locator: DocumentLocator | null;
  document_sha256: string;
  document_published_at: string | null;
  retrieved_at: string | null;
  quotation_verified_at: string;
  verification: 'quotation_verified' | string;
  text_redistributed: false;
}

export type EvidenceEntry = StructuredRecordEvidence | DocumentLocatorEvidence;

/** Only http(s) URLs are ever rendered as links; anything else stays text-less. */
export function safeHttpUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  return /^https?:\/\/[^\s]+$/i.test(url) ? url : null;
}

/** `locator {kind, page, section}` → one text line; missing parts are omitted, never invented. */
export function formatLocator(locator: DocumentLocator | null | undefined): string {
  if (!locator || typeof locator !== 'object') return 'locator unknown';
  const parts: string[] = [];
  if (typeof locator.kind === 'string' && locator.kind) parts.push(locator.kind);
  if (locator.page !== null && locator.page !== undefined && locator.page !== '') parts.push(`page ${String(locator.page)}`);
  if (typeof locator.section === 'string' && locator.section) parts.push(`section “${locator.section}”`);
  return parts.length ? parts.join(' · ') : 'locator unknown';
}

export interface WhatChanged {
  kind: 'initial' | 'revision';
  previous_publication_no?: number;
  edges_added?: string[];
  edges_removed?: string[];
  edges_reversioned?: string[];
}

export interface Publication {
  publication_no: number;
  created_at: string;
  audience: 'prospect';
  contract: string;
  config_version: string;
  rights_version: string;
  bundle_fingerprint: string;
  rule_versions: { mapping: string; projection: string };
  what_changed: WhatChanged;
  entities: Entity[];
  edges: Edge[];
  assertions: Assertion[];
  narrative: string[];
  gap_register: Gap[];
  attribution: { source_id: string; attribution: string }[];
  evidence_manifest: EvidenceEntry[];
}

/** Sidecar body for 200 (available/stale/not_published/withdrawn) and 503 (unavailable). */
export interface DossierResponse {
  schema_version: string;
  dossier_id: string | null;
  state: DossierState;
  reason: string | null;
  checked_at: string;
  origin: 'replay_demonstration' | 'hosted_records' | string;
  currentness: Currentness | null;
  evidence_origins: string[];
  publication: Publication | null;
  /** Set by the Next proxy when the sidecar itself could not be reached or answered outside the contract. */
  degraded?: boolean;
}

export const PROXY_UNAVAILABLE_REASON = 'sidecar_unreachable';

export function unavailableResponse(reason: string, dossierId: string | null = DOSSIER_ID): DossierResponse {
  return {
    schema_version: SCHEMA_VERSION,
    dossier_id: dossierId,
    state: 'unavailable',
    reason,
    checked_at: new Date().toISOString(),
    origin: 'replay_demonstration',
    currentness: null,
    evidence_origins: [],
    publication: null,
    degraded: true,
  };
}

export const CONTRACT_INVALID_REASON = 'sidecar_contract_invalid';

const STATES: ReadonlySet<string> = new Set<DossierState>(['available', 'stale', 'not_published', 'withdrawn', 'unavailable']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isNullableString(v: unknown): boolean {
  return v === null || typeof v === 'string';
}

function isNullableRecord(v: unknown): boolean {
  return v === null || v === undefined || isRecord(v);
}

function isAttempt(v: unknown): boolean {
  if (v === null) return true;
  return isRecord(v) && isNullableString(v.started_at) && isNullableString(v.ended_at)
    && typeof v.status === 'string' && typeof v.outcome === 'string';
}

function isCurrentness(v: unknown, claims: boolean): boolean {
  return isRecord(v) && (typeof v.publication_no === 'number' || (!claims && v.publication_no === null))
    && isNullableString(v.eligibility_established_at) && isNullableString(v.eligibility_changed_at)
    && typeof v.restored === 'boolean' && isAttempt(v.latest_attempt) && isAttempt(v.last_successful_refresh);
}

function isEntity(v: unknown): boolean {
  return isRecord(v) && typeof v.id === 'string' && typeof v.kind === 'string' && isNullableString(v.label)
    && isStringArray(v.sources) && isStringArray(v.evidence);
}

function isEdge(v: unknown): boolean {
  return isRecord(v) && typeof v.id === 'string' && typeof v.predicate === 'string'
    && typeof v.subject === 'string' && typeof v.object === 'string' && typeof v.evidence_category === 'string'
    && isStringArray(v.evidence) && isNullableRecord(v.value) && isNullableRecord(v.temporal)
    && isNullableRecord(v.scope) && isNullableRecord(v.correction)
    && isEdgeValueForPredicate(v.predicate, v.value);
}

/**
 * `has_accounting_parent` (holder → parent, same F01 ownership row as `owns_equity`): a
 * dataset-vintage accounting-parent label carrying only an optional `parent_type` string.
 * It is not an equity share, control assertion, route or destination, so a value that
 * carries anything but a string/null `parent_type` is outside the contract.
 */
function isEdgeValueForPredicate(predicate: string, value: unknown): boolean {
  if (predicate !== 'has_accounting_parent') return true;
  if (!isRecord(value)) return false;
  return Object.keys(value).every((k) => k === 'parent_type') && isNullableString(value.parent_type ?? null);
}

function isAssertion(v: unknown): boolean {
  return isRecord(v) && typeof v.id === 'string' && typeof v.predicate === 'string'
    && typeof v.currentness === 'string' && isNullableString(v.confidence);
}

function isGap(v: unknown): boolean {
  return isRecord(v) && isNullableString(v.key) && typeof v.kind === 'string' && typeof v.detail === 'string'
    && (v.count === null || typeof v.count === 'number');
}

function isEvidenceEntry(v: unknown): boolean {
  if (!isRecord(v) || typeof v.ref !== 'string') return false;
  if (v.kind === 'structured_record') {
    return typeof v.source_id === 'string' && typeof v.table === 'string' && isRecord(v.native_key)
      && Object.values(v.native_key).every((x) => typeof x === 'string') && isNullableString(v.attribution);
  }
  if (v.kind === 'document_locator') {
    return typeof v.document_id === 'string' && isNullableString(v.url) && isNullableRecord(v.locator)
      && typeof v.document_sha256 === 'string' && typeof v.quotation_verified_at === 'string';
  }
  return false;
}

function isPublication(v: unknown): boolean {
  if (!isRecord(v)) return false;
  if (typeof v.publication_no !== 'number' || typeof v.created_at !== 'string' || typeof v.contract !== 'string'
    || typeof v.bundle_fingerprint !== 'string') return false;
  const rules = v.rule_versions;
  if (!isRecord(rules) || typeof rules.mapping !== 'string' || typeof rules.projection !== 'string') return false;
  const w = v.what_changed;
  if (!isRecord(w) || (w.kind !== 'initial' && w.kind !== 'revision')) return false;
  for (const k of ['edges_added', 'edges_removed', 'edges_reversioned']) {
    if (w[k] !== undefined && !isStringArray(w[k])) return false;
  }
  return Array.isArray(v.entities) && v.entities.every(isEntity)
    && Array.isArray(v.edges) && v.edges.every(isEdge)
    && Array.isArray(v.assertions) && v.assertions.every(isAssertion)
    && isStringArray(v.narrative)
    && Array.isArray(v.gap_register) && v.gap_register.every(isGap)
    && Array.isArray(v.attribution)
    && v.attribution.every((a) => isRecord(a) && typeof a.source_id === 'string' && typeof a.attribution === 'string')
    && Array.isArray(v.evidence_manifest) && v.evidence_manifest.every(isEvidenceEntry);
}

/**
 * Bounded contract guard shared by the proxy and the browser: exactly the shape the page
 * renders. Envelope fields are always checked; `currentness` and `publication` must be
 * present, well-formed objects whenever the body claims `available`/`stale`; for the
 * state-only states `publication` must be null and `currentness` null or well-formed.
 * Anything else is not a dossier answer and is never stored, forwarded or rendered — the
 * caller turns it into state-only `unavailable`. `expectedDossierId` (default Las Bambas) rejects
 * any answer about a different dossier, so content is never rendered under another requested id.
 */
export function isDossierResponse(body: unknown, expectedDossierId: string = DOSSIER_ID): body is DossierResponse {
  if (!isRecord(body)) return false;
  if (body.schema_version !== SCHEMA_VERSION) return false;
  if (typeof body.state !== 'string' || !STATES.has(body.state)) return false;
  if (body.dossier_id !== null && (typeof body.dossier_id !== 'string' || !DOSSIER_ID_TOKEN.test(body.dossier_id))) return false;
  if (body.dossier_id !== null && body.dossier_id !== expectedDossierId) return false;
  if (!isNullableString(body.reason) || typeof body.checked_at !== 'string' || typeof body.origin !== 'string') return false;
  if (!isStringArray(body.evidence_origins)) return false;
  if (body.degraded !== undefined && typeof body.degraded !== 'boolean') return false;
  const claims = body.state === 'available' || body.state === 'stale';
  if (claims) return isCurrentness(body.currentness, true) && isPublication(body.publication);
  return body.publication === null && (body.currentness === null || isCurrentness(body.currentness, false));
}

/** Closed set of sidecar reason codes → analyst wording. Unknown codes render verbatim. */
const REASON_TEXT: Record<string, string> = {
  feature_disabled: 'The dossier API is switched off (GIDEON_DOSSIER_ENABLED=0).',
  store_unconfigured: 'No E1 publication store is mounted for the dossier reader.',
  store_unreadable: 'The E1 publication store could not be read.',
  sidecar_unreachable: 'The Fusion sidecar did not answer in time.',
  sidecar_contract_invalid: 'The Fusion sidecar answered outside the dossier contract; nothing from that answer is shown.',
  dossier_route_missing: 'The Fusion sidecar release has no dossier route.',
  query_parameters_rejected: 'Query parameters are not accepted on the dossier route.',
  method_not_allowed: 'Only GET is accepted on the dossier route.',
  rate_limited: 'Too many dossier requests from this client.',
  browser_fetch_failed: 'This browser could not reach the dossier proxy; current eligibility cannot be checked.',
  browser_fetch_timeout: 'The dossier proxy did not answer this browser within the request deadline.',
  browser_response_malformed: 'The dossier proxy answer could not be parsed.',
  no_publication: 'No prospect publication has been produced for this dossier yet.',
  eligibility_withdrawn: 'The current publication was withdrawn (rights, review or evidence eligibility changed).',
  publication_invalidated: 'The current publication was invalidated by the publisher.',
  pointer_missing: 'The current-publication pointer is missing.',
  pointer_malformed: 'The current-publication pointer is malformed.',
  eligibility_unknown: 'The current-publication pointer carries an unknown eligibility.',
  publication_missing: 'The pointed-to publication file is missing.',
  publication_malformed: 'The pointed-to publication is malformed.',
  publication_unsupported: 'The publication contains content outside the public contract.',
  restricted_content_detected: 'Restricted-source content was detected and the dossier was withheld.',
  establishing_run_missing: 'The run that established eligibility is missing.',
  establishing_run_incompatible: 'The run that established eligibility does not match the pointer.',
  establishment_pending: 'The establishing run has not finished.',
  creation_run_missing: 'The publication creation run is missing.',
  creation_run_incompatible: 'The publication creation run does not match the publication.',
  run_malformed: 'A run record is malformed.',
  history_limit_exceeded: 'The run history exceeds the bounded reader limit.',
  authority_changed: 'The publication store changed while it was being read.',
  reader_busy: 'The dossier reader is busy.',
  reader_timeout: 'The dossier read exceeded its deadline.',
  latest_attempt_failed: 'The latest refresh attempt failed; the last eligible publication is shown.',
  latest_attempt_running: 'A refresh attempt is running; the last eligible publication is shown.',
  latest_attempt_partial: 'The latest refresh attempt completed only partially; the last eligible publication is shown.',
  latest_attempt_publish_skipped: 'The latest attempt did not publish; the last eligible publication is shown.',
  latest_attempt_unqualified: 'The latest attempt did not confirm the current publication; it is shown as stale.',
};

export function describeReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return REASON_TEXT[reason] ?? reason;
}

export type ViewState = 'loading' | DossierState;

/** Wire state → render state. A degraded proxy or missing publication never renders as available. */
export function deriveViewState(body: DossierResponse | null | undefined): ViewState {
  if (!body) return 'loading';
  if (body.degraded) return 'unavailable';
  switch (body.state) {
    case 'available':
    case 'stale':
      return body.publication ? body.state : 'unavailable';
    case 'not_published':
    case 'withdrawn':
    case 'unavailable':
      return body.state;
    default:
      return 'unavailable';
  }
}

/** Browser-side feed; the page derives its view from this, never from a body alone. */
export interface FeedState {
  /** Body of the newest server answer, or null after any browser-side failure. */
  body: DossierResponse | null;
  bodyAt: string | null;
  /** Browser-side reason code (`browser_fetch_failed` | `browser_fetch_timeout` | `browser_response_malformed`). */
  fetchError: string | null;
  fetchedAt: string | null;
  /** Monotonic generation of the newest event applied; older generations are ignored. */
  generation: number;
}

export const INITIAL_FEED: FeedState = { body: null, bodyAt: null, fetchError: null, fetchedAt: null, generation: 0 };

export type BrowserFailure = 'browser_fetch_failed' | 'browser_fetch_timeout' | 'browser_response_malformed';

/** Every event carries the generation of the request that produced it. */
export type FeedEvent =
  | { type: 'response'; body: DossierResponse; at: string; generation: number }
  | { type: 'failure'; reason: BrowserFailure; at: string; generation: number }
  | { type: 'reset'; generation: number };

export interface ResolvedView {
  view: ViewState;
  /** `server` when the sidecar itself reported stale. Browsers never originate stale. */
  staleOrigin: 'server' | null;
  body: DossierResponse | null;
}

/**
 * The browser is not an authority: any browser-side failure (network, timeout, malformed
 * answer) renders state-only `unavailable` with NO retained claims, because current
 * eligibility cannot be checked. `stale` exists only when the server confirmed it
 * (valid current publication, latest attempt not a qualifying refresh).
 */
export function resolveView(state: FeedState): ResolvedView {
  if (state.fetchError) return { view: 'unavailable', staleOrigin: null, body: null };
  const view = deriveViewState(state.body);
  return { view, staleOrigin: view === 'stale' ? 'server' : null, body: state.body };
}

/**
 * Generation guard: an event from an older request than the newest applied one is dropped,
 * so a slow `available` answer can never overwrite a later `withdrawn`/`unavailable`
 * (or vice versa). A failure clears the body: nothing is served from history.
 */
export function reduceFeed(prev: FeedState, event: FeedEvent): FeedState {
  if (event.type === 'reset') return { ...INITIAL_FEED, generation: Math.max(prev.generation, event.generation) };
  if (event.generation <= prev.generation) return prev;
  if (event.type === 'failure') {
    return { body: null, bodyAt: null, fetchError: event.reason, fetchedAt: event.at, generation: event.generation };
  }
  return { body: event.body, bodyAt: event.at, fetchError: null, fetchedAt: event.at, generation: event.generation };
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, 'Z');
}

/** Native strings are kept as strings; format only for display, never re-typed. */
export function formatUsd(native: unknown): string {
  if (typeof native !== 'string' || native.trim() === '') return 'Not reported';
  const n = Number(native);
  if (!Number.isFinite(n)) return native;
  return `USD ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatFraction(native: unknown): string {
  if (typeof native !== 'string' || native.trim() === '') return 'unknown';
  const n = Number(native);
  if (!Number.isFinite(n)) return native;
  return `${(n * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })} %`;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

export interface OwnershipRow {
  edge: Edge;
  holder: string;
  asset: string;
  share: string;
  holderType: string;
  origin: string;
  asOf: string;
}

/** Dataset-vintage accounting parent of an equity holder; not an ownership share or control statement. */
export interface AccountingParentRow {
  edge: Edge;
  holder: string;
  parent: string;
  parentType: string;
  asOf: string;
}

export interface FinanceRow {
  edge: Edge;
  lender: string;
  asset: string;
  instrument: string;
  flowType: string;
  status: string;
  nominal: string;
  year: string;
  loanEvent: string | null;
  loanEventLabel: string;
  tranche: string | null;
}

export interface RoleRow {
  edge: Edge;
  organization: string;
  asset: string;
  role: string;
  rows: string;
}

export interface OperatorRow {
  edge: Edge;
  operator: string;
  asset: string;
  /** F01 structured operator type, or the document-reported form when the claim carries no value. */
  operatorType: string;
}

/** Document-reported physical link (`transports_to`): a quoted statement, not observed movement. */
export interface TransportRow {
  edge: Edge;
  from: string;
  to: string;
  commodity: string;
  mode: string;
}

/**
 * Document-reported operating figure (`reports_operating_metric`). Product and basis are
 * shown exactly as published: gross concentrate mass is not copper contained, guidance or
 * design capacity is not actual output, and a port cargo share is not a movement count.
 */
export interface OperatingRow {
  edge: Edge;
  reporter: string;
  asset: string;
  metric: string;
  product: string;
  quantity: string;
  basis: string;
  period: string;
  documentDate: string;
  /**
   * Denominator of a reported share (`scope.share_of`), e.g. "share of total cargo handled by
   * Matarani". Only present for share metrics; never inferred for quantities.
   */
  shareOf: string | null;
}

const OPERATING_PRODUCT_TEXT: Record<string, string> = {
  copper_concentrate: 'copper concentrate (gross concentrate mass)',
  copper_contained: 'copper contained in concentrate (metal, not concentrate mass)',
  terminal_cargo: 'terminal cargo',
};

const OPERATING_BASIS_TEXT: Record<string, string> = {
  actual: 'actual figure',
  design: 'design/nameplate capacity, not actual output',
  guidance: 'forward guidance, not actual output',
  reported_share: 'reported share, not a movement count',
};

const OPERATING_UNIT_TEXT: Record<string, string> = { tonnes: 't', tonnes_per_year: 't/yr', percent: '%' };

/** Product as published; a null product (metric with a period but no figure) stays visibly unknown. */
export function formatOperatingProduct(product: unknown): string {
  const p = str(product);
  return p === null ? 'Not published' : OPERATING_PRODUCT_TEXT[p] ?? p;
}

/**
 * Denominator context of a reported share: the numerator asset's share of the total cargo
 * handled by the `share_of` entity — not a share of the asset's output or of national exports.
 */
export function formatShareOf(entities: Map<string, Entity>, asset: string, shareOf: unknown): string | null {
  const d = str(shareOf);
  if (d === null) return null;
  return `${asset}'s share of total cargo handled by ${labelOf(entities, d)} (not a share of ${asset}'s output or of national exports)`;
}

/** Quantity + unit as published; a null quantity is "not published", never zero. */
export function formatOperatingQuantity(quantity: unknown, unit: unknown): string {
  const q = str(quantity);
  if (q === null) return 'Not published';
  const u = str(unit);
  return u === null ? q : `${q} ${OPERATING_UNIT_TEXT[u] ?? u}`;
}

/** Reporting period from source-relative bounds; open bounds stay visible as such. */
export function formatPeriod(start: unknown, end: unknown): string {
  const s = str(start);
  const e = str(end);
  if (s && e) return s === e ? s : `${s} → ${e}`;
  if (s) return `from ${s}`;
  if (e) return `to ${e}`;
  return 'period unknown';
}

/** Document-reported event affecting a node (`reported_event_affects`). */
export interface ReportedEventRow {
  edge: Edge;
  event: string;
  affects: string;
  kind: string;
}

export interface Grouped {
  entities: Map<string, Entity>;
  ownership: OwnershipRow[];
  accountingParents: AccountingParentRow[];
  operators: OperatorRow[];
  finance: FinanceRow[];
  roles: RoleRow[];
  /** Physical route links reported in accepted verified documents (`transports_to`). Empty when unpublished. */
  physical: TransportRow[];
  /** Reported events affecting route nodes (`reported_event_affects`). */
  reportedEvents: ReportedEventRow[];
  /** Document-reported operating baseline (`reports_operating_metric`). Empty when none is published. */
  operating: OperatingRow[];
  gaps: Gap[];
  routeGaps: Gap[];
  /** Operator-declared explicit unknowns (E3A C2 kinds) — always shown, never resolved by the UI. */
  declaredUnknowns: Gap[];
  loanEvents: Entity[];
  evidenceByRef: Map<string, EvidenceEntry>;
  assertionsByEdge: Map<string, Assertion>;
}

export const PHYSICAL_ENTITY_KINDS = new Set<EntityKind>(['port', 'transport_node', 'logistics_facility']);
export const DOCUMENT_PREDICATES = new Set<Predicate>(['transports_to', 'reported_event_affects', 'reports_operating_metric']);
export const ROUTE_GAP_KINDS = new Set(['route_unpublished', 'document_unverified', 'segment_unevidenced']);
/** E3A validated public-safe declared gap kinds (closed set; the sidecar rejects any other). */
export const DECLARED_GAP_KINDS = new Set(['offtake_unknown', 'recovery_unknown', 'alternatives_unknown', 'baseline_currentness']);

export function labelOf(entities: Map<string, Entity>, id: string): string {
  return entities.get(id)?.label ?? id;
}

/** Group edges by relationship family. Unknown predicates are dropped, never guessed. */
export function groupPublication(pub: Publication): Grouped {
  const entities = new Map(pub.entities.map((e) => [e.id, e]));
  const evidenceByRef = new Map(pub.evidence_manifest.map((m) => [m.ref, m]));
  const assertionsByEdge = new Map(pub.assertions.map((a) => [a.id, a]));
  const ownership: OwnershipRow[] = [];
  const accountingParents: AccountingParentRow[] = [];
  const operators: OperatorRow[] = [];
  const finance: FinanceRow[] = [];
  const roles: RoleRow[] = [];
  const physical: TransportRow[] = [];
  const reportedEvents: ReportedEventRow[] = [];
  const operating: OperatingRow[] = [];
  for (const edge of pub.edges) {
    const v = edge.value ?? {};
    const t = edge.temporal ?? {};
    const s = edge.scope ?? {};
    const subject = labelOf(entities, edge.subject);
    const object = labelOf(entities, edge.object);
    switch (edge.predicate) {
      case 'owns_equity':
        ownership.push({
          edge,
          holder: subject,
          asset: object,
          share: formatFraction(v.equity_fraction_native),
          holderType: str(v.equity_holder_type) ?? 'unknown',
          origin: str(v.equity_holder_origin) ?? 'unknown',
          asOf: str(t.as_of) ?? 'unknown',
        });
        break;
      case 'has_accounting_parent':
        accountingParents.push({
          edge,
          holder: subject,
          parent: object,
          parentType: str(v.parent_type) ?? 'unknown',
          asOf: str(t.as_of) ?? 'unknown',
        });
        break;
      case 'operates':
        operators.push({
          edge,
          operator: subject,
          asset: object,
          operatorType: edge.value === null
            ? `reported operator (document, ${str(t.document_published_at) ?? 'date not established'})`
            : str(v.operator_type) ?? 'unknown',
        });
        break;
      case 'finances': {
        const loanEvent = str(v.loan_event);
        finance.push({
          edge,
          lender: subject,
          asset: object,
          instrument: str(v.instrument) ?? 'unknown',
          flowType: str(v.flow_type) ?? 'unknown',
          status: str(v.status) ?? 'unknown',
          nominal: formatUsd(v.amount_nominal_usd_native),
          year: str(t.commitment_year) ?? str(t.commitment_date) ?? 'unknown',
          loanEvent,
          loanEventLabel: loanEvent ? labelOf(entities, loanEvent) : 'unknown',
          tranche: str(v.loan_event_tranche),
        });
        break;
      }
      case 'holds_role_in':
        roles.push({
          edge,
          organization: subject,
          asset: object,
          role: str(v.role) ?? 'unknown',
          rows: typeof v.rows === 'number' ? String(v.rows) : 'unknown',
        });
        break;
      case 'transports_to':
        physical.push({ edge, from: subject, to: object, commodity: str(s.commodity) ?? 'unknown', mode: str(s.mode) ?? 'unknown' });
        break;
      case 'reported_event_affects':
        reportedEvents.push({ edge, event: subject, affects: object, kind: str(s.kind) ?? 'unknown' });
        break;
      case 'reports_operating_metric': {
        const basis = str(v.basis);
        operating.push({
          edge,
          reporter: subject,
          asset: object,
          metric: str(v.metric) ?? 'unknown',
          product: formatOperatingProduct(v.product),
          quantity: formatOperatingQuantity(v.quantity, v.unit),
          basis: basis ? OPERATING_BASIS_TEXT[basis] ?? basis : 'unknown',
          period: formatPeriod(t.period_start, t.period_end),
          documentDate: str(t.document_published_at) ?? 'not established',
          shareOf: formatShareOf(entities, object, s.share_of),
        });
        break;
      }
      default:
        // Unknown predicate: dropped, never guessed into a family.
        break;
    }
  }
  const byLabel = (a: { holder?: string; lender?: string; organization?: string }, b: typeof a) =>
    (a.holder ?? a.lender ?? a.organization ?? '').localeCompare(b.holder ?? b.lender ?? b.organization ?? '');
  ownership.sort(byLabel);
  accountingParents.sort(byLabel);
  finance.sort((a, b) => byLabel(a, b) || b.year.localeCompare(a.year));
  roles.sort((a, b) => byLabel(a, b) || a.role.localeCompare(b.role));
  return {
    entities,
    ownership,
    accountingParents,
    operators,
    finance,
    roles,
    physical,
    reportedEvents,
    operating,
    // E1's context_withheld covers both absent and withheld inputs. Do not
    // imply that an input exists when this projection cannot establish that.
    gaps: pub.gap_register.map((g) => g.kind === 'context_withheld'
      ? { ...g, detail: 'No additional context is included in this publication.' }
      : g),
    routeGaps: pub.gap_register.filter((g) => ROUTE_GAP_KINDS.has(g.kind)),
    declaredUnknowns: pub.gap_register.filter((g) => DECLARED_GAP_KINDS.has(g.kind)),
    loanEvents: pub.entities.filter((e) => e.kind === 'loan_event'),
    evidenceByRef,
    assertionsByEdge,
  };
}

/** Human summary of `what_changed`; the initial publication has no prior to compare against. */
export function describeChange(pub: Publication): string {
  const w = pub.what_changed;
  if (w.kind === 'initial') return 'Initial publication — no qualifying changes in reviewed evidence.';
  const added = w.edges_added?.length ?? 0;
  const removed = w.edges_removed?.length ?? 0;
  const reversioned = w.edges_reversioned?.length ?? 0;
  if (added + removed + reversioned === 0) return 'Revision with no qualifying changes in reviewed evidence.';
  return `Revision of publication ${w.previous_publication_no ?? '?'}: ${added} added, ${removed} removed, ${reversioned} reversioned relationship(s).`;
}

/** Fixture / replay origins are labelled as demonstration, never as hosted intelligence. */
export function isReplay(body: Pick<DossierResponse, 'origin' | 'evidence_origins'>): boolean {
  const real = new Set(['hosted_record', 'retained_source', 'verified_document']);
  return !['hosted_records', 'retained_source', 'verified_documents'].includes(body.origin)
    || body.evidence_origins.length === 0
    || body.evidence_origins.some((o) => !real.has(o));
}

/** Correct the legacy null-amount sentence for display without mutating evidence. */
export function displayNarrative(text: string): string {
  return text.replaceAll('USD None (nominal)', 'an unreported nominal USD amount');
}
