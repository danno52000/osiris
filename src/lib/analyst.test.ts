/** Contract guard, registry, matrix helpers, feed reducer and view derivation for e7-analyst/1.0 (pinned Fusion projections). */
import { describe, expect, it } from 'vitest';
import {
  AN_BASELINE_LABEL,
  AN_CARD_COUNT,
  AN_FAMILY_COUNT,
  AN_FAMILY_IDS,
  ANALYST_DOSSIERS,
  INITIAL_AN_FEED,
  analystCardAnchor,
  analystProxyPath,
  analystRegistryEntry,
  analystReportPath,
  analystSidecarPath,
  anUnavailableResponse,
  baselineCase,
  deriveAnViewState,
  dispositionsForCard,
  durationBand,
  isAnResponse,
  listedAnalystDossiers,
  matrixRange,
  reduceAnFeed,
  resolveAn,
  stressCases,
  stressDisplay,
  type AnResponse,
} from './analyst';
import { MAGNITUDE_MATRIX } from './underwriting';
import { FIXTURE_CARD_IDS, FIXTURE_DRAFTS, FIXTURE_PUBLISHED, FIXTURE_UPDATE_FAILED, FIXTURE_WITHDRAWN, clone, stateOnly } from './analyst.test-fixture';

const LB = 'las-bambas-matarani';
const pubOf = (r: AnResponse) => r.publication!;

describe('finite dossier registry', () => {
  it('lists only Las Bambas; the three queued ids are reserved, unlisted and never enabled here', () => {
    expect(listedAnalystDossiers().map((d) => d.id)).toEqual([LB]);
    expect(ANALYST_DOSSIERS.filter((d) => d.reserved).map((d) => d.id)).toEqual(['toromocho', 'mirador', 'cerro-de-maimon']);
    expect(analystRegistryEntry('toromocho')?.listed).toBe(false);
    expect(analystRegistryEntry('unknown-mine')).toBeNull();
    expect(analystRegistryEntry('Las-Bambas-Matarani')).toBeNull();
    expect(analystRegistryEntry(null)).toBeNull();
  });

  it('builds dynamic proxy/sidecar/report paths from the requested id and card anchors from the card id', () => {
    expect(analystProxyPath(LB)).toBe(`/api/fusion/dossiers/${LB}/analyst`);
    expect(analystSidecarPath('toromocho')).toBe('/api/v1/foundation/dossiers/toromocho/analyst');
    expect(analystReportPath(LB)).toBe(`/dossiers/${LB}/analyst`);
    expect(analystCardAnchor('LB-01')).toBe('analyst-LB-01');
  });
});

