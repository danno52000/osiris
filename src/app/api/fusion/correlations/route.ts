import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

/**
 * Thin proxy to the 3BAI Fusion sidecar.
 *
 * In Docker: fetches from http://fusion-sidecar:8080/api/v1/correlations/active
 * In dev:    fetches from http://localhost:8080/api/v1/correlations/active
 */

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8080';

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 60, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const res = await fetch(`${SIDECAR_URL}/api/v1/correlations/active`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { correlations: [], degraded: true },
        { status: res.status === 404 ? 404 : 200 },
      );
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    // Sidecar down is not a page failure — report an empty board.
    return NextResponse.json({ correlations: [], degraded: true });
  }
}
