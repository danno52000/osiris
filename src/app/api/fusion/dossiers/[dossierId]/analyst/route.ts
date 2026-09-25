import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import {
  AN_CONTRACT_INVALID_REASON,
  AN_PROXY_UNAVAILABLE_REASON,
  analystRegistryEntry,
  analystSidecarPath,
  anUnavailableResponse,
  isAnResponse,
} from '@/lib/analyst';

export const dynamic = 'force-dynamic';

/**
 * Typed same-origin proxy to the Fusion sidecar E7 analyst API
 * (`/api/v1/foundation/dossiers/{dossierId}/analyst`, `e7-analyst/1.0`).
 *
 * The only client input that reaches the sidecar is the dossier id, and only after it matches
 * the finite registry in `lib/analyst.ts`: listed or reserved ids are forwarded verbatim (the
 * sidecar decides `dossier_not_enabled`), anything else is a state-only 404 `unknown_dossier`
 * without a sidecar request. There is no fallback to Las Bambas for another id. Bodies are
 * forwarded only after the bounded contract guard accepts the whole body for the requested id;
 * everything else is state-only 503, every answer `Cache-Control: no-store`, non-GET 405.
 */

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8080';
const NO_STORE = { 'Cache-Control': 'no-store' };
const ROUTING_REASONS: ReadonlySet<string> = new Set(['unknown_dossier', 'dossier_not_enabled']);

function reject(reason: string, status: number, dossierId: string | null = null): NextResponse {
  return NextResponse.json(anUnavailableResponse(reason, dossierId), { status, headers: NO_STORE });
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
  const entry = analystRegistryEntry(dossierId);
  if (!entry) {
    return reject('unknown_dossier', 404);
  }

  try {
    const res = await fetch(`${SIDECAR_URL}${analystSidecarPath(entry.id)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status !== 200 && res.status !== 503 && res.status !== 404) {
      return reject(AN_PROXY_UNAVAILABLE_REASON, 503, entry.id);
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      // A 404 without an analyst envelope is a sidecar release without the route.
      return reject(res.status === 404 ? 'analyst_route_missing' : AN_PROXY_UNAVAILABLE_REASON, res.status === 404 ? 404 : 503, entry.id);
    }
    if (!isAnResponse(data, entry.id)) {
      return reject(res.status === 404 ? 'analyst_route_missing' : AN_CONTRACT_INVALID_REASON, res.status === 404 ? 404 : 503, entry.id);
    }
    if (res.status === 404 && !(data.state === 'unavailable' && data.reason !== null && ROUTING_REASONS.has(data.reason))) {
      return reject(AN_CONTRACT_INVALID_REASON, 503, entry.id);
    }
    if (res.status !== 404 && (res.status === 503) !== (data.state === 'unavailable')) {
      return reject(AN_CONTRACT_INVALID_REASON, 503, entry.id);
    }
    return NextResponse.json(data, { status: res.status, headers: NO_STORE });
  } catch {
    return reject(AN_PROXY_UNAVAILABLE_REASON, 503, entry.id);
  }
}

function methodNotAllowed(): NextResponse {
  return NextResponse.json(anUnavailableResponse('method_not_allowed'), {
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
