import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

/**
 * Thin proxy to the 3BAI Fusion sidecar entity-brief endpoint.
 *
 * GET /api/fusion/brief?track_id=<id>
 *   -> SIDECAR_URL/api/v1/entities/<id>/brief
 */

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8080';

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 30, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const trackId = (searchParams.get('track_id') || '').trim();
  if (!trackId || trackId.length > 200) {
    return NextResponse.json({ error: 'Missing or invalid track_id' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${SIDECAR_URL}/api/v1/entities/${encodeURIComponent(trackId)}/brief`,
      { cache: 'no-store', signal: AbortSignal.timeout(20000) },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Fusion sidecar unreachable' }, { status: 502 });
  }
}
