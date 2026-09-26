/**
 * E8 (gideon-database #52 amended E8 brief v1.0): finite dossier registry, default-off Toromocho,
 * requested-id DDD / geography clients and proxies, and the LB → Toromocho → clear selection
 * sequence with late answers. Every body here is the pinned Las Bambas conformance fixture or a
 * copy retagged with another id for contract conformance only — no Toromocho content, source
 * admission or operational evidence is asserted or implied.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DOSSIER_REGISTRY,
  LAS_BAMBAS_ID,
  dossierProxyPath,
  dossierRegistryEntry,
  dossierSidecarPath,
  geographyProxyPath,
  geographySidecarPath,
  parseRoster,
} from './dossier-registry';
import { ANALYST_DOSSIERS, analystRegistryEntry, analystProxyPath } from './analyst';
import { DOSSIER_ID, INITIAL_FEED, isDossierResponse, reduceFeed, resolveView, type DossierResponse } from './dossier';
import { fetchDossierOnce } from './dossier-client';
import { INITIAL_GEO_FEED, isGeoResponse, reduceGeoFeed, resolveGeo, type GeoResponse } from './geography';
import { fetchGeographyOnce } from './geography-client';
import { INITIAL_VULN_FEED, reduceVulnFeed } from './vulnerability';
import { AVAILABLE, stateOnly } from './dossier.test-fixture';
import { GEO_FULL, cloneGeo, geoStateOnly } from './geography.test-fixture';
import { GET as dossierGET } from '@/app/api/fusion/dossiers/[dossierId]/route';
import { GET as geoGET } from '@/app/api/fusion/dossiers/[dossierId]/geography/route';

const TORO = 'toromocho';
const ctx = (dossierId: string) => ({ params: Promise.resolve({ dossierId }) });
let ip = 0;
function request(path: string): Request {
  ip += 1;
  return new Request(`http://osiris.test${path}`, { headers: { 'x-forwarded-for': `10.8.0.${ip}` } });
}
function sidecar(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
function retag<T extends { dossier_id: string | null }>(body: T, id: string): T {
  return { ...cloneGeo(body), dossier_id: id };
}
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('finite dossier registry', () => {
  it('is shared by the analyst registry; Las Bambas listed, Toromocho/Mirador/Cerro reserved and unlisted', () => {
    expect(ANALYST_DOSSIERS).toBe(DOSSIER_REGISTRY);
    expect(analystRegistryEntry).toBe(dossierRegistryEntry);
    expect(DOSSIER_REGISTRY.map((d) => d.id)).toEqual([LAS_BAMBAS_ID, TORO, 'mirador', 'cerro-de-maimon']);
    expect(DOSSIER_REGISTRY.filter((d) => d.listed).map((d) => d.id)).toEqual([LAS_BAMBAS_ID]);
    expect(DOSSIER_ID).toBe(LAS_BAMBAS_ID);
    const toro = dossierRegistryEntry(TORO)!;
    expect(toro).toMatchObject({ listed: false, reserved: true, legacyAssessments: false, fullDossierHref: null, connectivityNote: null });
    expect(toro.subtitle).toMatch(/no route, port or corridor is inferred/);
    expect(dossierRegistryEntry(LAS_BAMBAS_ID)).toMatchObject({ legacyAssessments: true, fullDossierHref: `/dossiers/${LAS_BAMBAS_ID}` });
  });

  it('rejects unknown, malformed and non-string ids without any lookup', () => {
    for (const bad of ['las-bambas', 'Toromocho', 'toromocho/x', '../etc', '', 'a'.repeat(65), null, undefined, 7 as unknown as string]) {
      expect(dossierRegistryEntry(bad)).toBeNull();
    }
  });

  it('roster: default Las Bambas only; opt-in adds registry ids; any unknown token fails closed to the default', () => {
    expect(parseRoster(undefined).map((d) => d.id)).toEqual([LAS_BAMBAS_ID]);
    expect(parseRoster('  ').map((d) => d.id)).toEqual([LAS_BAMBAS_ID]);
    expect(parseRoster(TORO).map((d) => d.id)).toEqual([LAS_BAMBAS_ID, TORO]);
    expect(parseRoster(`${LAS_BAMBAS_ID}, ${TORO},${TORO}`).map((d) => d.id)).toEqual([LAS_BAMBAS_ID, TORO]);
    expect(parseRoster(`${TORO},not-a-dossier`).map((d) => d.id)).toEqual([LAS_BAMBAS_ID]);
    expect(parseRoster('Toromocho').map((d) => d.id)).toEqual([LAS_BAMBAS_ID]);
  });

  it('paths carry the requested id and never a literal Las Bambas path for another id', () => {
    expect(dossierProxyPath(TORO)).toBe('/api/fusion/dossiers/toromocho');
    expect(geographyProxyPath(TORO)).toBe('/api/fusion/dossiers/toromocho/geography');
    expect(analystProxyPath(TORO)).toBe('/api/fusion/dossiers/toromocho/analyst');
    expect(dossierSidecarPath(TORO)).toBe('/api/v1/foundation/dossiers/toromocho');
    expect(geographySidecarPath(TORO)).toBe('/api/v1/foundation/dossiers/toromocho/geography');
    expect(dossierProxyPath(LAS_BAMBAS_ID)).toBe('/api/fusion/dossiers/las-bambas-matarani');
  });
});

describe('contract guards bind the answer to the requested id', () => {
  it('DDD: Las Bambas control accepted; a Las Bambas body under a Toromocho request is rejected; retagged copy conforms', () => {
    expect(isDossierResponse(AVAILABLE, LAS_BAMBAS_ID)).toBe(true);
    expect(isDossierResponse(AVAILABLE)).toBe(true);
    expect(isDossierResponse(AVAILABLE, TORO)).toBe(false);
    expect(isDossierResponse(retag(AVAILABLE, TORO), TORO)).toBe(true);
    expect(isDossierResponse(retag(AVAILABLE, TORO), LAS_BAMBAS_ID)).toBe(false);
    expect(isDossierResponse(retag(AVAILABLE, 'Toromocho'), 'Toromocho')).toBe(false);
    expect(isDossierResponse(retag(stateOnly('not_published', 'no_publication'), TORO), TORO)).toBe(true);
    expect(isDossierResponse(stateOnly('not_published', 'no_publication'), TORO)).toBe(false);
  });

  it('geography: same binding, including the null-id state-only envelope', () => {
    expect(isGeoResponse(GEO_FULL, LAS_BAMBAS_ID)).toBe(true);
    expect(isGeoResponse(GEO_FULL, TORO)).toBe(false);
    expect(isGeoResponse(retag(GEO_FULL, TORO), TORO)).toBe(true);
    expect(isGeoResponse({ ...geoStateOnly('unavailable', 'dossier_not_enabled'), dossier_id: null }, TORO)).toBe(true);
  });
});

describe('browser clients request the selected id only', () => {
  it('fetchDossierOnce / fetchGeographyOnce hit the requested proxy path and drop cross-dossier bodies as malformed', async () => {
    const calls: string[] = [];
    const lbBody: typeof fetch = (u) => { calls.push(String(u)); return json(AVAILABLE); };
    expect(await fetchDossierOnce(TORO, 1, lbBody)).toMatchObject({ type: 'failure', reason: 'browser_response_malformed', generation: 1 });
    expect(await fetchDossierOnce(LAS_BAMBAS_ID, 2, lbBody)).toMatchObject({ type: 'response', generation: 2 });
    const toroBody: typeof fetch = (u) => { calls.push(String(u)); return json(retag(AVAILABLE, TORO)); };
    expect(await fetchDossierOnce(TORO, 3, toroBody)).toMatchObject({ type: 'response', generation: 3 });
    expect(calls).toEqual(['/api/fusion/dossiers/toromocho', '/api/fusion/dossiers/las-bambas-matarani', '/api/fusion/dossiers/toromocho']);

    const geoCalls: string[] = [];
    const geoLb: typeof fetch = (u) => { geoCalls.push(String(u)); return json(GEO_FULL); };
    expect(await fetchGeographyOnce(TORO, 1, geoLb)).toMatchObject({ type: 'failure', reason: 'browser_response_malformed' });
    expect(await fetchGeographyOnce(LAS_BAMBAS_ID, 2, geoLb)).toMatchObject({ type: 'response' });
    expect(geoCalls).toEqual(['/api/fusion/dossiers/toromocho/geography', '/api/fusion/dossiers/las-bambas-matarani/geography']);
  });

  it('LB → Toromocho → clear: reset outdates in-flight answers; a late Las Bambas body never shows under Toromocho or after clearing', async () => {
    let gen = 0;
    let feed = INITIAL_FEED;
    let geo = INITIAL_GEO_FEED;
    let vuln = INITIAL_VULN_FEED;

    // Las Bambas selected: request 1 answers normally.
    gen += 1;
    feed = reduceFeed(feed, await fetchDossierOnce(LAS_BAMBAS_ID, gen, () => json(AVAILABLE)));
    geo = reduceGeoFeed(geo, await fetchGeographyOnce(LAS_BAMBAS_ID, gen, () => json(GEO_FULL)));
    vuln = reduceVulnFeed(vuln, { type: 'response', body: { state: 'available' } as never, at: 't', generation: gen });
    expect(resolveView(feed).view).toBe('available');
    expect(resolveGeo(geo).view).toBe('available');
    expect(vuln.body).not.toBeNull();

    // Request 2 for Las Bambas is still in flight when the user switches to Toromocho.
    gen += 1;
    let releaseLate: (r: Response) => void = () => {};
    const latePromise = fetchDossierOnce(LAS_BAMBAS_ID, gen, () => new Promise<Response>((r) => { releaseLate = r; }));
    const lateGen = gen;

    // Switch → every feed resets at the current generation; legacy (vulnerability) is reset too, not refetched.
    feed = reduceFeed(feed, { type: 'reset', generation: gen });
    geo = reduceGeoFeed(geo, { type: 'reset', generation: gen });
    vuln = reduceVulnFeed(vuln, { type: 'reset', generation: gen });
    expect(resolveView(feed).view).toBe('loading');
    expect(resolveGeo(geo).view).toBe('loading');
    expect(vuln.body).toBeNull();

    // Toromocho's own request (3) answers not_published (default-off sidecar → state-only).
    gen += 1;
    const toroEvent = await fetchDossierOnce(TORO, gen, () => json({ ...stateOnly('unavailable', 'dossier_not_enabled'), dossier_id: TORO }, 404));
    feed = reduceFeed(feed, toroEvent);
    expect(resolveView(feed).view).toBe('unavailable');
    expect(feed.body?.dossier_id).toBe(TORO);
    expect(feed.body?.publication).toBeNull();

    // The late Las Bambas answer arrives now: generation 2 <= 3 → dropped, nothing from LB shows.
    releaseLate(new Response(JSON.stringify(AVAILABLE), { status: 200 }));
    const late = await latePromise;
    expect(late).toMatchObject({ type: 'response', generation: lateGen });
    const afterLate = reduceFeed(feed, late);
    expect(afterLate).toBe(feed);
    expect(afterLate.body?.dossier_id).toBe(TORO);

    // Clear selection: reset again; a further late answer (generation 3) is also dropped.
    feed = reduceFeed(feed, { type: 'reset', generation: gen });
    geo = reduceGeoFeed(geo, { type: 'reset', generation: gen });
    expect(feed.body).toBeNull();
    expect(reduceFeed(feed, toroEvent)).toBe(feed);
    expect(resolveGeo(geo).view).toBe('loading');
  });
});

describe('dynamic DDD and geography proxies', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('unknown / malformed ids are 404 unknown_dossier state-only without a sidecar request', async () => {
    for (const id of ['las-bambas', 'Toromocho', '..', 'x'.repeat(70)]) {
      const res = await dossierGET(request(`/api/fusion/dossiers/${id}`), ctx(id));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({ state: 'unavailable', reason: 'unknown_dossier', publication: null, dossier_id: null });
      const geoRes = await geoGET(request(`/api/fusion/dossiers/${id}/geography`), ctx(id));
      expect(geoRes.status).toBe(404);
      expect((await geoRes.json()).reason).toBe('unknown_dossier');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Toromocho is forwarded with the requested id (default-off sidecar answers dossier_not_enabled) — never a Las Bambas path', async () => {
    fetchMock.mockResolvedValue(sidecar(404, { ...stateOnly('unavailable', 'dossier_not_enabled'), dossier_id: TORO }));
    const res = await dossierGET(request(dossierProxyPath(TORO)), ctx(TORO));
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ state: 'unavailable', reason: 'dossier_not_enabled', dossier_id: TORO, publication: null });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/\/api\/v1\/foundation\/dossiers\/toromocho$/);
    expect(url).not.toContain(LAS_BAMBAS_ID);

    fetchMock.mockResolvedValue(sidecar(404, { ...geoStateOnly('unavailable', 'dossier_not_enabled'), dossier_id: TORO }));
    const geoRes = await geoGET(request(geographyProxyPath(TORO)), ctx(TORO));
    expect(geoRes.status).toBe(404);
    expect((await geoRes.json()).reason).toBe('dossier_not_enabled');
    expect((fetchMock.mock.calls[1] as [string])[0]).toMatch(/\/api\/v1\/foundation\/dossiers\/toromocho\/geography$/);
  });

  it('a sidecar answering about a different dossier than requested becomes 503 sidecar_contract_invalid, state-only', async () => {
    fetchMock.mockResolvedValue(sidecar(200, AVAILABLE));
    const res = await dossierGET(request(dossierProxyPath(TORO)), ctx(TORO));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ state: 'unavailable', reason: 'sidecar_contract_invalid', dossier_id: TORO, publication: null, degraded: true });

    fetchMock.mockResolvedValue(sidecar(200, GEO_FULL));
    const geoRes = await geoGET(request(geographyProxyPath(TORO)), ctx(TORO));
    expect(geoRes.status).toBe(503);
    expect((await geoRes.json())).toMatchObject({ reason: 'sidecar_contract_invalid', publication: null });
  });

  it('retagged conformance copies (enabled-store shape) are forwarded verbatim for the requested id; Las Bambas control unchanged', async () => {
    const toroDdd: DossierResponse = retag(AVAILABLE, TORO);
    fetchMock.mockResolvedValue(sidecar(200, toroDdd));
    expect(await (await dossierGET(request(dossierProxyPath(TORO)), ctx(TORO))).json()).toEqual(toroDdd);
    const toroGeo: GeoResponse = retag(GEO_FULL, TORO);
    fetchMock.mockResolvedValue(sidecar(200, toroGeo));
    expect(await (await geoGET(request(geographyProxyPath(TORO)), ctx(TORO))).json()).toEqual(toroGeo);
    fetchMock.mockResolvedValue(sidecar(200, AVAILABLE));
    expect(await (await dossierGET(request(dossierProxyPath(LAS_BAMBAS_ID)), ctx(LAS_BAMBAS_ID))).json()).toEqual(AVAILABLE);
    expect((fetchMock.mock.calls[2] as [string])[0]).toMatch(/\/api\/v1\/foundation\/dossiers\/las-bambas-matarani$/);
  });
});
