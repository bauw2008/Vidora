'use client';

// StorageEvent is available in DOM standard

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useRef, useState, useTransition } from 'react';

import { GetBangumiCalendarData } from '@/lib/bangumi.client';
import {
  getDoubanCategories,
  getDoubanList,
  getDoubanRecommends,
} from '@/lib/douban.client';
import type { CustomCategory } from '@/lib/global-config';
import { logger } from '@/lib/logger';
import { DoubanItem, DoubanResult } from '@/lib/types';

import BackToTopButton from '@/components/BackToTopButton';
import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import DoubanCustomSelector from '@/components/DoubanCustomSelector';
import DoubanSelector from '@/components/DoubanSelector';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

import { MenuSettings } from '@/types/menu';

// 权限检查组件
function DoubanPagePermissionCheck({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();

  // 检查菜单访问权限
  const shouldRedirect = (() => {
    if (typeof window === 'undefined') {
      return false;
    }

    const disabledMenus =
      ((window as unknown as Record<string, unknown>)
        .__DISABLED_MENUS as Partial<MenuSettings>) || {};
    const type = searchParams.get('type') || 'movie';

    if (type === 'tv' && disabledMenus.showTVShows) {
      return true;
    } else if (type === 'anime' && disabledMenus.showAnime) {
      return true;
    } else if (type === 'show' && disabledMenus.showVariety) {
      return true;
    } else if (disabledMenus.showMovies) {
      return true;
    } else if (type === 'custom') {
      const customCategories =
        (
          (window as unknown as Record<string, unknown>).RUNTIME_CONFIG as {
            CUSTOM_CATEGORIES?: CustomCategory[];
          }
        )?.CUSTOM_CATEGORIES || [];
      const hasEnabledCategory = customCategories.some(
        (cat: CustomCategory) => !cat.disabled,
      );
      return !hasEnabledCategory;
    }

    return false;
  })();

  useEffect(() => {
    if (shouldRedirect) {
      window.location.href = '/';
    }
  }, [shouldRedirect]);

  if (shouldRedirect) {
    return null;
  }

  return <>{children}</>;
}

function DoubanPageClient() {
  const searchParams = useSearchParams();

  const [doubanData, setDoubanData] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectorsReady, setSelectorsReady] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [, startTransition] = useTransition();

  // 标记组件是否已挂载，避免服务端和客户端渲染不一致
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 用于存储最新参数值的 refs
  const currentParamsRef = useRef({
    type: '',
    primarySelection: '',
    secondarySelection: '',
    multiLevelSelection: {} as Record<string, string>,
    selectedWeekday: '',
    currentPage: 0,
  });

  const type = searchParams.get('type') || 'movie';

  // 获取 runtimeConfig 中的自定义分类数据
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(
    [],
  );

  // 选择器状态 - 完全独立，不依赖URL参数
  const [primarySelection, setPrimarySelection] = useState<string>(() => {
    // 从 URL 参数中读取 primary 值
    const primaryFromUrl = searchParams.get('primary');

    if (type === 'movie') {
      return primaryFromUrl || '热门';
    }
    if (type === 'tv' || type === 'show') {
      return primaryFromUrl || '最近热门';
    }
    if (type === 'anime') {
      // 番剧和剧场版允许从 URL 参数指定
      if (primaryFromUrl === '番剧' || primaryFromUrl === '剧场版') {
        return primaryFromUrl;
      }
      return '每日放送';
    }
    return primaryFromUrl || '';
  });
  const [secondarySelection, setSecondarySelection] = useState<string>(() => {
    if (type === 'movie') {
      return '全部';
    }
    if (type === 'tv') {
      return 'tv';
    }
    if (type === 'show') {
      return 'show';
    }
    return '全部';
  });

  // MultiLevelSelector 状态
  const [multiLevelValues, setMultiLevelValues] = useState<
    Record<string, string>
  >({
    type: 'all',
    region: 'all',
    year: 'all',
    platform: 'all',
    label: 'all',
    sort: 'T',
  });

  // 星期选择器状态
  const [selectedWeekday, setSelectedWeekday] = useState<string>('');

  // 获取自定义分类数据
  useEffect(() => {
    const loadCustomCategories = () => {
      const runtimeConfig = (window as unknown as Record<string, unknown>)
        .RUNTIME_CONFIG as { CUSTOM_CATEGORIES?: CustomCategory[] } | undefined;

      if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
        // 只显示未禁用的分类
        const enabledCategories = runtimeConfig.CUSTOM_CATEGORIES.filter(
          (cat: CustomCategory) => !cat.disabled,
        );
        setCustomCategories(enabledCategories);
      } else {
        // 如果RUNTIME_CONFIG没有，尝试从localStorage读取
        try {
          const savedCategories = localStorage.getItem(
            'vidora-custom-categories',
          );
          if (savedCategories) {
            const categories = JSON.parse(savedCategories) as CustomCategory[];
            const enabledCategories = categories.filter(
              (cat: CustomCategory) => !cat.disabled,
            );
            setCustomCategories(enabledCategories);
          }
        } catch (error) {
          logger.error('加载自定义分类失败:', error);
        }
      }
    };

    loadCustomCategories();
    // 监听storage变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vidora-custom-categories' && e.newValue) {
        loadCustomCategories();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 同步最新参数值到 ref
  useEffect(() => {
    currentParamsRef.current = {
      type,
      primarySelection,
      secondarySelection,
      multiLevelSelection: multiLevelValues,
      selectedWeekday,
      currentPage,
    };
  }, [
    type,
    primarySelection,
    secondarySelection,
    multiLevelValues,
    selectedWeekday,
    currentPage,
  ]);

  // 初始化时标记选择器为准备好状态
  useEffect(() => {
    // 短暂延迟确保初始状态设置完成
    const timer = setTimeout(() => {
      setSelectorsReady(true);
    }, 50);

    return () => {
      clearTimeout(timer);
    };
  }, []); // 只在组件挂载时执行一次

  // type变化时重置选择器状态
  useEffect(() => {
    // 立即重置状态
    setSelectorsReady(false);
    setLoading(true); // 立即显示loading状态

    if (type === 'custom' && customCategories.length > 0) {
      // 自定义分类模式：优先选择 movie，如果没有 movie 则选择 tv
      const types = Array.from(
        new Set(customCategories.map((cat) => cat.type)),
      );
      if (types.length > 0) {
        // 优先选择 movie，如果没有 movie 则选择 tv
        let selectedType = types[0]; // 默认选择第一个
        if (types.includes('movie')) {
          selectedType = 'movie';
        } else {
          selectedType = 'tv';
        }
        setPrimarySelection(selectedType);

        // 设置选中类型的第一个分类的 query 作为二级选择
        const firstCategory = customCategories.find(
          (cat) => cat.type === selectedType,
        );
        if (firstCategory) {
          setSecondarySelection(firstCategory.query);
        }
      }
    } else {
      // 原有逻辑
      if (type === 'movie') {
        setPrimarySelection('热门');
        setSecondarySelection('全部');
      } else if (type === 'tv') {
        setPrimarySelection('最近热门');
        setSecondarySelection('tv');
      } else if (type === 'show') {
        setPrimarySelection('最近热门');
        setSecondarySelection('show');
      } else if (type === 'anime') {
        // 从 URL 参数中读取 primary 值
        const primaryFromUrl = searchParams.get('primary');
        // 番剧和剧场版允许从 URL 参数指定
        if (primaryFromUrl === '番剧' || primaryFromUrl === '剧场版') {
          setPrimarySelection(primaryFromUrl);
        } else {
          setPrimarySelection('每日放送');
        }
        setSecondarySelection('全部');
      } else {
        setPrimarySelection('');
        setSecondarySelection('全部');
      }
    }

    // 清空 MultiLevelSelector 状态
    setMultiLevelValues({
      type: 'all',
      region: 'all',
      year: 'all',
      platform: 'all',
      label: 'all',
      sort: 'T',
    });

    // 使用短暂延迟确保状态更新完成后标记选择器准备好
    const timer = setTimeout(() => {
      setSelectorsReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [type, customCategories.length, searchParams, customCategories]);

  // 生成骨架屏数据
  const skeletonData = Array.from({ length: 25 }, (_, index) => index);

  // 生成API请求参数的辅助函数
  interface RequestParams {
    kind: 'tv' | 'movie';
    category: string;
    type: string;
    pageLimit: number;
    pageStart: number;
  }

  const _getRequestParams = (pageStart: number): RequestParams => {
    // 当type为tv或show时，kind统一为'tv'，category使用type本身
    if (type === 'tv' || type === 'show') {
      return {
        kind: 'tv' as const,
        category: type,
        type: secondarySelection,
        pageLimit: 25,
        pageStart,
      };
    }

    // 电影类型保持原逻辑
    return {
      kind: type as 'tv' | 'movie',
      category: primarySelection,
      type: secondarySelection,
      pageLimit: 25,
      pageStart,
    };
  };

  // 只在选择器准备好后才加载数据
  useEffect(() => {
    // 只有在选择器准备好时才开始加载
    if (!selectorsReady) {
      return;
    }

    // 防抖的数据加载函数
    const loadInitialData = async () => {
      // 创建当前参数的快照
      const requestSnapshot = {
        type,
        primarySelection,
        secondarySelection,
        multiLevelSelection: multiLevelValues,
        selectedWeekday,
        currentPage: 0,
      };

      // 生成API请求参数的辅助函数
      const getRequestParams = (pageStart: number): RequestParams => {
        // 当type为tv或show时，kind统一为'tv'，category使用type本身
        if (type === 'tv' || type === 'show') {
          return {
            kind: 'tv' as const,
            category: type,
            type: secondarySelection,
            pageLimit: 25,
            pageStart,
          };
        }

        // 电影类型保持原逻辑
        return {
          kind: type as 'tv' | 'movie',
          category: primarySelection,
          type: secondarySelection,
          pageLimit: 25,
          pageStart,
        };
      };

      try {
        setLoading(true);
        // 确保在加载初始数据时重置页面状态
        setDoubanData([]);
        setCurrentPage(0);
        setHasMore(true);
        setIsLoadingMore(false);

        let data: DoubanResult;

        if (type === 'custom') {
          // 自定义分类模式：根据选中的一级和二级选项获取对应的分类
          // 如果没有自定义分类，显示空状态
          if (customCategories.length === 0) {
            data = {
              code: 200,
              message: 'success',
              list: [],
            };
          } else {
            const selectedCategory = customCategories.find(
              (cat) =>
                cat.type === primarySelection &&
                cat.query === secondarySelection,
            );

            if (selectedCategory) {
              data = await getDoubanList({
                tag: selectedCategory.query,
                type: selectedCategory.type,
                pageLimit: 25,
                pageStart: 0,
              });
            } else {
              // 如果没找到，尝试使用第一个可用的分类
              const fallbackCategory = customCategories[0];
              setPrimarySelection(fallbackCategory.type);
              setSecondarySelection(fallbackCategory.query);
              data = await getDoubanList({
                tag: fallbackCategory.query,
                type: fallbackCategory.type,
                pageLimit: 25,
                pageStart: 0,
              });
            }
          }
        } else if (type === 'anime' && primarySelection === '每日放送') {
          const calendarData = await GetBangumiCalendarData();
          const weekdayData = calendarData.find(
            (item) => item.weekday.en === selectedWeekday,
          );
          if (weekdayData) {
            data = {
              code: 200,
              message: 'success',
              list: weekdayData.items.map((item) => ({
                id: item.id?.toString() || '',
                title: item.name_cn || item.name,
                poster:
                  item.images?.large ||
                  item.images?.common ||
                  item.images?.medium ||
                  item.images?.small ||
                  item.images?.grid ||
                  '/placeholder-poster.jpg',
                rate: item.rating?.score?.toFixed(1) || '',
                year: item.air_date?.split('-')?.[0] || '',
              })),
            };
          } else {
            throw new Error('没有找到对应的日期');
          }
        } else if (type === 'anime') {
          data = await getDoubanRecommends({
            kind: primarySelection === '番剧' ? 'tv' : 'movie',
            pageLimit: 25,
            pageStart: 0,
            category: '动画',
            format: primarySelection === '番剧' ? '电视剧' : '',
            region: multiLevelValues.region
              ? (multiLevelValues.region as string)
              : '',
            year: multiLevelValues.year
              ? (multiLevelValues.year as string)
              : '',
            platform: multiLevelValues.platform
              ? (multiLevelValues.platform as string)
              : '',
            sort: multiLevelValues.sort
              ? (multiLevelValues.sort as string)
              : '',
            label: multiLevelValues.label
              ? (multiLevelValues.label as string)
              : '',
          });
        } else if (primarySelection === '全部') {
          data = await getDoubanRecommends({
            kind: type === 'show' ? 'tv' : (type as 'tv' | 'movie'),
            pageLimit: 25,
            pageStart: 0, // 初始数据加载始终从第一页开始
            category: multiLevelValues.type
              ? (multiLevelValues.type as string)
              : '',
            format: type === 'show' ? '综艺' : type === 'tv' ? '电视剧' : '',
            region: multiLevelValues.region
              ? (multiLevelValues.region as string)
              : '',
            year: multiLevelValues.year
              ? (multiLevelValues.year as string)
              : '',
            platform: multiLevelValues.platform
              ? (multiLevelValues.platform as string)
              : '',
            sort: multiLevelValues.sort
              ? (multiLevelValues.sort as string)
              : '',
            label: multiLevelValues.label
              ? (multiLevelValues.label as string)
              : '',
          });
        } else {
          data = await getDoubanCategories(getRequestParams(0));
        }

        if (data.code === 200) {
          // 更宽松的参数检查：只检查关键参数，忽略currentPage的差异
          const currentSnapshot = { ...currentParamsRef.current };
          const keyParamsMatch =
            requestSnapshot.type === currentSnapshot.type &&
            requestSnapshot.primarySelection ===
              currentSnapshot.primarySelection &&
            requestSnapshot.secondarySelection ===
              currentSnapshot.secondarySelection &&
            requestSnapshot.selectedWeekday ===
              currentSnapshot.selectedWeekday &&
            JSON.stringify(requestSnapshot.multiLevelSelection) ===
              JSON.stringify(currentSnapshot.multiLevelSelection);

          if (keyParamsMatch) {
            setDoubanData(data.list);
            setHasMore(data.list.length !== 0);
            setLoading(false);
          }
          // 如果参数不一致，不执行任何操作，避免设置过期数据
        } else {
          throw new Error(data.message || '获取数据失败');
        }
      } catch (err) {
        logger.error('加载数据失败:', err);
        setLoading(false); // 发生错误时总是停止loading状态
      }
    };

    // 清除之前的防抖定时器
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // 使用防抖机制加载数据，避免连续状态更新触发多次请求
    debounceTimeoutRef.current = setTimeout(() => {
      loadInitialData();
    }, 100); // 100ms 防抖延迟

    // 清理函数
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [
    selectorsReady,
    type,
    primarySelection,
    secondarySelection,
    multiLevelValues,
    selectedWeekday,
    customCategories.length,
    customCategories,
  ]);

  // 单独处理 currentPage 变化（加载更多）
  useEffect(() => {
    if (currentPage > 0) {
      const fetchMoreData = async () => {
        // 创建当前参数的快照
        const requestSnapshot = {
          type,
          primarySelection,
          secondarySelection,
          multiLevelSelection: multiLevelValues,
          selectedWeekday,
          currentPage,
        };

        // 立即更新currentParamsRef，避免异步更新导致的一致性检查失败
        currentParamsRef.current = requestSnapshot;

        try {
          setIsLoadingMore(true);

          let data: DoubanResult;
          if (type === 'custom') {
            // 自定义分类模式：根据选中的一级和二级选项获取对应的分类
            // 如果没有自定义分类，返回空数据
            if (customCategories.length === 0) {
              data = {
                code: 200,
                message: 'success',
                list: [],
              };
            } else {
              const selectedCategory = customCategories.find(
                (cat) =>
                  cat.type === primarySelection &&
                  cat.query === secondarySelection,
              );

              if (selectedCategory) {
                data = await getDoubanList({
                  tag: selectedCategory.query,
                  type: selectedCategory.type,
                  pageLimit: 25,
                  pageStart: currentPage * 25,
                });
              } else {
                // 如果没找到，使用第一个可用的分类
                const fallbackCategory = customCategories[0];
                data = await getDoubanList({
                  tag: fallbackCategory.query,
                  type: fallbackCategory.type,
                  pageLimit: 25,
                  pageStart: currentPage * 25,
                });
              }
            }
          } else if (type === 'anime' && primarySelection === '每日放送') {
            // 每日放送模式下，不进行数据请求，返回空数据
            data = {
              code: 200,
              message: 'success',
              list: [],
            };
          } else if (type === 'anime') {
            data = await getDoubanRecommends({
              kind: primarySelection === '番剧' ? 'tv' : 'movie',
              pageLimit: 25,
              pageStart: currentPage * 25,
              category: '动画',
              format: primarySelection === '番剧' ? '电视剧' : '',
              region: multiLevelValues.region
                ? (multiLevelValues.region as string)
                : '',
              year: multiLevelValues.year
                ? (multiLevelValues.year as string)
                : '',
              platform: multiLevelValues.platform
                ? (multiLevelValues.platform as string)
                : '',
              sort: multiLevelValues.sort
                ? (multiLevelValues.sort as string)
                : '',
              label: multiLevelValues.label
                ? (multiLevelValues.label as string)
                : '',
            });
          } else if (primarySelection === '全部') {
            data = await getDoubanRecommends({
              kind: type === 'show' ? 'tv' : (type as 'tv' | 'movie'),
              pageLimit: 25,
              pageStart: currentPage * 25,
              category: multiLevelValues.type
                ? (multiLevelValues.type as string)
                : '',
              format: type === 'show' ? '综艺' : type === 'tv' ? '电视剧' : '',
              region: multiLevelValues.region
                ? (multiLevelValues.region as string)
                : '',
              year: multiLevelValues.year
                ? (multiLevelValues.year as string)
                : '',
              platform: multiLevelValues.platform
                ? (multiLevelValues.platform as string)
                : '',
              sort: multiLevelValues.sort
                ? (multiLevelValues.sort as string)
                : '',
              label: multiLevelValues.label
                ? (multiLevelValues.label as string)
                : '',
            });
          } else {
            // 生成API请求参数的辅助函数
            const getRequestParams = (pageStart: number): RequestParams => {
              // 当type为tv或show时，kind统一为'tv'，category使用type本身
              if (type === 'tv' || type === 'show') {
                return {
                  kind: 'tv' as const,
                  category: type,
                  type: secondarySelection,
                  pageLimit: 25,
                  pageStart,
                };
              }

              // 电影类型保持原逻辑
              return {
                kind: type as 'tv' | 'movie',
                category: primarySelection,
                type: secondarySelection,
                pageLimit: 25,
                pageStart,
              };
            };
            data = await getDoubanCategories(
              getRequestParams(currentPage * 25),
            );
          }

          if (data.code === 200) {
            // 更宽松的参数检查：只检查关键参数，忽略currentPage的差异
            const currentSnapshot = { ...currentParamsRef.current };
            const keyParamsMatch =
              requestSnapshot.type === currentSnapshot.type &&
              requestSnapshot.primarySelection ===
                currentSnapshot.primarySelection &&
              requestSnapshot.secondarySelection ===
                currentSnapshot.secondarySelection &&
              requestSnapshot.selectedWeekday ===
                currentSnapshot.selectedWeekday &&
              JSON.stringify(requestSnapshot.multiLevelSelection) ===
                JSON.stringify(currentSnapshot.multiLevelSelection);

            if (keyParamsMatch) {
              setDoubanData((prev) => [...prev, ...data.list]);
              setHasMore(data.list.length !== 0);
            }
          } else {
            throw new Error(data.message || '获取数据失败');
          }
        } catch (err) {
          logger.error(err);
        } finally {
          setIsLoadingMore(false);
        }
      };

      fetchMoreData();
    }
  }, [
    currentPage,
    customCategories.length,
    type,
    primarySelection,
    secondarySelection,
    multiLevelValues,
    selectedWeekday,
    customCategories,
  ]);

  // 设置滚动监听
  useEffect(() => {
    // 如果没有更多数据或正在加载，则不设置监听
    if (!hasMore || isLoadingMore || loading) {
      return;
    }

    // 确保 loadingRef 存在
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
  const handlePrimaryChange = (value: string | number) => {
    const strValue = String(value);
    // 只有当值真正改变时才设置loading状态
    if (strValue !== primarySelection) {
      setLoading(true);
      // 立即重置页面状态，防止基于旧状态的请求
      setCurrentPage(0);
      setDoubanData([]);
      setHasMore(true);
      setIsLoadingMore(false);

      // 清空 MultiLevelSelector 状态
      setMultiLevelValues({
        type: 'all',
        region: 'all',
        year: 'all',
        platform: 'all',
        label: 'all',
        sort: 'T',
      });

      // 如果是自定义分类模式，同时更新一级和二级选择器
      if (type === 'custom' && customCategories.length > 0) {
        const firstCategory = customCategories.find(
          (cat) => cat.type === strValue,
        );
        if (firstCategory) {
          // 批量更新状态，避免多次触发数据加载
          setPrimarySelection(strValue);
          setSecondarySelection(firstCategory.query);
        } else {
          setPrimarySelection(strValue);
        }
      } else {
        // 电视剧和综艺切换到"最近热门"时，重置二级分类为第一个选项
        if ((type === 'tv' || type === 'show') && strValue === '最近热门') {
          setPrimarySelection(strValue);
          if (type === 'tv') {
            setSecondarySelection('tv');
          } else if (type === 'show') {
            setSecondarySelection('show');
          }
        } else {
          setPrimarySelection(strValue);
        }
      }
    }
  };

  const handleSecondaryChange = (value: string | number) => {
    const strValue = String(value);
    // 只有当值真正改变时才设置loading状态
    if (strValue !== secondarySelection) {
      setLoading(true);
      // 立即重置页面状态，防止基于旧状态的请求
      setCurrentPage(0);
      setDoubanData([]);
      setHasMore(true);
      setIsLoadingMore(false);
      setSecondarySelection(strValue);
    }
  };

  const handleMultiLevelChange = (values: Record<string, string>) => {
    // 比较两个对象是否相同，忽略顺序
    const isEqual = (
      obj1: Record<string, string>,
      obj2: Record<string, string>,
    ) => {
      const keys1 = Object.keys(obj1).sort();
      const keys2 = Object.keys(obj2).sort();

      if (keys1.length !== keys2.length) {
        return false;
      }

      return keys1.every((key) => obj1[key] === obj2[key]);
    };

    // 如果相同，则不设置loading状态
    if (isEqual(values, multiLevelValues)) {
      return;
    }

    setLoading(true);
    // 立即重置页面状态，防止基于旧状态的请求
    setCurrentPage(0);
    setDoubanData([]);
    setHasMore(true);
    setIsLoadingMore(false);
    setMultiLevelValues(values);
  };

  const handleWeekdayChange = (weekday: string) => {
    setSelectedWeekday(weekday);
  };

  const getPageTitle = () => {
    // 根据 type 生成标题
    return type === 'movie'
      ? '电影'
      : type === 'tv'
        ? '电视剧'
        : type === 'anime'
          ? '动漫'
          : type === 'show'
            ? '综艺'
            : '其他';
  };

  const getPageDescription = () => {
    if (type === 'anime' && primarySelection === '每日放送') {
      return '来自 Bangumi 番组计划的精选内容';
    }
    return '来自豆瓣的精选内容';
  };

  const getActivePath = () => {
    const params = new URLSearchParams();
    if (type) {
      params.set('type', type);
    }

    const queryString = params.toString();
    const activePath = `/douban${queryString ? `?${queryString}` : ''}`;
    return activePath;
  };

  return (
    <PageLayout activePath={getActivePath()}>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
        {/* 页面标题和选择器 */}
        <div className='mb-6 sm:mb-8 space-y-4 sm:space-y-6'>
          {/* 页面标题 */}
          <div>
            <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2 dark:text-gray-200'>
              {getPageTitle()}
            </h1>
            <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
              {getPageDescription()}
            </p>
          </div>

          {/* 选择器组件 */}
          {type === 'movie' ||
          type === 'tv' ||
          type === 'anime' ||
          type === 'show' ? (
            <div className='relative bg-gradient-to-br from-white/80 via-blue-50/30 to-purple-50/30 dark:from-gray-800/60 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 sm:p-6 border border-blue-200/40 dark:border-blue-700/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300'>
              {/* 装饰性光晕 */}
              <div className='absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none'></div>
              <div className='absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-green-300/20 to-teal-300/20 rounded-full blur-3xl pointer-events-none'></div>

              <div className='relative'>
                <DoubanSelector
                  type={type as 'movie' | 'tv' | 'show' | 'anime'}
                  primarySelection={primarySelection}
                  secondarySelection={secondarySelection}
                  onPrimaryChange={handlePrimaryChange}
                  onSecondaryChange={handleSecondaryChange}
                  onMultiLevelChange={handleMultiLevelChange}
                  onWeekdayChange={handleWeekdayChange}
                />
              </div>
            </div>
          ) : (
            <div className='relative bg-gradient-to-br from-white/80 via-blue-50/30 to-purple-50/30 dark:from-gray-800/60 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 sm:p-6 border border-blue-200/40 dark:border-blue-700/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300'>
              {/* 装饰性光晕 */}
              <div className='absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none'></div>
              <div className='absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-green-300/20 to-teal-300/20 rounded-full blur-3xl pointer-events-none'></div>

              <div className='relative'>
                <DoubanCustomSelector
                  customCategories={customCategories}
                  primarySelection={primarySelection}
                  secondarySelection={secondarySelection}
                  onPrimaryChange={handlePrimaryChange}
                  onSecondaryChange={handleSecondaryChange}
                />
              </div>
            </div>
          )}
        </div>

        {/* 内容展示区域 */}
        <div className='max-w-[95%] mx-auto mt-8 overflow-visible will-change-scroll'>
          {/* 传统网格渲染 */}
          {isMounted && (
            <>
              {/* 传统网格渲染 */}
              <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20 will-change-scroll'>
                {loading || !selectorsReady
                  ? // 显示骨架屏
                    skeletonData.map((index) => (
                      <DoubanCardSkeleton key={index} />
                    ))
                  : // 显示实际数据
                    doubanData.map((item) => (
                      <div
                        key={item.id || item.title}
                        className='w-full content-visibility-auto contain-intrinsic-size-[120px_252px] sm:contain-intrinsic-size-[160px_350px]'
                      >
                        <VideoCard
                          from='douban'
                          title={item.title}
                          poster={item.poster}
                          douban_id={Number(item.id)}
                          rate={item.rate}
                          year={item.year}
                          isBangumi={
                            type === 'anime' && primarySelection === '每日放送'
                          }
                        />
                      </div>
                    ))}
              </div>

              {/* 加载更多指示器 */}
              {hasMore && !loading && (
                <div
                  ref={(el) => {
                    if (el && el.offsetParent !== null) {
                      (
                        loadingRef as React.MutableRefObject<HTMLDivElement | null>
                      ).current = el;
                    }
                  }}
                  className='flex justify-center mt-12 py-8'
                >
                  {isLoadingMore && (
                    <div className='relative px-8 py-4 rounded-2xl bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-teal-900/20 border border-green-200/50 dark:border-green-700/50 shadow-lg backdrop-blur-sm overflow-hidden'>
                      {/* 动画背景 */}
                      <div className='absolute inset-0 bg-gradient-to-r from-green-400/10 via-emerald-400/10 to-teal-400/10 animate-pulse'></div>

                      {/* 内容 */}
                      <div className='relative flex items-center gap-3'>
                        {/* 旋转圈 */}
                        <div className='relative'>
                          <div className='animate-spin rounded-full h-8 w-8 border-3 border-green-200 dark:border-green-800'></div>
                          <div className='absolute inset-0 animate-spin rounded-full h-8 w-8 border-3 border-transparent border-t-green-500 dark:border-t-green-400'></div>
                        </div>

                        {/* 文字和点动画 */}
                        <div className='flex items-center gap-1'>
                          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                            加载中
                          </span>
                          <span className='flex gap-0.5'>
                            <span
                              className='animate-bounce'
                              style={{ animationDelay: '0ms' }}
                            >
                              .
                            </span>
                            <span
                              className='animate-bounce'
                              style={{ animationDelay: '150ms' }}
                            >
                              .
                            </span>
                            <span
                              className='animate-bounce'
                              style={{ animationDelay: '300ms' }}
                            >
                              .
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 没有更多数据提示 */}
              {!hasMore && doubanData.length > 0 && (
                <div className='flex justify-center mt-12 py-8'>
                  <div className='relative px-8 py-5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 border border-blue-200/50 dark:border-blue-700/50 shadow-lg backdrop-blur-sm overflow-hidden'>
                    {/* 装饰性背景 */}
                    <div className='absolute inset-0 bg-gradient-to-br from-blue-100/20 to-purple-100/20 dark:from-blue-800/10 dark:to-purple-800/10'></div>

                    {/* 内容 */}
                    <div className='relative flex flex-col items-center gap-2'>
                      {/* 完成图标 */}
                      <div className='relative'>
                        <div className='w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg'>
                          <svg
                            className='w-7 h-7 text-white'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth='2.5'
                              d='M5 13l4 4L19 7'
                            ></path>
                          </svg>
                        </div>
                        {/* 光圈效果 */}
                        <div className='absolute inset-0 rounded-full bg-blue-400/30 animate-ping'></div>
                      </div>

                      {/* 文字 */}
                      <div className='text-center'>
                        <p className='text-base font-semibold text-gray-800 dark:text-gray-200 mb-1'>
                          已加载全部内容
                        </p>
                        <p className='text-xs text-gray-600 dark:text-gray-400'>
                          共 {doubanData.length} 项
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 空状态 */}
              {!loading && doubanData.length === 0 && (
                <div className='flex justify-center py-16'>
                  <div className='relative px-12 py-10 rounded-3xl bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 dark:from-gray-800/40 dark:via-slate-800/40 dark:to-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 shadow-xl backdrop-blur-sm overflow-hidden max-w-md'>
                    {/* 装饰性元素 */}
                    <div className='absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl'></div>
                    <div className='absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-pink-200/20 to-orange-200/20 rounded-full blur-3xl'></div>

                    {/* 内容 */}
                    <div className='relative flex flex-col items-center gap-4'>
                      {/* 插图图标 */}
                      <div className='relative'>
                        <div className='w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-slate-200 dark:from-gray-700 dark:to-slate-700 flex items-center justify-center shadow-lg'>
                          {type === 'custom' ? (
                            <svg
                              className='w-12 h-12 text-gray-400 dark:text-gray-500'
                              fill='none'
                              stroke='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth='1.5'
                                d='M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
                              ></path>
                            </svg>
                          ) : (
                            <svg
                              className='w-12 h-12 text-gray-400 dark:text-gray-500'
                              fill='none'
                              stroke='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth='1.5'
                                d='M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4'
                              ></path>
                            </svg>
                          )}
                        </div>
                        {/* 浮动小点装饰 */}
                        <div className='absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping'></div>
                        <div className='absolute -bottom-1 -left-1 w-2 h-2 bg-purple-400 rounded-full animate-pulse'></div>
                      </div>

                      {/* 文字内容 */}
                      <div className='text-center space-y-2'>
                        <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                          {type === 'custom'
                            ? '暂无自定义分类'
                            : '暂无相关内容'}
                        </h3>
                        <p className='text-sm text-gray-600 dark:text-gray-400 max-w-xs'>
                          {type === 'custom'
                            ? '请在管理后台的分类配置中添加自定义分类'
                            : '尝试调整筛选条件或切换其他分类查看更多内容'}
                        </p>
                      </div>

                      {/* 装饰线 */}
                      <div className='w-16 h-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-600 rounded-full'></div>
                    </div>
                  </div>
                </div>
              )}
            </>
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

export default function DoubanPage() {
  return (
    <Suspense>
      <DoubanPagePermissionCheck>
        <DoubanPageClient />
      </DoubanPagePermissionCheck>
    </Suspense>
  );
}
