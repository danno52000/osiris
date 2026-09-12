/**
 * 3BAI Fusion sidecar contract — the tactical COP polls the correlation
 * feed and resolves entity briefs through the /api/fusion/* proxy routes.
 */

export interface FusionCorrelation {
  track_id: string;
  callsign_or_mmsi: string;
  track_type: string;
  latitude: number;
  longitude: number;
  risk_score: number;
  threat_classification: string;
  sanctions_hit: boolean;
  recommended_action: string;
  details: string;
  detected_at: string;
}

export interface FusionEntityBrief {
  track_id: string;
  entity_name: string;
  jurisdiction: string | null;
  entity_id: string | null;
  manifest_number: string | null;
  bill_of_lading: string | null;
  commodity: string | null;
  port_of_entry: string | null;
  shipper: string | null;
  consignee: string | null;
  risk_score: number;
  threat_classification: string;
  sanctions_hit: boolean;
  rationale: string;
  recommended_action: string;
  generated_at: string;
}

/** High-risk rows get the red pulse badge; the rest render as amber ticks. */
export const isHighRisk = (c: FusionCorrelation): boolean =>
  c.sanctions_hit || c.risk_score >= 0.7;
