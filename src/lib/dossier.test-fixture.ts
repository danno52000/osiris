/**
 * Small hand-built `e2-dossier/1.0` bodies for tests: shaped exactly like the Fusion
 * sidecar's public projection of the replay fixture, but with a handful of
 * relationships. Counts here are test counts, not fixture or hosted counts.
 */
import type { DossierResponse, Publication } from './dossier';

export const T0 = '2026-09-22T00:00:00+00:00';
export const T1 = '2026-09-22T00:00:01+00:00';
export const T2 = '2026-09-22T06:00:00+00:00';

const ATTR = 'AidData. 2026. Chinese Financing for Transition Minerals Dataset, Version 2.0. ODC-By 1.0.';
export const REC_OWN = 'record:F01:aiddata_mineral_ownership:Equity_Holder=CITIC Metal Co. Ltd.:Mining_Site_ID=20';
export const REC_FIN = 'record:F01:aiddata_financial_contributions:AidData_Record_ID=100280';
export const REC_EVT = 'record:F01:aiddata_loan_events:Loan_Event_ID=7296:Loan_Event_Tranche=';
export const REC_ROLE = 'record:F01:aiddata_organization_roles:Loan_Event_ID=7296:Organization_Name=Album Enterprises Limited';

export const PUBLICATION: Publication = {
  publication_no: 1,
  created_at: T0,
  audience: 'prospect',
  contract: 'e2i-contracts-1.0/Publication',
  config_version: '1.0',
  rights_version: '1.0',
  bundle_fingerprint: 'f70fc0d4988c61fc755a60a213fcf079128dca3a0109ec0c7a3026e60b7b1ade',
  rule_versions: { mapping: 'deterministic_f01_mapping/1.1', projection: 'prospect_projection/1.2' },
  what_changed: { kind: 'initial' },
  entities: [
    { id: 'asset:aiddata-site-20', version: 1, kind: 'mining_asset', label: 'Las Bambas Copper Mine', resolution: 'as_named_by_source', sources: ['F01'], evidence: [REC_OWN] },
    { id: 'org:f01-name:citic-metal-co-ltd:c5e52eba5069', version: 1, kind: 'organization', label: 'CITIC Metal Co. Ltd.', resolution: 'as_named_by_source', sources: ['F01'], evidence: [REC_OWN] },
    { id: 'org:f01-name:album-enterprises-limited:41b55fd5001b', version: 1, kind: 'organization', label: 'Album Enterprises Limited', resolution: 'as_named_by_source', sources: ['F01'], evidence: [REC_FIN] },
    { id: 'org:f01-name:minera-las-bambas:a206c8ce4114', version: 1, kind: 'organization', label: 'Minera Las Bambas S.A.C.', resolution: 'as_named_by_source', sources: ['F01'], evidence: [REC_OWN] },
    { id: 'loan_event:f01:7296', version: 1, kind: 'loan_event', label: 'Album Enterprises USD 350m loan to Minera Las Bambas', resolution: 'as_named_by_source', sources: ['F01'], evidence: [REC_EVT] },
  ],
  edges: [
    {
      id: 'edge-own-1', version: 1, predicate: 'owns_equity',
      subject: 'org:f01-name:citic-metal-co-ltd:c5e52eba5069', object: 'asset:aiddata-site-20',
      evidence_category: 'documented', evidence: [REC_OWN],
      value: { equity_fraction_native: '0.15', equity_holder_origin: 'China', equity_holder_type: 'State-owned Company', ownership_notes: null },
      temporal: { as_of: 'dataset release' }, scope: {}, correction: null,
    },
    {
      id: 'edge-fin-1', version: 1, predicate: 'finances',
      subject: 'org:f01-name:album-enterprises-limited:41b55fd5001b', object: 'asset:aiddata-site-20',
      evidence_category: 'documented', evidence: [REC_FIN, REC_EVT],
      value: {
        instrument: 'commitment', flow_type: 'Loan', status: 'Completion',
        amount_nominal_usd_native: '350000000', amount_constant_usd_2023_native: '330721695.98',
        loan_event: 'loan_event:f01:7296', loan_event_tranche: null,
        not: ['payment', 'disbursement', 'outstanding_balance'],
      },
      temporal: { commitment_date: '2022-07-01', commitment_year: '2022' }, scope: { aiddata_record_id: '100280' }, correction: null,
    },
    {
      id: 'edge-role-1', version: 1, predicate: 'holds_role_in',
      subject: 'org:f01-name:album-enterprises-limited:41b55fd5001b', object: 'asset:aiddata-site-20',
      evidence_category: 'context', evidence: [REC_ROLE],
      value: { role: 'Funding_Agencies', is_finance_edge: false, loan_events: ['7296'], rows: 1 },
      temporal: {}, scope: { role: 'Funding_Agencies' }, correction: null,
    },
    {
      id: 'edge-op-1', version: 1, predicate: 'operates',
      subject: 'org:f01-name:minera-las-bambas:a206c8ce4114', object: 'asset:aiddata-site-20',
      evidence_category: 'documented', evidence: [REC_OWN],
      value: { operator_type: 'Joint Venture/Special Purpose Vehicle' }, temporal: { as_of: 'dataset release' }, scope: {}, correction: null,
    },
  ],
  assertions: [
    { id: 'edge-own-1', version: 1, predicate: 'owns_equity', evidence_category: 'documented', currentness: 'current', confidence: null },
    { id: 'edge-fin-1', version: 1, predicate: 'finances', evidence_category: 'documented', currentness: 'current', confidence: null },
    { id: 'edge-role-1', version: 1, predicate: 'holds_role_in', evidence_category: 'context', currentness: 'current', confidence: null },
    { id: 'edge-op-1', version: 1, predicate: 'operates', evidence_category: 'documented', currentness: 'current', confidence: null },
  ],
  narrative: ['Album Enterprises Limited made a loan commitment of USD 350000000 (nominal) to Las Bambas Copper Mine in 2022. Commitment, not a payment or outstanding balance.'],
  gap_register: [
    { kind: 'document_unverified', detail: 'mmg-las-bambas-operation-page: document_bytes_not_hashed; claims stay ineligible for publication', count: null, key: 'x-mmg-route-01' },
    { kind: 'assertions_pending', detail: '5 candidate assertion(s) are pending and not projected', count: 5, key: null },
    { kind: 'route_unpublished', detail: 'no accepted, verified evidence for the mine–Pillones–port transport chain; the route remains unpublished', count: null, key: null },
  ],
  attribution: [{ source_id: 'F01', attribution: ATTR }],
  evidence_manifest: [
    { ref: REC_OWN, kind: 'structured_record', source_id: 'F01', table: 'aiddata_mineral_ownership', native_key: { Equity_Holder: 'CITIC Metal Co. Ltd.', Mining_Site_ID: '20' }, release_label: 'fixture-slice', record_origin: 'replay_fixture', payload_sha256: 'a'.repeat(64), attribution: ATTR },
    { ref: REC_FIN, kind: 'structured_record', source_id: 'F01', table: 'aiddata_financial_contributions', native_key: { AidData_Record_ID: '100280' }, release_label: 'fixture-slice', record_origin: 'replay_fixture', payload_sha256: 'b'.repeat(64), attribution: ATTR },
    { ref: REC_EVT, kind: 'structured_record', source_id: 'F01', table: 'aiddata_loan_events', native_key: { Loan_Event_ID: '7296', Loan_Event_Tranche: '' }, release_label: 'fixture-slice', record_origin: 'replay_fixture', payload_sha256: 'c'.repeat(64), attribution: ATTR },
    { ref: REC_ROLE, kind: 'structured_record', source_id: 'F01', table: 'aiddata_organization_roles', native_key: { Loan_Event_ID: '7296', Organization_Name: 'Album Enterprises Limited' }, release_label: 'fixture-slice', record_origin: 'replay_fixture', payload_sha256: 'd'.repeat(64), attribution: ATTR },
  ],
};

