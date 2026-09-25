/**
 * E5 underwriting read contract (`e5-underwriting/1.0`) as served by the Fusion sidecar
 * `GET /api/v1/foundation/dossiers/las-bambas-matarani/underwriting` and proxied at
 * `UW_PROXY_PATH`. Read-only: the browser renders the published portfolio of hypothetical
 * functional-disruption cases with two INDEPENDENT judgments per case — materialization
 * difficulty and conditional magnitude — each numeric (point or range) or explicitly N/A. It
 * never computes, ranks, combines, sums or infers anything, and it carries no probability,
 * imminence, expected loss or aggregate risk.
 */

import { DOSSIER_ID } from './dossier';

export const UW_SCHEMA_VERSION = 'e5-underwriting/1.0';
export const UW_CONTRACT = 'e5-uw-1.0';
export const UW_POLICY_VERSION = 'underwriting/1.0';
export const UW_PROXY_PATH = '/api/fusion/dossiers/las-bambas-matarani/underwriting';
export const UW_SIDECAR_PATH = `/api/v1/foundation/dossiers/${DOSSIER_ID}/underwriting`;
export const HYPOTHETICAL_LABEL =
  'Hypothetical functional-disruption case for continuity underwriting; not an alert, observed incident, forecast or probability.';
/** Exact empty-state text of the dual-axis chart. */
export const CHART_EMPTY_TEXT = 'No cases currently have both scores';

export type UwState = 'available' | 'stale' | 'not_published' | 'withdrawn' | 'unavailable';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type Category = 'LEG' | 'LOG' | 'VEN' | 'SOC' | 'CYB' | 'DAT' | 'FIN' | 'COM' | 'ECO' | 'CRI';
export type CaseKind = 'assumption_led' | 'evidence_limited' | 'evidence_supported';
export type Applicability = 'SUPPORTED_EXPOSURE' | 'CONDITIONAL_SCENARIO' | 'NOT_ASSESSABLE' | 'NOT_APPLICABLE';
export type BasisKind = 'documented_fact' | 'bounded_inference' | 'stress_assumption' | 'unknown';
export type InputKind = 'prerequisite' | 'barrier' | 'dependency';
export type ReferenceRole = 'supports_fact' | 'supports_inference' | 'context_for_assumption' | 'gap_reference';
export type ControlsState = 'assessed_effective' | 'assessed_limited' | 'undocumented' | 'not_applicable';

export const CATEGORIES: readonly Category[] = ['LEG', 'LOG', 'VEN', 'SOC', 'CYB', 'DAT', 'FIN', 'COM', 'ECO', 'CRI'];

export const CATEGORY_LABEL: Record<Category, string> = {
  LEG: 'Legal / regulatory',
  LOG: 'Logistics / corridor',
  VEN: 'Vendor / service',
  SOC: 'Social / community',
  CYB: 'Cyber / digital',
  DAT: 'Data / information',
  FIN: 'Financial / settlement',
  COM: 'Commercial / market',
  ECO: 'Economic / macro',
  CRI: 'Criminal / security',
};

export const CASE_KIND_LABEL: Record<CaseKind, string> = {
  assumption_led: 'Assumption-led (reviewed stress assumption; not an observed vulnerability)',
  evidence_limited: 'Evidence-limited (dependency not established from accepted evidence)',
  evidence_supported: 'Evidence-supported',
};

export const APPLICABILITY_LABEL: Record<Applicability, string> = {
  SUPPORTED_EXPOSURE: 'Supported exposure',
  CONDITIONAL_SCENARIO: 'Conditional scenario',
  NOT_ASSESSABLE: 'Not assessable',
  NOT_APPLICABLE: 'Not applicable',
};

export interface UwReference {
  ref: string;
  role: ReferenceRole;
  note: string | null;
}

export interface UwInput {
  key: string;
  kind: InputKind;
  statement: string;
  basis_kind: BasisKind;
  rationale: string;
  references: UwReference[];
  could_change_band: boolean;
  controls_state: ControlsState | null;
  bounding_rationale: string | null;
}

export interface UwAssumption {
  key: string;
  statement: string;
  basis_kind: 'stress_assumption';
  rationale: string;
  affects: Array<'difficulty' | 'magnitude'>;
  references: UwReference[];
}

export interface UwUnknown {
  key: string;
  statement: string;
  pivotal: boolean;
  evidence_needed: string;
  references: UwReference[];
}

export interface UwBoundary {
  function_key: string;
  function_statement: string;
  boundary_statement: string;
  stage: string;
  entity_refs: string[];
  edge_refs: string[];
  first_order: string;
  propagation: string[];
  limits: string[];
}

