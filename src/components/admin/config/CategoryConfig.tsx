'use client';

import { ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  notifyConfigUpdated,
  updateCustomCategories,
} from '@/lib/global-config';
import { logger } from '@/lib/logger';
import { useAdminLoading } from '@/hooks/admin/useAdminLoading';
import { useToastNotification } from '@/hooks/admin/useToastNotification';

interface CustomCategory {
  name: string;
  type: 'movie' | 'tv';
  query: string;
  disabled: boolean;
  from: string;
}

function CategoryConfigContent() {
  // 使用统一接口
  const { isLoading, withLoading } = useAdminLoading();
  const { showSuccess } = useToastNotification();

  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState<CustomCategory>({
    name: '',
    type: 'movie',
    query: '',
    disabled: false,
    from: 'custom',
  });
  const [autoFilledName, setAutoFilledName] = useState(false);

  // 预设查询关键词
  const presetQueries = {
    movie: [
      '热门',
      '最新',
      '经典',
      '豆瓣高分',
      '冷门佳片',
      '华语',
      '欧美',
      '韩国',
      '日本',
      '动作',
      '喜剧',
      '爱情',
      '科幻',
      '悬疑',
      '恐怖',
      '治愈',
    ],
    tv: [
      '热门',
      '美剧',
      '英剧',
      '韩剧',
      '日剧',
      '国产剧',
      '港剧',
      '日本动画',
      '综艺',
      '纪录片',
    ],
  };

  const loadConfig = async () => {
    try {
      const result = await withLoading('loadCategoryConfig', async () => {
        const response = await fetch('/api/admin/config');
        const data = await response.json();
        const categories = data.Config.CustomCategories || [];
        setCategories(categories);
        return categories;
      });
      return result;
    } catch (error) {
      logger.error('加载分类配置失败:', error);
      return [];
    }
  };

  useEffect(() => {
    const initializeConfig = async () => {
      try {
        const response = await fetch('/api/admin/config');
        const data = await response.json();
        const categories = data.Config.CustomCategories || [];
        setCategories(categories);

        // 初始化时也更新导航配置
        if (categories && categories.length > 0) {
          updateCustomCategories(categories);
        }
      } catch (error) {
        logger.error('加载分类配置失败:', error);
      }
    };
    initializeConfig();
  }, []);

  const handleTypeChange = (type: 'movie' | 'tv') => {
    setNewCategory((prev) => ({
      ...prev,
      type,
      query: '',
    }));
    setAutoFilledName(false);
  };

  const handlePresetQuerySelect = (query: string) => {
    setNewCategory((prev) => ({
      ...prev,
      query,
      name: autoFilledName || prev.name === '' ? query : prev.name,
    }));
    setAutoFilledName(true);
  };

  const handleQueryChange = (query: string) => {
    setNewCategory((prev) => ({
      ...prev,
      query,
      name: autoFilledName ? query : prev.name,
    }));
  };

  const handleNameChange = (name: string) => {
    setNewCategory((prev) => ({ ...prev, name }));
    if (autoFilledName) {
      setAutoFilledName(false);
    }
  };

  const callCategoryApi = async (body: {
    action: string;
    name?: string;
    type?: 'movie' | 'tv';
    query?: string;
  }) => {
    const response = await fetch('/api/admin/category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `操作失败: ${response.status}`);
    }

    // 重新加载配置并获取最新的categories
    const latestCategories = await loadConfig();

    // 更新导航配置，使分类立即在导航栏显示
    updateCustomCategories(latestCategories);

    // 通知其他窗口重新获取配置
    notifyConfigUpdated();

    // 根据操作类型显示不同的提示
    let message = '分类配置已更新';
    const action = body.action;

    if (action === 'add') {
      message = `分类 "${body.name}" 已添加`;
    } else if (action === 'delete') {
      message = `分类已删除`;
    } else if (action === 'enable') {
      message = `分类已启用`;
    } else if (action === 'disable') {
      message = `分类已禁用`;
    }

    // 显示成功提示
    showSuccess(message);
  };

  const handleToggleEnable = (query: string, type: 'movie' | 'tv') => {
    const target = categories.find((c) => c.query === query && c.type === type);
    if (!target) return;

    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleCategory_${query}_${type}`, async () => {
      await callCategoryApi({ action, query, type });
    }).catch(() => {
      logger.error('操作失败', action, query, type);
    });
  };

  const handleDelete = (query: string, type: 'movie' | 'tv') => {
    withLoading(`deleteCategory_${query}_${type}`, () =>
      callCategoryApi({ action: 'delete', query, type }),
    ).catch(() => {
      logger.error('操作失败', 'delete', query, type);
    });
  };

  const handleAddCategory = () => {
    if (!newCategory.query) return;

    withLoading('addCategory', async () => {
      await callCategoryApi({
        action: 'add',
        name: newCategory.name,
        type: newCategory.type,
        query: newCategory.query,
      });
      setNewCategory({
        name: '',
        type: 'movie',
        query: '',
        disabled: false,
        from: 'custom',
      });
      setAutoFilledName(false);
      setShowAddForm(false);
    }).catch(() => {
      logger.error('操作失败', 'add', newCategory);
    });
  };

  const getDisplayName = (category: CustomCategory) => {
    return category.name || category.query;
  };

  return (
    <div className='p-2 sm:p-6'>
      {isLoading('loadCategoryConfig') ? (
        <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
          加载中...
        </div>
      ) : (
        <div className='space-y-6'>
          {/* 添加分类表单 */}
          <div className='flex items-center justify-between'>
            <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              自定义分类列表
            </h4>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                showAddForm
                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {showAddForm ? '取消' : '添加分类'}
            </button>
          </div>

          {showAddForm && (
            <div className='p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-700 space-y-4'>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div className='space-y-1'>
                  <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    分类名称（可选）
                  </label>
                  <input
                    type='text'
                    placeholder='留空将使用搜索关键词作为名称'
                    value={newCategory.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100'
                  />
                  <p className='text-xs text-gray-500 dark:text-gray-400'>
                    {autoFilledName
                      ? '名称已自动填充，可手动修改'
                      : '留空时自动使用搜索关键词作为显示名称'}
                  </p>
                </div>

                <div className='space-y-1'>
                  <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    分类类型
                  </label>
                  <select
                    value={newCategory.type}
                    onChange={(e) =>
                      handleTypeChange(e.target.value as 'movie' | 'tv')
                    }
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100'
                  >
                    <option value='movie'>电影</option>
                    <option value='tv'>电视剧</option>
                  </select>
                </div>

                <div className='sm:col-span-2 space-y-2'>
                  <div className='flex items-center justify-between'>
                    <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                      搜索关键词
                    </label>
                    <span className='text-xs text-gray-500 dark:text-gray-400'>
                      必填
                    </span>
                  </div>

                  <input
                    type='text'
                    placeholder='输入搜索关键词或选择预设'
                    value={newCategory.query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100'
                  />

                  {/* 预设关键词选择 */}
                  <div className='flex flex-wrap gap-2 mt-2'>
                    {presetQueries[newCategory.type].map((query) => (
                      <button
                        key={query}
                        type='button'
                        onClick={() => handlePresetQuerySelect(query)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          newCategory.query === query
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                            : 'bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-700'
                        }`}
                      >
                        {query}
                      </button>
                    ))}
                  </div>

                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-2'>
                    {newCategory.type === 'movie'
                      ? '电影分类预设'
                      : '电视剧分类预设'}
                    。 也可以输入任意关键词，如"哈利波特"
                  </p>
                </div>
              </div>
              <div className='flex justify-end'>
                <button
                  onClick={handleAddCategory}
                  disabled={!newCategory.query || isLoading('addCategory')}
                  className={`w-full sm:w-auto px-4 py-2 ${
                    !newCategory.query || isLoading('addCategory')
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isLoading('addCategory') ? '添加中...' : '添加分类'}
                </button>
              </div>
            </div>
          )}

          {/* 分类列表 */}
          <div className='border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden'>
            <div className='overflow-x-auto'>
              <table className='w-full min-w-full'>
                <thead className='bg-purple-50 dark:bg-purple-800'>
                  <tr>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                      分类名称
                    </th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                      类型
                    </th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                      搜索关键词
                    </th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                      状态
                    </th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className='bg-purple-50/50 dark:bg-purple-900/20 divide-y divide-purple-200 dark:divide-purple-700'>
                  {categories.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className='px-4 py-8 text-center text-gray-500 dark:text-gray-400'
                      >
                        暂无自定义分类，点击"添加分类"创建
                      </td>
                    </tr>
                  ) : (
                    categories.map((category, index) => (
                      <tr key={`${category.query}_${category.type}_${index}`}>
                        <td className='px-4 py-3 text-sm text-gray-900 dark:text-gray-100'>
                          {getDisplayName(category)}
                        </td>
                        <td className='px-4 py-3 text-sm text-gray-900 dark:text-gray-100'>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              category.type === 'movie'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            }`}
                          >
                            {category.type === 'movie' ? '电影' : '电视剧'}
                          </span>
                        </td>
                        <td className='px-4 py-3 text-sm text-gray-900 dark:text-gray-100'>
                          {category.query}
                        </td>
                        <td className='px-4 py-3 text-sm text-gray-900 dark:text-gray-100'>
                          <button
                            onClick={() =>
                              handleToggleEnable(category.query, category.type)
                            }
                            disabled={
                              isLoading(
                                `toggleCategory_${category.query}_${category.type}`,
                              ) || false
                            }
                            className='flex items-center space-x-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50'
                          >
                            {category.disabled ? (
                              <ToggleLeft size={20} />
                            ) : (
                              <ToggleRight size={20} />
                            )}
                            <span
                              className={`text-xs ${category.disabled ? 'text-gray-500' : 'text-green-600'}`}
                            >
                              {category.disabled ? '已禁用' : '已启用'}
                            </span>
                          </button>
                        </td>
                        <td className='px-4 py-3 text-sm'>
                          <button
                            onClick={() =>
                              handleDelete(category.query, category.type)
                            }
                            disabled={
                              isLoading(
                                `deleteCategory_${category.query}_${category.type}`,
                              ) || false
                            }
                            className='text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50'
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 导出组件
function CategoryConfig() {
  return <CategoryConfigContent />;
}

export default CategoryConfig;
