import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import {
  CONTRACT_INVALID_REASON,
  DOSSIER_ID,
  PROXY_UNAVAILABLE_REASON,
  isDossierResponse,
  unavailableResponse,
} from '@/lib/dossier';

export const dynamic = 'force-dynamic';

/**
 * Typed same-origin proxy to the Fusion sidecar E2 dossier API
 * (`/api/v1/foundation/dossiers/las-bambas-matarani`, contract `e2-dossier/1.0`).
 *
 * The route is the literal `/api/fusion/dossiers/las-bambas-matarani`: no client-supplied
 * id, query parameter, audience, publication number or path ever reaches the sidecar
 * (any other `/api/fusion/dossiers/...` path is a Next 404). Sidecar 200/503 bodies are
 * forwarded with their status (available/stale/not_published/withdrawn/unavailable) only
 * after the bounded contract guard (`isDossierResponse`) accepts the whole body, so a
 * claim-bearing 200 with a malformed publication becomes 503 `sidecar_contract_invalid`
 * state-only; anything else — including an unreachable sidecar — is 503 `unavailable` +
 * `degraded`, never an empty dossier and never a cached copy. Every answer, whatever its status,
 * carries `Cache-Control: no-store`; non-GET methods are 405.
 */

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8080';
const SIDECAR_PATH = `/api/v1/foundation/dossiers/${DOSSIER_ID}`;
const NO_STORE = { 'Cache-Control': 'no-store' };

function reject(reason: string, status: number): NextResponse {
  return NextResponse.json(unavailableResponse(reason), { status, headers: NO_STORE });
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
    const res = await fetch(`${SIDECAR_URL}${SIDECAR_PATH}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      // Sidecar release without the dossier router.
      return reject('dossier_route_missing', 404);
    }
    if (res.status !== 200 && res.status !== 503) {
      return reject(PROXY_UNAVAILABLE_REASON, 503);
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return reject(PROXY_UNAVAILABLE_REASON, 503);
    }
    if (!isDossierResponse(data) || (res.status === 503) !== (data.state === 'unavailable')) {
      return reject(CONTRACT_INVALID_REASON, 503);
    }
    return NextResponse.json(data, { status: res.status, headers: NO_STORE });
  } catch {
    return reject(PROXY_UNAVAILABLE_REASON, 503);
  }
}

function methodNotAllowed(): NextResponse {
  return NextResponse.json(unavailableResponse('method_not_allowed'), {
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