export interface UwDifficulty {
  axis: string;
  low: number | null;
  high: number | null;
  confidence: Confidence;
  null_reason: string | null;
  rationale: string;
  low_rationale: string | null;
  high_rationale: string | null;
  unknown_bounding_rationale: string | null;
  limited_barriers_basis: string | null;
}

export interface UwMagnitude {
  axis: string;
  extent_bands: string[] | null;
  duration_bands: string[] | null;
  duration_days: number | null;
  low: number | null;
  high: number | null;
  confidence: Confidence;
  null_reason: string | null;
  rationale: string;
  extent_rationale: string | null;
  duration_rationale: string | null;
}

export interface UwResilience {
  known_buffers: string[];
  unknown_fallback: string[];
  recovery_conditions: string[];
  reducers: string[];
}

export interface UwCatalogRef {
  scenario_id: string;
  relation: 'primary' | 'related';
  reason: string;
}

export interface UwHighlight {
  entity_ids: string[];
  edge_ids: string[];
}

export interface UwCase {
  case_id: string;
  version: number;
  lifecycle: string;
  family: string;
  category: Category;
  secondary_category: Category | null;
  title: string;
  initiating_key: string;
  initiating_statement: string;
  boundary: UwBoundary;
  applicability: { state: Applicability; confidence: Confidence; rationale: string; currentness_caveat: string | null };
  case_kind: CaseKind;
  inputs: UwInput[];
  assumptions: UwAssumption[];
  unknowns: UwUnknown[];
  difficulty: UwDifficulty;
  magnitude: UwMagnitude;
  both_scored: boolean;
  resilience: UwResilience;
  countercase: string[];
  catalog_refs: UwCatalogRef[];
  legacy_refs: string[];
  related_cases: string[];
  prior_case_id: string | null;
  assumption_set_sha256: string;
  hypothetical_label: string;
  display: { difficulty: string; magnitude: string };
  highlight: UwHighlight;
}

export interface UwCoverage {
  scenario_id: string;
  disposition: string;
  case_ids: string[];
  reason: string;
}

export interface UwSharedGroup {
  refs: string[];
  case_ids: string[];
  note: string;
  aggregation: 'not_summed';
}

export interface UwSummary {
  cases_published: number;
  not_published: number;
  difficulty_scored: number;
  magnitude_scored: number;
  both_scored: number;
  assumption_led: number;
  evidence_limited: number;
  evidence_supported: number;
  coverage_entries: number;
}

export interface UwPublication {
  publication_no: number;
  created_at: string;
  contract: string;
  ddd: {
    publication_no: number;
    publication_sha256: string;
    created_at: string;
    evidence_cutoff: string;
    evidence_cutoff_basis: string;
  };
  policy: {
    policy_version: string;
    brief_v1_sha256: string;
    brief_v01_sha256: string;
    rubric_sha256: string;
    catalog_sha256: string;
    planning_commit: string;
  };
  hypothetical_label: string;
  ordering: { rule: string; ranked: false; note: string };
  axes: { difficulty: string; magnitude: string; independent: true; not_likelihood: true };
  summary: UwSummary;
  cases: UwCase[];
  not_published: Array<{ case_id: string; review_state: string }>;
  coverage: UwCoverage[];
  shared_dependency_groups: UwSharedGroup[];
  what_changed: string[];
}

export interface DddBinding {
  state: string;
  reason: string | null;
  publication_no: number | null;
  publication_sha256: string | null;
  eligibility_established_at: string | null;
  eligibility_changed_at: string | null;
}

export interface UwResponse {
  schema_version: string;
  dossier_id: string | null;
  state: UwState;
  reason: string | null;
  checked_at: string;
  ddd: DddBinding | null;
  currentness: { publication_no: number; eligibility_changed_at: string | null } | null;
  publication: UwPublication | null;
  degraded?: boolean;
}

export const UW_PROXY_UNAVAILABLE_REASON = 'sidecar_unreachable';
export const UW_CONTRACT_INVALID_REASON = 'sidecar_contract_invalid';

export function uwUnavailableResponse(reason: string): UwResponse {
  return {
    schema_version: UW_SCHEMA_VERSION,
    dossier_id: DOSSIER_ID,
    state: 'unavailable',
    reason,
    checked_at: new Date().toISOString(),
    ddd: null,
    currentness: null,
    publication: null,
    degraded: true,
  };
}

// ---------------------------------------------------------------------------
// bounded contract guard
// ---------------------------------------------------------------------------

