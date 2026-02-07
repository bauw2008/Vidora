'use client';

import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Link2,
  Loader2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { logger } from '@/lib/logger';
import { useAdminApi } from '@/hooks/admin/useAdminApi';
import { useToastNotification } from '@/hooks/admin/useToastNotification';

interface ShortDramaConfigSettings {
  apiUrl: string;
  apiKey: string;
  authEnabled: boolean;
}

function ShortDramaConfigContent() {
  const { showError, showSuccess } = useToastNotification();
  const { configApi } = useAdminApi();
  const [shortDramaSettings, setShortDramaSettings] =
    useState<ShortDramaConfigSettings>({
      apiUrl: 'https://vidora-shortdrama-service.edgeone.app',
      apiKey: '',
      authEnabled: false,
    });
  const [showApiKey, setShowApiKey] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // 加载配置
  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/shortdrama', {
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        cache: 'no-store',
      });
      const data = await response.json();

      if (data.apiUrl) {
        setShortDramaSettings({
          apiUrl:
            data.apiUrl || 'https://vidora-shortdrama-service.edgeone.app',
          apiKey: data.apiKey || '',
          authEnabled: data.authEnabled ?? false,
        });
      }
    } catch (error) {
      logger.error('加载短剧配置失败:', error);
      showError('加载配置失败');
    }
  }, [showError]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 显示消息
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 保存短剧配置
  const handleSave = async () => {
    // 基本验证
    if (!shortDramaSettings.apiUrl.trim()) {
      showMessage('error', '请填写API地址');
      return;
    }

    // URL格式验证
    try {
      new URL(shortDramaSettings.apiUrl);
    } catch {
      showMessage('error', 'API地址格式不正确');
      return;
    }

    if (shortDramaSettings.authEnabled && !shortDramaSettings.apiKey.trim()) {
      showMessage('error', '启用认证时必须填写API Key');
      return;
    }

    setIsSaving(true);

    try {
      await configApi.updateShortDramaConfig({
        apiUrl: shortDramaSettings.apiUrl,
        apiKey: shortDramaSettings.apiKey,
        authEnabled: shortDramaSettings.authEnabled,
      });
      showSuccess('短剧配置已保存');
      await loadConfig(); // 重新加载配置
      setTestResult(null); // 清除测试结果
    } catch (error) {
      logger.error('保存短剧配置失败:', error);
      showError('保存配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!shortDramaSettings.apiUrl.trim()) {
      showMessage('error', '请先填写API地址');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 如果启用了认证，添加认证头
      if (shortDramaSettings.authEnabled && shortDramaSettings.apiKey) {
        headers['Authorization'] = `Bearer ${shortDramaSettings.apiKey}`;
      }

      const response = await fetch(`${shortDramaSettings.apiUrl}/api/health`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000), // 10秒超时
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `连接成功！${data.message || 'API服务正常'}`,
        });
        showSuccess('API连接测试成功');
      } else {
        const errorText = await response.text();
        setTestResult({
          success: false,
          message: `连接失败 (${response.status}): ${errorText}`,
        });
        showError('API连接测试失败');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      setTestResult({
        success: false,
        message: `连接失败: ${errorMsg}`,
      });
      showError('API连接测试失败');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* 消息提示 */}
      {message && (
        <div
          className={`flex items-center space-x-2 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className='h-5 w-5' />
          ) : (
            <AlertCircle className='h-5 w-5' />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* 基础设置 */}
      <div className='bg-purple-50 dark:bg-gray-800 rounded-lg p-6 border border-purple-200 dark:border-gray-700 shadow-sm'>
        <div className='mb-6'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2'>
            短剧API配置
          </h3>
          <div className='flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg'>
            <Link2 className='h-4 w-4' />
            <span>🎬 配置短剧视频数据API服务</span>
          </div>
        </div>

        {/* API地址 */}
        <div className='mb-6'>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            API地址 <span className='text-red-500'>*</span>
          </label>
          <input
            type='text'
            value={shortDramaSettings.apiUrl}
            onChange={(e) =>
              setShortDramaSettings((prev) => ({
                ...prev,
                apiUrl: e.target.value,
              }))
            }
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            placeholder='https://vidora-shortdrama-service.edgeone.app'
          />
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            短剧API服务的基础URL地址
          </p>
        </div>

        {/* 启用认证开关 */}
        <div className='mb-6'>
          <label className='flex items-center cursor-pointer'>
            <input
              type='checkbox'
              className='sr-only'
              checked={shortDramaSettings.authEnabled}
              onChange={(e) =>
                setShortDramaSettings((prev) => ({
                  ...prev,
                  authEnabled: e.target.checked,
                }))
              }
            />
            <div
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                shortDramaSettings.authEnabled
                  ? 'bg-green-600'
                  : 'bg-gray-200 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  shortDramaSettings.authEnabled
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
              />
            </div>
            <span className='ml-3 text-sm font-medium text-gray-900 dark:text-gray-100'>
              启用API认证
            </span>
          </label>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
            开启后，所有API请求都会携带认证令牌
          </p>
        </div>

        {/* API Key - 仅在启用认证时显示 */}
        {shortDramaSettings.authEnabled && (
          <div className='mb-6'>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              API Key <span className='text-red-500'>*</span>
            </label>
            <div className='relative'>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={shortDramaSettings.apiKey}
                onChange={(e) =>
                  setShortDramaSettings((prev) => ({
                    ...prev,
                    apiKey: e.target.value,
                  }))
                }
                className='w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                placeholder='输入API Key'
              />
              <button
                type='button'
                onClick={() => setShowApiKey(!showApiKey)}
                className='absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              >
                {showApiKey ? (
                  <EyeOff className='h-5 w-5' />
                ) : (
                  <Eye className='h-5 w-5' />
                )}
              </button>
            </div>
            <div className='mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg'>
              <p className='text-yellow-700 dark:text-yellow-300 text-xs font-medium mb-1'>
                🔒 安全提示
              </p>
              <p className='text-yellow-700 dark:text-yellow-300 text-xs'>
                • API Key <strong>仅存储在服务器</strong>，不会暴露给前端用户
              </p>
              <p className='text-yellow-700 dark:text-yellow-300 text-xs'>
                • 该配置<strong>不会包含在</strong>配置导出或TVBox订阅中
              </p>
            </div>
          </div>
        )}

        {/* 测试连接结果 */}
        {testResult && (
          <div
            className={`mb-6 p-3 rounded-lg ${
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}
          >
            <p className='text-sm font-medium'>{testResult.message}</p>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className='flex flex-wrap gap-3'>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className='flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'
        >
          {isSaving ? (
            <>
              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              保存中...
            </>
          ) : (
            <>
              <svg
                className='h-4 w-4 mr-2'
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
              保存配置
            </>
          )}
        </button>
        <button
          onClick={handleTestConnection}
          disabled={isTesting || !shortDramaSettings.apiUrl.trim()}
          className='flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'
        >
          {isTesting ? (
            <>
              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              测试中...
            </>
          ) : (
            <>
              <Link2 className='h-4 w-4 mr-2' />
              测试连接
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// 导出组件
function ShortDramaConfig() {
  return <ShortDramaConfigContent />;
}

export default ShortDramaConfig;
