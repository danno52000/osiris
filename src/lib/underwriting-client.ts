import {
  UW_PROXY_PATH,
  isUwResponse,
  type UwBrowserFailure,
  type UwFeedEvent,
} from './underwriting';

/** Browser-side request deadline; a hung proxy renders state-only unavailable, not old claims. */
export const UW_REQUEST_TIMEOUT_MS = 10_000;

/**
 * One bounded request to the underwriting proxy: never rejects; returns the reducer event.
 * A body that fails the contract guard never enters the feed.
 */
export async function fetchUnderwritingOnce(
  generation: number,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = UW_REQUEST_TIMEOUT_MS,
): Promise<UwFeedEvent> {
  const at = () => new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(UW_PROXY_PATH, { cache: 'no-store', signal: controller.signal });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { type: 'failure', reason: 'browser_response_malformed', at: at(), generation };
    }
    if (!isUwResponse(body)) {
      return { type: 'failure', reason: 'browser_response_malformed', at: at(), generation };
    }
    return { type: 'response', body, at: at(), generation };
  } catch (e) {
    const reason: UwBrowserFailure = e instanceof Error && e.name === 'AbortError' ? 'browser_fetch_timeout' : 'browser_fetch_failed';
    return { type: 'failure', reason, at: at(), generation };
  } finally {
    clearTimeout(timer);
  }
}
