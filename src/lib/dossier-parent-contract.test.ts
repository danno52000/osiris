/**
 * E8 correction 1: the engine predicate `has_accounting_parent` (holder → accounting parent,
 * same F01 ownership row as `owns_equity`) must survive the browser/proxy contract guard and
 * the family grouping without being read as equity, control, route or destination.
 *
 * Conformance fixture only: the hand-built Las Bambas test publication with one real-shaped
 * parent edge added. This is not Toromocho evidence and no ownership claim is asserted.
 */
import { describe, expect, it } from 'vitest';
import { groupPublication, isDossierResponse, type DossierResponse, type Edge } from './dossier';
import { AVAILABLE } from './dossier.test-fixture';

const HOLDER = 'org:f01-name:citic-metal-co-ltd:c5e52eba5069';
const PARENT = 'org:f01-name:citic-group-corporation:fixture0001';
const REC_PARENT = 'record:F01:aiddata_mineral_ownership:Equity_Holder=CITIC Metal Co. Ltd.:'
  + 'Equity_Holder_Parent=CITIC Group Corporation:Investors_Ownership_ID=20:Mining_Site_ID=20:'
  + 'Operator_Owner=Minera Las Bambas S.A.C. (Minera Las Bambas)';

function parentEdge(value: unknown = { parent_type: 'State-owned Company' }): Edge {
  return {
    id: 'f1x7ure0000000000000parent', version: 1, predicate: 'has_accounting_parent',
    subject: HOLDER, object: PARENT, evidence_category: 'reported', evidence: [REC_PARENT],
    value: value as Edge['value'], temporal: { as_of: 'dataset release' },
    scope: {
      native_row: {
        Equity_Holder: 'CITIC Metal Co. Ltd.', Equity_Holder_Parent: 'CITIC Group Corporation',
        Investors_Ownership_ID: '20', Mining_Site_ID: '20',
        Operator_Owner: 'Minera Las Bambas S.A.C. (Minera Las Bambas)',
      },
    },
    correction: null,
  };
}

function withEdge(edge: Edge): DossierResponse {
  const pub = AVAILABLE.publication!;
  return {
    ...AVAILABLE,
    publication: {
      ...pub,
      entities: [...pub.entities, {
        id: PARENT, version: 1, kind: 'organization', label: 'CITIC Group Corporation',
        resolution: 'as_named_by_source', sources: ['F01'], evidence: [REC_PARENT],
      }],
      edges: [...pub.edges, edge],
      assertions: [...pub.assertions, {
        id: edge.id, version: 1, predicate: 'has_accounting_parent', evidence_category: 'reported',
        currentness: 'unknown', confidence: null,
      }],
      evidence_manifest: [...pub.evidence_manifest, {
        ref: REC_PARENT, kind: 'structured_record', source_id: 'F01', table: 'aiddata_mineral_ownership',
        native_key: {
          Equity_Holder: 'CITIC Metal Co. Ltd.', Equity_Holder_Parent: 'CITIC Group Corporation',
          Investors_Ownership_ID: '20', Mining_Site_ID: '20',
          Operator_Owner: 'Minera Las Bambas S.A.C. (Minera Las Bambas)',
        },
        release_label: 'fixture', record_origin: 'replay_fixture', payload_sha256: 'f'.repeat(64), attribution: null,
      }],
    },
  };
}

describe('has_accounting_parent contract (UI)', () => {
  it('positive control: the Las Bambas fixture still passes and has no parent rows', () => {
    expect(isDossierResponse(AVAILABLE)).toBe(true);
    expect(groupPublication(AVAILABLE.publication!).accountingParents).toEqual([]);
  });

  it('a real-shaped parent edge passes the guard and is grouped apart from equity', () => {
    const body = withEdge(parentEdge());
    expect(isDossierResponse(body)).toBe(true);
    const grouped = groupPublication(body.publication!);
    expect(grouped.accountingParents).toHaveLength(1);
    const row = grouped.accountingParents[0];
    expect(row).toMatchObject({
      holder: 'CITIC Metal Co. Ltd.', parent: 'CITIC Group Corporation',
      parentType: 'State-owned Company', asOf: 'dataset release',
    });
    expect(row.edge.evidence_category).toBe('reported');
    expect(row.edge.evidence).toEqual([REC_PARENT]);
    expect(grouped.evidenceByRef.get(REC_PARENT)?.kind).toBe('structured_record');
    // Ownership family is untouched: the parent label is not an equity share.
    expect(grouped.ownership).toHaveLength(AVAILABLE.publication!.edges.filter((e) => e.predicate === 'owns_equity').length);
    expect(JSON.stringify(row)).not.toMatch(/equity_fraction|share|control|route|destination/i);
  });

  it.each([{ parent_type: null }, {}])('parent_type is optional (%j)', (value) => {
    const body = withEdge(parentEdge(value));
    expect(isDossierResponse(body)).toBe(true);
    expect(groupPublication(body.publication!).accountingParents[0].parentType).toBe('unknown');
  });

  it.each([
    { parent_type: 1 },
    { parent_type: true },
    { parent_type: ['State-owned Company'] },
    { parent_type: { label: 'State-owned Company' } },
    { parent_type: 'State-owned Company', equity_fraction_native: '1.0' },
    { parent_type: 'State-owned Company', controls: true },
    { parent_type: 'State-owned Company', destination: 'CN' },
    null,
    'State-owned Company',
  ])('malformed parent value %j fails the guard closed', (value) => {
    expect(isDossierResponse(withEdge(parentEdge(value)))).toBe(false);
  });

  it('unknown predicates are still never grouped into a family', () => {
    const body = withEdge({ ...parentEdge(), predicate: 'controls' as Edge['predicate'] });
    expect(isDossierResponse(body)).toBe(true);
    const grouped = groupPublication(body.publication!);
    expect(grouped.accountingParents).toEqual([]);
    expect(grouped.ownership.map((r) => r.edge.predicate)).not.toContain('controls');
  });
});
