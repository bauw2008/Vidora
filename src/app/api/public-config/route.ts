import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await getConfig();

    // 检查配置是否为 null
    if (!config) {
      logger.error('配置为 null，无法获取公开配置');
      return NextResponse.json(
        {
          error: '配置未初始化',
        },
        { status: 500 },
      );
    }

    // 只返回公开的配置信息，不包含敏感数据
    const publicConfig = {
      MenuSettings: config.SiteConfig?.MenuSettings || {
        showMovies: true,
        showTVShows: true,
        showAnime: true,
        showVariety: true,
        showLive: false,
        showTvbox: false,
        showShortDrama: false,
      },
      CustomCategories: config.CustomCategories || [],
    };

    return NextResponse.json(publicConfig, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('获取公开配置失败:', error);
    return NextResponse.json(
      {
        error: '获取公开配置失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
