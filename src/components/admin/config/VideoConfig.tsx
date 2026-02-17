'use client';

// Type declarations for DOM APIs
declare global {
  interface HTMLAnchorElement {
    href: string;
    download: string;
    click(): void;
  }
}

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle,
  Download,
  Play,
  Plus,
  Power,
  Search,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { logger } from '@/lib/logger';
import { useAdminLoading } from '@/hooks/admin/useAdminLoading';
import { useToastNotification } from '@/hooks/admin/useToastNotification';

interface DataSource {
  name: string;
  key: string;
  api: string;
  detail?: string;
  disabled?: boolean;
  from?: string;
}

// 视频源项组件
const SourceItem = ({
  source,
  onToggleEnable,
  onDelete,
  selected,
  onSelect,
  validationResult,
}: {
  source: DataSource;
  onToggleEnable: (key: string) => void;
  onDelete: (key: string) => void;
  selected: boolean;
  onSelect: (key: string) => void;
  validationResult?: {
    key: string;
    name: string;
    status: 'validating' | 'valid' | 'no_results' | 'invalid';
    message: string;
    resultCount: number;
  };
}) => {
  return (
    <div
      className={`bg-pink-50 dark:bg-pink-900/30 border rounded-lg p-2 sm:p-3 mb-2 transition-all hover:shadow-sm hover:bg-pink-100 dark:hover:bg-pink-800 ${
        selected
          ? 'ring-2 ring-blue-500 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700'
      } ${source.disabled ? 'opacity-60' : ''}`}
    >
      <div className='flex flex-col gap-2'>
        <div className='flex items-start space-x-2 flex-1 min-w-0'>
          <input
            type='checkbox'
            checked={selected}
            onChange={() => onSelect(source.key)}
            className='w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 flex-shrink-0 mt-0.5'
          />

          <div className='flex-1 min-w-0'>
            <div className='flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1'>
              <h3 className='font-semibold text-gray-900 dark:text-white text-sm truncate'>
                {source.name}
              </h3>
              <span className='text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-medium flex-shrink-0 w-fit'>
                {source.key}
              </span>
            </div>

            <div className='mb-2 sm:mb-1'>
              <code className='text-xs bg-pink-100 dark:bg-pink-800 text-pink-700 dark:text-pink-300 px-2 py-1 rounded border border-pink-200 dark:border-pink-600 font-mono block w-full truncate'>
                {source.api}
              </code>
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              {source.disabled ? (
                <div className='flex items-center space-x-1 text-red-600 dark:text-red-400'>
                  <div className='w-1.5 h-1.5 rounded-full bg-red-500'></div>
                  <span className='text-xs font-medium'>禁用</span>
                </div>
              ) : (
                <div className='flex items-center space-x-1 text-green-600 dark:text-green-400'>
                  <div className='w-1.5 h-1.5 rounded-full bg-green-500'></div>
                  <span className='text-xs font-medium'>启用</span>
                </div>
              )}

              {source.detail && (
                <span
                  className='text-xs text-gray-500 dark:text-gray-400 truncate'
                  title={source.detail}
                >
                  {source.detail}
                </span>
              )}

              {source.from === 'custom' && (
                <span className='text-xs text-gray-400 dark:text-gray-500'>
                  自定义
                </span>
              )}

              {/* 有效性检测结果 */}
              {validationResult && (
                <div
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                    validationResult.status === 'valid'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : validationResult.status === 'no_results'
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        : validationResult.status === 'invalid'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  }`}
                >
                  {validationResult.status === 'validating' && (
                    <>
                      <div className='w-1 h-1 rounded-full bg-yellow-500 animate-spin'></div>
                      <span>检测中</span>
                    </>
                  )}
                  {validationResult.status === 'valid' && (
                    <>
                      <CheckCircle size={10} />
                      <span>有效</span>
                    </>
                  )}
                  {validationResult.status === 'no_results' && (
                    <>
                      <XCircle size={10} />
                      <span>无结果</span>
                    </>
                  )}
                  {validationResult.status === 'invalid' && (
                    <>
                      <XCircle size={10} />
                      <span>无效</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className='flex items-center justify-end space-x-1 ml-auto'>
          <button
            onClick={() => onToggleEnable(source.key)}
            className={`p-1.5 rounded transition-all hover:scale-105 ${
              source.disabled
                ? 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50'
            }`}
            title={source.disabled ? '启用' : '禁用'}
          >
            <Power size={14} />
          </button>

          <button
            onClick={() => onDelete(source.key)}
            className='p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-all hover:scale-105 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
            title='删除'
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

function VideoConfigContent() {
  // 使用统一接口
  const { isLoading, withLoading } = useAdminLoading();
  const { showError, showSuccess } = useToastNotification();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(),
  );
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<
    {
      key: string;
      name: string;
      status: 'validating' | 'valid' | 'no_results' | 'invalid';
      message: string;
      resultCount: number;
    }[]
  >([]);

  const [newSource, setNewSource] = useState<DataSource>({
    name: '',
    key: '',
    api: '',
    detail: '',
    disabled: false,
    from: 'custom',
  });

  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/config');
      if (!response.ok) {
        throw new Error('获取配置失败');
      }
      const data = await response.json();
      if (data.Config?.SourceConfig) {
        setSources(data.Config.SourceConfig);
        setSelectedSources(new Set());
      }
    } catch (error) {
      logger.error('加载视频配置失败:', error);
      showError('加载配置失败');
    }
  }, [showError]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const callSourceApi = async (body: {
    action: string;
    key?: string;
    name?: string;
    api?: string;
    detail?: string;
  }) => {
    try {
      const resp = await fetch('/api/admin/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }

      // 成功后刷新配置
      await loadConfig();
      showSuccess('操作成功');
    } catch (err) {
      logger.error('API调用失败:', err);
      showError(err instanceof Error ? err.message : '操作失败');
      throw err;
    }
  };

  const handleToggleEnable = (key: string) => {
    const target = sources.find((s) => s.key === key);
    if (!target) return;

    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleSource_${key}`, () =>
      callSourceApi({ action, key }),
    ).catch(() => {
      logger.error('操作失败', action, key);
    });
  };

  const handleDelete = (key: string) => {
    withLoading(`deleteSource_${key}`, () =>
      callSourceApi({ action: 'delete', key }),
    ).catch((error) => {
      logger.error('操作失败', 'delete', key, error);
      showError(error?.message || '删除失败');
    });
  };

  const handleAddSource = () => {
    if (!newSource.name || !newSource.key || !newSource.api) {
      showError('请填写完整信息');
      return;
    }

    withLoading('addSource', async () => {
      await callSourceApi({
        action: 'add',
        key: newSource.key,
        name: newSource.name,
        api: newSource.api,
        detail: newSource.detail,
      });
      setNewSource({
        name: '',
        key: '',
        api: '',
        detail: '',
        disabled: false,
        from: 'custom',
      });
      setShowAddForm(false);
    }).catch(() => {
      logger.error('操作失败', 'add', newSource);
    });
  };

  // 有效性检测处理
  const handleValidateSources = async () => {
    if (!searchKeyword.trim()) {
      showError('请输入搜索关键词');
      return;
    }

    await withLoading('validateSources', async () => {
      setIsValidating(true);
      setValidationResults([]); // 清空之前的结果

      // 初始化所有视频源为检测中状态
      const initialResults = sources.map((source) => ({
        key: source.key,
        name: source.name,
        status: 'validating' as const,
        message: '检测中...',
        resultCount: 0,
      }));
      setValidationResults(initialResults);

      try {
        // 使用EventSource接收流式数据
        const eventSource = new EventSource(
          `/api/admin/source/validate?q=${encodeURIComponent(searchKeyword.trim())}`,
        );

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case 'start':
                logger.log(`开始检测 ${data.totalSources} 个视频源`);
                break;
              case 'source_result':
              case 'source_error':
                // 更新验证结果
                setValidationResults((prev) => {
                  const existing = prev.find((r) => r.key === data.source);
                  if (existing) {
                    return prev.map((r) =>
                      r.key === data.source
                        ? {
                            key: data.source,
                            name:
                              sources.find((s) => s.key === data.source)
                                ?.name || data.source,
                            status: data.status,
                            message:
                              data.status === 'valid'
                                ? '搜索正常'
                                : data.status === 'no_results'
                                  ? '无法搜索到结果'
                                  : '连接失败',
                            resultCount: data.status === 'valid' ? 1 : 0,
                          }
                        : r,
                    );
                  } else {
                    return [
                      ...prev,
                      {
                        key: data.source,
                        name:
                          sources.find((s) => s.key === data.source)?.name ||
                          data.source,
                        status: data.status,
                        message:
                          data.status === 'valid'
                            ? '搜索正常'
                            : data.status === 'no_results'
                              ? '无法搜索到结果'
                              : '连接失败',
                        resultCount: data.status === 'valid' ? 1 : 0,
                      },
                    ];
                  }
                });
                break;

              case 'complete':
                logger.log(
                  `检测完成，共检测 ${data.completedSources} 个视频源`,
                );
                eventSource.close();
                setIsValidating(false);
                showSuccess('检测完成');
                break;
            }
          } catch (error) {
            logger.error('解析EventSource数据失败:', error);
          }
        };

        eventSource.onerror = (error) => {
          logger.error('EventSource错误:', error);
          eventSource.close();
          setIsValidating(false);
          showError('连接错误，请重试');
        };

        // 设置超时，防止长时间等待
        setTimeout(() => {
          if (eventSource.readyState === EventSource.OPEN) {
            eventSource.close();
            setIsValidating(false);
            showError('检测超时，请重试');
          }
        }, 60000); // 60秒超时
      } catch (error) {
        setIsValidating(false);
        showError('检测失败: ' + (error as Error).message);
        throw error;
      }
    });
  };

  // 虚拟滚动状态
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const containerHeight = 600;
  const itemHeight =
    typeof window !== 'undefined' && window.innerWidth < 640 ? 120 : 80; // 移动端增加高度

  // 排序状态
  const [sortByValidation, setSortByValidation] = useState<
    'none' | 'valid-first' | 'invalid-first'
  >('none');

  // 计算可见范围
  const updateVisibleRange = (scrollTop: number) => {
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(start + visibleCount + 5, sources.length); // +5 缓冲

    setVisibleRange({ start: Math.max(0, start - 2), end }); // -2 预渲染
  };

  // 滚动处理
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    updateVisibleRange(e.currentTarget.scrollTop);
  };

  // 获取当前可见的视频源
  const getSortedSources = () => {
    if (sortByValidation === 'none') {
      return sources;
    }

    return [...sources].sort((a, b) => {
      const resultA = validationResults.find((r) => r.key === a.key);
      const resultB = validationResults.find((r) => r.key === b.key);

      // 如果没有检测结果，排在最后
      if (!resultA && !resultB) return 0;
      if (!resultA) return 1;
      if (!resultB) return -1;

      // 状态优先级: valid > no_results > invalid > validating
      const priority = {
        valid: 3,
        no_results: 2,
        invalid: 1,
        validating: 0,
      };

      const priorityA = priority[resultA.status as keyof typeof priority] || 0;
      const priorityB = priority[resultB.status as keyof typeof priority] || 0;

      if (sortByValidation === 'valid-first') {
        return priorityB - priorityA;
      } else {
        // invalid-first
        return priorityA - priorityB;
      }
    });
  };

  const sortedSources = getSortedSources();
  const visibleSources = sortedSources.slice(
    visibleRange.start,
    visibleRange.end,
  );

  const handleSelectAll = () => {
    if (selectedSources.size === sources.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(sources.map((s) => s.key)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedSources.size === 0) return;

    if (!confirm(`确定要删除选中的 ${selectedSources.size} 个视频源吗？`))
      return;

    withLoading('batchDelete', async () => {
      for (const key of selectedSources) {
        await callSourceApi({ action: 'delete', key });
      }
      setSelectedSources(new Set());
    }).catch(() => {
      logger.error('批量删除失败');
      // 使用Toast通知
      showError('批量删除失败');
    });
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(sources, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a') as HTMLAnchorElement;
    link.href = url;
    link.download = 'video-sources.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedSources = JSON.parse(e.target?.result as string);
        if (!Array.isArray(importedSources)) {
          throw new Error('导入文件格式错误');
        }

        await withLoading('importSources', async () => {
          for (const source of importedSources) {
            if (source.key && source.name && source.api) {
              await callSourceApi({
                action: 'add',
                key: source.key,
                name: source.name,
                api: source.api,
                detail: source.detail,
              });
            }
          }
        });

        // 使用Toast通知
        showSuccess('导入成功');
      } catch (error) {
        // 使用Toast通知
        showError(
          '导入失败: ' + (error instanceof Error ? error.message : '未知错误'),
        );
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className='p-1'>
      <div className='space-y-4'>
        {/* 统计信息 */}
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
          <div className='bg-pink-50 dark:bg-pink-900/30 p-2 sm:p-3 rounded-lg border border-pink-200 dark:border-pink-700 shadow-sm hover:shadow-md transition-shadow'>
            <div className='text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400'>
              {sources.length}
            </div>
            <div className='text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium'>
              总视频源
            </div>
          </div>
          <div className='bg-pink-50 dark:bg-pink-900/30 p-2 sm:p-3 rounded-lg border border-pink-200 dark:border-pink-700 shadow-sm hover:shadow-md transition-shadow'>
            <div className='text-lg sm:text-xl font-bold text-green-600 dark:text-green-400'>
              {sources.filter((s) => !s.disabled).length}
            </div>
            <div className='text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium'>
              已启用
            </div>
          </div>
          <div className='bg-pink-50 dark:bg-pink-900/30 p-2 sm:p-3 rounded-lg border border-pink-200 dark:border-pink-700 shadow-sm hover:shadow-md transition-shadow'>
            <div className='text-lg sm:text-xl font-bold text-red-600 dark:text-red-400'>
              {sources.filter((s) => s.disabled).length}
            </div>
            <div className='text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium'>
              已禁用
            </div>
          </div>
          <div className='bg-pink-50 dark:bg-pink-900/30 p-2 sm:p-3 rounded-lg border border-pink-200 dark:border-pink-700 shadow-sm hover:shadow-md transition-shadow'>
            <div className='text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400'>
              {selectedSources.size}
            </div>
            <div className='text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium'>
              已选择
            </div>
          </div>
        </div>

        {/* 操作按钮 */}

        <div className='grid grid-cols-2 sm:flex sm:flex-wrap gap-2'>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className='flex items-center justify-center space-x-1.5 px-2 sm:px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md text-xs sm:text-sm'
          >
            <Plus size={14} />

            <span className='hidden sm:inline'>添加视频源</span>

            <span className='sm:hidden'>添加</span>
          </button>

          <button
            onClick={handleSelectAll}
            className='px-2 sm:px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md text-xs sm:text-sm'
          >
            {selectedSources.size === sources.length ? '取消全选' : '全选'}
          </button>

          <button
            onClick={handleBatchDelete}
            disabled={selectedSources.size === 0}
            className='flex items-center justify-center space-x-1.5 px-2 sm:px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-xs sm:text-sm'
          >
            <Trash2 size={14} />

            <span className='hidden sm:inline'>批量删除</span>

            <span className='sm:hidden'>删除</span>

            {selectedSources.size > 0 && (
              <span className='ml-1 px-2 py-0.5 bg-red-700 text-white text-xs rounded-full'>
                {selectedSources.size}
              </span>
            )}
          </button>

          <button
            onClick={handleExport}
            className='flex items-center justify-center space-x-1.5 px-2 sm:px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md text-xs sm:text-sm'
          >
            <Download size={14} />

            <span className='hidden sm:inline'>导出</span>

            <span className='sm:hidden'>导出</span>
          </button>

          <label className='flex items-center justify-center space-x-1.5 px-2 sm:px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md cursor-pointer text-xs sm:text-sm'>
            <Upload size={14} />

            <span className='hidden sm:inline'>导入</span>

            <span className='sm:hidden'>导入</span>

            <input
              type='file'
              accept='.json'
              onChange={handleImport}
              className='hidden'
            />
          </label>
        </div>

        {/* 添加表单 */}
        {showAddForm && (
          <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 shadow-sm'>
            <h3 className='text-base font-semibold mb-3 text-gray-900 dark:text-gray-100'>
              添加新视频源
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              <div>
                <label className='block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300'>
                  名称
                </label>
                <input
                  type='text'
                  value={newSource.name}
                  onChange={(e) =>
                    setNewSource({ ...newSource, name: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm'
                  placeholder='视频源名称'
                />
              </div>
              <div>
                <label className='block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300'>
                  标识
                </label>
                <input
                  type='text'
                  value={newSource.key}
                  onChange={(e) =>
                    setNewSource({ ...newSource, key: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm'
                  placeholder='唯一标识'
                />
              </div>
              <div>
                <label className='block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300'>
                  API地址
                </label>
                <input
                  type='text'
                  value={newSource.api}
                  onChange={(e) =>
                    setNewSource({ ...newSource, api: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm'
                  placeholder='API地址'
                />
              </div>
              <div>
                <label className='block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300'>
                  描述
                </label>
                <input
                  type='text'
                  value={newSource.detail}
                  onChange={(e) =>
                    setNewSource({ ...newSource, detail: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm'
                  placeholder='可选描述'
                />
              </div>
            </div>
            <div className='flex justify-end space-x-2 mt-4'>
              <button
                onClick={() => setShowAddForm(false)}
                className='px-4 py-2 border border-pink-300 dark:border-pink-600 text-pink-700 dark:text-pink-300 rounded-lg hover:bg-pink-100 dark:hover:bg-pink-700 transition-all hover:scale-105 font-medium text-sm'
              >
                取消
              </button>
              <button
                onClick={handleAddSource}
                disabled={isLoading('addSource')}
                className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md text-sm'
              >
                {isLoading('addSource') ? '添加中...' : '添加'}
              </button>
            </div>
          </div>
        )}

        {/* 有效性检测 - 移到拖拽区域外面 */}
        <div className='bg-gradient-to-br from-pink-50/40 via-rose-50/30 to-purple-50/20 dark:from-pink-900/20 dark:via-rose-900/15 dark:to-purple-900/10 border border-pink-200/50 dark:border-pink-800/50 rounded-lg p-4 shadow-sm backdrop-blur-sm'>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='text-base font-semibold text-gray-900 dark:text-gray-100'>
              视频源有效性检测
            </h3>
          </div>

          {/* 统一布局 - 水平排列 */}
          <div className='flex space-x-2'>
            <input
              type='text'
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder='输入搜索关键词进行检测'
              className='flex-1 px-3 py-2.5 border border-pink-300/50 dark:border-pink-600/50 rounded-lg bg-white/70 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-pink-500/50 focus:border-transparent backdrop-blur-sm text-sm'
            />
            <button
              onClick={handleValidateSources}
              disabled={isValidating || !searchKeyword.trim()}
              className='flex items-center space-x-2 px-3 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md text-sm'
            >
              <Search size={14} />
              <span>{isValidating ? '检测中...' : '检测'}</span>
            </button>
          </div>
        </div>

        {/* 视频源列表 */}
        <div className='bg-pink-50 dark:bg-pink-900/30 border rounded-lg p-3 sm:p-4 shadow-sm'>
          <div className='flex items-center justify-between mb-3 sm:mb-4'>
            <h3 className='text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100'>
              视频源列表
            </h3>
            <button
              onClick={() => {
                if (sortByValidation === 'none') {
                  setSortByValidation('valid-first');
                } else if (sortByValidation === 'valid-first') {
                  setSortByValidation('invalid-first');
                } else {
                  setSortByValidation('none');
                }
              }}
              className='flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-all text-sm text-gray-700 dark:text-gray-200'
              title={
                sortByValidation === 'none'
                  ? '按有效性排序'
                  : sortByValidation === 'valid-first'
                    ? '有效在前'
                    : '无效在前'
              }
            >
              {sortByValidation === 'none' && <ArrowUpDown size={14} />}
              {sortByValidation === 'valid-first' && <ArrowUp size={14} />}
              {sortByValidation === 'invalid-first' && <ArrowDown size={14} />}
              <span className='text-xs'>
                {sortByValidation === 'none'
                  ? '排序'
                  : sortByValidation === 'valid-first'
                    ? '有效优先'
                    : '无效优先'}
              </span>
            </button>
          </div>

          {sources.length === 0 ? (
            <div className='text-center py-12'>
              <div className='text-gray-400 dark:text-gray-500 mb-2'>
                <Play size={48} className='mx-auto' />
              </div>
              <p className='text-gray-500 dark:text-gray-400'>暂无视频源</p>
              <p className='text-sm text-gray-400 dark:text-gray-500 mt-2'>
                添加视频源开始配置
              </p>
            </div>
          ) : (
            <>
              {/* 虚拟滚动容器 */}
              <div
                className='border border-pink-200 dark:border-pink-600 rounded-lg bg-white dark:bg-gray-800'
                style={{ height: `${containerHeight}px` }}
              >
                <div
                  className='relative overflow-auto h-full'
                  onScroll={handleScroll}
                >
                  {/* 总高度占位符 */}
                  <div
                    style={{ height: `${sortedSources.length * itemHeight}px` }}
                  />

                  {/* 可见项目容器 */}
                  <div
                    className='absolute top-0 left-0 right-0'
                    style={{
                      transform: `translateY(${visibleRange.start * itemHeight}px)`,
                    }}
                  >
                    <div className='px-0.5'>
                      {visibleSources.map((source) => (
                        <div
                          key={source.key}
                          className='border-b border-gray-100 dark:border-gray-700 last:border-b-0 py-1 sm:py-0'
                          style={{ minHeight: `${itemHeight}px` }}
                        >
                          <SourceItem
                            source={source}
                            onToggleEnable={handleToggleEnable}
                            onDelete={handleDelete}
                            selected={selectedSources.has(source.key)}
                            validationResult={validationResults.find(
                              (r) => r.key === source.key,
                            )}
                            onSelect={(key) => {
                              const newSelected = new Set(selectedSources);
                              if (newSelected.has(key)) {
                                newSelected.delete(key);
                              } else {
                                newSelected.add(key);
                              }
                              setSelectedSources(newSelected);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VideoConfig() {
  return <VideoConfigContent />;
}

export default VideoConfig;
