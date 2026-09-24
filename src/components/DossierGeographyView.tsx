'use client';

import Link from 'next/link';
import { DOSSIER_ID } from '@/lib/dossier';
import {
  OSM_ATTRIBUTION,
  OSM_ATTRIBUTION_URL,
  describeGeoReason,
  featureRole,
  formatCoordinate,
  formatReportedDistance,
  type DossierSelection,
  type GeoFeature,
  type GeoFeedState,
  type GeoLink,
  type GeoViewState,
  type ResolvedGeo,
} from '@/lib/geography';
import type { VulnPublication } from '@/lib/vulnerability';

/**
 * Panel-side geography: lifecycle state, "Locate dossier", keyboard-reachable list of the
 * published anchors and schematic links, and the compact card for the selected element.
 * Everything here mirrors what the map draws — nothing is inferred beyond the publication.
 */

const STATE_STYLE: Record<GeoViewState, { label: string; cls: string }> = {
  loading: { label: 'GEOGRAPHY LOADING', cls: 'text-white/50 border-white/20' },
  available: { label: 'GEOGRAPHY AVAILABLE', cls: 'text-white border-white/40' },
  stale: { label: 'GEOGRAPHY STALE', cls: 'text-[#FFB74D] border-[#FFB74D]/50' },
  not_published: { label: 'NO GEOGRAPHY PUBLISHED', cls: 'text-white/60 border-white/20' },
  withdrawn: { label: 'GEOGRAPHY WITHDRAWN', cls: 'text-[#FF5722] border-[#FF5722]/50' },
  unavailable: { label: 'GEOGRAPHY UNAVAILABLE', cls: 'text-[#FF5722] border-[#FF5722]/50' },
};

const FULL_DOSSIER = `/dossiers/${DOSSIER_ID}`;

export interface DossierGeographyViewProps {
  feed: GeoFeedState;
  resolved: ResolvedGeo;
  selection: DossierSelection | null;
  onSelect: (sel: DossierSelection | null) => void;
  onLocate: () => void;
  /** Vulnerability publication, if loaded, for the dossier-wide vector context on cards. */
  vulnPublication: VulnPublication | null;
}

function SourceLine({ f }: { f: GeoFeature }) {
  const s = f.source;
  return (
    <p className="font-mono text-[9px] text-white/55" data-field="source">
      source: <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline text-[var(--cyan-primary)]">{s.provider} {s.feature_type} {s.feature_id}</a>
      {s.feature_version ? ` · v${s.feature_version}` : ''}{s.source_modified_at ? ` · modified ${s.source_modified_at.slice(0, 10)}` : ''} · retrieved {s.retrieved_at.slice(0, 10)} · {s.license_name}
    </p>
  );
}

