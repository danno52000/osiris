import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Layout regression for the Supply Chain Dossiers drawer. The right tool strip is
 * vertically centred with a transform, so any drawer rendered inside it centres on
 * its button (near the top of the strip) and its header leaves the viewport on
 * 1440x1000 / 1280x800 desktops. The drawer must be a root-level sibling of the strip,
 * anchored to the viewport-sized <main>, and bounded to the viewport.
 */
const source = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');

const stripStart = source.indexOf('RIGHT TOOL STRIP');
const drawerStart = source.indexOf('data-drawer="supply-chain-dossiers"');

describe('Supply Chain Dossiers drawer anchoring', () => {
  it('renders the drawer outside the transformed right tool strip', () => {
    expect(stripStart).toBeGreaterThan(0);
    expect(drawerStart).toBeGreaterThan(0);
    expect(drawerStart).toBeLessThan(stripStart);
    const strip = source.slice(stripStart, source.indexOf('</div>}', stripStart));
    expect(strip).not.toContain('<SupplyChainDossiersPanel');
    expect(source.match(/<SupplyChainDossiersPanel\s*\/>/g)).toHaveLength(1);
  });

  it('anchors the drawer to the viewport with bounded width and height', () => {
    const tag = source.slice(source.lastIndexOf('<motion.div', drawerStart), drawerStart);
    expect(tag).toContain('absolute right-14 top-1/2 -translate-y-1/2');
    expect(tag).toContain('max-h-[calc(100vh-2rem)]');
    expect(tag).toContain('max-w-[calc(100vw-4.5rem)]');
    expect(tag).not.toContain('fixed');
  });
});