describe('isAnResponse (pinned Fusion projections)', () => {
  it('accepts the four pinned fixtures for the requested id and state-only bodies', () => {
    for (const f of [FIXTURE_PUBLISHED, FIXTURE_DRAFTS, FIXTURE_WITHDRAWN, FIXTURE_UPDATE_FAILED]) expect(isAnResponse(f, LB)).toBe(true);
    for (const [s, r] of [['not_published', 'no_publication'], ['withdrawn', 'ddd_mismatch'], ['withdrawn', 'eligibility_withdrawn'], ['unavailable', 'feature_disabled'], ['unavailable', 'dossier_not_enabled']] as const) {
      expect(isAnResponse(stateOnly(s, r), LB)).toBe(true);
    }
    expect(isAnResponse(anUnavailableResponse('sidecar_unreachable'), LB)).toBe(true);
    expect(isAnResponse(stateOnly('unavailable', 'dossier_not_enabled', 'toromocho'), 'toromocho')).toBe(true);
  });

  it('published fixture: three cards, thirteen dispositions in taxonomy order, four stress cases, null baselines, admitted sources only', () => {
    const pub = pubOf(FIXTURE_PUBLISHED);
    expect(pub.origin).toBe('fixture');
    expect(pub.attribution.fixture).toBe(true);
    expect(pub.cards.map((c) => c.card_id)).toEqual([...FIXTURE_CARD_IDS]);
    expect(pub.cards).toHaveLength(AN_CARD_COUNT);
    expect(pub.dispositions.map((d) => d.family_id)).toEqual([...AN_FAMILY_IDS]);
    expect(pub.dispositions).toHaveLength(AN_FAMILY_COUNT);
    expect(pub.summary.stress_cases).toBe(4);
    for (const c of pub.cards) {
      expect(baselineCase(c).kind).toBe('evidence_baseline');
      expect(baselineCase(c).low).toBeNull();
      expect(baselineCase(c).display).toBe(AN_BASELINE_LABEL);
      expect(stressCases(c).every((s) => s.kind === 'stress_assumption' && s.low !== null)).toBe(true);
      expect(c.conditions.length).toBeGreaterThan(0);
    }
    expect(dispositionsForCard(pub, 'LB-01')).toEqual([]);
    expect(dispositionsForCard(pub, 'LB-04').map((d) => d.family_id)).toEqual(['TV01', 'TV02']);
    expect(dispositionsForCard(pub, 'LB-05').map((d) => d.family_id)).toEqual(['TV09']);
    expect(pub.summary.by_disposition).toMatchObject({ conditional_hypothesis: 3, research_gap: 10, supported_local: 0, not_applicable: 0 });
    expect(stressCases(pub.cards[0]).map((s) => s.display)).toEqual([
      'Conditional magnitude 3, assuming major impairment for 7 days',
      'Conditional magnitude 4, assuming major impairment for 21 days',
    ]);
    expect(stressCases(pub.cards[1])[0].display).toBe('Conditional magnitude 2–3, assuming partial to major impairment for 3 days');
    expect(stressCases(pub.cards[2])[0].display).toBe('Conditional magnitude 5, assuming essential-function impairment for 45 days');
    expect(pub.sources.every((s) => ['verified_quotation', 'reviewed_paraphrase'].includes(s.verification))).toBe(true);
    expect(pub.sources.every((s) => ['open_attribution', 'quotation_permitted'].includes(s.rights_class))).toBe(true);
  });

  it('rejects a body about another dossier than the one requested (no Las Bambas fallback)', () => {
    expect(isAnResponse(FIXTURE_PUBLISHED, 'toromocho')).toBe(false);
    const relabelled = clone(FIXTURE_PUBLISHED);
    relabelled.dossier_id = 'toromocho';
    expect(isAnResponse(relabelled, 'toromocho')).toBe(true); // shape ok
    expect(isAnResponse(relabelled, LB)).toBe(false);
    expect(isAnResponse(stateOnly('unavailable', 'dossier_not_enabled', 'toromocho'), LB)).toBe(false);
  });

  it('rejects claim-bearing bodies with a broken DDD or pointer binding', () => {
    const a = clone(FIXTURE_PUBLISHED);
    a.publication!.ddd.publication_sha256 = 'f'.repeat(64);
    expect(isAnResponse(a, LB)).toBe(false);
    const b = clone(FIXTURE_PUBLISHED);
    b.currentness!.publication_no = 2;
    expect(isAnResponse(b, LB)).toBe(false);
    const c = clone(FIXTURE_PUBLISHED);
    c.publication!.contract = 'e7-analyst/1.0:AnalystPublication';
    expect(isAnResponse(c, LB)).toBe(false);
    const d = clone(FIXTURE_PUBLISHED);
    d.publication = null;
    expect(isAnResponse(d, LB)).toBe(false);
    const e = clone(FIXTURE_DRAFTS);
    e.publication = clone(FIXTURE_PUBLISHED.publication);
    expect(isAnResponse(e, LB)).toBe(false);
  });

  it('rejects unverified or rights-restricted sources, URL-only evidence and dropped cards/families', () => {
    for (const patch of [
      (r: AnResponse) => { r.publication!.sources[0].verification = 'url_only' as never; },
      (r: AnResponse) => { r.publication!.sources[0].verification = 'unverified' as never; },
      (r: AnResponse) => { r.publication!.sources[0].rights_class = 'uncertain' as never; },
      (r: AnResponse) => { r.publication!.sources[0].rights_class = 'internal_only' as never; },
      (r: AnResponse) => { r.publication!.sources[0].reviewed = null as never; },
      (r: AnResponse) => { r.publication!.cards.pop(); r.publication!.summary.cards = 2; },
      (r: AnResponse) => { r.publication!.dispositions.pop(); },
      (r: AnResponse) => { r.publication!.dispositions[0].disposition = 'confirmed' as never; },
      (r: AnResponse) => { r.publication!.cards[0].source_ids = ['NOT_IN_REGISTER']; },
      (r: AnResponse) => { r.publication!.cards[0].mechanism.source_ids = ['NOT_IN_REGISTER']; },
    ]) {
      const r = clone(FIXTURE_PUBLISHED);
      patch(r);
      expect(isAnResponse(r, LB)).toBe(false);
    }
  });

  it('rejects forbidden semantics anywhere in the body: attack ease, probability, coordinates, targets', () => {
    for (const key of ['difficulty', 'attack_ease', 'probability', 'likelihood', 'coordinates', 'lat', 'target_list', 'exploitability']) {
      const r = clone(FIXTURE_PUBLISHED);
      (r.publication!.cards[0] as unknown as Record<string, unknown>)[key] = 1;
      expect(isAnResponse(r, LB)).toBe(false);
      const nested = clone(FIXTURE_PUBLISHED);
      (nested.publication!.sources[0] as unknown as Record<string, unknown>)[key] = 'x';
      expect(isAnResponse(nested, LB)).toBe(false);
    }
  });

  it('rejects stress cases whose score disagrees with the pinned matrix or whose baseline is not null', () => {
    const a = clone(FIXTURE_PUBLISHED);
    a.publication!.cards[0].magnitude_cases[1].low = 5;
    a.publication!.cards[0].magnitude_cases[1].high = 5;
    expect(isAnResponse(a, LB)).toBe(false);
    const b = clone(FIXTURE_PUBLISHED);
    b.publication!.cards[0].magnitude_cases[0].low = 3;
    b.publication!.cards[0].magnitude_cases[0].high = 3;
    expect(isAnResponse(b, LB)).toBe(false);
    const c = clone(FIXTURE_PUBLISHED);
    c.publication!.cards[0].magnitude_cases[1].display = 'Magnitude 3';
    expect(isAnResponse(c, LB)).toBe(false);
  });

  it('production origin never carries fixture actors', () => {
    const r = clone(FIXTURE_PUBLISHED);
    r.publication!.origin = 'production';
    r.publication!.attribution.fixture = false;
    expect(isAnResponse(r, LB)).toBe(false);
  });
});

