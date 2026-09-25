/**
 * E4 geography read contract (`e4-geography/1.0`) as served by the Fusion sidecar
 * `GET /api/v1/foundation/dossiers/las-bambas-matarani/geography` and proxied at
 * `GEO_PROXY_PATH`. Read-only: the browser renders approved *approximate* anchors and
 * schematic endpoint connectors exactly as published; it never geocodes, snaps, routes,
 * interpolates intermediate vertices or computes a distance from the drawn line.
 */

import { DOSSIER_ID } from './dossier';

export const GEO_SCHEMA_VERSION = 'e4-geography/1.0';
export const GEO_CONTRACT = 'e4-geo-1.0';
export const GEO_PROXY_PATH = '/api/fusion/dossiers/las-bambas-matarani/geography';
export const GEO_SIDECAR_PATH = `/api/v1/foundation/dossiers/${DOSSIER_ID}/geography`;

/** Permanent legend published with every geography publication; shown verbatim while the overlay is visible. */
export const GEO_LEGEND = 'Schematic connections; not surveyed routes.';
export const GEOMETRY_BASIS = 'schematic_endpoints';
export const DISTANCE_BASIS = 'source_reported';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
export const OSM_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';
export const VECTOR_DISCLAIMER = 'Hypothetical vulnerability assessment, not an active-threat alert.';

export type GeoState = 'available' | 'stale' | 'not_published' | 'withdrawn' | 'unavailable';
export type LinkMode = 'road' | 'rail';
export type PrecisionClass = 'approximate_site' | 'rail_station_vicinity' | 'port_locality';
export type GeoProvider = 'wikidata' | 'openstreetmap';
export type GeoLicense = 'CC0-1.0' | 'ODbL-1.0';

export const LINK_LABEL: Record<LinkMode, string> = {
  road: 'reported road connection',
  rail: 'reported rail connection',
};
export const PRECISION_TEXT: Record<PrecisionClass, string> = {
  approximate_site: 'approximate site location',
  rail_station_vicinity: 'rail-station vicinity',
  port_locality: 'approximate port locality',
};
export const PROVIDER_LICENSE: Record<GeoProvider, GeoLicense> = {
  wikidata: 'CC0-1.0',
  openstreetmap: 'ODbL-1.0',
};
const LICENSE_NAME: Record<GeoLicense, string> = {
  'CC0-1.0': 'Creative Commons CC0 1.0 Universal',
  'ODbL-1.0': 'Open Data Commons Open Database License 1.0',
};
const LICENSE_URL: Record<GeoLicense, string> = {
  'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'ODbL-1.0': 'https://opendatacommons.org/licenses/odbl/1-0/',
};

export interface GeoSource {
  provider: GeoProvider;
  feature_id: string;
  feature_type: string;
  feature_name: string;
  feature_version: string | null;
  source_modified_at: string | null;
  url: string;
  api_url: string;
  retrieved_at: string;
  license: GeoLicense;
  license_name: string;
  license_url: string;
  attribution: string | null;
  attribution_url: string | null;
  coordinate_reference: string | null;
}

export interface GeoFeature {
  feature_id: string;
  version: number;
  entity_id: string;
  entity_label: string;
  lat: number;
  lon: number;
  precision_class: PrecisionClass;
  precision_text: string;
  label: string;
  caveats: string[];
  gaps: string[];
  source: GeoSource;
  lifecycle: 'published';
}

export interface GeoLink {
  link_id: string;
  version: number;
  edge_id: string;
  from_entity_id: string;
  to_entity_id: string;
  mode: LinkMode;
  label: string;
  evidence_refs: string[];
  reported_distance_km: number | null;
  distance_basis: typeof DISTANCE_BASIS | null;
  distance_source_ref: string | null;
  caveats: string[];
  geometry_basis: typeof GEOMETRY_BASIS;
  lifecycle: 'published';
}

