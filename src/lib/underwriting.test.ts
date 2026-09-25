/** Contract guard, feed reducer, view derivation and presentation helpers for e5-underwriting/1.0. */
import { describe, expect, it } from 'vitest';
import {
  CHART_EMPTY_TEXT,
  HYPOTHETICAL_LABEL,
  INITIAL_UW_FEED,
  chartableCases,
  deriveCaseKind,
  formatScore,
  functionalDependencyRefs,
  highlightFor,
  isUwResponse,
  magnitudeSummary,
  SHARED_GROUP_BASIS,
  SHARED_GROUP_NOTE,
  reduceUwFeed,
  resolveUw,
  unplottedCases,
  uwUnavailableResponse,
  type UwCase,
  type UwResponse,
  type UwSharedGroup,
} from './underwriting';
import { overlayFromPublication, overlayGeoJSON, verifiedHighlight, type GeoResponse } from './geography';
import geoFull from './geography-fixtures/geo_full.json';
import { CORRIDOR_CASE_ID, REAL_PARTIAL, REAL_PUBLISHED, REAL_UPDATE_FAILED, SYNTHETIC_SCORED, TERMINAL_CASE_ID, clone, stateOnly } from './underwriting.test-fixture';

const GEO = geoFull as unknown as GeoResponse;

function pubOf(r: UwResponse) {
  return r.publication!;
}

