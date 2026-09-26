/**
 * E7 analyst supplement (`e7-analyst/1.0`): typed contract guard, finite dossier registry,
 * dynamic same-origin proxy paths, feed reducer and presentation helpers shared by the
 * `[dossierId]` proxy route, the drawer pyramid and the full analyst report.
 *
 * Sibling of the E5 underwriting guard, never a relaxation of it: the E5 guard is unchanged and
 * the legacy E3/E5 views keep their own contracts. Everything rendered is read from a publication
 * that passed this guard; nothing is scored, summarised or invented in the browser.
 */
import { MAGNITUDE_MATRIX } from './underwriting';
import {
  DOSSIER_ID_TOKEN,
  DOSSIER_REGISTRY,
  dossierRegistryEntry,
  type DossierRegistryEntry,
} from './dossier-registry';

export const AN_SCHEMA_VERSION = 'e7-analyst/1.0';
/** Public projection tag on `publication.contract` (the sidecar checks the stored `:AnalystPublication` tag itself). */
export const AN_CONTRACT = 'e7-analyst/1.0';
export const AN_STORED_CONTRACT = 'e7-analyst/1.0:AnalystPublication';
export const AN_POLICY_VERSION = 'analyst/1.0';
export const AN_HYPOTHETICAL_LABEL =
  'Analyst continuity narratives: contextual or conditional hypotheses with qualitative enabling conditions. Not an alert, observed incident, forecast or probability.';
export const AN_BASELINE_LABEL = 'Current evidence does not bound extent and duration';
export const AN_STRESS_NOTE = 'Stress assumption, not a forecast; score recomputed from the pinned matrix.';
export const AN_NOT_ADDITIVE_NOTE =
  'Cards in one overlap group describe branches of a shared disruption; scores are never summed across cards or cases.';
export const AN_CARD_COUNT = 3;
export const AN_FAMILY_COUNT = 13;
export const AN_FAMILY_IDS: readonly string[] = Array.from({ length: AN_FAMILY_COUNT }, (_, i) => `TV${String(i + 1).padStart(2, '0')}`);
export const AN_TAXONOMY = { id: 'gideon-threat-vector-families', version: '1.0', status: 'specified_not_runtime_integrated' } as const;

export const AN_PROXY_UNAVAILABLE_REASON = 'sidecar_unreachable';
export const AN_CONTRACT_INVALID_REASON = 'sidecar_contract_invalid';

// ---------------------------------------------------------------------------
// finite dossier registry and dynamic routing
// ---------------------------------------------------------------------------

/** Sidecar token rule for a requested dossier id (mirrors Fusion `DOSSIER_ID_TOKEN`). */
export const AN_DOSSIER_ID_TOKEN = DOSSIER_ID_TOKEN;

export type AnalystDossierEntry = DossierRegistryEntry;

/**
 * The finite set of dossier ids the analyst proxy will forward at all — the shared registry in
 * `dossier-registry.ts`. Reserved ids are routed (the sidecar answers `dossier_not_enabled`
 * unless allowlisted there) but never listed, never researched here and never substituted by
 * Las Bambas. Anything else is `unknown_dossier` and never reaches the sidecar.
 */
export const ANALYST_DOSSIERS: ReadonlyArray<AnalystDossierEntry> = DOSSIER_REGISTRY;

export const analystRegistryEntry = dossierRegistryEntry;

export function listedAnalystDossiers(): AnalystDossierEntry[] {
  return ANALYST_DOSSIERS.filter((d) => d.listed);
}

/** Browser → Next.js proxy path for one requested dossier id (never a literal Las Bambas path). */
export function analystProxyPath(dossierId: string): string {
  return `/api/fusion/dossiers/${encodeURIComponent(dossierId)}/analyst`;
}

/** Next.js proxy → Fusion sidecar path; the requested id is forwarded verbatim after validation. */
export function analystSidecarPath(dossierId: string): string {
  return `/api/v1/foundation/dossiers/${encodeURIComponent(dossierId)}/analyst`;
}

export function analystReportPath(dossierId: string): string {
  return `/dossiers/${encodeURIComponent(dossierId)}/analyst`;
}

export function analystCardAnchor(cardId: string): string {
  return `analyst-${cardId}`;
}

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type AnState = 'available' | 'stale' | 'not_published' | 'withdrawn' | 'unavailable';
export type AnConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type AnConditionState = 'observed' | 'inferred' | 'assumed' | 'unknown';
export type AnConditionFrame = 'historical' | 'current' | 'scenario';
export type AnCaseKind = 'evidence_baseline' | 'stress_assumption';
export type AnHypothesisClass = 'contextual_continuity' | 'lawful_institutional' | 'covert_or_criminal_conditional';
export type AnDisposition = 'supported_local' | 'conditional_hypothesis' | 'research_gap' | 'not_applicable';
export type AnSourceRole = 'local_fact' | 'historical_analogue' | 'context' | 'gap_reference';
export type AnApplicability = 'dossier_local' | 'analogue' | 'context';
export type AnRights = 'open_attribution' | 'quotation_permitted';
export type AnVerification = 'verified_quotation' | 'reviewed_paraphrase';