export interface GeoAttribution {
  license: GeoLicense;
  license_name: string;
  license_url: string;
  text: string;
  url: string;
  feature_ids: string[];
}

export interface GeoPublication {
  publication_no: number;
  created_at: string;
  contract: string;
  ddd: {
    publication_no: number;
    publication_sha256: string;
    created_at: string;
    evidence_cutoff: string;
    evidence_cutoff_basis: string;
  };
  legend: string;
  features: GeoFeature[];
  links: GeoLink[];
  missing: Array<{ entity_id: string; reason: string }>;
  omitted_links: Array<{ edge_id: string; reason: string }>;
  attribution: GeoAttribution[];
  anchor_datasets: Array<{ name: string; sha256: string; license: GeoLicense }>;
  summary: { features_published: number; links_published: number; missing_entities: number; omitted_links: number };
  what_changed: string[];
}

export interface GeoDddBinding {
  state: string;
  reason: string | null;
  publication_no: number | null;
  publication_sha256: string | null;
  eligibility_established_at: string | null;
  eligibility_changed_at: string | null;
}

export interface GeoResponse {
  schema_version: string;
  dossier_id: string | null;
  state: GeoState;
  reason: string | null;
  checked_at: string;
  ddd: GeoDddBinding | null;
  currentness: { publication_no: number | null; eligibility_changed_at: string | null } | null;
  publication: GeoPublication | null;
  degraded?: boolean;
}

export const GEO_PROXY_UNAVAILABLE_REASON = 'sidecar_unreachable';
export const GEO_CONTRACT_INVALID_REASON = 'sidecar_contract_invalid';

export function geoUnavailableResponse(reason: string): GeoResponse {
  return {
    schema_version: GEO_SCHEMA_VERSION,
    dossier_id: DOSSIER_ID,
    state: 'unavailable',
    reason,
    checked_at: new Date().toISOString(),
    ddd: null,
    currentness: null,
    publication: null,
    degraded: true,
  };
}

// ---------------------------------------------------------------------------
// bounded contract guard
// ---------------------------------------------------------------------------

const STATES: ReadonlySet<string> = new Set<GeoState>(['available', 'stale', 'not_published', 'withdrawn', 'unavailable']);
const SHA256 = /^[0-9a-f]{64}$/;
const IDENT = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,199}$/;
const MAX_FEATURES = 16;
const MAX_LINKS = 16;
/** Never rendered: private audit content that must not appear in a public geography body. */
const FORBIDDEN_KEYS = ['reviewer', 'actor', 'producer', 'reviewed_input_sha256', 'decision_id', 'decision_ids', 'decision', 'run_id', 'notes', 'path', 'candidates', 'withdrawn_by'];
/** A visible label may not claim a precision the anchors do not have. */
const PRECISION_CLAIMS = /\b(exact|surveyed|verified|precise)\b/i;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}
function isNullableString(v: unknown): boolean {
  return v === null || typeof v === 'string';
}
function isIdent(v: unknown): v is string {
  return typeof v === 'string' && IDENT.test(v);
}
function isHttpUrl(v: unknown): boolean {
  return typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v);
}
function isCoord(v: unknown, limit: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= limit;
}
function noForbidden(v: Record<string, unknown>): boolean {
  return !FORBIDDEN_KEYS.some((k) => k in v);
}

function isSource(v: unknown): v is GeoSource {
  if (!isRecord(v) || !noForbidden(v)) return false;
  if (v.provider !== 'wikidata' && v.provider !== 'openstreetmap') return false;
  const lic = PROVIDER_LICENSE[v.provider];
  if (v.license !== lic || v.license_name !== LICENSE_NAME[lic] || v.license_url !== LICENSE_URL[lic]) return false;
  if (lic === 'ODbL-1.0') {
    if (v.attribution !== OSM_ATTRIBUTION || v.attribution_url !== OSM_ATTRIBUTION_URL) return false;
  } else if (v.attribution !== null || v.attribution_url !== null) return false;
  return isIdent(v.feature_id) && typeof v.feature_type === 'string' && typeof v.feature_name === 'string'
    && isNullableString(v.feature_version) && isNullableString(v.source_modified_at)
    && isHttpUrl(v.url) && isHttpUrl(v.api_url) && typeof v.retrieved_at === 'string'
    && isNullableString(v.coordinate_reference);
}

