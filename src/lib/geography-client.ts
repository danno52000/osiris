import {
  GEO_PROXY_PATH,
  isGeoResponse,
  type GeoBrowserFailure,
  type GeoFeedEvent,
} from './geography';

/** Browser-side request deadline; a hung proxy renders state-only unavailable, not an old overlay. */
export const GEO_REQUEST_TIMEOUT_MS = 10_000;

/**
 * One bounded request to the geography proxy: never rejects; returns the reducer event.
 * A body that fails the contract guard never enters the feed and is never drawn.
 */
export async function fetchGeographyOnce(
  generation: number,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = GEO_REQUEST_TIMEOUT_MS,
): Promise<GeoFeedEvent> {
  const at = () => new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(GEO_PROXY_PATH, { cache: 'no-store', signal: controller.signal });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { type: 'failure', reason: 'browser_response_malformed', at: at(), generation };
    }
    if (!isGeoResponse(body)) {
      return { type: 'failure', reason: 'browser_response_malformed', at: at(), generation };
    }
    return { type: 'response', body, at: at(), generation };
  } catch (e) {
    const reason: GeoBrowserFailure = e instanceof Error && e.name === 'AbortError' ? 'browser_fetch_timeout' : 'browser_fetch_failed';
    return { type: 'failure', reason, at: at(), generation };
  } finally {
    clearTimeout(timer);
  }
}
