import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearConfigCache } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// 获取站长配置
export const GET = async (request: NextRequest) => {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || authInfo.role !== 'owner') {
    return NextResponse.json({ error: '权限不足' }, { status: 401 });
  }

  try {
    // 从存储中读取站长配置
    const config = await db.getOwnerConfig();

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    logger.error('获取站长配置失败:', error);
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
  }
};

// 保存站长配置
export const POST = async (request: NextRequest) => {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || authInfo.role !== 'owner') {
    return NextResponse.json({ error: '权限不足' }, { status: 401 });
  }

  try {
    const config = await request.json();

    // 验证配置数据
    const { siteMaintenance, debugMode, maxUsers } = config;

    if (typeof maxUsers !== 'number' || maxUsers < 1 || maxUsers > 10000) {
      return NextResponse.json(
        { error: '最大用户数必须在1-10000之间' },
        { status: 400 },
      );
    }

    // 更新站长配置
    const updatedConfig: import('@/lib/types').OwnerConfig = {
      SiteMaintenance: siteMaintenance,
      DebugMode: debugMode,
      MaxUsers: maxUsers,
    };

    // 保存到存储
    await db.setOwnerConfig(updatedConfig);
    logger.log('站长配置已更新:', {
      siteMaintenance,
      debugMode,
      maxUsers,
      updatedBy: 'owner',
      timestamp: new Date().toISOString(),
    });

    // 清除配置缓存，确保下次读取时获取最新的 MaxUsers
    clearConfigCache();

    return NextResponse.json({
      success: true,
      message: '站长配置保存成功',
    });
  } catch (error) {
    logger.error('保存站长配置失败:', error);
    return NextResponse.json({ error: '保存配置失败' }, { status: 500 });
  }
};