function isFeature(v: unknown): v is GeoFeature {
  if (!isRecord(v) || !noForbidden(v)) return false;
  if (v.lifecycle !== 'published') return false;
  if (typeof v.precision_class !== 'string' || !(v.precision_class in PRECISION_TEXT)) return false;
  if (v.precision_text !== PRECISION_TEXT[v.precision_class as PrecisionClass]) return false;
  if (typeof v.label !== 'string' || PRECISION_CLAIMS.test(v.label)) return false;
  return isIdent(v.feature_id) && typeof v.version === 'number' && isIdent(v.entity_id)
    && typeof v.entity_label === 'string' && isCoord(v.lat, 90) && isCoord(v.lon, 180)
    && isStringArray(v.caveats) && isStringArray(v.gaps) && isSource(v.source);
}

function isLink(v: unknown, visible: ReadonlySet<string>): v is GeoLink {
  if (!isRecord(v) || !noForbidden(v)) return false;
  if (v.lifecycle !== 'published' || v.geometry_basis !== GEOMETRY_BASIS) return false;
  if (v.mode !== 'road' && v.mode !== 'rail') return false;
  if (v.label !== LINK_LABEL[v.mode]) return false;
  if (!isIdent(v.from_entity_id) || !isIdent(v.to_entity_id) || v.from_entity_id === v.to_entity_id) return false;
  // Both endpoints must be served features: no link may be drawn through an unlocated vertex.
  if (!visible.has(v.from_entity_id) || !visible.has(v.to_entity_id)) return false;
  if (!Array.isArray(v.evidence_refs) || v.evidence_refs.length === 0 || !v.evidence_refs.every(isIdent)) return false;
  const d = v.reported_distance_km;
  if (d === null) {
    if (v.distance_basis !== null || v.distance_source_ref !== null) return false;
  } else if (typeof d !== 'number' || !Number.isFinite(d) || d <= 0 || v.distance_basis !== DISTANCE_BASIS || !isIdent(v.distance_source_ref)) {
    return false;
  }
  return isIdent(v.link_id) && typeof v.version === 'number' && isIdent(v.edge_id) && isStringArray(v.caveats);
}

function isAttribution(v: unknown, served: ReadonlySet<string>): v is GeoAttribution {
  if (!isRecord(v)) return false;
  if (v.license !== 'CC0-1.0' && v.license !== 'ODbL-1.0') return false;
  if (v.license_name !== LICENSE_NAME[v.license] || v.license_url !== LICENSE_URL[v.license]) return false;
  if (v.license === 'ODbL-1.0' && (v.text !== OSM_ATTRIBUTION || v.url !== OSM_ATTRIBUTION_URL)) return false;
  return typeof v.text === 'string' && isHttpUrl(v.url)
    && Array.isArray(v.feature_ids) && v.feature_ids.every((id) => isIdent(id) && served.has(id));
}

function isGap(v: unknown, key: 'entity_id' | 'edge_id'): boolean {
  return isRecord(v) && Object.keys(v).length === 2 && isIdent(v[key]) && typeof v.reason === 'string';
}

