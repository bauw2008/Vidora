/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { ChevronDown, ChevronLeft, Search, Settings, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { logger } from '@/lib/logger';
import { UnifiedVideoItem } from '@/lib/types';

import BackToTopButton from '@/components/BackToTopButton';
import { CapsuleSelector } from '@/components/CapsuleSelector';
import PageLayout from '@/components/PageLayout';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';

// ==================== 类型定义 ====================
interface VideoSource {
  key: string;
  name: string;
  api: string;
  detail?: string;
}

interface VideoItem {
  id: string;
  title: string;
  poster?: string;
  episodes?: string[];
  episodes_titles?: string[];
  source?: string;
  source_name?: string;
  class?: string;
  year?: string;
  desc?: string;
  type_name?: string;
  type?: string;
  douban_id?: number;
  rate?: string;
  inferredType?: 'movie' | 'tv' | 'anime' | 'variety' | 'shortdrama';
}

interface Category {
  type_id: number;
  type_pid: number;
  type_name: string;
}

interface CategoryStructure {
  primary_categories: Category[];
  secondary_categories: Category[];
  category_map: Record<number, Category>;
}

interface ApiResponse {
  list: VideoItem[];
  categories: CategoryStructure;
  pagecount: number;
}

// ==================== 视频源选择器（带搜索） ====================
function SourceSelector({
  sources,
  selectedSource,
  onSourceChange,
  onSearch,
  loading,
}: {
  sources: VideoSource[];
  selectedSource: string;
  onSourceChange: (sourceKey: string) => void;
  onSearch: (keyword: string) => void;
  loading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [debounceId, setDebounceId] = useState<NodeJS.Timeout | null>(null);
  const selectedSourceData = sources.find((s) => s.key === selectedSource);

  // 组件卸载时清除防抖定时器
  useEffect(() => {
    return () => {
      if (debounceId) {
        clearTimeout(debounceId);
      }
    };
  }, [debounceId]);

  // 无可用视频源提示
  if (!sources || sources.length === 0) {
    return (
      <div className='p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg'>
        <p className='text-yellow-800 dark:text-yellow-200'>
          暂无可用视频源，请联系管理员配置权限
        </p>
      </div>
    );
  }

  const handleSearch = () => {
    if (searchKeyword.trim()) {
      onSearch(searchKeyword.trim());
      setIsSearchMode(false);
    }
  };

  const handleClearSearch = () => {
    setSearchKeyword('');
    onSearch('');
    setIsSearchMode(false);
  };

  // 搜索防抖：500ms 后自动触发搜索
  const handleSearchInputChange = (value: string) => {
    setSearchKeyword(value);

    // 清除之前的防抖定时器
    if (debounceId) {
      clearTimeout(debounceId);
    }

    // 设置新的防抖定时器
    const newDebounceId = setTimeout(() => {
      if (value.trim()) {
        onSearch(value.trim());
      }
    }, 500);

    setDebounceId(newDebounceId);
  };

  return (
    <div className='relative max-w-3xl'>
      {!isSearchMode ? (
        // 源选择模式
        <div className='flex items-center gap-3'>
          {/* 选择按钮 */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className='w-64 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-750 border border-gray-200 dark:border-gray-600 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200'
          >
            <span className='text-sm font-semibold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent'>
              {selectedSourceData?.name || '选择视频源'}
            </span>
            <ChevronDown
              size={18}
              className={`text-blue-500 dark:text-blue-400 transition-transform duration-300 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* 搜索图标按钮 */}
          <button
            onClick={() => setIsSearchMode(true)}
            className='flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200'
            title='搜索'
          >
            <Search size={20} className='text-white' />
          </button>
        </div>
      ) : (
        // 搜索模式
        <div className='flex items-center gap-2'>
          {/* 返回按钮 */}
          <button
            onClick={() => {
              setIsSearchMode(false);
              setSearchKeyword('');
            }}
            className='flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0'
            title='返回'
          >
            <ChevronLeft size={20} className='text-gray-500' />
          </button>

          {/* 搜索框容器 */}
          <div className='flex-1 flex items-center gap-2'>
            {/* 输入框容器 */}
            <div className='flex-1 flex items-center bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-lg shadow-md overflow-hidden'>
              <div className='pl-4 text-blue-500 dark:text-blue-400 flex-shrink-0'>
                <Search size={18} />
              </div>
              <input
                type='text'
                value={searchKeyword}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                placeholder={`在 ${selectedSourceData?.name} 中搜索...`}
                className='flex-1 h-12 px-3 bg-transparent text-gray-900 dark:text-gray-100 border-0 outline-none focus:ring-0 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500'
                style={{ boxShadow: 'none' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // 回车立即搜索，清除防抖
                    if (debounceId) {
                      clearTimeout(debounceId);
                    }
                    handleSearch();
                  }
                  if (e.key === 'Escape') {
                    handleClearSearch();
                  }
                }}
                autoFocus
              />
              {searchKeyword && (
                <button
                  onClick={handleClearSearch}
                  className='px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0'
                  title='清除 (Esc)'
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* 搜索按钮 - 独立 */}
            <button
              onClick={handleSearch}
              disabled={loading || !searchKeyword.trim()}
              className='h-12 px-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md transition-all text-sm font-semibold flex-shrink-0'
            >
              {loading ? '搜索中...' : '搜索'}
            </button>
          </div>
        </div>
      )}

      {/* 下拉列表 - 响应式网格布局 */}
      {isOpen && !isSearchMode && (
        <>
          <div
            className='fixed inset-0 z-10'
            onClick={() => setIsOpen(false)}
          />
          <div className='absolute top-full left-0 right-0 sm:right-auto mt-2 bg-white/80 dark:bg-gray-800/80 border border-gray-200/30 dark:border-gray-600/30 rounded-xl shadow-2xl z-20 max-h-[420px] sm:max-h-[450px] overflow-hidden backdrop-blur-2xl sm:w-auto sm:min-w-[480px] sm:max-w-[650px]'>
            <div className='overflow-y-auto max-h-[420px] sm:max-h-[450px] p-2 sm:p-2.5'>
              <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 sm:gap-2'>
                {sources
                  .filter((source) => source.key && source.name)
                  .map((source) => (
                    <button
                      key={source.key}
                      onClick={() => {
                        onSourceChange(source.key);
                        setIsOpen(false);
                      }}
                      className={`relative p-2 sm:p-2.5 rounded-lg transition-all duration-200 group text-left ${
                        selectedSource === source.key
                          ? 'bg-gradient-to-br from-blue-500/90 via-indigo-500/90 to-purple-500/90 border-2 border-blue-400/80 shadow-lg shadow-blue-500/30'
                          : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gradient-to-br hover:from-blue-500/80 hover:via-indigo-500/80 hover:to-purple-500/80 hover:border-blue-400/60 hover:shadow-md'
                      }`}
                    >
                      {/* 选中角标 */}
                      {selectedSource === source.key && (
                        <div className='absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-md'>
                          <svg
                            className='w-2 h-2 sm:w-2.5 sm:h-2.5 text-blue-600 dark:text-blue-400'
                            fill='currentColor'
                            viewBox='0 0 20 20'
                          >
                            <path
                              fillRule='evenodd'
                              d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                              clipRule='evenodd'
                            />
                          </svg>
                        </div>
                      )}

                      {/* 图标和文字 */}
                      <div className='flex items-center gap-1.5 sm:gap-2'>
                        <div
                          className={`flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center transition-all duration-200 ${
                            selectedSource === source.key
                              ? 'bg-white/30 dark:bg-gray-800/30'
                              : 'bg-gray-100 dark:bg-gray-600 group-hover:bg-white/30 dark:group-hover:bg-gray-800/30'
                          }`}
                        >
                          <svg
                            className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                              selectedSource === source.key
                                ? 'text-white'
                                : 'text-gray-600 dark:text-gray-300 group-hover:text-white'
                            }`}
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2.5}
                              d='M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z'
                            />
                          </svg>
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div
                            className={`font-semibold text-[11px] sm:text-xs leading-tight transition-colors line-clamp-2 ${
                              selectedSource === source.key
                                ? 'text-white drop-shadow-sm'
                                : 'text-gray-800 dark:text-gray-100 group-hover:text-white group-hover:drop-shadow-sm'
                            }`}
                            title={source.name}
                          >
                            {source.name}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ==================== 视频列表 ====================
function VideoList({
  videos,
  loading,
}: {
  videos: UnifiedVideoItem[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20 will-change-scroll'>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className='animate-pulse'>
            <div className='bg-gray-300 dark:bg-gray-700 rounded-lg aspect-video mb-3'></div>
            <div className='h-4 bg-gray-300 dark:bg-gray-700 rounded mb-2'></div>
            <div className='h-3 bg-gray-300 dark:bg-gray-700 rounded w-2/3'></div>
          </div>
        ))}
      </div>
    );
  }

  if (!videos || videos.length === 0) {
    return (
      <div className='text-center py-12'>
        <div className='text-gray-400 dark:text-gray-500 text-6xl mb-4'>🎬</div>
        <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-2'>
          暂无视频内容
        </h3>
        <p className='text-gray-500 dark:text-gray-400'>
          当前分类没有可用的视频内容
        </p>
      </div>
    );
  }

  return (
    <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20 will-change-scroll'>
      {videos.map((video, index) => (
        <div
          key={`${video.source || ''}-${video.id || video.title}-${index}`}
          className='w-full content-visibility-auto contain-intrinsic-size-[120px_252px] sm:contain-intrinsic-size-[160px_350px]'
        >
          <VideoCard
            id={video.videoId || video.id}
            title={video.title}
            poster={video.poster || ''}
            episodes={video.episodes || 0}
            from='tvbox'
            isAggregate={false}
            source={video.source || '未知源'}
            source_name={video.source_name || video.source || '未知源'}
            currentEpisode={0}
            douban_id={video.douban_id}
            rate={video.rate}
            year={video.year}
            onDelete={() => void 0}
          />
        </div>
      ))}
    </div>
  );
}

// ==================== 映射函数 ====================
function toUnifiedVideoItem(v: VideoItem): UnifiedVideoItem {
  // 不在这里推断类型，只在用户点击播放时推断
  // 如果 v.type 为空，设置为空字符串，让 VideoCard 在点击时推断
  const validTypes = ['movie', 'tv', 'anime', 'variety', 'shortdrama'] as const;
  const type =
    v.inferredType && validTypes.includes(v.inferredType)
      ? v.inferredType
      : v.type && validTypes.includes(v.type as any)
        ? (v.type as any)
        : '';

  const result = {
    id: v.douban_id?.toString() || v.id,
    title: v.title || '',
    poster: v.poster || '',
    rate: v.rate?.toString() || '',
    year: v.year || '',
    episodes: v.episodes?.length || 0,
    type,
    source: v.source,
    videoId: v.id,
    source_name: v.source_name,
    douban_id: v.douban_id,
    type_name: v.type_name || v.class, // 传递 type_name，用于点击时推断
  };

  return result;
}

// 权限检查组件
function TVBoxPagePermissionCheck({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const disabledMenus = (window as any).__DISABLED_MENUS || {};
      if (disabledMenus.showTvbox) {
        window.location.href = '/';
      }
    }
  }, []);

  if (typeof window !== 'undefined') {
    const disabledMenus = (window as any).__DISABLED_MENUS || {};
    if (disabledMenus.showTvbox) {
      return null;
    }
  }

  return <>{children}</>;
}

// ==================== 主组件 ====================
function TVBoxPageContent() {
  const { siteName: _siteName } = useSite();
  const [sourceList, setSourceList] = useState<VideoSource[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [, setRawVideos] = useState<VideoItem[]>([]);
  const [videos, setVideos] = useState<UnifiedVideoItem[]>([]);
  const [categories, setCategories] = useState<CategoryStructure>({
    primary_categories: [],
    secondary_categories: [],
    category_map: {},
  });
  const [selectedPrimary, setSelectedPrimary] = useState<number | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const loadingRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const hasMore = currentPage < totalPages;
  const lastSourceRef = useRef<string>('');
  const lastFetchAtRef = useRef<number>(0); // 记录上次加载时间，用于节流

  // ==================== 滚动加载更多 ====================
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
          const now = Date.now();
          const intervalOk = now - lastFetchAtRef.current > 700; // 700ms 节流

          if (intervalOk) {
            lastFetchAtRef.current = now;
            startTransition(() => {
              setCurrentPage((prev) => prev + 1);
            });
          }
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

  // ==================== 获取视频源 ====================
  useEffect(() => {
    const fetchSources = async () => {
      try {
        setSourcesLoading(true);
        const res = await fetch('/api/tvbox/video-sources');
        if (!res.ok) {
          throw new Error('获取视频源失败');
        }
        const data = await res.json();
        const arraySources = Object.entries(data)
          .map(([key, value]: any) => ({
            key,
            ...value,
          }))
          .filter((source) => source.key && source.name && source.api);
        setSourceList(arraySources);

        // 从 localStorage 获取上次选择的视频源
        if (arraySources.length > 0) {
          const savedSource = localStorage.getItem('tvbox-selected-source');
          if (savedSource && arraySources.some((s) => s.key === savedSource)) {
            setSelectedSource(savedSource);
          } else {
            setSelectedSource(arraySources[0].key);
          }
        }
      } catch (err: any) {
        logger.error(err);
        setError(err.message || '获取视频源失败');
      } finally {
        setSourcesLoading(false);
      }
    };
    fetchSources();
  }, []);

  // ==================== 加载视频列表 ====================
  const fetchContent = useCallback(async () => {
    if (!selectedSource) {
      return;
    }

    setIsLoadingMore(currentPage > 1);
    setLoading(currentPage === 1);

    try {
      let apiUrl: string;
      const params = new URLSearchParams({
        source: selectedSource,
        page: currentPage.toString(),
        pagesize: '30', // 每页30个卡片
      });

      if (isSearchMode && searchKeyword) {
        // 搜索模式
        params.append('keyword', searchKeyword);
        apiUrl = `/api/tvbox/search?${params.toString()}`;
      } else {
        // 分类筛选模式 - 总是传递 category 参数
        if (selectedSecondary > 0) {
          params.append('category', selectedSecondary.toString());
        } else if (selectedPrimary && selectedPrimary > 0) {
          params.append('category', selectedPrimary.toString());
        }
        apiUrl = `/api/tvbox/videos?${params.toString()}`;
      }

      const res = await fetch(apiUrl, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        logger.error('🔴 TVBox API错误:', {
          status: res.status,
          statusText: res.statusText,
          error: errorData.error || '加载视频失败',
          apiUrl,
          errorData,
        });
        throw new Error(errorData.error || '加载视频失败');
      }

      const data: ApiResponse & { fromCache?: boolean } = await res.json();

      const newRawVideos = data.list || [];
      const newVideos = newRawVideos.map((v) => toUnifiedVideoItem(v));

      // 使用 transition 优化状态更新
      startTransition(() => {
        if (currentPage === 1) {
          setRawVideos(newRawVideos);
          setVideos(newVideos);
          setFromCache(!!data.fromCache);
        } else {
          setRawVideos((prev) => [...prev, ...newRawVideos]);
          setVideos((prev) => [...prev, ...newVideos]);
        }
      });

      // 只在非搜索模式下更新分类信息
      if (!isSearchMode) {
        const newCategories = data.categories || {
          primary_categories: [],
          secondary_categories: [],
          category_map: {},
        };

        // 只在视频源切换时更新分类，避免无限循环
        if (selectedSource !== lastSourceRef.current) {
          setCategories(newCategories);
          lastSourceRef.current = selectedSource;

          // 如果还没有选中分类，或者选中的分类不在新数据中，选中第一个分类
          const shouldSelectFirst =
            selectedPrimary === null ||
            !newCategories.primary_categories.some(
              (cat) => cat.type_id === selectedPrimary,
            );

          if (
            shouldSelectFirst &&
            newCategories.primary_categories.length > 0
          ) {
            const firstCategory = newCategories.primary_categories[0];
            setSelectedPrimary(firstCategory.type_id);

            // 自动选中第一个二级分类（如果有）
            const secondaries = newCategories.secondary_categories.filter(
              (cat) => cat.type_pid === firstCategory.type_id,
            );
            setSelectedSecondary(
              secondaries.length > 0 ? secondaries[0].type_id : 0,
            );
          } else if (selectedPrimary && selectedPrimary > 0) {
            // 如果一级分类存在但二级分类不存在，重置二级分类
            const secondaries = newCategories.secondary_categories.filter(
              (cat) => cat.type_pid === selectedPrimary,
            );
            setSelectedSecondary(
              secondaries.length > 0 ? secondaries[0].type_id : 0,
            );
          }
        }
      }

      setTotalPages(Math.min(data.pagecount || 1, 3)); // 限制最多3页
    } catch (err: any) {
      logger.error('加载视频错误:', err);
      setError(err.message || '加载视频失败');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
      // 更新最后加载时间，用于节流控制
      lastFetchAtRef.current = Date.now();
    }
  }, [
    setLoading,
    setIsLoadingMore,
    setVideos,
    setFromCache,
    selectedSource,
    currentPage,
    isSearchMode,
    searchKeyword,
    selectedPrimary,
    selectedSecondary,
  ]);

  useEffect(() => {
    fetchContent();
  }, [
    selectedSource,
    currentPage,
    selectedPrimary,
    selectedSecondary,
    isSearchMode,
    searchKeyword,
    fetchContent,
  ]);

  // ==================== 事件处理 ====================
  const handleSourceChange = (key: string) => {
    setSelectedSource(key);
    setCurrentPage(1);
    setSelectedPrimary(null); // 将在选择分类时设置
    setSelectedSecondary(0);
    setIsSearchMode(false);
    setSearchKeyword('');
    setFromCache(false);

    // 保存选择的视频源到 localStorage
    localStorage.setItem('tvbox-selected-source', key);
  };

  const handlePrimaryChange = (id: string | number) => {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    setSelectedPrimary(numId);
    setCurrentPage(1);
    setIsSearchMode(false);
    setSearchKeyword('');
    setFromCache(false);

    const secondaries = categories.secondary_categories.filter(
      (cat) => cat.type_pid === numId,
    );
    setSelectedSecondary(secondaries.length > 0 ? secondaries[0].type_id : 0);
  };

  const handleSecondaryChange = (id: string | number) => {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    setSelectedSecondary(numId);
    setCurrentPage(1);
    setIsSearchMode(false);
    setSearchKeyword('');
    setFromCache(false);
  };

  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    setIsSearchMode(!!keyword);
    setCurrentPage(1);
    setFromCache(false);
  };

  // ==================== 渲染 ====================
  if (error) {
    return (
      <PageLayout activePath='/tvbox'>
        <div className='min-h-screen flex items-center justify-center'>
          <div className='text-center'>
            <div className='text-red-500 text-6xl mb-4'>⚠️</div>
            <h2 className='text-xl font-semibold mb-2'>出错了</h2>
            <p className='mb-4'>{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchContent();
              }}
              className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200'
            >
              重新加载
            </button>
            <button
              onClick={() => window.location.reload()}
              className='ml-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors duration-200'
            >
              刷新页面
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (sourcesLoading) {
    return (
      <PageLayout activePath='/tvbox'>
        <div className='min-h-screen flex items-center justify-center'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto'></div>
            <p className='mt-4'>加载视频源中...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/tvbox'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
        {/* 页面标题 */}
        <div className='mb-4'>
          <div className='flex items-center gap-2 mb-1 sm:mb-2'>
            <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200'>
              TVBox 视频库
            </h1>
            <Link
              href='/tvbox/config'
              className='flex items-center justify-center w-6 h-6 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors duration-200'
              title='TVBox 配置'
            >
              <Settings className='w-4 h-4' />
            </Link>
          </div>
          <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
            来自不同视频源的内容
          </p>
        </div>

        {/* 视频源选择器（带搜索） */}
        <div className='mb-6'>
          <SourceSelector
            sources={sourceList}
            selectedSource={selectedSource}
            onSourceChange={handleSourceChange}
            onSearch={handleSearch}
            loading={loading}
          />
        </div>

        {/* 分类筛选器（搜索模式下隐藏，且只在有分类数据时显示） */}
        {!isSearchMode && categories.primary_categories.length > 0 && (
          <div className='relative bg-gradient-to-br from-white/80 via-blue-50/30 to-purple-50/30 dark:from-gray-800/60 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 sm:p-6 border border-blue-200/40 dark:border-blue-700/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 mb-8'>
            {/* 装饰性光晕 */}
            <div className='absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none'></div>
            <div className='absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-green-300/20 to-teal-300/20 rounded-full blur-3xl pointer-events-none'></div>

            <div className='relative space-y-3 sm:space-y-4'>
              {/* 一级分类 */}
              <CapsuleSelector
                options={categories.primary_categories.map((cat) => ({
                  label: cat.type_name,
                  value: cat.type_id,
                }))}
                value={selectedPrimary}
                onChange={handlePrimaryChange}
                label='分类'
                enableVirtualScroll={true}
              />

              {/* 二级分类（仅一级非"全部"时显示） */}
              {selectedPrimary !== 0 &&
                categories.secondary_categories.length > 0 && (
                  <CapsuleSelector
                    options={categories.secondary_categories
                      .filter((cat) => cat.type_pid === selectedPrimary)
                      .map((cat) => ({
                        label: cat.type_name,
                        value: cat.type_id,
                      }))}
                    value={selectedSecondary}
                    onChange={handleSecondaryChange}
                    label='类型'
                    enableVirtualScroll={true}
                  />
                )}
            </div>
          </div>
        )}

        {/* 搜索模式提示 */}
        {isSearchMode && (
          <div className='bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Search
                  size={16}
                  className='text-blue-600 dark:text-blue-400'
                />
                <div>
                  <h3 className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                    搜索: "{searchKeyword}"
                  </h3>
                  <p className='text-xs text-blue-700 dark:text-blue-300 mt-1'>
                    在 "{sourceList.find((s) => s.key === selectedSource)?.name}
                    " 中的搜索结果
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSearch('')}
                className='text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-1'
              >
                <X size={14} />
                清除
              </button>
            </div>
          </div>
        )}

        {/* 缓存状态提示 */}
        {fromCache && (
          <div className='bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 border border-green-200 dark:border-green-800'>
            <div className='flex items-center gap-2'>
              <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse'></div>
              <div>
                <h3 className='text-sm font-medium text-green-900 dark:text-green-100'>
                  数据来自缓存
                </h3>
              </div>
            </div>
          </div>
        )}

        {/* 内容展示 */}
        <div className='max-w-[95%] mx-auto mt-8 overflow-visible will-change-scroll'>
          <VideoList videos={videos} loading={loading} />
          {/* 加载更多指示器 */}
          {hasMore && (
            <div
              ref={(el) => {
                if (el && el.offsetParent !== null) {
                  (
                    loadingRef as React.MutableRefObject<HTMLDivElement | null>
                  ).current = el;
                }
              }}
              className='flex justify-center py-4'
            >
              {isLoadingMore ? (
                <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
              ) : (
                <div className='h-6'></div>
              )}
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

export default function TVBoxPage() {
  return (
    <TVBoxPagePermissionCheck>
      <TVBoxPageContent />
    </TVBoxPagePermissionCheck>
  );
}
