import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import {
  DOSSIER_ID,
  PROXY_UNAVAILABLE_REASON,
  unavailableResponse,
  type DossierResponse,
} from '@/lib/dossier';

export const dynamic = 'force-dynamic';

/**
 * Typed same-origin proxy to the Fusion sidecar E2 dossier API
 * (`/api/v1/foundation/dossiers/las-bambas-matarani`, contract `e2-dossier/1.0`).
 *
 * The dossier id is a literal: no client-supplied id, query parameter, audience,
 * publication number or path ever reaches the sidecar. Sidecar 200/503 bodies are
 * forwarded with their status (available/stale/not_published/withdrawn/unavailable);
 * anything else — including an unreachable sidecar — is reported as `unavailable`
 * + `degraded`, never as an empty dossier and never from a cached copy.
 */

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8080';
const NO_STORE = { 'Cache-Control': 'no-store' };

function reject(reason: string, status = 200): NextResponse {
  return NextResponse.json(unavailableResponse(reason), { status, headers: NO_STORE });
}

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 60, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  if (new URL(req.url).searchParams.size > 0) {
    return reject('query_parameters_rejected', 400);
  }

  try {
    const res = await fetch(`${SIDECAR_URL}/api/v1/foundation/dossiers/${DOSSIER_ID}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      // Sidecar release without the dossier router.
      return reject('dossier_route_missing', 404);
    }
    if (res.status !== 200 && res.status !== 503) {
      return reject(PROXY_UNAVAILABLE_REASON);
    }
    const data = (await res.json()) as Partial<DossierResponse>;
    if (
      data.schema_version !== 'e2-dossier/1.0'
      || typeof data.state !== 'string'
      || (data.dossier_id !== null && data.dossier_id !== DOSSIER_ID)
    ) {
      return reject(PROXY_UNAVAILABLE_REASON);
    }
    return NextResponse.json(data, { status: res.status, headers: NO_STORE });
  } catch {
    return reject(PROXY_UNAVAILABLE_REASON);
  }
}
