import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// OrionTV 兼容接口
export async function GET(request: NextRequest) {
  logger.log('request', request.url);

  // 添加用户认证检查
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiSites = await getAvailableApiSites(authInfo.username);

    return NextResponse.json(apiSites);
  } catch (error) {
    logger.error('获取资源失败:', error);
    return NextResponse.json({ error: '获取资源失败' }, { status: 500 });
  }
}
