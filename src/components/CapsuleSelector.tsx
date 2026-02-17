'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface CapsuleOption {
  label: string;
  value: string | number;
  key?: string;
}

export interface CapsuleSelectorProps {
  /** 选项列表 */
  options: CapsuleOption[];
  /** 当前选中的值 */
  value: string | number | null;
  /** 值变化时的回调 */
  onChange: (value: string | number) => void;
  /** 标签文本 */
  label?: string;
  /** 是否启用虚拟滚动（横向滚动） */
  enableVirtualScroll?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 通用胶囊选择器组件
 * 支持动画指示器、虚拟滚动、响应式设计
 */
export function CapsuleSelector({
  options,
  value,
  onChange,
  label,
  enableVirtualScroll = true,
  className = '',
}: CapsuleSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    transform: string;
    width: string;
  }>({ transform: 'translateX(0)', width: '0px' });

  // 更新指示器位置
  const updateIndicatorPosition = (activeIndex: number) => {
    if (
      activeIndex < 0 ||
      !buttonRefs.current[activeIndex] ||
      !containerRef.current
    ) {
      return;
    }

    // 使用 requestAnimationFrame 确保在正确的时机更新
    requestAnimationFrame(() => {
      const button = buttonRefs.current[activeIndex];
      const container = containerRef.current;
      if (!button || !container) return;

      const buttonRect = button.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // 计算相对位置
      const left = buttonRect.left - containerRect.left;
      const width = buttonRect.width;

      // 使用 transform 代替 left，GPU加速
      setIndicatorStyle({
        transform: `translateX(${left}px)`,
        width: `${width}px`,
      });
    });
  };

  // 当选项或选中值变化时，更新指示器位置
  useEffect(() => {
    const activeIndex = options.findIndex((opt) => opt.value === value);
    if (activeIndex >= 0) {
      updateIndicatorPosition(activeIndex);
    }
  }, [options, value]);

  if (!options || options.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-2 ${className}`}
    >
      {label && (
        <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
          {label}
        </span>
      )}
      <div
        ref={containerRef}
        className={`relative inline-flex bg-gray-200/60 rounded-full p-0.5 sm:p-1 dark:bg-gray-700/60 backdrop-blur-sm ${
          enableVirtualScroll ? 'overflow-x-auto' : ''
        }`}
      >
        {/* 背景指示器 - 使用 transform 优化性能 */}
        {indicatorStyle.width !== '0px' && (
          <div
            className='absolute top-1 bottom-1 left-0 bg-white dark:bg-gray-600 rounded-full shadow-sm will-change-transform'
            style={{
              transform: indicatorStyle.transform,
              width: indicatorStyle.width,
              transition: 'transform 300ms ease-out, width 300ms ease-out',
            }}
          />
        )}

        {/* 选项按钮 */}
        {options.map((option, index) => {
          const isActive =
            option.value === value || (value === 0 && option.value === 0);
          return (
            <button
              key={option.key ?? option.value ?? index}
              ref={(el) => {
                buttonRefs.current[index] = el ?? null;
              }}
              onClick={() => onChange(option.value)}
              className={`relative z-10 px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
                isActive
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
