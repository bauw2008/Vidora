import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const config = await getConfig();
    const danmuApiConfig = config.DanmuApiConfig || {
      enabled: true,
      useCustomApi: false,
      customApiUrl: '',
      customToken: '',
      timeout: 30,
    };

    return NextResponse.json(danmuApiConfig);
  } catch (error) {
    logger.error('获取弹幕API配置失败:', error);
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const danmuApiConfig = {
      enabled: body.enabled ?? true,
      useCustomApi: body.useCustomApi ?? false,
      customApiUrl: body.customApiUrl || '',
      customToken: body.customToken || '',
      timeout: Math.max(5, Math.min(60, body.timeout || 30)),
    };

    const config = await getConfig();
    config.DanmuApiConfig = danmuApiConfig;

    await db.saveAdminConfig(config);

    logger.log('弹幕API配置已更新:', danmuApiConfig);

    return NextResponse.json({
      success: true,
      message: '弹幕API配置保存成功',
      config: danmuApiConfig,
    });
  } catch (error) {
    logger.error('保存弹幕API配置失败:', error);
    return NextResponse.json({ error: '保存配置失败' }, { status: 500 });
  }
}
