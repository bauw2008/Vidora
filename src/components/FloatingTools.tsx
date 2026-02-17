'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';

import AIRecommendModal from './AIRecommendModal';
import BackToTopButton from './BackToTopButton';

interface FloatingToolsProps {
  showAI?: boolean;
  showBackToTop?: boolean;
  showAggregate?: boolean;
  viewMode?: 'agg' | 'all';
  onViewModeChange?: (mode: 'agg' | 'all') => void;
}

export default function FloatingTools({
  showAI = false,
  showBackToTop = true,
  showAggregate = false,
  viewMode = 'all',
  onViewModeChange,
}: FloatingToolsProps) {
  const [showAIModal, setShowAIModal] = useState(false);

  // 如果没有任何功能且不需要返回顶部按钮，则不渲染任何内容
  if (!showAI && !showAggregate && !showBackToTop) {
    return null;
  }

  return (
    <>
      <div className='fixed bottom-16 right-6 z-[500] flex flex-col gap-2'>
        {/* AI推荐按钮 - 始终可见 */}
        {showAI && (
          <button
            onClick={() => setShowAIModal(true)}
            className='relative group/ai bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-xl w-7 h-7 text-gray-600 dark:text-gray-300 transition-all duration-300 shadow-md hover:shadow-lg hover:from-gradient-to-br hover:from-purple-500 hover:to-purple-600 hover:text-white flex items-center justify-center'
            title='AI影视推荐'
          >
            <Sparkles className='w-3.5 h-3.5 transition-transform duration-300 group-hover/ai:rotate-12' />
            {/* 提示 */}
            <div className='absolute bottom-full right-0 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover/ai:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap shadow-lg'>
              <span className='font-medium'>AI影视推荐</span>
              <div className='absolute top-full right-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900/90 dark:border-t-gray-700/90'></div>
            </div>
          </button>
        )}

        {/* 聚合搜索开关 - 始终可见 */}
        {showAggregate && (
          <div className='relative group/agg'>
            <label className='flex items-center justify-center cursor-pointer'>
              <div className='relative'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={viewMode === 'agg'}
                  onChange={() =>
                    onViewModeChange &&
                    onViewModeChange(viewMode === 'agg' ? 'all' : 'agg')
                  }
                />
                <div className='w-7 h-7 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-xl transition-all duration-300 peer-checked:from-green-500 peer-checked:to-emerald-600 peer-checked:text-white shadow-md hover:from-green-500 hover:to-emerald-600 hover:text-white'></div>
                {/* 状态图标 */}
                <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
                  <svg
                    className={`w-4 h-4 transition-all duration-300 ${viewMode === 'agg' ? 'text-white scale-100' : 'text-gray-500 scale-90'}`}
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M4 6h16M4 12h16m-7 6h7'
                    />
                  </svg>
                </div>
              </div>
            </label>
            {/* 提示 */}
            <div className='absolute bottom-full right-0 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover/agg:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap shadow-lg'>
              <span className='font-medium'>聚合搜索</span>
              <div className='absolute top-full right-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900/90 dark:border-t-gray-700/90'></div>
            </div>
          </div>
        )}
      </div>

      {/* 返回顶部按钮 */}
      {showBackToTop && (
        <div className='fixed bottom-6 right-6 z-[500]'>
          <BackToTopButton />
        </div>
      )}

      {/* AI推荐模态框 */}
      <AIRecommendModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
      />
    </>
  );
}