function isPublication(v: unknown): v is GeoPublication {
  if (!isRecord(v) || !noForbidden(v)) return false;
  if (typeof v.publication_no !== 'number' || typeof v.created_at !== 'string' || v.contract !== GEO_CONTRACT) return false;
  if (v.legend !== GEO_LEGEND) return false;
  const ddd = v.ddd;
  if (!isRecord(ddd) || typeof ddd.publication_no !== 'number' || typeof ddd.publication_sha256 !== 'string'
    || !SHA256.test(ddd.publication_sha256) || typeof ddd.created_at !== 'string'
    || typeof ddd.evidence_cutoff !== 'string' || ddd.evidence_cutoff_basis !== 'publication_snapshot_created_at') return false;
  if (!Array.isArray(v.features) || v.features.length > MAX_FEATURES || !v.features.every(isFeature)) return false;
  const features = v.features as GeoFeature[];
  const entities = features.map((f) => f.entity_id);
  if (new Set(entities).size !== entities.length) return false;
  const visible = new Set(entities);
  if (!Array.isArray(v.links) || v.links.length > MAX_LINKS || !v.links.every((l) => isLink(l, visible))) return false;
  const links = v.links as GeoLink[];
  const edges = links.map((l) => l.edge_id);
  if (new Set(edges).size !== edges.length) return false;
  if (!Array.isArray(v.missing) || !v.missing.every((g) => isGap(g, 'entity_id'))) return false;
  if (!Array.isArray(v.omitted_links) || !v.omitted_links.every((g) => isGap(g, 'edge_id'))) return false;
  // A gap that names a served feature/link is a contradiction, not an explanation.
  if ((v.missing as Array<{ entity_id: string }>).some((g) => visible.has(g.entity_id))) return false;
  if ((v.omitted_links as Array<{ edge_id: string }>).some((g) => edges.includes(g.edge_id))) return false;
  const served = new Set(features.map((f) => f.feature_id));
  if (!Array.isArray(v.attribution) || !v.attribution.every((a) => isAttribution(a, served))) return false;
  const attribution = v.attribution as GeoAttribution[];
  // Every ODbL-licensed anchor must be covered by a published ODbL attribution entry.
  for (const f of features) {
    if (f.source.license === 'ODbL-1.0' && !attribution.some((a) => a.license === 'ODbL-1.0' && a.feature_ids.includes(f.feature_id))) return false;
  }
  if (!Array.isArray(v.anchor_datasets) || !v.anchor_datasets.every((d) => isRecord(d) && Object.keys(d).length === 3
    && typeof d.name === 'string' && typeof d.sha256 === 'string' && SHA256.test(d.sha256)
    && (d.license === 'CC0-1.0' || d.license === 'ODbL-1.0'))) return false;
  const s = v.summary;
  if (!isRecord(s) || s.features_published !== features.length || s.links_published !== links.length
    || s.missing_entities !== (v.missing as unknown[]).length || s.omitted_links !== (v.omitted_links as unknown[]).length) return false;
  return isStringArray(v.what_changed);
}

function isDdd(v: unknown): v is GeoDddBinding {
  return isRecord(v) && typeof v.state === 'string' && isNullableString(v.reason)
    && (v.publication_no === null || typeof v.publication_no === 'number')
    && (v.publication_sha256 === null || (typeof v.publication_sha256 === 'string' && SHA256.test(v.publication_sha256)))
    && isNullableString(v.eligibility_established_at) && isNullableString(v.eligibility_changed_at);
}

/**
 * Bounded contract guard shared by the proxy and the browser. A body claiming `available`
 * or `stale` must carry a self-consistent publication (every link between two served
 * features, every ODbL anchor attributed, gaps consistent with what is served) whose DDD
 * binding equals the DDD actually read by the sidecar; state-only answers carry no
 * publication. Anything else is never stored, drawn or rendered.
 */