const STATES: ReadonlySet<string> = new Set<UwState>(['available', 'stale', 'not_published', 'withdrawn', 'unavailable']);
const CONFIDENCE: ReadonlySet<string> = new Set<Confidence>(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);
const CATEGORY_SET: ReadonlySet<string> = new Set<string>(CATEGORIES);
const CASE_KINDS: ReadonlySet<string> = new Set<CaseKind>(['assumption_led', 'evidence_limited', 'evidence_supported']);
const APPLICABILITY: ReadonlySet<string> = new Set<Applicability>(['SUPPORTED_EXPOSURE', 'CONDITIONAL_SCENARIO', 'NOT_ASSESSABLE', 'NOT_APPLICABLE']);
const BASIS: ReadonlySet<string> = new Set<BasisKind>(['documented_fact', 'bounded_inference', 'stress_assumption', 'unknown']);
const INPUT_KINDS: ReadonlySet<string> = new Set<InputKind>(['prerequisite', 'barrier', 'dependency']);
const ROLES: ReadonlySet<string> = new Set<ReferenceRole>(['supports_fact', 'supports_inference', 'context_for_assumption', 'gap_reference']);
const CONTROLS: ReadonlySet<string> = new Set<ControlsState>(['assessed_effective', 'assessed_limited', 'undocumented', 'not_applicable']);
const EXTENT = /^E[1-4]$/;
const DURATION = /^D[1-4]$/;
const SCENARIO_ID = /^S(0[1-9]|[12][0-9]|3[0-2])$/;
const SHA256 = /^[0-9a-f]{64}$/;
const CASE_ID = /^[0-9a-f]{24}$/;
const ID_TOKEN = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,199}$/;
/** Private audit content and any likelihood/aggregate field: never accepted anywhere in a case. */
const FORBIDDEN_KEYS = ['reviewer', 'actor', 'author', 'producer', 'reviewed_input_sha256', 'decision_id', 'decision_ids', 'run_id',
  'notes', 'path', 'withdrawn_by', 'prepared_at', 'previous_version', 'review',
  'probability', 'likelihood', 'expected_loss', 'imminence', 'attack_prediction', 'attack_feasibility', 'composite_risk',
  'dossier_aggregate_score', 'risk_score', 'severity', 'target_attractiveness'];
const FORBIDDEN_KEY_SET: ReadonlySet<string> = new Set(FORBIDDEN_KEYS);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}
function isNullableString(v: unknown): boolean {
  return v === null || typeof v === 'string';
}
function isNullableInt(v: unknown): boolean {
  return v === null || (typeof v === 'number' && Number.isInteger(v));
}
function isScore(v: unknown): boolean {
  return v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5);
}

/** Recursive key sweep: a forbidden key at any depth rejects the whole body. */
function hasForbiddenKey(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(hasForbiddenKey);
  if (!isRecord(v)) return false;
  for (const k of Object.keys(v)) {
    if (FORBIDDEN_KEY_SET.has(k) || hasForbiddenKey(v[k])) return true;
  }
  return false;
}

function isReference(v: unknown): boolean {
  return isRecord(v) && typeof v.ref === 'string' && ID_TOKEN.test(v.ref)
    && typeof v.role === 'string' && ROLES.has(v.role) && isNullableString(v.note);
}
function isReferences(v: unknown): v is UwReference[] {
  return Array.isArray(v) && v.every(isReference);
}

function isInput(v: unknown): boolean {
  if (!isRecord(v)) return false;
  if (typeof v.key !== 'string' || typeof v.kind !== 'string' || !INPUT_KINDS.has(v.kind)) return false;
  if (typeof v.statement !== 'string' || typeof v.basis_kind !== 'string' || !BASIS.has(v.basis_kind)) return false;
  if (typeof v.rationale !== 'string' || !isReferences(v.references) || typeof v.could_change_band !== 'boolean') return false;
  if (v.controls_state !== null && (typeof v.controls_state !== 'string' || !CONTROLS.has(v.controls_state) || v.kind !== 'barrier')) return false;
  if (!isNullableString(v.bounding_rationale)) return false;
  // A stress assumption may cite context, never claim that the assumed condition is documented.
  if (v.basis_kind === 'stress_assumption' && v.references.some((r) => r.role === 'supports_fact')) return false;
  return true;
}

function isAssumption(v: unknown): boolean {
  return isRecord(v) && typeof v.key === 'string' && typeof v.statement === 'string' && v.basis_kind === 'stress_assumption'
    && typeof v.rationale === 'string'
    && isStringArray(v.affects) && v.affects.length > 0 && v.affects.every((a) => a === 'difficulty' || a === 'magnitude')
    && isReferences(v.references) && !v.references.some((r) => r.role === 'supports_fact');
}

function isUnknown(v: unknown): boolean {
  return isRecord(v) && typeof v.key === 'string' && typeof v.statement === 'string' && typeof v.pivotal === 'boolean'
    && typeof v.evidence_needed === 'string' && isReferences(v.references);
}

