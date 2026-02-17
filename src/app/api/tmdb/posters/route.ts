import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  backdrop_path?: string;
  poster_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
}

// TMDB API 配置
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// 缓存时长配置
const TRENDING_CACHE_DURATION = 7 * 24 * 60 * 60; // 7天缓存（热门内容变化慢）
const SEARCH_CACHE_DURATION = 14 * 24 * 60 * 60; // 14天缓存（周榜内容变化更慢）

/**
 * 获取TMDB热门内容的第一张横屏海报
 */
async function getTMDBPoster(
  category: 'movie' | 'tv',
  apiKey: string,
  language: string = 'zh-CN',
) {
  const cacheKey = `tmdb-poster:trending-${category}-${language}`;

  try {
    // 检查缓存
    const cached = await db.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    // 获取热门内容
    const trendingUrl = `${TMDB_BASE_URL}/trending/${category}/week`;
    const response = await fetch(
      `${trendingUrl}?api_key=${apiKey}&language=${language}&page=1`,
    );

    if (!response.ok) {
      throw new Error(`TMDB API错误: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      throw new Error(`没有找到${category}内容`);
    }

    // 获取第一个有backdrop_path的内容
    const firstItemWithBackdrop = data.results.find(
      (item: TMDBItem) => item.backdrop_path,
    ) as TMDBItem | undefined;

    if (!firstItemWithBackdrop) {
      throw new Error(`没有找到${category}内容的横屏海报`);
    }

    const posterData = {
      id: firstItemWithBackdrop.id,
      title:
        category === 'movie'
          ? firstItemWithBackdrop.title
          : firstItemWithBackdrop.name,
      backdrop: `https://image.tmdb.org/t/p/original${firstItemWithBackdrop.backdrop_path}`,
      poster: firstItemWithBackdrop.poster_path
        ? `https://image.tmdb.org/t/p/w780${firstItemWithBackdrop.poster_path}`
        : '',
      rate: firstItemWithBackdrop.vote_average?.toFixed(1) || '',
      year:
        category === 'movie'
          ? firstItemWithBackdrop.release_date?.split('-')[0] || ''
          : firstItemWithBackdrop.first_air_date?.split('-')[0] || '',
      category: category === 'movie' ? '电影' : '剧集',
      overview: firstItemWithBackdrop.overview || '',
    };

    // 缓存结果到统一存储系统
    await db.setCache(cacheKey, posterData, TRENDING_CACHE_DURATION);

    return posterData;
  } catch (error) {
    logger.error(`[TMDB海报API] 获取${category}海报失败:`, error);
    throw error;
  }
}

/**
 * 按名称搜索TMDB内容的海报
 */
async function searchTMDBPoster(
  title: string,
  category: 'movie' | 'tv',
  apiKey: string,
  language: string = 'zh-CN',
  year?: string,
) {
  // 创建缓存键，包含标题、分类、年份和语言（统一前缀便于管理）
  const cacheKey = `tmdb-poster:search-${category}-${title}-${year || 'no-year'}-${language}`;

  try {
    // 检查缓存
    const cached = await db.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    // 构建搜索查询
    const searchUrl = `${TMDB_BASE_URL}/search/${category}`;
    const searchParams = new URLSearchParams({
      api_key: apiKey,
      language: language,
      query: title,
      page: '1',
    });

    // 如果有年份，添加到搜索参数中
    if (year && year.length === 4) {
      searchParams.append('year', year);
    }

    const response = await fetch(`${searchUrl}?${searchParams}`);

    if (!response.ok) {
      throw new Error(`TMDB搜索API错误: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    // 优先选择有backdrop_path的结果
    let bestMatch = data.results.find(
      (item: TMDBItem) => item.backdrop_path,
    ) as TMDBItem | undefined;

    // 如果没有backdrop_path，选择第一个结果
    if (!bestMatch) {
      bestMatch = data.results[0];
    }

    const posterData = {
      id: bestMatch.id,
      title: category === 'movie' ? bestMatch.title : bestMatch.name,
      backdrop: bestMatch.backdrop_path
        ? `https://image.tmdb.org/t/p/original${bestMatch.backdrop_path}`
        : '',
      poster: bestMatch.poster_path
        ? `https://image.tmdb.org/t/p/w1280${bestMatch.poster_path}`
        : '', // 提升到1280px
      rate: bestMatch.vote_average?.toFixed(1) || '',
      year:
        category === 'movie'
          ? bestMatch.release_date?.split('-')[0] || ''
          : bestMatch.first_air_date?.split('-')[0] || '',
      category: category === 'movie' ? '剧集' : '电影',
      overview: bestMatch.overview || '',
    };

    // 缓存结果到统一存储系统 - 24小时
    await db.setCache(cacheKey, posterData, SEARCH_CACHE_DURATION);

    return posterData;
  } catch (error) {
    logger.error(`[TMDB海报API] 搜索${category}海报失败: ${title}`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // 检查TMDB是否启用
    const config = await getConfig();

    if (!config.SiteConfig?.TMDBApiKey) {
      return NextResponse.json(
        {
          error: 'TMDB API Key 未配置',
          message: '请在管理后台配置TMDB API Key',
        },
        { status: 400 },
      );
    }

    // 检查TMDB横屏海报功能是否启用
    if (!config.SiteConfig.EnableTMDBPosters) {
      return NextResponse.json(
        {
          error: 'TMDB横屏海报功能未启用',
          message: '请在管理后台启用TMDB横屏海报功能',
        },
        { status: 403 },
      );
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const category =
      (searchParams.get('category') as 'movie' | 'tv') || 'movie';
    const language =
      searchParams.get('language') || config.SiteConfig.TMDBLanguage || 'zh-CN';
    const searchTitle = searchParams.get('title'); // 新增：搜索标题
    const searchYear = searchParams.get('year'); // 新增：搜索年份

    // 验证分类参数
    if (!['movie', 'tv'].includes(category)) {
      return NextResponse.json(
        {
          error: '无效的分类参数',
          message: '分类只能是 movie 或 tv',
        },
        { status: 400 },
      );
    }

    let posterData;

    // 如果提供了标题，进行搜索；否则获取热门内容
    if (searchTitle && searchTitle.trim()) {
      posterData = await searchTMDBPoster(
        searchTitle.trim(),
        category,
        config.SiteConfig.TMDBApiKey,
        language,
        searchYear || undefined,
      );

      if (!posterData) {
        return NextResponse.json(
          {
            success: false,
            error: '未找到匹配内容',
            message: `没有找到标题为"${searchTitle}"的${category === 'movie' ? '电影' : '剧集'}`,
          },
          { status: 404 },
        );
      }
    } else {
      posterData = await getTMDBPoster(
        category,
        config.SiteConfig.TMDBApiKey,
        language,
      );
    }

    return NextResponse.json({
      success: true,
      data: posterData,
      message: searchTitle
        ? `成功搜索${category}海报: ${searchTitle}`
        : `成功获取${category}海报`,
    });
  } catch (error) {
    logger.error('[TMDB海报API] 请求处理失败:', error);
    return NextResponse.json(
      {
        error: '获取海报失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 },
    );
  }
}
