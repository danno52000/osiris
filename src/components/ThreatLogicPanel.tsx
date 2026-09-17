'use client';

import { Cpu } from 'lucide-react';

const TRIAGE_POINTS = [
  'Trajectory-physics filter strips 65–75% of nuisance alarms',
  'Corridor risk association on surviving tracks',
  'PostGIS ST_DWithin proximity checks vs spatial_zones',
];

const CRITICALITY_DIMS = [
  { key: 'C1', name: 'SUPPLY CRITICALITY', src: 'USGS mineral / material dependency' },
  { key: 'C2', name: 'CORPORATE OPACITY', src: 'shell & registration transparency' },
  { key: 'C3', name: 'PORT DWELL DELAYS', src: 'CBP commercial-lane bottleneck' },
  { key: 'C4', name: 'ADVERSARY NEXUS', src: 'OFAC / BIS entity linkage' },
];

/** Mirrors the sidecar W_* constants in sidecar/main.py. */
const FACTOR_WEIGHTS = [
  { name: 'SANCTIONS HIT', weight: '0.40' },
  { name: 'DUAL-USE COMMODITY', weight: '0.25' },
  { name: 'TRANSSHIPMENT JURISDICTION', weight: '0.15' },
  { name: 'CBP PORT BOTTLENECK', weight: '0.10' },
  { name: 'CARTEL PLAZA PROXIMITY', weight: '0.10' },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1.5 text-[9px] font-mono font-bold tracking-[0.18em] text-[#00E5FF]/80 uppercase border-t border-white/[0.05]">
      {children}
    </div>
  );
}

export default function ThreatLogicPanel() {
  return (
    <div className="glass-panel w-80 rounded-xl overflow-hidden flex flex-col pointer-events-auto">
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#00E5FF]" />
          <span className="text-[11px] font-mono font-bold tracking-[0.18em] text-white/90">
            GIDEON THREAT LOGIC ENGINE
          </span>
        </div>
        <p className="mt-1.5 text-[9px] font-mono tracking-wider text-white/40 leading-relaxed">
          CROSS-DOMAIN MULTI-INT CORRELATION &amp; DECISION ADVANTAGE (10 U.S.C. 4022 / 4023)
        </p>
      </div>

      <SectionLabel>10 U.S.C. 4022 — Tactical Triage</SectionLabel>
      <ul className="px-4 pb-1 flex flex-col gap-1">
        {TRIAGE_POINTS.map((p) => (
          <li key={p} className="text-[9px] font-mono tracking-wider text-white/60 leading-relaxed flex gap-2">
            <span className="text-[#00E5FF]/60 shrink-0">▸</span>{p}
          </li>
        ))}
      </ul>

      <SectionLabel>10 U.S.C. 4023 — Dynamic Criticality</SectionLabel>
      <div className="px-4 pb-1 flex flex-col gap-1.5">
        {CRITICALITY_DIMS.map((d) => (
          <div key={d.key} className="flex items-baseline gap-2">
            <span className="text-[9px] font-mono font-bold text-[#00E5FF] w-5 shrink-0">{d.key}</span>
            <span className="text-[9px] font-mono tracking-wider text-white/75 shrink-0">{d.name}</span>
            <span className="text-[8px] font-mono tracking-wider text-white/30 truncate">{d.src}</span>
          </div>
        ))}
      </div>

      <SectionLabel>Active Scoring Formula &amp; Factor Weights</SectionLabel>
      <div className="px-4 pb-1.5">
        <div className="text-[9px] font-mono tracking-wider text-white/45 mb-1.5">
          R = Σ (w<sub>i</sub> · f<sub>i</sub>) — persist when R ≥ <span className="text-[#FFB300]">0.20</span>
        </div>
        {FACTOR_WEIGHTS.map((f) => (
          <div key={f.name} className="flex items-center py-0.5">
            <span className="text-[9px] font-mono tracking-wider text-white/60 flex-1">{f.name}</span>
            <span className="text-[9px] font-mono font-bold tabular-nums text-[#00E5FF]">{f.weight}</span>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ADE80] opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4ADE80]" />
        </span>
        <span className="text-[8px] font-mono tracking-wider text-[#4ADE80]/90">
          SIDECAR ENGINE: ACTIVE // EVALUATING
        </span>
      </div>
    </div>
  );
}
