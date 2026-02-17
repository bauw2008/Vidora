import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const config = await getConfig();

    // 只返回注册相关的公开信息
    const registrationStatus = {
      allowRegister: config.UserConfig?.AllowRegister ?? false,
      requireApproval: config.UserConfig?.RequireApproval ?? false,
      storageType: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage',
    };

    return NextResponse.json(registrationStatus, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('获取注册状态失败:', error);
    return NextResponse.json(
      {
        error: '获取注册状态失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
