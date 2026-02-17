'use client';

import { Plus, Save, Shield, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import {
  useAdminAuth,
  useAdminLoading,
  useToastNotification,
} from '@/hooks/admin';

function YellowConfigContent() {
  // 使用统一的 hooks
  const { loading, error, isAdminOrOwner } = useAdminAuth();
  const { withLoading, isLoading } = useAdminLoading();
  const { showError, showSuccess } = useToastNotification();

  // 所有状态定义必须在任何条件渲染之前
  const [yellowWords, setYellowWords] = useState<string[]>([]);
  const [filterEnabled, setFilterEnabled] = useState(true);
  const [newWord, setNewWord] = useState('');

  // 使用 ref 跟踪是否已经加载过
  const hasLoaded = useRef(false);

  // 初始化加载
  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      (async () => {
        try {
          const response = await fetch('/api/admin/config');
          const data = await response.json();
          setYellowWords(data.Config.YellowWords || []);
          // 加载过滤开关状态，默认为true
          setFilterEnabled(
            data.Config.DisableYellowFilter !== undefined
              ? !data.Config.DisableYellowFilter
              : true,
          );
        } catch (error) {
          logger.error('加载18+配置失败:', error);
        }
      })();
    }
  }, []);

  // 加载状态
  if (loading) {
    return (
      <div className='p-6 text-center text-gray-500'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2'></div>
        <p>验证权限中...</p>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className='p-6 text-center text-red-500'>
        <h2 className='text-xl font-semibold mb-2'>权限验证失败</h2>
        <p>权限验证过程中出现错误，请稍后重试</p>
      </div>
    );
  }

  // 非管理员或站长禁止访问
  if (!isAdminOrOwner) {
    return (
      <div className='p-6 text-center text-red-500'>
        <h2 className='text-xl font-semibold mb-2'>访问受限</h2>
        <p>您没有权限访问18+配置功能</p>
      </div>
    );
  }

  const saveConfig = async () => {
    await withLoading('saveYellowConfig', async () => {
      try {
        // 先获取当前的完整配置
        const getResponse = await fetch('/api/admin/config');
        if (!getResponse.ok) {
          throw new Error('获取配置失败');
        }

        const currentConfigData = await getResponse.json();

        // 更新YellowWords和DisableYellowFilter部分，保持其他配置不变
        const updatedConfig = {
          ...currentConfigData.Config,
          YellowWords: yellowWords,
          DisableYellowFilter: !filterEnabled, // 注意：DisableYellowFilter是反向逻辑
        };

        // 保存完整配置
        const response = await fetch('/api/admin/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedConfig),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `保存失败: ${response.status}`);
        }

        showSuccess('18+配置已保存');
      } catch (error) {
        logger.error('保存18+配置失败:', error);
        showError('保存失败: ' + (error as Error).message);
      }
    });
  };

  const addWord = () => {
    if (newWord && newWord.trim()) {
      // 检查是否已存在
      if (yellowWords.includes(newWord.trim())) {
        showError('该词汇已存在');
        return;
      }
      setYellowWords([...yellowWords, newWord.trim()]);
      setNewWord('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addWord();
    }
  };

  const removeWord = (index: number) => {
    setYellowWords(yellowWords.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    if (yellowWords.length === 0) return;

    if (typeof window !== 'undefined') {
      if (confirm('确定要清空所有过滤词吗？')) {
        setYellowWords([]);
      }
    }
  };

  return (
    <div className='p-1 sm:p-6'>
      {isLoading('loadYellowConfig') ? (
        <div className='text-center py-12'>
          <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500'></div>
          <p className='mt-4 text-gray-500 dark:text-gray-400'>加载中...</p>
        </div>
      ) : (
        <div className='space-y-6'>
          {/* 总开关 */}
          <div className='bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700 p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <h4 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
                  18+内容过滤
                </h4>
                <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                  {filterEnabled
                    ? '开启后将过滤包含敏感词汇的内容'
                    : '已禁用18+内容过滤'}
                </p>
              </div>
              <label className='relative inline-flex items-center cursor-pointer'>
                <input
                  type='checkbox'
                  checked={filterEnabled}
                  onChange={async (e) => {
                    const newFilterEnabled = e.target.checked;
                    const oldFilterEnabled = filterEnabled;

                    setFilterEnabled(newFilterEnabled);

                    // 如果是关闭开关，自动保存配置
                    if (oldFilterEnabled && !newFilterEnabled) {
                      try {
                        await withLoading('toggleYellowFilter', async () => {
                          // 先获取当前的完整配置
                          const getResponse = await fetch('/api/admin/config');
                          if (!getResponse.ok) {
                            throw new Error('获取配置失败');
                          }

                          const currentConfigData = await getResponse.json();

                          // 更新YellowWords和DisableYellowFilter部分，保持其他配置不变
                          const updatedConfig = {
                            ...currentConfigData.Config,
                            YellowWords: yellowWords,
                            DisableYellowFilter: !newFilterEnabled, // 注意：DisableYellowFilter是反向逻辑
                          };

                          // 保存完整配置
                          const response = await fetch('/api/admin/config', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(updatedConfig),
                          });

                          if (response.ok) {
                            showSuccess('过滤功能已关闭并保存');
                          } else {
                            const errorData = await response
                              .json()
                              .catch(() => ({}));
                            throw new Error(errorData.error || '保存失败');
                          }
                        });
                      } catch (error) {
                        logger.error('自动保存失败:', error);
                        // 恢复开关状态
                        setFilterEnabled(oldFilterEnabled);
                        showError('自动保存失败');
                      }
                    }
                  }}
                  className='sr-only peer'
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 dark:peer-focus:ring-yellow-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-600"></div>
              </label>
            </div>
          </div>

          {/* 添加新词区域 */}
          <div
            className={`bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700 p-6 ${!filterEnabled ? 'opacity-60' : ''}`}
          >
            <div className='flex items-center justify-between mb-4'>
              <h4 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
                添加过滤词
              </h4>
            </div>
            <div className='flex flex-col sm:flex-row gap-2 sm:gap-3'>
              <input
                type='text'
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder='输入要过滤的词汇，按回车添加'
                disabled={!filterEnabled}
                className='flex-1 px-3 py-2 sm:px-4 sm:py-3 border border-yellow-300 dark:border-yellow-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
              />
              <button
                onClick={addWord}
                disabled={!newWord.trim() || !filterEnabled}
                className='w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed font-medium'
              >
                <div className='flex items-center justify-center gap-2'>
                  <Plus className='w-4 h-4' />
                  <span>添加</span>
                </div>
              </button>
            </div>
          </div>

          {/* 词汇列表 */}
          <div
            className={`bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700 overflow-hidden ${!filterEnabled ? 'opacity-60' : ''}`}
          >
            <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
              <div className='flex items-center justify-between'>
                <h4 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
                  过滤词汇
                </h4>
                <div className='flex items-center gap-2'>
                  <span className='text-sm text-gray-500 dark:text-gray-400'>
                    共 {yellowWords.length} 个词汇
                  </span>
                  {yellowWords.length > 0 && filterEnabled && (
                    <button
                      onClick={clearAll}
                      className='text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
                    >
                      清空全部
                    </button>
                  )}
                </div>
              </div>
            </div>

            {yellowWords.length > 0 ? (
              <div className='p-6 max-h-96 overflow-y-auto'>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'>
                  {yellowWords.map((word, index) => (
                    <div
                      key={index}
                      className='group flex items-center justify-between p-3 bg-yellow-100 dark:bg-yellow-800/30 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors border border-yellow-200 dark:border-yellow-600'
                    >
                      <div className='flex items-center gap-2 min-w-0 flex-1'>
                        <div className='w-6 h-6 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center flex-shrink-0'>
                          <Shield className='w-3 h-3 text-red-600 dark:text-red-400' />
                        </div>
                        <span className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                          {word}
                        </span>
                      </div>
                      <button
                        onClick={() => removeWord(index)}
                        disabled={!filterEnabled}
                        className='opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed'
                        title='删除'
                      >
                        <Trash2 className='w-3 h-3' />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className='px-6 py-12 text-center'>
                <Shield className='w-12 h-12 text-gray-400 mx-auto mb-4' />
                <p className='text-gray-500 dark:text-gray-400'>暂无过滤词汇</p>
                <p className='text-sm text-gray-400 dark:text-gray-500 mt-2'>
                  添加词汇开始配置内容过滤
                </p>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className='flex flex-col sm:flex-row gap-2 sm:gap-3'>
            <button
              onClick={saveConfig}
              disabled={isLoading('saveYellowConfig') || !filterEnabled}
              className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed font-medium'
            >
              <div className='flex items-center justify-center gap-2'>
                {isLoading('saveYellowConfig') ? (
                  <>
                    <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className='w-4 h-4' />
                    保存配置
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function YellowConfig() {
  return <YellowConfigContent />;
}

export default YellowConfig;
