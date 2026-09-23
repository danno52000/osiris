/**
 * GIDEON E2 dossier contract (`e2-dossier/1.0`) — the prospect-safe, read-only
 * Las Bambas–Pillones–Matarani dossier served by the Fusion sidecar
 * (`GET /api/v1/foundation/dossiers/{dossier_id}`) and reached through the
 * same-origin `/api/fusion/dossier` proxy. The payload is already an explicit
 * public allowlist (no reviewer/actor identities, excluded details, run ids,
 * raw errors or restricted-source derivatives); this module only types, groups
 * and formats it. Nothing here calls a model or joins demo data.
 */

export const DOSSIER_ID = 'las-bambas-matarani';
export const SCHEMA_VERSION = 'e2-dossier/1.0';

export type DossierState = 'available' | 'stale' | 'not_published' | 'withdrawn' | 'unavailable';

export type Predicate = 'owns_equity' | 'finances' | 'holds_role_in' | 'operates';

export type EntityKind = 'organization' | 'mining_asset' | 'loan_event' | 'port' | 'transport_node';

export interface Attempt {
  started_at: string | null;
  ended_at: string | null;
  status: string;
  outcome: string;
}

export interface Currentness {
  publication_no: number;
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

export interface DocumentEvidence {
  ref: string;
  kind: 'document';
  source_id: string;
  locator: string;
  sha256: string;
  verification: string;
}

export type EvidenceEntry = StructuredRecordEvidence | DocumentEvidence;

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
  /** Set by the Next proxy when the sidecar itself could not be reached. */
  degraded?: boolean;
}

export const PROXY_UNAVAILABLE_REASON = 'sidecar_unreachable';

