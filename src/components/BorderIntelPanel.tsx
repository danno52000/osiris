'use client';

import { motion } from 'framer-motion';
import { ShieldAlert, MapPin, AlertTriangle } from 'lucide-react';

/** Presentational toggle — the row is the button, matching LayerPanel's rule
 * that a button nested inside a button silently drops the click handler. */
function ToggleSwitch({ active }: { active: boolean }) {
  return (
    <span role="presentation" className="relative flex-shrink-0 block" style={{ width: 28, height: 14 }}>
      <div
        className="absolute inset-0 rounded-full transition-all duration-300"
        style={{
          background: active ? 'rgba(0,229,255,0.16)' : 'transparent',
          border: active ? '1px solid rgba(0,229,255,0.45)' : '1px solid rgba(255,255,255,0.12)',
          boxShadow: active ? '0 0 8px rgba(0,229,255,0.15)' : 'none',
        }}
      />
      <motion.div
        className="absolute top-[2px] rounded-full"
        style={{
          width: 10,
          height: 10,
          background: active ? '#00E5FF' : 'rgba(255,255,255,0.2)',
          boxShadow: active ? '0 0 6px rgba(0,229,255,0.5)' : 'none',
        }}
        animate={{ left: active ? 16 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </span>
  );
}

interface BorderIntelPanelProps {
  cbpWaitsActive: boolean;
  plazaGeofencesActive: boolean;
  onToggleWaits: () => void;
  onToggleGeofences: () => void;
  /** Counts for the status line under each row, when data has landed. */
  waitCount?: number;
  zoneCount?: number;
  waitsDegraded?: boolean;
}

export default function BorderIntelPanel({
  cbpWaitsActive,
  plazaGeofencesActive,
  onToggleWaits,
  onToggleGeofences,
  waitCount,
  zoneCount,
  waitsDegraded,
}: BorderIntelPanelProps) {
  const rows = [
    {
      key: 'cbp',
      icon: <MapPin className="w-3.5 h-3.5" />,
      title: 'CBP BORDER PORTS & WAIT TIMES',
      desc: 'Commercial lane delays, upstream CBP timestamps',
      active: cbpWaitsActive,
      onToggle: onToggleWaits,
      status: waitsDegraded
        ? 'FEED DEGRADED — UNAVAILABLE'
        : waitCount != null
          ? `${waitCount} CROSSINGS TRACKED`
          : 'NO DATA',
    },
    {
      key: 'plaza',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      title: 'CARTEL PLAZA GEOFENCES',
      desc: 'Contested plaza buffers & faction control zones',
      active: plazaGeofencesActive,
      onToggle: onToggleGeofences,
      status: zoneCount != null ? `${zoneCount} GEOFENCES` : 'NO DATA',
    },
  ];

  return (
    <div className="glass-panel w-80 rounded-xl overflow-hidden flex flex-col pointer-events-auto">
      <div className="px-4 pt-3.5 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#00E5FF]" />
          <span className="text-[11px] font-mono font-bold tracking-[0.18em] text-white/90">
            BORDER &amp; THREAT CORRIDORS
          </span>
        </div>
        <p className="mt-1.5 text-[9px] font-mono tracking-wider text-white/40 leading-relaxed">
          CBP CROSSING DELAYS + CONTESTED-PLAZA INTELLIGENCE LAYERS
        </p>
      </div>

      <div className="flex flex-col px-2 py-1.5">
        {rows.map((row) => (
          <button
            key={row.key}
            onClick={row.onToggle}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            aria-pressed={row.active}
          >
            <span className={`${row.active ? 'text-[#00E5FF]' : 'text-white/30'} transition-colors`}>
              {row.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[10px] font-mono font-bold tracking-[0.12em] text-white/85 truncate">
                {row.title}
              </span>
              <span className="block text-[8px] font-mono tracking-wider text-white/35 mt-0.5 truncate">
                {row.desc}
              </span>
              {row.active && (
                <span className={`block text-[8px] font-mono tracking-wider mt-0.5 ${
                  waitsDegraded && row.key === 'cbp' ? 'text-[#FFB300]' : 'text-[#00E5FF]/70'
                }`}>
                  {row.status}
                </span>
              )}
            </span>
            <ToggleSwitch active={row.active} />
          </button>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-white/[0.06] text-[8px] font-mono tracking-wider text-white/25">
        SOURCE: FUSION SIDECAR · CBP LIVE / POSTGIS
      </div>
    </div>
  );
}
