import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import {
  CONTRACT_INVALID_REASON,
  PROXY_UNAVAILABLE_REASON,
  isDossierResponse,
  unavailableResponse,
} from '@/lib/dossier';
import { dossierRegistryEntry, dossierSidecarPath } from '@/lib/dossier-registry';

export const dynamic = 'force-dynamic';

/**
 * Typed same-origin proxy to the Fusion sidecar E2 dossier (DDD) API
 * (`/api/v1/foundation/dossiers/{dossierId}`, contract `e2-dossier/1.0`).
 *
 * The only client input that reaches the sidecar is the dossier id, and only after it matches
 * the finite registry in `lib/dossier-registry.ts`: listed or reserved ids are forwarded verbatim
 * (the sidecar decides `dossier_not_enabled`), anything else is a state-only 404 `unknown_dossier`
 * without a sidecar request. There is no fallback to Las Bambas for another id. Sidecar
 * 200/503/404 bodies are forwarded with their status only after the bounded contract guard
 * (`isDossierResponse`, bound to the requested id) accepts the whole body, so a claim-bearing 200
 * with a malformed publication — or one about a different dossier — becomes 503
 * `sidecar_contract_invalid` state-only; anything else, including an unreachable sidecar, is 503
 * `unavailable` + `degraded`, never an empty dossier and never a cached copy. Every answer carries
 * `Cache-Control: no-store`; non-GET methods are 405.
 */

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8080';
const NO_STORE = { 'Cache-Control': 'no-store' };
const ROUTING_REASONS: ReadonlySet<string> = new Set(['unknown_dossier', 'dossier_not_enabled']);

function reject(reason: string, status: number, dossierId: string | null = null): NextResponse {
  return NextResponse.json(unavailableResponse(reason, dossierId), { status, headers: NO_STORE });
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
    const res = await fetch(`${SIDECAR_URL}${dossierSidecarPath(entry.id)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status !== 200 && res.status !== 503 && res.status !== 404) {
      return reject(PROXY_UNAVAILABLE_REASON, 503, entry.id);
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      // A 404 without a dossier envelope is a sidecar release without the dossier router.
      return reject(res.status === 404 ? 'dossier_route_missing' : PROXY_UNAVAILABLE_REASON, res.status === 404 ? 404 : 503, entry.id);
    }
    if (!isDossierResponse(data, entry.id)) {
      return reject(res.status === 404 ? 'dossier_route_missing' : CONTRACT_INVALID_REASON, res.status === 404 ? 404 : 503, entry.id);
    }
    if (res.status === 404 && !(data.state === 'unavailable' && data.reason !== null && ROUTING_REASONS.has(data.reason))) {
      return reject(CONTRACT_INVALID_REASON, 503, entry.id);
    }
    if (res.status !== 404 && (res.status === 503) !== (data.state === 'unavailable')) {
      return reject(CONTRACT_INVALID_REASON, 503, entry.id);
    }
    return NextResponse.json(data, { status: res.status, headers: NO_STORE });
  } catch {
    return reject(PROXY_UNAVAILABLE_REASON, 503, entry.id);
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
