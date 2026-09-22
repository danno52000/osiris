import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

let ipCounter = 0;
function request(): Request {
  ipCounter += 1;
  return new Request('http://osiris.test/api/fusion/data-admin', {
    headers: { 'x-forwarded-for': `10.0.0.${ipCounter}` },
  });
}

function sidecar(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const AVAILABLE = {
  state: 'available',
  reason: null,
  checked_at: '2026-09-22T17:00:00+00:00',
  schema_revision_expected: '0012',
  schema_revision_observed: '0012',
  stale: false,
  cache_age_s: 0,
  manifest: { version: '1.0.0', sha256: 'abc', database_commit: 'def', reviewed_at: '2026-09-22T16:30:00Z' },
  sources: Array.from({ length: 8 }, (_, i) => ({ source_id: `S${i}`, datasets: [] })),
};

describe('GET /api/fusion/data-admin', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards an available payload verbatim with no-store and the sidecar route', async () => {
    fetchMock.mockResolvedValue(sidecar(200, AVAILABLE));
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.state).toBe('available');
    expect(body.sources).toHaveLength(8);
    expect(body.degraded).toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/foundation\/data-admin$/);
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('forwards a stale payload unchanged (stale flag and refresh_error survive)', async () => {
    fetchMock.mockResolvedValue(sidecar(200, { ...AVAILABLE, stale: true, cache_age_s: 900, refresh_error: 'timeout' }));
    const body = await (await GET(request())).json();
    expect(body.state).toBe('available');
    expect(body.stale).toBe(true);
    expect(body.refresh_error).toBe('timeout');
  });

  it.each(['disabled', 'unconfigured', 'unavailable'])(
    'passes through a 503 %s state body with its reason and status',
    async (state) => {
      fetchMock.mockResolvedValue(
        sidecar(503, { state, reason: `${state}_reason`, checked_at: 'x', schema_revision_expected: '0012', sources: [] }),
      );
      const res = await GET(request());
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.state).toBe(state);
      expect(body.reason).toBe(`${state}_reason`);
      expect(body.sources).toEqual([]);
      expect(body.degraded).toBeUndefined();
    },
  );

  it('reports unavailable + degraded when the sidecar cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED 10.9.9.9:8080 secret-host'));
    const res = await GET(request());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe('unavailable');
    expect(body.reason).toBe('sidecar_unreachable');
    expect(body.degraded).toBe(true);
    expect(body.sources).toEqual([]);
    expect(JSON.stringify(body)).not.toContain('secret-host');
  });

  it('reports unavailable + degraded on a malformed or unexpected sidecar answer', async () => {
    fetchMock.mockResolvedValue(sidecar(200, { hello: 'world' }));
    let body = await (await GET(request())).json();
    expect(body.state).toBe('unavailable');
    expect(body.degraded).toBe(true);

    fetchMock.mockResolvedValue(sidecar(500, { detail: 'boom' }));
    body = await (await GET(request())).json();
    expect(body.state).toBe('unavailable');
    expect(body.degraded).toBe(true);
  });

  it('answers 404 unavailable when the sidecar has no foundation route', async () => {
    fetchMock.mockResolvedValue(sidecar(404, { detail: 'Not Found' }));
    const res = await GET(request());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.state).toBe('unavailable');
    expect(body.reason).toBe('foundation_route_missing');
  });

  it('rate limits a single client IP without contacting the sidecar', async () => {
    fetchMock.mockResolvedValue(sidecar(200, AVAILABLE));
    const ip = '10.99.0.1';
    const mk = () => new Request('http://osiris.test/api/fusion/data-admin', { headers: { 'x-forwarded-for': ip } });
    for (let i = 0; i < 60; i += 1) {
      expect((await GET(mk())).status).toBe(200);
    }
    const calls = fetchMock.mock.calls.length;
    const limited = await GET(mk());
    expect(limited.status).toBe(429);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});
