/** Shared E5 fixtures for tests: Fusion public projections of the pinned reader fixtures (see underwriting-fixtures/PIN.json). */
import { uwUnavailableResponse, type UwResponse } from './underwriting';
import PUBLISHED_JSON from './underwriting-fixtures/uw_published.json';
import PARTIAL_JSON from './underwriting-fixtures/uw_partial.json';
import UPDATE_FAILED_JSON from './underwriting-fixtures/uw_update_failed.json';
import SCORED_JSON from './underwriting-fixtures/uw_scored.json';

/** The five real draft cases decided by an isolated FIXTURE actor: corridor magnitude 3/LOW (assumed E3 x D2), everything else N/A; 0 cases with both scores. Not an accepted publication. */
export const REAL_PUBLISHED = PUBLISHED_JSON as unknown as UwResponse;
/** Four published cases; the corridor case listed under not_published (pending). */
export const REAL_PARTIAL = PARTIAL_JSON as unknown as UwResponse;
/** Publication 1 served as stale/update_failed after a failed revision publish. */
export const REAL_UPDATE_FAILED = UPDATE_FAILED_JSON as unknown as UwResponse;
/** SYNTHETIC chart-test input only: two cases with both axes numeric. Not evidence, not a reviewed rating. */
export const SYNTHETIC_SCORED = SCORED_JSON as unknown as UwResponse;

export const CORRIDOR_CASE_ID = '85703c81840350485ba0cfe9';
export const TERMINAL_CASE_ID = 'b9442075b789de2db3654ee0';

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function stateOnly(state: UwResponse['state'], reason: string): UwResponse {
  const base = uwUnavailableResponse(reason);
  delete base.degraded;
  return { ...base, state };
}
