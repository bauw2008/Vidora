'use client';

import { logger } from '@/lib/logger';

import {
  generateStorageKey,
  getAllFavorites,
  getAllPlayRecords,
  PlayRecord,
} from './db.client';

// 缓存键
const WATCHING_UPDATES_CACHE_KEY = 'vidora_watching_updates';
const LAST_CHECK_TIME_KEY = 'vidora_last_update_check';
const ORIGINAL_EPISODES_CACHE_KEY = 'vidora_original_episodes'; // 新增：记录观看时的总集数
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 全局锁，防止同时多个检查
let isCheckingUpdates = false;
let lastCheckTime = 0;
const CHECK_DEBOUNCE = 30000; // 30秒内只允许检查一次

// 事件去重
let lastEventTime = 0;
const EVENT_DEBOUNCE = 5000; // 5秒内只触发一次事件

// 事件名称
export const WATCHING_UPDATES_EVENT = 'watchingUpdatesChanged';

// 更新信息接口
export interface WatchingUpdate {
  hasUpdates: boolean;
  timestamp: number;
  updatedCount: number;
  continueWatchingCount: number; // 新增：需要继续观看的剧集数量
  updatedSeries: {
    title: string;
    source_name: string;
    year: string;
    cover: string; // 添加封面属性
    sourceKey: string; // 添加source key
    videoId: string; // 添加video id
    currentEpisode: number;
    totalEpisodes: number;
    hasNewEpisode: boolean;
    hasContinueWatching: boolean; // 新增：是否需要继续观看
    newEpisodes?: number;
    remainingEpisodes?: number; // 新增：剩余集数
    latestEpisodes?: number;
    remarks?: string; // 备注信息（如"已完结"）
  }[];
}

interface WatchingUpdatesCache {
  hasUpdates: boolean;
  timestamp: number;
  updatedCount: number;
  continueWatchingCount: number;
  updatedSeries: WatchingUpdate['updatedSeries'];
}

// 全局事件监听器
const updateListeners = new Set<(hasUpdates: boolean) => void>();

/**
 * 检查追番更新
 * 只检查收藏的剧集，优化性能
 */
