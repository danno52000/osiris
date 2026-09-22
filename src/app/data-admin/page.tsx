import type { Metadata } from 'next';
import DataAdminClient from './DataAdminClient';

export const metadata: Metadata = {
  title: 'Data Admin — GIDEON public-source status',
  description:
    'Operational status of the eight GIDEON public-source families: reviewed manifest metadata plus live aggregate counts and freshness from the hosted foundation database. Aggregate metadata only; no source records.',
  alternates: { canonical: '/data-admin' },
  robots: { index: false, follow: false },
};

export default function DataAdminPage() {
  return <DataAdminClient />;
}
