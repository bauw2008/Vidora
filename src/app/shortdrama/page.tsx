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
  const [loading, setLoading] = useState(true); // 初始状态为 true，显示骨架屏
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 分类数据状态
  const [categoriesData, setCategoriesData] = useState<
    Array<{
      id: number;
      name: string;
      sub_categories?: Array<{ id: number; name: string }>;
    }>
  >([]);

  // 短剧选择器状态 - 使用字符串类型存储二级分类名称
  const [shortDramaCategory, setShortDramaCategory] = useState<number>(0);
  const [shortDramaType, setShortDramaType] = useState<string>('');

  // 用于存储最新参数值的 refs
  const currentParamsRef = useRef({
    shortDramaCategory: 0,
    shortDramaType: '',
    currentPage: 0,
  });

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

  // 初始化时加载分类数据
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categories = await getShortDramaCategories();
        setCategoriesData(categories);

        // API 已经返回了完整的分类数据（包含 sub_categories）
        if (categories.length > 0) {
          // 设置默认一级分类为第一个分类
          setShortDramaCategory(categories[0].id);
          // 设置默认二级分类为第一个子分类的名称
          if (
            categories[0].sub_categories &&
            categories[0].sub_categories.length > 0
          ) {
            setShortDramaType(categories[0].sub_categories[0].name);
          }
        }
      } catch (err) {
        logger.error('加载分类失败:', err);
      }
    };

    loadCategories();
  }, []); // 只在组件挂载时执行一次

  // 生成骨架屏数据
  const skeletonData = Array.from({ length: 25 }, (_, index) => index);

  // 防抖的数据加载函数
  const loadInitialData = useCallback(async () => {
    // 如果正在搜索，不加载默认数据
    if (showSearch) {
      return;
    }

    // 等待分类数据加载完成
    if (!shortDramaCategory || !shortDramaType) {
      return;
    }

    const requestSnapshot = {
      shortDramaCategory,
      shortDramaType,
      currentPage: 0,
    };

    try {
      // 设置加载状态（显示骨架屏）
      setLoading(true);
      setCurrentPage(1);
      setDoubanData([]);
      setHasMore(true);
      setIsLoadingMore(false);

      // 使用二级分类名称作为 tag 参数
      const tag = shortDramaType || undefined;

      // 第一页也使用缓存，减少请求
      const result = await getShortDramaList(1, 25, tag, false);

      const data: DoubanResult = {
        code: 200,
        message: 'success',
        list:
          result.list?.map((item) => ({
            id: item.id?.toString() || '',
            title: item.name || '',
            poster: item.cover || '',
            rate: '',
            year: item.year || '',
            episodes: item.episode_count || 0,
            remarks:
              item.update_time?.split(/[\sT]/)?.[0]?.replace(/-/g, '.') || '',
            desc: item.description || '', // 添加简介字段
            type: 'shortdrama',
            source: 'shortdrama',
            videoId: item.id?.toString() || '',
            source_name: '',
          })) || [],
      };

      if (data.code === 200) {
        const currentSnapshot = { ...currentParamsRef.current };
        const keyParamsMatch =
          requestSnapshot.shortDramaCategory ===
            currentSnapshot.shortDramaCategory &&
          requestSnapshot.shortDramaType === currentSnapshot.shortDramaType;

        if (keyParamsMatch) {
          setDoubanData(data.list);
          setHasMore(data.list.length !== 0); // 采用豆瓣的逻辑：只要返回数据不为空，就认为还有更多
          setLoading(false);
        }
      } else {
        throw new Error('获取数据失败');
      }
    } catch (err) {
      logger.error('加载数据失败:', err);
      setError(err instanceof Error ? err.message : '加载数据失败');
      setLoading(false);
    }
  }, [showSearch, shortDramaCategory, shortDramaType]);

  // 加载初始数据
  useEffect(() => {
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
  }, [loadInitialData]);

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

        // 使用二级分类名称作为 tag 参数
        const tag = shortDramaType || undefined;

        const result = await getShortDramaList(currentPage + 1, 25, tag);

        data = {
          code: 200,
          message: 'success',
          list:
            result.list?.map((item) => ({
              id: item.id?.toString() || '',
              title: item.name || '',
              poster: item.cover || '',
              rate: '',
              year: item.year || '',
              episodes: item.episode_count || 0,
              remarks:
                item.update_time?.split(/[\sT]/)?.[0]?.replace(/-/g, '.') || '',
              desc: item.description || '', // 添加简介字段
              type: 'shortdrama',
              source: 'shortdrama',
              videoId: item.id?.toString() || '',
              source_name: '',
            })) || [],
        };

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
              setHasMore(data.list.length !== 0); // 采用豆瓣的逻辑
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

  // 滚动加载更多
  useEffect(() => {
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
  }, [hasMore, isLoadingMore, loading]);

  // 处理选择器变化
  const handleCategoryChange = useCallback(
    (value: string | number) => {
      const numValue = Number(value);
      if (numValue !== shortDramaCategory) {
        setLoading(true);
        setCurrentPage(1);
        setDoubanData([]);
        setHasMore(true);
        setIsLoadingMore(false);
        setShortDramaCategory(numValue);
      }
    },
    [shortDramaCategory],
  );

  const handleTypeChange = useCallback(
    (value: string | number) => {
      // value 是二级分类的名称（字符串）
      const stringValue = String(value);
      if (stringValue !== shortDramaType) {
        setLoading(true);
        setCurrentPage(1);
        setDoubanData([]);
        setHasMore(true);
        setIsLoadingMore(false);
        setShortDramaType(stringValue);
      }
    },
    [shortDramaType],
  );

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
      setCurrentPage(1);
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
            year: item.year || '',
            episodes: item.episode_count || 0,
            remarks:
              item.update_time?.split(/[\sT]/)?.[0]?.replace(/-/g, '.') || '',
            desc: item.description || '', // 添加简介字段
            type: 'shortdrama',
            source: 'shortdrama',
            videoId: item.id?.toString() || '',
            source_name: '',
          })) || [],
      };

      setDoubanData(data.list);
      setHasMore(data.list.length !== 0);
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
    return '短剧内容';
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
          {!showSearch &&
            categoriesData.length > 0 &&
            shortDramaCategory > 0 && (
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
                    categoriesData={categoriesData}
                  />
                </div>
              </div>
            )}
        </div>

        {/* 内容展示区域 */}

        <div className='max-w-[95%] mx-auto mt-8 overflow-visible will-change-scroll'>
          <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20 will-change-scroll'>
            {doubanData.map((item, index) => (
              <div
                key={`${item.id}-${item.title || ''}-${index}`}
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
            <div
              ref={(el) => {
                if (el && el.offsetParent !== null) {
                  (
                    loadingRef as React.MutableRefObject<HTMLDivElement | null>
                  ).current = el;
                }
              }}
              className='flex justify-center py-8'
            >
              {isLoadingMore ? (
                <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
              ) : (
                <div className='h-6'></div>
              )}
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
