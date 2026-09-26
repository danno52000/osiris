import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { analystRegistryEntry } from '@/lib/analyst';
import { isDossierListed } from '@/lib/dossier-registry';
import AnalystReportClient from './AnalystReportClient';

/**
 * Full-page E7 analyst report for one registered dossier id. Ids outside the finite registry
 * are a 404 before anything is fetched; reserved ids render the page and show the sidecar's
 * `dossier_not_enabled` state (never Las Bambas content). The legacy Las Bambas dossier page
 * keeps its static segment.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ dossierId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { dossierId } = await params;
  const entry = analystRegistryEntry(dossierId);
  const title = entry ? `Analyst report — ${entry.title}` : 'Analyst report';
  return {
    title,
    description:
      'Read-only GIDEON analyst supplement: continuity narratives with qualitative enabling conditions, matrix-derived conditional magnitude under stated assumptions, thirteen-family dispositions and a verified source register bound to the exact dossier publication.',
    robots: { index: false, follow: false },
  };
}

export default async function AnalystReportPage({ params }: { params: Params }) {
  const { dossierId } = await params;
  const entry = analystRegistryEntry(dossierId);
  if (!entry) notFound();
  return <AnalystReportClient dossierId={entry.id} title={entry.title} listed={isDossierListed(entry.id)} />;
}
