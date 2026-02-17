import React, { useEffect, useState } from 'react';

import { logger } from '@/lib/logger';

export default function BackToTopButton() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop =
        document.body.scrollTop || document.documentElement.scrollTop;
      setShowBackToTop(scrollTop > 300);
    };

    document.body.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      document.body.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    try {
      document.body.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch (error) {
      logger.error('平滑滚动失败:', error);
      document.body.scrollTop = 0;
    }
  };

  // 统一样式 - 用于所有页面
  return (
    <button
      onClick={scrollToTop}
      className={`relative group/top bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-xl w-7 h-7 text-gray-600 dark:text-gray-300 transition-all duration-300 shadow-md hover:shadow-lg hover:from-gradient-to-br hover:from-blue-500 hover:to-purple-600 hover:text-white flex items-center justify-center ${
        showBackToTop
          ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
          : 'opacity-0 translate-y-3 pointer-events-none scale-95'
      }`}
      aria-label='返回顶部'
    >
      <svg
        className='w-4 h-4 transition-transform duration-300 group-hover/top:-translate-y-0.5'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M5 15l7-7 7 7'
        />
      </svg>
      {/* 提示 */}
      <div className='absolute bottom-full right-0 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover/top:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap shadow-lg'>
        <span className='font-medium'>返回顶部</span>
        <div className='absolute top-full right-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900/90 dark:border-t-gray-700/90'></div>
      </div>
    </button>
  );
}
