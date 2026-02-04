import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getShortDramaCategories } from '@/lib/shortdrama-api';

// 强制动态路由
export const dynamic = 'force-dynamic';

// 缓存时间配置（秒）
const CACHE_TTL = 4 * 60 * 60; // 4小时

export async function GET() {
  try {
    const cacheKey = 'shortdrama-categories';

    // 尝试从缓存获取
    const cached = await db.getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const categories = await getShortDramaCategories();

    // 转换为新旧格式兼容
    const formattedCategories = categories.map((item) => ({
      type_id: item.id,
      type_name: item.name,
    }));

    // 只在成功时保存到缓存
    await db.setCache(cacheKey, formattedCategories, CACHE_TTL);

    const response = NextResponse.json(formattedCategories);
    response.headers.set(
      'Cache-Control',
      'no-cache, no-store, must-revalidate',
    );
    return response;
  } catch (error) {
    logger.error('获取短剧分类失败:', error);

    // 发生错误时删除相关缓存
    await db.deleteCache('shortdrama-categories').catch(() => {
      // 忽略缓存删除错误
    });

    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
