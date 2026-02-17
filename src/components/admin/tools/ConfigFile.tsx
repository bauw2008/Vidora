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
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Globe,
  RefreshCw,
  Save,
  Upload,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
// 使用统一方案中的 hooks
import { useAdminApi } from '@/hooks/admin/useAdminApi';
import { useAdminLoading } from '@/hooks/admin/useAdminLoading';
import { useToastNotification } from '@/hooks/admin/useToastNotification';

function ConfigFile() {
  // 权限已经在父组件检查，这里直接使用
  const { isLoading } = useAdminLoading(); // 加载状态
  const { showError, showSuccess } = useToastNotification(); // 通知系统
  const { configApi } = useAdminApi(); // API 调用

  const [configContent, setConfigContent] = useState('');
  const [subscriptionUrl, setSubscriptionUrl] = useState('');
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');
  const [isValidJson, setIsValidJson] = useState(true);

  const isLoadingRef = useRef(false);

  const loadConfig = async () => {
    // 防止重复加载
    if (isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;

    try {
      const data = await configApi.getConfig();

      // 直接从Config对象获取数据
      const configData = (data as { Config?: unknown }).Config || {};
      const configFile = configData as { ConfigFile?: string };
      const configSub = configData as {
        ConfigSubscribtion?: {
          URL?: string;
          AutoUpdate?: boolean;
          LastCheck?: string;
        };
      };

      // 使用从服务器返回的数据，避免闭包陷阱
      if (configFile.ConfigFile) {
        setConfigContent(configFile.ConfigFile);
      }

      if (configSub.ConfigSubscribtion) {
        setSubscriptionUrl(configSub.ConfigSubscribtion.URL || '');
        setAutoUpdate(configSub.ConfigSubscribtion.AutoUpdate || false);
        setLastCheckTime(configSub.ConfigSubscribtion.LastCheck || '');
      }
    } catch (error) {
      logger.error('加载配置失败:', error);
    } finally {
      isLoadingRef.current = false;
    }
  };

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const validateJson = () => {
      if (!configContent.trim()) {
        setIsValidJson(true);
        return;
      }

      try {
        JSON.parse(configContent);
        setIsValidJson(true);
      } catch {
        setIsValidJson(false);
      }
    };

    validateJson();
  }, [configContent]);

  const handleFetchConfig = async () => {
    if (!subscriptionUrl.trim()) {
      showError('请输入订阅URL');
      return;
    }

    try {
      const data = await configApi.fetchSubscription(subscriptionUrl);

      if (
        data &&
        typeof data === 'object' &&
        'configContent' in data &&
        data.configContent
      ) {
        setConfigContent(data.configContent as string);
        // 更新本地配置的最后检查时间
        const currentTime = new Date().toISOString();
        setLastCheckTime(currentTime);
      } else {
        showError('拉取失败：未获取到配置内容');
      }
    } catch (error) {
      logger.error('拉取配置失败:', error);
    }
  };

  const handleSave = async () => {
    if (!isValidJson) {
      showError('配置内容格式错误，请检查JSON格式');
      return;
    }

    try {
      await configApi.updateConfigFile(
        configContent,
        subscriptionUrl,
        autoUpdate,
        lastCheckTime || new Date().toISOString(),
      );

      showSuccess('配置保存成功');
    } catch (error) {
      logger.error('保存配置失败:', error);
      showError('保存失败: ' + (error as Error).message);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(configContent, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a') as HTMLAnchorElement;
    link.href = url;
    link.download = 'config-backup.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        setConfigContent(content);
        showSuccess('配置管理导入成功');
      } catch {
        showError('导入失败：文件格式错误');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className='p-2 sm:p-6'>
      <div className='space-y-4 sm:space-y-6'>
        {/* 订阅配置区域 */}
        <div className='bg-gradient-to-r from-blue-50/60 via-indigo-50/50 to-purple-50/40 dark:from-blue-900/40 dark:via-indigo-900/30 dark:to-purple-900/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-blue-200/50 dark:border-blue-800/50 backdrop-blur-sm'>
          <div className='flex items-center space-x-2 sm:space-x-3'>
            <div className='p-1.5 sm:p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg sm:rounded-xl shadow-lg'>
              <Globe className='w-5 h-5 sm:w-6 sm:h-6 text-white' />
            </div>
            <div>
              <h3 className='text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-1 sm:mb-2'>
                订阅配置
              </h3>
            </div>{' '}
          </div>

          <div className='space-y-3 sm:space-y-4'>
            <div>
              <input
                type='text'
                value={subscriptionUrl}
                onChange={(e) => setSubscriptionUrl(e.target.value)}
                placeholder='远程配置文件地址'
                className='w-full px-3 py-2.5 sm:px-4 sm:py-3 border border-blue-200/50 dark:border-blue-700/50 rounded-lg sm:rounded-xl bg-white/80 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 backdrop-blur-sm transition-all text-sm sm:text-base'
              />
            </div>

            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4'>
              <div className='flex items-center justify-between w-full sm:w-auto gap-2 sm:gap-4'>
                <label className='flex items-center space-x-1.5 sm:space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-800/30 dark:to-purple-800/30 rounded-lg sm:rounded-xl cursor-pointer hover:from-blue-200 hover:to-purple-200 dark:hover:from-blue-700/40 dark:hover:to-purple-700/40 transition-all'>
                  <input
                    type='checkbox'
                    id='autoUpdate'
                    checked={autoUpdate}
                    onChange={(e) => setAutoUpdate(e.target.checked)}
                    className='w-4 h-4 sm:w-5 sm:h-5 text-blue-600 border-blue-200 rounded focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-700'
                  />
                  <span className='text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300'>
                    自动更新
                  </span>
                </label>
                <button
                  onClick={handleFetchConfig}
                  disabled={
                    isLoading('api_/api/admin/config_subscription/fetch') ||
                    !subscriptionUrl.trim()
                  }
                  className='px-3 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg sm:rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm'
                >
                  <Download className='w-4 h-4 sm:w-5 sm:h-5' />
                  <span className='font-semibold'>
                    {isLoading('api_/api/admin/config_subscription/fetch')
                      ? '拉取中...'
                      : '拉取配置'}
                  </span>
                </button>
              </div>

              {/* 更新时间显示 */}
              <div className='flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 bg-white/60 dark:bg-gray-800/60 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg backdrop-blur-sm'>
                <Clock className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                <span className='truncate'>
                  最后更新:{' '}
                  {lastCheckTime
                    ? new Date(lastCheckTime).toLocaleString('zh-CN')
                    : '从未更新'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 配置文件编辑区域 */}
        <div className='bg-gradient-to-br from-emerald-50/40 via-teal-50/30 to-cyan-50/20 dark:from-emerald-900/20 dark:via-teal-900/15 dark:to-cyan-900/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-emerald-200/50 dark:border-emerald-800/50 backdrop-blur-sm'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 space-y-2 sm:space-y-0'>
            <div className='flex items-center space-x-2 sm:space-x-3'>
              <div className='p-1.5 sm:p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg sm:rounded-xl shadow-lg'>
                <FileText className='w-5 h-5 sm:w-6 sm:h-6 text-white' />
              </div>
              <h3 className='text-lg sm:text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent'>
                配置内容
              </h3>
            </div>{' '}
            {/* JSON格式验证状态 - 仅在PC端显示 */}
            {configContent && (
              <div className='hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-white/80 dark:bg-gray-800/50 rounded-xl backdrop-blur-sm'>
                {isValidJson ? (
                  <CheckCircle className='w-4 h-4 text-emerald-600' />
                ) : (
                  <XCircle className='w-4 h-4 text-red-500' />
                )}
                <span
                  className={`text-xs font-semibold ${isValidJson ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {isValidJson ? 'JSON格式正确' : 'JSON格式错误'}
                </span>
              </div>
            )}
          </div>

          <div className='p-0.1 sm:p-6'>
            <textarea
              value={configContent}
              onChange={(e) => setConfigContent(e.target.value)}
              rows={20}
              placeholder='JSON配置内容...'
              className='w-full px-1 py-2.5 sm:px-4 sm:py-4 border border-emerald-200/50 dark:border-emerald-700/50 rounded-lg sm:rounded-2xl bg-white/90 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100 font-mono text-xs sm:text-sm leading-relaxed resize-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm transition-all'
              style={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              }}
            />

            {/* 移动端JSON格式验证状态 */}
            {configContent && (
              <div className='sm:hidden mt-3 flex items-center space-x-2 px-3 py-1.5 bg-white/80 dark:bg-gray-800/50 rounded-lg backdrop-blur-sm'>
                {isValidJson ? (
                  <CheckCircle className='w-4 h-4 text-emerald-600' />
                ) : (
                  <XCircle className='w-4 h-4 text-red-500' />
                )}
                <span
                  className={`text-xs font-semibold ${isValidJson ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {isValidJson ? 'JSON格式正确' : 'JSON格式错误'}
                </span>
              </div>
            )}

            {/* 操作按钮区域 - 移动端独立一行显示 */}
            <div className='mt-4 sm:mt-6 grid grid-cols-2 sm:flex sm:flex-row sm:items-center sm:justify-center sm:space-x-2 gap-2 sm:gap-0 sm:space-y-0'>
              <button
                onClick={handleSave}
                disabled={
                  isLoading('api_/api/admin/config_file') || !isValidJson
                }
                className='px-3 py-2.5 sm:px-4 sm:py-3 text-xs bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg sm:rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-1 w-full sm:w-auto'
              >
                <Save className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                <span>
                  {isLoading('api_/api/admin/config_file')
                    ? '保存中...'
                    : '保存'}
                </span>
              </button>
              <button
                onClick={loadConfig}
                disabled={isLoading('api_/api/admin/config')}
                className='px-3 py-2.5 sm:px-4 sm:py-3 text-xs bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg sm:rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-1 w-full sm:w-auto'
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading('api_/api/admin/config') ? 'animate-spin' : ''}`}
                />
                <span>刷新</span>
              </button>

              <label className='flex items-center justify-center space-x-1.5 sm:space-x-2 px-3 py-2.5 sm:px-4 sm:py-3 text-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg sm:rounded-xl cursor-pointer transition-all shadow-lg hover:shadow-xl transform hover:scale-105 w-full sm:w-auto'>
                <Upload className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                <span>导入</span>
                <input
                  type='file'
                  accept='.json'
                  onChange={handleImport}
                  className='hidden'
                />
              </label>

              <button
                onClick={handleExport}
                className='px-3 py-2.5 sm:px-4 sm:py-3 text-xs bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg sm:rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-1 w-full sm:w-auto'
              >
                <Download className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                <span>导出</span>
              </button>
            </div>

            {!isValidJson && (
              <div className='mt-3 sm:mt-4 p-3 sm:p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/30 dark:to-pink-900/20 border border-red-200/50 dark:border-red-800/50 rounded-lg sm:rounded-xl backdrop-blur-sm'>
                <div className='flex items-center'>
                  <AlertTriangle className='w-4 h-4 sm:w-5 sm:h-5 text-red-500 mr-2 sm:mr-3' />
                  <span className='text-xs sm:text-sm font-semibold text-red-700 dark:text-red-300'>
                    JSON格式错误，请检查配置内容
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfigFile;