export function isGeoResponse(body: unknown): body is GeoResponse {
  if (!isRecord(body)) return false;
  if (body.schema_version !== GEO_SCHEMA_VERSION) return false;
  if (typeof body.state !== 'string' || !STATES.has(body.state)) return false;
  if (body.dossier_id !== null && body.dossier_id !== DOSSIER_ID) return false;
  if (!isNullableString(body.reason) || typeof body.checked_at !== 'string') return false;
  if (body.degraded !== undefined && typeof body.degraded !== 'boolean') return false;
  if (body.ddd !== null && !isDdd(body.ddd)) return false;
  if (body.currentness !== null && !(isRecord(body.currentness)
    && (body.currentness.publication_no === null || typeof body.currentness.publication_no === 'number')
    && isNullableString(body.currentness.eligibility_changed_at))) return false;
  const claims = body.state === 'available' || body.state === 'stale';
  if (!claims) return body.publication === null;
  if (!isPublication(body.publication) || !isRecord(body.ddd) || !isRecord(body.currentness)) return false;
  const pub = body.publication;
  const ddd = body.ddd as unknown as GeoDddBinding;
  return pub.ddd.publication_no === ddd.publication_no && pub.ddd.publication_sha256 === ddd.publication_sha256
    && pub.publication_no === (body.currentness as { publication_no: number | null }).publication_no;
}

// ---------------------------------------------------------------------------
// view derivation / feed
// ---------------------------------------------------------------------------

export type GeoViewState = 'loading' | GeoState;

const REASON_TEXT: Record<string, string> = {
  feature_disabled: 'The geography API is switched off (GIDEON_GEO_ENABLED=0).',
  store_unconfigured: 'No geography store (or no dossier store) is mounted for the reader.',
  store_unreadable: 'The geography store could not be read.',
  sidecar_unreachable: 'The Fusion sidecar did not answer in time.',
  sidecar_contract_invalid: 'The Fusion sidecar answered outside the geography contract; nothing from that answer is drawn.',
  geography_route_missing: 'The Fusion sidecar release has no geography route.',
  query_parameters_rejected: 'Query parameters are not accepted on the geography route.',
  method_not_allowed: 'Only GET is accepted on the geography route.',
  rate_limited: 'Too many geography requests from this client.',
  browser_fetch_failed: 'This browser could not reach the geography proxy.',
  browser_fetch_timeout: 'The geography proxy did not answer this browser within the request deadline.',
  browser_response_malformed: 'The geography proxy answer could not be parsed or failed the contract guard.',
  no_publication: 'No geography supplement has been published for this dossier.',
  pointer_missing: 'No geography supplement has been published for this dossier.',
  ddd_unavailable: 'The dossier reader is unavailable, so no geography can be bound.',
  ddd_not_published: 'The dossier itself has no current publication, so no geography can be bound.',
  ddd_withdrawn: 'The dossier publication was withdrawn; geography bound to it is not drawn.',
  ddd_mismatch: 'The current dossier publication is not the one the geography was bound to; the geography is withdrawn until re-validated.',
  ddd_stale: 'The dossier reader reports its publication as stale; the bound geography is shown as stale.',
  update_failed: 'The latest geography update failed; the last published supplement for the same dossier publication is shown as stale.',
  needs_revalidation: 'The geography requires re-validation against the current dossier publication.',
  eligibility_withdrawn: 'The geography supplement was withdrawn.',
  eligibility_unknown: 'The geography supplement eligibility is unknown.',
  publication_missing: 'The geography publication file is missing.',
  publication_unsupported: 'The geography publication contains content outside the public contract.',
  publication_malformed: 'The geography publication is malformed.',
  pointer_malformed: 'The geography pointer is malformed.',
  restricted_content_detected: 'Restricted content was detected in the geography read; nothing is drawn.',
  authority_changed: 'The geography store changed while it was being read.',
  reader_busy: 'The geography reader is busy.',
  reader_timeout: 'The geography read exceeded its deadline.',
};

export function describeGeoReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return REASON_TEXT[reason] ?? reason;
}

export function deriveGeoViewState(body: GeoResponse | null | undefined): GeoViewState {
  if (!body) return 'loading';
  if (body.degraded) return 'unavailable';
  switch (body.state) {
    case 'available':
    case 'stale':
      return body.publication ? body.state : 'unavailable';
    case 'not_published':
    case 'withdrawn':
    case 'unavailable':
      return body.state;
    default:
      return 'unavailable';
  }
}

