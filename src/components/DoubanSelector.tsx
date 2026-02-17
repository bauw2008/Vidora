'use client';

import React from 'react';

import { CapsuleSelector } from './CapsuleSelector';
import MultiLevelSelector from './MultiLevelSelector';
import WeekdaySelector from './WeekdaySelector';

interface SelectorOption {
  label: string;
  value: string;
}

interface DoubanSelectorProps {
  type: 'movie' | 'tv' | 'show' | 'anime';
  primarySelection?: string;
  secondarySelection?: string;
  onPrimaryChange: (value: string | number) => void;
  onSecondaryChange: (value: string | number) => void;
  onMultiLevelChange?: (values: Record<string, string>) => void;
  onWeekdayChange: (weekday: string) => void;
}

const DoubanSelector: React.FC<DoubanSelectorProps> = ({
  type,
  primarySelection,
  secondarySelection,
  onPrimaryChange,
  onSecondaryChange,
  onMultiLevelChange,
  onWeekdayChange,
}) => {
  // 电影的一级选择器选项
  const moviePrimaryOptions: SelectorOption[] = [
    { label: '全部', value: '全部' },
    { label: '热门电影', value: '热门' },
    { label: '最新电影', value: '最新' },
    { label: '豆瓣高分', value: '豆瓣高分' },
    { label: '冷门佳片', value: '冷门佳片' },
  ];

  // 电影的二级选择器选项
  const movieSecondaryOptions: SelectorOption[] = [
    { label: '全部', value: '全部' },
    { label: '华语', value: '华语' },
    { label: '欧美', value: '欧美' },
    { label: '韩国', value: '韩国' },
    { label: '日本', value: '日本' },
  ];

  // 电视剧一级选择器选项
  const tvPrimaryOptions: SelectorOption[] = [
    { label: '全部', value: '全部' },
    { label: '最近热门', value: '最近热门' },
  ];

  // 电视剧二级选择器选项
  const tvSecondaryOptions: SelectorOption[] = [
    { label: '全部', value: 'tv' },
    { label: '国产', value: 'tv_domestic' },
    { label: '欧美', value: 'tv_american' },
    { label: '日本', value: 'tv_japanese' },
    { label: '韩国', value: 'tv_korean' },
    { label: '动漫', value: 'tv_animation' },
    //{ label: '纪录片', value: 'tv_documentary' },
  ];

  // 综艺一级选择器选项
  const showPrimaryOptions: SelectorOption[] = [
    { label: '全部', value: '全部' },
    { label: '最近热门', value: '最近热门' },
  ];

  // 综艺二级选择器选项
  const showSecondaryOptions: SelectorOption[] = [
    { label: '全部', value: 'show' },
    { label: '国内', value: 'show_domestic' },
    { label: '国外', value: 'show_foreign' },
  ];

  // 动漫一级选择器选项
  const animePrimaryOptions: SelectorOption[] = [
    { label: '每日放送', value: '每日放送' },
    { label: '番剧', value: '番剧' },
    { label: '剧场版', value: '剧场版' },
  ];

  // 处理多级选择器变化
  const handleMultiLevelChange = (values: Record<string, string>) => {
    onMultiLevelChange?.(values);
  };

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* 电影类型 - 显示两级选择器 */}
      {type === 'movie' && (
        <div className='space-y-3 sm:space-y-4'>
          {/* 一级选择器 */}
          <CapsuleSelector
            label='分类'
            options={moviePrimaryOptions}
            value={primarySelection || moviePrimaryOptions[0].value}
            onChange={onPrimaryChange}
            enableVirtualScroll={true}
          />

          {/* 二级选择器 - 只在非"全部"时显示 */}
          {primarySelection !== '全部' ? (
            <CapsuleSelector
              label='地区'
              options={movieSecondaryOptions}
              value={secondarySelection || movieSecondaryOptions[0].value}
              onChange={onSecondaryChange}
              enableVirtualScroll={true}
            />
          ) : (
            /* 多级选择器 - 只在选中"全部"时显示 */
            <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
              <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
                筛选
              </span>
              <div className='overflow-x-auto'>
                <MultiLevelSelector
                  key={`${type}-${primarySelection}`}
                  onChange={handleMultiLevelChange}
                  contentType={type}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 电视剧类型 - 显示两级选择器 */}
      {type === 'tv' && (
        <div className='space-y-3 sm:space-y-4'>
          {/* 一级选择器 */}
          <CapsuleSelector
            label='分类'
            options={tvPrimaryOptions}
            value={primarySelection || tvPrimaryOptions[1].value}
            onChange={onPrimaryChange}
            enableVirtualScroll={true}
          />

          {/* 二级选择器 - 只在选中"最近热门"时显示，选中"全部"时显示多级选择器 */}
          {(primarySelection || tvPrimaryOptions[1].value) === '最近热门' ? (
            <CapsuleSelector
              label='类型'
              options={tvSecondaryOptions}
              value={secondarySelection || tvSecondaryOptions[0].value}
              onChange={onSecondaryChange}
              enableVirtualScroll={true}
            />
          ) : (primarySelection || tvPrimaryOptions[1].value) === '全部' ? (
            /* 多级选择器 - 只在选中"全部"时显示 */
            <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
              <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
                筛选
              </span>
              <div className='overflow-x-auto'>
                <MultiLevelSelector
                  key={`${type}-${primarySelection}`}
                  onChange={handleMultiLevelChange}
                  contentType={type}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* 动漫类型 - 显示一级选择器和多级选择器 */}
      {type === 'anime' && (
        <div className='space-y-3 sm:space-y-4'>
          <CapsuleSelector
            label='分类'
            options={animePrimaryOptions}
            value={primarySelection || animePrimaryOptions[0].value}
            onChange={onPrimaryChange}
            enableVirtualScroll={true}
          />

          {/* 筛选部分 - 根据一级选择器显示不同内容 */}
          {(primarySelection || animePrimaryOptions[0].value) === '每日放送' ? (
            // 每日放送分类下显示星期选择器
            <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
              <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
                星期
              </span>
              <div className='overflow-x-auto'>
                <WeekdaySelector onWeekdayChange={onWeekdayChange} />
              </div>
            </div>
          ) : (
            // 其他分类下显示原有的筛选功能
            <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
              <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
                筛选
              </span>
              <div className='overflow-x-auto'>
                {(primarySelection || animePrimaryOptions[0].value) ===
                '番剧' ? (
                  <MultiLevelSelector
                    key={`anime-tv-${primarySelection}`}
                    onChange={handleMultiLevelChange}
                    contentType='anime-tv'
                  />
                ) : (
                  <MultiLevelSelector
                    key={`anime-movie-${primarySelection}`}
                    onChange={handleMultiLevelChange}
                    contentType='anime-movie'
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 综艺类型 - 显示两级选择器 */}
      {type === 'show' && (
        <div className='space-y-3 sm:space-y-4'>
          {/* 一级选择器 */}
          <CapsuleSelector
            label='分类'
            options={showPrimaryOptions}
            value={primarySelection || showPrimaryOptions[1].value}
            onChange={onPrimaryChange}
            enableVirtualScroll={true}
          />

          {/* 二级选择器 - 只在选中"最近热门"时显示，选中"全部"时显示多级选择器 */}
          {(primarySelection || showPrimaryOptions[1].value) === '最近热门' ? (
            <CapsuleSelector
              label='类型'
              options={showSecondaryOptions}
              value={secondarySelection || showSecondaryOptions[0].value}
              onChange={onSecondaryChange}
              enableVirtualScroll={true}
            />
          ) : (primarySelection || showPrimaryOptions[1].value) === '全部' ? (
            /* 多级选择器 - 只在选中"全部"时显示 */
            <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
              <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
                筛选
              </span>
              <div className='overflow-x-auto'>
                <MultiLevelSelector
                  key={`${type}-${primarySelection}`}
                  onChange={handleMultiLevelChange}
                  contentType={type}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default DoubanSelector;
