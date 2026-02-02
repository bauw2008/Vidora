import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getRandomUserAgent } from '@/lib/user-agent';

// 强制动态路由，禁用所有缓存
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

interface ShortDramaSearchItem {
  id: string | number;
  name: string;
  cover: string;
  update_time?: string;
  score?: number;
  description?: string;
  author?: string;
  backdrop?: string;
  vote_average?: number;
  tmdb_id?: string | number;
  vod_remarks?: string;
  remarks?: string;
}

// 服务端专用函数，直接调用外部API
async function searchShortDramasInternal(
  query: string,
  page = 1,
  size = 20,
  retryCount = 0,
) {
  const response = await fetch(
    `https://api.r2afosne.dpdns.org/vod/search?name=${encodeURIComponent(query)}&page=${page}&size=${size}`,
    {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(30000), // 30秒超时
    },
  );

  // 如果遇到 403 错误，尝试重试一次（更换 User-Agent）
  if (response.status === 403 && retryCount < 2) {
    logger.warn(`搜索短剧遇到 403 错误，尝试重试 (${retryCount + 1}/2)`);
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 * (retryCount + 1)),
    ); // 延迟重试
    return searchShortDramasInternal(query, page, size, retryCount + 1);
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const items = data.list || [];
  const list = items.map((item: ShortDramaSearchItem) => ({
    id: item.id,
    name: item.name,
    cover: item.cover,
    update_time: item.update_time || new Date().toISOString(),
    score: item.score || 0,
    episode_count: 1,
    description: item.description || '',
    author: item.author || '',
    backdrop: item.backdrop || item.cover,
    vote_average: item.vote_average || item.score || 0,
    tmdb_id: item.tmdb_id || undefined,
  }));

  return {
    list,
    hasMore: data.currentPage < data.totalPages,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get('query');
    const page = searchParams.get('page');
    const size = searchParams.get('size');

    if (!query) {
      return NextResponse.json(
        { error: '缺少必要参数: query' },
        { status: 400 },
      );
    }

    const pageNum = page ? parseInt(page) : 1;
    const pageSize = size ? parseInt(size) : 20;

    if (isNaN(pageNum) || isNaN(pageSize)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    const result = await searchShortDramasInternal(query, pageNum, pageSize);

    // 设置与网页端一致的缓存策略（搜索结果: 1小时）
    const response = NextResponse.json(result);

    // 1小时 = 3600秒（搜索结果更新频繁，短期缓存）
    const cacheTime = 3600;
    response.headers.set(
      'Cache-Control',
      `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
    );
    response.headers.set('CDN-Cache-Control', `public, s-maxage=${cacheTime}`);
    response.headers.set(
      'Vercel-CDN-Cache-Control',
      `public, s-maxage=${cacheTime}`,
    );

    // 调试信息
    response.headers.set('X-Cache-Duration', '1hour');
    response.headers.set(
      'X-Cache-Expires-At',
      new Date(Date.now() + cacheTime * 1000).toISOString(),
    );
    response.headers.set('X-Debug-Timestamp', new Date().toISOString());

    // Vary头确保不同设备有不同缓存
    response.headers.set('Vary', 'Accept-Encoding, User-Agent');

    return response;
  } catch (error) {
    logger.error('搜索短剧失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
