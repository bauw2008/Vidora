/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { AlertCircle, Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';

interface AcgSearchItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  torrentUrl: string;
  description: string;
  images: string[];
}

interface AcgSearchResult {
  keyword: string;
  page: number;
  total: number;
  items: AcgSearchItem[];
}

interface AcgSearchProps {
  keyword: string;
  triggerSearch?: boolean;
  onError?: (error: string) => void;
}

export default function AcgSearch({
  keyword,
  triggerSearch,
  onError,
}: AcgSearchProps) {
  const [loading, setLoading] = useState(false);
  const [allItems, setAllItems] = useState<AcgSearchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);

  // 执行搜索
  const performSearch = useCallback(
    async (page: number, isLoadMore = false) => {
      if (isLoadingMoreRef.current) return;

      isLoadingMoreRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/acg/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            keyword: keyword.trim(),
            page,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '搜索失败');
        }

        const data: AcgSearchResult = await response.json();

        if (isLoadMore) {
          // 追加新数据
          setAllItems((prev) => [...prev, ...data.items]);
          setHasMore(data.items.length > 0);
        } else {
          // 新搜索，重置数据
          setAllItems(data.items);
          setHasMore(data.items.length > 0);
        }

        setCurrentPage(page);
      } catch (err: any) {
        const errorMsg = err.message || '搜索失败，请稍后重试';
        setError(errorMsg);
        onError?.(errorMsg);
      } finally {
        setLoading(false);
        isLoadingMoreRef.current = false;
      }
    },
    [keyword, onError],
  );

  useEffect(() => {
    if (triggerSearch === undefined) {
      return;
    }

    const currentKeyword = keyword.trim();
    if (!currentKeyword) {
      return;
    }

    // 重置状态并开始新搜索
    setAllItems([]);
    setCurrentPage(1);
    setHasMore(true);
    performSearch(1, false);
  }, [triggerSearch, keyword, performSearch]);

  // 加载更多数据
  const loadMore = useCallback(() => {
    if (!loading && hasMore && !isLoadingMoreRef.current) {
      performSearch(currentPage + 1, true);
    }
  }, [loading, hasMore, currentPage, performSearch]);

  // 使用 Intersection Observer 监听滚动到底部
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
      },
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [loadMore]);

  // 复制磁力链接
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      logger.error('复制失败:', err);
    }
  };

  if (loading && allItems.length === 0) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-center'>
          <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 dark:bg-slate-800 mb-4'>
            <Loader2 className='h-8 w-8 animate-spin text-blue-600 dark:text-blue-400' />
          </div>
          <p className='text-sm text-blue-700 dark:text-blue-300 font-medium'>
            正在搜索动漫资源...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-center'>
          <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4'>
            <AlertCircle className='h-8 w-8 text-red-500 dark:text-red-400' />
          </div>
          <p className='text-sm text-red-600 dark:text-red-400 font-medium'>
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-center'>
          <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 dark:bg-slate-800 mb-4'>
            <AlertCircle className='h-8 w-8 text-gray-400 dark:text-gray-600' />
          </div>
          <p className='text-sm text-blue-600 dark:text-blue-400 font-medium'>
            未找到相关资源
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 结果列表 */}
      <div className='space-y-3'>
        {allItems.map((item) => (
          <div
            key={item.guid}
            className='p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900/30 dark:to-cyan-900/20 border-2 border-blue-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-cyan-500 hover:shadow-md transition-all'
          >
            {/* 标题 */}
            <div className='mb-2 font-semibold text-gray-900 dark:text-gray-100'>
              {item.title}
            </div>

            {/* 发布时间 */}
            <div className='mb-2 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1'>
              <svg
                className='w-3 h-3'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
              {new Date(item.pubDate).toLocaleString('zh-CN')}
            </div>

            {/* 图片预览 */}
            {item.images && item.images.length > 0 && (
              <div className='mb-3 flex gap-2 overflow-x-auto'>
                {item.images.slice(0, 3).map((img, imgIndex) => (
                  <Image
                    key={imgIndex}
                    src={img}
                    alt=''
                    width={80}
                    height={80}
                    className='h-20 w-auto rounded-lg object-cover shadow-sm border border-blue-200 dark:border-slate-700'
                    unoptimized
                  />
                ))}
              </div>
            )}

            {/* 磁力链接 */}
            {item.torrentUrl && (
              <div className='mb-3 p-2.5 rounded-lg bg-cyan-50 dark:bg-slate-800 text-xs font-mono break-all text-gray-700 dark:text-gray-300 border border-cyan-200 dark:border-slate-700'>
                {item.torrentUrl}
              </div>
            )}

            {/* 操作按钮 */}
            <div className='flex items-center gap-2'>
              <button
                onClick={() => copyToClipboard(item.torrentUrl, item.guid)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105 ${
                  copiedId === item.guid
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-sm'
                }`}
                title='复制磁力链接'
              >
                {copiedId === item.guid ? (
                  <>
                    <Check className='h-4 w-4' />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className='h-4 w-4' />
                    <span>复制链接</span>
                  </>
                )}
              </button>
              <a
                href={item.link}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-100 text-cyan-700 text-sm font-medium hover:bg-cyan-200 dark:bg-slate-800 dark:text-cyan-300 dark:hover:bg-slate-700 transition-all hover:scale-105 border border-cyan-200 dark:border-slate-700'
                title='查看详情'
              >
                <ExternalLink className='h-4 w-4' />
                <span>详情</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* 加载更多指示器 */}
      {hasMore && (
        <div
          ref={loadMoreRef}
          className='flex items-center justify-center py-8'
        >
          <div className='text-center'>
            <Loader2 className='mx-auto h-6 w-6 animate-spin text-blue-600 dark:text-blue-400' />
            <p className='mt-2 text-sm text-blue-600 dark:text-blue-400'>
              加载更多...
            </p>
          </div>
        </div>
      )}

      {/* 没有更多数据提示 */}
      {!hasMore && allItems.length > 0 && (
        <div className='text-center py-4'>
          <p className='text-sm text-blue-500 dark:text-blue-400'>
            没有更多结果了
          </p>
        </div>
      )}
    </div>
  );
}
