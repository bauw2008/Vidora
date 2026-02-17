'use client';

import {
  AlertTriangle,
  Clock,
  Database,
  FileText,
  Film,
  Folder,
  PlayIcon,
  RefreshCw,
  Trash2,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  useAdminAuth,
  useAdminLoading,
  useToastNotification,
} from '@/hooks/admin';

interface CacheStats {
  douban: { count: number; size: number; types: Record<string, number> };
  shortdrama: { count: number; size: number; types: Record<string, number> };
  tmdb: { count: number; size: number; types: Record<string, number> };
  danmu: { count: number; size: number };
  netdisk: { count: number; size: number };
  search: { count: number; size: number };
  tvbox: { count: number; size: number };
  other: { count: number; size: number };
  total: { count: number; size: number };
  timestamp: string;
  formattedSizes: {
    douban: string;
    shortdrama: string;
    tmdb: string;
    danmu: string;
    netdisk: string;
    search: string;
    tvbox: string;
    other: string;
    total: string;
  };
}

interface CacheType {
  key: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  color: string;
}

const CACHE_TYPES: CacheType[] = [
  {
    key: 'douban',
    name: '豆瓣数据',
    description: '电影/电视剧详情、分类、推荐、短剧等数据缓存',
    icon: Film,
    color: 'text-green-600 bg-green-100',
  },
  {
    key: 'shortdrama',
    name: '短剧数据',
    description: '短剧分类、推荐、列表、集数等数据缓存',
    icon: PlayIcon,
    color: 'text-orange-600 bg-orange-100',
  },
  {
    key: 'tmdb',
    name: 'TMDB数据',
    description: 'TMDB演员搜索、作品信息等数据缓存',
    icon: Film,
    color: 'text-purple-600 bg-purple-100',
  },
  {
    key: 'danmu',
    name: '弹幕数据',
    description: '外部弹幕API获取的弹幕内容缓存',
    icon: FileText,
    color: 'text-blue-600 bg-blue-100',
  },
  {
    key: 'netdisk',
    name: '网盘搜索',
    description: '网盘搜索结果缓存（百度、阿里、夸克等）',
    icon: Folder,
    color: 'text-purple-600 bg-purple-100',
  },
  {
    key: 'search',
    name: '搜索缓存',
    description: '各类搜索结果缓存',
    icon: Video,
    color: 'text-yellow-600 bg-yellow-100',
  },
  {
    key: 'tvbox',
    name: 'TVBox缓存',
    description: 'TVBox视频源、分类和频率限制缓存',
    icon: Film,
    color: 'text-red-600 bg-red-100',
  },
  {
    key: 'other',
    name: '其他缓存',
    description: '系统其他临时数据缓存',
    icon: Database,
    color: 'text-gray-600 bg-gray-100',
  },
];