function isBoundary(v: unknown): boolean {
  return isRecord(v) && typeof v.function_key === 'string' && typeof v.function_statement === 'string'
    && typeof v.boundary_statement === 'string' && typeof v.stage === 'string'
    && isStringArray(v.entity_refs) && v.entity_refs.every((r) => ID_TOKEN.test(r))
    && isStringArray(v.edge_refs) && v.edge_refs.every((r) => ID_TOKEN.test(r))
    && typeof v.first_order === 'string' && isStringArray(v.propagation) && isStringArray(v.limits);
}

/** Both endpoints numeric (1–5, low ≤ high) or both null with a reason. */
function isAxisRange(low: unknown, high: unknown, confidence: unknown, nullReason: unknown): boolean {
  if (!isScore(low) || !isScore(high)) return false;
  if ((low === null) !== (high === null)) return false;
  if (typeof confidence !== 'string' || !CONFIDENCE.has(confidence)) return false;
  if (!isNullableString(nullReason)) return false;
  if (low === null) return confidence === 'UNKNOWN' && typeof nullReason === 'string' && nullReason.length > 0;
  const l = low as number, h = high as number;
  if (l > h) return false;
  return confidence !== 'UNKNOWN' && nullReason === null;
}

function isDifficulty(v: unknown): boolean {
  if (!isRecord(v) || typeof v.axis !== 'string' || typeof v.rationale !== 'string') return false;
  if (!isAxisRange(v.low, v.high, v.confidence, v.null_reason)) return false;
  // The uninformative full 1–5 difficulty range is N/A by policy; magnitude may keep a genuine full range.
  if (v.low === 1 && v.high === 5) return false;
  if (!isNullableString(v.low_rationale) || !isNullableString(v.high_rationale)
    || !isNullableString(v.unknown_bounding_rationale) || !isNullableString(v.limited_barriers_basis)) return false;
  if (v.low !== null) {
    if (typeof v.low_rationale !== 'string') return false;
    if (v.low !== v.high && typeof v.high_rationale !== 'string') return false;
    if (v.low === 1 && typeof v.limited_barriers_basis !== 'string') return false;
  }
  return true;
}

function isBandList(v: unknown, re: RegExp): boolean {
  return v === null || (isStringArray(v) && v.length > 0 && v.every((b) => re.test(b)));
}

/** Rubric extent × duration matrix (rubric 1.0, unchanged by underwriting/1.0). */
export const MAGNITUDE_MATRIX: Record<string, Record<string, number>> = {
  E1: { D1: 1, D2: 1, D3: 2, D4: 2 },
  E2: { D1: 2, D2: 2, D3: 3, D4: 3 },
  E3: { D1: 3, D2: 3, D3: 4, D4: 4 },
  E4: { D1: 3, D2: 4, D3: 4, D4: 5 },
};

/** Published magnitude range must be exactly the min/max of the matrix over the published bands. */
function matrixRange(extent: string[], duration: string[]): [number, number] {
  let lo = 6, hi = 0;
  for (const e of extent) for (const d of duration) { const s = MAGNITUDE_MATRIX[e][d]; lo = Math.min(lo, s); hi = Math.max(hi, s); }
  return [lo, hi];
}

function isMagnitude(v: unknown): boolean {
  if (!isRecord(v) || typeof v.axis !== 'string' || typeof v.rationale !== 'string') return false;
  if (!isAxisRange(v.low, v.high, v.confidence, v.null_reason)) return false;
  if (!isBandList(v.extent_bands, EXTENT) || !isBandList(v.duration_bands, DURATION)) return false;
  if (v.duration_days !== null && (typeof v.duration_days !== 'number' || !Number.isFinite(v.duration_days) || v.duration_days < 0)) return false;
  if (!isNullableString(v.extent_rationale) || !isNullableString(v.duration_rationale)) return false;
  const bounded = v.extent_bands !== null && v.duration_bands !== null;
  // A score requires reviewed bands; bands without a score are not a magnitude answer either.
  if (bounded !== (v.low !== null)) return false;
  if (bounded && (typeof v.extent_rationale !== 'string' || typeof v.duration_rationale !== 'string')) return false;
  if (bounded) {
    const [lo, hi] = matrixRange(v.extent_bands as string[], v.duration_bands as string[]);
    if (v.low !== lo || v.high !== hi) return false;
  }
  return true;
}

function isResilience(v: unknown): boolean {
  return isRecord(v) && isStringArray(v.known_buffers) && isStringArray(v.unknown_fallback)
    && isStringArray(v.recovery_conditions) && isStringArray(v.reducers);
}

