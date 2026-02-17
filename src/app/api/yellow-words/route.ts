import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 导出处理函数
export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await getConfig();

    // 返回敏感词列表
    return NextResponse.json({
      yellowWords: config.YellowWords || [],
    });
  } catch (error) {
    logger.error('获取敏感词失败:', error);
    return NextResponse.json({ error: '获取敏感词失败' }, { status: 500 });
  }
}
