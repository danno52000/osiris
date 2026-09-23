import type { Metadata } from 'next';
import DossierClient from './DossierClient';

export const metadata: Metadata = {
  title: 'Dossier — Las Bambas – Pillones – Matarani',
  description:
    'Read-only prospect dossier from accepted GIDEON E1 publications: ownership, finance commitments and physical route shown separately with evidence drill-down, explicit gaps and truthful currentness.',
  alternates: { canonical: '/dossiers/las-bambas-matarani' },
  robots: { index: false, follow: false },
};

export default function DossierPage() {
  return <DossierClient />;
}
