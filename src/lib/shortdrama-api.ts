/* @typescript-eslint/no-explicit-any */

import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { getRandomUserAgent } from '@/lib/user-agent';

export interface ShortDramaApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ShortDramaCategory {
  id: number;
  name: string;
  created_at?: string;
}

export interface ShortDramaSubCategory {
  id: number;
  name: string;
  category_id: number | null;
}

export interface ShortDramaItem {
  vod_id: number;
  name: string;
  cover: string;
  description?: string;
  episode_count?: number;
  updated_at?: string;
  score?: number;
  actor?: string;
  director?: string;
  year?: string;
  area?: string;
  lang?: string;
  remarks?: string;
  writer?: string;
  hits?: number;
}

export interface ShortDramaDetail {
  vod_id: number;
  name: string;
  cover: string;
  description?: string;
  episode_count: number;
  play_urls?: {
    episode: number;
    url: string;
  }[];
  year?: string;
  actor?: string;
  director?: string;
  writer?: string;
  area?: string;
  remarks?: string;
  hits?: number;
  score?: number;
}

export interface ShortDramaPlayData {
  url: string;
  episode: number;
  totalEpisodes: number;
  name: string;
  cover: string;
  description?: string;
}

/**
 * 统一的短剧API调用函数
 * 自动处理认证、错误重试、响应转换
 */
export async function callShortDramaAPI<T = unknown>(
  endpoint: string,
  options?: {
    method?: 'GET' | 'POST';
    params?: Record<string, string | number>;
    body?: unknown;
    timeout?: number;
  },
): Promise<ShortDramaApiResponse<T>> {
  const config = await getConfig();
  const shortDramaConfig = config.ShortDramaConfig;

  if (!shortDramaConfig?.apiUrl) {
    return {
      success: false,
      error: '短剧API未配置',
    };
  }

  const { apiUrl, apiKey, authEnabled } = shortDramaConfig;
  const { method = 'GET', params, body, timeout = 30000 } = options || {};

  try {
    const url = new URL(`${apiUrl}/api${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': getRandomUserAgent(),
      Accept: 'application/json',
    };

    // 添加认证头
    if (authEnabled && apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      logger.log(`短剧API请求已启用认证: ${endpoint}`);
      logger.log(
        `使用API Key: ${apiKey.substring(0, 4)}****${apiKey.substring(apiKey.length - 4)}`,
      );
    } else if (authEnabled && !apiKey) {
      logger.warn(`短剧API认证已启用但未配置API Key: ${endpoint}`);
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(timeout),
    };

    if (body && method === 'POST') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`短剧API请求失败 [${response.status}]: ${url.toString()}`);
      logger.error(`响应内容: ${errorText}`);
      logger.error(`请求头: ${JSON.stringify(headers)}`);
      return {
        success: false,
        error: `API请求失败 (${response.status}): ${errorText}`,
      };
    }

    const data = await response.json();

    // 新API返回格式: { success: true, data: {...} }
    if (data.success === false) {
      return {
        success: false,
        error: data.error || 'API返回错误',
      };
    }

    return {
      success: true,
      data: data.data,
      pagination: data.pagination,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    logger.error('短剧API调用异常:', error);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * 获取分类列表
 */
export async function getShortDramaCategories(): Promise<ShortDramaCategory[]> {
  const result = await callShortDramaAPI<ShortDramaCategory[]>('/categories');

  if (!result.success || !result.data) {
    logger.error('获取短剧分类失败:', result.error);
    return [];
  }

  return result.data;
}

/**
 * 获取二级分类列表
 */
export async function getShortDramaSubCategories(
  categoryId?: number,
): Promise<ShortDramaSubCategory[]> {
  const params: Record<string, string | number> = {};

  if (categoryId !== undefined) {
    params.categoryId = categoryId;
  }

  const result = await callShortDramaAPI<ShortDramaSubCategory[]>(
    '/sub-categories',
    {
      params,
    },
  );

  if (!result.success || !result.data) {
    logger.error('获取短剧二级分类失败:', result.error);
    return [];
  }

  return result.data;
}

/**
 * 获取视频列表
 * 注意：数据库中使用 sub_category_id 进行筛选，category_id 为空值
 */
export async function getShortDramaList(
  page = 1,
  pageSize = 20,
  subCategoryId?: number,
): Promise<{ list: ShortDramaItem[]; hasMore: boolean; total?: number }> {
  const params: Record<string, string | number> = {
    page,
    pageSize,
  };

  // 只传递 subCategoryId，因为数据库中 category_id 是空的
  if (subCategoryId !== undefined) {
    params.subCategoryId = subCategoryId;
  }

  const result = await callShortDramaAPI<ShortDramaItem[]>('/list', { params });

  if (!result.success || !result.data) {
    logger.error('获取短剧列表失败:', result.error);
    return { list: [], hasMore: false };
  }

  const totalPages = result.pagination?.totalPages || 0;
  const total = result.pagination?.total || 0;

  return {
    list: result.data,
    hasMore: page < totalPages,
    total,
  };
}

/**
 * 搜索视频
 */
export async function searchShortDramas(
  keyword: string,
  page = 1,
  pageSize = 20,
): Promise<{ list: ShortDramaItem[]; hasMore: boolean; total?: number }> {
  const result = await callShortDramaAPI<ShortDramaItem[]>('/search', {
    params: { keyword, page, pageSize },
  });

  if (!result.success || !result.data) {
    logger.error('搜索短剧失败:', result.error);
    return { list: [], hasMore: false };
  }

  const totalPages = result.pagination?.totalPages || 0;
  const total = result.pagination?.total || 0;

  return {
    list: result.data,
    hasMore: page < totalPages,
    total,
  };
}

/**
 * 获取推荐视频
 */
export async function getRecommendedShortDramas(
  categoryId?: number,
  size = 10,
): Promise<ShortDramaItem[]> {
  const params: Record<string, string | number> = { size };

  if (categoryId !== undefined) {
    params.categoryId = categoryId;
  }

  const result = await callShortDramaAPI<ShortDramaItem[]>('/recommend', {
    params,
  });

  if (!result.success || !result.data) {
    logger.error('获取推荐短剧失败:', result.error);
    return [];
  }

  return result.data;
}

/**
 * 获取视频详情
 */
export async function getShortDramaDetail(
  vodId: number,
): Promise<ShortDramaDetail | null> {
  const result = await callShortDramaAPI<ShortDramaDetail>('/detail', {
    params: { vodId },
  });

  if (!result.success || !result.data) {
    logger.error('获取短剧详情失败:', result.error);
    return null;
  }

  return result.data;
}

/**
 * 获取播放链接
 * 注意：episode 参数从 0 开始，API 需要从 1 开始，所以调用时要 +1
 */
export async function getShortDramaPlayUrl(
  vodId: number,
  episode: number,
): Promise<ShortDramaPlayData | null> {
  // 先获取视频详情，包含播放链接
  const detail = await getShortDramaDetail(vodId);

  if (!detail || !detail.play_urls || detail.play_urls.length === 0) {
    logger.error('获取短剧播放链接失败: 没有播放数据');
    return null;
  }

  // 找到对应集数的播放链接
  const playUrl = detail.play_urls.find((p) => p.episode === episode + 1);

  if (!playUrl) {
    logger.error(`获取短剧播放链接失败: 集数 ${episode + 1} 不存在`);
    return null;
  }

  return {
    url: playUrl.url,
    episode: episode,
    totalEpisodes: detail.episode_count,
    name: detail.name,
    cover: detail.cover,
    description: detail.description,
  };
}
