import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username || authInfo.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 清除配置缓存
    clearConfigCache();

    // 强制从数据库重新加载配置
    await getConfig();

    // 清除可能的 Next.js 缓存
    const config = await db.getAdminConfig();

    // 重新保存配置以触发更新
    if (config) {
      await db.saveAdminConfig(config);
    }

    return NextResponse.json({
      success: true,
      message:
        '配置缓存已清理，包含 ' +
        (config?.UserConfig?.Users?.length || 0) +
        ' 个用户',
    });
  } catch (error) {
    logger.error('清理配置缓存失败:', error);
    return NextResponse.json(
      { error: '清理配置缓存失败: ' + (error as Error).message },
      { status: 500 },
    );
  }
}