describe('isUwResponse (pinned Fusion projections)', () => {
  it('accepts the four pinned fixtures and state-only bodies', () => {
    expect(isUwResponse(REAL_PUBLISHED)).toBe(true);
    expect(isUwResponse(SYNTHETIC_SCORED)).toBe(true);
    expect(isUwResponse(REAL_PARTIAL)).toBe(true);
    expect(isUwResponse(REAL_UPDATE_FAILED)).toBe(true);
    for (const [s, r] of [['not_published', 'no_publication'], ['withdrawn', 'ddd_mismatch'], ['withdrawn', 'eligibility_withdrawn'], ['unavailable', 'feature_disabled']] as const) {
      expect(isUwResponse(stateOnly(s, r))).toBe(true);
    }
    expect(isUwResponse(uwUnavailableResponse('sidecar_unreachable'))).toBe(true);
  });

  it('real portfolio: five cases, 32 coverage entries, S32 modifier, corridor 3/LOW magnitude, no case with both scores', () => {
    const pub = pubOf(REAL_PUBLISHED);
    expect(pub.cases).toHaveLength(5);
    expect(pub.coverage).toHaveLength(32);
    expect(pub.coverage.find((e) => e.scenario_id === 'S32')?.disposition).toBe('modifier');
    expect(pub.summary).toMatchObject({ cases_published: 5, both_scored: 0, difficulty_scored: 0, magnitude_scored: 1, coverage_entries: 32 });
    const corridor = pub.cases.find((c) => c.case_id === CORRIDOR_CASE_ID)!;
    expect(corridor.case_kind).toBe('assumption_led');
    expect(corridor.difficulty).toMatchObject({ low: null, high: null, confidence: 'UNKNOWN' });
    expect(corridor.difficulty.null_reason).toBeTruthy();
    expect(corridor.magnitude).toMatchObject({ low: 3, high: 3, confidence: 'LOW', extent_bands: ['E3'], duration_bands: ['D2'], duration_days: 7 });
    expect(corridor.assumptions.length).toBeGreaterThan(0);
    for (const c of pub.cases) {
      expect(c.hypothetical_label).toBe(HYPOTHETICAL_LABEL);
      if (c.case_id !== CORRIDOR_CASE_ID) {
        expect(c.magnitude.low).toBeNull();
        expect(c.magnitude.confidence).toBe('UNKNOWN');
      }
      expect(c.difficulty.low).toBeNull();
    }
    expect(chartableCases(pub)).toHaveLength(0);
    expect(unplottedCases(pub)).toHaveLength(5);
  });

  it('ordering is category then case id and is not a score order', () => {
    const pub = pubOf(REAL_PUBLISHED);
    const keys = pub.cases.map((c) => `${c.category}:${c.case_id}`);
    expect(keys).toEqual([...keys].sort());
    expect(pub.ordering.note).toMatch(/not a ranking/);
    expect(pub.ordering.rule).toBe('category_code_then_case_id');
    expect(pub.ordering.ranked).toBe(false);
  });

  it('rejects any forbidden aggregate/probability/private field anywhere in the body', () => {
    for (const [path, key] of [
      ['publication', 'probability'], ['publication', 'expected_loss'], ['publication', 'composite_risk'], ['publication', 'dossier_aggregate_score'],
      ['case', 'probability'], ['case', 'imminence'], ['case', 'attack_prediction'], ['case', 'reviewer'], ['case', 'decision_id'], ['case', 'run_id'],
      ['difficulty', 'probability'], ['magnitude', 'expected_loss'], ['summary', 'composite_risk'],
    ] as const) {
      const b = clone(REAL_PUBLISHED);
      const pub = b.publication as unknown as Record<string, unknown>;
      const target = path === 'publication' ? pub
        : path === 'case' ? (pub.cases as Record<string, unknown>[])[0]
          : path === 'summary' ? pub.summary as Record<string, unknown>
            : ((pub.cases as Record<string, unknown>[])[0][path] as Record<string, unknown>);
      target[key] = 0.5;
      expect(isUwResponse(b), `${path}.${key}`).toBe(false);
    }
  });

  it('rejects score-shape violations: half-null axis, numeric with UNKNOWN, null without reason, low>high, difficulty 1–5, magnitude off-matrix', () => {
    const mutate = (f: (c: UwCase) => void) => {
      const b = clone(SYNTHETIC_SCORED);
      f(b.publication!.cases.find((c) => c.case_id === CORRIDOR_CASE_ID)!);
      return isUwResponse(b);
    };
    expect(mutate((c) => { c.difficulty.high = null; })).toBe(false);
    expect(mutate((c) => { c.difficulty.confidence = 'UNKNOWN'; })).toBe(false);
    expect(mutate((c) => { c.magnitude.low = null; c.magnitude.high = null; c.magnitude.confidence = 'UNKNOWN'; c.magnitude.null_reason = null; })).toBe(false);
    expect(mutate((c) => { c.difficulty.low = 4; c.difficulty.high = 2; })).toBe(false);
    expect(mutate((c) => { c.difficulty.low = 1; c.difficulty.high = 5; })).toBe(false);
    expect(mutate((c) => { c.magnitude.low = 5; c.magnitude.high = 5; })).toBe(false); // E3×D2 = 3, not 5
    expect(mutate((c) => { c.difficulty.low = 0; c.difficulty.high = 0; })).toBe(false);
  });

  it('the synthetic terminal magnitude 1–5 (genuine broad range) is accepted; a difficulty 1–5 is not', () => {
    const t = pubOf(SYNTHETIC_SCORED).cases.find((c) => c.case_id === TERMINAL_CASE_ID)!;
    expect([t.magnitude.low, t.magnitude.high]).toEqual([1, 5]);
    expect(isUwResponse(SYNTHETIC_SCORED)).toBe(true);
    const b = clone(SYNTHETIC_SCORED);
    const c = b.publication!.cases.find((x) => x.case_id === TERMINAL_CASE_ID)!;
    c.difficulty.low = 1; c.difficulty.high = 5; c.difficulty.high_rationale = 'x';
    expect(isUwResponse(b)).toBe(false);
  });

  it('rejects structural violations: DDD binding mismatch, wrong schema, summary disagreement, missing coverage, unknown case kind, claims on state-only', () => {
    let b = clone(REAL_PUBLISHED); b.ddd!.publication_sha256 = '0'.repeat(64); expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); (b as { schema_version: string }).schema_version = 'e3b-vulnerability/1.0'; expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); b.publication!.summary.both_scored = 2; expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); b.publication!.coverage.pop(); expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); (b.publication!.cases[0] as { case_kind: string }).case_kind = 'verified'; expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); b.state = 'withdrawn'; expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); b.publication!.cases[0].both_scored = true; expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); b.publication!.cases[0].highlight.entity_ids.push('../secret'); expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); (b as { publication: unknown }).publication = {}; expect(isUwResponse(b)).toBe(false);
  });

  it('C1: real groups = one corridor/terminal group on the reviewed rail dependency; context-only MMG/Minera/mine-endpoint groups and legacy shapes are refused', () => {
    const pub = pubOf(REAL_PUBLISHED);
    const byId = new Map(pub.cases.map((c) => [c.case_id, c]));
    const CYBER = '6ece60f1560d6435de251b48', LEGAL = 'ace6290873d5432cdf5d4bee', FINANCE = '3b61fa1e81aed84cc4856434';
    expect(pub.shared_dependency_groups).toEqual([{
      refs: ['aa5d3e48412f4a8827aa9559'], case_ids: [CORRIDOR_CASE_ID, TERMINAL_CASE_ID],
      basis: SHARED_GROUP_BASIS, note: SHARED_GROUP_NOTE, aggregation: 'not_summed',
    }]);
    expect(SHARED_GROUP_NOTE).toContain('not additive');
    expect(SHARED_GROUP_NOTE).not.toContain('single initiating event');
    expect([...functionalDependencyRefs(byId.get(TERMINAL_CASE_ID)!)]).toEqual(['aa5d3e48412f4a8827aa9559']);
    expect(functionalDependencyRefs(byId.get(CORRIDOR_CASE_ID)!).has('asset:aiddata-site-20')).toBe(false);
    // each case's own function-level dependency is retained, but none is shared and none is an owner/operator/mine ref
    const CONTEXT = ['org:doc:mmg-limited', 'org:f01-name:minera-las-bambas-s-a-c-minera-las-bambas:a206c8ce4114', 'asset:aiddata-site-20'];
    const deps = [CYBER, LEGAL, FINANCE].map((id) => functionalDependencyRefs(byId.get(id)!));
    for (const d of deps) for (const ref of CONTEXT) expect(d.has(ref)).toBe(false);
    for (const ref of CONTEXT) expect(pub.cases.filter((c) => c.boundary.entity_refs.includes(ref)).length).toBeGreaterThanOrEqual(2);
    expect(deps.flatMap((d, i) => deps.slice(i + 1).flatMap((e) => [...d].filter((r) => e.has(r))))).toEqual([]);
    const grp = (refs: string[], case_ids: string[]) => ({ refs, case_ids, basis: SHARED_GROUP_BASIS, note: SHARED_GROUP_NOTE, aggregation: 'not_summed' as const } as UwSharedGroup);
    let b = clone(REAL_PUBLISHED); b.publication!.shared_dependency_groups.push(grp(['org:doc:mmg-limited'], [CYBER, LEGAL])); expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); b.publication!.shared_dependency_groups.push(grp(['org:f01-name:minera-las-bambas-s-a-c-minera-las-bambas:a206c8ce4114'], [FINANCE, LEGAL])); expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); b.publication!.shared_dependency_groups.push(grp(['asset:aiddata-site-20'], [CORRIDOR_CASE_ID, CYBER, LEGAL, FINANCE])); expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); b.publication!.shared_dependency_groups[0].case_ids.push(LEGAL); expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); b.publication!.shared_dependency_groups[0].refs.push('facility:pillones-transfer-station'); expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); (b.publication!.shared_dependency_groups[0] as { basis: string }).basis = 'shared_boundary_overlap'; expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); b.publication!.shared_dependency_groups[0].note = 'These cases depend on the same functional dependency; a single initiating event could affect all of them.'; expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); delete (b.publication!.shared_dependency_groups[0] as { basis?: string }).basis; expect(isUwResponse(b)).toBe(false);
    b = clone(REAL_PUBLISHED); b.publication!.shared_dependency_groups = []; expect(isUwResponse(b)).toBe(true);
  });

  it('C2: magnitude summary is derived from typed bands/days, never hardcoded; N/A keeps its reason', () => {
    const corridor = pubOf(REAL_PUBLISHED).cases.find((c) => c.case_id === CORRIDOR_CASE_ID)!;
    expect(magnitudeSummary(corridor.magnitude)).toBe('Conditional magnitude 3, assuming major impairment for 7 days');
    expect(corridor.display.magnitude).toBe(magnitudeSummary(corridor.magnitude));
    const terminal = pubOf(REAL_PUBLISHED).cases.find((c) => c.case_id === TERMINAL_CASE_ID)!;
    expect(magnitudeSummary(terminal.magnitude)).toBe(`Conditional magnitude N/A (${terminal.magnitude.null_reason!.replace(/_/g, ' ')})`);
    expect(magnitudeSummary({ ...corridor.magnitude, low: 3, high: 4, extent_bands: ['E2', 'E3'], duration_bands: ['D3'], duration_days: null }))
      .toBe('Conditional magnitude 3–4, assuming partial to major impairment for >7–30 days');
    expect(magnitudeSummary({ ...corridor.magnitude, low: 5, high: 5, extent_bands: ['E4'], duration_bands: ['D4'], duration_days: 45 }))
      .toBe('Conditional magnitude 5, assuming essential/system-wide impairment for 45 days');
    expect(magnitudeSummary({ ...corridor.magnitude, low: 1, high: 1, extent_bands: ['E1'], duration_bands: ['D1'], duration_days: 1 }))
      .toBe('Conditional magnitude 1, assuming localized impairment for 1 day');
  });

  it('case kind derivation follows the engine rule: all-unknown cannot become supported', () => {
    const refs = [{ ref: 'doc:x', role: 'supports_fact' as const, note: null }];
    expect(deriveCaseKind([{ kind: 'dependency', basis_kind: 'unknown', could_change_band: true, references: [] }], [], [])).toBe('evidence_limited');
    expect(deriveCaseKind([{ kind: 'dependency', basis_kind: 'unknown', could_change_band: false, references: [] }], [], [])).toBe('evidence_limited');
    expect(deriveCaseKind([{ kind: 'dependency', basis_kind: 'documented_fact', could_change_band: false, references: refs }], [], [])).toBe('evidence_supported');
    expect(deriveCaseKind([{ kind: 'dependency', basis_kind: 'documented_fact', could_change_band: false, references: refs }], [{}], [])).toBe('assumption_led');
    expect(deriveCaseKind([{ kind: 'dependency', basis_kind: 'documented_fact', could_change_band: false, references: refs }], [], [{ pivotal: true }])).toBe('evidence_limited');
  });
});

