import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (authInfo.role !== 'admin' && authInfo.role !== 'owner') {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, yellowWords } = body;

    if (action === 'updateYellowWords') {
      // 获取当前配置
      const config = await getConfig();

      // 更新YellowWords
      config.YellowWords = yellowWords || [];

      // 保存配置
      await db.saveAdminConfig(config);

      // 清除缓存
      clearConfigCache();

      return NextResponse.json({
        success: true,
        message: '18+过滤词汇已更新',
      });
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  } catch (error) {
    logger.error('更新YellowWords失败:', error);
    return NextResponse.json(
      { error: '更新失败: ' + (error as Error).message },
      { status: 500 },
    );
  }
}