const OK_ATTEMPT = { started_at: T0, ended_at: T1, status: 'succeeded', outcome: 'qualifying_refresh' };

export const AVAILABLE: DossierResponse = {
  schema_version: 'e2-dossier/1.0',
  dossier_id: 'las-bambas-matarani',
  state: 'available',
  reason: null,
  checked_at: T2,
  origin: 'replay_demonstration',
  currentness: {
    publication_no: 1,
    eligibility_established_at: T0,
    eligibility_changed_at: null,
    restored: false,
    latest_attempt: OK_ATTEMPT,
    last_successful_refresh: OK_ATTEMPT,
  },
  evidence_origins: ['replay_fixture'],
  publication: PUBLICATION,
};

export const STALE_FAILED: DossierResponse = {
  ...AVAILABLE,
  state: 'stale',
  reason: 'latest_attempt_failed',
  currentness: {
    ...AVAILABLE.currentness!,
    latest_attempt: { started_at: T2, ended_at: T2, status: 'failed', outcome: 'latest_attempt_failed' },
  },
};

export function stateOnly(state: DossierResponse['state'], reason: string): DossierResponse {
  return {
    schema_version: 'e2-dossier/1.0',
    dossier_id: 'las-bambas-matarani',
    state,
    reason,
    checked_at: T2,
    origin: 'replay_demonstration',
    currentness: null,
    evidence_origins: [],
    publication: null,
  };
}
