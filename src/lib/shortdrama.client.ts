/* @typescript-eslint/no-explicit-any */

import { logger } from '@/lib/logger';

import {
  clearCategoriesCache,
  getCache,
  getCacheKey,
  setCache,
  SHORTDRAMA_CACHE_EXPIRE,
} from './shortdrama-cache';
import {
  ShortDramaCategory,
  ShortDramaItem,
  ShortDramaParseResult,
} from './types';
import { getRandomUserAgent } from './user-agent';

// 获取短剧分类列表
export async function getShortDramaCategories(
  forceRefresh = false,
): Promise<ShortDramaCategory[]> {
  const cacheKey = getCacheKey('categories', {});

  try {
    // 如果强制刷新，先清除缓存
    if (forceRefresh) {
      await clearCategoriesCache();
    }

    const cached = await getCache<ShortDramaCategory[]>(cacheKey);
    if (cached && !forceRefresh) {
      return cached;
    }

    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/categories`;
    const response = await fetch(apiUrl, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // 内部API直接返回数组
    const result = data as
      | { list?: ShortDramaCategory[] }
      | ShortDramaCategory[];
    const categories = Array.isArray(result) ? result : result.list || [];

    // 缓存结果
    await setCache(cacheKey, categories, SHORTDRAMA_CACHE_EXPIRE.categories);
    return categories;
  } catch (error) {
    logger.error('获取短剧分类失败:', error);
    return [];
  }
}

// 获取推荐短剧列表
export async function getRecommendedShortDramas(
  category?: number,
  size = 10,
): Promise<ShortDramaItem[]> {
  const cacheKey = getCacheKey('recommends', { category, size });

  try {
    const cached = await getCache<ShortDramaItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/recommend?${category ? `category=${category}&` : ''}size=${size}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // 内部API已经处理过格式
    const result = data as { list?: ShortDramaItem[] } | ShortDramaItem[];
    const items = Array.isArray(result) ? result : result.list || [];

    // 缓存结果
    await setCache(cacheKey, items, SHORTDRAMA_CACHE_EXPIRE.recommends);
    return items;
  } catch (error) {
    logger.error('获取推荐短剧失败:', error);
    return [];
  }
}

// 获取分类短剧列表（分页）
export async function getShortDramaList(
  page = 1,
  size = 20,
  subCategoryId?: number,
): Promise<{ list: ShortDramaItem[]; hasMore: boolean }> {
  const cacheKey = getCacheKey('lists', { page, size, subCategoryId });

  try {
    const cached = await getCache<{ list: ShortDramaItem[]; hasMore: boolean }>(
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    // 统一使用内部 API
    let apiUrl = `/api/shortdrama/list?page=${page}&size=${size}`;
    if (subCategoryId !== undefined) {
      apiUrl += `&subCategoryId=${subCategoryId}`;
    }
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // 内部API已经处理过格式
    const result = data as { list: ShortDramaItem[]; hasMore: boolean };
    const finalResult = {
      list: result.list || [],
      hasMore: result.hasMore ?? false,
    };

    // 缓存结果 - 第一页缓存时间更长
    const cacheTime =
      page === 1
        ? SHORTDRAMA_CACHE_EXPIRE.lists * 2
        : SHORTDRAMA_CACHE_EXPIRE.lists;

    await setCache(cacheKey, finalResult, cacheTime);
    logger.log(`短剧列表已缓存: page=${page}`);

    return finalResult;
  } catch (error) {
    logger.error('获取短剧列表失败:', error);
    return { list: [], hasMore: false };
  }
}

// 搜索短剧
export async function searchShortDramas(
  query: string,
  page = 1,
  size = 20,
): Promise<{ list: ShortDramaItem[]; hasMore: boolean }> {
  try {
    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/search?query=${encodeURIComponent(query)}&page=${page}&size=${size}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // 内部API已经处理过格式
    const result = (data as
      | { list?: ShortDramaItem[]; hasMore?: boolean }
      | undefined) || { list: [], hasMore: false };
    const finalResult = {
      list: result.list || [],
      hasMore: result.hasMore ?? false,
    };

    return finalResult;
  } catch (error) {
    logger.error('搜索短剧失败:', error);
    return { list: [], hasMore: false };
  }
}

// 使用备用API解析单集视频
async function parseWithAlternativeApi(
  dramaName: string,
  episode: number,
  alternativeApiUrl: string,
): Promise<ShortDramaParseResult> {
  // 备用API返回的视频数据类型
  interface DirectVideoData {
    url: string;
    pic?: string;
    title?: string;
  }

  try {
    // 规范化 API 基础地址，移除末尾斜杠
    const alternativeApiBase = alternativeApiUrl.replace(/\/+$/, '');

    // 检查是否提供了备用API地址
    if (!alternativeApiBase) {
      return {
        code: -1,
        msg: '备用API未启用',
      };
    }

    // Step 1: Search for the drama by name to get drama ID
    const searchUrl = `${alternativeApiBase}/api/v1/drama/dl?dramaName=${encodeURIComponent(dramaName)}`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15秒超时
    });

    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    // 加强数据验证
    if (!searchData || typeof searchData !== 'object') {
      throw new Error('备用API返回数据格式错误');
    }

    if (
      !searchData.data ||
      !Array.isArray(searchData.data) ||
      searchData.data.length === 0
    ) {
      return {
        code: 1,
        msg: `未找到短剧"${dramaName}"`,
      };
    }

    const firstDrama = searchData.data[0];
    if (!firstDrama || !firstDrama.id) {
      throw new Error('备用API返回的短剧数据不完整');
    }

    const dramaId = firstDrama.id;

    // Step 2: Get all episodes for this drama
    const episodesUrl = `${alternativeApiBase}/api/v1/drama/dramas?dramaId=${dramaId}`;
    const episodesResponse = await fetch(episodesUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15秒超时
    });

    if (!episodesResponse.ok) {
      throw new Error(`Episodes fetch failed: ${episodesResponse.status}`);
    }

    const episodesData = await episodesResponse.json();

    // 检查API是否返回错误消息（字符串格式）
    if (typeof episodesData === 'string') {
      if (episodesData.includes('未查询到该剧集')) {
        return {
          code: 1,
          msg: `该短剧暂时无法播放，请稍后再试`,
        };
      }
      return {
        code: 1,
        msg: `视频源暂时不可用`,
      };
    }

    // 验证集数数据
    if (
      !episodesData ||
      !episodesData.data ||
      !Array.isArray(episodesData.data)
    ) {
      return {
        code: 1,
        msg: '视频源暂时不可用',
      };
    }

    if (episodesData.data.length === 0) {
      return {
        code: 1,
        msg: '该短剧暂无可用集数',
      };
    }

    // 注意：episode 参数可能是 0（主API的第一集索引）或 1（从1开始计数）
    // 备用API的数组索引是从0开始的
    let episodeIndex: number;
    if (episode === 0 || episode === 1) {
      // 主API的episode=0 或 episode=1 都对应第一集
      episodeIndex = 0;
    } else {
      // episode >= 2 时，映射到数组索引 episode-1
      episodeIndex = episode - 1;
    }

    if (episodeIndex < 0 || episodeIndex >= episodesData.data.length) {
      return {
        code: 1,
        msg: `集数 ${episode} 不存在（共${episodesData.data.length}集）`,
      };
    }

    // Step 3: 尝试获取视频直链，如果当前集不存在则自动跳到下一集
    // 最多尝试3集（防止无限循环）
    let actualEpisodeIndex = episodeIndex;
    let directData: DirectVideoData | null = null;
    const maxRetries = 3;

    for (let retry = 0; retry < maxRetries; retry++) {
      const currentIndex = episodeIndex + retry;

      // 检查是否超出集数范围
      if (currentIndex >= episodesData.data.length) {
        return {
          code: 1,
          msg: `该集暂时无法播放，请尝试其他集数`,
        };
      }

      const targetEpisode = episodesData.data[currentIndex];
      if (!targetEpisode || !targetEpisode.id) {
        continue;
      }

      const episodeId = targetEpisode.id;
      const directUrl = `${alternativeApiBase}/api/v1/drama/direct?episodeId=${episodeId}`;

      try {
        const directResponse = await fetch(directUrl, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(15000), // 15秒超时
        });

        if (!directResponse.ok) {
          continue;
        }

        const data = await directResponse.json();

        // 检查是否返回 "未查询到该剧集" 错误
        if (typeof data === 'string' && data.includes('未查询到该剧集')) {
          continue;
        }

        // 验证播放链接数据
        if (!data || !data.url) {
          continue;
        }

        // 成功获取到视频链接
        directData = data;
        actualEpisodeIndex = currentIndex;
        break;
      } catch {
        continue;
      }
    }

    // 如果所有尝试都失败
    if (!directData || !directData.url) {
      return {
        code: 1,
        msg: `该集暂时无法播放，请尝试其他集数`,
      };
    }

    // 将 http:// 转换为 https:// 避免 Mixed Content 错误
    const videoUrl = (directData.url || '').replace(/^http:\/\//i, 'https://');

    // 备用API的视频链接通过代理访问（避免防盗链限制）
    const proxyUrl = `/api/proxy/shortdrama?url=${encodeURIComponent(videoUrl)}`;

    // 计算实际播放的集数（从1开始）
    const actualEpisode = actualEpisodeIndex + 1;

    return {
      code: 0,
      data: {
        videoId: dramaId,
        videoName: firstDrama.name,
        currentEpisode: actualEpisode, // 使用实际播放的集数
        totalEpisodes: episodesData.data.length,
        parsedUrl: proxyUrl,
        proxyUrl: proxyUrl,
        cover: directData.pic || firstDrama.pic || '',
        description: firstDrama.overview || '',
        episode: {
          index: actualEpisode, // 使用实际播放的集数
          label: `第${actualEpisode}集`,
          parsedUrl: proxyUrl,
          proxyUrl: proxyUrl,
          title: directData.title || `第${actualEpisode}集`,
        },
      },
      // 额外的元数据供其他地方使用
      metadata: {
        author: firstDrama.author || '',
        backdrop: firstDrama.backdrop || firstDrama.pic || '',
        vote_average: firstDrama.vote_average || 0,
        tmdb_id: firstDrama.tmdb_id || undefined,
      },
    };
  } catch (error) {
    logger.error('备用API解析失败:', error);
    // 返回更详细的错误信息
    return {
      code: -1,
      msg: `视频源暂时不可用，请稍后再试`,
    };
  }
}

// 解析单集视频（支持跨域代理，自动fallback到备用API）
export async function parseShortDramaEpisode(
  id: number,
  episode: number,
  useProxy = true,
  dramaName?: string,
  alternativeApiUrl?: string,
): Promise<ShortDramaParseResult> {
  // 如果提供了剧名和备用API，优先尝试备用API（因为主API链接经常失效）
  if (dramaName && alternativeApiUrl) {
    try {
      const alternativeResult = await parseWithAlternativeApi(
        dramaName,
        episode,
        alternativeApiUrl,
      );
      if (alternativeResult.code === 0) {
        return alternativeResult;
      }
    } catch {
      // 备用API失败，继续尝试主API
    }
  }

  try {
    const params = new URLSearchParams({
      id: id.toString(), // API需要string类型的id
      episode: episode.toString(), // episode从1开始
    });

    if (useProxy) {
      params.append('proxy', 'true');
    }

    const timestamp = Date.now();
    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/parse?${params.toString()}&_t=${timestamp}`;

    const fetchOptions: RequestInit = {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    };

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // API可能返回错误信息
    if (data.code === 1) {
      // 如果主API失败且提供了剧名和备用API地址，尝试使用备用API
      if (dramaName && alternativeApiUrl) {
        return await parseWithAlternativeApi(
          dramaName,
          episode,
          alternativeApiUrl,
        );
      }
      return {
        code: data.code,
        msg: data.msg || '该集暂时无法播放，请稍后再试',
      };
    }

    // API成功时，检查是否有有效的视频链接
    const parsedUrl = data.episode?.parsedUrl || data.parsedUrl || '';

    // 如果主API返回成功但没有有效链接，尝试备用API
    if (!parsedUrl && dramaName && alternativeApiUrl) {
      return await parseWithAlternativeApi(
        dramaName,
        episode,
        alternativeApiUrl,
      );
    }

    // API成功时直接返回数据对象，根据实际结构解析
    return {
      code: 0,
      data: {
        videoId: data.videoId || id,
        videoName: data.videoName || '',
        currentEpisode: data.episode?.index || episode,
        totalEpisodes: data.totalEpisodes || 1,
        parsedUrl: parsedUrl,
        proxyUrl: data.episode?.proxyUrl || '', // proxyUrl在episode对象内
        cover: data.cover || '',
        description: data.description || '',
        episode: data.episode || null, // 保留原始episode对象
      },
    };
  } catch {
    // 如果主API网络请求失败且提供了剧名和备用API地址，尝试使用备用API
    if (dramaName && alternativeApiUrl) {
      return await parseWithAlternativeApi(
        dramaName,
        episode,
        alternativeApiUrl,
      );
    }
    return {
      code: -1,
      msg: '网络连接失败，请检查网络后重试',
    };
  }
}

// 批量解析多集视频
export async function parseShortDramaBatch(
  id: number,
  episodes: number[],
  useProxy = true,
): Promise<ShortDramaParseResult[]> {
  try {
    const params = new URLSearchParams({
      id: id.toString(),
      episodes: episodes.join(','),
    });

    if (useProxy) {
      params.append('proxy', 'true');
    }

    const timestamp = Date.now();
    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/parse?${params.toString()}&_t=${timestamp}`;

    const fetchOptions: RequestInit = {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    };

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    logger.error('批量解析短剧失败:', error);
    return [];
  }
}

// 解析整部短剧所有集数
export async function parseShortDramaAll(
  id: number,
  useProxy = true,
): Promise<ShortDramaParseResult[]> {
  try {
    const params = new URLSearchParams({
      id: id.toString(),
    });

    if (useProxy) {
      params.append('proxy', 'true');
    }

    const timestamp = Date.now();
    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/parse?${params.toString()}&_t=${timestamp}`;

    const fetchOptions: RequestInit = {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    };

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    logger.error('解析完整短剧失败:', error);
    return [];
  }
}
