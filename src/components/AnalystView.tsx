'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AN_NOT_ADDITIVE_NOTE,
  AN_TAXONOMY,
  analystCardAnchor,
  analystReportPath,
  baselineCase,
  describeAnReason,
  dispositionsForCard,
  formatAnTimestamp,
  sourceById,
  stressCases,
  stressKey,
  DISPOSITION_LABEL,
  HYPOTHESIS_CLASS_LABEL,
  type AnCard,
  type AnCondition,
  type AnFeedState,
  type AnMagnitudeCase,
  type AnPassage,
  type AnPublication,
  type AnSource,
  type AnViewState,
  type ResolvedAn,
} from '@/lib/analyst';

/**
 * E7 analyst supplement: the default-visible "pyramid" for a selected dossier.
 *
 *   apex   — one takeaway passage (served text, cited sources)
 *   middle — exactly the published narrative cards, collapsed by default; each header already shows
 *            the qualitative conditions and every magnitude case label ("Conditional magnitude 3,
 *            assuming major impairment for 7 days") beside its score, plus the null evidence baseline
 *   base   — thirteen-family taxonomy dispositions, the source verification/rights register, gaps
 *            and the audit block (DDD binding, policy hashes, attribution)
 *
 * Everything rendered is served text from the reader's public projection; nothing here scores,
 * sums, ranks or invents wording. A stress case can be selected (to read its assumption beside the
 * card) and reset; selection never changes any number.
 */

const STATE_STYLE: Record<AnViewState, { label: string; cls: string }> = {
  loading: { label: 'LOADING', cls: 'text-white/50 border-white/20' },
  available: { label: 'ANALYST SUPPLEMENT AVAILABLE', cls: 'text-white border-white/40' },
  stale: { label: 'ANALYST SUPPLEMENT STALE', cls: 'text-[#FFB74D] border-[#FFB74D]/50' },
  not_published: { label: 'NO ANALYST SUPPLEMENT PUBLISHED', cls: 'text-white/60 border-white/20' },
  withdrawn: { label: 'ANALYST SUPPLEMENT WITHDRAWN', cls: 'text-[#FF5722] border-[#FF5722]/50' },
  unavailable: { label: 'ANALYST SUPPLEMENT UNAVAILABLE', cls: 'text-[#FF5722] border-[#FF5722]/50' },
};

const CONDITION_STYLE: Record<AnCondition['state'], string> = {
  observed: 'border-white/50 text-white',
  inferred: 'border-[#4FC3F7]/60 text-[#4FC3F7]',
  assumed: 'border-[#B388FF]/60 text-[#B388FF]',
  unknown: 'border-[#FFB74D]/60 text-[#FFB74D]',
};

const CLASS_STYLE: Record<AnCard['hypothesis_class'], string> = {
  contextual_continuity: 'border-white/40 text-white/80',
  lawful_institutional: 'border-[#4FC3F7]/60 text-[#4FC3F7]',
  covert_or_criminal_conditional: 'border-[#B388FF]/60 text-[#B388FF]',
};

const DISPOSITION_STYLE: Record<string, string> = {
  supported_local: 'text-white',
  conditional_hypothesis: 'text-[#B388FF]',
  research_gap: 'text-[#FFB74D]',
  not_applicable: 'text-white/40',
};

export interface AnalystViewProps {
  dossierId: string;
  feed: AnFeedState;
  resolved: ResolvedAn;
  /** Compact layout for the map-side drawer; the full report uses the default. */
  compact?: boolean;
  /** Drawer: link each card to its anchor on the full report. Report: omitted (anchors are local). */
  linkToReport?: boolean;
}

// ---------------------------------------------------------------------------
// small pieces
// ---------------------------------------------------------------------------

function Cites({ ids, pub, report }: { ids: string[]; pub: AnPublication; report: string | null }) {
  if (ids.length === 0) return <span className="text-white/35">no source cited</span>;
  return (
    <span data-field="cites" className="font-mono">
      {ids.map((id, i) => {
        const s = sourceById(pub, id);
        const label = `${id}${s ? ` · ${s.verification.replace(/_/g, ' ')}` : ''}`;
        const href = report ? `${report}#analyst-source-${id}` : `#analyst-source-${id}`;
        return (
          <span key={id}>
            {i > 0 && ', '}
            <a href={href} data-source-ref={id} className="text-[var(--cyan-primary)] underline underline-offset-2">{label}</a>
          </span>
        );
      })}
    </span>
  );
}