export interface GeoFeedState {
  body: GeoResponse | null;
  fetchError: string | null;
  fetchedAt: string | null;
  generation: number;
}

export const INITIAL_GEO_FEED: GeoFeedState = { body: null, fetchError: null, fetchedAt: null, generation: 0 };

export type GeoBrowserFailure = 'browser_fetch_failed' | 'browser_fetch_timeout' | 'browser_response_malformed';

export type GeoFeedEvent =
  | { type: 'response'; body: GeoResponse; at: string; generation: number }
  | { type: 'failure'; reason: GeoBrowserFailure; at: string; generation: number }
  /** Deselection: clear everything and swallow any response still in flight (generation <= given). */
  | { type: 'reset'; generation: number };

/** Same generation guard as the dossier/vulnerability feeds: a browser-side failure clears any retained overlay. */
export function reduceGeoFeed(prev: GeoFeedState, event: GeoFeedEvent): GeoFeedState {
  if (event.type === 'reset') return { ...INITIAL_GEO_FEED, generation: Math.max(prev.generation, event.generation) };
  if (event.generation <= prev.generation) return prev;
  if (event.type === 'failure') {
    return { body: null, fetchError: event.reason, fetchedAt: event.at, generation: event.generation };
  }
  return { body: event.body, fetchError: null, fetchedAt: event.at, generation: event.generation };
}

export interface ResolvedGeo {
  view: GeoViewState;
  body: GeoResponse | null;
  /** Only present for `available`/`stale`; the only thing the map may draw. */
  publication: GeoPublication | null;
}

export function resolveGeo(state: GeoFeedState): ResolvedGeo {
  if (state.fetchError) return { view: 'unavailable', body: null, publication: null };
  const view = deriveGeoViewState(state.body);
  const publication = (view === 'available' || view === 'stale') && state.body?.publication ? state.body.publication : null;
  return { view, body: state.body, publication };
}

// ---------------------------------------------------------------------------
// map overlay projection (pure; no geometry invented)
// ---------------------------------------------------------------------------

export type DossierSelection =
  | { kind: 'feature'; id: string }
  | { kind: 'link'; id: string };

/** What the page hands the map: published anchors/links only, plus a fit request counter. */
export interface DossierOverlay {
  dossierId: string;
  publicationNo: number;
  stale: boolean;
  features: GeoFeature[];
  links: GeoLink[];
  legend: string;
  attribution: GeoAttribution[];
  selected: DossierSelection | null;
  /** Increment to request one fit; the map fits once per distinct value, never on re-render. */
  fitSeq: number;
  /**
   * Published entity/edge ids to emphasise for the selected underwriting case (E5). Only ids the
   * publication itself serves ever draw; unknown ids are dropped, nothing is added or moved.
   */
  highlight: OverlayHighlight | null;
}

export interface OverlayHighlight {
  entityIds: string[];
  edgeIds: string[];
}

/** Keep only highlight ids the publication actually serves; null when nothing survives. */
export function verifiedHighlight(pub: Pick<GeoPublication, 'features' | 'links'>, wanted: OverlayHighlight | null): OverlayHighlight | null {
  if (!wanted) return null;
  const entities = new Set(pub.features.map((f) => f.entity_id));
  const edges = new Set(pub.links.map((l) => l.edge_id));
  const entityIds = wanted.entityIds.filter((id) => entities.has(id));
  const edgeIds = wanted.edgeIds.filter((id) => edges.has(id));
  return entityIds.length + edgeIds.length > 0 ? { entityIds, edgeIds } : null;
}

