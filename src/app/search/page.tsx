/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any,@typescript-eslint/no-non-null-assertion,no-empty */
'use client';

import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, {
  startTransition,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
  getSearchHistory,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';
import { useFeaturePermission } from '@/hooks/useFeaturePermission';
import { useUserSettings } from '@/hooks/useUserSettings';

import AcgSearch from '@/components/AcgSearch';
import FloatingTools from '@/components/FloatingTools';
import NetDiskSearchResults from '@/components/NetDiskSearchResults';
import PageLayout from '@/components/PageLayout';
import SearchResultFilter, {
  SearchFilterCategory,
} from '@/components/SearchResultFilter';
import SearchSuggestions from '@/components/SearchSuggestions';
import TMDBFilterPanel, { TMDBFilterState } from '@/components/TMDBFilterPanel';
import VideoCard, { VideoCardHandle } from '@/components/VideoCard';

function SearchPageClient() {
  // 检查用户权限
  const { hasPermission } = useFeaturePermission();

  // 功能启用状态（从全局配置读取）
  const isNetDiskEnabled =
    typeof window !== 'undefined'
      ? ((window as any).RUNTIME_CONFIG.NetDiskConfig?.enabled ?? false)
      : false;
  const isTMDBActorSearchEnabled =
    typeof window !== 'undefined'
      ? ((window as any).RUNTIME_CONFIG.TMDBConfig?.enableActorSearch ?? false)
      : false;

  // 搜索历史
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQueryRef = useRef<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [totalSources, setTotalSources] = useState(0);
  const [completedSources, setCompletedSources] = useState(0);
  // 使用 useUserSettings hook 管理设置
  const { settings } = useUserSettings();
  const pendingResultsRef = useRef<SearchResult[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const [useFluidSearch, setUseFluidSearch] = useState(settings.fluidSearch);

  // 网盘搜索相关状态
  const [searchType, setSearchType] = useState<
    'video' | 'netdisk' | 'tmdb-actor'
  >('video');
  const [netdiskResourceType, setNetdiskResourceType] = useState<
    'netdisk' | 'acg'
  >('netdisk');
  const [netdiskResults, setNetdiskResults] = useState<{
    [key: string]: any[];
  } | null>(null);
  const [netdiskLoading, setNetdiskLoading] = useState(false);
  const [netdiskError, setNetdiskError] = useState<string | null>(null);
  const [netdiskTotal, setNetdiskTotal] = useState(0);
  const [acgTriggerSearch, setAcgTriggerSearch] = useState<boolean>();
  const [, setAcgError] = useState<string | null>(null);

  // TMDB演员搜索相关状态
  const [tmdbActorResults, setTmdbActorResults] = useState<any[] | null>(null);
  const [tmdbActorLoading, setTmdbActorLoading] = useState(false);
  const [tmdbActorError, setTmdbActorError] = useState<string | null>(null);
  const [tmdbActorType, setTmdbActorType] = useState<'movie' | 'tv'>('movie');

  // TMDB筛选状态
  const [tmdbFilterState, setTmdbFilterState] = useState<TMDBFilterState>({
    startYear: undefined,
    endYear: undefined,
    minRating: undefined,
    maxRating: undefined,
    minPopularity: undefined,
    maxPopularity: undefined,
    minVoteCount: undefined,
    minEpisodeCount: undefined,
    genreIds: [],
    languages: [],
    onlyRated: false,
    sortBy: 'popularity',
    sortOrder: 'desc',
    limit: undefined, // 移除默认限制，显示所有结果
  });

  // TMDB筛选面板显示状态
  const [tmdbFilterVisible, setTmdbFilterVisible] = useState(false);
  // 聚合卡片 refs 与聚合统计缓存
  const groupRefs = useRef<Map<string, React.RefObject<VideoCardHandle>>>(
    new Map(),
  );
  const groupStatsRef = useRef<
    Map<
      string,
      { douban_id?: number; episodes?: number; source_names: string[] }
    >
  >(new Map());

  const getGroupRef = (key: string) => {
    let ref = groupRefs.current.get(key);
    if (!ref) {
      ref = React.createRef<VideoCardHandle>();
      groupRefs.current.set(key, ref);
    }
    return ref;
  };

  const computeGroupStats = (group: SearchResult[]) => {
    const episodes = (() => {
      const countMap = new Map<number, number>();
      group.forEach((g) => {
        const len = g.episodes?.length || 0;
        if (len > 0) {
          countMap.set(len, (countMap.get(len) || 0) + 1);
        }
      });
      let max = 0;
      let res = 0;
      countMap.forEach((v, k) => {
        if (v > max) {
          max = v;
          res = k;
        }
      });
      return res;
    })();
    const source_names = Array.from(
      new Set(group.map((g) => g.source_name).filter(Boolean)),
    ) as string[];

    const douban_id = (() => {
      const countMap = new Map<number, number>();
      group.forEach((g) => {
        if (g.douban_id && g.douban_id > 0) {
          countMap.set(g.douban_id, (countMap.get(g.douban_id) || 0) + 1);
        }
      });
      let max = 0;
      let res: number | undefined;
      countMap.forEach((v, k) => {
        if (v > max) {
          max = v;
          res = k;
        }
      });
      return res;
    })();

    return { episodes, source_names, douban_id };
  };
  // 过滤器：非聚合与聚合
  const [filterAll, setFilterAll] = useState<{
    source: string;
    title: string;
    year: string;
    type: string;
    yearOrder: 'none' | 'asc' | 'desc';
  }>({
    source: 'all',
    title: 'all',
    year: 'all',
    type: 'all',
    yearOrder: 'none',
  });
  const [filterAgg, setFilterAgg] = useState<{
    source: string;
    title: string;
    year: string;
    type: string;
    yearOrder: 'none' | 'asc' | 'desc';
  }>({
    source: 'all',
    title: 'all',
    year: 'all',
    type: 'all',
    yearOrder: 'none',
  });

  const [viewMode, setViewMode] = useState<'agg' | 'all'>(
    settings.defaultAggregateSearch ? 'agg' : 'all',
  );

  // 在“无排序”场景用于每个源批次的预排序：完全匹配标题优先，其次年份倒序，未知年份最后
  const sortBatchForNoOrder = (items: SearchResult[]) => {
    const q = currentQueryRef.current.trim();
    return items.slice().sort((a, b) => {
      const aExact = (a.title || '').trim() === q;
      const bExact = (b.title || '').trim() === q;
      if (aExact && !bExact) {
        return -1;
      }
      if (!aExact && bExact) {
        return 1;
      }

      const aNum = Number.parseInt(a.year as any, 10);
      const bNum = Number.parseInt(b.year as any, 10);
      const aValid = !Number.isNaN(aNum);
      const bValid = !Number.isNaN(bNum);
      if (aValid && !bValid) {
        return -1;
      }
      if (!aValid && bValid) {
        return 1;
      }
      if (aValid && bValid) {
        return bNum - aNum;
      } // 年份倒序
      return 0;
    });
  };

  // 简化的年份排序：unknown/空值始终在最后
  const compareYear = (
    aYear: string,
    bYear: string,
    order: 'none' | 'asc' | 'desc',
  ) => {
    // 如果是无排序状态，返回0（保持原顺序）
    if (order === 'none') {
      return 0;
    }

    // 处理空值和unknown
    const aIsEmpty = !aYear || aYear === 'unknown';
    const bIsEmpty = !bYear || bYear === 'unknown';

    if (aIsEmpty && bIsEmpty) {
      return 0;
    }
    if (aIsEmpty) {
      return 1;
    } // a 在后
    if (bIsEmpty) {
      return -1;
    } // b 在后

    // 都是有效年份，按数字比较
    const aNum = parseInt(aYear, 10);
    const bNum = parseInt(bYear, 10);

    return order === 'asc' ? aNum - bNum : bNum - aNum;
  };

  // 聚合后的结果（按标题和年份分组）
  const aggregatedResults = (() => {
    const map = new Map<string, SearchResult[]>();
    const keyOrder: string[] = []; // 记录键出现的顺序

    searchResults.forEach((item) => {
      // 使用 title + year + type 作为键，year 必然存在
      const key = `${item.title.replaceAll(' ', '')}-${
        item.year || 'unknown'
      }-${item.type}`;
      const arr = map.get(key) || [];

      // 如果是新的键，记录其顺序
      if (arr.length === 0) {
        keyOrder.push(key);
      }

      arr.push(item);
      map.set(key, arr);
    });

    // 按出现顺序返回聚合结果
    const aggregatedResults = keyOrder.map(
      (key) => [key, map.get(key)!] as [string, SearchResult[]],
    );

    return aggregatedResults;
  })();

  // 当聚合结果变化时，如果某个聚合已存在，则调用其卡片 ref 的 set 方法增量更新
  useEffect(() => {
    aggregatedResults.forEach(([mapKey, group]) => {
      const stats = computeGroupStats(group);
      const prev = groupStatsRef.current.get(mapKey);
      if (!prev) {
        // 第一次出现，记录初始值，不调用 ref（由初始 props 渲染）
        groupStatsRef.current.set(mapKey, stats);
        return;
      }
      // 对比变化并调用对应的 set 方法
      const ref = groupRefs.current.get(mapKey);
      if (ref && ref.current) {
        if (prev.episodes !== stats.episodes) {
          ref.current.setEpisodes(stats.episodes);
        }
        const prevNames = (prev.source_names || []).join('|');
        const nextNames = (stats.source_names || []).join('|');
        if (prevNames !== nextNames) {
          ref.current.setSourceNames(stats.source_names);
        }
        if (prev.douban_id !== stats.douban_id) {
          ref.current.setDoubanId(stats.douban_id);
        }
        groupStatsRef.current.set(mapKey, stats);
      }
    });
  }, [aggregatedResults]);

  // 构建筛选选项
  const filterOptions = (() => {
    const sourcesSet = new Map<string, string>();
    const titlesSet = new Set<string>();
    const yearsSet = new Set<string>();
    const typesSet = new Set<string>();

    searchResults.forEach((item) => {
      if (item.source && item.source_name) {
        sourcesSet.set(item.source, item.source_name);
      }
      if (item.title) {
        titlesSet.add(item.title);
      }
      if (item.year) {
        yearsSet.add(item.year);
      }
      if (item.type) {
        typesSet.add(item.type);
      }
    });

    const sourceOptions: { label: string; value: string }[] = [
      { label: '全部来源', value: 'all' },
      ...Array.from(sourcesSet.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ label, value })),
    ];

    const titleOptions: { label: string; value: string }[] = [
      { label: '全部标题', value: 'all' },
      ...Array.from(titlesSet.values())
        .sort((a, b) => a.localeCompare(b))
        .map((t) => ({ label: t, value: t })),
    ];

    // 年份: 将 unknown 放末尾
    const years = Array.from(yearsSet.values());
    const knownYears = years
      .filter((y) => y !== 'unknown')
      .sort((a, b) => parseInt(b) - parseInt(a));
    const hasUnknown = years.includes('unknown');
    const yearOptions: { label: string; value: string }[] = [
      { label: '全部年份', value: 'all' },
      ...knownYears.map((y) => ({ label: y, value: y })),
      ...(hasUnknown ? [{ label: '未知', value: 'unknown' }] : []),
    ];

    // 类型选项：固定顺序，电影、动漫、剧集、综艺、短剧、纪录片（搜索中不包含直播）
    const typeLabels: { [key: string]: string } = {
      movie: '电影',
      tv: '剧集',
      anime: '动漫',
      variety: '综艺',
      shortdrama: '短剧',
      documentary: '纪录片',
    };

    const typeOptions: { label: string; value: string }[] = [
      { label: '全部类型', value: 'all' },
      ...Array.from(typesSet.values())
        .filter((type) => typeLabels[type]) // 只显示已知的类型
        .sort((a, b) => {
          const order = [
            'movie',
            'tv',
            'anime',
            'variety',
            'shortdrama',
            'documentary',
          ];
          return order.indexOf(a) - order.indexOf(b);
        })
        .map((type) => ({ label: typeLabels[type] || type, value: type })),
    ];

    // 第一排：类型筛选（电影、动漫、剧集等）
    const categoriesAll: SearchFilterCategory[] = [
      { key: 'type', label: '类型', options: typeOptions },
    ];

    const categoriesAgg: SearchFilterCategory[] = [
      { key: 'type', label: '类型', options: typeOptions },
    ];

    // 第二排筛选选项（来源、标题、年份）- 用于在UI中分开显示
    const secondaryFilterOptionsAll: SearchFilterCategory[] = [
      { key: 'source', label: '来源', options: sourceOptions },
      { key: 'title', label: '标题', options: titleOptions },
      { key: 'year', label: '年份', options: yearOptions },
    ];

    const secondaryFilterOptionsAgg: SearchFilterCategory[] = [
      { key: 'source', label: '来源', options: sourceOptions },
      { key: 'title', label: '标题', options: titleOptions },
      { key: 'year', label: '年份', options: yearOptions },
    ];

    return {
      categoriesAll,
      categoriesAgg,
      secondaryFilterOptionsAll,
      secondaryFilterOptionsAgg,
    };
  })();

  // 非聚合：应用筛选与排序
  const filteredAllResults = (() => {
    const { source, title, year, type, yearOrder } = filterAll;
    const filtered = searchResults.filter((item) => {
      if (source !== 'all' && item.source !== source) {
        return false;
      }
      if (title !== 'all' && item.title !== title) {
        return false;
      }
      if (year !== 'all' && item.year !== year) {
        return false;
      }
      if (type !== 'all' && item.type !== type) {
        return false;
      }

      return true;
    });

    // 如果是无排序状态，直接返回过滤后的原始顺序
    if (yearOrder === 'none') {
      return filtered;
    }

    // 简化排序：1. 年份排序，2. 年份相同时精确匹配在前，3. 标题排序
    return filtered.sort((a, b) => {
      // 首先按年份排序
      const yearComp = compareYear(a.year, b.year, yearOrder);
      if (yearComp !== 0) {
        return yearComp;
      }

      // 年份相同时，精确匹配在前
      const aExactMatch = a.title === searchQuery.trim();
      const bExactMatch = b.title === searchQuery.trim();
      if (aExactMatch && !bExactMatch) {
        return -1;
      }
      if (!aExactMatch && bExactMatch) {
        return 1;
      }

      // 最后按标题排序，正序时字母序，倒序时反字母序
      return yearOrder === 'asc'
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
    });
  })();

  // 聚合：应用筛选与排序
  const filteredAggResults = (() => {
    const { source, title, year, type, yearOrder } = filterAgg as any;
    const filtered = aggregatedResults.filter(([_, group]) => {
      const gTitle = group[0]?.title ?? '';
      const gYear = group[0]?.year ?? 'unknown';
      const gType = group[0]?.type ?? '';
      const hasSource =
        source === 'all' ? true : group.some((item) => item.source === source);
      if (!hasSource) {
        return false;
      }
      if (title !== 'all' && gTitle !== title) {
        return false;
      }
      if (year !== 'all' && gYear !== year) {
        return false;
      }
      if (type !== 'all' && gType !== type) {
        return false;
      }

      return true;
    });

    // 如果是无排序状态，保持按关键字+年份+类型出现的原始顺序
    if (yearOrder === 'none') {
      return filtered;
    }

    // 简化排序：1. 年份排序，2. 年份相同时精确匹配在前，3. 标题排序
    return filtered.sort((a, b) => {
      // 首先按年份排序
      const aYear = a[1][0].year;
      const bYear = b[1][0].year;
      const yearComp = compareYear(aYear, bYear, yearOrder);
      if (yearComp !== 0) {
        return yearComp;
      }

      // 年份相同时，精确匹配在前
      const aExactMatch = a[1][0].title === searchQuery.trim();
      const bExactMatch = b[1][0].title === searchQuery.trim();
      if (aExactMatch && !bExactMatch) {
        return -1;
      }
      if (!aExactMatch && bExactMatch) {
        return 1;
      }

      // 最后按标题排序，正序时字母序，倒序时反字母序
      const aTitle = a[1][0].title;
      const bTitle = b[1][0].title;
      return yearOrder === 'asc'
        ? aTitle.localeCompare(bTitle)
        : bTitle.localeCompare(aTitle);
    });
  })();

  useEffect(() => {
    // 无搜索参数时聚焦搜索框
    !searchParams.get('q') && document.getElementById('searchInput')?.focus();

    // 初始加载搜索历史
    getSearchHistory().then(setSearchHistory);

    // 检查URL参数并处理初始搜索
    const initialQuery = searchParams.get('q');
    if (initialQuery) {
      setSearchQuery(initialQuery);
      setShowResults(true);
      // 如果当前是网盘搜索模式，触发网盘搜索
      if (searchType === 'netdisk') {
        if (netdiskResourceType === 'netdisk') {
          handleNetDiskSearch(initialQuery);
        } else {
          setAcgTriggerSearch((prev) => !prev);
        }
      }
    }

    // 监听搜索历史更新事件
    const unsubscribe = subscribeToDataUpdates(
      'searchHistoryUpdated',
      (newHistory: string[]) => {
        setSearchHistory(newHistory);
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // 当搜索参数变化时更新搜索状态并执行搜索
    const query = searchParams.get('q') || '';
    currentQueryRef.current = query.trim();

    if (query) {
      setSearchQuery(query);
      // 新搜索：关闭旧连接并清空结果
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
        eventSourceRef.current = null;
      }
      setSearchResults([]);
      setTotalSources(0);
      setCompletedSources(0);
      // 清理缓冲
      pendingResultsRef.current = [];
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      setIsLoading(true);
      setShowResults(true);

      const trimmed = query.trim();

      // 每次搜索时重新读取设置，确保使用最新的配置
      let currentFluidSearch = useFluidSearch;
      if (typeof window !== 'undefined') {
        const savedFluidSearch = localStorage.getItem('fluidSearch');
        if (savedFluidSearch !== null) {
          currentFluidSearch = JSON.parse(savedFluidSearch);
        } else {
          const defaultFluidSearch =
            (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;
          currentFluidSearch = defaultFluidSearch;
        }
      }

      // 如果读取的配置与当前状态不同，更新状态
      if (currentFluidSearch !== useFluidSearch) {
        setUseFluidSearch(currentFluidSearch);
      }

      // 创建SSE连接，使用流式搜索端点
      const es = new EventSource(
        `/api/search/ws?q=${encodeURIComponent(trimmed)}`,
      );
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        if (!event.data) return;
        try {
          const payload = JSON.parse(event.data);
          if (currentQueryRef.current !== trimmed) return;
          switch (payload.type) {
            case 'start':
              setTotalSources(payload.totalSources || 0);
              setCompletedSources(0);
              break;
            case 'source_result': {
              setCompletedSources((prev) => prev + 1);
              if (
                Array.isArray(payload.results) &&
                payload.results.length > 0
              ) {
                // 缓冲新增结果，节流刷入，避免频繁重渲染导致闪烁
                const incoming: SearchResult[] =
                  payload.results as SearchResult[];
                pendingResultsRef.current.push(...incoming);
                if (!flushTimerRef.current) {
                  flushTimerRef.current = window.setTimeout(() => {
                    const toAppend = pendingResultsRef.current;
                    pendingResultsRef.current = [];
                    startTransition(() => {
                      setSearchResults((prev) => prev.concat(toAppend));
                    });
                    flushTimerRef.current = null;
                  }, 80);
                }
              }
              break;
            }
            case 'complete': {
              setIsLoading(false);
              // 刷新剩余缓冲结果
              if (pendingResultsRef.current.length > 0) {
                setSearchResults((prev) =>
                  prev.concat(pendingResultsRef.current),
                );
                pendingResultsRef.current = [];
              }
              if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
              }
              es.close();
              eventSourceRef.current = null;
              // 添加到搜索历史
              addSearchHistory(trimmed);
              break;
            }
            case 'error':
              setIsLoading(false);
              es.close();
              eventSourceRef.current = null;
              break;
          }
        } catch {
          // 解析错误，忽略
        }
      };

      es.onerror = () => {
        setIsLoading(false);
        es.close();
        eventSourceRef.current = null;
      };
    } else {
      setShowResults(false);
      setShowSuggestions(false);
    }
  }, [searchParams]);

  // 组件卸载时，关闭可能存在的连接
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
        eventSourceRef.current = null;
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingResultsRef.current = [];
    };
  }, []);

  // 输入框内容变化时触发，显示搜索建议
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.trim()) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // 搜索框聚焦时触发，显示搜索建议
  const handleInputFocus = () => {
    if (searchQuery.trim()) {
      setShowSuggestions(true);
    }
  };

  // 网盘搜索函数
  const handleNetDiskSearch = async (query: string) => {
    if (!query.trim()) {
      return;
    }

    setNetdiskLoading(true);
    setNetdiskError(null);
    setNetdiskResults(null);
    setNetdiskTotal(0);

    try {
      const response = await fetch(
        `/api/netdisk/search?q=${encodeURIComponent(query.trim())}`,
      );
      const data = await response.json();

      // 检查响应状态和success字段
      if (response.ok && data.success) {
        setNetdiskResults(data.data.merged_by_type || {});
        setNetdiskTotal(data.data.total || 0);
      } else {
        // 处理错误情况（包括功能关闭、配置错误等）
        setNetdiskError(data.error || '网盘搜索失败');
      }
    } catch {
      setNetdiskError('网盘搜索请求失败，请稍后重试');
    } finally {
      setNetdiskLoading(false);
    }
  };

  // TMDB演员搜索函数
  const handleTmdbActorSearch = async (
    query: string,
    type = tmdbActorType,
    filterState = tmdbFilterState,
  ) => {
    if (!query.trim()) {
      return;
    }

    setTmdbActorLoading(true);
    setTmdbActorError(null);
    setTmdbActorResults(null);

    try {
      // 构建筛选参数
      const params = new URLSearchParams({
        actor: query.trim(),
        type: type,
      });

      // 只有设置了limit且大于0时才添加limit参数
      if (filterState.limit && filterState.limit > 0) {
        params.append('limit', filterState.limit.toString());
      }

      // 添加筛选参数
      if (filterState.startYear) {
        params.append('startYear', filterState.startYear.toString());
      }
      if (filterState.endYear) {
        params.append('endYear', filterState.endYear.toString());
      }
      if (filterState.minRating) {
        params.append('minRating', filterState.minRating.toString());
      }
      if (filterState.maxRating) {
        params.append('maxRating', filterState.maxRating.toString());
      }
      if (filterState.minPopularity) {
        params.append('minPopularity', filterState.minPopularity.toString());
      }
      if (filterState.maxPopularity) {
        params.append('maxPopularity', filterState.maxPopularity.toString());
      }
      if (filterState.minVoteCount) {
        params.append('minVoteCount', filterState.minVoteCount.toString());
      }
      if (filterState.minEpisodeCount) {
        params.append(
          'minEpisodeCount',
          filterState.minEpisodeCount.toString(),
        );
      }
      if (filterState.genreIds && filterState.genreIds.length > 0) {
        params.append('genreIds', filterState.genreIds.join(','));
      }
      if (filterState.languages && filterState.languages.length > 0) {
        params.append('languages', filterState.languages.join(','));
      }
      if (filterState.onlyRated) {
        params.append('onlyRated', 'true');
      }
      if (filterState.sortBy) {
        params.append('sortBy', filterState.sortBy);
      }
      if (filterState.sortOrder) {
        params.append('sortOrder', filterState.sortOrder);
      }

      // 调用TMDB API端点
      const response = await fetch(`/api/tmdb/actor?${params.toString()}`);
      const data = await response.json();

      if (response.ok && data.code === 200) {
        setTmdbActorResults(data.list || []);
      } else {
        setTmdbActorError(data.error || data.message || '搜索演员失败');
      }
    } catch {
      setTmdbActorError('搜索演员失败，请稍后重试');
    } finally {
      setTmdbActorLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim().replace(/\s+/g, ' ');

    if (!trimmed) {
      return;
    }

    // 回显搜索框
    setSearchQuery(trimmed);
    setShowSuggestions(false);
    setShowResults(true);

    if (searchType === 'netdisk') {
      // 网盘搜索 - 也更新URL保持一致性
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      if (netdiskResourceType === 'netdisk') {
        handleNetDiskSearch(trimmed);
      } else {
        setAcgTriggerSearch((prev) => !prev);
      }
    } else if (searchType === 'tmdb-actor') {
      // TMDB演员搜索
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      // 使用空的筛选状态进行初始搜索，避免用户未应用的筛选条件影响结果
      const emptyFilterState: TMDBFilterState = {
        startYear: undefined,
        endYear: undefined,
        minRating: undefined,
        maxRating: undefined,
        minPopularity: undefined,
        maxPopularity: undefined,
        minVoteCount: undefined,
        minEpisodeCount: undefined,
        genreIds: [],
        languages: [],
        onlyRated: false,
        sortBy: 'popularity',
        sortOrder: 'desc',
        limit: undefined,
      };
      handleTmdbActorSearch(trimmed, tmdbActorType, emptyFilterState);
    } else {
      // 影视搜索逻辑
      setIsLoading(true);
      setShowResults(true);
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);

      // 直接执行搜索，不依赖 useEffect
      currentQueryRef.current = trimmed;

      // 关闭旧连接并清空结果
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
        eventSourceRef.current = null;
      }
      setSearchResults([]);
      setTotalSources(0);
      setCompletedSources(0);
      // 清理缓冲
      pendingResultsRef.current = [];
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      // 每次搜索时重新读取设置，确保使用最新的配置
      let currentFluidSearch = useFluidSearch;
      if (typeof window !== 'undefined') {
        const savedFluidSearch = localStorage.getItem('fluidSearch');
        if (savedFluidSearch !== null) {
          currentFluidSearch = JSON.parse(savedFluidSearch);
        } else {
          const defaultFluidSearch =
            (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;
          currentFluidSearch = defaultFluidSearch;
        }
      }

      // 如果读取的配置与当前状态不同，更新状态
      if (currentFluidSearch !== useFluidSearch) {
        setUseFluidSearch(currentFluidSearch);
      }

      if (currentFluidSearch) {
        // 流式搜索：打开新的流式连接
        const es = new EventSource(
          `/api/search/ws?q=${encodeURIComponent(trimmed)}`,
        );
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          if (!event.data) {
            return;
          }
          try {
            const payload = JSON.parse(event.data);
            if (currentQueryRef.current !== trimmed) {
              return;
            }
            switch (payload.type) {
              case 'start':
                setTotalSources(payload.totalSources || 0);
                setCompletedSources(0);
                break;
              case 'source_result': {
                setCompletedSources((prev) => prev + 1);
                if (
                  Array.isArray(payload.results) &&
                  payload.results.length > 0
                ) {
                  // 缓冲新增结果，节流刷入，避免频繁重渲染导致闪烁
                  const activeYearOrder =
                    viewMode === 'agg'
                      ? filterAgg.yearOrder
                      : filterAll.yearOrder;
                  const incoming: SearchResult[] =
                    activeYearOrder === 'none'
                      ? sortBatchForNoOrder(payload.results as SearchResult[])
                      : (payload.results as SearchResult[]);
                  pendingResultsRef.current.push(...incoming);
                  if (!flushTimerRef.current) {
                    flushTimerRef.current = window.setTimeout(() => {
                      const toAppend = pendingResultsRef.current;
                      pendingResultsRef.current = [];
                      startTransition(() => {
                        setSearchResults((prev) => prev.concat(toAppend));
                      });
                      flushTimerRef.current = null;
                    }, 80);
                  }
                }
                break;
              }
              case 'source_error':
                setCompletedSources((prev) => prev + 1);
                break;
              case 'complete':
                setCompletedSources(payload.completedSources || totalSources);
                // 完成前确保将缓冲写入
                if (pendingResultsRef.current.length > 0) {
                  const toAppend = pendingResultsRef.current;
                  pendingResultsRef.current = [];
                  if (flushTimerRef.current) {
                    clearTimeout(flushTimerRef.current);
                    flushTimerRef.current = null;
                  }
                  startTransition(() => {
                    setSearchResults((prev) => prev.concat(toAppend));
                  });
                }
                setIsLoading(false);
                try {
                  es.close();
                } catch {}
                if (eventSourceRef.current === es) {
                  eventSourceRef.current = null;
                }
                break;
            }
          } catch {}
        };

        es.onerror = () => {
          setIsLoading(false);
          // 错误时也清空缓冲
          if (pendingResultsRef.current.length > 0) {
            const toAppend = pendingResultsRef.current;
            pendingResultsRef.current = [];
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            startTransition(() => {
              setSearchResults((prev) => prev.concat(toAppend));
            });
          }
          try {
            es.close();
          } catch {}
          if (eventSourceRef.current === es) {
            eventSourceRef.current = null;
          }
        };
      } else {
        // 传统搜索：使用普通接口

        fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
          .then((response) => response.json())
          .then((data) => {
            if (currentQueryRef.current !== trimmed) {
              return;
            }

            if (data.results && Array.isArray(data.results)) {
              const activeYearOrder =
                viewMode === 'agg' ? filterAgg.yearOrder : filterAll.yearOrder;
              const results: SearchResult[] =
                activeYearOrder === 'none'
                  ? sortBatchForNoOrder(data.results as SearchResult[])
                  : (data.results as SearchResult[]);

              setSearchResults(results);
              setTotalSources(1);
              setCompletedSources(1);
            }
            setIsLoading(false);
          })
          .catch(() => {
            setIsLoading(false);
          });
      }

      // 保存到搜索历史 (事件监听会自动更新界面)
      addSearchHistory(trimmed);
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    // 不自动执行搜索，让用户自己点击搜索按钮
  };

  // 计算实际显示的搜索图标数量
  const visibleSearchIconsCount =
    1 +
    (isNetDiskEnabled && hasPermission('netdisk-search') ? 1 : 0) +
    (isTMDBActorSearchEnabled && hasPermission('tmdb-actor-search') ? 1 : 0);

  return (
    <PageLayout activePath='/search'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible mb-10'>
        {/* 搜索框 */}
        <div className='mb-8'>
          <form
            onSubmit={handleSearch}
            className={`max-w-2xl mx-auto flex ${
              visibleSearchIconsCount > 1
                ? 'flex-col sm:flex-row gap-3 sm:gap-2'
                : 'flex-row'
            } items-center gap-2`}
          >
            {/* 搜索类型选择器 */}
            <div className='flex items-center gap-2 order-1 sm:order-1'>
              <button
                type='button'
                onClick={() => {
                  setSearchType('video');
                  // 切换到影视搜索时，清除网盘和TMDB演员搜索状态
                  setNetdiskResults(null);
                  setNetdiskError(null);
                  setNetdiskTotal(0);
                  setAcgError(null);
                  setTmdbActorResults(null);
                  setTmdbActorError(null);
                }}
                className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${
                  searchType === 'video'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30 scale-105'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/50'
                }`}
                title='影视搜索'
              >
                <svg
                  className='w-5 h-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z'
                  />
                </svg>
              </button>

              {/* 网盘资源按钮 - 只在启用时显示 */}
              {isNetDiskEnabled && hasPermission('netdisk-search') && (
                <button
                  type='button'
                  onClick={() => {
                    setSearchType('netdisk');
                    // 清除之前的网盘搜索状态
                    setNetdiskError(null);
                    setNetdiskResults(null);
                    setAcgError(null);
                    setTmdbActorResults(null);
                    setTmdbActorError(null);
                  }}
                  className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${
                    searchType === 'netdisk'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30 scale-105'
                      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-800/50'
                  }`}
                  title='网盘搜索'
                >
                  <svg
                    className='w-5 h-5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z'
                    />
                  </svg>
                </button>
              )}

              {/* TMDB演员按钮 - 只在启用时显示 */}
              {isTMDBActorSearchEnabled &&
                hasPermission('tmdb-actor-search') && (
                  <button
                    type='button'
                    onClick={() => {
                      setSearchType('tmdb-actor');
                      // 清除之前的搜索状态
                      setTmdbActorError(null);
                      setTmdbActorResults(null);
                      setNetdiskResults(null);
                      setNetdiskError(null);
                      setNetdiskTotal(0);
                    }}
                    className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${
                      searchType === 'tmdb-actor'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30 scale-105'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/50'
                    }`}
                    title='演员搜索'
                  >
                    <svg
                      className='w-5 h-5'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                      />
                    </svg>
                  </button>
                )}
            </div>

            {/* 搜索输入框 */}
            <div className='relative flex-1 w-full order-2 sm:order-2 group'>
              <Search className='absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 transition-colors' />
              <input
                id='searchInput'
                type='text'
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                placeholder={
                  searchType === 'video'
                    ? '搜索电影、电视剧...'
                    : searchType === 'netdisk'
                      ? '搜索网盘资源...'
                      : '搜索演员姓名...'
                }
                autoComplete='off'
                className='w-full h-14 rounded-2xl bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-slate-800 dark:to-slate-900 py-3 pl-12 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:bg-white dark:text-gray-300 dark:placeholder-gray-500 dark:focus:bg-slate-700 border-2 border-transparent dark:border-slate-700 transition-all shadow-lg'
              />

              {/* 清除按钮 */}
              {searchQuery && (
                <button
                  type='button'
                  onClick={() => {
                    setSearchQuery('');
                    setShowSuggestions(false);
                    document.getElementById('searchInput')?.focus();
                  }}
                  className='absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300'
                  aria-label='清除搜索内容'
                >
                  <X className='h-5 w-5' />
                </button>
              )}

              {/* 搜索建议 */}
              <SearchSuggestions
                query={searchQuery}
                isVisible={showSuggestions}
                onSelect={handleSuggestionSelect}
                onClose={() => setShowSuggestions(false)}
                onEnterKey={() => {
                  // 当用户按回车键时，使用搜索框的实际内容进行搜索
                  const trimmed = searchQuery.trim().replace(/\s+/g, ' ');

                  if (!trimmed) {
                    return;
                  }

                  // 回显搜索框
                  setSearchQuery(trimmed);
                  setShowResults(true);
                  setShowSuggestions(false);

                  if (searchType === 'netdisk') {
                    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
                    if (netdiskResourceType === 'netdisk') {
                      handleNetDiskSearch(trimmed);
                    } else {
                      setAcgTriggerSearch((prev) => !prev);
                    }
                  } else if (searchType === 'tmdb-actor') {
                    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
                    // 使用空的筛选状态进行初始搜索
                    const emptyFilterState: TMDBFilterState = {
                      startYear: undefined,
                      endYear: undefined,
                      minRating: undefined,
                      maxRating: undefined,
                      minPopularity: undefined,
                      maxPopularity: undefined,
                      minVoteCount: undefined,
                      minEpisodeCount: undefined,
                      genreIds: [],
                      languages: [],
                      onlyRated: false,
                      sortBy: 'popularity',
                      sortOrder: 'desc',
                      limit: undefined,
                    };
                    handleTmdbActorSearch(
                      trimmed,
                      tmdbActorType,
                      emptyFilterState,
                    );
                  } else {
                    // 影视搜索 - 直接调用handleSearch
                    handleSearch(new Event('submit') as any);
                  }
                }}
              />
            </div>
          </form>
        </div>

        {/* 搜索结果或搜索历史 */}
        <div className='max-w-[95%] mx-auto mt-12 overflow-visible'>
          {showResults ? (
            <section className='mb-12'>
              {searchType === 'netdisk' ? (
                /* 网盘搜索结果 */
                <>
                  <div className='mb-4'>
                    {/* 资源类型切换按钮 */}
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() => {
                          setNetdiskResourceType('netdisk');
                          setAcgError(null);
                          const currentQuery =
                            searchQuery.trim() || searchParams?.get('q');
                          if (currentQuery) {
                            handleNetDiskSearch(currentQuery);
                          }
                        }}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all ${
                          netdiskResourceType === 'netdisk'
                            ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                        }`}
                      >
                        💾 网盘资源
                        {netdiskLoading &&
                          netdiskResourceType === 'netdisk' && (
                            <span className='ml-2 inline-block align-middle'>
                              <span className='inline-block h-3 w-3 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin'></span>
                            </span>
                          )}
                      </button>
                      <button
                        onClick={() => {
                          setNetdiskResourceType('acg');
                          setNetdiskResults(null);
                          setNetdiskError(null);
                          const currentQuery =
                            searchQuery.trim() || searchParams?.get('q');
                          if (currentQuery) {
                            setAcgTriggerSearch((prev) => !prev);
                          }
                        }}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all ${
                          netdiskResourceType === 'acg'
                            ? 'bg-purple-500 text-white border-purple-500 shadow-md'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                        }`}
                      >
                        🎌 动漫磁力
                      </button>
                    </div>
                  </div>
                  {/* 根据资源类型显示不同的搜索结果 */}
                  {netdiskResourceType === 'netdisk' ? (
                    <NetDiskSearchResults
                      results={netdiskResults}
                      loading={netdiskLoading}
                      error={netdiskError}
                      total={netdiskTotal}
                    />
                  ) : (
                    <AcgSearch
                      keyword={
                        searchQuery.trim() || searchParams?.get('q') || ''
                      }
                      triggerSearch={acgTriggerSearch}
                      onError={(error) => setAcgError(error)}
                    />
                  )}
                </>
              ) : searchType === 'tmdb-actor' ? (
                /* TMDB演员搜索结果 */
                <>
                  <div className='mb-4'>
                    <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                      TMDB演员搜索结果
                      {tmdbActorLoading && (
                        <span className='ml-2 inline-block align-middle'>
                          <span className='inline-block h-3 w-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin'></span>
                        </span>
                      )}
                    </h2>

                    {/* 电影/电视剧类型选择器 */}
                    <div className='mt-3 flex items-center gap-2'>
                      <span className='text-sm text-gray-600 dark:text-gray-400'>
                        类型：
                      </span>
                      <div className='flex gap-2'>
                        {[
                          { key: 'movie', label: '电影' },
                          { key: 'tv', label: '电视剧' },
                        ].map((type) => (
                          <button
                            key={type.key}
                            onClick={() => {
                              setTmdbActorType(type.key as 'movie' | 'tv');
                              const currentQuery =
                                searchQuery.trim() || searchParams?.get('q');
                              if (currentQuery) {
                                handleTmdbActorSearch(
                                  currentQuery,
                                  type.key as 'movie' | 'tv',
                                  tmdbFilterState,
                                );
                              }
                            }}
                            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                              tmdbActorType === type.key
                                ? 'bg-blue-500 text-white border-blue-500'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                            }`}
                            disabled={tmdbActorLoading}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* TMDB筛选面板 */}
                    <div className='mt-4'>
                      <TMDBFilterPanel
                        contentType={tmdbActorType}
                        filters={tmdbFilterState}
                        onFiltersChange={(newFilterState) => {
                          startTransition(() => {
                            setTmdbFilterState(newFilterState);
                            const currentQuery =
                              searchQuery.trim() || searchParams?.get('q');
                            if (currentQuery) {
                              handleTmdbActorSearch(
                                currentQuery,
                                tmdbActorType,
                                newFilterState,
                              );
                            }
                          });
                        }}
                        isVisible={tmdbFilterVisible}
                        onToggleVisible={() => {
                          startTransition(() => {
                            setTmdbFilterVisible(!tmdbFilterVisible);
                          });
                        }}
                        resultCount={tmdbActorResults?.length || 0}
                      />
                    </div>
                  </div>

                  {tmdbActorError ? (
                    <div className='text-center py-8'>
                      <div className='text-red-500 mb-2'>{tmdbActorError}</div>
                      <button
                        onClick={() => {
                          const currentQuery =
                            searchQuery.trim() || searchParams?.get('q');
                          if (currentQuery) {
                            handleTmdbActorSearch(
                              currentQuery,
                              tmdbActorType,
                              tmdbFilterState,
                            );
                          }
                        }}
                        className='px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors'
                      >
                        重试
                      </button>
                    </div>
                  ) : tmdbActorResults && tmdbActorResults.length > 0 ? (
                    <div className='grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8 will-change-scroll'>
                      {tmdbActorResults.map((item, index) => (
                        <div
                          key={item.id || index}
                          className='w-full content-visibility-auto contain-intrinsic-size-[11rem_252px] sm:contain-intrinsic-size-[160px_350px]'
                        >
                          <VideoCard
                            id={item.id}
                            title={item.title}
                            poster={item.poster}
                            year={item.year}
                            rate={item.rate}
                            from='douban'
                            type={tmdbActorType}
                          />
                        </div>
                      ))}
                    </div>
                  ) : !tmdbActorLoading ? (
                    <div className='text-center text-gray-500 py-8 dark:text-gray-400'>
                      未找到相关演员作品
                    </div>
                  ) : null}
                </>
              ) : (
                /* 原有的影视搜索结果 */
                <>
                  {/* 标题 */}
                  <div className='mb-4'>
                    <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                      搜索结果
                      {totalSources > 0 && useFluidSearch && (
                        <span className='ml-2 text-sm font-normal text-gray-500 dark:text-gray-400'>
                          {completedSources}/{totalSources}
                        </span>
                      )}
                      {isLoading && useFluidSearch && (
                        <span className='ml-2 inline-block align-middle'>
                          <span className='inline-block h-3 w-3 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin'></span>
                        </span>
                      )}
                    </h2>
                  </div>
                  {/* 筛选器 + 开关控件 */}
                  <div className='mb-8 space-y-4'>
                    {/* 第一排：类型筛选器 */}
                    <div className='flex flex-wrap items-center gap-2 sm:gap-4'>
                      <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                        类型：
                      </span>
                      <div className='flex flex-wrap gap-1 sm:gap-2'>
                        {filterOptions.categoriesAll[0].options.map(
                          (option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                const currentFilter =
                                  viewMode === 'agg' ? filterAgg : filterAll;
                                const newFilter = {
                                  ...currentFilter,
                                  type: option.value,
                                };
                                startTransition(() => {
                                  if (viewMode === 'agg') {
                                    setFilterAgg(newFilter as any);
                                  } else {
                                    setFilterAll(newFilter as any);
                                  }
                                });
                              }}
                              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-all duration-200 ${
                                (viewMode === 'agg'
                                  ? filterAgg.type
                                  : filterAll.type) === option.value
                                  ? 'bg-blue-500 text-white shadow-md'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                              }`}
                            >
                              {option.label}
                            </button>
                          ),
                        )}
                      </div>
                    </div>

                    {/* 第二排：其他筛选器 */}
                    <div className='flex-1 min-w-0'>
                      {viewMode === 'agg' ? (
                        <SearchResultFilter
                          categories={filterOptions.secondaryFilterOptionsAgg}
                          values={filterAgg}
                          onChange={(v) => {
                            startTransition(() => {
                              setFilterAgg(v as any);
                            });
                          }}
                        />
                      ) : (
                        <SearchResultFilter
                          categories={filterOptions.secondaryFilterOptionsAll}
                          values={filterAll}
                          onChange={(v) => {
                            startTransition(() => {
                              setFilterAll(v as any);
                            });
                          }}
                        />
                      )}
                    </div>

                    {/* 开关控件行 */}
                    <div className='flex items-center justify-end gap-6'></div>
                  </div>
                  {/* 传统网格渲染 */}
                  {searchResults.length === 0 ? (
                    isLoading ? (
                      <div className='flex justify-center items-center h-40'>
                        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
                      </div>
                    ) : (
                      <div className='text-center text-gray-500 py-8 dark:text-gray-400'>
                        未找到相关结果
                      </div>
                    )
                  ) : (
                    <div
                      key={`search-results-${viewMode}`}
                      className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8 will-change-scroll'
                    >
                      {viewMode === 'agg'
                        ? filteredAggResults.map(([mapKey, group]) => {
                            const title = group[0]?.title || '';
                            const poster = group[0]?.poster || '';
                            const year = group[0]?.year || 'unknown';
                            const { episodes, source_names, douban_id } =
                              computeGroupStats(group);
                            const type = group[0]?.type;

                            // 如果该聚合第一次出现，写入初始统计
                            if (!groupStatsRef.current.has(mapKey)) {
                              groupStatsRef.current.set(mapKey, {
                                episodes,
                                source_names,
                                douban_id,
                              });
                            }

                            return (
                              <div
                                key={`agg-${mapKey}`}
                                className='w-full content-visibility-auto contain-intrinsic-size-[11rem_252px] sm:contain-intrinsic-size-[160px_350px]'
                              >
                                <VideoCard
                                  ref={getGroupRef(mapKey)}
                                  from='search'
                                  isAggregate={true}
                                  title={title}
                                  poster={poster}
                                  year={year}
                                  episodes={episodes}
                                  source_names={source_names}
                                  douban_id={douban_id}
                                  // 使用第一个来源作为默认值，用于收藏
                                  source={group[0]?.source || ''}
                                  id={group[0]?.id || ''}
                                  query={
                                    searchQuery.trim() !== title
                                      ? searchQuery.trim()
                                      : ''
                                  }
                                  type={type}
                                />
                              </div>
                            );
                          })
                        : filteredAllResults.map((item) => (
                            <div
                              key={`all-${item.source}-${item.id}`}
                              className='w-full content-visibility-auto contain-intrinsic-size-[11rem_252px] sm:contain-intrinsic-size-[160px_350px]'
                            >
                              <VideoCard
                                id={item.id}
                                title={item.title}
                                poster={item.poster}
                                episodes={item.episodes.length}
                                source={item.source}
                                source_name={item.source_name}
                                douban_id={item.douban_id}
                                query={
                                  searchQuery.trim() !== item.title
                                    ? searchQuery.trim()
                                    : ''
                                }
                                year={item.year}
                                from='search'
                              />
                            </div>
                          ))}
                    </div>
                  )}
                </>
              )}
            </section>
          ) : (
            /* 搜索历史或无搜索状态 */
            <>
              {/* 搜索历史 - 优先显示 */}
              {searchHistory.length > 0 && (
                <section className='mb-12'>
                  <h2 className='mb-4 text-xl font-bold text-gray-800 text-left dark:text-gray-200'>
                    搜索历史
                    {searchHistory.length > 0 && (
                      <button
                        onClick={() => {
                          clearSearchHistory(); // 事件监听会自动更新界面
                        }}
                        className='ml-3 text-sm text-gray-500 hover:text-red-500 transition-colors dark:text-gray-400 dark:hover:text-red-500'
                      >
                        清空
                      </button>
                    )}
                  </h2>
                  <div className='flex flex-wrap gap-2'>
                    {searchHistory.map((item) => (
                      <div key={item} className='relative group'>
                        <button
                          onClick={() => {
                            setSearchQuery(item);
                            router.push(
                              `/search?q=${encodeURIComponent(item.trim())}`,
                            );
                          }}
                          className='px-4 py-2 bg-gray-500/10 hover:bg-gray-300 rounded-full text-sm text-gray-700 transition-colors duration-200 dark:bg-gray-700/50 dark:hover:bg-gray-600 dark:text-gray-300'
                        >
                          {item}
                        </button>
                        {/* 删除按钮 */}
                        <button
                          aria-label='删除搜索历史'
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            deleteSearchHistory(item); // 事件监听会自动更新界面
                          }}
                          className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
                        >
                          <X className='w-3 h-3' />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {/* 浮动工具组 */}
      <FloatingTools
        showAI={false}
        showBackToTop={true}
        showAggregate={true} // 搜索页面显示聚合搜索
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    </PageLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageClient />
    </Suspense>
  );
}