function Passage({ label, p, pub, report, field }: { label: string; p: AnPassage; pub: AnPublication; report: string | null; field: string }) {
  return (
    <p data-field={field}>
      <span className="text-white/40">{label}: </span>
      <span className="text-white/85">{p.text}</span>{' '}
      <span className="text-[9px]"><Cites ids={p.source_ids} pub={pub} report={report} /></span>
    </p>
  );
}

function ConditionChips({ conditions }: { conditions: AnCondition[] }) {
  return (
    <ul data-field="conditions" aria-label="Qualitative enabling conditions" className="flex flex-col gap-0.5">
      {conditions.map((c, i) => (
        <li key={i} data-condition-state={c.state} data-condition-frame={c.frame} className="flex items-start gap-1.5 text-[9px]">
          <span className={`shrink-0 rounded border px-1 font-mono ${CONDITION_STYLE[c.state]}`}>{c.label}</span>
          <span className="text-white/75">{c.text}</span>
        </li>
      ))}
    </ul>
  );
}

function MagnitudeLine({ c, cardId, index, selected, onSelect }: {
  c: AnMagnitudeCase; cardId: string; index: number; selected: boolean; onSelect: ((k: string) => void) | null;
}) {
  const key = stressKey(cardId, index);
  const scored = c.low !== null && c.high !== null;
  const score = scored ? (c.low === c.high ? `${c.low}` : `${c.low}–${c.high}`) : 'N/A';
  const body = (
    <>
      <span data-field="score" className={`font-mono font-bold ${scored ? 'text-white' : 'text-white/50'}`}>{score}</span>
      <span data-field="magnitude-display" className={`font-mono ${scored ? 'text-white/90' : 'text-white/60'}`}>{c.display}</span>
      {c.score_label && <span className="font-mono text-white/45">· {c.score_label}</span>}
      {c.kind === 'stress_assumption' && <span className="font-mono text-[#B388FF]/80">· assumed, not observed</span>}
    </>
  );
  return (
    <li data-magnitude-case={key} data-case-kind={c.kind} data-selected={selected} className={`flex flex-wrap items-baseline gap-x-2 text-[9px] rounded px-1 ${selected ? 'bg-[#B388FF]/15 ring-1 ring-[#B388FF]/60' : ''}`}>
      {c.kind === 'stress_assumption' && onSelect ? (
        <button type="button" data-action="select-stress" aria-pressed={selected} onClick={() => onSelect(key)} className="flex flex-wrap items-baseline gap-x-2 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[#B388FF]">
          {body}
        </button>
      ) : body}
    </li>
  );
}

// ---------------------------------------------------------------------------
// card
// ---------------------------------------------------------------------------

