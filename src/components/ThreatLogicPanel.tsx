'use client';

import { motion } from 'framer-motion';
import { Cpu, FlaskConical } from 'lucide-react';

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

/** Presentational toggle — the row is the button (a button inside a button
 *  silently drops the click handler). Amber accent marks simulated data. */
function DemoToggle({ active }: { active: boolean }) {
  return (
    <span role="presentation" className="relative flex-shrink-0 block" style={{ width: 28, height: 14 }}>
      <div
        className="absolute inset-0 rounded-full transition-all duration-300"
        style={{
          background: active ? 'rgba(255,179,0,0.16)' : 'transparent',
          border: active ? '1px solid rgba(255,179,0,0.5)' : '1px solid rgba(255,255,255,0.12)',
          boxShadow: active ? '0 0 8px rgba(255,179,0,0.25)' : 'none',
        }}
      />
      <motion.div
        className="absolute top-[2px] rounded-full"
        style={{
          width: 10,
          height: 10,
          background: active ? '#FFB300' : 'rgba(255,255,255,0.2)',
          boxShadow: active ? '0 0 6px rgba(255,179,0,0.6)' : 'none',
        }}
        animate={{ left: active ? 16 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1.5 text-[9px] font-mono font-bold tracking-[0.18em] text-[#00E5FF]/80 uppercase border-t border-white/[0.05]">
      {children}
    </div>
  );
}

interface ThreatLogicPanelProps {
  demoScenariosEnabled?: boolean;
  onDemoScenariosChange?: (enabled: boolean) => void;
}

export default function ThreatLogicPanel({ demoScenariosEnabled = false, onDemoScenariosChange }: ThreatLogicPanelProps) {
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

      <div className="border-t border-white/[0.06] px-2 py-1.5">
        <button
          onClick={() => onDemoScenariosChange?.(!demoScenariosEnabled)}
          aria-pressed={demoScenariosEnabled}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
        >
          <span className={`${demoScenariosEnabled ? 'text-[#FFB300]' : 'text-white/30'} transition-colors`}>
            <FlaskConical className="w-3.5 h-3.5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[10px] font-mono font-bold tracking-[0.12em] text-white/85 truncate">
              DEMO SCENARIO INJECTION
            </span>
            <span className="block text-[8px] font-mono tracking-wider text-white/35 mt-0.5 truncate">
              Inject active 10 U.S.C. 4022/4023 correlated targets onto COP
            </span>
            {demoScenariosEnabled && (
              <span className="block text-[8px] font-mono tracking-wider mt-0.5 text-[#FFB300]/80">
                2 SIMULATED CRITICAL TARGETS LIVE
              </span>
            )}
          </span>
          <DemoToggle active={demoScenariosEnabled} />
        </button>
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
