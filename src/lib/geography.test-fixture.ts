/** Shared E4 fixtures for tests: Fusion public projections of the pinned reader fixtures (see geography-fixtures/PIN.json). */
import { geoUnavailableResponse, type GeoResponse } from './geography';
import type { VulnResponse } from './vulnerability';
import GEO_FULL_JSON from './geography-fixtures/geo_full.json';
import GEO_PARTIAL_JSON from './geography-fixtures/geo_partial.json';
import GEO_WITHDRAWN_JSON from './geography-fixtures/geo_withdrawn.json';
import VULN_VECTOR_JSON from './geography-fixtures/vuln_vector.json';

/** Three approved approximate anchors + two schematic links bound to DDD publication 3 (fixture actor; not accepted content). */
export const GEO_FULL = GEO_FULL_JSON as unknown as GeoResponse;
/** Las Bambas + Matarani only; Pillones explicitly missing, both links explicitly omitted. */
export const GEO_PARTIAL = GEO_PARTIAL_JSON as unknown as GeoResponse;
/** Manually withdrawn geography: state-only `withdrawn/eligibility_withdrawn`. */
export const GEO_WITHDRAWN = GEO_WITHDRAWN_JSON as unknown as GeoResponse;
/** e3b-vuln-1.1 publication 2 carrying the LOG/LOW hypothetical vector beside all-null magnitudes (fixture actor). */
export const VULN_VECTOR = VULN_VECTOR_JSON as unknown as VulnResponse;

export function cloneGeo<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function geoStateOnly(state: GeoResponse['state'], reason: string): GeoResponse {
  const base = geoUnavailableResponse(reason);
  delete base.degraded;
  return { ...base, state };
}