function CardDetail({ card, pub, report, compact }: { card: AnCard; pub: AnPublication; report: string | null; compact: boolean }) {
  const disp = dispositionsForCard(pub, card.card_id);
  const cited = card.source_ids.map((id) => sourceById(pub, id)).filter((s): s is AnSource => s !== null);
  return (
    <div data-card-detail={card.card_id} className="mt-1.5 flex flex-col gap-1.5 text-[9px] text-white/70 border-t border-white/10 pt-1.5">
      <p data-field="boundary"><span className="text-white/40">Boundary: </span>{card.boundary}</p>
      <Passage label="Mechanism" p={card.mechanism} pub={pub} report={report} field="mechanism" />
      <Passage label="Local anchor" p={card.local_anchor} pub={pub} report={report} field="local-anchor" />
      <Passage label="Location context" p={card.location_context} pub={pub} report={report} field="location-context" />
      <Passage label="Actor context" p={card.actor_context} pub={pub} report={report} field="actor-context" />
      <Passage label="Historical basis (analogy)" p={card.historical_basis} pub={pub} report={report} field="historical-basis" />
      <Passage label="Transfer limit" p={card.transfer_limit} pub={pub} report={report} field="transfer-limit" />

      {card.sequence.length > 0 && (
        <div data-field="sequence">
          <div className="text-white/40">Sequence (onset only, no procedure):</div>
          <ol className="list-decimal pl-4 text-white/75">{card.sequence.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      )}
      {card.branches.length > 0 && (
        <div data-field="branches">
          <div className="text-white/40">Consequence branches (alternatives, never summed):</div>
          <ul className="list-disc pl-4 text-white/75">{card.branches.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {card.assumptions.length > 0 && (
        <div data-field="assumptions" className="rounded border border-[#B388FF]/40 p-1.5">
          <div className="font-mono text-[#B388FF]">Stress assumptions ({card.assumptions.length}) — assumed, not observed</div>
          <ul className="list-disc pl-4 text-white/80">{card.assumptions.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      <Passage label="Countercase" p={card.countercase} pub={pub} report={report} field="countercase" />
      <Passage label="Decisive gap" p={card.decisive_gap} pub={pub} report={report} field="decisive-gap" />

      <div data-field="confidence" className="font-mono text-white/55">
        applicability — local {card.applicability_confidence.local} · analogue {card.applicability_confidence.analogue} · magnitude confidence {card.magnitude_confidence}
        {card.modifiers.length > 0 && <> · modifiers {card.modifiers.join(', ')}</>}
      </div>

      <div data-field="card-taxonomy" className="font-mono text-white/55">
        taxonomy: {disp.length === 0 ? 'no family assigned' : disp.map((d) => `${d.family_id} ${d.label} (${DISPOSITION_LABEL[d.disposition]})`).join('; ')}
      </div>

      <details data-field="card-sources" open={!compact}>
        <summary className="cursor-pointer text-white/70">Sources cited by this card ({cited.length}) — verification and rights</summary>
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {cited.map((s) => (
            <li key={s.source_id} data-card-source={s.source_id} className="font-mono text-white/60">
              <a href={s.url} target="_blank" rel="noopener noreferrer" data-source-url={s.source_id} className="text-[var(--cyan-primary)] underline underline-offset-2">{s.source_id}</a>
              {' '}· {s.role.replace(/_/g, ' ')} · {s.applicability.replace(/_/g, ' ')} · {s.verification.replace(/_/g, ' ')} · {s.rights_class.replace(/_/g, ' ')}
              {s.document_date ? ` · ${s.document_date}` : ' · undated'}
            </li>
          ))}
        </ul>
      </details>

      {card.legacy_relations.length > 0 && (
        <div data-field="legacy-relations" className="font-mono text-white/50">
          legacy relations: {card.legacy_relations.map((r) => `${r.record} ${r.record_id} (${r.relation.replace(/_/g, ' ')}): ${r.reason}`).join('; ')}
        </div>
      )}
      <p data-field="not-additive" className="font-mono text-white/45">{card.not_additive_note}</p>
      {report && (
        <Link href={`${report}#${analystCardAnchor(card.card_id)}`} data-link="report-anchor" className="font-mono text-[var(--cyan-primary)] underline underline-offset-2">
          Open {card.card_id} in the full report →
        </Link>
      )}
    </div>
  );
}

function AnalystCard({ card, pub, open, compact, report, selectedStress, onToggle, onSelectStress }: {
  card: AnCard; pub: AnPublication; open: boolean; compact: boolean; report: string | null;
  selectedStress: string | null; onToggle: () => void; onSelectStress: (k: string) => void;
}) {
  const baseline = baselineCase(card);
  const stresses = stressCases(card);
  return (
    <li id={analystCardAnchor(card.card_id)} data-analyst-card={card.card_id} data-hypothesis-class={card.hypothesis_class} data-overlap-group={card.overlap_group} data-expanded={open}
      className={`rounded border p-2 flex flex-col scroll-mt-4 ${open ? 'border-[#B388FF]/70 bg-white/[0.03]' : 'border-white/[0.1]'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} data-action="toggle-card" className="text-left flex flex-col gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#B388FF]">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-[10px] font-bold text-white">{card.card_id}</span>
          <span className={`font-mono text-[9px] rounded border px-1 ${CLASS_STYLE[card.hypothesis_class]}`}>{HYPOTHESIS_CLASS_LABEL[card.hypothesis_class]}</span>
          <span className="font-mono text-[9px] text-white/45">{card.overlap_group.replace(/_/g, ' ')}</span>
          {card.taxonomy.length > 0 && <span className="font-mono text-[9px] text-white/45">{card.taxonomy.map((t) => t.id).join(' ')}</span>}
        </div>
        <span data-field="title" className="text-[10px] text-white">{card.title}</span>
        <span data-field="summary" className="text-[9px] text-white/70">{card.summary.text}</span>
      </button>

      <div className="mt-1 flex flex-col gap-1">
        <ConditionChips conditions={card.conditions} />
        <ul data-field="magnitude-cases" aria-label="Magnitude cases" className="flex flex-col gap-0.5">
          <MagnitudeLine c={baseline} cardId={card.card_id} index={0} selected={false} onSelect={null} />
          {stresses.map((c, i) => (
            <MagnitudeLine key={i + 1} c={c} cardId={card.card_id} index={i + 1} selected={selectedStress === stressKey(card.card_id, i + 1)} onSelect={onSelectStress} />
          ))}
        </ul>
        {selectedStress && stresses.some((_, i) => selectedStress === stressKey(card.card_id, i + 1)) && (
          <p data-field="selected-stress" className="text-[9px] text-[#B388FF]/90 font-mono">
            {stresses[Number(selectedStress.split(':')[1]) - 1]?.assumption_note} Selecting a case reads its assumption; it changes no score and adds nothing to other cards.
          </p>
        )}
      </div>

      <button type="button" onClick={onToggle} aria-expanded={open} data-action="expand-card" className="mt-1 self-start font-mono text-[9px] text-[var(--cyan-primary)] underline underline-offset-2">
        {open ? 'Hide mechanism, evidence and analogy' : 'Show mechanism, evidence and analogy'}
      </button>
      {open && <CardDetail card={card} pub={pub} report={report} compact={compact} />}
    </li>
  );
}

// ---------------------------------------------------------------------------
// base blocks
// ---------------------------------------------------------------------------

function Taxonomy({ pub, compact }: { pub: AnPublication; compact: boolean }) {
  return (
    <details data-section="analyst-taxonomy" open={!compact} className="rounded border border-white/[0.08] p-2">
      <summary className="cursor-pointer text-white/70 text-[10px]">
        Threat-vector families — {pub.dispositions.length}/{pub.policy.family_ids.length} dispositions ({AN_TAXONOMY.id} {AN_TAXONOMY.version}, {AN_TAXONOMY.status.replace(/_/g, ' ')})
      </summary>
      <ul className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-0.5 font-mono text-[9px] text-white/60">
        {pub.dispositions.map((d) => (
          <li key={d.family_id} data-family={d.family_id} data-disposition={d.disposition}>
            {d.family_id} <span className="text-white/80">{d.label}</span> · <span className={DISPOSITION_STYLE[d.disposition]}>{DISPOSITION_LABEL[d.disposition]}</span>
            {d.card_ids.length > 0 && <> → {d.card_ids.join(', ')}</>}
            {!compact && <span className="text-white/40"> — {d.reason}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function SourceRegister({ pub, compact }: { pub: AnPublication; compact: boolean }) {
  return (
    <details data-section="analyst-sources" open={!compact} className="rounded border border-white/[0.08] p-2">
      <summary className="cursor-pointer text-white/70 text-[10px]">
        Source register — {pub.sources.length} admitted ({pub.summary.sources_cited} cited); verification and rights per source
      </summary>
      <ul className="mt-1 flex flex-col gap-1 text-[9px]">
        {pub.sources.map((s) => (
          <li key={s.source_id} id={`analyst-source-${s.source_id}`} data-source={s.source_id} data-verification={s.verification} data-rights={s.rights_class} className="rounded border border-white/[0.06] p-1.5 scroll-mt-4">
            <div className="font-mono text-white flex flex-wrap gap-x-2">
              <a href={s.url} target="_blank" rel="noopener noreferrer" data-source-url={s.source_id} className="text-[var(--cyan-primary)] underline underline-offset-2">{s.source_id}</a>
              <span className="text-white/50">{s.role.replace(/_/g, ' ')} · {s.applicability.replace(/_/g, ' ')}</span>
              <span className="text-white/80">{s.verification.replace(/_/g, ' ')}</span>
              <span className="text-white/80">{s.rights_class.replace(/_/g, ' ')}</span>
              <span className="text-white/50">{s.document_date ? `${s.document_date} (${s.date_precision})` : 'document date not established'}</span>
            </div>
            <div className="text-white/60">locator: {s.locator}</div>
            <div className="text-white/75">supports: {s.claim_supported}</div>
            {s.paraphrase && <div className="text-white/60">reviewed paraphrase: {s.paraphrase}</div>}
            {s.does_not_support.length > 0 && <div className="text-[#FFB74D]/80">does not support: {s.does_not_support.join('; ')}</div>}
            {s.transfer_limit && <div className="text-white/50">transfer limit: {s.transfer_limit}</div>}
          </li>
        ))}
      </ul>
      <p className="mt-1 font-mono text-[9px] text-white/40">A URL alone is not verification; every listed source carries a reviewed verification class and an admissible rights class or it would not be served.</p>
    </details>
  );
}

function Audit({ pub, checkedAt }: { pub: AnPublication; checkedAt: string | undefined }) {
  return (
    <details data-section="analyst-audit" className="rounded border border-white/[0.08] p-2 font-mono text-[9px] text-white/55">
      <summary className="cursor-pointer text-white/70 text-[10px]">Audit — binding, policy pins and attribution</summary>
      <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
        <span>analyst publication {pub.publication_no} · candidate v{pub.candidate_version} · {formatAnTimestamp(pub.created_at)}</span>
        <span>bound to dossier publication {pub.ddd.publication_no} · sha256 {pub.ddd.publication_sha256.slice(0, 16)}…</span>
        <span>evidence cutoff {formatAnTimestamp(pub.ddd.evidence_cutoff)} ({pub.ddd.evidence_cutoff_basis.replace(/_/g, ' ')})</span>
        <span>policy {pub.policy.policy_version} · brief {pub.policy.brief_v1_sha256.slice(0, 12)}… · rubric {pub.policy.rubric_sha256.slice(0, 12)}… · taxonomy {pub.policy.taxonomy_sha256.slice(0, 12)}…</span>
        <span>preview cards {pub.policy.preview_cards_sha256.slice(0, 12)}… · catalog {pub.policy.preview_catalog_sha256.slice(0, 12)}… · planning {pub.policy.planning_commit.slice(0, 12)}</span>
        <span>author {pub.attribution.author.type} {pub.attribution.author.id} · reviewers {pub.attribution.reviewers.map((r) => `${r.type} ${r.id}`).join(', ')}</span>
        <span>origin {pub.origin}{pub.attribution.fixture ? ' (isolated conformance fixture)' : ''} · checked {formatAnTimestamp(checkedAt)}</span>
      </div>
      {pub.what_changed.length > 0 && <ul className="mt-1 list-disc pl-4">{pub.what_changed.map((s, i) => <li key={i}>{s}</li>)}</ul>}
    </details>
  );
}

// ---------------------------------------------------------------------------
// view
// ---------------------------------------------------------------------------

export function AnalystView({ dossierId, feed, resolved, compact = false, linkToReport = false }: AnalystViewProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedStress, setSelectedStress] = useState<string | null>(null);
  const { view, body, publication: pub } = resolved;
  const style = STATE_STYLE[view];
  const reasonCode = feed.fetchError ?? body?.reason ?? null;
  const reasonText = describeAnReason(reasonCode);
  const report = linkToReport ? analystReportPath(dossierId) : null;

  return (
    <div data-analyst-view={view} data-dossier-id={dossierId} className={`flex flex-col gap-2 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
      <div data-analyst-state={view} className={`rounded border px-2 py-1.5 font-mono flex flex-wrap items-center gap-x-3 gap-y-1 bg-white/[0.02] ${style.cls}`}>
        <span className="font-bold tracking-widest text-[10px]">{style.label}</span>
        {view === 'loading' && <span className="text-white/50">Contacting the Fusion sidecar…</span>}
        {(view === 'not_published' || view === 'withdrawn' || view === 'unavailable') && (
          <span className="text-[10px]">
            {reasonText ?? 'No analyst content is shown.'}{' '}
            <span className="text-white/40">No card, condition or score is served from history. (reason code: {reasonCode ?? 'unknown'})</span>
          </span>
        )}
        {view === 'stale' && <span className="text-[10px]">{reasonText ?? body?.reason} — last published supplement for the same dossier publication; not fresh.</span>}
        {view === 'available' && <span className="text-white/50 text-[10px]">Checked {formatAnTimestamp(body?.checked_at)}</span>}
      </div>

      <p data-banner="analyst-hypothetical" role="note" className="font-mono text-[9px] text-[#B388FF]/90">
        {pub?.hypothetical_label ?? 'Analyst continuity narratives: contextual or conditional hypotheses with qualitative enabling conditions. Not an alert, observed incident, forecast or probability.'}{' '}
        <span className="text-white/50">No attack-ease axis, target list, sensitive component or attack procedure is published; magnitude is a matrix range under a stated extent and duration assumption or explicitly unbounded.</span>
      </p>

      {pub && pub.origin === 'fixture' && (
        <p data-banner="analyst-fixture" role="note" className="rounded border border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/10 px-2 py-1 font-mono text-[9px] text-[var(--gold-primary)]">
          ISOLATED CONFORMANCE FIXTURE — synthetic reader-conformance content served from a fixture store; not admitted operational analysis.
        </p>
      )}

      {pub && (
        <>
          <section data-section="analyst-apex" aria-label="Takeaway" className="rounded border border-white/[0.12] bg-white/[0.02] p-2 flex flex-col gap-1">
            <div className="font-mono text-[9px] tracking-[0.15em] text-white/50">TAKEAWAY</div>
            <p data-field="takeaway" className="text-white/90">{pub.takeaway.text}</p>
            <span className="text-[9px]"><Cites ids={pub.takeaway.source_ids} pub={pub} report={report} /></span>
            <p data-field="chain-context" className="text-[9px] text-white/60">{pub.chain_context.text} <Cites ids={pub.chain_context.source_ids} pub={pub} report={report} /></p>
          </section>

          <div data-section="analyst-summary" className="font-mono text-[9px] text-white/50 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>{pub.summary.cards} narrative card{pub.summary.cards === 1 ? '' : 's'}</span>
            <span>{pub.summary.families} families</span>
            <span className="text-[#B388FF]">{pub.summary.by_disposition.conditional_hypothesis} conditional</span>
            <span className="text-[#FFB74D]">{pub.summary.by_disposition.research_gap} research gaps</span>
            <span>{pub.summary.by_disposition.supported_local} supported local</span>
            <span>{pub.summary.by_disposition.not_applicable} not applicable</span>
            <span>{pub.summary.stress_cases} assumed stress cases</span>
            {selectedStress && (
              <button type="button" data-action="reset-stress" onClick={() => setSelectedStress(null)} className="ml-auto rounded border border-[#B388FF]/50 px-1.5 text-[#B388FF] hover:bg-[#B388FF]/10">Reset stress selection</button>
            )}
          </div>

          <ul data-section="analyst-cards" aria-label="Analyst narrative cards" className="flex flex-col gap-1.5">
            {pub.cards.map((c) => (
              <AnalystCard key={c.card_id} card={c} pub={pub} open={openId === c.card_id} compact={compact} report={report}
                selectedStress={selectedStress} onToggle={() => setOpenId(openId === c.card_id ? null : c.card_id)}
                onSelectStress={(k) => setSelectedStress(selectedStress === k ? null : k)} />
            ))}
          </ul>
          <p data-banner="not-additive" className="font-mono text-[9px] text-white/40">{AN_NOT_ADDITIVE_NOTE}</p>

          <Taxonomy pub={pub} compact={compact} />
          <SourceRegister pub={pub} compact={compact} />

          {pub.gaps.length > 0 && (
            <details data-section="analyst-gaps" open={!compact} className="rounded border border-[#FFB74D]/40 p-2">
              <summary className="cursor-pointer text-[#FFB74D] text-[10px]">Declared gaps ({pub.gaps.length})</summary>
              <ul className="mt-1 flex flex-col gap-0.5 text-[9px] text-white/70">
                {pub.gaps.map((g, i) => <li key={i} data-gap={i}>{g.text} <Cites ids={g.source_ids} pub={pub} report={report} /></li>)}
              </ul>
            </details>
          )}

          <Audit pub={pub} checkedAt={body?.checked_at} />
        </>
      )}
    </div>
  );
}