function isCatalogRef(v: unknown): boolean {
  return isRecord(v) && typeof v.scenario_id === 'string' && SCENARIO_ID.test(v.scenario_id) && v.scenario_id !== 'S32'
    && (v.relation === 'primary' || v.relation === 'related') && typeof v.reason === 'string';
}

function isHighlight(v: unknown): boolean {
  return isRecord(v) && isStringArray(v.entity_ids) && v.entity_ids.every((r) => ID_TOKEN.test(r))
    && isStringArray(v.edge_ids) && v.edge_ids.every((r) => ID_TOKEN.test(r));
}

/** `case_kind` re-derived with the engine rule: the served label is never taken on trust. */
export function deriveCaseKind(
  inputs: ReadonlyArray<Pick<UwInput, 'kind' | 'basis_kind' | 'could_change_band' | 'references'>>,
  assumptions: ReadonlyArray<unknown>,
  unknowns: ReadonlyArray<Pick<UwUnknown, 'pivotal'>>,
): CaseKind {
  if (assumptions.length > 0 || inputs.some((i) => i.basis_kind === 'stress_assumption')) return 'assumption_led';
  if (inputs.some((i) => i.basis_kind === 'unknown' && i.could_change_band) || unknowns.some((u) => u.pivotal)) return 'evidence_limited';
  const referenced = inputs.some((i) => i.kind === 'dependency'
    && (i.basis_kind === 'documented_fact' || i.basis_kind === 'bounded_inference') && i.references.length > 0);
  return referenced ? 'evidence_supported' : 'evidence_limited';
}

function isCase(v: unknown): boolean {
  if (!isRecord(v)) return false;
  if (typeof v.case_id !== 'string' || !CASE_ID.test(v.case_id) || typeof v.version !== 'number') return false;
  if (v.lifecycle !== 'published' || typeof v.family !== 'string' || typeof v.title !== 'string') return false;
  if (typeof v.category !== 'string' || !CATEGORY_SET.has(v.category)) return false;
  if (v.secondary_category !== null && (typeof v.secondary_category !== 'string' || !CATEGORY_SET.has(v.secondary_category) || v.secondary_category === v.category)) return false;
  if (typeof v.initiating_key !== 'string' || typeof v.initiating_statement !== 'string') return false;
  if (!isBoundary(v.boundary)) return false;
  const ap = v.applicability;
  if (!isRecord(ap) || typeof ap.state !== 'string' || !APPLICABILITY.has(ap.state)
    || typeof ap.confidence !== 'string' || !CONFIDENCE.has(ap.confidence)
    || typeof ap.rationale !== 'string' || !isNullableString(ap.currentness_caveat)) return false;
  if (typeof v.case_kind !== 'string' || !CASE_KINDS.has(v.case_kind)) return false;
  if (!Array.isArray(v.inputs) || !v.inputs.every(isInput)) return false;
  if (!Array.isArray(v.assumptions) || !v.assumptions.every(isAssumption)) return false;
  if (!Array.isArray(v.unknowns) || !v.unknowns.every(isUnknown)) return false;
  if (deriveCaseKind(v.inputs as UwInput[], v.assumptions, v.unknowns as UwUnknown[]) !== v.case_kind) return false;
  if (!isDifficulty(v.difficulty) || !isMagnitude(v.magnitude)) return false;
  const d = v.difficulty as UwDifficulty, m = v.magnitude as UwMagnitude;
  if (v.both_scored !== (d.low !== null && m.low !== null)) return false;
  if (!isResilience(v.resilience) || !isStringArray(v.countercase)) return false;
  if (!Array.isArray(v.catalog_refs) || v.catalog_refs.length === 0 || !v.catalog_refs.every(isCatalogRef)) return false;
  if ((v.catalog_refs as UwCatalogRef[]).filter((r) => r.relation === 'primary').length !== 1) return false;
  if (!isStringArray(v.legacy_refs) || !isStringArray(v.related_cases) || !v.related_cases.every((c) => CASE_ID.test(c))) return false;
  if (v.prior_case_id !== null && (typeof v.prior_case_id !== 'string' || !CASE_ID.test(v.prior_case_id))) return false;
  if (typeof v.assumption_set_sha256 !== 'string' || !SHA256.test(v.assumption_set_sha256)) return false;
  if (v.hypothetical_label !== HYPOTHETICAL_LABEL) return false;
  const disp = v.display;
  if (!isRecord(disp) || typeof disp.difficulty !== 'string' || typeof disp.magnitude !== 'string') return false;
  if (!isHighlight(v.highlight)) return false;
  // Highlight may only point at what the boundary itself references.
  const hl = v.highlight as UwHighlight, b = v.boundary as UwBoundary;
  if (!hl.entity_ids.every((e) => b.entity_refs.includes(e)) || !hl.edge_ids.every((e) => b.edge_refs.includes(e))) return false;
  return true;
}

