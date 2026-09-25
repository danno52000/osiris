import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from './route';
import { UW_PROXY_PATH } from '@/lib/underwriting';
import { CORRIDOR_CASE_ID, REAL_PARTIAL, REAL_PUBLISHED, REAL_UPDATE_FAILED, SYNTHETIC_SCORED, clone, stateOnly } from '@/lib/underwriting.test-fixture';

let ipCounter = 0;
function request(query = ''): Request {
  ipCounter += 1;
  return new Request(`http://osiris.test${UW_PROXY_PATH}${query}`, { headers: { 'x-forwarded-for': `10.5.0.${ipCounter}` } });
}
function sidecar(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('GET /api/fusion/dossiers/las-bambas-matarani/underwriting', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('forwards the real five-case draft portfolio verbatim, no-store, to the literal sidecar underwriting route', async () => {
    fetchMock.mockResolvedValue(sidecar(200, REAL_PUBLISHED));
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body).toEqual(REAL_PUBLISHED);
    expect(body.publication.cases).toHaveLength(5);
    expect(body.publication.summary.both_scored).toBe(0);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/foundation\/dossiers\/las-bambas-matarani\/underwriting$/);
    expect(url).not.toContain('?');
    expect(init.cache).toBe('no-store');
  });

  it('forwards the partial, stale/update_failed and synthetic scored fixtures', async () => {
    for (const f of [REAL_PARTIAL, REAL_UPDATE_FAILED, SYNTHETIC_SCORED]) {
      fetchMock.mockResolvedValue(sidecar(200, f));
      const res = await GET(request());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(f);
    }
  });

  it.each([
    ['not_published', 'no_publication', 200],
    ['withdrawn', 'ddd_mismatch', 200],
    ['withdrawn', 'eligibility_withdrawn', 200],
    ['withdrawn', 'needs_revalidation', 200],
    ['unavailable', 'feature_disabled', 503],
    ['unavailable', 'publication_unsupported', 503],
  ] as const)('passes through %s/%s state-only with status %i and no publication', async (state, reason, status) => {
    fetchMock.mockResolvedValue(sidecar(status, stateOnly(state, reason)));
    const res = await GET(request());
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ state, reason, publication: null });
  });

  it('rejects query parameters without contacting the sidecar', async () => {
    for (const q of ['?case=85703c81840350485ba0cfe9', '?publication=1']) {
      const res = await GET(request(q));
      expect(res.status).toBe(400);
      expect((await res.json()).reason).toBe('query_parameters_rejected');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('malformed / forbidden claim-bearing 200 -> 503 state-only sidecar_contract_invalid, no case content leaks', async () => {
    const cases: Array<(b: typeof REAL_PUBLISHED) => void> = [
      (b) => { (b.publication as unknown as Record<string, unknown>).composite_risk = 2.5; },
      (b) => { (b.publication!.cases[0] as unknown as Record<string, unknown>).probability = 0.1; },
      (b) => { (b.publication!.cases[0] as unknown as Record<string, unknown>).reviewer = 'x'; },
      (b) => { b.ddd!.publication_sha256 = '0'.repeat(64); },
      (b) => { const c = b.publication!.cases.find((x) => x.case_id === CORRIDOR_CASE_ID)!; c.magnitude.low = 4; c.magnitude.high = 4; },
      (b) => { b.publication!.coverage.pop(); },
      (b) => { (b as { publication: unknown }).publication = {}; },
    ];
    for (const mutate of cases) {
      const b = clone(REAL_PUBLISHED); mutate(b);
      fetchMock.mockResolvedValue(sidecar(200, b));
      const res = await GET(request());
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body).toMatchObject({ state: 'unavailable', reason: 'sidecar_contract_invalid', publication: null, degraded: true });
      expect(JSON.stringify(body)).not.toContain(CORRIDOR_CASE_ID);
    }
  });

  it('status/state disagreement is contract-invalid', async () => {
    fetchMock.mockResolvedValue(sidecar(503, REAL_PUBLISHED));
    expect((await (await GET(request())).json()).reason).toBe('sidecar_contract_invalid');
    fetchMock.mockResolvedValue(sidecar(200, stateOnly('unavailable', 'feature_disabled')));
    expect((await (await GET(request())).json()).reason).toBe('sidecar_contract_invalid');
  });

  it('sidecar 404 -> underwriting_route_missing; other statuses/network/non-JSON -> 503 sidecar_unreachable', async () => {
    fetchMock.mockResolvedValue(new Response('nf', { status: 404 }));
    let res = await GET(request());
    expect(res.status).toBe(404);
    expect((await res.json()).reason).toBe('underwriting_route_missing');
    fetchMock.mockResolvedValue(new Response('x', { status: 500 }));
    expect((await (await GET(request())).json()).reason).toBe('sidecar_unreachable');
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    res = await GET(request());
    expect(res.status).toBe(503);
    expect((await res.json()).reason).toBe('sidecar_unreachable');
    fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));
    expect((await (await GET(request())).json()).reason).toBe('sidecar_unreachable');
  });

  it('non-GET methods are 405 with Allow: GET and no-store', async () => {
    for (const h of [HEAD, POST, PUT, PATCH, DELETE, OPTIONS]) {
      const res = await h();
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('GET');
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
