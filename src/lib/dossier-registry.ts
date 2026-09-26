/**
 * Finite GIDEON dossier registry shared by the drawer roster, the DDD / geography / analyst
 * proxies and the browser clients. Every id that may ever be requested is enumerated here;
 * anything else is `unknown_dossier` and never reaches the sidecar. Presentation prose is
 * per entry, so no Las Bambas wording is rendered for another selected id.
 *
 * Listing is default-off for every id except Las Bambas. A reserved id is routed to the sidecar
 * with the requested id (the sidecar answers `dossier_not_enabled` unless allowlisted there via
 * `GIDEON_DOSSIERS`) and is never substituted by Las Bambas. For local/test opt-in the build-time
 * `NEXT_PUBLIC_GIDEON_DOSSIER_ROSTER` env may additionally list registry ids; unknown tokens make
 * the whole opt-in fall back to the default roster (fail closed).
 */

/** Sidecar token rule for a requested dossier id (mirrors Fusion `DOSSIER_ID_TOKEN`). */
export const DOSSIER_ID_TOKEN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** The E2 seed dossier; the only id with legacy E3B/E5 publications and a full-DDD page. */
export const LAS_BAMBAS_ID = 'las-bambas-matarani';

export interface DossierRegistryEntry {
  id: string;
  title: string;
  /** One-line roster subtitle (per dossier; never inherited). */
  subtitle: string;
  /** Listed in the default roster (drawer list, report index). Only Las Bambas is listed. */
  listed: boolean;
  /** Reserved ids are routed with the requested id and never fall back to another dossier. */
  reserved: boolean;
  /** Legacy E3B vulnerability / E5 underwriting readers exist only for Las Bambas. */
  legacyAssessments: boolean;
  /** Full legacy DDD page (`/dossiers/<id>`); omitted for dossiers without that page. */
  fullDossierHref: string | null;
  /** Text shown while geography is not drawn; null when nothing reported is known here. */
  connectivityNote: string | null;
}

export const DOSSIER_REGISTRY: ReadonlyArray<DossierRegistryEntry> = [
  {
    id: LAS_BAMBAS_ID,
    title: 'Las Bambas – Pillones – Matarani',
    subtitle: 'copper concentrate corridor (Peru)',
    listed: true,
    reserved: false,
    legacyAssessments: true,
    fullDossierHref: `/dossiers/${LAS_BAMBAS_ID}`,
    connectivityNote: 'Reported connectivity (road to Pillones, rail to Matarani) remains readable in the full dossier; nothing is drawn while geography is not available.',
  },
  {
    id: 'toromocho',
    title: 'Toromocho',
    subtitle: 'copper mine (Peru) · no route, port or corridor is inferred',
    listed: false,
    reserved: true,
    legacyAssessments: false,
    fullDossierHref: null,
    connectivityNote: null,
  },
  {
    id: 'mirador',
    title: 'mirador (reserved, not published)',
    subtitle: 'reserved id',
    listed: false,
    reserved: true,
    legacyAssessments: false,
    fullDossierHref: null,
    connectivityNote: null,
  },
  {
    id: 'cerro-de-maimon',
    title: 'cerro-de-maimon (reserved, not published)',
    subtitle: 'reserved id',
    listed: false,
    reserved: true,
    legacyAssessments: false,
    fullDossierHref: null,
    connectivityNote: null,
  },
];

export function dossierRegistryEntry(id: string | null | undefined): DossierRegistryEntry | null {
  if (typeof id !== 'string' || !DOSSIER_ID_TOKEN.test(id)) return null;
  return DOSSIER_REGISTRY.find((d) => d.id === id) ?? null;
}

/**
 * Registry ids to list, given the raw opt-in value. Empty/unset → default roster. Every token
 * must be a registry id, otherwise the opt-in is ignored entirely rather than partially applied.
 */
export function parseRoster(raw: string | undefined | null): DossierRegistryEntry[] {
  const listed = DOSSIER_REGISTRY.filter((d) => d.listed);
  if (!raw || !raw.trim()) return listed;
  const extra: DossierRegistryEntry[] = [];
  for (const token of raw.split(',')) {
    const id = token.trim();
    if (!id) continue;
    const entry = dossierRegistryEntry(id);
    if (!entry) return listed;
    if (!listed.includes(entry) && !extra.includes(entry)) extra.push(entry);
  }
  return [...listed, ...extra];
}

/** The roster actually shown in the drawer: default listing plus any build-time opt-in. */
export function rosterDossiers(): DossierRegistryEntry[] {
  return parseRoster(process.env.NEXT_PUBLIC_GIDEON_DOSSIER_ROSTER);
}

/** Browser → Next.js proxy paths for one requested dossier id (never a literal Las Bambas path). */
export function dossierProxyPath(dossierId: string): string {
  return `/api/fusion/dossiers/${encodeURIComponent(dossierId)}`;
}
export function geographyProxyPath(dossierId: string): string {
  return `${dossierProxyPath(dossierId)}/geography`;
}

/** Next.js proxy → Fusion sidecar paths; the requested id is forwarded verbatim after validation. */
export function dossierSidecarPath(dossierId: string): string {
  return `/api/v1/foundation/dossiers/${encodeURIComponent(dossierId)}`;
}
export function geographySidecarPath(dossierId: string): string {
  return `${dossierSidecarPath(dossierId)}/geography`;
}