function isCoverage(v: unknown): boolean {
  return isRecord(v) && typeof v.scenario_id === 'string' && SCENARIO_ID.test(v.scenario_id)
    && typeof v.disposition === 'string' && isStringArray(v.case_ids) && v.case_ids.every((c) => CASE_ID.test(c))
    && typeof v.reason === 'string';
}

function isSharedGroup(v: unknown): boolean {
  return isRecord(v) && isStringArray(v.refs) && v.refs.length > 0 && v.refs.every((r) => ID_TOKEN.test(r))
    && isStringArray(v.case_ids) && v.case_ids.length >= 2 && v.case_ids.every((c) => CASE_ID.test(c))
    && typeof v.note === 'string' && v.aggregation === 'not_summed';
}

function isSummary(v: unknown): boolean {
  if (!isRecord(v)) return false;
  const keys: Array<keyof UwSummary> = ['cases_published', 'not_published', 'difficulty_scored', 'magnitude_scored', 'both_scored',
    'assumption_led', 'evidence_limited', 'evidence_supported', 'coverage_entries'];
  return keys.every((k) => typeof v[k] === 'number' && Number.isInteger(v[k]) && (v[k] as number) >= 0);
}

function isPublication(v: unknown): boolean {
  if (!isRecord(v) || hasForbiddenKey(v)) return false;
  if (typeof v.publication_no !== 'number' || typeof v.created_at !== 'string' || v.contract !== UW_CONTRACT) return false;
  const ddd = v.ddd;
  if (!isRecord(ddd) || typeof ddd.publication_no !== 'number' || typeof ddd.publication_sha256 !== 'string'
    || !SHA256.test(ddd.publication_sha256) || typeof ddd.created_at !== 'string'
    || typeof ddd.evidence_cutoff !== 'string' || ddd.evidence_cutoff_basis !== 'publication_snapshot_created_at') return false;
  const pol = v.policy;
  if (!isRecord(pol) || pol.policy_version !== UW_POLICY_VERSION
    || typeof pol.brief_v1_sha256 !== 'string' || !SHA256.test(pol.brief_v1_sha256)
    || typeof pol.brief_v01_sha256 !== 'string' || !SHA256.test(pol.brief_v01_sha256)
    || typeof pol.rubric_sha256 !== 'string' || !SHA256.test(pol.rubric_sha256)
    || typeof pol.catalog_sha256 !== 'string' || !SHA256.test(pol.catalog_sha256)
    || typeof pol.planning_commit !== 'string') return false;
  if (v.hypothetical_label !== HYPOTHETICAL_LABEL) return false;
  const ord = v.ordering;
  if (!isRecord(ord) || typeof ord.rule !== 'string' || ord.ranked !== false || typeof ord.note !== 'string') return false;
  const axes = v.axes;
  if (!isRecord(axes) || typeof axes.difficulty !== 'string' || typeof axes.magnitude !== 'string'
    || axes.independent !== true || axes.not_likelihood !== true) return false;
  if (!isSummary(v.summary)) return false;
  if (!Array.isArray(v.cases) || v.cases.length > 64 || !v.cases.every(isCase)) return false;
  const cases = v.cases as UwCase[];
  // Deterministic, non-ranked: category code then stable case id, unique ids.
  const keys = cases.map((c) => `${c.category}:${c.case_id}`);
  if (new Set(cases.map((c) => c.case_id)).size !== cases.length || keys.some((k, i) => i > 0 && k <= keys[i - 1])) return false;
  const ids = new Set(cases.map((c) => c.case_id));
  if (!cases.every((c) => c.related_cases.every((r) => ids.has(r)))) return false;
  if (!Array.isArray(v.not_published) || !v.not_published.every((n) => isRecord(n) && typeof n.case_id === 'string'
    && CASE_ID.test(n.case_id) && !ids.has(n.case_id) && typeof n.review_state === 'string')) return false;
  if (!Array.isArray(v.coverage) || v.coverage.length !== 32 || !v.coverage.every(isCoverage)) return false;
  const cov = v.coverage as UwCoverage[];
  if (cov.some((c, i) => c.scenario_id !== `S${String(i + 1).padStart(2, '0')}`)) return false;
  if (!cov.every((c) => c.case_ids.every((id) => ids.has(id)))) return false;
  const s32 = cov[31];
  if (s32.disposition !== 'modifier' || s32.case_ids.length !== 0) return false;
  for (const c of cases) {
    for (const r of c.catalog_refs) {
      if (!cov.find((e) => e.scenario_id === r.scenario_id)?.case_ids.includes(c.case_id)) return false;
    }
  }
  if (!Array.isArray(v.shared_dependency_groups) || !v.shared_dependency_groups.every(isSharedGroup)) return false;
  if (!(v.shared_dependency_groups as UwSharedGroup[]).every((g) => g.case_ids.every((id) => ids.has(id)))) return false;
  const s = v.summary as UwSummary;
  if (s.cases_published !== cases.length || s.not_published !== (v.not_published as unknown[]).length || s.coverage_entries !== 32) return false;
  if (s.difficulty_scored !== cases.filter((c) => c.difficulty.low !== null).length
    || s.magnitude_scored !== cases.filter((c) => c.magnitude.low !== null).length
    || s.both_scored !== cases.filter((c) => c.both_scored).length
    || s.assumption_led !== cases.filter((c) => c.case_kind === 'assumption_led').length
    || s.evidence_limited !== cases.filter((c) => c.case_kind === 'evidence_limited').length
    || s.evidence_supported !== cases.filter((c) => c.case_kind === 'evidence_supported').length) return false;
  return isStringArray(v.what_changed);
}

