import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from './route';
import { analystProxyPath } from '@/lib/analyst';
import { FIXTURE_DRAFTS, FIXTURE_PUBLISHED, FIXTURE_UPDATE_FAILED, FIXTURE_WITHDRAWN, clone, stateOnly } from '@/lib/analyst.test-fixture';

const LB = 'las-bambas-matarani';
let ipCounter = 0;
function request(dossierId = LB, query = ''): Request {
  ipCounter += 1;
  return new Request(`http://osiris.test${analystProxyPath(dossierId)}${query}`, { headers: { 'x-forwarded-for': `10.7.0.${ipCounter}` } });
}
const ctx = (dossierId: string) => ({ params: Promise.resolve({ dossierId }) });
function sidecar(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('GET /api/fusion/dossiers/[dossierId]/analyst', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('forwards the published fixture verbatim, no-store, to the sidecar route for the requested id', async () => {
    fetchMock.mockResolvedValue(sidecar(200, FIXTURE_PUBLISHED));
    const res = await GET(request(), ctx(LB));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body).toEqual(FIXTURE_PUBLISHED);
    expect(body.publication.cards).toHaveLength(3);
    expect(body.publication.dispositions).toHaveLength(13);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(new RegExp(`/api/v1/foundation/dossiers/${LB}/analyst$`));
    expect(url).not.toContain('?');
    expect(init.cache).toBe('no-store');
  });

  it('forwards not_published, withdrawn and stale fixtures as served', async () => {
    for (const f of [FIXTURE_DRAFTS, FIXTURE_WITHDRAWN, FIXTURE_UPDATE_FAILED]) {
      fetchMock.mockResolvedValue(sidecar(200, f));
      const res = await GET(request(), ctx(LB));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(f);
    }
  });

  it('reserved ids are forwarded with their own id and the sidecar 404 dossier_not_enabled passes through state-only', async () => {
    fetchMock.mockResolvedValue(sidecar(404, stateOnly('unavailable', 'dossier_not_enabled', 'toromocho')));
    const res = await GET(request('toromocho'), ctx('toromocho'));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ state: 'unavailable', reason: 'dossier_not_enabled', dossier_id: 'toromocho', publication: null });
    expect((fetchMock.mock.calls[0] as [string])[0]).toMatch(/\/dossiers\/toromocho\/analyst$/);
  });

  it('never serves Las Bambas content under another requested id', async () => {
    fetchMock.mockResolvedValue(sidecar(200, FIXTURE_PUBLISHED));
    const res = await GET(request('mirador'), ctx('mirador'));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ state: 'unavailable', reason: 'sidecar_contract_invalid', dossier_id: 'mirador', publication: null });
  });

  it('unknown ids are a state-only 404 without contacting the sidecar', async () => {
    for (const id of ['unknown-mine', 'Las-Bambas-Matarani', '..', 'las-bambas-matarani%2F']) {
      const res = await GET(request(id), ctx(id));
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ state: 'unavailable', reason: 'unknown_dossier', publication: null });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['unavailable', 'feature_disabled', 503],
    ['unavailable', 'store_not_configured', 503],
    ['unavailable', 'malformed_store', 503],
    ['withdrawn', 'ddd_mismatch', 200],
    ['not_published', 'no_publication', 200],
  ] as const)('passes through %s/%s state-only with status %i', async (state, reason, status) => {
    fetchMock.mockResolvedValue(sidecar(status, stateOnly(state, reason)));
    const res = await GET(request(), ctx(LB));
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ state, reason, publication: null });
  });

  it('rejects query parameters without contacting the sidecar', async () => {
    const res = await GET(request(LB, '?card=LB-01'), ctx(LB));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ state: 'unavailable', reason: 'query_parameters_rejected' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('malformed or contract-violating 200 bodies become state-only 503, never partial claims', async () => {
    const broken = clone(FIXTURE_PUBLISHED);
    broken.publication!.sources[0].rights_class = 'internal_only' as never;
    fetchMock.mockResolvedValue(sidecar(200, broken));
    let res = await GET(request(), ctx(LB));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ state: 'unavailable', reason: 'sidecar_contract_invalid', publication: null });

    fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));
    res = await GET(request(), ctx(LB));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ state: 'unavailable', reason: 'sidecar_unreachable', publication: null });

    fetchMock.mockResolvedValue(sidecar(503, FIXTURE_PUBLISHED));
    res = await GET(request(), ctx(LB));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: 'sidecar_contract_invalid' });
  });

  it('sidecar unreachable, timeout, plain 404 and unexpected status are state-only', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    let res = await GET(request(), ctx(LB));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ state: 'unavailable', reason: 'sidecar_unreachable', dossier_id: LB });

    fetchMock.mockResolvedValue(new Response('Not Found', { status: 404 }));
    res = await GET(request(), ctx(LB));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ state: 'unavailable', reason: 'analyst_route_missing' });

    fetchMock.mockResolvedValue(sidecar(500, { error: 'boom' }));
    res = await GET(request(), ctx(LB));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: 'sidecar_unreachable' });
  });

  it('non-GET methods are 405 with Allow: GET', async () => {
    for (const h of [HEAD, POST, PUT, PATCH, DELETE, OPTIONS]) {
      const res = await h();
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('GET');
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });
});
