'use client';

import { AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import {
  useAdminAuth,
  useAdminLoading,
  useToastNotification,
} from '@/hooks/admin';

interface AISettings {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

const MODEL_EXAMPLES = [
  'gpt-5 (OpenAI)',
  'o3-mini (OpenAI)',
  'claude-4-opus (Anthropic)',
  'claude-4-sonnet (Anthropic)',
  'gemini-2.5-flash (Google)',
  'gemini-2.5-pro (Google)',
  'deepseek-reasoner (DeepSeek)',
  'deepseek-chat (DeepSeek)',
  'deepseek-coder (DeepSeek)',
  'qwen3-max (阿里云)',
  'glm-4-plus (智谱AI)',
  'llama-4 (Meta)',
  'grok-4 (xAI)',
  'GLM-4.6 (recommend)',
  'iFlow-ROME-30BA3B',
  'DeepSeek-V3.2',
  'Qwen3-Coder-Plus',
  'Kimi-K2-Thinking',
  'MiniMax-M2',
  'Kimi-K2-0905',
];

const API_PROVIDERS = [
  { name: 'OpenAI', url: 'https://api.openai.com/v1' },
  { name: 'DeepSeek', url: 'https://api.deepseek.com/v1' },
  { name: '硅基流动', url: 'https://api.siliconflow.cn/v1' },
  { name: '月之暗面', url: 'https://api.moonshot.cn/v1' },
  { name: '智谱AI', url: 'https://open.bigmodel.cn/api/paas/v4' },
  {
    name: '通义千问',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  { name: '百度文心', url: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1' },
  { name: '星辰心流', url: 'https://apis.iflow.cn/v1' },
  { name: '自部署', url: 'http://localhost:11434/v1' },
];

function AIConfigContent() {
  // 使用统一的 hooks
  const { loading, error, isAdminOrOwner } = useAdminAuth();
  const { withLoading, isLoading } = useAdminLoading();
  const { showError, showSuccess } = useToastNotification();

  // 所有状态定义必须在任何条件渲染之前
  const [, setConfig] = useState<unknown>(null);

  // 使用 ref 跟踪是否已经加载过
  const hasLoaded = useRef(false);

  // AI配置状态
  const [aiSettings, setAiSettings] = useState<AISettings>({
    enabled: false,
    apiUrl: '',
    apiKey: '',
    model: '',
    temperature: 0.7,
    maxTokens: 3000,
  });

  // 初始化加载
  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      (async () => {
        try {
          const response = await fetch('/api/admin/config');
          const data = await response.json();
          setConfig(data.Config);

          if (data.Config?.AIRecommendConfig) {
            setAiSettings({
              enabled: data.Config.AIRecommendConfig.enabled ?? false,
              apiUrl: data.Config.AIRecommendConfig.apiUrl || '',
              apiKey: data.Config.AIRecommendConfig.apiKey || '',
              model: data.Config.AIRecommendConfig.model || '',
              temperature: data.Config.AIRecommendConfig.temperature ?? 0.7,
              maxTokens: data.Config.AIRecommendConfig.maxTokens ?? 3000,
            });
          }
        } catch {
          // logger.error('加载AI配置失败:', error);
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
        <p>{error}</p>
      </div>
    );
  }

  // 非管理员或站长禁止访问
  if (!isAdminOrOwner) {
    return (
      <div className='p-6 text-center text-red-500'>
        <h2 className='text-xl font-semibold mb-2'>访问受限</h2>
        <p>您没有权限访问AI配置功能</p>
      </div>
    );
  }

  const saveConfig = async () => {
    // 基本验证
    if (aiSettings.enabled) {
      if (!aiSettings.apiUrl.trim()) {
        showError('请填写API地址');
        return;
      }
      if (!aiSettings.apiKey.trim()) {
        showError('请填写API密钥');
        return;
      }
      if (!aiSettings.model.trim()) {
        showError('请选择或填写模型名称');
        return;
      }
      if (aiSettings.temperature < 0 || aiSettings.temperature > 2) {
        showError('温度参数应在0-2之间');
        return;
      }
      if (aiSettings.maxTokens < 1 || aiSettings.maxTokens > 150000) {
        showError('最大Token数应在1-150000之间');
        return;
      }
    }

    try {
      await withLoading('saveAIConfig', async () => {
        const response = await fetch('/api/admin/ai-recommend', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(aiSettings),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || '保存失败');
        }

        showSuccess('AI推荐配置保存成功');
      });
    } catch (error) {
      logger.error('[AIConfig] 保存AI配置失败:', error);
      showError('保存失败: ' + (error as Error).message);
    }
  };

  const testConnection = async () => {
    if (!aiSettings.apiUrl.trim() || !aiSettings.apiKey.trim()) {
      showError('请先填写API地址和密钥');
      return;
    }

    await withLoading('testAIConnection', async () => {
      try {
        const requestData = {
          apiUrl: aiSettings.apiUrl,
          apiKey: aiSettings.apiKey,
          model: aiSettings.model,
        };

        const response = await fetch('/api/admin/ai-recommend/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || '连接测试失败');
        }

        const result = await response.json();
        showSuccess(result.message || 'API连接测试成功！');
      } catch (error) {
        logger.error('Test error:', error);
        showError('连接测试失败: ' + (error as Error).message);
      }
    });
  };

  const addV1Suffix = () => {
    const url = aiSettings.apiUrl.trim();
    if (url && !url.endsWith('/v1') && !url.includes('/chat/completions')) {
      const newUrl = url.endsWith('/') ? url + 'v1' : url + '/v1';
      setAiSettings((prev) => ({ ...prev, apiUrl: newUrl }));
      showSuccess('已自动添加 /v1 后缀');
    }
  };

  const setProviderUrl = (url: string, name: string) => {
    setAiSettings((prev) => ({ ...prev, apiUrl: url }));
    showSuccess(`已设置为 ${name} API地址`);
  };

  const setModel = (modelName: string) => {
    setAiSettings((prev) => ({ ...prev, model: modelName }));
  };

  return (
    <div className='p-2 sm:p-6'>
      {isLoading('loadAIConfig') ? (
        <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
          加载中...
        </div>
      ) : (
        <div className='space-y-6'>
          {/* 基础设置 */}
          <div className='bg-orange-50 dark:bg-orange-900/30 rounded-lg p-6 border border-orange-200 dark:border-orange-700 shadow-sm'>
            {/* 启用开关 */}
            <div className='bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-700 p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <h4 className='text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2'>
                    <Sparkles className='w-5 h-5' />
                    AI推荐功能
                  </h4>
                  <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                    {aiSettings.enabled
                      ? '开启后将启用AI推荐功能，为用户提供智能影视推荐'
                      : '已禁用AI推荐功能，用户将无法使用AI推荐'}
                  </p>
                </div>
                <label className='relative inline-flex items-center cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={aiSettings.enabled}
                    onChange={async (e) => {
                      const newEnabled = e.target.checked;
                      const oldEnabled = aiSettings.enabled;

                      setAiSettings((prev) => ({
                        ...prev,
                        enabled: newEnabled,
                      }));

                      // 如果是关闭开关，自动保存配置
                      if (oldEnabled && !newEnabled) {
                        try {
                          const response = await fetch(
                            '/api/admin/ai-recommend',
                            {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                ...aiSettings,
                                enabled: false,
                              }),
                            },
                          );

                          if (response.ok) {
                            showSuccess('AI功能已关闭并保存');
                          }
                        } catch (error) {
                          logger.error('自动保存失败:', error);
                          showError('自动保存失败');
                        }
                      }
                    }}
                    className='sr-only peer'
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                </label>
              </div>
            </div>

            {/* API配置 */}
            <div className='space-y-4'>
              {/* API地址 */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  API地址
                </label>
                <div className='relative'>
                  <input
                    type='url'
                    value={aiSettings.apiUrl}
                    onChange={(e) =>
                      setAiSettings((prev) => ({
                        ...prev,
                        apiUrl: e.target.value,
                      }))
                    }
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    placeholder='https://api.openai.com/v1'
                  />
                  <button
                    type='button'
                    onClick={async () => await addV1Suffix()}
                    className='absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded transition-colors'
                  >
                    +/v1
                  </button>
                </div>

                {/* API提供商列表 */}
                <details className='mt-2'>
                  <summary className='text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300'>
                    📝 常见API地址
                  </summary>
                  <div className='mt-2 space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700'>
                    {API_PROVIDERS.map((provider) => (
                      <div
                        key={provider.name}
                        className='group hover:bg-orange-100 dark:hover:bg-orange-800/50 -ml-4 pl-4 pr-2 py-2 rounded transition-colors'
                      >
                        {/* PC端布局 - 水平排列 */}
                        <div className='hidden sm:flex items-center justify-between'>
                          <div className='flex items-center space-x-2 flex-1 min-w-0'>
                            <span className='text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap'>
                              {provider.name}:
                            </span>
                            <code className='text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded flex-1 truncate'>
                              {provider.url}
                            </code>
                          </div>
                          <button
                            type='button'
                            onClick={async () =>
                              await setProviderUrl(provider.url, provider.name)
                            }
                            className='opacity-0 group-hover:opacity-100 ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded transition-all whitespace-nowrap'
                          >
                            使用
                          </button>
                        </div>

                        {/* 移动端布局 - 垂直排列 */}
                        <div className='sm:hidden space-y-2'>
                          <div className='flex items-center justify-between'>
                            <span className='text-xs font-medium text-gray-700 dark:text-gray-300'>
                              {provider.name}
                            </span>
                            <div className='flex space-x-1'>
                              <button
                                type='button'
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await setProviderUrl(
                                    provider.url,
                                    provider.name,
                                  );
                                }}
                                className='px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors'
                              >
                                使用
                              </button>
                              <button
                                type='button'
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (
                                    typeof window !== 'undefined' &&
                                    navigator.clipboard
                                  ) {
                                    try {
                                      await navigator.clipboard.writeText(
                                        provider.url,
                                      );
                                      showSuccess('API地址已复制到剪贴板');
                                    } catch (err) {
                                      logger.error('复制失败:', err);
                                    }
                                  }
                                }}
                                className='px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors'
                              >
                                复制
                              </button>
                            </div>
                          </div>
                          <div className='bg-gray-100 dark:bg-gray-700 p-2 rounded'>
                            <code className='text-xs text-gray-800 dark:text-gray-200 break-all'>
                              {provider.url}
                            </code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>

              {/* API密钥 */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  API密钥
                </label>
                <input
                  type='password'
                  value={aiSettings.apiKey}
                  onChange={(e) =>
                    setAiSettings((prev) => ({
                      ...prev,
                      apiKey: e.target.value,
                    }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  placeholder='sk-...'
                />
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  请妥善保管API密钥，不要泄露给他人
                </p>
              </div>

              {/* 模型名称 */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  模型名称
                </label>
                <input
                  type='text'
                  value={aiSettings.model}
                  onChange={(e) =>
                    setAiSettings((prev) => ({
                      ...prev,
                      model: e.target.value,
                    }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  placeholder='请自行填入正确的官方API模型名称，如：gpt-5'
                />
                <div className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
                  <p className='mb-1'>
                    常用模型参考（建议使用支持联网搜索的模型）：
                  </p>
                  <p className='mb-2 text-orange-600 dark:text-orange-400'>
                    ⚠️ 请确保填入的模型名称与API提供商的官方文档一致
                  </p>
                  <div className='flex flex-wrap gap-2'>
                    {MODEL_EXAMPLES.map((example, index) => (
                      <button
                        key={index}
                        type='button'
                        onClick={() => {
                          const modelName = example.split(' (')[0];
                          setModel(modelName);
                        }}
                        className='inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded cursor-pointer transition-colors'
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 高级参数 */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    温度参数: {aiSettings.temperature}
                  </label>
                  <input
                    type='range'
                    min='0'
                    max='2'
                    step='0.1'
                    value={aiSettings.temperature}
                    onChange={(e) =>
                      setAiSettings((prev) => ({
                        ...prev,
                        temperature: parseFloat(e.target.value),
                      }))
                    }
                    className='w-full'
                  />
                  <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                    控制回复的随机性，0=确定性，2=最随机
                  </p>
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    最大Token数
                  </label>
                  <input
                    type='number'
                    min='1'
                    max='4000'
                    value={aiSettings.maxTokens}
                    onChange={(e) =>
                      setAiSettings((prev) => ({
                        ...prev,
                        maxTokens: parseInt(e.target.value),
                      }))
                    }
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  />
                  <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                    限制AI回复的最大长度。推荐设置：GPT-5/o1/o3/o4推理模型建议2000+，普通模型500-4000即可。
                    <span className='text-yellow-600 dark:text-yellow-400'>
                      ⚠️ 设置过低可能导致空回复！
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className='flex flex-wrap gap-3'>
            <button
              onClick={testConnection}
              disabled={isLoading('testAIConnection')}
              className='flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'
            >
              <CheckCircle className='h-4 w-4 mr-2' />
              {isLoading('testAIConnection') ? '测试中...' : '测试连接'}
            </button>

            <button
              onClick={saveConfig}
              disabled={isLoading('saveAIConfig')}
              className='flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'
            >
              <AlertCircle className='h-4 w-4 mr-2' />
              {isLoading('saveAIConfig') ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AIConfig() {
  return <AIConfigContent />;
}

export default AIConfig;