function isDdd(v: unknown): boolean {
  return isRecord(v) && typeof v.state === 'string' && isNullableString(v.reason)
    && isNullableInt(v.publication_no)
    && (v.publication_sha256 === null || (typeof v.publication_sha256 === 'string' && SHA256.test(v.publication_sha256)))
    && isNullableString(v.eligibility_established_at) && isNullableString(v.eligibility_changed_at);
}

/**
 * Bounded contract guard shared by the proxy and the browser. A body claiming `available` or
 * `stale` must carry a self-consistent publication whose DDD binding equals the DDD actually
 * read by the sidecar; state-only answers (including withdrawn) must carry no publication.
 * Anything else is not an underwriting answer and is never stored or rendered.
 */
export function isUwResponse(body: unknown): body is UwResponse {
  if (!isRecord(body)) return false;
  if (body.schema_version !== UW_SCHEMA_VERSION) return false;
  if (typeof body.state !== 'string' || !STATES.has(body.state)) return false;
  if (body.dossier_id !== null && body.dossier_id !== DOSSIER_ID) return false;
  if (!isNullableString(body.reason) || typeof body.checked_at !== 'string') return false;
  if (body.degraded !== undefined && typeof body.degraded !== 'boolean') return false;
  if (body.ddd !== null && !isDdd(body.ddd)) return false;
  if (body.currentness !== null && !(isRecord(body.currentness) && typeof body.currentness.publication_no === 'number'
    && isNullableString(body.currentness.eligibility_changed_at))) return false;
  const claims = body.state === 'available' || body.state === 'stale';
  if (!claims) return body.publication === null;
  if (!isPublication(body.publication) || !isRecord(body.ddd) || !isRecord(body.currentness)) return false;
  const pub = body.publication as UwPublication;
  const ddd = body.ddd as unknown as DddBinding;
  return pub.ddd.publication_no === ddd.publication_no && pub.ddd.publication_sha256 === ddd.publication_sha256
    && pub.publication_no === (body.currentness as { publication_no: number }).publication_no;
}

// ---------------------------------------------------------------------------
// view derivation
// ---------------------------------------------------------------------------

export type UwViewState = 'loading' | 'off' | UwState;

const REASON_TEXT: Record<string, string> = {
  feature_disabled: 'The underwriting API is switched off (GIDEON_UNDERWRITING_ENABLED=0).',
  store_unconfigured: 'No underwriting store (or no DDD store) is mounted for the reader.',
  store_unreadable: 'The underwriting store could not be read.',
  sidecar_unreachable: 'The Fusion sidecar did not answer in time.',
  sidecar_contract_invalid: 'The Fusion sidecar answered outside the underwriting contract; nothing from that answer is shown.',
  underwriting_route_missing: 'The Fusion sidecar release has no underwriting route.',
  query_parameters_rejected: 'Query parameters are not accepted on the underwriting route.',
  method_not_allowed: 'Only GET is accepted on the underwriting route.',
  rate_limited: 'Too many underwriting requests from this client.',
  browser_fetch_failed: 'This browser could not reach the underwriting proxy.',
  browser_fetch_timeout: 'The underwriting proxy did not answer this browser within the request deadline.',
  browser_response_malformed: 'The underwriting proxy answer could not be parsed or failed the contract guard.',
  no_publication: 'No underwriting case portfolio has been published for this dossier.',
  ddd_not_published: 'The dossier itself has no current publication, so no cases can be bound.',
  ddd_unavailable: 'The dossier reader is unavailable, so no cases can be bound.',
  ddd_withdrawn: 'The dossier publication was withdrawn; cases bound to it are withheld.',
  ddd_mismatch: 'The current dossier publication is not the one the cases were bound to; the portfolio is withheld until re-validated.',
  ddd_stale: 'The dossier reader reports its publication as stale; the bound portfolio is shown as stale.',
  update_failed: 'The latest portfolio update failed; the last published portfolio for the same dossier publication is shown as stale.',
  needs_revalidation: 'The portfolio requires re-validation against the current dossier publication; its content is withheld.',
  eligibility_withdrawn: 'The underwriting publication was withdrawn; its content is withheld.',
  eligibility_unknown: 'The underwriting pointer carries an unknown eligibility.',
  publication_unsupported: 'The underwriting publication contains content outside the public contract; nothing from it is shown.',
  publication_malformed: 'The underwriting publication is malformed.',
  publication_missing: 'The underwriting publication file is missing.',
  pointer_malformed: 'The underwriting pointer is malformed.',
  pointer_missing: 'The underwriting pointer is missing.',
  authority_changed: 'The underwriting store changed while it was being read.',
  restricted_content_detected: 'The underwriting publication referenced restricted content and was refused.',
  reader_busy: 'The underwriting reader is busy.',
  reader_timeout: 'The underwriting read exceeded its deadline.',
};