export function unavailableResponse(reason: string): DossierResponse {
  return {
    schema_version: SCHEMA_VERSION,
    dossier_id: DOSSIER_ID,
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

/** Closed set of sidecar reason codes → analyst wording. Unknown codes render verbatim. */
const REASON_TEXT: Record<string, string> = {
  feature_disabled: 'The dossier API is switched off (GIDEON_DOSSIER_ENABLED=0).',
  store_unconfigured: 'No E1 publication store is mounted for the dossier reader.',
  store_unreadable: 'The E1 publication store could not be read.',
  sidecar_unreachable: 'The Fusion sidecar did not answer in time.',
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
  body: DossierResponse | null;
  bodyAt: string | null;
  fetchError: string | null;
  fetchedAt: string | null;
}

export const INITIAL_FEED: FeedState = { body: null, bodyAt: null, fetchError: null, fetchedAt: null };

export type FeedEvent =
  | { type: 'response'; body: DossierResponse; at: string }
  | { type: 'failure'; message: string; at: string };

/** Retained publication is dropped after this age when the browser cannot reach the proxy. */
export const RETAINED_MAX_AGE_S = 6 * 3600;

export interface ResolvedView {
  view: ViewState;
  /** `browser` when this browser's fetch failed and a retained publication is shown. */
  staleOrigin: 'server' | 'browser' | null;
  body: DossierResponse | null;
}

function ageSeconds(fromIso: string | null, nowIso: string): number | null {
  if (!fromIso) return null;
  const from = Date.parse(fromIso);
  const now = Date.parse(nowIso);
  if (Number.isNaN(from) || Number.isNaN(now)) return null;
  return Math.max(0, Math.round((now - from) / 1000));
}

/**
 * A browser fetch failure after a good payload renders `stale` with the retained
 * publication (younger than RETAINED_MAX_AGE_S), otherwise `unavailable`. A retained
 * withdrawn/not_published/unavailable body is never re-rendered as data.
 */
export function resolveView(state: FeedState, nowIso: string, maxAgeS: number = RETAINED_MAX_AGE_S): ResolvedView {
  const { body, bodyAt, fetchError } = state;
  if (!fetchError) {
    const view = deriveViewState(body);
    return { view, staleOrigin: view === 'stale' ? 'server' : null, body };
  }
  const retained = deriveViewState(body);
  const age = ageSeconds(bodyAt, nowIso);
  if (!body || (retained !== 'available' && retained !== 'stale') || age === null || age >= maxAgeS) {
    return { view: 'unavailable', staleOrigin: null, body: null };
  }
  return { view: 'stale', staleOrigin: 'browser', body };
}

export function reduceFeed(prev: FeedState, event: FeedEvent): FeedState {
  if (event.type === 'failure') {
    return { ...prev, fetchError: event.message, fetchedAt: event.at };
  }
  // A withdrawal or 503 replaces the retained publication: nothing is served from history.
  return { body: event.body, bodyAt: event.at, fetchError: null, fetchedAt: event.at };
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, 'Z');
}

/** Native strings are kept as strings; format only for display, never re-typed. */
export function formatUsd(native: unknown): string {
  if (typeof native !== 'string' || native.trim() === '') return 'unknown';
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
  operatorType: string;
}

export interface Grouped {
  entities: Map<string, Entity>;
  ownership: OwnershipRow[];
  operators: OperatorRow[];
  finance: FinanceRow[];
  roles: RoleRow[];
  /** Physical relationships (port/transport predicates). Empty in every accepted publication so far. */
  physical: Edge[];
  gaps: Gap[];
  routeGaps: Gap[];
  loanEvents: Entity[];
  evidenceByRef: Map<string, EvidenceEntry>;
  assertionsByEdge: Map<string, Assertion>;
}

export const PHYSICAL_ENTITY_KINDS = new Set<EntityKind>(['port', 'transport_node']);
export const ROUTE_GAP_KINDS = new Set(['route_unpublished', 'document_unverified']);

export function labelOf(entities: Map<string, Entity>, id: string): string {
  return entities.get(id)?.label ?? id;
}

/** Group edges by relationship family. Unknown predicates are dropped, never guessed. */
export function groupPublication(pub: Publication): Grouped {
  const entities = new Map(pub.entities.map((e) => [e.id, e]));
  const evidenceByRef = new Map(pub.evidence_manifest.map((m) => [m.ref, m]));
  const assertionsByEdge = new Map(pub.assertions.map((a) => [a.id, a]));
  const ownership: OwnershipRow[] = [];
  const operators: OperatorRow[] = [];
  const finance: FinanceRow[] = [];
  const roles: RoleRow[] = [];
  const physical: Edge[] = [];
  for (const edge of pub.edges) {
    const v = edge.value ?? {};
    const t = edge.temporal ?? {};
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
      case 'operates':
        operators.push({ edge, operator: subject, asset: object, operatorType: str(v.operator_type) ?? 'unknown' });
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
      default:
        if (PHYSICAL_ENTITY_KINDS.has(entities.get(edge.subject)?.kind ?? 'organization')
          || PHYSICAL_ENTITY_KINDS.has(entities.get(edge.object)?.kind ?? 'organization')) {
          physical.push(edge);
        }
    }
  }
  const byLabel = (a: { holder?: string; lender?: string; organization?: string }, b: typeof a) =>
    (a.holder ?? a.lender ?? a.organization ?? '').localeCompare(b.holder ?? b.lender ?? b.organization ?? '');
  ownership.sort(byLabel);
  finance.sort((a, b) => byLabel(a, b) || b.year.localeCompare(a.year));
  roles.sort((a, b) => byLabel(a, b) || a.role.localeCompare(b.role));
  return {
    entities,
    ownership,
    operators,
    finance,
    roles,
    physical,
    gaps: pub.gap_register,
    routeGaps: pub.gap_register.filter((g) => ROUTE_GAP_KINDS.has(g.kind)),
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
  return body.origin !== 'hosted_records' || body.evidence_origins.some((o) => o !== 'hosted_record');
}
