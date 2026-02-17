'use client';

import type { LucideIcon } from 'lucide-react';
import { Globe, TrendingUp, Tv } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { ClientCache } from '@/lib/client-cache';
import { logger } from '@/lib/logger';

import ScrollableRow from '@/components/ScrollableRow';
import SectionTitle from '@/components/SectionTitle';
import VideoCard from '@/components/VideoCard';

interface WeeklyHotItem {
  id: string;
  title: string;
  rating: {
    value: number;
  };
  cover_url?: string;
  cover?: {
    url: string;
  };
  year?: string;
}

export interface WeeklyHotSectionProps {
  /** 周榜类型: movie | tv | tv-global */
  type: 'movie' | 'tv' | 'tv-global';
  /** 显示数量 */
  limit?: number;
}

// 周榜配置
const WEEKLY_CONFIG: Record<
  string,
  { title: string; icon: LucideIcon; iconColor: string; cacheKey: string }
> = {
  movie: {
    title: '电影周榜',
    icon: TrendingUp,
    iconColor: 'text-orange-500',
    cacheKey: 'douban-weekly-movie',
  },
  tv: {
    title: '华语周榜',
    icon: Tv,
    iconColor: 'text-blue-500',
    cacheKey: 'douban-weekly-tv',
  },
  'tv-global': {
    title: '剧集周榜',
    icon: Globe,
    iconColor: 'text-purple-500',
    cacheKey: 'douban-weekly-tv-global',
  },
};

const CACHE_EXPIRE = 7200; // 2小时

export default function WeeklyHotSection({
  type,
  limit = 10,
}: WeeklyHotSectionProps) {
  const [weeklyHot, setWeeklyHot] = useState<WeeklyHotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  const config = WEEKLY_CONFIG[type];
  const Icon = config.icon;

  useEffect(() => {
    const loadWeeklyHot = async () => {
      try {
        setLoading(true);

        // 先尝试从缓存获取
        const cached = await ClientCache.get<WeeklyHotItem[]>(config.cacheKey);
        if (cached && cached.length > 0) {
          startTransition(() => {
            setWeeklyHot(cached.slice(0, limit));
          });
          setLoading(false);
          return;
        }

        // 缓存未命中，从API获取
        const response = await fetch(
          `/api/douban/weekly-hot?type=${type}&limit=${limit}`,
        );

        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data?.subject_collection_items) {
          const items = result.data.subject_collection_items;
          startTransition(() => {
            setWeeklyHot(items);
          });
          // 保存到缓存
          await ClientCache.set(config.cacheKey, items, CACHE_EXPIRE);
        } else {
          throw new Error(result.error || '获取数据失败');
        }
      } catch (error) {
        logger.error(`加载${config.title}失败:`, error);
        startTransition(() => {
          setWeeklyHot([]);
        });
      } finally {
        setLoading(false);
      }
    };

    loadWeeklyHot();
  }, [type, limit, config]);

  // 如果没有数据且不加载中，不显示
  if (!loading && weeklyHot.length === 0) {
    return null;
  }

  return (
    <section className='mb-8'>
      <div className='mb-4'>
        <SectionTitle
          title={config.title}
          icon={Icon}
          iconColor={config.iconColor}
        />
      </div>

      <ScrollableRow>
        {loading
          ? // 加载骨架
            Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44 content-visibility-auto contain-intrinsic-size-[96px_144px] sm:contain-intrinsic-size-[180px_270px]'
              >
                <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800'>
                  <div className='absolute inset-0 bg-gray-300 dark:bg-gray-700'></div>
                </div>
                <div className='mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
              </div>
            ))
          : // 显示真实数据
            weeklyHot.map((item, index) => (
              <div
                key={item.id}
                className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44 content-visibility-auto contain-intrinsic-size-[96px_144px] sm:contain-intrinsic-size-[180px_270px]'
              >
                <VideoCard
                  id={item.id}
                  title={item.title}
                  poster={item.cover_url || item.cover?.url || ''}
                  year={item.year}
                  rate={item.rating?.value?.toFixed(1)}
                  from='douban'
                  type={type === 'movie' ? 'movie' : 'tv'}
                  priority={index < 4}
                  rank={index + 1}
                />
              </div>
            ))}
      </ScrollableRow>
    </section>
  );
}
