'use client';

import {
  MAGNITUDE_NA,
  THREAT_TYPE_LABEL,
  formatVulnTimestamp,
  type VectorJudgment,
  type VulnPublication,
} from '@/lib/vulnerability';

/**
 * Two independent analytical outputs side by side: the (unchanged) disruption magnitude and
 * the dossier-wide hypothetical vector. Magnitude stays "N/A · Insufficient evidence" when the
 * publication bounds nothing; the vector is a separate row, never a matrix cell, and its
 * confidence is prioritisation confidence only. Category tone is neutral — no severity colour.
 */
export interface VectorJudgmentCardProps {
  publication: VulnPublication | null;
  compact?: boolean;
  /** Summary-only rendering (no assumptions/alternatives/reversal lists). */
  brief?: boolean;
}

function MagnitudeRow({ pub }: { pub: VulnPublication }) {
  const s = pub.summary;
  const na = s.supported_maximum === null;
  return (
    <div data-field="dossier-magnitude" className="flex flex-col gap-0.5">
      <div className="text-[9px] font-mono tracking-widest text-white/40 uppercase">Disruption magnitude (rubric 1.0)</div>
      <div className="font-mono">
        {na ? MAGNITUDE_NA : `${s.supported_maximum} · ${s.supported_maximum_confidence ?? 'UNKNOWN'} (supported maximum)`}
      </div>
      {na && (
        <p className="text-white/55">
          Accepted evidence does not bound extent, duration, recovery or alternatives for any scenario. N/A is not zero
          and not low; unknown recovery or alternatives are not assumed worst-case.
        </p>
      )}
    </div>
  );
}

export function VectorJudgmentCard({ publication: pub, compact = false, brief = false }: VectorJudgmentCardProps) {
  if (!pub) return null;
  const v: VectorJudgment | null = pub.vector_judgment ?? null;
  return (
    <section
      data-section="vector-judgment"
      data-vector={v?.primary_type ?? 'none'}
      aria-label="Disruption magnitude and hypothetical vector"
      className={`rounded border border-white/[0.12] p-2 flex flex-col gap-2 ${compact ? 'text-[10px]' : 'text-[11px]'}`}
    >
      <MagnitudeRow pub={pub} />
      <div data-field="dossier-vector" className="flex flex-col gap-0.5 border-t border-white/10 pt-2">
        <div className="text-[9px] font-mono tracking-widest text-white/40 uppercase">Top hypothetical vector · dossier-wide</div>
        {!v ? (
          <p className="text-white/55">
            No vector judgment in this publication ({pub.contract}). Absence of a judgment is not an absence of risk.
          </p>
        ) : (
          <>
            <div className="font-mono">
              <span className="font-bold">{v.primary_type}</span> · {v.primary_label}
              {v.secondary_type ? <span className="text-white/60"> · secondary {v.secondary_type} ({THREAT_TYPE_LABEL[v.secondary_type]})</span> : <span className="text-white/40"> · no secondary</span>}
            </div>
            <div className="font-mono text-white/70" data-field="vector-confidence">
              prioritisation confidence {v.confidence} — confidence that this category is the one to prioritise, not that an event will occur
            </div>
            <p className="text-white/75">{v.rationale}</p>
            <p className="font-mono text-[9px] text-white/50" data-field="vector-basis">
              basis: {v.basis_refs.join(', ')}{v.scenario_refs.length ? ` · related scenario context: ${v.scenario_refs.join(', ')} (disposition unchanged)` : ''}
              {' · '}assessed {formatVulnTimestamp(v.assessed_at)} · v{v.version}
            </p>
            {!brief && (
              <>
                {v.assumptions.length > 0 && (
                  <div>
                    <div className="text-white/40">Assumptions</div>
                    <ul className="text-white/60 list-disc pl-4">{v.assumptions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {v.alternatives_considered.length > 0 && (
                  <div>
                    <div className="text-white/40">Alternatives considered (plausible, not prioritised on present evidence)</div>
                    <ul className="text-white/60 list-disc pl-4">
                      {v.alternatives_considered.map((a) => <li key={a.type}><span className="font-mono">{a.type}</span> {THREAT_TYPE_LABEL[a.type]}: {a.why_not_prioritized}</li>)}
                    </ul>
                  </div>
                )}
                {v.reversal_conditions.length > 0 && (
                  <div>
                    <div className="text-white/40">What would change this ranking</div>
                    <ul className="text-white/60 list-disc pl-4">{v.reversal_conditions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
              </>
            )}
            <p role="note" data-banner="vector-disclaimer" className="font-mono text-[9px] text-[#FFB74D]">{v.disclaimer}</p>
          </>
        )}
      </div>
    </section>
  );
}
