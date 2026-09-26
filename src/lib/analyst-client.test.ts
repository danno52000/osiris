/** Browser client for the dynamic analyst proxy: bounded, generation-tagged, fail-closed. */
import { describe, expect, it, vi } from 'vitest';
import { fetchAnalystOnce } from './analyst-client';
import { FIXTURE_PUBLISHED, stateOnly } from './analyst.test-fixture';

const LB = 'las-bambas-matarani';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('fetchAnalystOnce', () => {
  it('requests the dynamic proxy path for the requested id with no-store and returns the accepted body', async () => {
    const f = vi.fn(async () => json(FIXTURE_PUBLISHED));
    const ev = await fetchAnalystOnce(LB, 7, f as unknown as typeof fetch);
    expect(ev).toMatchObject({ type: 'response', generation: 7 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/fusion/dossiers/${LB}/analyst`);
    expect(init.cache).toBe('no-store');
    const reserved = vi.fn(async () => json(stateOnly('unavailable', 'dossier_not_enabled', 'toromocho'), 404));
    const rv = await fetchAnalystOnce('toromocho', 1, reserved as unknown as typeof fetch);
    expect(rv.type).toBe('response');
    expect((reserved.mock.calls[0] as unknown as [string])[0]).toBe('/api/fusion/dossiers/toromocho/analyst');
  });

  it('never lets a body about another dossier into the feed (no Las Bambas fallback)', async () => {
    const f = vi.fn(async () => json(FIXTURE_PUBLISHED));
    const ev = await fetchAnalystOnce('toromocho', 1, f as unknown as typeof fetch);
    expect(ev).toMatchObject({ type: 'failure', reason: 'browser_response_malformed' });
  });

  it('malformed JSON or a contract-violating body is browser_response_malformed', async () => {
    const bad = vi.fn(async () => new Response('<html>', { status: 200 }));
    expect(await fetchAnalystOnce(LB, 1, bad as unknown as typeof fetch)).toMatchObject({ type: 'failure', reason: 'browser_response_malformed' });
    const broken = JSON.parse(JSON.stringify(FIXTURE_PUBLISHED));
    broken.publication.cards.pop();
    const f = vi.fn(async () => json(broken));
    expect(await fetchAnalystOnce(LB, 1, f as unknown as typeof fetch)).toMatchObject({ type: 'failure', reason: 'browser_response_malformed' });
  });

  it('network failure and deadline abort are distinct failure reasons', async () => {
    const boom = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect(await fetchAnalystOnce(LB, 1, boom as unknown as typeof fetch)).toMatchObject({ type: 'failure', reason: 'browser_fetch_failed' });
    const hang = vi.fn((_: string, init?: RequestInit) => new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    expect(await fetchAnalystOnce(LB, 1, hang as unknown as typeof fetch, 5)).toMatchObject({ type: 'failure', reason: 'browser_fetch_timeout' });
  });
});
