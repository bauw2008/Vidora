'use client';

import { Search, X } from 'lucide-react';
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';

import { logger } from '@/lib/logger';
import {
  getRecommendedShortDramas,
  getShortDramaCategories,
  getShortDramaList,
  searchShortDramas,
} from '@/lib/shortdrama.client';
import { DoubanItem, DoubanResult } from '@/lib/types';

import BackToTopButton from '@/components/BackToTopButton';
import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import PageLayout from '@/components/PageLayout';
import ShortDramaSelector from '@/components/ShortDramaSelector';
import VideoCard from '@/components/VideoCard';

// 定义全局窗口配置类型
interface WindowConfig {
  __DISABLED_MENUS?: {
    showShortDrama?: boolean;
    showLive?: boolean;
    showTvbox?: boolean;
    showMovies?: boolean;
    showTVShows?: boolean;
    showAnime?: boolean;
    showVariety?: boolean;
  };
  RUNTIME_CONFIG?: {
    AIConfig?: {
      enabled?: boolean;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

declare global {
  interface Window extends WindowConfig {}
}

// 权限检查组件
function ShortDramaPagePermissionCheck({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const disabledMenus = window.__DISABLED_MENUS ?? {
        showShortDrama: false,
      };
      if (disabledMenus.showShortDrama) {
        window.location.href = '/';
      }
    }
  }, []);

  if (typeof window !== 'undefined') {
    const disabledMenus = window.__DISABLED_MENUS ?? { showShortDrama: false };
    if (disabledMenus.showShortDrama) {
      return null;
    }
  }

  return <>{children}</>;
}

function ShortDramaPageClient() {
  const [doubanData, setDoubanData] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectorsReady, setSelectorsReady] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 用于存储最新参数值的 refs
  const currentParamsRef = useRef({
    shortDramaCategory: '全部',
    shortDramaType: 'all',
    currentPage: 0,
  });

  // 短剧选择器状态
  const [shortDramaCategory, setShortDramaCategory] = useState<string>('全部');
  const [shortDramaType, setShortDramaType] = useState<string>('all');

  // 搜索状态
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [, setIsSearching] = useState(false);

  // 同步最新参数值到 ref
  useEffect(() => {
    currentParamsRef.current = {
      shortDramaCategory,
      shortDramaType,
      currentPage,
    };
  }, [shortDramaCategory, shortDramaType, currentPage]);

