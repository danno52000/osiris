import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import {
  GEO_CONTRACT_INVALID_REASON,
  GEO_PROXY_UNAVAILABLE_REASON,
  GEO_SIDECAR_PATH,
  geoUnavailableResponse,
  isGeoResponse,
} from '@/lib/geography';

export const dynamic = 'force-dynamic';

/**
 * Typed same-origin proxy to the Fusion sidecar E4 geography API
 * (`/api/v1/foundation/dossiers/las-bambas-matarani/geography`, `e4-geography/1.0`).
 * Same rules as the dossier/vulnerability proxies: literal path, no client input reaches
 * the sidecar, 200/503 bodies forwarded only after the bounded contract guard accepts the
 * whole body, everything else is state-only 503, every answer `Cache-Control: no-store`,
 * non-GET 405. The proxy never adds, moves or invents geometry.
 */

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8080';
const NO_STORE = { 'Cache-Control': 'no-store' };

function reject(reason: string, status: number): NextResponse {
  return NextResponse.json(geoUnavailableResponse(reason), { status, headers: NO_STORE });
}

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 60, 60_000)) {
    return reject('rate_limited', 429);
  }
  if (new URL(req.url).searchParams.size > 0) {
    return reject('query_parameters_rejected', 400);
  }

  try {
    const res = await fetch(`${SIDECAR_URL}${GEO_SIDECAR_PATH}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      return reject('geography_route_missing', 404);
    }
    if (res.status !== 200 && res.status !== 503) {
      return reject(GEO_PROXY_UNAVAILABLE_REASON, 503);
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return reject(GEO_PROXY_UNAVAILABLE_REASON, 503);
    }
    if (!isGeoResponse(data) || (res.status === 503) !== (data.state === 'unavailable')) {
      return reject(GEO_CONTRACT_INVALID_REASON, 503);
    }
    return NextResponse.json(data, { status: res.status, headers: NO_STORE });
  } catch {
    return reject(GEO_PROXY_UNAVAILABLE_REASON, 503);
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