export async function checkWatchingUpdates(): Promise<void> {
  // 全局锁检查
  if (isCheckingUpdates) {
    logger.log('已有更新检查在进行中，跳过本次检查');
    return;
  }

  // 防抖检查
  const now = Date.now();
  if (now - lastCheckTime < CHECK_DEBOUNCE) {
    logger.log('检查过于频繁，跳过本次检查');
    return;
  }
  lastCheckTime = now;
  isCheckingUpdates = true;

  try {
    logger.log('开始检查收藏剧集更新...');

    // 获取收藏列表
    const favoritesObj = await getAllFavorites();
    const favorites = Object.entries(favoritesObj).map(([key, fav]) => ({
      ...fav,
      key,
    }));

    if (favorites.length === 0) {
      logger.log('没有收藏内容，跳过检查');
      const emptyResult: WatchingUpdate = {
        hasUpdates: false,
        timestamp: now,
        updatedCount: 0,
        continueWatchingCount: 0,
        updatedSeries: [],
      };
      cacheWatchingUpdates(emptyResult);
      localStorage.setItem(LAST_CHECK_TIME_KEY, now.toString());
      notifyListeners(false);
      return;
    }

    // 筛选多集剧的收藏记录
    const candidateRecords = favorites.filter((fav) => {
      return fav.total_episodes > 1;
    });

    if (candidateRecords.length === 0) {
      logger.log('没有多集剧收藏，跳过检查');
      const emptyResult: WatchingUpdate = {
        hasUpdates: false,
        timestamp: now,
        updatedCount: 0,
        continueWatchingCount: 0,
        updatedSeries: [],
      };
      cacheWatchingUpdates(emptyResult);
      localStorage.setItem(LAST_CHECK_TIME_KEY, now.toString());
      notifyListeners(false);
      return;
    }

    logger.log(`检查 ${candidateRecords.length} 个收藏的多集剧...`);

    let hasAnyUpdates = false;
    let updatedCount = 0;
    let continueWatchingCount = 0;
    const updatedSeries: WatchingUpdate['updatedSeries'] = [];

    // 优化：批量检查所有收藏的更新状态，避免并发过多导致500错误
    const batchSize = 3; // 每批处理3个请求
    const batchDelay = 500; // 批次间延迟500ms

    for (let i = 0; i < candidateRecords.length; i += batchSize) {
      const batch = candidateRecords.slice(i, i + batchSize);

      const batchPromises = batch.map(async (fav) => {
        try {
          // 从存储key中解析出videoId
          const plusIndex = fav.key.indexOf('+');
          const sourceName = fav.key.slice(0, plusIndex);
          const videoId = fav.key.slice(plusIndex + 1);

          // 获取播放记录（用于获取当前观看集数）
          const recordsObj = await getAllPlayRecords();
          const recordKey = generateStorageKey(sourceName, videoId);
          const playRecord = recordsObj[recordKey];

          // 构造一个 PlayRecord 对象用于检查
          const record: PlayRecord = {
            id: videoId,
            source: sourceName,
            title: fav.title,
            source_name: fav.source_name,
            year: fav.year,
            cover: fav.cover,
            total_episodes: fav.total_episodes,
            index: playRecord?.index || 0,
            play_time: playRecord?.play_time || 0,
            total_time: playRecord?.total_time || 0,
            save_time: fav.save_time,
            search_title: fav.search_title,
            type: fav.type,
            remarks: playRecord?.remarks,
          };

          const updateInfo = await checkSingleRecordUpdate(
            record,
            videoId,
            sourceName,
          );

          const seriesInfo = {
            title: fav.title,
            source_name: fav.source_name,
            year: fav.year,
            cover: fav.cover,
            sourceKey: sourceName,
            videoId: videoId,
            currentEpisode: record.index,
            totalEpisodes: updateInfo.latestEpisodes,
            hasNewEpisode: updateInfo.hasUpdate,
            hasContinueWatching: updateInfo.hasContinueWatching,
            newEpisodes: updateInfo.newEpisodes,
            remainingEpisodes: updateInfo.remainingEpisodes,
            latestEpisodes: updateInfo.latestEpisodes,
            remarks: playRecord?.remarks,
          };

          updatedSeries.push(seriesInfo);

          if (updateInfo.hasUpdate) {
            hasAnyUpdates = true;
            updatedCount++;
          }

          if (updateInfo.hasContinueWatching) {
            hasAnyUpdates = true;
            continueWatchingCount++;
          }
          return seriesInfo;
        } catch (error) {
          logger.error(`检查 ${fav.title} 更新失败:`, error);
          // 返回默认状态
          const plusIndex = fav.key.indexOf('+');
          const sourceName = fav.key.slice(0, plusIndex);
          const videoId = fav.key.slice(plusIndex + 1);

          const seriesInfo = {
            title: fav.title,
            source_name: fav.source_name,
            year: fav.year,
            cover: fav.cover,
            sourceKey: sourceName,
            videoId: videoId,
            currentEpisode: 0,
            totalEpisodes: fav.total_episodes,
            hasNewEpisode: false,
            hasContinueWatching: false,
            newEpisodes: 0,
            remainingEpisodes: 0,
            latestEpisodes: fav.total_episodes,
            remarks: undefined,
          };
          updatedSeries.push(seriesInfo);
          return seriesInfo;
        }
      });

      await Promise.all(batchPromises);

      // 如果不是最后一批，添加延迟
      if (i + batchSize < candidateRecords.length) {
        await new Promise((resolve) => setTimeout(resolve, batchDelay));
      }
    }

    // 缓存结果
    const result: WatchingUpdate = {
      hasUpdates: hasAnyUpdates,
      timestamp: now,
      updatedCount,
      continueWatchingCount,
      updatedSeries,
    };

    cacheWatchingUpdates(result);
    localStorage.setItem(LAST_CHECK_TIME_KEY, now.toString());

    logger.log(
      `检查完成: ${candidateRecords.length} 个收藏, ${updatedCount} 个有更新`,
    );

    // 通知监听器
    notifyListeners(hasAnyUpdates);

    // 触发全局事件（带去重）
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(WATCHING_UPDATES_EVENT, {
          detail: { hasUpdates: hasAnyUpdates, updatedCount },
        }),
      );
    }
  } catch (error) {
    logger.error('检查追番更新失败:', error);
    notifyListeners(false);
  } finally {
    isCheckingUpdates = false;
  }
}