describe('feed reducer / view derivation', () => {
  it('available -> reset -> stale late answer is swallowed; failures render unavailable', () => {
    let s = reduceUwFeed(INITIAL_UW_FEED, { type: 'response', body: REAL_PUBLISHED, at: 't', generation: 1 });
    expect(resolveUw(s).view).toBe('available');
    expect(resolveUw(s).publication?.cases).toHaveLength(5);
    s = reduceUwFeed(s, { type: 'reset', generation: 3 });
    expect(resolveUw(s)).toMatchObject({ view: 'loading', publication: null });
    s = reduceUwFeed(s, { type: 'response', body: REAL_PUBLISHED, at: 't', generation: 2 });
    expect(resolveUw(s).publication).toBeNull();
    s = reduceUwFeed(s, { type: 'failure', reason: 'browser_fetch_timeout', at: 't', generation: 4 });
    expect(resolveUw(s)).toMatchObject({ view: 'unavailable', publication: null });
  });

  it('state-only and stale bodies resolve to their states; stale keeps the retained publication', () => {
    const view = (b: UwResponse) => resolveUw(reduceUwFeed(INITIAL_UW_FEED, { type: 'response', body: b, at: 't', generation: 1 }));
    expect(view(stateOnly('withdrawn', 'ddd_mismatch'))).toMatchObject({ view: 'withdrawn', publication: null });
    expect(view(stateOnly('not_published', 'no_publication'))).toMatchObject({ view: 'not_published', publication: null });
    expect(view(uwUnavailableResponse('sidecar_contract_invalid')).view).toBe('unavailable');
    const stale = view(REAL_UPDATE_FAILED);
    expect(stale.view).toBe('stale');
    expect(stale.body?.reason).toBe('update_failed');
    expect(stale.publication?.publication_no).toBe(1);
  });
});

