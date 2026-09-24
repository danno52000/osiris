/** Static render of the right-rail Supply Chain Dossiers control: one dossier, list-view notice, no geometry. */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SupplyChainDossiersPanel, { DOSSIER_LIST } from './SupplyChainDossiersPanel';

describe('SupplyChainDossiersPanel', () => {
  it('lists exactly the one bounded dossier with the list-view notice and no selection by default', () => {
    const html = renderToStaticMarkup(<SupplyChainDossiersPanel />);
    expect(DOSSIER_LIST).toHaveLength(1);
    expect(DOSSIER_LIST[0]).toMatchObject({ id: 'las-bambas-matarani', href: '/dossiers/las-bambas-matarani' });
    expect(html).toContain('SUPPLY CHAIN DOSSIERS');
    expect(html).toContain('No geographic evidence published; dossier list view');
    expect((html.match(/data-dossier-id="/g) ?? []).length).toBe(1);
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('data-section="selected-dossier"');
    expect(html).not.toContain('data-toggle="vulnerability"');
    expect(html).not.toMatch(/lat|lng|coordinates|geocod/i);
  });
});
