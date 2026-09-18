import type { FusionEntityBrief } from '@/lib/fusion';

export interface DemoTarget {
  track_id: string;
  callsign_or_mmsi: string;
  track_type: string;
  latitude: number;
  longitude: number;
  risk_score: number;
  threat_classification: string;
  sanctions_hit: boolean;
  demo: true;
  demo_brief: FusionEntityBrief;
}

export const DEMO_TARGET_IDS = new Set(['TRK-LAREDO-4022', 'VESSEL-IMO-948123']);

/**
 * Scripted high-risk targets for client demos — injected client-side into the
 * fusion correlation layer only while DEMO SCENARIO INJECTION is on. They
 * never touch the sidecar or postgres; the brief travels inside the feature
 * properties so the drawer renders without a /api/fusion/brief fetch.
 */
export const DEMO_TARGETS: DemoTarget[] = [
  {
    track_id: 'TRK-LAREDO-4022',
    callsign_or_mmsi: 'TRK-LAREDO-4022 [RISK 0.85]',
    track_type: 'GROUND',
    latitude: 27.598,
    longitude: -99.532,
    risk_score: 0.85,
    threat_classification: 'CRITICAL ALERT',
    sanctions_hit: true,
    demo: true,
    demo_brief: {
      track_id: 'TRK-LAREDO-4022',
      entity_name: 'SOE NEXUS FREIGHT — LAREDO CONVOY',
      jurisdiction: 'MX / US',
      entity_id: 'DEMO-TRK-4022',
      manifest_number: 'MFT-LRD-2619',
      bill_of_lading: 'BOL-LRD-4022-8841',
      commodity: 'ANHYDROUS AMMONIA (UN1005) — DUAL-USE PRECURSOR',
      port_of_entry: 'LAREDO WORLD TRADE BRIDGE',
      shipper: 'NUEVO LAREDO CHEMICAL LOGISTICS S.A.',
      consignee: 'RIO GRANDE INDUSTRIAL SUPPLY LLC',
      risk_score: 0.85,
      threat_classification: 'CRITICAL ALERT',
      sanctions_hit: true,
      bottleneck_detected: true,
      bottleneck_port: 'Laredo World Trade Bridge',
      bottleneck_wait_minutes: 145,
      conflict_zone_proximity: true,
      conflict_zone_name: 'Nuevo Laredo Plaza',
      conflict_zone_summary: 'Cartel del Noreste (CDN) contested plaza buffer',
      rationale:
        'Ground convoy on the Laredo corridor correlates against an SOE-nexus shipper (+0.40 sanctions) '
        + 'hauling anhydrous-ammonia precursor cargo (+0.25 dual-use) through the CDN-contested Nuevo '
        + 'Laredo plaza buffer (+0.10), while the Laredo commercial lane reports a +145-minute '
        + 'bottleneck anomaly (+0.10). Composite R=0.85 — CRITICAL.',
      recommended_action: 'FLAG FOR CBP FIELD OPS — SECONDARY INSPECTION AT WORLD TRADE BRIDGE',
      generated_at: new Date(0).toISOString(),
    },
  },
  {
    track_id: 'VESSEL-IMO-948123',
    callsign_or_mmsi: 'M/V SINO-HARVEST [RISK 0.90]',
    track_type: 'MARITIME',
    latitude: 24.15,
    longitude: -112.3,
    risk_score: 0.9,
    threat_classification: 'CRITICAL ALERT',
    sanctions_hit: true,
    demo: true,
    demo_brief: {
      track_id: 'VESSEL-IMO-948123',
      entity_name: 'M/V SINO-HARVEST — SINO-HARVEST SHIPPING CO LTD',
      jurisdiction: 'PA (FLAG OF CONVENIENCE)',
      entity_id: 'DEMO-IMO-948123',
      manifest_number: 'MFT-PAC-0047',
      bill_of_lading: 'BOL-SHA-948123-02',
      commodity: 'CHEMICAL-GRADE RARE-EARTH COMPOUND — DUAL-USE',
      port_of_entry: 'PACIFIC TRANSIT — U.S. APPROACH',
      shipper: 'SINO-HARVEST SHIPPING CO LTD',
      consignee: 'PACIFIC RIM MATERIALS INC',
      risk_score: 0.9,
      threat_classification: 'CRITICAL ALERT',
      sanctions_hit: true,
      rationale:
        'Bulk carrier on the Pacific transit corridor resolves to an OFAC SDN-linked owner '
        + '(+0.40 sanctions hit) declaring chemical-grade rare-earth cargo (+0.25 dual-use) after an '
        + 'intermediate flag-of-convenience transshipment hop (+0.15), with an AIS dark-zone burst on '
        + 'approach (+0.10). Composite R=0.90 — CRITICAL.',
      recommended_action: 'TRACK & QUEUE FOR USCG/CBP BOARDING ON U.S. WATERS APPROACH',
      generated_at: new Date(0).toISOString(),
    },
  },
];