describe('presentation helpers', () => {
  it('formatScore: point, range, N/A', () => {
    expect(formatScore(3, 3)).toBe('3');
    expect(formatScore(2, 4)).toBe('2–4');
    expect(formatScore(null, null)).toBe('N/A');
    expect(CHART_EMPTY_TEXT).toBe('No cases currently have both scores');
  });

  it('synthetic scored fixture plots exactly two cases (one point, one range); real plots none', () => {
    const plotted = chartableCases(pubOf(SYNTHETIC_SCORED));
    expect(plotted.map((c) => c.case_id).sort()).toEqual([CORRIDOR_CASE_ID, TERMINAL_CASE_ID].sort());
    expect(unplottedCases(pubOf(SYNTHETIC_SCORED))).toHaveLength(3);
  });

  it('highlight verification keeps only published geography ids and drops organisations without anchors', () => {
    const pub = GEO.publication!;
    const corridor = highlightFor(pubOf(REAL_PUBLISHED), CORRIDOR_CASE_ID)!;
    const v = verifiedHighlight(pub, { entityIds: corridor.entity_ids, edgeIds: corridor.edge_ids })!;
    expect(v.entityIds.sort()).toEqual(['asset:aiddata-site-20', 'facility:pillones-transfer-station', 'port:matarani-pe-mri']);
    expect(v.edgeIds).toHaveLength(2);
    const fin = highlightFor(pubOf(REAL_PUBLISHED), '3b61fa1e81aed84cc4856434')!;
    const vf = verifiedHighlight(pub, { entityIds: fin.entity_ids, edgeIds: fin.edge_ids })!;
    expect(vf.entityIds).toEqual(['asset:aiddata-site-20']);
    expect(vf.edgeIds).toEqual([]);
    expect(verifiedHighlight(pub, { entityIds: ['org:doc:mmg-limited'], edgeIds: ['nope'] })).toBeNull();
    expect(verifiedHighlight(pub, null)).toBeNull();
    expect(highlightFor(pubOf(REAL_PUBLISHED), 'missing')).toBeNull();
    expect(highlightFor(null, CORRIDOR_CASE_ID)).toBeNull();
  });

  it('overlay carries highlighted flags without changing feature/link count, selection or coordinates', () => {
    const pub = GEO.publication!;
    const base = overlayFromPublication(pub, false, { kind: 'feature', id: pub.features[0].feature_id }, 1);
    const terminal = highlightFor(pubOf(REAL_PUBLISHED), TERMINAL_CASE_ID)!;
    const hl = overlayFromPublication(pub, false, { kind: 'feature', id: pub.features[0].feature_id }, 1, { entityIds: terminal.entity_ids, edgeIds: terminal.edge_ids });
    expect(base.highlight).toBeNull();
    expect(hl.highlight).toEqual({ entityIds: ['facility:pillones-transfer-station', 'port:matarani-pe-mri'], edgeIds: ['aa5d3e48412f4a8827aa9559'] });
    const g0 = overlayGeoJSON(base), g1 = overlayGeoJSON(hl);
    expect(g1.points.features).toHaveLength(g0.points.features.length);
    expect(g1.lines.features).toHaveLength(g0.lines.features.length);
    expect(g1.points.features.map((f) => f.geometry.coordinates)).toEqual(g0.points.features.map((f) => f.geometry.coordinates));
    expect(g0.points.features.every((f) => f.properties!.highlighted === false)).toBe(true);
    expect(g1.points.features.filter((f) => f.properties!.highlighted).map((f) => f.properties!.entity_id).sort()).toEqual(['facility:pillones-transfer-station', 'port:matarani-pe-mri']);
    expect(g1.lines.features.filter((f) => f.properties!.highlighted).map((f) => f.properties!.edge_id)).toEqual(['aa5d3e48412f4a8827aa9559']);
    expect(g1.points.features.filter((f) => f.properties!.selected)).toHaveLength(1);
  });
});
