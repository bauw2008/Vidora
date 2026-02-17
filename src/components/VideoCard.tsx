/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  ExternalLink,
  Heart,
  Link,
  PlayCircleIcon,
  Radio,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { memo, useEffect, useImperativeHandle, useState } from 'react';

import {
  deleteFavorite,
  deletePlayRecord,
  generateStorageKey,
  isFavorited,
  saveFavorite,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { logger } from '@/lib/logger';
import { isSeriesCompleted, processImageUrl } from '@/lib/utils';
import { useLongPress } from '@/hooks/useLongPress';

import MobileActionSheet from '@/components/MobileActionSheet';
import { ToastManager } from '@/components/Toast';

export interface VideoCardProps {
  id?: string;
  source?: string;
  title?: string;
  query?: string;
  poster?: string;
  episodes?: number;
  source_name?: string;
  source_names?: string[];
  progress?: number;
  year?: string;
  from:
    | 'playrecord'
    | 'favorite'
    | 'search'
    | 'douban'
    | 'tvbox'
    | 'shortdrama';
  currentEpisode?: number;
  douban_id?: number;
  onDelete?: () => void;
  rate?: string;
  type?: string;
  isBangumi?: boolean;
  isAggregate?: boolean;
  origin?: 'vod' | 'live';
  remarks?: string;
  priority?: boolean;
  rank?: number; // 排行（1-3）
  ref?: React.RefObject<VideoCardHandle>;
}

export type VideoCardHandle = {
  setEpisodes: (episodes?: number) => void;
  setSourceNames: (names?: string[]) => void;
  setDoubanId: (id?: number) => void;
};

function VideoCard({
  id,
  title = '',
  query = '',
  poster = '',
  episodes,
  source,
  source_name,
  source_names,
  progress = 0,
  year,
  from,
  currentEpisode,
  douban_id,
  onDelete,
  rate,
  type = '',
  isBangumi = false,
  isAggregate = false,
  origin = 'vod',
  remarks,
  priority = false,
  rank,
  ref,
}: VideoCardProps) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [searchFavorited, setSearchFavorited] = useState<boolean | null>(null);

  // 可外部修改的可控字段
  const [dynamicEpisodes, setDynamicEpisodes] = useState<number | undefined>(
    episodes,
  );
  const [dynamicSourceNames, setDynamicSourceNames] = useState<
    string[] | undefined
  >(source_names);
  const [dynamicDoubanId, setDynamicDoubanId] = useState<number | undefined>(
    douban_id,
  );

  useEffect(() => {
    setDynamicEpisodes(episodes);
  }, [episodes]);

  useEffect(() => {
    setDynamicSourceNames(source_names);
  }, [source_names]);

  useEffect(() => {
    setDynamicDoubanId(douban_id);
  }, [douban_id]);

  // 使用 ref 暴露方法
  useImperativeHandle(
    ref,
    () => ({
      setEpisodes: (eps?: number) => setDynamicEpisodes(eps),
      setSourceNames: (names?: string[]) => setDynamicSourceNames(names),
      setDoubanId: (id?: number) => setDynamicDoubanId(id),
    }),
    [],
  );

  // 实际使用的值
  const actualTitle = title;
  const actualPoster =
    poster ||
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"%3E%3Crect fill="%23374151" width="200" height="300"/%3E%3Cg fill="%239CA3AF"%3E%3Ccircle cx="100" cy="120" r="30"/%3E%3Cpath d="M60 160 Q60 140 80 140 L120 140 Q140 140 140 160 L140 200 Q140 220 120 220 L80 220 Q60 220 60 200 Z"/%3E%3C/g%3E%3Ctext x="100" y="260" font-family="Arial" font-size="14" fill="%239CA3AF" text-anchor="middle"%3E暂无海报%3C/text%3E%3C/svg%3E';
  const actualSource = source;
  const actualId = id;
  const actualDoubanId = dynamicDoubanId;
  const actualEpisodes = dynamicEpisodes;
  const actualYear = year;
  const actualQuery = query || '';

  // 获取收藏状态
  useEffect(() => {
    if (
      from === 'douban' ||
      from === 'tvbox' ||
      from === 'shortdrama' ||
      !actualSource ||
      !actualId
    ) {
      return;
    }

    const fetchFavoriteStatus = async () => {
      try {
        const fav = await isFavorited(actualSource, actualId);
        setFavorited(fav);
      } catch (err) {
        logger.error('检查收藏状态失败:', err);
        ToastManager.error('检查收藏状态失败');
      }
    };

    fetchFavoriteStatus();

    // 监听收藏状态更新事件
    const storageKey = generateStorageKey(actualSource, actualId);
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, any> | null) => {
        if (!newFavorites) {
          return;
        }
        const isNowFavorited = !!newFavorites[storageKey];
        setFavorited(isNowFavorited);
      },
    );

    return unsubscribe;
  }, [from, actualSource, actualId]);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      from === 'douban' ||
      from === 'tvbox' ||
      from === 'shortdrama' ||
      !actualSource ||
      !actualId
    ) {
      return;
    }

    try {
      const currentFavorited = from === 'search' ? searchFavorited : favorited;

      if (currentFavorited) {
        await deleteFavorite(actualSource, actualId);
        if (from === 'search') {
          setSearchFavorited(false);
        } else {
          setFavorited(false);
        }
      } else {
        await saveFavorite(actualSource, actualId, {
          title: actualTitle,
          source_name: source_name || '',
          year: actualYear || '',
          cover: actualPoster,
          total_episodes: actualEpisodes ?? 1,
          save_time: Date.now(),
          search_title: actualTitle,
          type: type || undefined,
        });
        if (from === 'search') {
          setSearchFavorited(true);
        } else {
          setFavorited(true);
        }
      }
    } catch (err) {
      logger.error('切换收藏状态失败:', err);
      ToastManager.error('切换收藏状态失败');
    }
  };

  const handleDeleteRecord = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    logger.log('删除操作:', { from, actualSource, actualId });
    if (!actualSource || !actualId) {
      logger.log('删除失败: 缺少必要参数');
      return;
    }

    try {
      if (from === 'playrecord') {
        logger.log('删除播放记录:', actualSource, actualId);
        await deletePlayRecord(actualSource, actualId);
      } else if (from === 'favorite') {
        logger.log('删除收藏:', actualSource, actualId);
        await deleteFavorite(actualSource, actualId);
      }
      onDelete?.();
    } catch (err) {
      logger.error('删除记录失败:', err);
      const errorMsg =
        from === 'playrecord' ? '删除播放记录失败' : '删除收藏失败';
      throw new Error(errorMsg);
    }
  };

  const handleClick = () => {
    // 构建豆瓣ID参数
    const doubanIdParam =
      actualDoubanId && actualDoubanId > 0
        ? `&douban_id=${actualDoubanId}`
        : '';

    if (origin === 'live' && actualSource && actualId) {
      // 直播内容跳转到直播页面
      const url = `/live?source=${actualSource.replace(
        'live_',
        '',
      )}&id=${actualId.replace('live_', '')}`;
      router.push(url);
    } else if (from === 'shortdrama' && actualSource && actualId) {
      // 短剧播放：传递完整的源和ID参数，使播放页面能正确调用短剧详情API
      const url = `/play?source=shortdrama&id=${actualId}&title=${encodeURIComponent(actualTitle.trim())}&shortdrama_id=${actualId}`;
      router.push(url);
    } else if (
      from === 'douban' ||
      (isAggregate && !actualSource && !actualId)
    ) {
      const url = `/play?title=${encodeURIComponent(actualTitle.trim())}${
        actualYear ? `&year=${actualYear}` : ''
      }${doubanIdParam}${isAggregate ? '&prefer=true' : ''}${
        actualQuery ? `&stitle=${encodeURIComponent(actualQuery.trim())}` : ''
      }`;
      router.push(url);
    } else if (actualSource && actualId) {
      const url = `/play?source=${actualSource}&id=${actualId}&title=${encodeURIComponent(
        actualTitle,
      )}${actualYear ? `&year=${actualYear}` : ''}${doubanIdParam}${
        isAggregate ? '&prefer=true' : ''
      }${
        actualQuery ? `&stitle=${encodeURIComponent(actualQuery.trim())}` : ''
      }`;
      router.push(url);
    }
  };

  // 新标签页播放处理函数
  const handlePlayInNewTab = async () => {
    // 如果没有豆瓣ID，尝试从详情API获取
    let finalDoubanId = actualDoubanId;
    if ((!actualDoubanId || actualDoubanId === 0) && actualSource && actualId) {
      try {
        const response = await fetch(
          `/api/detail?source=${actualSource}&id=${actualId}`,
        );
        if (response.ok) {
          const detailData = await response.json();
          if (detailData.douban_id && detailData.douban_id !== 0) {
            finalDoubanId = detailData.douban_id;
          }
        }
      } catch (error) {
        logger.warn('获取详情失败:', error);
      }
    }

    // 构建豆瓣ID参数
    const doubanIdParam =
      finalDoubanId && finalDoubanId > 0 ? `&douban_id=${finalDoubanId}` : '';

    if (origin === 'live' && actualSource && actualId) {
      // 直播内容跳转到直播页面
      const url = `/live?source=${actualSource.replace(
        'live_',
        '',
      )}&id=${actualId.replace('live_', '')}`;
      window.open(url, '_blank');
    } else if (from === 'shortdrama' && actualSource && actualId) {
      // 短剧播放：传递完整的源和ID参数
      const url = `/play?source=shortdrama&id=${actualId}&title=${encodeURIComponent(actualTitle.trim())}&shortdrama_id=${actualId}`;
      window.open(url, '_blank');
    } else if (
      from === 'douban' ||
      (isAggregate && !actualSource && !actualId)
    ) {
      const url = `/play?title=${encodeURIComponent(actualTitle.trim())}${
        actualYear ? `&year=${actualYear}` : ''
      }${doubanIdParam}${isAggregate ? '&prefer=true' : ''}${
        actualQuery ? `&stitle=${encodeURIComponent(actualQuery.trim())}` : ''
      }`;
      window.open(url, '_blank');
    } else if (actualSource && actualId) {
      const url = `/play?source=${actualSource}&id=${actualId}&title=${encodeURIComponent(
        actualTitle,
      )}${actualYear ? `&year=${actualYear}` : ''}${doubanIdParam}${
        isAggregate ? '&prefer=true' : ''
      }${
        actualQuery ? `&stitle=${encodeURIComponent(actualQuery.trim())}` : ''
      }`;
      window.open(url, '_blank');
    }
  };

  // 检查搜索结果的收藏状态
  const checkSearchFavoriteStatus = async () => {
    if (
      from === 'search' &&
      !isAggregate &&
      actualSource &&
      actualId &&
      searchFavorited === null
    ) {
      try {
        const fav = await isFavorited(actualSource, actualId);
        setSearchFavorited(fav);
      } catch (err) {
        logger.error('检查收藏状态失败:', err);
        setSearchFavorited(false);
      }
    }
  };

  // 长按操作
  const handleLongPress = () => {
    if (!showMobileActions) {
      // 防止重复触发
      // 立即显示菜单，避免等待数据加载导致动画卡顿
      setShowMobileActions(true);

      // 异步检查收藏状态，不阻塞菜单显示
      if (
        from === 'search' &&
        !isAggregate &&
        actualSource &&
        actualId &&
        searchFavorited === null
      ) {
        checkSearchFavoriteStatus();
      }
    }
  };

  // 长按手势hook
  const longPressProps = useLongPress({
    onLongPress: handleLongPress,
    onClick: handleClick, // 保持点击播放功能
    longPressDelay: 500,
  });

  const config = (() => {
    const configs = {
      playrecord: {
        showSourceName: true,
        showProgress: true,
        showPlayButton: true,
        showHeart: true,
        showCheckCircle: true,
        showDoubanLink: false,
        showRating: false,
        showYear: false,
      },
      favorite: {
        showSourceName: true,
        showProgress: false,
        showPlayButton: true,
        showHeart: false,
        showCheckCircle: true,
        showDoubanLink: false,
        showRating: false,
        showYear: false,
      },
      search: {
        showSourceName: true,
        showProgress: false,
        showPlayButton: true,
        showHeart: true, // 移动端菜单中需要显示收藏选项
        showCheckCircle: false,
        showDoubanLink: true, // 移动端菜单中显示豆瓣链接
        showRating: true,
        showYear: true,
      },
      douban: {
        showSourceName: false,
        showProgress: false,
        showPlayButton: true,
        showHeart: false,
        showCheckCircle: false,
        showDoubanLink: true,
        showRating: !!rate,
        showYear: false,
      },
      tvbox: {
        showSourceName: false,
        showProgress: false,
        showPlayButton: true,
        showHeart: false, // TVBox不显示收藏按钮
        showCheckCircle: false,
        showDoubanLink: false,
        showRating: true,
        showYear: false,
      },
      shortdrama: {
        showSourceName: false,
        showProgress: false,
        showPlayButton: true,
        showHeart: false, // 短剧不显示收藏按钮
        showCheckCircle: false,
        showDoubanLink: false,
        showRating: false,
        showYear: true,
      },
    };
    return configs[from] || configs.search;
  })();

  // 移动端操作菜单配置
  const mobileActions = (() => {
    const actions = [];

    // 播放操作
    if (config.showPlayButton) {
      actions.push({
        id: 'play',
        label: origin === 'live' ? '观看直播' : '播放',
        icon: <PlayCircleIcon size={20} />,
        onClick: handleClick,
        color: 'primary' as const,
      });

      // 新标签页播放
      actions.push({
        id: 'play-new-tab',
        label: origin === 'live' ? '新标签页观看' : '新标签页播放',
        icon: <ExternalLink size={20} />,
        onClick: handlePlayInNewTab,
        color: 'default' as const,
      });
    }

    // 聚合源信息 - 直接在菜单中展示，不需要单独的操作项

    // 收藏/取消收藏操作
    if (
      config.showHeart &&
      from !== 'douban' &&
      from !== 'favorite' &&
      actualSource &&
      actualId
    ) {
      const currentFavorited = from === 'search' ? searchFavorited : favorited;

      if (from === 'search') {
        // 搜索结果：根据加载状态显示不同的选项
        if (searchFavorited !== null) {
          // 已加载完成，显示实际的收藏状态
          actions.push({
            id: 'favorite',
            label: currentFavorited ? '取消收藏' : '添加收藏',
            icon: currentFavorited ? (
              <Heart size={20} className='fill-red-600 stroke-red-600' />
            ) : (
              <Heart size={20} className='fill-transparent stroke-red-500' />
            ),
            onClick: () => {
              const mockEvent = {
                preventDefault: () => {},
                stopPropagation: () => {},
              } as React.MouseEvent;
              handleToggleFavorite(mockEvent);
            },
            color: currentFavorited
              ? ('danger' as const)
              : ('default' as const),
          });
        } else {
          // 正在加载中，显示占位项
          actions.push({
            id: 'favorite-loading',
            label: '收藏加载中...',
            icon: <Heart size={20} />,
            onClick: () => {}, // 加载中时不响应点击
            disabled: true,
          });
        }
      } else {
        // 非搜索结果：直接显示收藏选项
        actions.push({
          id: 'favorite',
          label: currentFavorited ? '取消收藏' : '添加收藏',
          icon: currentFavorited ? (
            <Heart size={20} className='fill-red-600 stroke-red-600' />
          ) : (
            <Heart size={20} className='fill-transparent stroke-red-500' />
          ),
          onClick: () => {
            const mockEvent = {
              preventDefault: () => {},
              stopPropagation: () => {},
            } as React.MouseEvent;
            handleToggleFavorite(mockEvent);
          },
          color: currentFavorited ? ('danger' as const) : ('default' as const),
        });
      }
    }

    // 删除播放记录操作
    if (
      config.showCheckCircle &&
      (from === 'playrecord' || from === 'favorite') &&
      actualSource &&
      actualId
    ) {
      actions.push({
        id: 'delete',
        label: from === 'playrecord' ? '删除记录' : '删除收藏',
        icon: <Trash2 size={20} />,
        onClick: () => {
          const mockEvent = {
            preventDefault: () => {},
            stopPropagation: () => {},
          } as React.MouseEvent;
          handleDeleteRecord(mockEvent);
        },
        color: 'danger' as const,
      });
    }

    // 豆瓣链接操作
    if (config.showDoubanLink && actualDoubanId && actualDoubanId !== 0) {
      actions.push({
        id: 'douban',
        label: isBangumi ? 'Bangumi 详情' : '豆瓣详情',
        icon: <Link size={20} />,
        onClick: () => {
          const url = isBangumi
            ? `https://bgm.tv/subject/${actualDoubanId.toString()}`
            : `https://movie.douban.com/subject/${actualDoubanId.toString()}`;
          window.open(url, '_blank', 'noopener,noreferrer');
        },
        color: 'default' as const,
      });
    }

    return actions;
  })();

  return (
    <>
      <div
        className='group relative w-full rounded-lg bg-transparent cursor-pointer transition-all duration-300 ease-in-out hover:scale-[1.05] hover:z-[500] hover:drop-shadow-2xl'
        onClick={handleClick}
        {...longPressProps}
        style={
          {
            // 禁用所有默认的长按和选择效果
            WebkitUserSelect: 'none',
            userSelect: 'none',
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
            // 禁用右键菜单和长按菜单
            pointerEvents: 'auto',
          } as React.CSSProperties
        }
        onContextMenu={(e: React.MouseEvent) => {
          // 阻止默认右键菜单
          e.preventDefault();
          e.stopPropagation();

          // 右键弹出操作菜单
          setShowMobileActions(true);

          // 异步检查收藏状态，不阻塞菜单显示
          if (
            from === 'search' &&
            !isAggregate &&
            actualSource &&
            actualId &&
            searchFavorited === null
          ) {
            checkSearchFavoriteStatus();
          }

          return false;
        }}
        onDragStart={(e) => {
          // 阻止拖拽
          e.preventDefault();
          return false;
        }}
      >
        {/* 海报容器 */}
        <div
          className={`relative aspect-[2/3] overflow-hidden rounded-lg ${
            origin === 'live'
              ? 'ring-1 ring-gray-300/80 dark:ring-gray-600/80'
              : ''
          }`}
          style={
            {
              WebkitUserSelect: 'none',
              userSelect: 'none',
              WebkitTouchCallout: 'none',
            } as React.CSSProperties
          }
          onContextMenu={(e: React.MouseEvent) => {
            e.preventDefault();
            return false;
          }}
        >
          {/* 渐变光泽动画层 */}
          <div
            className='absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10'
            style={{
              background:
                'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.15) 55%, transparent 70%)',
              backgroundSize: '200% 100%',
              animation: 'card-shimmer 2.5s ease-in-out infinite',
            }}
          />

          {/* 骨架屏 */}
          {!isLoading && (
            <div className='skeleton-shine aspect-[2/3] w-full rounded-lg' />
          )}
          {/* 图片 */}
          <Image
            src={processImageUrl(actualPoster)}
            alt={actualTitle}
            fill
            sizes='(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
            className={`${
              origin === 'live' ? 'object-contain' : 'object-cover'
            } transition-all duration-700 ease-out ${
              imageLoaded
                ? 'opacity-100 blur-0 scale-100'
                : 'opacity-0 blur-md scale-105'
            }`}
            referrerPolicy='no-referrer'
            loading={priority ? undefined : 'lazy'}
            priority={priority}
            quality={75}
            onLoad={() => {
              setIsLoading(true);
              setImageLoaded(true);
            }}
            onError={(e) => {
              // 图片加载失败时的处理
              const img = e.target as HTMLImageElement;
              if (origin === 'live') {
                // 直播频道使用默认图标，不重试避免闪烁
                img.src =
                  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"%3E%3Crect fill="%23374151" width="200" height="300"/%3E%3Cg fill="%239CA3AF"%3E%3Ccircle cx="100" cy="120" r="30"/%3E%3Cpath d="M60 160 Q60 140 80 140 L120 140 Q140 140 140 160 L140 200 Q140 220 120 220 L80 220 Q60 220 60 200 Z"/%3E%3C/g%3E%3Ctext x="100" y="260" font-family="Arial" font-size="14" fill="%239CA3AF" text-anchor="middle"%3E直播频道%3C/text%3E%3C/svg%3E';
                setImageLoaded(true);
              } else if (!img.dataset.retried) {
                // 非直播内容重试一次
                img.dataset.retried = 'true';
                setTimeout(() => {
                  img.src = processImageUrl(actualPoster);
                }, 2000);
              } else {
                // 重试失败，使用通用占位图
                img.src =
                  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"%3E%3Crect fill="%23374151" width="200" height="300"/%3E%3Cg fill="%239CA3AF"%3E%3Ccircle cx="100" cy="120" r="30"/%3E%3Cpath d="M60 160 Q60 140 80 140 L120 140 Q140 140 140 160 L140 200 Q140 220 120 220 L80 220 Q60 220 60 200 Z"/%3E%3C/g%3E%3Ctext x="100" y="260" font-family="Arial" font-size="14" fill="%239CA3AF" text-anchor="middle"%3E暂无海报%3C/text%3E%3C/svg%3E';
                setImageLoaded(true);
              }
            }}
            style={
              {
                // 禁用图片的默认长按效果
                WebkitUserSelect: 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
                pointerEvents: 'none', // 图片不响应任何指针事件
              } as React.CSSProperties
            }
            onContextMenu={(e: React.MouseEvent) => {
              e.preventDefault();
              return false;
            }}
            onDragStart={(e) => {
              e.preventDefault();
              return false;
            }}
          />

          {/* 悬浮遮罩 - 玻璃态效果 */}
          <div
            className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-all duration-300 ease-in-out opacity-0 group-hover:opacity-100 backdrop-blur-[2px]'
            style={
              {
                WebkitUserSelect: 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
              } as React.CSSProperties
            }
            onContextMenu={(e: React.MouseEvent) => {
              e.preventDefault();
              return false;
            }}
          />

          {/* 播放按钮 */}
          {config.showPlayButton && (
            <div
              data-button='true'
              className='absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 ease-in-out delay-75 group-hover:opacity-100 group-hover:scale-100'
              style={
                {
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                } as React.CSSProperties
              }
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                return false;
              }}
            >
              <PlayCircleIcon
                size={50}
                strokeWidth={0.8}
                className='text-white fill-transparent transition-all duration-300 ease-out hover:fill-green-500 hover:scale-[1.1]'
                style={
                  {
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                  } as React.CSSProperties
                }
                onContextMenu={(e: React.MouseEvent) => {
                  e.preventDefault();
                  return false;
                }}
              />
            </div>
          )}

          {/* 操作按钮 */}
          {(config.showHeart || config.showCheckCircle) && (
            <div
              data-button='true'
              className='absolute bottom-3 right-3 flex gap-3 opacity-0 translate-y-2 transition-all duration-300 ease-in-out sm:group-hover:opacity-100 sm:group-hover:translate-y-0'
              style={
                {
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                } as React.CSSProperties
              }
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                return false;
              }}
            >
              {config.showCheckCircle && (
                <div className='glass-button rounded-full p-1.5'>
                  <Trash2
                    onClick={handleDeleteRecord}
                    size={18}
                    className='text-white transition-all duration-300 ease-out hover:stroke-red-400 hover:scale-[1.1]'
                    style={
                      {
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                        WebkitTouchCallout: 'none',
                      } as React.CSSProperties
                    }
                    onContextMenu={(e: React.MouseEvent) => {
                      e.preventDefault();
                      return false;
                    }}
                  />
                </div>
              )}
              {config.showHeart && from !== 'search' && from !== 'favorite' && (
                <div className='glass-button rounded-full p-1.5'>
                  <Heart
                    onClick={handleToggleFavorite}
                    size={18}
                    className={`transition-all duration-300 ease-out ${
                      favorited
                        ? 'fill-red-500 stroke-red-500'
                        : 'fill-transparent stroke-white hover:stroke-red-400'
                    } hover:scale-[1.1]`}
                    style={
                      {
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                        WebkitTouchCallout: 'none',
                      } as React.CSSProperties
                    }
                    onContextMenu={(e: React.MouseEvent) => {
                      e.preventDefault();
                      return false;
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* 年份徽章 */}
          {config.showYear &&
            actualYear &&
            actualYear !== 'unknown' &&
            actualYear.trim() !== '' && (
              <div
                className='absolute top-2 glass dark:glass-dark text-white text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm shadow-sm transition-all duration-300 ease-out group-hover:opacity-90 left-2'
                style={
                  {
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                  } as React.CSSProperties
                }
                onContextMenu={(e: React.MouseEvent) => {
                  e.preventDefault();
                  return false;
                }}
              >
                {actualYear}
              </div>
            )}

          {/* 已完结徽章 */}
          {remarks && isSeriesCompleted(remarks) && (
            <div
              className='absolute bottom-4 left-3 opacity-0 transition-all duration-300 ease-in-out delay-75 group-hover:opacity-100 bg-gradient-to-br from-blue-500/95 via-indigo-500/95 to-purple-600/95 backdrop-blur-md text-white px-2 py-1 rounded text-xs ring-2 ring-white/30'
              style={
                {
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                } as React.CSSProperties
              }
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                return false;
              }}
            >
              完结
            </div>
          )}

          {/* 徽章 */}
          {config.showRating && rate && (
            <div
              className='absolute top-2 right-2 glass dark:glass-dark bg-gradient-to-br from-pink-500/80 to-purple-500/80 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ease-out group-hover:scale-110 glow-purple'
              style={
                {
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                } as React.CSSProperties
              }
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                return false;
              }}
            >
              {rate}
            </div>
          )}

          {actualEpisodes && actualEpisodes > 1 && (
            <div
              className={`absolute ${
                config.showRating && rate ? 'top-10' : 'top-2'
              } right-2 glass dark:glass-dark bg-gradient-to-br from-green-500/80 to-emerald-500/80 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-md transition-all duration-300 ease-out group-hover:scale-110 glow-green`}
              style={
                {
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                } as React.CSSProperties
              }
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                return false;
              }}
            >
              {currentEpisode
                ? `${currentEpisode}/${actualEpisodes}`
                : actualEpisodes}
            </div>
          )}

          {/* 排行徽章（1-3名） */}
          {rank && rank >= 1 && rank <= 3 && (
            <div
              className='absolute top-2 left-2 text-2xl z-10'
              style={
                {
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                } as React.CSSProperties
              }
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                return false;
              }}
            >
              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
            </div>
          )}

          {/* 豆瓣链接 */}
          {config.showDoubanLink && actualDoubanId && actualDoubanId !== 0 && (
            <a
              href={
                isBangumi
                  ? `https://bgm.tv/subject/${actualDoubanId.toString()}`
                  : `https://movie.douban.com/subject/${actualDoubanId.toString()}`
              }
              target='_blank'
              rel='noopener noreferrer'
              onClick={(e) => e.stopPropagation()}
              className='absolute top-2 left-2 opacity-0 -translate-x-2 transition-all duration-300 ease-in-out delay-100 sm:group-hover:opacity-100 sm:group-hover:translate-x-0'
              style={
                {
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                } as React.CSSProperties
              }
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                return false;
              }}
            >
              <div
                className='bg-green-500 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-md hover:bg-green-600 hover:scale-[1.1] transition-all duration-300 ease-out'
                style={
                  {
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                  } as React.CSSProperties
                }
                onContextMenu={(e: React.MouseEvent) => {
                  e.preventDefault();
                  return false;
                }}
              >
                <Link
                  size={16}
                  style={
                    {
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                      WebkitTouchCallout: 'none',
                      pointerEvents: 'none',
                    } as React.CSSProperties
                  }
                />
              </div>
            </a>
          )}

          {/* 聚合播放源指示器 */}
          {isAggregate &&
            dynamicSourceNames &&
            dynamicSourceNames.length > 0 &&
            (() => {
              const uniqueSources = Array.from(new Set(dynamicSourceNames));
              const sourceCount = uniqueSources.length;

              return (
                <div
                  className='absolute bottom-2 right-2 opacity-0 transition-all duration-300 ease-in-out delay-75 sm:group-hover:opacity-100'
                  style={
                    {
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                      WebkitTouchCallout: 'none',
                    } as React.CSSProperties
                  }
                  onContextMenu={(e: React.MouseEvent) => {
                    e.preventDefault();
                    return false;
                  }}
                >
                  <div
                    className='relative group/sources'
                    style={
                      {
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                        WebkitTouchCallout: 'none',
                      } as React.CSSProperties
                    }
                  >
                    <div
                      className='glass dark:glass-dark bg-gradient-to-br from-indigo-500/80 to-purple-500/80 text-white text-xs font-bold w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shadow-md hover:scale-[1.1] transition-all duration-300 ease-out cursor-pointer glow-purple'
                      style={
                        {
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                          WebkitTouchCallout: 'none',
                        } as React.CSSProperties
                      }
                      onContextMenu={(e: React.MouseEvent) => {
                        e.preventDefault();
                        return false;
                      }}
                    >
                      {sourceCount}
                    </div>

                    {/* 播放源详情悬浮框 */}
                    {(() => {
                      // 优先显示的播放源（常见的主流平台）
                      const prioritySources = [
                        '爱奇艺',
                        '腾讯视频',
                        '优酷',
                        '芒果TV',
                        '哔哩哔哩',
                        'Netflix',
                        'Disney+',
                      ];

                      // 按优先级排序播放源
                      const sortedSources = uniqueSources.sort((a, b) => {
                        const aIndex = prioritySources.indexOf(a);
                        const bIndex = prioritySources.indexOf(b);
                        if (aIndex !== -1 && bIndex !== -1) {
                          return aIndex - bIndex;
                        }
                        if (aIndex !== -1) {
                          return -1;
                        }
                        if (bIndex !== -1) {
                          return 1;
                        }
                        return a.localeCompare(b);
                      });

                      const maxDisplayCount = 6; // 最多显示6个
                      const displaySources = sortedSources.slice(
                        0,
                        maxDisplayCount,
                      );
                      const hasMore = sortedSources.length > maxDisplayCount;
                      const remainingCount =
                        sortedSources.length - maxDisplayCount;

                      return (
                        <div
                          className='absolute bottom-full mb-2 opacity-0 invisible group-hover/sources:opacity-100 group-hover/sources:visible transition-all duration-200 ease-out delay-100 pointer-events-none z-50 right-0 sm:right-0 -translate-x-0 sm:translate-x-0'
                          style={
                            {
                              WebkitUserSelect: 'none',
                              userSelect: 'none',
                              WebkitTouchCallout: 'none',
                            } as React.CSSProperties
                          }
                          onContextMenu={(e: React.MouseEvent) => {
                            e.preventDefault();
                            return false;
                          }}
                        >
                          <div
                            className='bg-gray-800/90 backdrop-blur-sm text-white text-xs sm:text-xs rounded-lg shadow-xl border border-white/10 p-1.5 sm:p-2 min-w-[100px] sm:min-w-[120px] max-w-[140px] sm:max-w-[200px] overflow-hidden'
                            style={
                              {
                                WebkitUserSelect: 'none',
                                userSelect: 'none',
                                WebkitTouchCallout: 'none',
                              } as React.CSSProperties
                            }
                            onContextMenu={(e: React.MouseEvent) => {
                              e.preventDefault();
                              return false;
                            }}
                          >
                            {/* 单列布局 */}
                            <div className='space-y-0.5 sm:space-y-1'>
                              {displaySources.map((sourceName, index) => (
                                <div
                                  key={index}
                                  className='flex items-center gap-1 sm:gap-1.5'
                                >
                                  <div className='w-0.5 h-0.5 sm:w-1 sm:h-1 bg-blue-400 rounded-full flex-shrink-0'></div>
                                  <span
                                    className='truncate text-[10px] sm:text-xs leading-tight'
                                    title={sourceName}
                                  >
                                    {sourceName}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* 显示更多提示 */}
                            {hasMore && (
                              <div className='mt-1 sm:mt-2 pt-1 sm:pt-1.5 border-t border-gray-700/50'>
                                <div className='flex items-center justify-center text-gray-400'>
                                  <span className='text-[10px] sm:text-xs font-medium'>
                                    +{remainingCount} 播放源
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* 小箭头 */}
                            <div className='absolute top-full right-2 sm:right-3 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] sm:border-l-[6px] sm:border-r-[6px] sm:border-t-[6px] border-transparent border-t-gray-800/90'></div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}
        </div>

        {/* 进度条 */}
        {config.showProgress && progress !== undefined && (
          <div
            className='mt-1 h-1 w-full bg-gray-200 rounded-full overflow-hidden'
            style={
              {
                WebkitUserSelect: 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
              } as React.CSSProperties
            }
            onContextMenu={(e: React.MouseEvent) => {
              e.preventDefault();
              return false;
            }}
          >
            <div
              className='h-full bg-green-500 transition-all duration-500 ease-out'
              style={
                {
                  width: `${progress}%`,
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                } as React.CSSProperties
              }
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                return false;
              }}
            />
          </div>
        )}

        {/* 标题与来源 */}
        <div
          className='mt-2 text-center'
          style={
            {
              WebkitUserSelect: 'none',
              userSelect: 'none',
              WebkitTouchCallout: 'none',
            } as React.CSSProperties
          }
          onContextMenu={(e: React.MouseEvent) => {
            e.preventDefault();
            return false;
          }}
        >
          <div
            className='relative px-1'
            style={
              {
                WebkitUserSelect: 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
              } as React.CSSProperties
            }
          >
            {/* 背景高亮效果 */}
            <div className='absolute inset-0 bg-gradient-to-r from-transparent via-green-50/0 to-transparent dark:via-green-900/0 group-hover:via-green-50/50 dark:group-hover:via-green-900/30 transition-all duration-300 rounded-md'></div>

            <span
              className='block text-sm font-bold line-clamp-1 sm:line-clamp-2 text-gray-900 dark:text-gray-100 transition-all duration-300 ease-in-out group-hover:scale-[1.02] peer relative z-10 group-hover:bg-gradient-to-r group-hover:from-green-600 group-hover:via-emerald-600 group-hover:to-teal-600 dark:group-hover:from-green-400 dark:group-hover:via-emerald-400 dark:group-hover:to-teal-400 group-hover:bg-clip-text group-hover:text-transparent group-hover:drop-shadow-[0_2px_8px_rgba(16,185,129,0.3)]'
              style={
                {
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: '1.4',
                } as React.CSSProperties
              }
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                return false;
              }}
            >
              {actualTitle}
            </span>
            {/* 自定义 tooltip */}
            <div
              className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gradient-to-br from-gray-800 to-gray-900 text-white text-xs rounded-lg shadow-xl border border-white/10 opacity-0 invisible peer-hover:opacity-100 peer-hover:visible transition-all duration-200 ease-out delay-100 whitespace-nowrap pointer-events-none z-50 backdrop-blur-sm'
              style={
                {
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                  maxWidth: '200px',
                } as React.CSSProperties
              }
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                return false;
              }}
            >
              <span className='font-medium'>{actualTitle}</span>
              <div
                className='absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-gray-800'
                style={
                  {
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                  } as React.CSSProperties
                }
              ></div>
            </div>
          </div>
          {config.showSourceName && source_name && (
            <div
              className='flex items-center justify-center mt-2'
              style={
                {
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                } as React.CSSProperties
              }
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                return false;
              }}
            >
              <span
                className='relative inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border border-gray-300/60 dark:border-gray-600/60 text-gray-600 dark:text-gray-400 transition-all duration-300 ease-out overflow-hidden group-hover:border-green-500/80 group-hover:text-green-600 dark:group-hover:text-green-400 group-hover:shadow-md group-hover:shadow-green-500/20 group-hover:scale-105'
                style={
                  {
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                  } as React.CSSProperties
                }
                onContextMenu={(e: React.MouseEvent) => {
                  e.preventDefault();
                  return false;
                }}
              >
                {/* 背景渐变效果 */}
                <span className='absolute inset-0 bg-gradient-to-r from-transparent via-green-50/0 to-transparent dark:via-green-500/0 group-hover:via-green-50/80 dark:group-hover:via-green-500/20 transition-all duration-300'></span>

                {/* 左侧装饰点 - 移动端隐藏 */}
                <span className='relative w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-green-500 dark:group-hover:bg-green-400 transition-all duration-300 group-hover:shadow-[0_0_8px_rgba(16,185,129,0.6)] hidden sm:block'></span>

                {origin === 'live' && (
                  <Radio
                    size={12}
                    className='relative inline-block transition-all duration-300 group-hover:text-green-500 dark:group-hover:text-green-400'
                  />
                )}

                <span className='relative font-semibold truncate max-w-[120px] sm:max-w-none'>
                  {source_name}
                </span>

                {/* 右侧装饰点 - 移动端隐藏 */}
                <span className='relative w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-green-500 dark:group-hover:bg-green-400 transition-all duration-300 group-hover:shadow-[0_0_8px_rgba(16,185,129,0.6)] hidden sm:block'></span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 操作菜单 - 支持右键和长按触发 */}
      <MobileActionSheet
        isOpen={showMobileActions}
        onClose={() => setShowMobileActions(false)}
        title={actualTitle}
        poster={processImageUrl(actualPoster)}
        actions={mobileActions}
        sources={
          isAggregate && dynamicSourceNames
            ? Array.from(new Set(dynamicSourceNames))
            : undefined
        }
        isAggregate={isAggregate}
        sourceName={source_name}
        currentEpisode={currentEpisode}
        totalEpisodes={actualEpisodes}
        origin={origin}
      />
    </>
  );
}

export default memo(VideoCard);
