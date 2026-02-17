import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import {
  clearConfigCache,
  getConfig,
  hasSpecialFeaturePermission,
} from '@/lib/config';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

type SpecialFeatureType =
  | 'ai-recommend'
  | 'disable-yellow-filter'
  | 'netdisk-search'
  | 'tmdb-actor-search';

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ hasPermission: false }, { status: 200 });
    }

    const { searchParams } = new URL(request.url);
    const feature = searchParams.get('feature');

    if (
      !feature ||
      ![
        'ai-recommend',
        'disable-yellow-filter',
        'netdisk-search',
        'tmdb-actor-search',
      ].includes(feature)
    ) {
      return NextResponse.json(
        { error: 'Invalid feature parameter' },
        { status: 400 },
      );
    }

    // 清除配置缓存，确保使用最新配置检查权限
    clearConfigCache();

    // 获取最新配置并传递给权限检查函数
    const config = await getConfig();

    const hasPermission = await hasSpecialFeaturePermission(
      authInfo.username,
      feature as SpecialFeatureType,
      config, // 传递最新配置，避免使用缓存
    );

    return NextResponse.json(
      {
        hasPermission,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('Failed to check permission:', error);
    return NextResponse.json({ hasPermission: false }, { status: 200 });
  }
}
