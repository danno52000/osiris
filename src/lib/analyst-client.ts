import {
  analystProxyPath,
  isAnResponse,
  type AnBrowserFailure,
  type AnFeedEvent,
} from './analyst';

/** Browser-side request deadline; a hung proxy renders state-only unavailable, not old claims. */
export const AN_REQUEST_TIMEOUT_MS = 10_000;

/**
 * One bounded request to the analyst proxy for the requested dossier id: never rejects; returns
 * the reducer event. A body that fails the contract guard, or that answers about a different
 * dossier than the one requested, never enters the feed.
 */
export async function fetchAnalystOnce(
  dossierId: string,
  generation: number,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = AN_REQUEST_TIMEOUT_MS,
): Promise<AnFeedEvent> {
  const at = () => new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(analystProxyPath(dossierId), { cache: 'no-store', signal: controller.signal });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { type: 'failure', reason: 'browser_response_malformed', at: at(), generation };
    }
    if (!isAnResponse(body, dossierId)) {
      return { type: 'failure', reason: 'browser_response_malformed', at: at(), generation };
    }
    return { type: 'response', body, at: at(), generation };
  } catch (e) {
    const reason: AnBrowserFailure = e instanceof Error && e.name === 'AbortError' ? 'browser_fetch_timeout' : 'browser_fetch_failed';
    return { type: 'failure', reason, at: at(), generation };
  } finally {
    clearTimeout(timer);
  }
}