export const HYPOTHESIS_CLASS_LABEL: Record<AnHypothesisClass, string> = {
  contextual_continuity: 'Contextual continuity',
  lawful_institutional: 'Lawful / institutional',
  covert_or_criminal_conditional: 'Covert or criminal (conditional)',
};

export const DISPOSITION_LABEL: Record<AnDisposition, string> = {
  supported_local: 'Supported locally',
  conditional_hypothesis: 'Conditional hypothesis',
  research_gap: 'Research gap',
  not_applicable: 'Not applicable',
};

export interface AnPassage { text: string; source_ids: string[] }

export interface AnCondition {
  state: AnConditionState;
  frame: AnConditionFrame;
  /** e.g. "Observed historically" / "Assumed in scenario" / "Unknown currently" — served, not derived. */
  label: string;
  text: string;
  source_ids: string[];
}

export interface AnMagnitudeCase {
  kind: AnCaseKind;
  label: string;
  extent: string[];
  days: number | null;
  duration: string | null;
  low: number | null;
  high: number | null;
  null_reason: string | null;
  assumption_note: string | null;
  /** Shown beside any score before expansion: "Conditional magnitude 3, assuming major impairment for 7 days". */
  display: string;
  score_label: string | null;
}

export interface AnLegacyRelation {
  record: 'e3b_scenario' | 'e5_case';
  record_id: string;
  relation: 'context' | 'related' | 'supersedes_presentation' | 'none';
  reason: string;
}

export interface AnCard {
  card_id: string;
  title: string;
  hypothesis_class: AnHypothesisClass;
  taxonomy: Array<{ id: string; label: string }>;
  boundary: string;
  summary: AnPassage;
  mechanism: AnPassage;
  local_anchor: AnPassage;
  location_context: AnPassage;
  actor_context: AnPassage;
  historical_basis: AnPassage;
  transfer_limit: AnPassage;
  countercase: AnPassage;
  decisive_gap: AnPassage;
  conditions: AnCondition[];
  sequence: string[];
  branches: string[];
  magnitude_cases: AnMagnitudeCase[];
  stress_cases: number;
  assumptions: string[];
  applicability_confidence: { local: AnConfidence; analogue: AnConfidence };
  magnitude_confidence: AnConfidence;
  overlap_group: string;
  not_additive_note: string;
  legacy_relations: AnLegacyRelation[];
  modifiers: string[];
  source_ids: string[];
}

export interface AnDispositionEntry {
  family_id: string;
  label: string;
  disposition: AnDisposition;
  card_ids: string[];
  reason: string;
  source_ids: string[];
}

export interface AnSource {
  source_id: string;
  url: string;
  /** Null when no document date is established; then `date_precision` is null too. */
  document_date: string | null;
  date_precision: 'day' | 'month' | 'year' | null;
  locator: string;
  role: AnSourceRole;
  applicability: AnApplicability;
  claim_supported: string;
  does_not_support: string[];
  transfer_limit: string | null;
  rights_class: AnRights;
  verification: AnVerification;
  paraphrase: string | null;
  reviewed: true;
}

export interface AnSummary {
  cards: number;
  families: number;
  sources: number;
  sources_cited: number;
  stress_cases: number;
  by_disposition: Record<AnDisposition, number>;
}

export interface AnActor { type: 'human' | 'orchestrator_ai' | 'fixture'; id: string }

export interface AnPublication {
  contract: string;
  publication_no: number;
  created_at: string;
  origin: 'production' | 'fixture';
  candidate_version: number;
  ddd: {
    publication_no: number;
    publication_sha256: string;
    created_at: string;
    evidence_cutoff: string;
    evidence_cutoff_basis: 'publication_snapshot_created_at';
  };
  policy: {
    policy_version: string;
    brief_v1_sha256: string;
    rubric_sha256: string;
    taxonomy_sha256: string;
    preview_cards_sha256: string;
    preview_catalog_sha256: string;
    planning_commit: string;
    family_ids: string[];
  };
  hypothetical_label: string;
  takeaway: AnPassage;
  chain_context: AnPassage;
  cards: AnCard[];
  dispositions: AnDispositionEntry[];
  sources: AnSource[];
  gaps: AnPassage[];
  summary: AnSummary;
  attribution: { author: AnActor; reviewers: AnActor[]; fixture: boolean };
  what_changed: string[];
}

export interface AnDddBinding {
  state: string;
  reason: string | null;
  publication_no: number | null;
  publication_sha256: string | null;
  eligibility_established_at: string | null;
  eligibility_changed_at: string | null;
}

export interface AnResponse {
  schema_version: typeof AN_SCHEMA_VERSION;
  dossier_id: string | null;
  state: AnState;
  reason: string | null;
  checked_at: string;
  ddd: AnDddBinding | null;
  currentness: { publication_no: number | null; eligibility_changed_at: string | null } | null;
  publication: AnPublication | null;
  /** Proxy-side marker: the answer did not come from the sidecar (never rendered as a claim). */
  degraded?: boolean;
}

