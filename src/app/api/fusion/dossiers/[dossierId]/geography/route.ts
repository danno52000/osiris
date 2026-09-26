import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import {
  GEO_CONTRACT_INVALID_REASON,
  GEO_PROXY_UNAVAILABLE_REASON,
  geoUnavailableResponse,
  isGeoResponse,
} from '@/lib/geography';
import { dossierRegistryEntry, geographySidecarPath } from '@/lib/dossier-registry';

export const dynamic = 'force-dynamic';

/**
 * Typed same-origin proxy to the Fusion sidecar E4 geography API
 * (`/api/v1/foundation/dossiers/{dossierId}/geography`, `e4-geography/1.0`).
 * Same rules as the DDD/analyst proxies: the requested id is forwarded only after it matches the
 * finite registry (anything else is a state-only 404 `unknown_dossier` without a sidecar request,
 * never a Las Bambas fallback); 200/503/404 bodies are forwarded only after the bounded contract
 * guard — bound to the requested id — accepts the whole body, everything else is state-only 503,
 * every answer `Cache-Control: no-store`, non-GET 405. The proxy never adds, moves or invents
 * geometry.
 */

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8080';
const NO_STORE = { 'Cache-Control': 'no-store' };
const ROUTING_REASONS: ReadonlySet<string> = new Set(['unknown_dossier', 'dossier_not_enabled']);

function reject(reason: string, status: number, dossierId: string | null = null): NextResponse {
  return NextResponse.json(geoUnavailableResponse(reason, dossierId), { status, headers: NO_STORE });
}

export async function GET(req: Request, ctx: { params: Promise<{ dossierId: string }> }) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 60, 60_000)) {
    return reject('rate_limited', 429);
  }
  if (new URL(req.url).searchParams.size > 0) {
    return reject('query_parameters_rejected', 400);
  }
  const { dossierId } = await ctx.params;
  const entry = dossierRegistryEntry(dossierId);
  if (!entry) {
    return reject('unknown_dossier', 404);
  }

  try {
    const res = await fetch(`${SIDECAR_URL}${geographySidecarPath(entry.id)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status !== 200 && res.status !== 503 && res.status !== 404) {
      return reject(GEO_PROXY_UNAVAILABLE_REASON, 503, entry.id);
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return reject(res.status === 404 ? 'geography_route_missing' : GEO_PROXY_UNAVAILABLE_REASON, res.status === 404 ? 404 : 503, entry.id);
    }
    if (!isGeoResponse(data, entry.id)) {
      return reject(res.status === 404 ? 'geography_route_missing' : GEO_CONTRACT_INVALID_REASON, res.status === 404 ? 404 : 503, entry.id);
    }
    if (res.status === 404 && !(data.state === 'unavailable' && data.reason !== null && ROUTING_REASONS.has(data.reason))) {
      return reject(GEO_CONTRACT_INVALID_REASON, 503, entry.id);
    }
    if (res.status !== 404 && (res.status === 503) !== (data.state === 'unavailable')) {
      return reject(GEO_CONTRACT_INVALID_REASON, 503, entry.id);
    }
    return NextResponse.json(data, { status: res.status, headers: NO_STORE });
  } catch {
    return reject(GEO_PROXY_UNAVAILABLE_REASON, 503, entry.id);
  }
}

function methodNotAllowed(): NextResponse {
  return NextResponse.json(geoUnavailableResponse('method_not_allowed'), {
    status: 405,
    headers: { ...NO_STORE, Allow: 'GET' },
  });
}

export const HEAD = methodNotAllowed;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
