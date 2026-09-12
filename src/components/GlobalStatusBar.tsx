'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface Earthquake { id: string; magnitude: number; place: string; time: number; depth: number; }

/* ─── Inline SVG Icons ─── */
const DocsIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10a2 2 0 0 1 2 2 2 2 0 0 1 2-2h4.5A1.5 1.5 0 0 1 20 4.5v13a1.5 1.5 0 0 1-1.5 1.5H14a2 2 0 0 0-2 2 2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 17.5z"/>
    <path d="M12 7v14"/>
  </svg>
);

export default function GlobalStatusBar() {
  const [quakes, setQuakes] = useState<Earthquake[]>([]);
  const [hoveredQuake, setHoveredQuake] = useState<Earthquake | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
        if (!res.ok) return;
        const data = await res.json();
        const majorQuakes = ((data.features || []).map((f: { id?: string; geometry?: { coordinates?: number[] }; properties?: { mag?: number; place?: string; time?: number; url?: string; tsunami?: number; type?: string; felt?: number; alert?: string } }) => ({
          id: f.id,
          lat: f.geometry?.coordinates?.[1] || 0,
          lng: f.geometry?.coordinates?.[0] || 0,
          depth: f.geometry?.coordinates?.[2] || 0,
          magnitude: f.properties?.mag,
          place: f.properties?.place,
          time: f.properties?.time,
          url: f.properties?.url,
          tsunami: f.properties?.tsunami,
          type: f.properties?.type,
          felt: f.properties?.felt,
          alert: f.properties?.alert,
        })) as Earthquake[])
          .filter((q: Earthquake) => q.magnitude >= 4.0)
          .sort((a: Earthquake, b: Earthquake) => b.time - a.time)
          .slice(0, 5);
        setQuakes(majorQuakes);
      } catch (e) { console.warn('[GIDEON] Suppressed error:', e instanceof Error ? e.message : e); }
    };
    fetchData();
    const iv = setInterval(fetchData, 60000);
    return () => clearInterval(iv);
  }, []);

  // Keep the bar mounted even with no feed data — the docs link must stay
  // reachable when USGS is rate-limited or down.
  const hasTicker = quakes.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 3, duration: 0.6 }}
      className="hidden md:block absolute bottom-0 left-0 right-0 z-[210] pointer-events-none"
    >
      <div className="h-[28px] overflow-hidden bg-[#0a0a0f]/95 border-t border-white/[0.06] flex items-center text-[10px] font-mono tracking-wider backdrop-blur-xl relative">
        {/* Animated scan line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--cyan-primary)]/30 to-transparent" style={{ animation: 'hud-scanline 4s linear infinite' }} />
        
        {/* ── LEFT: Documentation link ── */}
        <div className="flex-shrink-0 h-full flex items-center pointer-events-auto">
          {/* Documentation & API reference */}
          <Link href="/docs" prefetch title="Documentation & API Reference" aria-label="Documentation & API Reference"
            className="h-full px-3 flex items-center gap-1.5 bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]/80 hover:text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/25 border-r border-white/[0.04] transition-all duration-200"
          >
            <DocsIcon />
            <span className="text-[9px] font-bold tracking-[0.15em] uppercase">Docs</span>
          </Link>
        </div>

        {/* ── CENTER: Scrolling ticker ── */}
        <div className="flex-1 overflow-hidden relative" style={{ maskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)' }}>
          <div className={`flex items-center animate-ticker whitespace-nowrap ${hasTicker ? '' : 'hidden'}`}>
            {[...Array(4)].map((_, repeatIdx) => (
              <span key={repeatIdx} className="inline-flex items-center">
                {/* Earthquakes */}
                {quakes.map(quake => (
                  <span 
                    key={`${quake.id}-${repeatIdx}`}
                    className="inline-flex items-center gap-1 mx-2 cursor-help pointer-events-auto"
                    onMouseEnter={() => setHoveredQuake(quake)}
                    onMouseLeave={() => setHoveredQuake(null)}
                  >
                    <span className="text-[#FF5722] text-[9px]">🔴</span>
                    <span className="text-[#FF5722] font-bold">M{quake.magnitude.toFixed(1)}</span>
                    <span className="text-white/30 truncate max-w-[140px]">{quake.place}</span>
                  </span>
                ))}
                <span className="text-white/10 mx-2">│</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Status indicator ── */}
        <div className="flex-shrink-0 h-full flex items-center pointer-events-auto border-l border-white/[0.04]">

          {/* Status indicator */}
          <div className="h-full px-3 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" />
            <span className="text-[#00E676]/70 text-[9px] tracking-[0.2em]">ONLINE</span>
          </div>
        </div>
      </div>

      {/* Earthquake hover tooltip */}
      {hoveredQuake && (
        <div className="absolute bottom-[34px] left-1/2 -translate-x-1/2 z-[300] pointer-events-none">
          <div className="bg-black/90 backdrop-blur-xl border border-white/[0.08] rounded-lg px-4 py-3 text-[11px] font-mono whitespace-nowrap shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px]">🔴</span>
              <span className="font-bold text-[#FF5722]">Magnitude {hoveredQuake.magnitude.toFixed(1)}</span>
              <span className="text-white/30 text-[9px] bg-white/5 px-1.5 py-0.5 rounded">USGS</span>
            </div>
            <div className="text-[10px] text-white font-bold mb-2">
              {hoveredQuake.place}
            </div>
            <div className="flex flex-col gap-1 text-[10px]">
              <div className="text-white/50"><span className="text-white/30">Depth:</span> {hoveredQuake.depth} km</div>
              <div className="text-white/50 mt-1"><span className="text-white/30">Time:</span> {new Date(hoveredQuake.time).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