describe('matrix helpers', () => {
  it('pins the E×D matrix and recomputes the four required stress cases', () => {
    expect(MAGNITUDE_MATRIX.E3.D2).toBe(3);
    expect(durationBand(7)).toBe('D2');
    expect(durationBand(21)).toBe('D3');
    expect(durationBand(3)).toBe('D2');
    expect(durationBand(45)).toBe('D4');
    expect(durationBand(0)).toBeNull();
    expect(matrixRange(['E3'], 'D2')).toEqual([3, 3]);
    expect(matrixRange(['E3'], 'D3')).toEqual([4, 4]);
    expect(matrixRange(['E2', 'E3'], 'D2')).toEqual([2, 3]);
    expect(matrixRange(['E4'], 'D4')).toEqual([5, 5]);
    expect(matrixRange([], 'D2')).toBeNull();
    expect(matrixRange(['E9'], 'D2')).toBeNull();
    expect(stressDisplay(['E3'], 7, 3, 3)).toBe('Conditional magnitude 3, assuming major impairment for 7 days');
    expect(stressDisplay(['E2', 'E3'], 3, 2, 3)).toBe('Conditional magnitude 2–3, assuming partial to major impairment for 3 days');
  });
});

describe('feed reducer and view derivation', () => {
  const at = '2026-09-25T12:30:00Z';
  it('derives available/stale/not_published/withdrawn/unavailable; degraded and missing publication are unavailable', () => {
    expect(deriveAnViewState(FIXTURE_PUBLISHED)).toBe('available');
    expect(deriveAnViewState(FIXTURE_UPDATE_FAILED)).toBe('stale');
    expect(deriveAnViewState(FIXTURE_DRAFTS)).toBe('not_published');
    expect(deriveAnViewState(FIXTURE_WITHDRAWN)).toBe('withdrawn');
    expect(deriveAnViewState(stateOnly('unavailable', 'dossier_not_enabled'))).toBe('unavailable');
    expect(deriveAnViewState(anUnavailableResponse('sidecar_unreachable'))).toBe('unavailable');
    expect(deriveAnViewState(null)).toBe('loading');
  });

  it('ignores stale generations, fails closed on browser failure and clears on reset', () => {
    let s = reduceAnFeed(INITIAL_AN_FEED, { type: 'response', body: FIXTURE_PUBLISHED, at, generation: 2 });
    expect(resolveAn(s).publication).not.toBeNull();
    s = reduceAnFeed(s, { type: 'response', body: FIXTURE_WITHDRAWN, at, generation: 1 });
    expect(resolveAn(s).view).toBe('available');
    s = reduceAnFeed(s, { type: 'failure', reason: 'browser_fetch_timeout', at, generation: 3 });
    expect(resolveAn(s)).toMatchObject({ view: 'unavailable', publication: null, body: null });
    s = reduceAnFeed(s, { type: 'response', body: FIXTURE_PUBLISHED, at, generation: 4 });
    s = reduceAnFeed(s, { type: 'reset', generation: 4 });
    expect(s.body).toBeNull();
    expect(reduceAnFeed(s, { type: 'response', body: FIXTURE_PUBLISHED, at, generation: 4 })).toBe(s);
  });
});
