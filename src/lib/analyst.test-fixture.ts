/**
 * Shared E7 fixtures for tests: Fusion `sidecar/analyst.py` public projections of the pinned
 * isolated conformance stores under `sidecar/analyst_fixtures` (see analyst-fixtures/PIN.json).
 * Fixture actors, synthetic retained hashes — NOT admitted real content and never an accepted
 * GIDEON publication. `checked_at` is normalised to 2026-09-25T12:30:00+00:00.
 */
import { anUnavailableResponse, type AnResponse } from './analyst';
import PUBLISHED_JSON from './analyst-fixtures/an_published.json';
import DRAFTS_JSON from './analyst-fixtures/an_drafts.json';
import WITHDRAWN_JSON from './analyst-fixtures/an_withdrawn.json';
import UPDATE_FAILED_JSON from './analyst-fixtures/an_update_failed.json';

/** Three cards (LB-01, LB-04, LB-05), thirteen dispositions, four stress cases, nine reviewed fixture sources; fixture actors. */
export const FIXTURE_PUBLISHED = PUBLISHED_JSON as unknown as AnResponse;
/** Unverified preview conversion: candidate prepared, nothing published (`not_published` / `no_publication`). */
export const FIXTURE_DRAFTS = DRAFTS_JSON as unknown as AnResponse;
/** Publication withdrawn by the fixture decider (`withdrawn` / `eligibility_withdrawn`). */
export const FIXTURE_WITHDRAWN = WITHDRAWN_JSON as unknown as AnResponse;
/** Publication 1 served as stale after a failed revision publish (`stale` / `update_failed`). */
export const FIXTURE_UPDATE_FAILED = UPDATE_FAILED_JSON as unknown as AnResponse;

export const FIXTURE_CARD_IDS = ['LB-01', 'LB-04', 'LB-05'] as const;

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function stateOnly(state: AnResponse['state'], reason: string, dossierId: string | null = 'las-bambas-matarani'): AnResponse {
  const base = anUnavailableResponse(reason, dossierId);
  delete base.degraded;
  return { ...base, state };
}