export function overlayFromPublication(pub: GeoPublication, stale: boolean, selected: DossierSelection | null, fitSeq: number, highlight: OverlayHighlight | null = null): DossierOverlay {
  return {
    dossierId: DOSSIER_ID,
    publicationNo: pub.publication_no,
    stale,
    features: pub.features,
    links: pub.links,
    legend: pub.legend,
    attribution: pub.attribution,
    selected,
    fitSeq,
    highlight: verifiedHighlight(pub, highlight),
  };
}

export interface OverlayGeoJSON {
  points: GeoJSON.FeatureCollection<GeoJSON.Point>;
  lines: GeoJSON.FeatureCollection<GeoJSON.LineString>;
}

/**
 * Points are the published anchors; each line is exactly the two published endpoints
 * (a straight schematic connector) — no intermediate vertices, no snapping.
 */
export function overlayGeoJSON(overlay: Pick<DossierOverlay, 'features' | 'links' | 'selected'> & Partial<Pick<DossierOverlay, 'highlight'>>): OverlayGeoJSON {
  const byEntity = new Map(overlay.features.map((f) => [f.entity_id, f]));
  const sel = overlay.selected;
  const hlEntities = new Set(overlay.highlight?.entityIds ?? []);
  const hlEdges = new Set(overlay.highlight?.edgeIds ?? []);
  const points: GeoJSON.Feature<GeoJSON.Point>[] = overlay.features.map((f) => ({
    type: 'Feature',
    id: f.feature_id,
    geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
    properties: {
      feature_id: f.feature_id,
      entity_id: f.entity_id,
      label: f.label,
      precision_text: f.precision_text,
      selected: sel?.kind === 'feature' && sel.id === f.feature_id,
      highlighted: hlEntities.has(f.entity_id),
    },
  }));
  const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const l of overlay.links) {
    const a = byEntity.get(l.from_entity_id);
    const b = byEntity.get(l.to_entity_id);
    if (!a || !b) continue;
    lines.push({
      type: 'Feature',
      id: l.link_id,
      geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] },
      properties: {
        link_id: l.link_id,
        edge_id: l.edge_id,
        mode: l.mode,
        label: l.label,
        selected: sel?.kind === 'link' && sel.id === l.link_id,
        highlighted: hlEdges.has(l.edge_id),
      },
    });
  }
  return {
    points: { type: 'FeatureCollection', features: points },
    lines: { type: 'FeatureCollection', features: lines },
  };
}

/** Bounding box of the published anchors, or null when nothing is published. */
export function overlayBounds(features: ReadonlyArray<Pick<GeoFeature, 'lat' | 'lon'>>): [[number, number], [number, number]] | null {
  if (features.length === 0) return null;
  let west = features[0].lon, east = features[0].lon, south = features[0].lat, north = features[0].lat;
  for (const f of features) {
    if (f.lon < west) west = f.lon;
    if (f.lon > east) east = f.lon;
    if (f.lat < south) south = f.lat;
    if (f.lat > north) north = f.lat;
  }
  return [[west, south], [east, north]];
}

// ---------------------------------------------------------------------------
// presentation helpers
// ---------------------------------------------------------------------------

/** "438 km (source-reported)" — never computed from the drawn line. */
export function formatReportedDistance(link: GeoLink): string {
  if (link.reported_distance_km === null) return 'no reported distance';
  return `${link.reported_distance_km} km (source-reported: ${link.distance_source_ref ?? 'ref unknown'})`;
}

export function formatCoordinate(f: Pick<GeoFeature, 'lat' | 'lon'>): string {
  // Four decimals (~11 m) is more than the anchors' honest precision; more would imply survey accuracy.
  return `${f.lat.toFixed(4)}, ${f.lon.toFixed(4)}`;
}

export function featureRole(entityId: string): string {
  if (entityId.startsWith('asset:')) return 'mine / origin of the reported concentrate movement';
  if (entityId.startsWith('facility:')) return 'reported road-to-rail transfer point';
  if (entityId.startsWith('port:')) return 'reported export port';
  return 'dossier entity';
}
