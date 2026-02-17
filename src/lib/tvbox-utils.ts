/**
 * 计算分页信息
 */
export function calculatePagination(
  totalItems: number,
  currentPage: number,
  pageSize = 24,
): { totalPages: number; start: number; end: number } {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  return {
    totalPages,
    start,
    end,
  };
}

/**
 * 检查缓存是否过期
 */
export function isCacheExpired(timestamp: number, expireTime: number): boolean {
  const now = Date.now();
  const cacheTime = timestamp || 0;
  return now - cacheTime > expireTime * 1000;
}