/** State-only unavailable envelope used by the proxy for every failure it produces itself. */
export function anUnavailableResponse(reason: string, dossierId: string | null = null): AnResponse {
  return {
    schema_version: AN_SCHEMA_VERSION,
    dossier_id: dossierId,
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
// contract guard
// ---------------------------------------------------------------------------

const STATES: ReadonlySet<string> = new Set(['available', 'stale', 'not_published', 'withdrawn', 'unavailable']);
const CONFIDENCE: ReadonlySet<string> = new Set(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);
const CONDITION_STATES: ReadonlySet<string> = new Set(['observed', 'inferred', 'assumed', 'unknown']);
const CONDITION_FRAMES: ReadonlySet<string> = new Set(['historical', 'current', 'scenario']);
const CASE_KINDS: ReadonlySet<string> = new Set(['evidence_baseline', 'stress_assumption']);
const HYPOTHESIS_CLASSES: ReadonlySet<string> = new Set(Object.keys(HYPOTHESIS_CLASS_LABEL));
const DISPOSITIONS: ReadonlySet<string> = new Set(Object.keys(DISPOSITION_LABEL));
const SOURCE_ROLES: ReadonlySet<string> = new Set(['local_fact', 'historical_analogue', 'context', 'gap_reference']);
const APPLICABILITIES: ReadonlySet<string> = new Set(['dossier_local', 'analogue', 'context']);
const ADMISSIBLE_RIGHTS: ReadonlySet<string> = new Set(['open_attribution', 'quotation_permitted']);
const ADMISSIBLE_VERIFICATION: ReadonlySet<string> = new Set(['verified_quotation', 'reviewed_paraphrase']);
const DATE_PRECISIONS: ReadonlySet<string> = new Set(['day', 'month', 'year']);
const LEGACY_RECORDS: ReadonlySet<string> = new Set(['e3b_scenario', 'e5_case']);
const LEGACY_RELATIONS: ReadonlySet<string> = new Set(['context', 'related', 'supersedes_presentation', 'none']);
const ACTOR_TYPES: ReadonlySet<string> = new Set(['human', 'orchestrator_ai', 'fixture']);
const ORIGINS: ReadonlySet<string> = new Set(['production', 'fixture']);
const EXTENT_BANDS = ['E1', 'E2', 'E3', 'E4'];
const CARD_ID = /^[A-Z]{2}-\d{2}$/;
const SOURCE_ID = /^[A-Z0-9][A-Z0-9_]{0,63}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const FAMILY_ID = /^TV(0[1-9]|1[0-3])$/;
const MAX_STRING_LEN = 6000;
const MAX_LIST_LEN = 200;

/** Private audit content, any likelihood/attack-ease/aggregate axis and any coordinates: never accepted at any depth. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  'reviewer', 'actor', 'producer', 'reviewed_input_sha256', 'decision_id', 'decision_ids', 'run_id', 'notes', 'path',
  'withdrawn_by', 'prepared_at', 'previous_version', 'review', 'quotation', 'retained_sha256', 'private_original',
  'probability', 'likelihood', 'expected_loss', 'imminence', 'attack_prediction', 'attack_feasibility', 'attack_ease',
  'feasibility', 'composite_risk', 'dossier_aggregate_score', 'risk_score', 'severity', 'target_attractiveness',
  'difficulty', 'coordinates', 'latitude', 'longitude', 'lat', 'lon', 'geometry',
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= MAX_STRING_LEN;
}
function isNullableStr(v: unknown): boolean {
  return v === null || isStr(v);
}
function isStrList(v: unknown): v is string[] {
  return Array.isArray(v) && v.length <= MAX_LIST_LEN && v.every(isStr);
}
function isInt(v: unknown, min = 0): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min;
}
function exactKeys(v: Record<string, unknown>, keys: readonly string[]): boolean {
  const have = Object.keys(v);
  return have.length === keys.length && keys.every((k) => k in v);
}
function hasForbiddenKey(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(hasForbiddenKey);
  if (!isRecord(v)) return false;
  for (const k of Object.keys(v)) if (FORBIDDEN_KEYS.has(k) || hasForbiddenKey(v[k])) return true;
  return false;
}
function sortedUnique(v: string[]): boolean {
  return v.every((x, i) => i === 0 || x > v[i - 1]);
}

const EXTENT_NAMES: Record<string, string> = { E1: 'localized', E2: 'partial', E3: 'major', E4: 'essential-function' };
const MAGNITUDE_LABELS: Record<number, string> = { 1: 'Limited', 2: 'Moderate', 3: 'Material', 4: 'Severe', 5: 'Critical' };

/** Rubric duration band for an assumed number of days (same thresholds as the Fusion reader). */
export function durationBand(days: number): string | null {
  if (!Number.isFinite(days) || days <= 0) return null;
  if (days <= 1) return 'D1';
  if (days <= 7) return 'D2';
  if (days <= 30) return 'D3';
  return 'D4';
}

/** Matrix recomputation for a stress case: min/max over the assumed extent band(s) × the day-derived band. */
export function matrixRange(extent: string[], duration: string): [number, number] | null {
  if (extent.length === 0) return null;
  let lo = 6, hi = 0;
  for (const e of extent) {
    const row = MAGNITUDE_MATRIX[e];
    if (!row || !(duration in row)) return null;
    lo = Math.min(lo, row[duration]);
    hi = Math.max(hi, row[duration]);
  }
  return [lo, hi];
}

/** The exact text the reader serves beside a stress score; recomputed here so the guard can reject drift. */
export function stressDisplay(extent: string[], days: number, low: number, high: number): string {
  const names = extent.map((e) => EXTENT_NAMES[e] ?? e).join(' to ');
  const dayText = `${days} day${days === 1 ? '' : 's'}`;
  const score = low === high ? `${low}` : `${low}–${high}`;
  return `Conditional magnitude ${score}, assuming ${names} impairment for ${dayText}`;
}

function isPassage(v: unknown, register: ReadonlySet<string>): v is AnPassage {
  return isRecord(v) && exactKeys(v, ['text', 'source_ids']) && isStr(v.text)
    && isStrList(v.source_ids) && v.source_ids.every((s) => register.has(s));
}

function isCondition(v: unknown, register: ReadonlySet<string>): v is AnCondition {
  if (!isRecord(v) || !exactKeys(v, ['state', 'frame', 'label', 'text', 'source_ids'])) return false;
  if (typeof v.state !== 'string' || !CONDITION_STATES.has(v.state)) return false;
  if (typeof v.frame !== 'string' || !CONDITION_FRAMES.has(v.frame)) return false;
  if ((v.state === 'observed' && v.frame === 'scenario') || (v.state === 'assumed' && v.frame === 'historical')) return false;
  const frames: Record<string, string> = { historical: 'historically', current: 'currently', scenario: 'in scenario' };
  const label = `${v.state.charAt(0).toUpperCase()}${v.state.slice(1)} ${frames[v.frame]}`;
  if (v.label !== label || !isStr(v.text)) return false;
  if (!isStrList(v.source_ids) || !v.source_ids.every((s) => register.has(s))) return false;
  return v.state !== 'observed' || v.source_ids.length > 0;
}

function isMagnitudeCase(v: unknown): v is AnMagnitudeCase {
  if (!isRecord(v) || !exactKeys(v, ['kind', 'label', 'extent', 'days', 'duration', 'low', 'high', 'null_reason', 'assumption_note', 'display', 'score_label'])) return false;
  if (typeof v.kind !== 'string' || !CASE_KINDS.has(v.kind) || !isStr(v.label)) return false;
  if (v.kind === 'evidence_baseline') {
    return Array.isArray(v.extent) && v.extent.length === 0 && v.days === null && v.duration === null && v.low === null
      && v.high === null && isStr(v.null_reason) && v.assumption_note === null && v.display === AN_BASELINE_LABEL && v.score_label === null;
  }
  if (!isStrList(v.extent) || v.extent.length === 0 || !v.extent.every((e) => EXTENT_BANDS.includes(e)) || new Set(v.extent).size !== v.extent.length) return false;
  if (typeof v.days !== 'number' || !Number.isFinite(v.days) || v.days <= 0) return false;
  const band = durationBand(v.days);
  if (band === null || v.duration !== band) return false;
  const range = matrixRange(v.extent, band);
  if (!range || v.low !== range[0] || v.high !== range[1]) return false;
  if (v.null_reason !== null || v.assumption_note !== AN_STRESS_NOTE) return false;
  if (v.display !== stressDisplay(v.extent, v.days, range[0], range[1])) return false;
  return v.score_label === MAGNITUDE_LABELS[range[1]];
}

function isLegacyRelation(v: unknown): v is AnLegacyRelation {
  return isRecord(v) && exactKeys(v, ['record', 'record_id', 'relation', 'reason'])
    && typeof v.record === 'string' && LEGACY_RECORDS.has(v.record) && isStr(v.record_id)
    && typeof v.relation === 'string' && LEGACY_RELATIONS.has(v.relation) && isStr(v.reason);
}

const CARD_KEYS = ['card_id', 'title', 'hypothesis_class', 'taxonomy', 'boundary', 'summary', 'mechanism', 'local_anchor',
  'location_context', 'actor_context', 'historical_basis', 'transfer_limit', 'countercase', 'decisive_gap', 'conditions',
  'sequence', 'branches', 'magnitude_cases', 'stress_cases', 'assumptions', 'applicability_confidence', 'magnitude_confidence',
  'overlap_group', 'not_additive_note', 'legacy_relations', 'modifiers', 'source_ids'] as const;
const PASSAGE_SECTIONS = ['summary', 'mechanism', 'local_anchor', 'location_context', 'actor_context', 'historical_basis',
  'transfer_limit', 'countercase', 'decisive_gap'] as const;

function isCard(v: unknown, register: ReadonlySet<string>, families: Map<string, string>): v is AnCard {
  if (!isRecord(v) || !exactKeys(v, CARD_KEYS)) return false;
  if (typeof v.card_id !== 'string' || !CARD_ID.test(v.card_id) || !isStr(v.title) || !isStr(v.boundary)) return false;
  if (typeof v.hypothesis_class !== 'string' || !HYPOTHESIS_CLASSES.has(v.hypothesis_class)) return false;
  if (!Array.isArray(v.taxonomy) || v.taxonomy.length > AN_FAMILY_COUNT) return false;
  const taxIds: string[] = [];
  for (const t of v.taxonomy) {
    if (!isRecord(t) || !exactKeys(t, ['id', 'label']) || typeof t.id !== 'string' || families.get(t.id) !== t.label) return false;
    taxIds.push(t.id);
  }
  if (new Set(taxIds).size !== taxIds.length) return false;
  const cited = new Set<string>();
  for (const k of PASSAGE_SECTIONS) {
    const p = v[k];
    if (!isPassage(p, register)) return false;
    for (const s of p.source_ids) cited.add(s);
  }
  if (!Array.isArray(v.conditions) || v.conditions.length === 0 || v.conditions.length > MAX_LIST_LEN) return false;
  for (const c of v.conditions) {
    if (!isCondition(c, register)) return false;
    for (const s of c.source_ids) cited.add(s);
  }
  if (!isStrList(v.sequence) || !isStrList(v.branches) || !isStrList(v.assumptions)) return false;
  if (!Array.isArray(v.magnitude_cases) || v.magnitude_cases.length < 1 || v.magnitude_cases.length > MAX_LIST_LEN) return false;
  if (!v.magnitude_cases.every(isMagnitudeCase)) return false;
  const cases = v.magnitude_cases as AnMagnitudeCase[];
  // Exactly one evidence baseline, always first; every other case is a visibly assumed stress case.
  if (cases[0].kind !== 'evidence_baseline' || cases.slice(1).some((c) => c.kind !== 'stress_assumption')) return false;
  if (v.stress_cases !== cases.length - 1) return false;
  const conf = v.applicability_confidence;
  if (!isRecord(conf) || !exactKeys(conf, ['local', 'analogue']) || typeof conf.local !== 'string' || !CONFIDENCE.has(conf.local)
    || typeof conf.analogue !== 'string' || !CONFIDENCE.has(conf.analogue)) return false;
  if (typeof v.magnitude_confidence !== 'string' || !CONFIDENCE.has(v.magnitude_confidence)) return false;
  if (!isStr(v.overlap_group) || v.not_additive_note !== AN_NOT_ADDITIVE_NOTE) return false;
  if (!Array.isArray(v.legacy_relations) || v.legacy_relations.length > MAX_LIST_LEN || !v.legacy_relations.every(isLegacyRelation)) return false;
  if (!isStrList(v.modifiers) || !v.modifiers.every((m) => families.has(m))) return false;
  if (!isStrList(v.source_ids) || !sortedUnique(v.source_ids)) return false;
  // Source closure: the declared register equals exactly the sorted set of sources the prose cites.
  if (v.source_ids.length !== cited.size || !v.source_ids.every((s) => cited.has(s))) return false;
  return true;
}

function isDispositionEntry(v: unknown, register: ReadonlySet<string>, cardIds: ReadonlySet<string>, families: Map<string, string>): v is AnDispositionEntry {
  if (!isRecord(v) || !exactKeys(v, ['family_id', 'label', 'disposition', 'card_ids', 'reason', 'source_ids'])) return false;
  if (typeof v.family_id !== 'string' || !FAMILY_ID.test(v.family_id) || families.get(v.family_id) !== v.label) return false;
  if (typeof v.disposition !== 'string' || !DISPOSITIONS.has(v.disposition) || !isStr(v.reason)) return false;
  if (!isStrList(v.card_ids) || !v.card_ids.every((c) => cardIds.has(c)) || new Set(v.card_ids).size !== v.card_ids.length) return false;
  if (!isStrList(v.source_ids) || !v.source_ids.every((s) => register.has(s))) return false;
  if ((v.disposition === 'supported_local' || v.disposition === 'conditional_hypothesis') && v.card_ids.length === 0) return false;
  return !(v.disposition === 'supported_local' && v.source_ids.length === 0);
}

function isSource(v: unknown): v is AnSource {
  if (!isRecord(v) || !exactKeys(v, ['source_id', 'url', 'document_date', 'date_precision', 'locator', 'role', 'applicability',
    'claim_supported', 'does_not_support', 'transfer_limit', 'rights_class', 'verification', 'paraphrase', 'reviewed'])) return false;
  if (typeof v.source_id !== 'string' || !SOURCE_ID.test(v.source_id)) return false;
  if (typeof v.url !== 'string' || !/^https?:\/\/\S+$/.test(v.url) || v.url.length > MAX_STRING_LEN) return false;
  if (v.document_date !== null && (typeof v.document_date !== 'string' || !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(v.document_date))) return false;
  if ((v.document_date === null) !== (v.date_precision === null)) return false;
  if (v.date_precision !== null && (typeof v.date_precision !== 'string' || !DATE_PRECISIONS.has(v.date_precision))) return false;
  if (!isStr(v.locator) || !isStr(v.claim_supported) || !isStrList(v.does_not_support) || !isNullableStr(v.transfer_limit) || !isNullableStr(v.paraphrase)) return false;
  if (typeof v.role !== 'string' || !SOURCE_ROLES.has(v.role)) return false;
  if (typeof v.applicability !== 'string' || !APPLICABILITIES.has(v.applicability)) return false;
  // Rights and verification gate: uncertain / internal_only rights or unverified passages are never rendered.
  if (typeof v.rights_class !== 'string' || !ADMISSIBLE_RIGHTS.has(v.rights_class)) return false;
  if (typeof v.verification !== 'string' || !ADMISSIBLE_VERIFICATION.has(v.verification)) return false;
  return v.reviewed === true;
}

function isActor(v: unknown): v is AnActor {
  return isRecord(v) && exactKeys(v, ['type', 'id']) && typeof v.type === 'string' && ACTOR_TYPES.has(v.type) && isStr(v.id);
}

function isSummary(v: unknown): v is AnSummary {
  if (!isRecord(v) || !exactKeys(v, ['cards', 'families', 'sources', 'sources_cited', 'stress_cases', 'by_disposition'])) return false;
  if (![v.cards, v.families, v.sources, v.sources_cited, v.stress_cases].every((n) => isInt(n))) return false;
  const bd = v.by_disposition;
  return isRecord(bd) && exactKeys(bd, Object.keys(DISPOSITION_LABEL)) && Object.values(bd).every((n) => isInt(n));
}

const PUBLICATION_KEYS = ['contract', 'publication_no', 'created_at', 'origin', 'candidate_version', 'ddd', 'policy',
  'hypothetical_label', 'takeaway', 'chain_context', 'cards', 'dispositions', 'sources', 'gaps', 'summary', 'attribution', 'what_changed'] as const;

export function isAnPublication(v: unknown): v is AnPublication {
  if (!isRecord(v) || hasForbiddenKey(v) || !exactKeys(v, PUBLICATION_KEYS)) return false;
  if (v.contract !== AN_CONTRACT || !isInt(v.publication_no, 1) || !isStr(v.created_at) || !isInt(v.candidate_version, 1)) return false;
  if (typeof v.origin !== 'string' || !ORIGINS.has(v.origin)) return false;
  const ddd = v.ddd;
  if (!isRecord(ddd) || !exactKeys(ddd, ['publication_no', 'publication_sha256', 'created_at', 'evidence_cutoff', 'evidence_cutoff_basis'])
    || !isInt(ddd.publication_no, 1) || typeof ddd.publication_sha256 !== 'string' || !SHA256.test(ddd.publication_sha256)
    || !isStr(ddd.created_at) || !isStr(ddd.evidence_cutoff) || ddd.evidence_cutoff_basis !== 'publication_snapshot_created_at') return false;
  const pol = v.policy;
  if (!isRecord(pol) || !exactKeys(pol, ['policy_version', 'brief_v1_sha256', 'rubric_sha256', 'taxonomy_sha256', 'preview_cards_sha256',
    'preview_catalog_sha256', 'planning_commit', 'family_ids']) || pol.policy_version !== AN_POLICY_VERSION) return false;
  for (const k of ['brief_v1_sha256', 'rubric_sha256', 'taxonomy_sha256', 'preview_cards_sha256', 'preview_catalog_sha256']) {
    if (typeof pol[k] !== 'string' || !SHA256.test(pol[k] as string)) return false;
  }
  if (!isStr(pol.planning_commit) || !isStrList(pol.family_ids) || pol.family_ids.length !== AN_FAMILY_COUNT
    || pol.family_ids.some((f, i) => f !== AN_FAMILY_IDS[i])) return false;
  if (v.hypothetical_label !== AN_HYPOTHETICAL_LABEL) return false;

  if (!Array.isArray(v.sources) || v.sources.length === 0 || v.sources.length > MAX_LIST_LEN || !v.sources.every(isSource)) return false;
  const sources = v.sources as AnSource[];
  const register = new Set(sources.map((s) => s.source_id));
  if (register.size !== sources.length || !sortedUnique(sources.map((s) => s.source_id))) return false;

  // Thirteen dispositions, one per family, in taxonomy order: closure over the whole taxonomy.
  if (!Array.isArray(v.dispositions) || v.dispositions.length !== AN_FAMILY_COUNT) return false;
  const families = new Map<string, string>();
  for (const [i, d] of v.dispositions.entries()) {
    if (!isRecord(d) || d.family_id !== AN_FAMILY_IDS[i] || !isStr(d.label)) return false;
    families.set(d.family_id, d.label);
  }

  if (!Array.isArray(v.cards) || v.cards.length !== AN_CARD_COUNT || !v.cards.every((c) => isCard(c, register, families))) return false;
  const cards = v.cards as AnCard[];
  const cardIds = new Set(cards.map((c) => c.card_id));
  if (cardIds.size !== cards.length || !sortedUnique(cards.map((c) => c.card_id))) return false;
  if (!v.dispositions.every((d) => isDispositionEntry(d, register, cardIds, families))) return false;
  const dispositions = v.dispositions as AnDispositionEntry[];
  // Every family a card claims must list that card; every card a family lists must claim the family.
  for (const c of cards) {
    for (const t of c.taxonomy) if (!dispositions.find((d) => d.family_id === t.id)?.card_ids.includes(c.card_id)) return false;
  }
  for (const d of dispositions) {
    for (const cid of d.card_ids) if (!cards.find((c) => c.card_id === cid)?.taxonomy.some((t) => t.id === d.family_id)) return false;
  }

  if (!isPassage(v.takeaway, register) || !isPassage(v.chain_context, register)) return false;
  if (!Array.isArray(v.gaps) || v.gaps.length > MAX_LIST_LEN || !v.gaps.every((g) => isPassage(g, register))) return false;
  if (!isStrList(v.what_changed)) return false;

  const attr = v.attribution;
  if (!isRecord(attr) || !exactKeys(attr, ['author', 'reviewers', 'fixture']) || !isActor(attr.author)
    || !Array.isArray(attr.reviewers) || attr.reviewers.length > MAX_LIST_LEN || !attr.reviewers.every(isActor)
    || typeof attr.fixture !== 'boolean') return false;
  const author = attr.author as AnActor;
  const reviewers = attr.reviewers as AnActor[];
  // Fixture origin and fixture actors travel together; production content never carries a fixture actor.
  const anyFixtureActor = author.type === 'fixture' || reviewers.some((r) => r.type === 'fixture');
  if (attr.fixture !== (v.origin === 'fixture') || (v.origin === 'production' && anyFixtureActor)) return false;

  if (!isSummary(v.summary)) return false;
  const s = v.summary as AnSummary;
  const cited = new Set<string>();
  for (const c of cards) for (const id of c.source_ids) cited.add(id);
  if (s.cards !== cards.length || s.families !== AN_FAMILY_COUNT || s.sources !== sources.length || s.sources_cited !== cited.size) return false;
  if (s.stress_cases !== cards.reduce((n, c) => n + c.stress_cases, 0)) return false;
  for (const k of Object.keys(DISPOSITION_LABEL) as AnDisposition[]) {
    if (s.by_disposition[k] !== dispositions.filter((d) => d.disposition === k).length) return false;
  }
  return true;
}

function isDdd(v: unknown): v is AnDddBinding {
  return isRecord(v) && typeof v.state === 'string' && isNullableStr(v.reason)
    && (v.publication_no === null || isInt(v.publication_no, 1))
    && (v.publication_sha256 === null || (typeof v.publication_sha256 === 'string' && SHA256.test(v.publication_sha256)))
    && isNullableStr(v.eligibility_established_at) && isNullableStr(v.eligibility_changed_at);
}

/**
 * Bounded contract guard shared by the proxy and the browser. A body claiming `available` or
 * `stale` must carry a self-consistent publication whose DDD binding equals the DDD the sidecar
 * actually read and whose number matches the current pointer; state-only answers carry no
 * publication. `expectedDossierId`, when given, rejects any answer about a different dossier —
 * the browser never renders Las Bambas content under another requested id.
 */
export function isAnResponse(body: unknown, expectedDossierId?: string): body is AnResponse {
  if (!isRecord(body)) return false;
  if (body.schema_version !== AN_SCHEMA_VERSION) return false;
  if (typeof body.state !== 'string' || !STATES.has(body.state)) return false;
  if (body.dossier_id !== null && (typeof body.dossier_id !== 'string' || !AN_DOSSIER_ID_TOKEN.test(body.dossier_id))) return false;
  if (expectedDossierId !== undefined && body.dossier_id !== null && body.dossier_id !== expectedDossierId) return false;
  if (!isNullableStr(body.reason) || typeof body.checked_at !== 'string') return false;
  if (body.degraded !== undefined && typeof body.degraded !== 'boolean') return false;
  if (body.ddd !== null && !isDdd(body.ddd)) return false;
  if (body.currentness !== null && !(isRecord(body.currentness)
    && (body.currentness.publication_no === null || isInt(body.currentness.publication_no, 1))
    && isNullableStr(body.currentness.eligibility_changed_at))) return false;
  const claims = body.state === 'available' || body.state === 'stale';
  if (!claims) return body.publication === null;
  if (expectedDossierId !== undefined && body.dossier_id !== expectedDossierId) return false;
  if (!isAnPublication(body.publication) || !isRecord(body.ddd) || !isRecord(body.currentness)) return false;
  const pub = body.publication;
  const ddd = body.ddd as unknown as AnDddBinding;
  return pub.ddd.publication_no === ddd.publication_no && pub.ddd.publication_sha256 === ddd.publication_sha256
    && pub.publication_no === (body.currentness as { publication_no: number }).publication_no;
}

// ---------------------------------------------------------------------------
// view derivation
// ---------------------------------------------------------------------------

export type AnViewState = 'loading' | AnState;

const REASON_TEXT: Record<string, string> = {
  feature_disabled: 'The analyst supplement API is switched off (GIDEON_ANALYST_ENABLED=0).',
  store_unconfigured: 'No analyst store (or no DDD store) is mounted for the reader.',
  store_unreadable: 'The analyst store could not be read.',
  sidecar_unreachable: 'The Fusion sidecar did not answer in time.',
  sidecar_contract_invalid: 'The Fusion sidecar answered outside the analyst contract; nothing from that answer is shown.',
  analyst_route_missing: 'The Fusion sidecar release has no analyst route.',
  query_parameters_rejected: 'Query parameters are not accepted on the analyst route.',
  method_not_allowed: 'Only GET is accepted on the analyst route.',
  rate_limited: 'Too many analyst requests from this client.',
  browser_fetch_failed: 'This browser could not reach the analyst proxy.',
  browser_fetch_timeout: 'The analyst proxy did not answer this browser within the request deadline.',
  browser_response_malformed: 'The analyst proxy answer could not be parsed or failed the contract guard.',
  unknown_dossier: 'This dossier id is not in the finite analyst registry; nothing is requested for it.',
  dossier_not_enabled: 'This dossier id is reserved but not enabled for analyst publication; no content is served and no other dossier is substituted.',
  no_publication: 'No analyst supplement has been published for this dossier.',
  ddd_not_published: 'The dossier itself has no current publication, so no analyst cards can be bound.',
  ddd_unavailable: 'The dossier reader is unavailable, so no analyst cards can be bound.',
  ddd_withdrawn: 'The dossier publication was withdrawn; analyst cards bound to it are withheld.',
  ddd_mismatch: 'The current dossier publication is not the one the analyst supplement was bound to; it is withheld until re-validated.',
  ddd_stale: 'The dossier reader reports its publication as stale; the bound supplement is shown as stale.',
  update_failed: 'The latest analyst update failed; the last published supplement for the same dossier publication is shown as stale.',
  needs_revalidation: 'The supplement requires re-validation against the current dossier publication; its content is withheld.',
  eligibility_withdrawn: 'The analyst publication was withdrawn; its content is withheld.',
  eligibility_unknown: 'The analyst pointer carries an unknown eligibility.',
  publication_unsupported: 'The analyst publication contains content outside the public contract (unverified or rights-restricted source, forbidden field or vocabulary); nothing from it is shown.',
  publication_malformed: 'The analyst publication is malformed.',
  publication_missing: 'The analyst publication file is missing.',
  pointer_malformed: 'The analyst pointer is malformed.',
  pointer_missing: 'The analyst pointer is missing.',
  authority_changed: 'The analyst store changed while it was being read.',
  restricted_content_detected: 'The analyst publication referenced restricted content and was refused.',
  reader_busy: 'The analyst reader is busy.',
  reader_timeout: 'The analyst read exceeded its deadline.',
};

export function describeAnReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return REASON_TEXT[reason] ?? reason;
}

export function deriveAnViewState(body: AnResponse | null | undefined): AnViewState {
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

export interface AnFeedState {
  body: AnResponse | null;
  fetchError: string | null;
  fetchedAt: string | null;
  generation: number;
}

export const INITIAL_AN_FEED: AnFeedState = { body: null, fetchError: null, fetchedAt: null, generation: 0 };

export type AnBrowserFailure = 'browser_fetch_failed' | 'browser_fetch_timeout' | 'browser_response_malformed';

export type AnFeedEvent =
  | { type: 'response'; body: AnResponse; at: string; generation: number }
  | { type: 'failure'; reason: AnBrowserFailure; at: string; generation: number }
  /** Deselection / dossier change: clear everything and swallow any response still in flight. */
  | { type: 'reset'; generation: number };

export function reduceAnFeed(prev: AnFeedState, event: AnFeedEvent): AnFeedState {
  if (event.type === 'reset') return { ...INITIAL_AN_FEED, generation: Math.max(prev.generation, event.generation) };
  if (event.generation <= prev.generation) return prev;
  if (event.type === 'failure') return { body: null, fetchError: event.reason, fetchedAt: event.at, generation: event.generation };
  return { body: event.body, fetchError: null, fetchedAt: event.at, generation: event.generation };
}

export interface ResolvedAn {
  view: AnViewState;
  body: AnResponse | null;
  /** Only present for `available`/`stale`; the only thing that may be rendered. */
  publication: AnPublication | null;
}

export function resolveAn(state: AnFeedState): ResolvedAn {
  if (state.fetchError) return { view: 'unavailable', body: null, publication: null };
  const view = deriveAnViewState(state.body);
  const publication = (view === 'available' || view === 'stale') && state.body?.publication ? state.body.publication : null;
  return { view, body: state.body, publication };
}

// ---------------------------------------------------------------------------
// presentation helpers (read-only: nothing here scores or summarises)
// ---------------------------------------------------------------------------

export function baselineCase(card: AnCard): AnMagnitudeCase {
  return card.magnitude_cases[0];
}

export function stressCases(card: AnCard): AnMagnitudeCase[] {
  return card.magnitude_cases.slice(1);
}

/** Stable key for one stress case (card + index) used by stress selection / reset. */
export function stressKey(cardId: string, index: number): string {
  return `${cardId}:${index}`;
}

export function sourceById(pub: AnPublication, id: string): AnSource | null {
  return pub.sources.find((s) => s.source_id === id) ?? null;
}

export function dispositionsForCard(pub: AnPublication, cardId: string): AnDispositionEntry[] {
  return pub.dispositions.filter((d) => d.card_ids.includes(cardId));
}

export function formatAnTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}
