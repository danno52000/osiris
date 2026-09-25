'use client';

import { useEffect, useState } from 'react';
import {
  APPLICABILITY_LABEL,
  CASE_KIND_LABEL,
  CATEGORY_LABEL,
  CHART_EMPTY_TEXT,
  chartableCases,
  describeUwReason,
  formatBands,
  formatNullReason,
  formatScore,
  magnitudeSummary,
  formatUwTimestamp,
  unplottedCases,
  type ResolvedUw,
  type UwCase,
  type UwFeedState,
  type UwHighlight,
  type UwInput,
  type UwPublication,
  type UwViewState,
} from '@/lib/underwriting';

const STATE_STYLE: Record<UwViewState, { label: string; cls: string }> = {
  off: { label: 'UNDERWRITING VIEW OFF', cls: 'text-white/50 border-white/20' },
  loading: { label: 'LOADING', cls: 'text-white/50 border-white/20' },
  available: { label: 'CASE PORTFOLIO AVAILABLE', cls: 'text-white border-white/40' },
  stale: { label: 'CASE PORTFOLIO STALE', cls: 'text-[#FFB74D] border-[#FFB74D]/50' },
  not_published: { label: 'NO CASE PORTFOLIO PUBLISHED', cls: 'text-white/60 border-white/20' },
  withdrawn: { label: 'CASE PORTFOLIO WITHDRAWN', cls: 'text-[#FF5722] border-[#FF5722]/50' },
  unavailable: { label: 'CASE PORTFOLIO UNAVAILABLE', cls: 'text-[#FF5722] border-[#FF5722]/50' },
};

const KIND_STYLE: Record<UwCase['case_kind'], string> = {
  assumption_led: 'border-[#B388FF]/60 text-[#B388FF]',
  evidence_limited: 'border-white/20 text-white/60',
  evidence_supported: 'border-white/50 text-white',
};

const BASIS_LABEL: Record<UwInput['basis_kind'], string> = {
  documented_fact: 'documented fact',
  bounded_inference: 'bounded inference',
  stress_assumption: 'stress assumption',
  unknown: 'unknown',
};

export interface UnderwritingViewProps {
  feed: UwFeedState;
  resolved: ResolvedUw;
  /** Compact layout for the map-side panel; the full dossier page uses the default. */
  compact?: boolean;
  /**
   * Map highlight request for the selected case (verified entity/edge ids only) or null to clear.
   * Omitted when no map is present (full dossier page).
   */
  onHighlight?: (h: UwHighlight | null) => void;
  /** True when the geography overlay is drawn, so the card can say what highlighting means. */
  geographyDrawn?: boolean;
}

// ---------------------------------------------------------------------------
// dual-axis chart: difficulty (x) × magnitude (y). Draws only cases with both axes numeric;
// a range becomes a rectangle, a point a dot. Nothing is computed, ranked or combined.
// ---------------------------------------------------------------------------

const CELL = 28;
const PAD_L = 30;
const PAD_B = 26;
const PAD_T = 8;
const PAD_R = 8;

