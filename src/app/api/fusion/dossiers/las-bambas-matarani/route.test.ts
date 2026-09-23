import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from './route';
import { PROXY_PATH } from '@/lib/dossier';
import { AVAILABLE, STALE_FAILED, stateOnly } from '@/lib/dossier.test-fixture';

let ipCounter = 0;
function request(query = ''): Request {
  ipCounter += 1;
  return new Request(`http://osiris.test${PROXY_PATH}${query}`, {
    headers: { 'x-forwarded-for': `10.0.0.${ipCounter}` },
  });
}

function sidecar(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('GET /api/fusion/dossiers/las-bambas-matarani', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards an available dossier verbatim, no-store, to the literal sidecar dossier route', async () => {
    fetchMock.mockResolvedValue(sidecar(200, AVAILABLE));
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body).toEqual(AVAILABLE);
    expect(body.degraded).toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/foundation\/dossiers\/las-bambas-matarani$/);
    expect(url).not.toContain('?');
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('forwards a stale dossier with its reason and retained publication', async () => {
    fetchMock.mockResolvedValue(sidecar(200, STALE_FAILED));
    const body = await (await GET(request())).json();
    expect(body.state).toBe('stale');
    expect(body.reason).toBe('latest_attempt_failed');
    expect(body.publication.publication_no).toBe(1);
    expect(body.currentness.latest_attempt.status).toBe('failed');
  });

  it.each([
    ['not_published', 'no_publication', 200],
    ['withdrawn', 'eligibility_withdrawn', 200],
    ['withdrawn', 'publication_invalidated', 200],
    ['unavailable', 'publication_missing', 503],
    ['unavailable', 'feature_disabled', 503],
  ] as const)('passes through the %s/%s state-only body with status %i', async (state, reason, status) => {
    fetchMock.mockResolvedValue(sidecar(status, stateOnly(state, reason)));
    const res = await GET(request());
    expect(res.status).toBe(status);
    const body = await res.json();
    expect(body.state).toBe(state);
    expect(body.reason).toBe(reason);
    expect(body.publication).toBeNull();
    expect(body.degraded).toBeUndefined();
  });

  it('rejects client query parameters (audience/publication/history/path) without contacting the sidecar', async () => {
    fetchMock.mockResolvedValue(sidecar(200, AVAILABLE));
    for (const q of ['?audience=internal', '?publication=1', '?history=1', '?path=..%2F']) {
      const res = await GET(request(q));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.state).toBe('unavailable');
      expect(body.reason).toBe('query_parameters_rejected');
      expect(body.publication).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports 503 unavailable + degraded when the sidecar cannot be reached, without leaking the error', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED 10.9.9.9:8080 secret-host'));
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.state).toBe('unavailable');
    expect(body.reason).toBe('sidecar_unreachable');
    expect(body.degraded).toBe(true);
    expect(body.publication).toBeNull();
    expect(JSON.stringify(body)).not.toContain('secret-host');
  });

  it('reports unavailable + degraded on malformed, foreign-schema or unexpected sidecar answers', async () => {
    fetchMock.mockResolvedValue(sidecar(200, { hello: 'world' }));
    let res = await GET(request());
    expect(res.status).toBe(503);
    expect((await res.json()).degraded).toBe(true);

    // status/state disagreement is outside the contract
    fetchMock.mockResolvedValue(sidecar(200, stateOnly('unavailable', 'publication_missing')));
    res = await GET(request());
    expect(res.status).toBe(503);
    expect((await res.json()).degraded).toBe(true);
    fetchMock.mockResolvedValue(sidecar(503, AVAILABLE));
    expect((await GET(request())).status).toBe(503);
    expect((await (await GET(request())).json()).degraded).toBe(true);
    fetchMock.mockResolvedValue(sidecar(200, { ...AVAILABLE, state: 'internal' }));
    expect((await (await GET(request())).json()).degraded).toBe(true);

    fetchMock.mockResolvedValue(sidecar(200, { ...AVAILABLE, schema_version: 'e2-dossier/2.0' }));
    expect((await (await GET(request())).json()).degraded).toBe(true);

    fetchMock.mockResolvedValue(sidecar(200, { ...AVAILABLE, dossier_id: 'other-dossier' }));
    expect((await (await GET(request())).json()).degraded).toBe(true);

    fetchMock.mockResolvedValue(sidecar(500, { detail: 'boom' }));
    const body = await (await GET(request())).json();
    expect(body.state).toBe('unavailable');
    expect(body.degraded).toBe(true);
  });

  it('turns a structurally malformed claim-bearing 200 into 503 state-only sidecar_contract_invalid (R6)', async () => {
    const malformed: unknown[] = [
      { ...AVAILABLE, publication: {} },
      { ...AVAILABLE, publication: null },
      { ...AVAILABLE, currentness: null },
      { ...AVAILABLE, currentness: { publication_no: 1 } },
      { ...AVAILABLE, publication: { ...AVAILABLE.publication, edges: undefined } },
      { ...AVAILABLE, publication: { ...AVAILABLE.publication, edges: 'many' } },
      { ...AVAILABLE, publication: { ...AVAILABLE.publication, edges: [{ id: 'e1' }] } },
      { ...AVAILABLE, publication: { ...AVAILABLE.publication, edges: [{ ...AVAILABLE.publication!.edges[0], evidence: null }] } },
      { ...AVAILABLE, publication: { ...AVAILABLE.publication, evidence_manifest: [{ ref: 'x', kind: 'internal_note' }] } },
      { ...AVAILABLE, publication: { ...AVAILABLE.publication, evidence_manifest: [{ kind: 'structured_record' }] } },
      { ...AVAILABLE, publication: { ...AVAILABLE.publication, gap_register: [null] } },
      { ...AVAILABLE, publication: { ...AVAILABLE.publication, narrative: [1, 2] } },
      { ...AVAILABLE, publication: { ...AVAILABLE.publication, rule_versions: null } },
      { ...AVAILABLE, publication: { ...AVAILABLE.publication, what_changed: {} } },
      { ...STALE_FAILED, publication: {} },
      { ...stateOnly('withdrawn', 'eligibility_withdrawn'), publication: AVAILABLE.publication },
    ];
    for (const body of malformed) {
      fetchMock.mockResolvedValue(sidecar(200, body));
      const res = await GET(request());
      expect(res.status, JSON.stringify(body).slice(0, 120)).toBe(503);
      expect(res.headers.get('cache-control')).toBe('no-store');
      const out = await res.json();
      expect(out.state).toBe('unavailable');
      expect(out.reason).toBe('sidecar_contract_invalid');
      expect(out.degraded).toBe(true);
      expect(out.publication).toBeNull();
      expect(out.currentness).toBeNull();
      expect(JSON.stringify(out)).not.toContain('owns_equity');
    }
    // a well-formed answer immediately afterwards is forwarded again (no sticky failure)
    fetchMock.mockResolvedValue(sidecar(200, AVAILABLE));
    expect((await GET(request())).status).toBe(200);
  });

  it('answers 404 unavailable when the sidecar has no dossier route', async () => {
    fetchMock.mockResolvedValue(sidecar(404, { detail: 'Not Found' }));
    const res = await GET(request());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.state).toBe('unavailable');
    expect(body.reason).toBe('dossier_route_missing');
  });

  it('rate limits a single client IP without contacting the sidecar', async () => {
    fetchMock.mockImplementation(async () => sidecar(200, AVAILABLE));
    const ip = '10.98.0.1';
    const mk = () => new Request(`http://osiris.test${PROXY_PATH}`, { headers: { 'x-forwarded-for': ip } });
    for (let i = 0; i < 60; i += 1) {
      expect((await GET(mk())).status).toBe(200);
    }
    const calls = fetchMock.mock.calls.length;
    const res = await GET(mk());
    expect(res.status).toBe(429);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).reason).toBe('rate_limited');
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('answers 405 no-store to every non-GET method without contacting the sidecar', async () => {
    fetchMock.mockResolvedValue(sidecar(200, AVAILABLE));
    for (const handler of [HEAD, POST, PUT, PATCH, DELETE, OPTIONS]) {
      const res = await handler();
      expect(res.status).toBe(405);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('allow')).toBe('GET');
      const body = await res.json();
      expect(body.state).toBe('unavailable');
      expect(body.reason).toBe('method_not_allowed');
      expect(body.publication).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sets Cache-Control: no-store on every status (200, 400, 404, 503)', async () => {
    fetchMock.mockResolvedValue(sidecar(200, AVAILABLE));
    expect((await GET(request())).headers.get('cache-control')).toBe('no-store');
    expect((await GET(request('?history=1'))).headers.get('cache-control')).toBe('no-store');
    fetchMock.mockResolvedValue(sidecar(404, { detail: 'Not Found' }));
    expect((await GET(request())).headers.get('cache-control')).toBe('no-store');
    fetchMock.mockResolvedValue(sidecar(503, stateOnly('unavailable', 'feature_disabled')));
    expect((await GET(request())).headers.get('cache-control')).toBe('no-store');
  });
});
