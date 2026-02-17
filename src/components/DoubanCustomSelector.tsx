'use client';

import React from 'react';

import { CapsuleSelector } from './CapsuleSelector';

interface CustomCategory {
  name: string;
  type: 'movie' | 'tv';
  query: string;
}

interface DoubanCustomSelectorProps {
  customCategories: CustomCategory[];
  primarySelection?: string;
  secondarySelection?: string;
  onPrimaryChange: (value: string | number) => void;
  onSecondaryChange: (value: string | number) => void;
}

const DoubanCustomSelector: React.FC<DoubanCustomSelectorProps> = ({
  customCategories,
  primarySelection,
  secondarySelection,
  onPrimaryChange,
  onSecondaryChange,
}) => {
  // 根据 customCategories 生成一级选择器选项（按 type 分组，电影优先）
  const primaryOptions = React.useMemo(() => {
    const types = Array.from(new Set(customCategories.map((cat) => cat.type)));
    // 确保电影类型排在前面
    const sortedTypes = types.sort((a, b) => {
      if (a === 'movie' && b !== 'movie') return -1;
      if (a !== 'movie' && b === 'movie') return 1;
      return 0;
    });
    return sortedTypes.map((type) => ({
      label: type === 'movie' ? '电影' : '剧集',
      value: type,
    }));
  }, [customCategories]);

  // 根据选中的一级选项生成二级选择器选项
  const secondaryOptions = React.useMemo(() => {
    if (!primarySelection) return [];
    return customCategories
      .filter((cat) => cat.type === primarySelection)
      .map((cat) => ({
        label: cat.name || cat.query,
        value: cat.query,
      }));
  }, [customCategories, primarySelection]);

  // 如果没有自定义分类，则不渲染任何内容
  if (!customCategories || customCategories.length === 0) {
    return null;
  }

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* 两级选择器包装 */}
      <div className='space-y-3 sm:space-y-4'>
        {/* 一级选择器 */}
        <CapsuleSelector
          label='类型'
          options={primaryOptions}
          value={primarySelection || primaryOptions[0]?.value}
          onChange={onPrimaryChange}
          enableVirtualScroll={true}
        />

        {/* 二级选择器 */}
        {secondaryOptions.length > 0 && (
          <CapsuleSelector
            label='片单'
            options={secondaryOptions}
            value={secondarySelection || secondaryOptions[0]?.value}
            onChange={onSecondaryChange}
            enableVirtualScroll={true}
          />
        )}
      </div>
    </div>
  );
};

export default DoubanCustomSelector;
