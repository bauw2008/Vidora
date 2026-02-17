'use client';

import React, { useEffect, useMemo, useRef } from 'react';

import { CapsuleSelector } from './CapsuleSelector';

interface SelectorOption {
  label: string;
  value: string | number;
  key?: string;
}

interface ShortDramaSelectorProps {
  primarySelection?: number;
  secondarySelection?: string;
  onPrimaryChange: (value: string | number) => void;
  onSecondaryChange: (value: string | number) => void;
  categoriesData?: Array<{
    id: number;
    name: string;
    sub_categories?: Array<{ id: number; name: string }>;
  }>;
}

const ShortDramaSelector: React.FC<ShortDramaSelectorProps> = ({
  primarySelection,
  secondarySelection,
  onPrimaryChange,
  onSecondaryChange,
  categoriesData = [],
}) => {
  // 记录上一次的一级分类，用于检测变化
  const lastPrimaryCategoryRef = useRef<number | null>(null);

  // 根据一级分类值获取对应的二级分类
  const subCategoriesForPrimary = useMemo(() => {
    if (!primarySelection) {
      return [];
    }

    const categoryId =
      typeof primarySelection === 'string'
        ? parseInt(primarySelection)
        : primarySelection;

    if (isNaN(categoryId)) {
      return [];
    }

    const selectedCategory = categoriesData.find(
      (cat) => cat.id === categoryId,
    );
    if (!selectedCategory?.sub_categories) {
      return [];
    }

    return selectedCategory.sub_categories.map(
      (sub: { id: number; name: string }) => ({
        label: sub.name,
        value: sub.name, // 使用名称而不是 ID
        key: `subcategory-${sub.id}`,
      }),
    );
  }, [primarySelection, categoriesData]);

  // 当一级分类改变时，自动选择第一个二级分类
  useEffect(() => {
    const currentPrimary =
      typeof primarySelection === 'string'
        ? parseInt(primarySelection)
        : primarySelection;

    // 检测一级分类是否发生变化
    if (
      lastPrimaryCategoryRef.current !== null &&
      lastPrimaryCategoryRef.current !== currentPrimary
    ) {
      // 一级分类改变了，选择第一个二级分类
      if (subCategoriesForPrimary.length > 0) {
        onSecondaryChange(subCategoriesForPrimary[0].value);
      }
    }

    // 更新记录的值
    lastPrimaryCategoryRef.current = currentPrimary;
  }, [primarySelection, subCategoriesForPrimary, onSecondaryChange]);

  // 初始化时选择第一个分类和第一个类型
  useEffect(() => {
    if (categoriesData.length > 0 && primarySelection === undefined) {
      const firstCategory = categoriesData[0];
      onPrimaryChange(firstCategory.id);

      if (
        firstCategory.sub_categories &&
        firstCategory.sub_categories.length > 0
      ) {
        onSecondaryChange(firstCategory.sub_categories[0].name); // 使用名称而不是 ID
      }
    }
  }, [categoriesData, primarySelection, onPrimaryChange, onSecondaryChange]);

  // 一级选择器选项
  const primaryOptions: SelectorOption[] = useMemo(() => {
    return categoriesData.map((cat) => ({
      label: cat.name,
      value: cat.id,
      key: `category-${cat.id}`,
    }));
  }, [categoriesData]);

  // 二级选择器选项
  const secondaryOptions: SelectorOption[] = useMemo(() => {
    return subCategoriesForPrimary;
  }, [subCategoriesForPrimary]);

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* 一级选择器（分类） */}
      {primaryOptions.length > 0 && (
        <CapsuleSelector
          label='分类'
          options={primaryOptions}
          value={
            primarySelection !== undefined
              ? primarySelection
              : primaryOptions[0]?.value
          }
          onChange={onPrimaryChange}
          enableVirtualScroll={true}
        />
      )}

      {/* 二级选择器（类型） */}
      {primarySelection && secondaryOptions.length > 0 && (
        <CapsuleSelector
          label='类型'
          options={secondaryOptions}
          value={
            secondarySelection !== undefined && secondarySelection !== ''
              ? secondarySelection
              : secondaryOptions[0]?.value
          }
          onChange={onSecondaryChange}
          enableVirtualScroll={true}
        />
      )}
    </div>
  );
};

export default ShortDramaSelector;
