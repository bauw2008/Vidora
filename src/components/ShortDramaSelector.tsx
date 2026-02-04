'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { logger } from '@/lib/logger';
import { getShortDramaCategories } from '@/lib/shortdrama.client';

import { CapsuleSelector } from './CapsuleSelector';

interface SelectorOption {
  label: string;
  value: string | number;
  key?: string;
}

interface ShortDramaSelectorProps {
  primarySelection?: string;
  secondarySelection?: string;
  onPrimaryChange: (value: string | number) => void;
  onSecondaryChange: (value: string | number) => void;
}

const ShortDramaSelector: React.FC<ShortDramaSelectorProps> = ({
  primarySelection,
  secondarySelection,
  onPrimaryChange,
  onSecondaryChange,
}) => {
  // 短剧一级分类数据
  const [categories, setCategories] = useState<SelectorOption[]>([]);
  // 短剧二级分类数据
  const [subCategories, setSubCategories] = useState<SelectorOption[]>([]);

  // 加载一级分类
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getShortDramaCategories();
        logger.log('获取到的短剧分类数据:', data);

        const options = data.map((cat, idx: number) => ({
          label: cat.type_name || cat.name,
          value: cat.type_id ?? cat.id ?? idx,
          key: `category-${cat.type_id ?? cat.id ?? idx}`,
        }));

        logger.log('转换后的分类选项:', options);
        setCategories(options);
      } catch (error) {
        logger.error('加载短剧分类失败:', error);
      }
    };

    loadCategories();
  }, []);

  // 根据一级分类值计算二级分类
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

    return subCategories;
  }, [primarySelection, subCategories]);

  // 当一级分类改变时，加载对应的二级分类
  useEffect(() => {
    if (!primarySelection) {
      return;
    }

    const categoryId =
      typeof primarySelection === 'string'
        ? parseInt(primarySelection)
        : primarySelection;

    if (isNaN(categoryId)) {
      return;
    }

    // 调用内部API获取二级分类
    fetch(`/api/shortdrama/sub-categories?categoryId=${categoryId}`)
      .then((response) => response.json())
      .then((data) => {
        // 检查是否是错误响应
        if (data.error) {
          setSubCategories([]);
          return;
        }

        // 处理二级分类数据
        const options = Array.isArray(data)
          ? data.map((cat: { name: string; id: number }, idx: number) => ({
              label: cat.name,
              value: cat.id ?? idx,
              key: `subcategory-${cat.id ?? idx}`,
            }))
          : [];

        setSubCategories(options);

        // 自动选择第一个二级分类（只在首次加载时或值为'all'时）
        if (
          options.length > 0 &&
          (!secondarySelection || secondarySelection === 'all')
        ) {
          onSecondaryChange(options[0].value);
        }
      })
      .catch(() => {
        setSubCategories([]);
      });
  }, [primarySelection, onSecondaryChange, secondarySelection]);

  // 短剧一级选择器选项（分类）- 直接显示所有分类
  const primaryOptions: SelectorOption[] = useMemo(() => {
    const categoryOptions = categories.map((cat) => ({
      label: cat.label,
      value: cat.value,
      key: cat.key,
    }));

    logger.log('一级选择器选项:', categoryOptions);
    return categoryOptions;
  }, [categories]);

  // 短剧二级选择器选项（类型）
  const secondaryOptions: SelectorOption[] = useMemo(() => {
    // 直接返回二级分类
    return subCategoriesForPrimary;
  }, [subCategoriesForPrimary]);

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* 一级选择器（分类） */}
      {primaryOptions.length > 0 && (
        <CapsuleSelector
          label='分类'
          options={primaryOptions}
          value={primarySelection || primaryOptions[0]?.value}
          onChange={onPrimaryChange}
          enableVirtualScroll={true}
        />
      )}

      {/* 二级选择器（类型） */}
      {primarySelection && secondaryOptions.length > 0 && (
        <CapsuleSelector
          label='类型'
          options={secondaryOptions}
          value={secondarySelection || secondaryOptions[0]?.value}
          onChange={onSecondaryChange}
          enableVirtualScroll={true}
        />
      )}
    </div>
  );
};

export default ShortDramaSelector;