function DualAxisChart({ pub, selectedId, onSelect }: { pub: UwPublication; selectedId: string | null; onSelect: (id: string) => void }) {
  const plotted = chartableCases(pub);
  const w = PAD_L + 5 * CELL + PAD_R;
  const h = PAD_T + 5 * CELL + PAD_B;
  const x0 = (v: number) => PAD_L + (v - 1) * CELL;
  const y0 = (v: number) => PAD_T + (5 - v) * CELL;
  return (
    <div data-section="uw-chart" data-plotted={plotted.length} className="flex flex-col gap-1">
      <div className="font-mono text-[9px] text-white/50">
        Dual-axis chart — x: materialization difficulty (1 lower barriers … 5 exceptional), y: conditional magnitude (1 limited … 5 critical). Independent axes; position is not likelihood and not a combined score.
      </div>
      <div className="flex flex-wrap gap-3 items-start">
        <svg role="img" aria-label="Difficulty by magnitude chart" viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="shrink-0">
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line x1={x0(v)} y1={PAD_T} x2={x0(v)} y2={PAD_T + 5 * CELL} stroke="rgba(255,255,255,0.12)" />
              <line x1={PAD_L} y1={y0(v)} x2={PAD_L + 5 * CELL} y2={y0(v)} stroke="rgba(255,255,255,0.12)" />
              <text x={x0(v) + CELL / 2} y={h - PAD_B + 12} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.6)" fontFamily="monospace">{v}</text>
              <text x={PAD_L - 6} y={y0(v) + CELL / 2 + 3} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.6)" fontFamily="monospace">{v}</text>
            </g>
          ))}
          <line x1={PAD_L + 5 * CELL} y1={PAD_T} x2={PAD_L + 5 * CELL} y2={PAD_T + 5 * CELL} stroke="rgba(255,255,255,0.12)" />
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L + 5 * CELL} y2={PAD_T} stroke="rgba(255,255,255,0.12)" />
          <text x={PAD_L + 2.5 * CELL} y={h - 2} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.5)" fontFamily="monospace">difficulty →</text>
          <text x={8} y={PAD_T + 2.5 * CELL} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.5)" fontFamily="monospace" transform={`rotate(-90 8 ${PAD_T + 2.5 * CELL})`}>magnitude →</text>
          {plotted.map((c) => {
            const dl = c.difficulty.low as number, dh = c.difficulty.high as number;
            const ml = c.magnitude.low as number, mh = c.magnitude.high as number;
            const sel = c.case_id === selectedId;
            const stroke = sel ? '#B388FF' : '#F2C15A';
            const label = `${c.category} ${c.title}: difficulty ${formatScore(dl, dh)} (${c.difficulty.confidence}), magnitude ${formatScore(ml, mh)} (${c.magnitude.confidence})`;
            return (
              <g key={c.case_id} data-chart-case={c.case_id} data-chart-shape={dl === dh && ml === mh ? 'point' : 'range'} role="button" tabIndex={0} aria-label={label}
                onClick={() => onSelect(c.case_id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c.case_id); } }} className="cursor-pointer focus:outline-none">
                <title>{label}</title>
                {dl === dh && ml === mh
                  ? <circle cx={x0(dl) + CELL / 2} cy={y0(ml) + CELL / 2} r={sel ? 7 : 5.5} fill={stroke} fillOpacity={0.85} stroke="#0C0E1A" strokeWidth={1.5} />
                  : <rect x={x0(dl) + 3} y={y0(mh) + 3} width={(dh - dl + 1) * CELL - 6} height={(mh - ml + 1) * CELL - 6} rx={4} fill={stroke} fillOpacity={0.18} stroke={stroke} strokeWidth={sel ? 2.5 : 1.5} strokeDasharray="4 3" />}
                <text x={x0(dl) + 6} y={y0(mh) + 12} fontSize={8} fill="#FFFFFF" fontFamily="monospace">{c.category}</text>
              </g>
            );
          })}
          {plotted.length === 0 && (
            <text data-chart-empty x={PAD_L + 2.5 * CELL} y={PAD_T + 2.5 * CELL - 5} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.7)" fontFamily="monospace">
              <tspan x={PAD_L + 2.5 * CELL}>No cases currently</tspan>
              <tspan x={PAD_L + 2.5 * CELL} dy={11}>have both scores</tspan>
            </text>
          )}
        </svg>
        <div className="flex flex-col gap-1 min-w-[140px] flex-1">
          {plotted.length === 0 && <p data-chart-empty-text className="font-mono text-[10px] text-white">{CHART_EMPTY_TEXT}</p>}
          <p className="font-mono text-[9px] text-white/50">
            {plotted.length} of {pub.cases.length} published case{pub.cases.length === 1 ? '' : 's'} carry both scores. Dots are point scores; dashed boxes are reviewed ranges. Cases without both scores are listed, never plotted.
          </p>
          {unplottedCases(pub).length > 0 && (
            <ul data-section="uw-unplotted" className="font-mono text-[9px] text-white/60 flex flex-col gap-0.5">
              {unplottedCases(pub).map((c) => (
                <li key={c.case_id} data-unplotted-case={c.case_id}>
                  {c.category} · difficulty {formatScore(c.difficulty.low, c.difficulty.high)} · <span data-field="magnitude-summary">{c.magnitude.low === null ? `magnitude ${formatScore(c.magnitude.low, c.magnitude.high)}` : magnitudeSummary(c.magnitude)}</span> — not plotted
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// case card
// ---------------------------------------------------------------------------

function Refs({ refs }: { refs: UwInput['references'] }) {
  if (refs.length === 0) return <span className="text-white/40">no references</span>;
  return <span>{refs.map((r) => `${r.ref} (${r.role.replace(/_/g, ' ')})`).join('; ')}</span>;
}

function CaseDetail({ c, compact, geographyDrawn, mapHighlight, onClearHighlight }: { c: UwCase; compact: boolean; geographyDrawn: boolean; mapHighlight: boolean; onClearHighlight?: () => void }) {
  return (
    <div data-case-detail={c.case_id} className="mt-1 flex flex-col gap-1.5 text-[9px] text-white/70 border-t border-white/10 pt-1.5">
      <p className="text-[#B388FF]/90 font-mono">{c.hypothetical_label}</p>
      <p><span className="text-white/40">Initiating functional state (onset only):</span> {c.initiating_statement}</p>
      <p><span className="text-white/40">Function:</span> {c.boundary.function_statement}</p>
      <p><span className="text-white/40">Boundary:</span> {c.boundary.boundary_statement}</p>
      <p><span className="text-white/40">First-order consequence:</span> {c.boundary.first_order}</p>
      {c.boundary.limits.length > 0 && <ul className="list-disc pl-4 text-white/60">{c.boundary.limits.map((s, i) => <li key={i}>{s}</li>)}</ul>}
      <p><span className="text-white/40">Applicability:</span> {APPLICABILITY_LABEL[c.applicability.state]} ({c.applicability.confidence}) — {c.applicability.rationale}{c.applicability.currentness_caveat ? ` Currentness: ${c.applicability.currentness_caveat}` : ''}</p>

      <div data-field="difficulty-detail" className="rounded border border-white/10 p-1.5">
        <div className="font-mono text-white">{c.display.difficulty}</div>
        <p>{c.difficulty.rationale}</p>
        {c.difficulty.low !== null && (
          <p className="text-white/60">low: {c.difficulty.low_rationale}{c.difficulty.high_rationale ? ` · high: ${c.difficulty.high_rationale}` : ''}{c.difficulty.limited_barriers_basis ? ` · limited-barriers basis: ${c.difficulty.limited_barriers_basis}` : ''}</p>
        )}
        {c.difficulty.unknown_bounding_rationale && <p className="text-white/60">unknowns bounded: {c.difficulty.unknown_bounding_rationale}</p>}
        {c.difficulty.low === null && <p className="text-white/50 font-mono">null reason: {formatNullReason(c.difficulty.null_reason)} — N/A is not low and not easy.</p>}
      </div>
      <div data-field="magnitude-detail" className="rounded border border-white/10 p-1.5">
        <div className="font-mono text-white">{c.display.magnitude}</div>
        <p>{c.magnitude.rationale}</p>
        <p className="font-mono text-white/60">extent {formatBands(c.magnitude.extent_bands)} · duration {formatBands(c.magnitude.duration_bands)}{c.magnitude.duration_days !== null ? ` (${c.magnitude.duration_days} assumed days)` : ''} · confidence {c.magnitude.confidence}</p>
        {c.magnitude.extent_rationale && <p className="text-white/60">extent: {c.magnitude.extent_rationale}</p>}
        {c.magnitude.duration_rationale && <p className="text-white/60">duration: {c.magnitude.duration_rationale}</p>}
        {c.magnitude.low === null && <p className="text-white/50 font-mono">null reason: {formatNullReason(c.magnitude.null_reason)} — N/A is not zero.</p>}
      </div>

      {c.assumptions.length > 0 && (
        <div data-field="assumptions" className="rounded border border-[#B388FF]/40 p-1.5">
          <div className="font-mono text-[#B388FF]">Reviewed stress assumptions ({c.assumptions.length}) — assumed, not observed</div>
          <ul className="flex flex-col gap-0.5 mt-0.5">
            {c.assumptions.map((a) => (
              <li key={a.key} data-assumption={a.key}>
                <span className="text-white">{a.statement}</span> <span className="text-white/50">[{a.affects.join(', ')}]</span>
                <div className="text-white/60">{a.rationale}</div>
                <div className="font-mono text-white/50">refs: <Refs refs={a.references} /></div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details data-field="inputs" open={!compact}>
        <summary className="cursor-pointer text-white/70">Prerequisites, barriers and dependencies ({c.inputs.length}) — holistic, not a count</summary>
        <ul className="flex flex-col gap-0.5 mt-0.5">
          {c.inputs.map((i) => (
            <li key={i.key} data-input={i.key} data-input-kind={i.kind} data-basis={i.basis_kind}>
              <span className="font-mono text-white/50">{i.kind} · {BASIS_LABEL[i.basis_kind]}{i.controls_state ? ` · controls ${i.controls_state.replace(/_/g, ' ')}` : ''}{i.could_change_band ? ' · could change band' : ''}</span>
              <div className="text-white">{i.statement}</div>
              <div className="text-white/60">{i.rationale}</div>
              {i.bounding_rationale && <div className="text-white/60">bounding: {i.bounding_rationale}</div>}
              <div className="font-mono text-white/50">refs: <Refs refs={i.references} /></div>
            </li>
          ))}
        </ul>
      </details>

      {c.unknowns.length > 0 && (
        <details data-field="unknowns" open={!compact}>
          <summary className="cursor-pointer text-[#FFB74D]">Unknowns and evidence needed ({c.unknowns.length}; {c.unknowns.filter((u) => u.pivotal).length} pivotal)</summary>
          <ul className="flex flex-col gap-0.5 mt-0.5">
            {c.unknowns.map((u) => (
              <li key={u.key} data-unknown={u.key} data-pivotal={u.pivotal}>
                <span className="text-white">{u.statement}</span>{u.pivotal && <span className="font-mono text-[#FFB74D]"> · pivotal</span>}
                <div className="text-white/60">needed: {u.evidence_needed}</div>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div data-field="resilience" className="text-white/60">
        <span className="text-white/40">Resilience:</span> known buffers {c.resilience.known_buffers.length ? c.resilience.known_buffers.join('; ') : 'none documented'} ·
        fallback unknown: {c.resilience.unknown_fallback.length ? c.resilience.unknown_fallback.join('; ') : 'none listed'} ·
        recovery conditions: {c.resilience.recovery_conditions.length ? c.resilience.recovery_conditions.join('; ') : 'not published'}
        {c.resilience.reducers.length > 0 && <> · reducers: {c.resilience.reducers.join('; ')}</>}
      </div>
      {c.countercase.length > 0 && (
        <div data-field="countercase" className="text-white/60"><span className="text-white/40">Countercase:</span> {c.countercase.join(' ')}</div>
      )}
      <div data-field="catalog-refs" className="font-mono text-white/50">
        catalog: {c.catalog_refs.map((r) => `${r.scenario_id} (${r.relation})`).join(', ')}
        {c.related_cases.length > 0 && <> · related cases: {c.related_cases.join(', ')}</>}
        {c.legacy_refs.length > 0 && <> · legacy provenance refs: {c.legacy_refs.join(', ')}</>}
      </div>
      <div data-field="highlight" className="font-mono text-white/50 flex flex-wrap items-center gap-2">
        <span>
          map references: {c.highlight.entity_ids.length} entit{c.highlight.entity_ids.length === 1 ? 'y' : 'ies'}, {c.highlight.edge_ids.length} connection{c.highlight.edge_ids.length === 1 ? '' : 's'}
          {mapHighlight ? (geographyDrawn ? ' — emphasised on the map (published anchors/links only; nothing added)' : ' — nothing drawn: geography not available') : ''}
        </span>
        {onClearHighlight && (
          <button type="button" data-action="clear-highlight" onClick={onClearHighlight} className="rounded border border-white/20 px-1.5 py-0.5 text-white/70 hover:bg-white/10">Clear highlight</button>
        )}
      </div>
      <div className="font-mono text-white/40">case {c.case_id} v{c.version} · assumption set {c.assumption_set_sha256.slice(0, 12)}…</div>
    </div>
  );
}

function CaseCard({ c, open, compact, geographyDrawn, mapHighlight, onToggle, onClearHighlight }: {
  c: UwCase; open: boolean; compact: boolean; geographyDrawn: boolean; mapHighlight: boolean; onToggle: () => void; onClearHighlight?: () => void;
}) {
  return (
    <li data-case={c.case_id} data-category={c.category} data-case-kind={c.case_kind} data-both-scored={c.both_scored} data-selected={open}
      className={`rounded border p-2 flex flex-col ${open ? 'border-[#B388FF]/70 bg-white/[0.03]' : 'border-white/[0.1]'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-pressed={open} className="text-left flex flex-col gap-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#B388FF]">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-[10px] font-bold text-white">{c.category}<span className="font-normal text-white/50"> {CATEGORY_LABEL[c.category]}{c.secondary_category ? ` (+${c.secondary_category})` : ''}</span></span>
          <span data-field="case-kind" title={CASE_KIND_LABEL[c.case_kind]} className={`font-mono text-[9px] rounded border px-1 ${KIND_STYLE[c.case_kind]}`}>{c.case_kind.replace('_', '-')}</span>
          <span className="font-mono text-[9px] text-white/50">{APPLICABILITY_LABEL[c.applicability.state]}</span>
        </div>
        <span className="text-[10px] text-white">{c.title}</span>
        <span className="font-mono text-[9px] flex flex-wrap gap-x-3">
          <span data-field="difficulty" data-scored={c.difficulty.low !== null}>difficulty <span className="text-white">{formatScore(c.difficulty.low, c.difficulty.high)}</span> · {c.difficulty.confidence}{c.difficulty.low === null ? ` (${formatNullReason(c.difficulty.null_reason)})` : ''}</span>
          <span data-field="magnitude" data-scored={c.magnitude.low !== null}>magnitude <span className="text-white">{formatScore(c.magnitude.low, c.magnitude.high)}</span> · {c.magnitude.confidence}{c.magnitude.low === null ? ` (${formatNullReason(c.magnitude.null_reason)})` : ''}</span>
        </span>
        {c.magnitude.low !== null && (
          <span data-field="magnitude-summary" className="font-mono text-[9px] text-white/90">
            {magnitudeSummary(c.magnitude)} · {c.magnitude.confidence} confidence · hypothetical, not observed
          </span>
        )}
        {c.assumptions.length > 0 && !open && (
          <span className="font-mono text-[9px] text-[#B388FF]/80">{c.assumptions.length} reviewed stress assumption{c.assumptions.length === 1 ? '' : 's'} — assumed, not observed</span>
        )}
      </button>
      {open && <CaseDetail c={c} compact={compact} geographyDrawn={geographyDrawn} mapHighlight={mapHighlight} onClearHighlight={onClearHighlight} />}
    </li>
  );
}

// ---------------------------------------------------------------------------
// view
// ---------------------------------------------------------------------------

export function UnderwritingView({ feed, resolved, compact = false, onHighlight, geographyDrawn = false }: UnderwritingViewProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const { view, body, publication: pub } = resolved;
  const style = STATE_STYLE[view];
  const reasonText = describeUwReason(feed.fetchError ?? body?.reason);

  // Highlight follows the open case while a publication is shown; anything else clears it.
  // Unmount (toggle off, dossier change) clears too, so no emphasis outlives its case.
  const hlCase = pub && highlightId ? pub.cases.find((c) => c.case_id === highlightId) ?? null : null;
  useEffect(() => {
    if (!onHighlight) return;
    onHighlight(hlCase ? hlCase.highlight : null);
  }, [onHighlight, hlCase]);
  useEffect(() => () => { onHighlight?.(null); }, [onHighlight]);

  const toggle = (id: string) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    setHighlightId(next);
  };
  const clearHighlight = () => setHighlightId(null);

  return (
    <div data-uw-view={view} className={`flex flex-col gap-2 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
      <div data-uw-state={view} className={`rounded border px-2 py-1.5 font-mono flex flex-wrap items-center gap-x-3 gap-y-1 bg-white/[0.02] ${style.cls}`}>
        <span className="font-bold tracking-widest text-[10px]">{style.label}</span>
        {view === 'loading' && <span className="text-white/50">Contacting the Fusion sidecar…</span>}
        {(view === 'not_published' || view === 'withdrawn' || view === 'unavailable') && (
          <span className="text-[10px]">
            {reasonText ?? 'No cases are shown.'}{' '}
            <span className="text-white/40">No case detail or map highlight is served from history. (reason code: {feed.fetchError ?? body?.reason ?? 'unknown'})</span>
          </span>
        )}
        {view === 'stale' && <span className="text-[10px]">{reasonText ?? body?.reason} — last published portfolio for the same dossier publication; not fresh.</span>}
        {view === 'available' && <span className="text-white/50 text-[10px]">Checked {formatUwTimestamp(body?.checked_at)}</span>}
      </div>

      <p data-banner="hypothetical" role="note" className="font-mono text-[9px] text-[#B388FF]/90">
        {pub?.hypothetical_label ?? 'Hypothetical functional-disruption cases for continuity underwriting; not alerts, observed incidents, forecasts or probabilities.'}{' '}
        <span className="text-white/50">Two independent judgments per case — materialization difficulty and conditional magnitude — each numeric or explicitly N/A. No probability, expected loss, imminence or combined risk is published.</span>
      </p>

      {pub && body?.ddd && (
        <>
          <div data-section="uw-binding" className="grid grid-cols-2 gap-1 font-mono text-[9px] text-white/50">
            <span>case publication {pub.publication_no} · {formatUwTimestamp(pub.created_at)}</span>
            <span>bound to dossier publication {pub.ddd.publication_no} · sha256 {pub.ddd.publication_sha256.slice(0, 12)}…</span>
            <span>evidence cutoff {formatUwTimestamp(pub.ddd.evidence_cutoff)} ({pub.ddd.evidence_cutoff_basis.replace(/_/g, ' ')})</span>
            <span>policy {pub.policy.policy_version} · brief {pub.policy.brief_v1_sha256.slice(0, 12)}… · rubric {pub.policy.rubric_sha256.slice(0, 12)}…</span>
          </div>

          <div data-section="uw-summary" className="rounded border border-white/[0.08] p-2 font-mono text-[10px] flex flex-wrap gap-x-4 gap-y-1">
            <span>{pub.summary.cases_published} case{pub.summary.cases_published === 1 ? '' : 's'} published</span>
            <span className="text-white/60">difficulty scored {pub.summary.difficulty_scored}</span>
            <span className="text-white/60">magnitude scored {pub.summary.magnitude_scored}</span>
            <span className="text-white/60">both {pub.summary.both_scored}</span>
            <span className="text-[#B388FF]">assumption-led {pub.summary.assumption_led}</span>
            <span className="text-white/50">evidence-limited {pub.summary.evidence_limited}</span>
            <span className="text-white/50">evidence-supported {pub.summary.evidence_supported}</span>
            {pub.summary.not_published > 0 && <span className="text-[#FFB74D]">{pub.summary.not_published} pending / not published</span>}
            <span className="text-white/50 ml-auto">catalog coverage {pub.summary.coverage_entries}/32</span>
          </div>

          <DualAxisChart pub={pub} selectedId={openId} onSelect={toggle} />

          <p data-banner="ordering" className="font-mono text-[9px] text-white/40">{pub.ordering.note}</p>

          <ul data-section="uw-cases" className="flex flex-col gap-1.5" aria-label="Underwriting cases">
            {pub.cases.map((c) => (
              <CaseCard key={c.case_id} c={c} open={openId === c.case_id} compact={compact} geographyDrawn={geographyDrawn}
                mapHighlight={!!onHighlight && highlightId === c.case_id} onToggle={() => toggle(c.case_id)}
                onClearHighlight={onHighlight && highlightId === c.case_id ? clearHighlight : undefined} />
            ))}
          </ul>

          {pub.not_published.length > 0 && (
            <div data-section="uw-not-published" className="rounded border border-[#FFB74D]/40 p-2 font-mono text-[9px] text-[#FFB74D]">
              Not published ({pub.not_published.length}): {pub.not_published.map((n) => `${n.case_id} (${n.review_state})`).join(', ')} — no content is shown for a case without an accepted publication.
            </div>
          )}

          {pub.shared_dependency_groups.length > 0 && (
            <div data-section="uw-shared" className="rounded border border-white/[0.08] p-2 flex flex-col gap-1">
              <div className="font-mono text-[10px] text-white/70">Shared reviewed functional dependencies ({pub.shared_dependency_groups.length}) — disclosed, never summed</div>
              {pub.shared_dependency_groups.map((g, i) => (
                <div key={i} data-shared-group={i} data-basis={g.basis} data-aggregation={g.aggregation} className="text-[9px] text-white/60">
                  <span className="font-mono text-white/80">{g.refs.join(', ')}</span> → cases {g.case_ids.map((id) => pub.cases.find((c) => c.case_id === id)?.category ?? id).join(', ')} ({g.case_ids.length}). {g.note}
                </div>
              ))}
            </div>
          )}

          <details data-section="uw-coverage" className="rounded border border-white/[0.08] p-2">
            <summary className="cursor-pointer text-white/70 text-[10px]">Catalog coverage — all {pub.coverage.length} scenarios (S32 is a recovery/resilience modifier, never a case)</summary>
            <ul className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-0.5 font-mono text-[9px] text-white/60">
              {pub.coverage.map((e) => (
                <li key={e.scenario_id} data-coverage={e.scenario_id} data-disposition={e.disposition}>
                  {e.scenario_id} {e.disposition.replace(/_/g, ' ')}{e.case_ids.length ? ` → ${e.case_ids.map((id) => pub.cases.find((c) => c.case_id === id)?.category ?? id).join(', ')}` : ''}
                  {!compact && <span className="text-white/40"> — {e.reason}</span>}
                </li>
              ))}
            </ul>
          </details>

          {pub.what_changed.length > 0 && (
            <details data-section="uw-changes" className="rounded border border-white/[0.08] p-2">
              <summary className="cursor-pointer text-white/70 text-[10px]">What changed in publication {pub.publication_no}</summary>
              <ul className="mt-1 list-disc pl-4 text-[9px] text-white/60">{pub.what_changed.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
