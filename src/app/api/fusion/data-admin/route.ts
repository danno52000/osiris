import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { PROXY_UNAVAILABLE_REASON, type DataAdminResponse } from '@/lib/data-admin';

export const dynamic = 'force-dynamic';

/**
 * Thin proxy to the 3BAI Fusion sidecar foundation Data Admin API.
 *
 * In Docker: fetches from http://fusion-sidecar:8080/api/v1/foundation/data-admin
 * In dev:    fetches from http://localhost:8080/api/v1/foundation/data-admin
 *
 * The sidecar answers 200 with the eight-source payload (fresh or visibly
 * stale) or 503 with a state-only body ({state, reason, sources: []}); both
 * are forwarded as-is so the page can render the truthful state. A sidecar
 * that cannot be reached is reported as `unavailable` + `degraded`, never as
 * empty data.
 */

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8080';

function unavailable(reason: string): DataAdminResponse {
  return {
    state: 'unavailable',
    reason,
    checked_at: new Date().toISOString(),
    schema_revision_expected: '0012',
    sources: [],
    degraded: true,
  };
}

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 60, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const res = await fetch(`${SIDECAR_URL}/api/v1/foundation/data-admin`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      // Sidecar release without the foundation router.
      return NextResponse.json(unavailable('foundation_route_missing'), { status: 404 });
    }
    if (res.status !== 200 && res.status !== 503) {
      return NextResponse.json(unavailable(PROXY_UNAVAILABLE_REASON), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    const data = (await res.json()) as Partial<DataAdminResponse>;
    if (typeof data.state !== 'string') {
      return NextResponse.json(unavailable(PROXY_UNAVAILABLE_REASON), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return NextResponse.json(
      { ...data, sources: Array.isArray(data.sources) ? data.sources : [] },
      { status: res.status, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    // Sidecar down is not a page failure — report unavailable, not zero rows.
    return NextResponse.json(unavailable(PROXY_UNAVAILABLE_REASON), {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
