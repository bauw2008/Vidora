import { use } from 'react';

import { getConfig } from './config';
import type { AdminConfig } from './types';

/**
 * React 19 use() API 示例
 * 在 Server Components 中使用 use() 读取 Promise
 *
 * 注意：use() 只能在 Server Components 或在 use() 调用期间渲染的组件中使用
 */

/**
 * 获取配置的 Promise
 * 这个函数返回一个 Promise，可以在 Server Component 中使用 use() 读取
 */
export function getConfigPromise() {
  return getConfig();
}

/**
 * 在 Server Component 中使用 use() 读取配置
 * 示例用法：
 *
 * ```tsx
 * import { use } from 'react';
 * import { getConfigPromise } from '@/lib/use-config';
 *
 * export default function MyServerComponent() {
 *   const config = use(getConfigPromise());
 *   return <div>{config.SiteConfig.SiteName}</div>;
 * }
 * ```
 */
export function useConfig() {
  return use(getConfigPromise());
}

// 创建一个可缓存的配置 Promise
// React 19 的 use() 会自动处理 Promise 的缓存和去重
let configPromise: Promise<AdminConfig> | null = null;

export function getCachedConfigPromise() {
  if (!configPromise) {
    configPromise = getConfig();
  }
  return configPromise;
}

/**
 * 使用缓存的配置 Promise
 * 多次调用 use(useCachedConfig()) 只会执行一次 getConfig()
 */
export function useCachedConfig() {
  return use(getCachedConfigPromise());
}