function FeatureCard({ f, vuln, onClose }: { f: GeoFeature; vuln: VulnPublication | null; onClose: () => void }) {
  return (
    <div data-card="feature" data-feature-id={f.feature_id} role="region" aria-label={`Details for ${f.entity_label}`} className="rounded border border-[var(--gold-primary)]/50 bg-white/[0.03] p-2 flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-white font-semibold">{f.label}</div>
          <div className="font-mono text-[9px] text-white/50">{f.entity_id} · {f.entity_label}</div>
        </div>
        <button type="button" onClick={onClose} className="text-white/50 hover:text-white font-mono text-[10px]" aria-label="Close card">✕</button>
      </div>
      <p><span className="text-white/40">Role:</span> {featureRole(f.entity_id)}. <span className="text-white/40">Why it matters:</span> the dossier&apos;s reported concentrate chain depends on this node; a disruption here is the kind of corridor-access event the dossier-wide vector describes.</p>
      <p className="font-mono text-[9px]" data-field="precision">
        <span className="text-[#FFB74D]">{f.precision_text}</span> · {formatCoordinate(f)} (approximate, not a survey)
      </p>
      <SourceLine f={f} />
      <p className="text-white/60"><span className="text-white/40">Reported fact:</span> a mapped {f.source.feature_type} named &ldquo;{f.source.feature_name}&rdquo; exists at this anchor. <span className="text-white/40">Analyst inference:</span> its association with {f.entity_label} is approximate context, not a verified facility footprint.</p>
      {f.caveats.length > 0 && <ul className="text-[#FFB74D]/90 list-disc pl-4" data-field="caveats">{f.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>}
      {f.gaps.length > 0 && <ul className="text-white/55 list-disc pl-4" data-field="gaps">{f.gaps.map((c, i) => <li key={i}>{c}</li>)}</ul>}
      <div className="border-t border-white/10 pt-1.5" data-field="element-vector">
        <span className="text-white/40">Element-specific assessment:</span> not assessed for this element.{' '}
        {vuln?.vector_judgment
          ? <span className="text-white/70">Dossier-wide context only: {vuln.vector_judgment.primary_type} · {vuln.vector_judgment.primary_label} ({vuln.vector_judgment.confidence} prioritisation confidence); magnitude N/A.</span>
          : <span className="text-white/50">No dossier-wide vector loaded.</span>}
      </div>
      <Link href={`${FULL_DOSSIER}#physical-route`} data-link="full-dossier-section" className="font-mono text-[10px] text-[var(--cyan-primary)] underline underline-offset-2">Open in full dossier →</Link>
    </div>
  );
}

function LinkCard({ l, byEntity, vuln, onClose }: { l: GeoLink; byEntity: Map<string, GeoFeature>; vuln: VulnPublication | null; onClose: () => void }) {
  const from = byEntity.get(l.from_entity_id);
  const to = byEntity.get(l.to_entity_id);
  return (
    <div data-card="link" data-link-id={l.link_id} role="region" aria-label={`Details for ${l.label}`} className="rounded border border-[var(--gold-primary)]/50 bg-white/[0.03] p-2 flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-white font-semibold">{l.label}</div>
          <div className="font-mono text-[9px] text-white/50">edge {l.edge_id} · mode {l.mode}</div>
        </div>
        <button type="button" onClick={onClose} className="text-white/50 hover:text-white font-mono text-[10px]" aria-label="Close card">✕</button>
      </div>
      <p className="font-mono text-[10px]" data-field="endpoints">{from?.entity_label ?? l.from_entity_id} → {to?.entity_label ?? l.to_entity_id}</p>
      <p><span className="text-white/40">Role:</span> reported {l.mode} leg of the concentrate movement. <span className="text-white/40">Why it matters:</span> the dossier&apos;s only documented export path runs over this reported connection; whether alternatives exist is unknown.</p>
      <p className="font-mono text-[9px] text-white/60" data-field="distance">distance: {formatReportedDistance(l)} — not calculated from the drawn line</p>
      <p className="font-mono text-[9px] text-white/55" data-field="evidence">evidence: {l.evidence_refs.join(', ')}</p>
      <p className="text-white/60"><span className="text-white/40">Reported fact:</span> the accepted source names a {l.mode} connection between these endpoints. <span className="text-white/40">Analyst inference:</span> none — the dashed line is a schematic endpoint connector, not route geometry, exclusivity or current uninterrupted operation.</p>
      {l.caveats.length > 0 && <ul className="text-[#FFB74D]/90 list-disc pl-4" data-field="caveats">{l.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>}
      <div className="border-t border-white/10 pt-1.5" data-field="element-vector">
        <span className="text-white/40">Element-specific assessment:</span> not assessed for this element.{' '}
        {vuln?.vector_judgment
          ? <span className="text-white/70">Dossier-wide context only: {vuln.vector_judgment.primary_type} · {vuln.vector_judgment.primary_label} ({vuln.vector_judgment.confidence} prioritisation confidence); magnitude N/A.</span>
          : <span className="text-white/50">No dossier-wide vector loaded.</span>}
      </div>
      <Link href={`${FULL_DOSSIER}#physical-route`} data-link="full-dossier-section" className="font-mono text-[10px] text-[var(--cyan-primary)] underline underline-offset-2">Open in full dossier →</Link>
    </div>
  );
}

export function DossierGeographyView({ feed, resolved, selection, onSelect, onLocate, vulnPublication }: DossierGeographyViewProps) {
  const { view, body, publication: pub } = resolved;
  const style = STATE_STYLE[view];
  const reasonText = describeGeoReason(feed.fetchError ?? body?.reason);
  const features = pub?.features ?? [];
  const links = pub?.links ?? [];
  const byEntity = new Map(features.map((f) => [f.entity_id, f]));
  const selFeature = selection?.kind === 'feature' ? features.find((f) => f.feature_id === selection.id) ?? null : null;
  const selLink = selection?.kind === 'link' ? links.find((l) => l.link_id === selection.id) ?? null : null;
  const odbl = pub?.attribution.filter((a) => a.license === 'ODbL-1.0') ?? [];

  return (
    <div data-geo-view={view} className="flex flex-col gap-2 text-[10px]">
      <div data-geo-state={view} className={`rounded border px-2 py-1.5 font-mono flex flex-wrap items-center gap-x-3 gap-y-1 bg-white/[0.02] ${style.cls}`}>
        <span className="font-bold tracking-widest text-[10px]">{style.label}</span>
        {view === 'loading' && <span className="text-white/50">Contacting the Fusion sidecar…</span>}
        {(view === 'not_published' || view === 'withdrawn' || view === 'unavailable') && (
          <span className="text-[10px]">
            {reasonText ?? 'No geography is drawn.'}{' '}
            <span className="text-white/40">Nothing is drawn from history. (reason code: {feed.fetchError ?? body?.reason ?? 'unknown'})</span>
          </span>
        )}
        {view === 'stale' && <span className="text-[10px]">{reasonText ?? body?.reason} — drawn features are not fresh.</span>}
        {pub && (
          <button type="button" onClick={onLocate} data-action="locate-dossier" className="ml-auto rounded border border-white/30 px-2 py-0.5 text-white hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/60">
            Locate dossier
          </button>
        )}
      </div>

      {pub && (
        <>
          <p role="note" data-legend="schematic" className="font-mono text-[9px] text-white/60">
            {pub.legend} Points are approximate anchors ({pub.summary.features_published} published); dashed lines join published endpoints only ({pub.summary.links_published}).
            {' '}Geography publication {pub.publication_no} bound to dossier publication {body?.ddd?.publication_no ?? "?"}.
          </p>

          <ul data-section="geo-features" aria-label="Approximate anchors" className="flex flex-col gap-1">
            {features.map((f) => (
              <li key={f.feature_id}>
                <button
                  type="button"
                  onClick={() => onSelect(selFeature?.feature_id === f.feature_id ? null : { kind: 'feature', id: f.feature_id })}
                  aria-pressed={selFeature?.feature_id === f.feature_id}
                  data-geo-feature={f.feature_id}
                  className={`w-full text-left rounded border px-2 py-1 ${selFeature?.feature_id === f.feature_id ? 'border-[var(--gold-primary)]/60 bg-[var(--gold-primary)]/10 text-white' : 'border-white/10 text-white/75 hover:bg-white/5'}`}
                >
                  <span className="font-semibold">{f.label}</span>
                  <span className="font-mono text-[9px] text-white/45"> · {f.precision_class}</span>
                </button>
              </li>
            ))}
            {links.map((l) => (
              <li key={l.link_id}>
                <button
                  type="button"
                  onClick={() => onSelect(selLink?.link_id === l.link_id ? null : { kind: 'link', id: l.link_id })}
                  aria-pressed={selLink?.link_id === l.link_id}
                  data-geo-link={l.link_id}
                  className={`w-full text-left rounded border border-dashed px-2 py-1 ${selLink?.link_id === l.link_id ? 'border-[var(--gold-primary)]/60 bg-[var(--gold-primary)]/10 text-white' : 'border-white/15 text-white/75 hover:bg-white/5'}`}
                >
                  <span className="font-semibold">{l.label}</span>
                  <span className="font-mono text-[9px] text-white/45"> · {byEntity.get(l.from_entity_id)?.entity_label ?? l.from_entity_id} → {byEntity.get(l.to_entity_id)?.entity_label ?? l.to_entity_id}</span>
                </button>
              </li>
            ))}
          </ul>

          {(pub.missing.length > 0 || pub.omitted_links.length > 0) && (
            <ul data-section="geo-gaps" className="text-[#FFB74D] font-mono text-[9px] list-disc pl-4">
              {pub.missing.map((g) => <li key={g.entity_id}>no location for {g.entity_id}: {g.reason}</li>)}
              {pub.omitted_links.map((g) => <li key={g.edge_id}>link {g.edge_id} not drawn: {g.reason}</li>)}
            </ul>
          )}

          {selFeature && <FeatureCard f={selFeature} vuln={vulnPublication} onClose={() => onSelect(null)} />}
          {selLink && <LinkCard l={selLink} byEntity={byEntity} vuln={vulnPublication} onClose={() => onSelect(null)} />}

          {odbl.length > 0 && (
            <p data-attribution="odbl" className="font-mono text-[9px] text-white/50">
              {odbl.map((a) => (
                <span key={a.url}>
                  <a href={a.url || OSM_ATTRIBUTION_URL} target="_blank" rel="noopener noreferrer" className="underline">{a.text || OSM_ATTRIBUTION}</a> · <a href={a.license_url} target="_blank" rel="noopener noreferrer" className="underline">{a.license_name}</a>
                </span>
              ))}
            </p>
          )}
        </>
      )}
    </div>
  );
}
