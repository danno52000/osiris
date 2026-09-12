'use client';

import { motion } from 'framer-motion';
import type { FusionEntityBrief } from '@/lib/fusion';

interface EntityBriefDrawerProps {
  brief: FusionEntityBrief | null;
  loading: boolean;
  onClose: () => void;
}

const Field = ({ label, value, accent }: { label: string; value?: string | null; accent?: string }) => {
  if (!value) return null;
  return (
    <div>
      <div className="hud-label mb-0.5">{label}</div>
      <div className="text-xs font-mono" style={{ color: accent || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
};

/**
 * Entity card drawer for a flagged tactical track — slides in from the right
 * and shows the fusion sidecar's brief: identity, linked customs manifest,
 * and the LLM-generated operational rationale.
 */
export default function EntityBriefDrawer({ brief, loading, onClose }: EntityBriefDrawerProps) {
  if (!brief && !loading) return null;
  const risk = brief?.risk_score ?? 0;
  const riskColor = risk >= 0.7 ? '#FF1744' : risk >= 0.4 ? '#FF9500' : '#00E676';

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="absolute top-16 md:top-20 right-2 md:right-14 z-[300] w-[min(92vw,380px)] max-h-[70vh] overflow-y-auto styled-scrollbar"
    >
      <div className="glass-panel p-5 osiris-glow" style={{ borderColor: `${riskColor}40` }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-mono font-bold tracking-wider" style={{ color: riskColor }}>
            ENTITY BRIEF
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
            aria-label="Close entity brief"
          >✕</button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-5 h-5 border-2 border-[var(--gold-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-[9px] font-mono text-[var(--text-muted)] tracking-widest">RESOLVING ENTITY...</span>
          </div>
        ) : brief && (
          <div className="space-y-3">
            <div>
              <div className="hud-label mb-0.5">ENTITY</div>
              <div className="text-sm font-mono font-bold text-[var(--text-primary)]">{brief.entity_name}</div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                  style={{ color: riskColor, borderColor: `${riskColor}60`, background: `${riskColor}15` }}
                >
                  {brief.threat_classification}
                </span>
                {brief.sanctions_hit && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[#FF1744]/60 text-[#FF1744] bg-[#FF1744]/15 animate-osiris-pulse">
                    SANCTIONS HIT
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="JURISDICTION" value={brief.jurisdiction?.toUpperCase()} />
              <Field label="RISK SCORE" value={`${(risk * 100).toFixed(0)}%`} accent={riskColor} />
              <Field label="MANIFEST" value={brief.manifest_number} accent="var(--gold-primary)" />
              <Field label="BILL OF LADING" value={brief.bill_of_lading} accent="var(--gold-primary)" />
              <Field label="PORT OF ENTRY" value={brief.port_of_entry} />
              <Field label="COMMODITY" value={brief.commodity} />
              <Field label="SHIPPER" value={brief.shipper} />
              <Field label="CONSIGNEE" value={brief.consignee} />
            </div>

            <div>
              <div className="hud-label mb-1">OPERATIONAL RATIONALE</div>
              <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed border-l-2 pl-2"
                style={{ borderColor: `${riskColor}60` }}>
                {brief.rationale}
              </p>
            </div>

            <div className="pt-2 border-t border-[var(--text-muted)]/20">
              <div className="hud-label mb-0.5">RECOMMENDED ACTION</div>
              <div className="text-[10px] font-mono" style={{ color: riskColor }}>{brief.recommended_action}</div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
