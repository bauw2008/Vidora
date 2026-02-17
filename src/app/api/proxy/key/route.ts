/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { LIVE_PLAYER_USER_AGENTS } from '@/lib/user-agent';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const source = searchParams.get('vidora-source');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  const config = await getConfig();
  const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
  if (!liveSource) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }
  const ua = liveSource.ua || LIVE_PLAYER_USER_AGENTS.APTV_PLAYER;

  try {
    const decodedUrl = decodeURIComponent(url);
    logger.log(decodedUrl);
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': ua,
      },
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch key' },
        { status: 500 },
      );
    }
    const keyData = await response.arrayBuffer();
    return new Response(keyData, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
        'Access-Control-Allow-Headers':
          'Content-Type, Range, Origin, Accept, User-Agent',
        'Cache-Control': 'public, max-age=300',
        'Content-Length': keyData.byteLength.toString(),
      },
    });
  } catch (error) {
    logger.error('获取 key 失败:', error);
    return NextResponse.json({ error: 'Failed to fetch key' }, { status: 500 });
  }
}
