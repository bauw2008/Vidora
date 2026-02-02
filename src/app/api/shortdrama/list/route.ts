import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getRandomUserAgent } from '@/lib/user-agent';

// 强制动态路由，禁用所有缓存
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

interface ShortDramaListItem {
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
async function getShortDramaListInternal(
  category: number,
  page = 1,
  size = 20,
  retryCount = 0,
) {
  const response = await fetch(
    `https://api.r2afosne.dpdns.org/vod/list?categoryId=${category}&page=${page}&size=${size}`,
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
    logger.warn(`获取短剧列表遇到 403 错误，尝试重试 (${retryCount + 1}/2)`);
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 * (retryCount + 1)),
    ); // 延迟重试
    return getShortDramaListInternal(category, page, size, retryCount + 1);
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const items = data.list || [];
  const list = items.map((item: ShortDramaListItem) => ({
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
    const categoryId = searchParams.get('categoryId');
    const page = searchParams.get('page');
    const size = searchParams.get('size');

    if (!categoryId) {
      return NextResponse.json(
        { error: '缺少必要参数: categoryId' },
        { status: 400 },
      );
    }

    const category = parseInt(categoryId);
    const pageNum = page ? parseInt(page) : 1;
    const pageSize = size ? parseInt(size) : 20;

    if (isNaN(category) || isNaN(pageNum) || isNaN(pageSize)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    const result = await getShortDramaListInternal(category, pageNum, pageSize);

    // 设置与网页端一致的缓存策略（lists: 2小时）
    const response = NextResponse.json(result);

    // 2小时 = 7200秒（与网页端SHORTDRAMA_CACHE_EXPIRE.lists一致）
    const cacheTime = 7200;
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
    response.headers.set('X-Cache-Duration', '2hour');
    response.headers.set(
      'X-Cache-Expires-At',
      new Date(Date.now() + cacheTime * 1000).toISOString(),
    );
    response.headers.set('X-Debug-Timestamp', new Date().toISOString());

    // Vary头确保不同设备有不同缓存
    response.headers.set('Vary', 'Accept-Encoding, User-Agent');

    return response;
  } catch (error) {
    logger.error('获取短剧列表失败:', error);
    const errorResponse = NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 },
    );
    // 错误响应不缓存，避免缓存失效的 API
    errorResponse.headers.set(
      'Cache-Control',
      'no-cache, no-store, must-revalidate',
    );
    return errorResponse;
  }
}
