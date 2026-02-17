'use client';

import { useEffect } from 'react';

// Type definitions
type EventListenerOrEventListenerObject = EventListener | EventListenerObject;

interface EventListenerObject {
  handleEvent(event: Event): void;
}

interface AddEventListenerOptions {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
  signal?: AbortSignal;
}

interface EventListenerOptions {
  capture?: boolean;
  passive?: boolean;
  once?: boolean;
  signal?: AbortSignal;
}

// Type declarations for DOM APIs
declare global {
  interface HTMLLinkElement {
    rel: string;
    as: string;
    href: string;
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ): void;
  }
}

// 全局计数器，限制403错误日志输出数量
let doubanErrorCount = 0;
const MAX_DOUBAN_ERROR_LOGS = 3; // 最多显示3个豆瓣403错误日志

/**
 * Hook to preload images for better UX
 * Adds <link rel="preload"> tags for images that are about to enter the viewport
 */

export function useImagePreload(imageUrls: string[], enabled = true) {
  useEffect(() => {
    if (!enabled || !imageUrls.length) {
      return;
    }

    const preloadLinks: HTMLLinkElement[] = [];

    // 减少预加载数量到 5 张，避免过度预加载
    const urlsToPreload = imageUrls.slice(0, Math.min(5, imageUrls.length));

    // 延迟预加载，避免阻塞页面加载
    const timeoutId = setTimeout(() => {
      urlsToPreload.forEach((url) => {
        if (!url) return;

        // Clean and validate URL
        const cleanUrl = url.trim().replace(/["'>]/g, '');
        if (!cleanUrl) return;

        // 检查是否已经预加载
        const existing = document.querySelector(
          `link[rel="preload"][href="${cleanUrl}"]`,
        );
        if (existing) return;

        const link = document.createElement('link') as HTMLLinkElement;
        link.rel = 'preload';
        link.as = 'image';
        link.href = cleanUrl;
        // Set fetch priority to low (not blocking visible content)
        const linkEl = link as unknown as { fetchPriority?: string };
        linkEl.fetchPriority = 'low';

        // 添加错误处理，限制豆瓣403错误日志输出
        link.addEventListener('error', () => {
          // 只处理豆瓣图片的403错误
          if (cleanUrl.includes('doubanio.com')) {
            doubanErrorCount++;

            // 只在前几个错误时输出日志
            if (doubanErrorCount <= MAX_DOUBAN_ERROR_LOGS) {
              // 静默处理错误，不输出到控制台
            }

            // 静默移除失败的preload标签
            if (link.parentNode) {
              link.parentNode.removeChild(link);
            }
          }
        });

        document.head.appendChild(link);
        preloadLinks.push(link);
      });
    }, 500); // 延迟 500ms 预加载

    // Cleanup: remove preload links when component unmounts
    return () => {
      clearTimeout(timeoutId);
      preloadLinks.forEach((link) => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, [imageUrls, enabled]);
}

/**
 * 重置错误计数器（用于测试或切换页面）
 */
export function resetDoubanErrorCount() {
  doubanErrorCount = 0;
}