  // 初始化时标记选择器为准备好状态，并设置默认类型
  useEffect(() => {
    const initDefaultType = async () => {
      try {
        const categories = await getShortDramaCategories();
        if (
          categories.length > 0 &&
          shortDramaCategory === '全部' &&
          shortDramaType === 'all'
        ) {
          setShortDramaType(categories[0].type_id.toString());
        }
      } catch (err) {
        logger.error('加载分类失败:', err);
      }
    };

    initDefaultType();

    const timer = setTimeout(() => {
      setSelectorsReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [shortDramaCategory, shortDramaType]);

  // 当前参数变化时重置选择器状态
  useEffect(() => {
    setShortDramaCategory('全部');
    setShortDramaType('all');
    setCurrentPage(0);
    setDoubanData([]);
    setHasMore(true);
    setIsLoadingMore(false);

    const timer = setTimeout(() => {
      setSelectorsReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // 生成骨架屏数据
  const skeletonData = Array.from({ length: 25 }, (_, index) => index);

  // 防抖的数据加载函数
  const loadInitialData = useCallback(async () => {
    // 如果正在搜索，不加载默认数据
    if (showSearch) {
      return;
    }

    const requestSnapshot = {
      shortDramaCategory,
      shortDramaType,
      currentPage: 0,
    };

    try {
      setLoading(true);
      setCurrentPage(0);
      setDoubanData([]);
      setHasMore(true);
      setIsLoadingMore(false);

      let data: DoubanResult;

      if (shortDramaCategory === '随机推荐') {
        const categoryId =
          shortDramaType !== 'all' ? parseInt(shortDramaType, 10) : undefined;
        const items = await getRecommendedShortDramas(categoryId, 25);
        data = {
          code: 200,
          message: 'success',
          list: items.map((item) => ({
            id: item.id?.toString() || '',
            title: item.name || '',
            poster: item.cover || '',
            rate: '',
            year: '',
            episodes: item.episode_count || 0,
            remarks:
              item.update_time?.split(/[\sT]/)?.[0]?.replace(/-/g, '.') || '',
            type: 'shortdrama',
            source: 'shortdrama',
            videoId: item.id?.toString() || '',
            source_name: '',
          })),
        };
      } else {
        // 默认使用分类列表
        const categories = await getShortDramaCategories();

        if (categories.length === 0) {
          data = {
            code: 200,
            message: 'success',
            list: [],
          };
        } else {
          // 确定要使用的分类ID
          let categoryId: number;
          if (shortDramaType !== 'all') {
            categoryId = parseInt(shortDramaType, 10);
            if (isNaN(categoryId)) {
              categoryId = categories[0].type_id;
            }
          } else {
            categoryId = categories[0].type_id;
          }

          const result = await getShortDramaList(categoryId, 1, 25);

          data = {
            code: 200,
            message: 'success',
            list:
              result.list?.map((item) => ({
                id: item.id?.toString() || '',
                title: item.name || '',
                poster: item.cover || '',
                rate: '',
                year: '',
                episodes: item.episode_count || 0,
                remarks:
                  item.update_time?.split(/[\sT]/)?.[0]?.replace(/-/g, '.') ||
                  '',
                type: 'shortdrama',
                source: 'shortdrama',
                videoId: item.id?.toString() || '',
                source_name: '',
              })) || [],
          };
        }
      }

      if (data.code === 200) {
        const currentSnapshot = { ...currentParamsRef.current };
        const keyParamsMatch =
          requestSnapshot.shortDramaCategory ===
            currentSnapshot.shortDramaCategory &&
          requestSnapshot.shortDramaType === currentSnapshot.shortDramaType;

        if (keyParamsMatch) {
          setDoubanData(data.list);
          setHasMore(data.list.length !== 0);
          setLoading(false);
        }
      } else {
        throw new Error(data.message || '获取数据失败');
      }
    } catch (err) {
      logger.error('加载数据失败:', err);
      setError(err instanceof Error ? err.message : '加载数据失败');
      setLoading(false);
    }
  }, [showSearch, shortDramaCategory, shortDramaType]);

  // 只在选择器准备好后才加载数据
  useEffect(() => {
    if (!selectorsReady) {
      return;
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      loadInitialData();
    }, 100);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [selectorsReady, loadInitialData]);

  // 加载更多数据
  useEffect(() => {
    // 如果正在搜索，不加载更多数据
    if (showSearch || currentPage === 0) {
      return;
    }

    const fetchMoreData = async () => {
      const requestSnapshot = {
        shortDramaCategory,
        shortDramaType,
        currentPage,
      };

      currentParamsRef.current = requestSnapshot;

      try {
        setIsLoadingMore(true);

        let data: DoubanResult;

        if (shortDramaCategory === '随机推荐') {
          const categoryId =
            shortDramaType !== 'all' ? parseInt(shortDramaType, 10) : undefined;
          const items = await getRecommendedShortDramas(categoryId, 25);

          data = {
            code: 200,
            message: 'success',
            list: items.map((item) => ({
              id: item.id?.toString() || '',
              title: item.name || '',
              poster: item.cover || '',
              rate: '',
              year: '',
              episodes: item.episode_count || 0,
              remarks:
                item.update_time?.split(/[\sT]/)?.[0]?.replace(/-/g, '.') || '',
              type: 'shortdrama',
              source: 'shortdrama',
              videoId: item.id?.toString() || '',
              source_name: '',
            })),
          };
        } else {
          const categories = await getShortDramaCategories();

          if (categories.length === 0) {
            data = {
              code: 200,
              message: 'success',
              list: [],
            };
          } else {
            let categoryId: number;
            if (shortDramaType !== 'all') {
              categoryId = parseInt(shortDramaType, 10);
              if (isNaN(categoryId)) {
                categoryId = categories[0].type_id;
              }
            } else {
              categoryId = categories[0].type_id;
            }

            const result = await getShortDramaList(
              categoryId,
              currentPage + 1,
              25,
            );

            data = {
              code: 200,
              message: 'success',
              list:
                result.list?.map((item) => ({
                  id: item.id?.toString() || '',
                  title: item.name || '',
                  poster: item.cover || '',
                  rate: '',
                  year: '',
                  episodes: item.episode_count || 0,
                  remarks:
                    item.update_time?.split(/[\sT]/)?.[0]?.replace(/-/g, '.') ||
                    '',
                  type: 'shortdrama',
                  source: 'shortdrama',
                  videoId: item.id?.toString() || '',
                  source_name: '',
                })) || [],
            };
          }
        }

        if (data.code === 200) {
          const currentSnapshot = { ...currentParamsRef.current };
          const keyParamsMatch =
            requestSnapshot.shortDramaCategory ===
              currentSnapshot.shortDramaCategory &&
            requestSnapshot.shortDramaType === currentSnapshot.shortDramaType;

          if (keyParamsMatch) {
            // 使用 transition 优化状态更新
            startTransition(() => {
              setDoubanData((prev) => [...prev, ...data.list]);
              setHasMore(data.list.length !== 0);
            });
          }
        }
      } catch (err) {
        logger.error(err);
      } finally {
        setIsLoadingMore(false);
      }
    };

    fetchMoreData();
  }, [currentPage, shortDramaCategory, shortDramaType, showSearch]);

  // 设置滚动监听
  useEffect(() => {
    if (showSearch) {
      return;
    }

    if (!hasMore || isLoadingMore || loading) {
      return;
    }

    if (!loadingRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          startTransition(() => {
            setCurrentPage((prev) => prev + 1);
          });
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, loading, showSearch]);

  // 处理选择器变化
  const handleCategoryChange = (value: string | number) => {
    const strValue = String(value);
    if (strValue !== shortDramaCategory) {
      setLoading(true);
      setCurrentPage(0);
      setDoubanData([]);
      setHasMore(true);
      setIsLoadingMore(false);
      setShortDramaCategory(strValue);
    }
  };

  const handleTypeChange = (value: string | number) => {
    const strValue = String(value);
    if (strValue !== shortDramaType) {
      setLoading(true);
      setCurrentPage(0);
      setDoubanData([]);
      setHasMore(true);
      setIsLoadingMore(false);
      setShortDramaType(strValue);
    }
  };

  // 处理搜索
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      // 如果搜索框为空，恢复正常显示
      setShowSearch(false);
      setSearchQuery('');
      loadInitialData();
      return;
    }

    try {
      setIsSearching(true);
      setLoading(true);
      setCurrentPage(0);
      setDoubanData([]);
      setHasMore(true);
      setIsLoadingMore(false);

      const result = await searchShortDramas(query, 1, 25);

      const data: DoubanResult = {
        code: 200,
        message: 'success',
        list:
          result.list?.map((item) => ({
            id: item.id?.toString() || '',
            title: item.name || '',
            poster: item.cover || '',
            rate: '',
            year: '',
            episodes: item.episode_count || 0,
            remarks:
              item.update_time?.split(/[\sT]/)?.[0]?.replace(/-/g, '.') || '',
            type: 'shortdrama',
            source: 'shortdrama',
            videoId: item.id?.toString() || '',
            source_name: '',
          })) || [],
      };

      setDoubanData(data.list);
      setHasMore(result.hasMore);
      setLoading(false);
    } catch (err) {
      logger.error('搜索失败:', err);
      setError(err instanceof Error ? err.message : '搜索失败');
      setLoading(false);
    } finally {
      setIsSearching(false);
    }
  };

  // 处理搜索框输入
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
  };

  // 处理搜索提交
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  // 关闭搜索
  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    loadInitialData();
  };

  const getPageDescription = () => {
    if (showSearch && searchQuery) {
      return `搜索"${searchQuery}"的结果`;
    }
    return '随机推荐的短剧内容';
  };

  return (
    <PageLayout activePath='/shortdrama'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
        {/* 页面标题和选择器 */}
        <div className='mb-6 sm:mb-8 space-y-4 sm:space-y-6'>
          {/* 页面标题 */}
          <div>
            <div className='flex items-center gap-3'>
              <h1 className='text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2'>
                短剧
              </h1>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className='p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'
                title='搜索'
              >
                <Search className='w-5 h-5 text-gray-600 dark:text-gray-400' />
              </button>
            </div>
            <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
              {getPageDescription()}
            </p>
          </div>

          {/* 搜索框 */}
          {showSearch && (
            <div className='relative'>
              <form onSubmit={handleSearchSubmit} className='relative'>
                <input
                  type='text'
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  placeholder='搜索短剧...'
                  className='w-full px-4 py-3 pr-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none'
                  autoFocus
                />
                <button
                  type='button'
                  onClick={handleCloseSearch}
                  className='absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
                  title='关闭搜索'
                >
                  <X className='w-5 h-5 text-gray-500 dark:text-gray-400' />
                </button>
              </form>
            </div>
          )}

          {/* 选择器组件 */}
          {!showSearch && (
            <div className='relative bg-gradient-to-br from-white/80 via-blue-50/30 to-purple-50/30 dark:from-gray-800/60 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 sm:p-6 border border-blue-200/40 dark:border-blue-700/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300'>
              {/* 装饰性光晕 */}
              <div className='absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none'></div>
              <div className='absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-purple-300/20 to-blue-300/20 rounded-full blur-3xl pointer-events-none'></div>

              <div className='relative'>
                <ShortDramaSelector
                  primarySelection={shortDramaCategory}
                  secondarySelection={shortDramaType}
                  onPrimaryChange={handleCategoryChange}
                  onSecondaryChange={handleTypeChange}
                />
              </div>
            </div>
          )}
        </div>

        {/* 内容展示区域 */}

        <div className='max-w-[95%] mx-auto mt-8 overflow-visible will-change-scroll'>
          <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20 will-change-scroll'>
            {doubanData.map((item) => (
              <div
                key={item.id || item.title}
                className='w-full content-visibility-auto contain-intrinsic-size-[120px_252px] sm:contain-intrinsic-size-[160px_350px]'
              >
                <VideoCard
                  id={item.id}
                  source={item.source}
                  title={item.title}
                  poster={item.poster}
                  from='shortdrama'
                  rate={item.rate}
                  year={item.year}
                  episodes={item.episodes}
                  remarks={item.remarks}
                  source_name={item.source_name}
                />
              </div>
            ))}
          </div>

          {/* 加载中骨架屏 */}
          {loading && (
            <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
              {skeletonData.map((_, index) => (
                <DoubanCardSkeleton key={index} />
              ))}
            </div>
          )}

          {/* 加载更多指示器 */}
          {!loading && hasMore && (
            <div ref={loadingRef} className='flex justify-center py-8'>
              <div className='text-gray-500 dark:text-gray-400'>加载中...</div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className='flex justify-center py-8'>
              <div className='text-red-500 dark:text-red-400 text-center'>
                <p className='mb-2'>{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    loadInitialData();
                  }}
                  className='px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors'
                >
                  重试
                </button>
              </div>
            </div>
          )}

          {/* 无数据提示 */}
          {!loading && !error && doubanData.length === 0 && (
            <div className='flex justify-center py-16'>
              <div className='text-gray-500 dark:text-gray-400 text-center'>
                暂无短剧数据
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 浮动工具组 */}
      <div className='fixed bottom-6 right-6 z-[500]'>
        <BackToTopButton />
      </div>
    </PageLayout>
  );
}

export default function ShortDramaPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ShortDramaPagePermissionCheck>
        <ShortDramaPageClient />
      </ShortDramaPagePermissionCheck>
    </Suspense>
  );
}
