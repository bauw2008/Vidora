'use client';

import { useEffect, useState } from 'react';

import { logger } from '@/lib/logger';
import {
  useAdminAuth,
  useAdminLoading,
  useToastNotification,
} from '@/hooks/admin';

function OwnerConfigContent() {
  // 使用统一的 hooks
  const { loading, error, isOwner } = useAdminAuth();
  const { withLoading, isLoading } = useAdminLoading();
  const { showError, showSuccess } = useToastNotification();

  // 所有状态定义必须在任何条件渲染之前
  const [config, setConfig] = useState({
    siteMaintenance: false,
    debugMode: false,
    maxUsers: 1000,
  });

  // 重置弹窗状态
  const [showResetModal, setShowResetModal] = useState(false);

  // 加载配置
  const loadOwnerConfig = async () => {
    try {
      const response = await fetch('/api/admin/owner-config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data.data);
      }
    } catch (error) {
      logger.error('加载站长配置失败:', error);
    }
  };

  // 初始化加载
  useEffect(() => {
    loadOwnerConfig();
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
        <h2 className='text-xl font-semibold mb-2'>加载失败</h2>
        <p>{error}</p>
      </div>
    );
  }

  // 只有站长可以访问
  if (!isOwner) {
    return (
      <div className='p-6 text-center text-red-500'>
        <h2 className='text-xl font-semibold mb-2'>访问受限</h2>
        <p>此功能仅站长可用</p>
      </div>
    );
  }

  // 重置所有配置到默认值
  const handleResetAllConfigs = async () => {
    setShowResetModal(true);
  };

  // 确认重置配置
  const confirmResetAllConfigs = async () => {
    await withLoading('resetAllConfigs', async () => {
      try {
        const response = await fetch('/api/admin/reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('重置配置失败');
        }

        // 关闭弹窗
        setShowResetModal(false);

        // 清除导航配置缓存，强制重新读取
        if (typeof window !== 'undefined') {
          localStorage.removeItem('vidora-menu-settings');
          localStorage.removeItem('vidora-custom-categories');
          // 清除RUNTIME_CONFIG中的菜单设置
          const runtimeConfig = (window as Window).RUNTIME_CONFIG;
          if (runtimeConfig) {
            delete runtimeConfig.MenuSettings;
            delete runtimeConfig.CUSTOM_CATEGORIES;
          }
        }

        showSuccess('所有配置已重置为默认值');

        // 刷新页面以重新加载配置
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (error) {
        logger.error('重置配置失败:', error);
        showError('重置失败: ' + (error as Error).message);
      }
    });
  };

  const handleSave = async () => {
    await withLoading('saveOwnerConfig', async () => {
      try {
        logger.log('保存站长配置:', config);
        const response = await fetch('/api/admin/owner-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config),
        });

        if (!response.ok) {
          throw new Error('保存失败');
        }

        showSuccess('站长配置保存成功');
      } catch (error) {
        logger.error('保存站长配置失败:', error);
        showError('保存失败: ' + (error as Error).message);
      }
    });
  };

  return (
    <>
      <div className='p-2 sm:p-6'>
        <div className='space-y-6'>
          <div className='space-y-6'>
            {/* 站点维护模式 */}
            <div className='flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800'>
              <div className='flex items-center space-x-3'>
                <div className='p-2 bg-red-100 dark:bg-red-800 rounded-lg'>
                  <svg
                    className='w-5 h-5 text-red-600 dark:text-red-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                    />
                  </svg>
                </div>
                <div>
                  <h3 className='font-semibold text-red-700 dark:text-red-400'>
                    维护模式（测试）
                  </h3>
                  <p className='text-sm text-red-600 dark:text-red-500'>
                    限制普通用户访问站点
                  </p>
                </div>
              </div>
              <div className='flex items-center space-x-3'>
                <label className='relative inline-flex items-center cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={config.siteMaintenance}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        siteMaintenance: e.target.checked,
                      })
                    }
                    className='sr-only peer'
                  />
                  <div className='w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600'></div>
                </label>
              </div>
            </div>
            {/* 调试模式 */}
            <div className='flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800'>
              <div className='flex items-center space-x-3'>
                <div className='p-2 bg-yellow-100 dark:bg-yellow-800 rounded-lg'>
                  <svg
                    className='w-5 h-5 text-yellow-600 dark:text-yellow-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
                    />
                  </svg>
                </div>
                <div>
                  <h3 className='font-semibold text-yellow-700 dark:text-yellow-400'>
                    调试模式（测试）
                  </h3>
                  <p className='text-sm text-yellow-600 dark:text-yellow-500'>
                    显示详细的调试信息
                  </p>
                </div>
              </div>
              <div className='flex items-center space-x-3'>
                <label className='relative inline-flex items-center cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={config.debugMode}
                    onChange={(e) =>
                      setConfig({ ...config, debugMode: e.target.checked })
                    }
                    className='sr-only peer'
                  />
                  <div className='w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600'></div>
                </label>
              </div>
            </div>
            {/* 最大用户数限制 */}
            <div className='flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800'>
              <div className='flex items-center space-x-3'>
                <div className='p-2 bg-purple-100 dark:bg-purple-800 rounded-lg'>
                  <svg
                    className='w-5 h-5 text-purple-600 dark:text-purple-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z'
                    />
                  </svg>
                </div>
                <div>
                  <h3 className='font-semibold text-purple-700 dark:text-purple-400'>
                    用户数限制
                  </h3>
                  <p className='text-sm text-purple-600 dark:text-purple-500'>
                    限制站点最大用户注册数量
                  </p>
                </div>
              </div>
              <div className='flex items-center space-x-3'>
                <input
                  type='number'
                  min='1'
                  max='10000'
                  value={config.maxUsers}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value) || 1000;
                    logger.log('用户数输入变化:', newValue);
                    setConfig({ ...config, maxUsers: newValue });
                  }}
                  className='w-24 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-gray-900 dark:text-gray-100'
                />
                <span className='text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap'>
                  用户
                </span>
              </div>
            </div>
            {/* 操作按钮 */}
            <div className='flex justify-between gap-3 mt-6'>
              <div></div>

              <div className='flex gap-2 sm:gap-3'>
                {/* 重置按钮 */}

                <button
                  onClick={handleResetAllConfigs}
                  disabled={isLoading('resetAllConfigs')}
                  className='px-3 py-2 sm:px-6 sm:py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-xs sm:text-sm font-medium flex items-center space-x-2 disabled:opacity-50'
                >
                  {isLoading('resetAllConfigs') ? (
                    <>
                      <div className='w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>

                      <span>重置中</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className='w-3.5 h-3.5 sm:w-4 sm:h-4'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                        />
                      </svg>

                      <span>重置配置</span>
                    </>
                  )}
                </button>

                {/* 保存按钮 */}

                <button
                  onClick={handleSave}
                  disabled={isLoading('saveOwnerConfig')}
                  className='px-3 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-lg transition-all shadow hover:shadow-md text-xs sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2'
                >
                  {isLoading('saveOwnerConfig') ? (
                    <>
                      <div className='w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>

                      <span>保存中...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className='w-3.5 h-3.5 sm:w-4 sm:h-4'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M5 13l4 4L19 7'
                        />
                      </svg>

                      <span>保存配置</span>
                    </>
                  )}
                </button>
              </div>
            </div>{' '}
          </div>{' '}
        </div>
      </div>

      {/* 重置弹窗 - 美观的弹窗效果 */}
      {showResetModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999]'
          onClick={() => setShowResetModal(false)}
        >
          <div
            className='bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-600/20 p-6 max-w-sm w-full mx-4 transform transition-all'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-center mb-4'>
              <div className='p-2 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg shadow-md mr-3'>
                <svg
                  className='w-5 h-5 text-white'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                  />
                </svg>
              </div>
              <h3 className='text-lg font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent'>
                系统重置 - 危险操作
              </h3>
            </div>
            <p className='text-sm font-semibold text-red-700 dark:text-red-400 mb-3'>
              此操作将重置以下站长配置：
            </p>
            <ul className='mb-4 space-y-1.5 text-sm text-red-700 dark:text-red-400 pl-5'>
              <li className='flex items-start'>
                <span className='w-1 h-1 bg-red-500 rounded-full mt-2 mr-2.5 flex-shrink-0'></span>
                站点维护模式设置
              </li>
              <li className='flex items-start'>
                <span className='w-1 h-1 bg-red-500 rounded-full mt-2 mr-2.5 flex-shrink-0'></span>
                调试模式设置
              </li>
              <li className='flex items-start'>
                <span className='w-1 h-1 bg-red-500 rounded-full mt-2 mr-2.5 flex-shrink-0'></span>
                最大用户数限制
              </li>
              <li className='flex items-start'>
                <span className='w-1 h-1 bg-red-500 rounded-full mt-2 mr-2.5 flex-shrink-0'></span>
                所有站长专用配置
              </li>
            </ul>
            <div className='flex justify-end space-x-2'>
              <button
                onClick={() => setShowResetModal(false)}
                className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
              >
                取消
              </button>
              <button
                onClick={confirmResetAllConfigs}
                disabled={isLoading('resetAllConfigs')}
                className='px-4 py-2 text-sm font-medium bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-lg transition-all shadow hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2'
              >
                {isLoading('resetAllConfigs') ? (
                  <>
                    <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                    <span>重置中...</span>
                  </>
                ) : (
                  '确认重置'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 导出组件
function OwnerConfig() {
  return <OwnerConfigContent />;
}

export default OwnerConfig;