export function describeUwReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return REASON_TEXT[reason] ?? reason;
}

export function deriveUwViewState(body: UwResponse | null | undefined): UwViewState {
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

export interface UwFeedState {
  body: UwResponse | null;
  fetchError: string | null;
  fetchedAt: string | null;
  generation: number;
}

export const INITIAL_UW_FEED: UwFeedState = { body: null, fetchError: null, fetchedAt: null, generation: 0 };

export type UwBrowserFailure = 'browser_fetch_failed' | 'browser_fetch_timeout' | 'browser_response_malformed';

export type UwFeedEvent =
  | { type: 'response'; body: UwResponse; at: string; generation: number }
  | { type: 'failure'; reason: UwBrowserFailure; at: string; generation: number }
  /** Deselection: clear everything and swallow any response still in flight (generation <= given). */
  | { type: 'reset'; generation: number };

export function reduceUwFeed(prev: UwFeedState, event: UwFeedEvent): UwFeedState {
  if (event.type === 'reset') return { ...INITIAL_UW_FEED, generation: Math.max(prev.generation, event.generation) };
  if (event.generation <= prev.generation) return prev;
  if (event.type === 'failure') {
    return { body: null, fetchError: event.reason, fetchedAt: event.at, generation: event.generation };
  }
  return { body: event.body, fetchError: null, fetchedAt: event.at, generation: event.generation };
}

export interface ResolvedUw {
  view: UwViewState;
  body: UwResponse | null;
  /** Only present for `available`/`stale`; the only thing that may be rendered or highlighted. */
  publication: UwPublication | null;
}

export function resolveUw(state: UwFeedState): ResolvedUw {
  if (state.fetchError) return { view: 'unavailable', body: null, publication: null };
  const view = deriveUwViewState(state.body);
  const publication = (view === 'available' || view === 'stale') && state.body?.publication ? state.body.publication : null;
  return { view, body: state.body, publication };
}

// ---------------------------------------------------------------------------
// presentation helpers (no scoring: everything shown is read from the publication)
// ---------------------------------------------------------------------------

/** "3" for a point, "2–4" for a range, "N/A" when unscored. Never zero, never blank. */
export function formatScore(low: number | null, high: number | null): string {
  if (low === null || high === null) return 'N/A';
  return low === high ? String(low) : `${low}–${high}`;
}

export function formatNullReason(reason: string | null): string {
  return reason ? reason.replace(/_/g, ' ') : 'unscored';
}

export function formatBands(bands: string[] | null): string {
  return bands && bands.length > 0 ? bands.join(', ') : 'unbounded';
}

/** Cases with BOTH numeric axes; the only ones the dual-axis chart may plot. */
export function chartableCases(pub: UwPublication): UwCase[] {
  return pub.cases.filter((c) => c.both_scored && c.difficulty.low !== null && c.magnitude.low !== null);
}

/** Cases published without both axes: listed beside the chart as explicitly unscored, never plotted. */
export function unplottedCases(pub: UwPublication): UwCase[] {
  return pub.cases.filter((c) => !c.both_scored);
}

/** Highlight for one case, or null: only ids the geography publication itself serves are drawn. */
export function highlightFor(pub: UwPublication | null, caseId: string | null): UwHighlight | null {
  if (!pub || !caseId) return null;
  const c = pub.cases.find((x) => x.case_id === caseId);
  return c ? c.highlight : null;
}

export function formatUwTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}