function CacheManager() {
  // 使用统一的权限管理
  const { error, isOwner } = useAdminAuth();
  // 使用统一的加载状态管理
  const { withLoading, isLoading } = useAdminLoading();
  // 使用统一的 Toast 通知
  const { showError, showSuccess } = useToastNotification();

  const [stats, setStats] = useState<CacheStats | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // 使用 ref 跟踪是否已经加载过
  const hasLoaded = useRef(false);

  const fetchStats = useCallback(async () => {
    await withLoading('fetchStats', async () => {
      try {
        const resp = await fetch('/api/admin/cache');
        if (!resp.ok) {
          if (resp.status === 401) {
            throw new Error('无权访问缓存管理');
          }
          throw new Error('获取缓存统计失败');
        }
        const response = await resp.json();

        if (response.success) {
          setStats(response.data);
          setLastRefresh(new Date());
        } else {
          throw new Error(response.error);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : '获取缓存统计失败';
        showError('获取缓存统计失败: ' + errorMessage);
      }
    });
  }, [withLoading, showError]);

  // 组件挂载时获取统计数据
  useEffect(() => {
    if (isOwner && !hasLoaded.current) {
      hasLoaded.current = true;
      fetchStats();
    }
  }, [isOwner, fetchStats]);

  const clearCache = async (type: string) => {
    const typeName = CACHE_TYPES.find((t) => t.key === type)?.name || type;
    if (!confirm(`确定要清理${typeName}缓存吗？`)) {
      return;
    }

    await withLoading(`clearCache_${type}`, async () => {
      try {
        const resp = await fetch(`/api/admin/cache?type=${type}`, {
          method: 'DELETE',
        });
        if (!resp.ok) {
          if (resp.status === 401) {
            throw new Error('只有站长可以清理缓存');
          }
          throw new Error('清理缓存失败');
        }
        const response = await resp.json();

        if (response.success) {
          await fetchStats();
          showSuccess(`${typeName}缓存清理成功`);
        } else {
          throw new Error(response.error);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : '清理缓存失败';
        showError('清理缓存失败: ' + errorMessage);
      }
    });
  };

  const clearExpiredCache = async () => {
    await clearCache('expired');
  };

  const clearAllCache = async () => {
    if (
      !confirm(
        '⚠️ 确定要清理所有缓存吗？这将清除豆瓣、弹幕、网盘搜索、TMDB搜索等所有缓存数据。',
      )
    ) {
      return;
    }
    await clearCache('all');
  };

  // 如果不是站长，显示权限提示
  if (!isOwner) {
    return (
      <div className='p-6 bg-red-50 dark:bg-red-900/20 rounded-lg'>
        <p className='text-red-600 dark:text-red-400'>缓存管理功能仅站长可用</p>
      </div>
    );
  }

  return (
    <div className='p-2 sm:p-6'>
      <div className='space-y-6'>
        {/* 操作按钮 */}
        <div className='flex items-center justify-end'>
          <div className='flex items-center space-x-2'>
            {lastRefresh && (
              <span className='text-sm text-gray-500 dark:text-gray-400'>
                <Clock className='inline h-4 w-4 mr-1' />
                {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchStats}
              disabled={isLoading('fetchStats')}
              className='inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-700 dark:text-purple-300 bg-transparent border border-purple-300 dark:border-purple-600 rounded-md hover:bg-purple-50 dark:hover:bg-purple-700 disabled:opacity-50'
            >
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${isLoading('fetchStats') ? 'animate-spin' : ''}`}
              />
              刷新
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4'>
            <div className='flex items-center'>
              <AlertTriangle className='h-5 w-5 text-red-400 mr-3' />
              <span className='text-red-800 dark:text-red-200'>{error}</span>
            </div>
          </div>
        )}

        {/* 总览统计 */}
        {stats && (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'>
            <div className='bg-blue-50 dark:bg-blue-900/30 p-3 sm:p-4 rounded-lg border border-blue-200 dark:border-blue-700 shadow-sm hover:shadow-md transition-shadow'>
              <div className='flex items-center justify-between mb-2'>
                <Database className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                <span className='text-xs text-blue-600 dark:text-blue-400 font-medium'>
                  缓存总数
                </span>
              </div>
              <div className='text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-300'>
                {stats.total.count}
              </div>
            </div>

            <div className='bg-purple-50 dark:bg-purple-900/30 p-3 sm:p-4 rounded-lg border border-purple-200 dark:border-purple-700 shadow-sm hover:shadow-md transition-shadow'>
              <div className='flex items-center justify-between mb-2'>
                <Folder className='h-5 w-5 text-purple-600 dark:text-purple-400' />
                <span className='text-xs text-purple-600 dark:text-purple-400 font-medium'>
                  存储占用
                </span>
              </div>
              <div className='text-2xl sm:text-3xl font-bold text-purple-700 dark:text-purple-300'>
                {stats.formattedSizes.total}
              </div>
            </div>

            <div className='bg-green-50 dark:bg-green-900/30 p-3 sm:p-4 rounded-lg border border-green-200 dark:border-green-700 shadow-sm hover:shadow-md transition-shadow'>
              <div className='flex items-center justify-between mb-2'>
                <Film className='h-5 w-5 text-green-600 dark:text-green-400' />
                <span className='text-xs text-green-600 dark:text-green-400 font-medium'>
                  缓存类型
                </span>
              </div>
              <div className='text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-300'>
                {CACHE_TYPES.length}
              </div>
            </div>
          </div>
        )}

        {/* 缓存类型详情 */}
        {stats && (
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {CACHE_TYPES.map((cacheType) => {
              const typeStats = stats[cacheType.key as keyof typeof stats] as {
                count: number;
                size: number;
                types?: Record<string, number>;
              };
              const Icon = cacheType.icon;

              return (
                <div
                  key={cacheType.key}
                  className='bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-700 p-6'
                >
                  <div className='flex items-center justify-between mb-4'>
                    <div className='flex items-center space-x-3'>
                      <div className={`p-2 rounded-lg ${cacheType.color}`}>
                        <Icon className='h-5 w-5' />
                      </div>
                      <div>
                        <h3 className='font-medium text-gray-900 dark:text-gray-100'>
                          {cacheType.name}
                        </h3>
                        <p className='text-sm text-gray-500 dark:text-gray-400'>
                          {cacheType.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className='grid grid-cols-2 gap-4 mb-4'>
                    <div className='text-center p-3 bg-purple-50 dark:bg-purple-700 rounded-lg'>
                      <div className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                        {typeStats?.count || 0}
                      </div>
                      <div className='text-xs text-gray-500 dark:text-gray-400'>
                        缓存项
                      </div>
                    </div>
                    <div className='text-center p-3 bg-purple-50 dark:bg-purple-700 rounded-lg'>
                      <div className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                        {
                          stats.formattedSizes[
                            cacheType.key as keyof typeof stats.formattedSizes
                          ]
                        }
                      </div>
                      <div className='text-xs text-gray-500 dark:text-gray-400'>
                        存储大小
                      </div>
                    </div>
                  </div>

                  {/* 豆瓣缓存子类型统计 */}
                  {cacheType.key === 'douban' && typeStats?.types && (
                    <div className='mb-4 space-y-1'>
                      <div className='text-xs font-medium text-gray-700 dark:text-gray-300 mb-2'>
                        类型分布：
                      </div>
                      {Object.entries(typeStats.types || {}).map(
                        ([type, count]) => (
                          <div
                            key={type}
                            className='flex justify-between text-xs'
                          >
                            <span className='text-gray-600 dark:text-gray-400'>
                              {type}:
                            </span>
                            <span className='font-mono text-gray-900 dark:text-gray-100'>
                              {count}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  {/* 短剧缓存子类型统计 */}
                  {cacheType.key === 'shortdrama' && typeStats?.types && (
                    <div className='mb-4 space-y-1'>
                      <div className='text-xs font-medium text-gray-700 dark:text-gray-300 mb-2'>
                        类型分布：
                      </div>
                      {Object.entries(typeStats.types || {}).map(
                        ([type, count]) => (
                          <div
                            key={type}
                            className='flex justify-between text-xs'
                          >
                            <span className='text-gray-600 dark:text-gray-400'>
                              {type}:
                            </span>
                            <span className='font-mono text-gray-900 dark:text-gray-100'>
                              {count}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  {/* TMDB缓存子类型统计 */}
                  {cacheType.key === 'tmdb' && typeStats?.types && (
                    <div className='mb-4 space-y-1'>
                      <div className='text-xs font-medium text-gray-700 dark:text-gray-300 mb-2'>
                        类型分布：
                      </div>
                      {Object.entries(typeStats.types || {}).map(
                        ([type, count]) => (
                          <div
                            key={type}
                            className='flex justify-between text-xs'
                          >
                            <span className='text-gray-600 dark:text-gray-400'>
                              {type}:
                            </span>
                            <span className='font-mono text-gray-900 dark:text-gray-100'>
                              {count}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => clearCache(cacheType.key)}
                    disabled={
                      isLoading(`clearCache_${cacheType.key}`) ||
                      (typeStats?.count || 0) === 0
                    }
                    className='w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {isLoading(`clearCache_${cacheType.key}`) ? (
                      <>
                        <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                        清理中...
                      </>
                    ) : (
                      <>
                        <Trash2 className='h-4 w-4 mr-2' />
                        清理缓存
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 批量操作 */}
        {stats && (
          <div className='bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-700 p-6'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
              批量操作
            </h3>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <button
                onClick={clearExpiredCache}
                disabled={isLoading('clearCache_expired')}
                className='inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-50'
              >
                {isLoading('clearCache_expired') ? (
                  <>
                    <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                    清理中...
                  </>
                ) : (
                  <>
                    <Clock className='h-4 w-4 mr-2' />
                    清理过期缓存
                  </>
                )}
              </button>

              <button
                onClick={clearAllCache}
                disabled={isLoading('clearCache_all')}
                className='inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50'
              >
                {isLoading('clearCache_all') ? (
                  <>
                    <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                    清理中...
                  </>
                ) : (
                  <>
                    <Trash2 className='h-4 w-4 mr-2' />
                    清理所有缓存
                  </>
                )}
              </button>
            </div>

            <div className='mt-4 text-sm text-gray-500 dark:text-gray-400'>
              <p className='flex items-start'>
                <AlertTriangle className='h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-orange-500' />
                注意：清理缓存后，相应的数据将需要重新从源服务器获取，可能会影响加载速度。
              </p>
            </div>
          </div>
        )}

        {/* 加载状态 */}
        {isLoading('fetchStats') && !stats && (
          <div className='flex items-center justify-center py-12'>
            <RefreshCw className='h-8 w-8 animate-spin text-blue-500 mr-3' />
            <span className='text-gray-600 dark:text-gray-300'>
              正在获取缓存统计...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default CacheManager;
