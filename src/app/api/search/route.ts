import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { logger } from '@/lib/logger';
import type { SearchResult } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { results: [] },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Netlify-Vary': 'query',
        },
      },
    );
  }

  try {
    // 使用高性能索引查询
    const apiSites = await getAvailableApiSites(authInfo?.username || '');

    if (apiSites.length === 0) {
      return NextResponse.json({
        results: [],
        total: 0,
        message: '用户没有可用的视频源权限',
      });
    }

    // 执行搜索
    let allResults: SearchResult[] = [];
    for (const site of apiSites) {
      try {
        const results = await searchFromApi(site, query);
        allResults = allResults.concat(results);
      } catch (error) {
        logger.error(`搜索源 ${site.key} 失败:`, error);
      }
    }

    return NextResponse.json({
      results: allResults,
      total: allResults.length,
    });
  } catch (error) {
    logger.error('搜索失败:', error);
    return NextResponse.json(
      { error: '搜索失败' },
      {
        status: 500,
      },
    );
  }
}
