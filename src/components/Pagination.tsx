'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  /** 当前页码 */
  currentPage: number;
  /** 总页数 */
  totalPages: number;
  /** 页码变化时的回调 */
  onPageChange: (page: number) => void;
  /** 自定义类名 */
  className?: string;
  /** 是否显示页码文本 */
  showPageText?: boolean;
  /** 页码文本格式 */
  pageTextFormat?: string;
  /** 是否有下一页（可选，用于兼容旧逻辑） */
  hasNextPage?: boolean;
  /** 是否有上一页（可选，用于兼容旧逻辑） */
  hasPrevPage?: boolean;
  /** 是否强制显示（即使只有一页也显示） */
  forceShow?: boolean;
}

/**
 * 通用分页组件
 * 支持上一页、下一页、页码显示
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  showPageText = true,
  pageTextFormat = '第 {current} 页 / 共 {total} 页',
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const pageText = pageTextFormat
    .replace('{current}', currentPage.toString())
    .replace('{total}', totalPages.toString());

  return (
    <div
      className={`flex justify-center items-center space-x-2 mt-8 ${className}`}
    >
      <button
        onClick={handlePrevPage}
        disabled={currentPage === 1}
        className='p-2 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-300 dark:border-gray-600'
        aria-label='上一页'
      >
        <ChevronLeft size={20} />
      </button>

      {showPageText && (
        <span className='text-sm text-gray-600 dark:text-gray-400'>
          {pageText}
        </span>
      )}

      <button
        onClick={handleNextPage}
        disabled={currentPage === totalPages}
        className='p-2 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-300 dark:border-gray-600'
        aria-label='下一页'
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
