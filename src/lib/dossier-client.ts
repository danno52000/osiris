import { isDossierResponse, type BrowserFailure, type FeedEvent } from './dossier';
import { dossierProxyPath } from './dossier-registry';

/** Browser-side request deadline; a hung proxy renders state-only unavailable, not old claims. */
export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * One bounded request to the DDD proxy for the requested dossier id: never rejects; returns the
 * event for the reducer. `generation` is the monotonic number of this request so a late answer
 * can never overwrite a newer one. A body that fails the contract guard, or that answers about a
 * different dossier than the one requested, never enters the feed.
 */
export async function fetchDossierOnce(
  dossierId: string,
  generation: number,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<FeedEvent> {
  const at = () => new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(dossierProxyPath(dossierId), { cache: 'no-store', signal: controller.signal });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { type: 'failure', reason: 'browser_response_malformed', at: at(), generation };
    }
    if (!isDossierResponse(body, dossierId)) {
      return { type: 'failure', reason: 'browser_response_malformed', at: at(), generation };
    }
    return { type: 'response', body, at: at(), generation };
  } catch (e) {
    const reason: BrowserFailure = e instanceof Error && e.name === 'AbortError' ? 'browser_fetch_timeout' : 'browser_fetch_failed';
    return { type: 'failure', reason, at: at(), generation };
  } finally {
    clearTimeout(timer);
  }
}
