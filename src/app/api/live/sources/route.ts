import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  logger.log(request.url);
  try {
    const config = await getConfig();

    if (!config) {
      return NextResponse.json({ error: '配置未找到' }, { status: 404 });
    }

    // 过滤出所有非 disabled 的直播源
    const liveSources = (config.LiveConfig || []).filter(
      (source) => !source.disabled,
    );

    return NextResponse.json({
      success: true,
      data: liveSources,
    });
  } catch (error) {
    logger.error('获取直播源失败:', error);
    return NextResponse.json({ error: '获取直播源失败' }, { status: 500 });
  }
}
