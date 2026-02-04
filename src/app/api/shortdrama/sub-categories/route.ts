import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getShortDramaSubCategories } from '@/lib/shortdrama-api';

export const dynamic = 'force-dynamic';

// 缓存时间配置（秒）
const CACHE_TTL = 4 * 60 * 60; // 4小时

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const categoryId = searchParams.get('categoryId');

    const categoryIdNum = categoryId ? parseInt(categoryId) : undefined;

    logger.log('请求二级分类, categoryId:', categoryIdNum);

    if (categoryId && (categoryIdNum === undefined || isNaN(categoryIdNum))) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 生成缓存key
    const cacheKey = `shortdrama-subcategories:${categoryIdNum || 'all'}`;

    // 尝试从缓存获取
    const cached = await db.getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const subCategories = await getShortDramaSubCategories(categoryIdNum);

    logger.log('API返回的二级分类数据:', subCategories);

    // 保存到缓存
    await db.setCache(cacheKey, subCategories, CACHE_TTL);

    const response = NextResponse.json(subCategories);
    response.headers.set(
      'Cache-Control',
      'no-cache, no-store, must-revalidate',
    );
    return response;
  } catch (error) {
    logger.error('获取短剧二级分类失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