/**
 * 检查单个剧集的更新状态（调用真实API）
 */
async function checkSingleRecordUpdate(
  record: PlayRecord,
  videoId: string,
  storageSourceName?: string,
): Promise<{
  hasUpdate: boolean;
  hasContinueWatching: boolean;
  newEpisodes: number;
  remainingEpisodes: number;
  latestEpisodes: number;
}> {
  try {
    let sourceKey = record.source_name;

    // 先尝试获取可用数据源进行映射
    try {
      const sourcesResponse = await fetch('/api/sources');
      if (sourcesResponse.ok) {
        const sources = await sourcesResponse.json();

        // 查找匹配的数据源
        const matchedSource = sources.find(
          (source: { key: string; name: string }) =>
            source.key === record.source_name ||
            source.name === record.source_name,
        );

        if (matchedSource) {
          sourceKey = matchedSource.key;
        }
      }
    } catch {
      // 数据源映射失败，使用原始名称
    }

    // 使用映射后的key调用API（API已默认不缓存，确保集数信息实时更新）
    const apiUrl = `/api/detail?source=${sourceKey}&id=${videoId}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      return {
        hasUpdate: false,
        hasContinueWatching: false,
        newEpisodes: 0,
        remainingEpisodes: 0,
        latestEpisodes: record.total_episodes,
      };
    }

    const detailData = await response.json();
    const latestEpisodes = detailData.episodes ? detailData.episodes.length : 0;

    // 获取观看时的原始总集数（不会被自动更新影响）
    const recordKey = generateStorageKey(
      storageSourceName || record.source_name,
      videoId,
    );
    const originalTotalEpisodes = await getOriginalEpisodes(
      record,
      videoId,
      recordKey,
    );

    // 检查新集数更新：API返回的集数比当前播放记录的总集数多
    const hasUpdate = latestEpisodes > originalTotalEpisodes;
    const newEpisodes = hasUpdate ? latestEpisodes - originalTotalEpisodes : 0;

    // 计算保护后的集数（防止API缓存问题导致集数回退）
    const protectedTotalEpisodes = Math.max(
      latestEpisodes,
      originalTotalEpisodes,
      record.total_episodes,
    );

    // 继续观看提醒：用户还没看完现有集数（使用保护后的集数）
    const hasContinueWatching = record.index < protectedTotalEpisodes;
    const remainingEpisodes = hasContinueWatching
      ? protectedTotalEpisodes - record.index
      : 0;

    return {
      hasUpdate,
      hasContinueWatching,
      newEpisodes,
      remainingEpisodes,
      latestEpisodes: protectedTotalEpisodes,
    };
  } catch (error) {
    logger.error(`检查${record.title}更新失败:`, error);
    return {
      hasUpdate: false,
      hasContinueWatching: false,
      newEpisodes: 0,
      remainingEpisodes: 0,
      latestEpisodes: record.total_episodes,
    };
  }
}

/**
 * 获取观看时的原始总集数
 * 优化：减少不必要的 API 调用，优先使用内存中的值
 */
async function getOriginalEpisodes(
  record: PlayRecord,
  videoId: string,
  recordKey: string,
): Promise<number> {
  // 优先使用内存中的 original_episodes
  if (record.original_episodes && record.original_episodes > 0) {
    return record.original_episodes;
  }

  // 如果内存中没有，尝试从数据库读取（只在必要时调用）
  try {
    const freshRecordsResponse = await fetch('/api/playrecords');
    if (freshRecordsResponse.ok) {
      const freshRecords = await freshRecordsResponse.json();
      const freshRecord = freshRecords[recordKey];

      if (freshRecord?.original_episodes && freshRecord.original_episodes > 0) {
        return freshRecord.original_episodes;
      }
    }
  } catch {
    // 从数据库读取失败，继续使用 fallback
  }

  // 如果数据库中也没有，使用当前 total_episodes
  if (record.total_episodes > 0) {
    return record.total_episodes;
  }

  // 都没有的话，尝试从localStorage读取（向后兼容）
  try {
    const cached = localStorage.getItem(ORIGINAL_EPISODES_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (data[recordKey] !== undefined) {
        return data[recordKey];
      }
    }
  } catch {
    // 从localStorage读取失败
  }

  return record.total_episodes;
}

/**
 * 获取缓存的更新信息
 */
export function getCachedWatchingUpdates(): boolean {
  try {
    const cached = localStorage.getItem(WATCHING_UPDATES_CACHE_KEY);
    if (!cached) return false;

    const data: WatchingUpdatesCache = JSON.parse(cached);
    const isExpired = Date.now() - data.timestamp > CACHE_DURATION;

    return isExpired ? false : data.hasUpdates;
  } catch (error) {
    logger.error('读取更新缓存失败:', error);
    return false;
  }
}

/**
 * 缓存更新信息
 */
function cacheWatchingUpdates(data: WatchingUpdate): void {
  try {
    const cacheData: WatchingUpdatesCache = {
      hasUpdates: data.hasUpdates,
      timestamp: data.timestamp,
      updatedCount: data.updatedCount,
      continueWatchingCount: data.continueWatchingCount,
      updatedSeries: data.updatedSeries,
    };
    localStorage.setItem(WATCHING_UPDATES_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    logger.error('缓存更新信息失败:', error);
  }
}

/**
 * 订阅更新通知
 */
export function subscribeToWatchingUpdates(
  callback: (hasUpdates: boolean) => void,
): () => void {
  updateListeners.add(callback);

  // 返回取消订阅函数
  return () => {
    updateListeners.delete(callback);
  };
}

/**
 * 通知所有监听器（带去重）
 */
function notifyListeners(hasUpdates: boolean): void {
  const now = Date.now();
  if (now - lastEventTime < EVENT_DEBOUNCE) {
    logger.log('事件触发过于频繁，跳过本次通知');
    return;
  }
  lastEventTime = now;

  updateListeners.forEach((callback) => {
    try {
      callback(hasUpdates);
    } catch (error) {
      logger.error('通知更新监听器失败:', error);
    }
  });
}

/**
 * 设置定期检查
 * @param intervalMinutes 检查间隔（分钟）
 */
export function setupPeriodicUpdateCheck(intervalMinutes = 30): () => void {
  // 立即执行一次检查
  checkWatchingUpdates();

  // 设置定期检查
  const intervalId = setInterval(
    () => {
      checkWatchingUpdates();
    },
    intervalMinutes * 60 * 1000,
  );

  // 返回清理函数
  return () => {
    clearInterval(intervalId);
  };
}

/**
 * 页面可见性变化时自动检查更新
 */
export function setupVisibilityChangeCheck(): () => void {
  if (typeof window === 'undefined') {
    // 服务器端渲染时返回空操作函数
    return () => void 0;
  }

  const handleVisibilityChange = () => {
    if (!document.hidden) {
      // 页面变为可见时检查更新
      checkWatchingUpdates();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

/**
 * 获取详细的更新信息
 */
export function getDetailedWatchingUpdates(): WatchingUpdate | null {
  try {
    const cached = localStorage.getItem(WATCHING_UPDATES_CACHE_KEY);
    if (!cached) {
      return null;
    }

    const data: WatchingUpdatesCache = JSON.parse(cached);
    const isExpired = Date.now() - data.timestamp > CACHE_DURATION;

    if (isExpired) {
      return null;
    }

    const result = {
      hasUpdates: data.hasUpdates,
      timestamp: data.timestamp,
      updatedCount: data.updatedCount,
      continueWatchingCount: data.continueWatchingCount,
      updatedSeries: data.updatedSeries,
    };
    return result;
  } catch (error) {
    logger.error('读取详细更新信息失败:', error);
    return null;
  }
}

/**
 * 手动标记已查看更新
 */
export function markUpdatesAsViewed(): void {
  try {
    const data = getDetailedWatchingUpdates();
    if (data) {
      const updatedData: WatchingUpdate = {
        ...data,
        hasUpdates: false,
        updatedCount: 0,
        updatedSeries: data.updatedSeries.map((series) => ({
          ...series,
          hasNewEpisode: false,
        })),
      };
      cacheWatchingUpdates(updatedData);
      notifyListeners(false);

      // 触发全局事件
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(WATCHING_UPDATES_EVENT, {
            detail: { hasUpdates: false, updatedCount: 0 },
          }),
        );
      }
    }
  } catch (error) {
    logger.error('标记更新为已查看失败:', error);
  }
}

/**
 * 清除新集数更新状态（来自Alpha版本）
 */
export function clearWatchingUpdates(): void {
  try {
    localStorage.removeItem(WATCHING_UPDATES_CACHE_KEY);
    localStorage.removeItem(LAST_CHECK_TIME_KEY);

    // 通知监听器
    notifyListeners(false);

    // 触发事件通知状态变化
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(WATCHING_UPDATES_EVENT, {
          detail: { hasUpdates: false, updatedCount: 0 },
        }),
      );
    }
  } catch (error) {
    logger.error('清除新集数更新状态失败:', error);
  }
}

/**
 * 检查特定视频的更新状态（用于视频详情页面）
 */
export async function checkVideoUpdate(
  sourceName: string,
  videoId: string,
): Promise<void> {
  try {
    // 检查是否在收藏中
    const favoritesObj = await getAllFavorites();
    const storageKey = generateStorageKey(sourceName, videoId);
    const targetFavorite = favoritesObj[storageKey];

    if (!targetFavorite) {
      // 不在收藏中，不检查更新
      return;
    }

    // 获取播放记录
    const recordsObj = await getAllPlayRecords();
    const targetRecord = recordsObj[storageKey];

    // 构造一个 PlayRecord 对象用于检查
    const record: PlayRecord = {
      id: videoId,
      source: sourceName,
      title: targetFavorite.title,
      source_name: targetFavorite.source_name,
      year: targetFavorite.year,
      cover: targetFavorite.cover,
      total_episodes: targetFavorite.total_episodes,
      index: targetRecord?.index || 0,
      play_time: targetRecord?.play_time || 0,
      total_time: targetRecord?.total_time || 0,
      save_time: targetFavorite.save_time,
      search_title: targetFavorite.search_title,
      type: targetFavorite.type,
      remarks: targetRecord?.remarks,
    };

    const updateInfo = await checkSingleRecordUpdate(
      record,
      videoId,
      sourceName,
    );

    if (updateInfo.hasUpdate) {
      // 如果发现这个视频有更新，重新检查所有收藏的更新状态
      await checkWatchingUpdates();
    }
  } catch {
    // 检查视频更新失败
  }
}

/**
 * 订阅新集数更新事件（来自Alpha版本）
 */
export function subscribeToWatchingUpdatesEvent(
  callback: (hasUpdates: boolean, updatedCount: number) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => void 0;
  }

  const handleUpdate = (event: CustomEvent) => {
    const { hasUpdates, updatedCount } = event.detail;
    callback(hasUpdates, updatedCount);
  };

  window.addEventListener(
    WATCHING_UPDATES_EVENT,
    handleUpdate as EventListener,
  );

  return () => {
    window.removeEventListener(
      WATCHING_UPDATES_EVENT,
      handleUpdate as EventListener,
    );
  };
}
