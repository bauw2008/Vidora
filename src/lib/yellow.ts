import { logger } from '@/lib/logger';

import { getConfig } from './config';

// 内存缓存
let cachedYellowWords: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = process.env.NODE_ENV === 'production' ? 60000 : 30000; // 生产环境1分钟，开发环境30秒

// 获取过滤词的函数，带内存缓存
export async function getYellowWords(): Promise<string[]> {
  // 开发环境每次都重新获取，便于调试
  if (process.env.NODE_ENV === 'development') {
    const config = await getConfig();
    return config.YellowWords || [];
  }

  // 生产环境使用缓存
  if (cachedYellowWords && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedYellowWords;
  }

  try {
    const config = await getConfig();
    cachedYellowWords = config.YellowWords || [];
    cacheTimestamp = Date.now();
    logger.log('18+词汇缓存已更新，数量:', cachedYellowWords.length);
    return cachedYellowWords;
  } catch (error) {
    logger.error('获取过滤词配置失败:', error);
    // 出错时返回缓存或空数组，避免阻塞搜索
    return cachedYellowWords || [];
  }
}

// 检查内容是否包含过滤词的函数
export async function containsYellowWords(text: string): Promise<boolean> {
  try {
    const yellowWords = await getYellowWords();
    if (!text || !yellowWords || yellowWords.length === 0) {
      return false;
    }

    const lowerText = text.toLowerCase();
    return yellowWords.some((word) => lowerText.includes(word.toLowerCase()));
  } catch (error) {
    logger.error('检查过滤词失败:', error);
    return false;
  }
}

// 清除缓存函数，供配置更新时调用
export function clearYellowWordsCache(): void {
  cachedYellowWords = null;
  cacheTimestamp = 0;
  logger.log('18+词汇缓存已清除');
}
