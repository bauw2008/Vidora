import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 脱敏API Key
function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return apiKey;
  }
  return `${apiKey.substring(0, 4)}****${apiKey.substring(apiKey.length - 4)}`;
}

// GET 请求：获取短剧API配置
export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 检查权限：只有管理员或站长可以查看短剧API配置
  if (authInfo.role !== 'admin' && authInfo.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const config = await getConfig();
    const defaultShortDramaConfig = {
      apiUrl:
        process.env.SHORTDRAMA_API_URL ||
        'https://vidora-shortdrama-service.edgeone.app',
      apiKey: '',
      authEnabled: process.env.SHORTDRAMA_AUTH_ENABLED === 'true',
    };

    // 合并默认配置和实际配置
    const shortDramaConfig = {
      ...defaultShortDramaConfig,
      ...(config.ShortDramaConfig || {}),
    };

    // 脱敏API Key后再返回
    const response = {
      ...shortDramaConfig,
      apiKey: maskApiKey(shortDramaConfig.apiKey || ''),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('获取短剧API配置失败:', error);
    return NextResponse.json({ error: '获取短剧API配置失败' }, { status: 500 });
  }
}

// POST 请求：保存短剧API配置
export async function POST(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 检查权限：只有管理员或站长可以修改短剧API配置
  if (authInfo.role !== 'admin' && authInfo.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const shortDramaSettings = await request.json();

    // 获取完整配置
    const config = await getConfig();

    // 更新或创建 ShortDramaConfig
    config.ShortDramaConfig = {
      apiUrl:
        shortDramaSettings.apiUrl ||
        process.env.SHORTDRAMA_API_URL ||
        'https://vidora-shortdrama-service.edgeone.app',
      apiKey: shortDramaSettings.apiKey || '',
      authEnabled: shortDramaSettings.authEnabled ?? false,
    };

    // 保存完整配置
    await db.saveAdminConfig(config);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('保存短剧API配置失败:', error);
    return NextResponse.json({ error: '保存短剧API配置失败' }, { status: 500 });
  }
}
