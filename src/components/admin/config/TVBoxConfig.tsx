'use client';

import {
  Activity,
  BarChart3,
  CheckCircle,
  Copy,
  ExternalLink,
  Globe,
  Heart,
  RefreshCw,
  Save,
  Shield,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ConfigDiagnosisResult, JarFixResult } from '@/lib/api.types';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  useAdminAuth,
  useAdminLoading,
  useToastNotification,
} from '@/hooks/admin';

interface UserToken {
  username: string;
  token: string;
  enabled: boolean;
  devices: Array<{
    deviceId: string;
    deviceInfo: string;
    bindTime: number;
  }>;
}

interface SecuritySettings {
  enableRateLimit: boolean;
  rateLimit: number;
  enableDeviceBinding: boolean;
  maxDevices: number;
  enableUserAgentWhitelist: boolean;
  allowedUserAgents: string[];
  defaultUserGroup: string;
  currentDevices: Array<{
    deviceId: string;
    deviceInfo: string;
    bindTime: number;
  }>;
  userTokens: UserToken[];
  configGenerator?: {
    configMode: 'standard' | 'safe' | 'fast' | 'yingshicang';
    format: 'json' | 'base64';
  };
}

interface SmartHealthResult {
  success: boolean;
  timestamp: number;
  executionTime: number;
  network: {
    environment: 'domestic' | 'international';
    region: string;
    detectionMethod: string;
    optimized: boolean;
  };
  spider: {
    current: {
      success: boolean;
      source: string;
      size: number;
      md5: string;
      cached: boolean;
      tried_sources: number;
    };
    cached: boolean;
  };
  reachability: {
    total_tested: number;
    successful: number;
    health_score: number;
    tests: Array<{
      url: string;
      success: boolean;
      responseTime: number;
      statusCode?: number;
      error?: string;
      size?: number;
    }>;
  };
  recommendations: string[];
  status: {
    overall: 'excellent' | 'good' | 'needs_attention';
    spider_available: boolean;
    network_stable: boolean;
    recommendations_count: number;
  };
  error?: string;
}

function TVBoxConfigContent() {
  // 使用统一的 hooks
  const { loading, error, isAdminOrOwner } = useAdminAuth();
  const { isLoading, withLoading } = useAdminLoading();
  const { showError, showSuccess, showWarning } = useToastNotification();

  // 所有状态定义必须在任何条件渲染之前
  const [showToken, setShowToken] = useState(false);
  const [diagnoseResult, setDiagnoseResult] =
    useState<ConfigDiagnosisResult | null>(null);
  const [showDiagnoseResult, setShowDiagnoseResult] = useState(false);
  const [configMode, setConfigMode] = useState<
    'standard' | 'safe' | 'fast' | 'yingshicang'
  >('standard');
  const [format, setFormat] = useState<'json' | 'base64'>('json');
  const [refreshingJar, setRefreshingJar] = useState(false);
  const [jarRefreshMsg, setJarRefreshMsg] = useState<string | null>(null);
  const [smartHealthResult, setSmartHealthResult] =
    useState<SmartHealthResult | null>(null);
  const [smartHealthLoading, setSmartHealthLoading] = useState(false);
  const [newUAName, setNewUAName] = useState('');
  const [newUAValue, setNewUAValue] = useState('');
  const [showUAList, setShowUAList] = useState(false);

  // 源修复相关状态
  const [jarFixResult, setJarFixResult] = useState<JarFixResult | null>(null);
  const [jarFixLoading, setJarFixLoading] = useState(false);
  const [showJarFixResult, setShowJarFixResult] = useState(false);

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    enableRateLimit: false,
    rateLimit: 30,
    enableDeviceBinding: false,
    maxDevices: 1,
    enableUserAgentWhitelist: false,
    allowedUserAgents: [
      'okHttp/Mod-1.4.0.0',
      'TVBox',
      'OKHTTP',
      'Dalvik',
      'Java',
    ],
    defaultUserGroup: 'user',
    currentDevices: [],
    userTokens: [],
  });

  // 加载配置
  async function loadConfig() {
    await withLoading('loadTVBoxConfig', async () => {
      try {
        const response = await fetch('/api/tvbox-config');
        const data = await response.json();
        if (data?.securityConfig) {
          setSecuritySettings({
            enableRateLimit: data.securityConfig.enableRateLimit ?? false,
            rateLimit: data.securityConfig.rateLimit ?? 30,
            enableDeviceBinding:
              data.securityConfig.enableDeviceBinding ?? false,
            maxDevices: data.securityConfig.maxDevices ?? 1,
            enableUserAgentWhitelist:
              data.securityConfig.enableUserAgentWhitelist ?? false,
            allowedUserAgents: data.securityConfig.allowedUserAgents ?? [
              'okHttp/Mod-1.4.0.0',
              'TVBox',
              'OKHTTP',
              'Dalvik',
              'Java',
            ],
            defaultUserGroup: data.securityConfig.defaultUserGroup ?? '',
            currentDevices: data.securityConfig.currentDevices ?? [],
            userTokens: data.securityConfig.userTokens ?? [],
          });

          // 加载配置生成器设置
          if (data.securityConfig.configGenerator) {
            setConfigMode(
              data.securityConfig.configGenerator.configMode || 'standard',
            );
            setFormat(data.securityConfig.configGenerator.format || 'json');
          }
        }
        showSuccess('配置加载成功');
      } catch (error) {
        logger.error('加载配置失败:', error);
        showError('加载配置失败');
      }
    });
  }

  // 初始化加载
  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <p>您没有权限访问TVBox配置功能</p>
      </div>
    );
  }

  // 生成随机Token
  function generateToken() {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  const handleSave = async () => {
    await withLoading('saveTVBoxConfig', async () => {
      try {
        if (
          securitySettings.rateLimit < 1 ||
          securitySettings.rateLimit > 1000
        ) {
          showError('频率限制应在1-1000之间');
          return;
        }

        // 保存所有配置（配置生成器需要完整的配置）
        const saveData = {
          enableAuth: securitySettings.enableDeviceBinding,
          token: '',
          enableRateLimit: securitySettings.enableRateLimit,
          rateLimit: securitySettings.rateLimit,
          enableDeviceBinding: securitySettings.enableDeviceBinding,
          maxDevices: securitySettings.maxDevices,
          enableUserAgentWhitelist: securitySettings.enableUserAgentWhitelist,
          allowedUserAgents: securitySettings.allowedUserAgents,
          currentDevices: securitySettings.userTokens.flatMap(
            (user) => user.devices,
          ),
          userTokens: securitySettings.userTokens,
          // 添加配置生成器设置
          configGenerator: {
            configMode,
            format,
          },
        };
        const response = await fetch('/api/admin/tvbox-security', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saveData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '保存失败');
        }

        showSuccess('TVBox配置保存成功！');
        await loadConfig();
      } catch (error) {
        showError(error instanceof Error ? error.message : '保存失败');
      }
    });
  };

  const copyUserToken = (token: string) => {
    navigator.clipboard.writeText(token);
    showSuccess('Token已复制到剪贴板');
  };

  const generateExampleURL = () => {
    // 处理SSR环境
    if (typeof window === 'undefined') {
      return '';
    }

    const baseUrl = window.location.origin;
    const params = new URLSearchParams();

    params.append('format', format);

    if (
      securitySettings.enableDeviceBinding &&
      securitySettings.userTokens.length > 0
    ) {
      const userToken = securitySettings.userTokens.find((t) => t.enabled);
      if (userToken && userToken.token) {
        params.append('token', userToken.token);
      }
    }

    if (configMode !== 'standard') {
      params.append('mode', configMode);
    }

    return `${baseUrl}/api/tvbox?${params.toString()}`;
  };

  const handleDiagnose = async () => {
    await withLoading('diagnoseTVBox', async () => {
      try {
        let diagnoseUrl = '/api/tvbox/diagnose';
        if (
          securitySettings.enableDeviceBinding &&
          securitySettings.userTokens.length > 0
        ) {
          const userToken = securitySettings.userTokens.find((t) => t.enabled);
          if (userToken) {
            diagnoseUrl += `?token=${encodeURIComponent(userToken.token)}`;
          }
        }

        const response = await fetch(diagnoseUrl);
        const result = await response.json();

        setDiagnoseResult(result);
        setShowDiagnoseResult(true);

        if (result.pass) {
          showSuccess('配置诊断通过！所有检查项正常');
        } else {
          showWarning(`发现 ${result.issues?.length || 0} 个问题`);
        }
      } catch (error) {
        showError(
          '诊断失败：' + (error instanceof Error ? error.message : '未知错误'),
        );
      }
    });
  };

  const handleRefreshJar = async () => {
    setRefreshingJar(true);
    setJarRefreshMsg(null);
    try {
      const response = await fetch('/api/tvbox/spider-status', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        setJarRefreshMsg(
          `✓ JAR 缓存已刷新 (${data.jar_status.source.split('/').pop()})`,
        );
        if (diagnoseResult) {
          setTimeout(() => handleDiagnose(), 500);
        }
      } else {
        setJarRefreshMsg(`✗ 刷新失败: ${data.error}`);
      }
    } catch (error) {
      logger.error('刷新JAR缓存失败:', error);
      setJarRefreshMsg('✗ 刷新失败，请稍后重试');
    } finally {
      setRefreshingJar(false);
      setTimeout(() => setJarRefreshMsg(null), 5000);
    }
  };

  const handleSmartHealthCheck = async () => {
    setSmartHealthLoading(true);
    setSmartHealthResult(null);
    try {
      const response = await fetch('/api/tvbox/smart-health');
      const data = await response.json();
      setSmartHealthResult(data);
    } catch (error) {
      logger.error('智能健康检查失败:', error);
      setSmartHealthResult({
        success: false,
        error: '智能健康检查失败，请稍后重试',
      } as SmartHealthResult);
    } finally {
      setSmartHealthLoading(false);
    }
  };

  const handleJarFix = async () => {
    setJarFixLoading(true);
    setJarFixResult(null);
    setShowJarFixResult(true);
    try {
      const response = await fetch('/api/tvbox/jar-fix');
      const data = await response.json();
      setJarFixResult(data);
      if (data.success) {
        showSuccess('JAR源检测完成');
      } else {
        showWarning('JAR源检测发现问题');
      }
    } catch (error) {
      logger.error('JAR源修复检测失败:', error);
      setJarFixResult({
        success: false,
        timestamp: Date.now(),
        executionTime: 0,
        summary: {
          total_tested: 0,
          successful: 0,
          failed: 0,
          user_region: 'domestic',
          avg_response_time: 0,
        },
        test_results: [],
        recommended_sources: [],
        recommendations: {
          immediate: ['JAR源检测失败，请稍后重试'],
          configuration: [],
          troubleshooting: [],
        },
        fixed_config_urls: [],
        status: {
          jar_available: false,
          network_quality: 'poor',
          needs_troubleshooting: true,
        },
        error: 'JAR源检测失败，请稍后重试',
      });
      showError('JAR源检测失败');
    } finally {
      setJarFixLoading(false);
    }
  };

  const handleAddUserAgent = () => {
    if (!newUAValue.trim()) {
      showError('请输入User-Agent值');
      return;
    }

    const currentUAs = securitySettings.allowedUserAgents || [];
    if (currentUAs.includes(newUAValue.trim())) {
      showError('该User-Agent已存在');
      return;
    }

    const updatedUAs = [...currentUAs, newUAValue.trim()];
    setSecuritySettings({
      ...securitySettings,
      allowedUserAgents: updatedUAs,
    });

    setNewUAName('');
    setNewUAValue('');
    showSuccess('User-Agent已添加到白名单');
  };

  const handleDeleteUserAgent = (index: number) => {
    const updatedUAs = [...(securitySettings.allowedUserAgents || [])];
    updatedUAs.splice(index, 1);
    setSecuritySettings({
      ...securitySettings,
      allowedUserAgents: updatedUAs,
    });
    showSuccess('User-Agent已从白名单移除');
  };

  const getUAName = (ua: string) => {
    const knownUAs: { [key: string]: string } = {
      'okHttp/Mod-1.4.0.0': 'TVBox Mod客户端',
      TVBox: 'TVBox标准客户端',
      OKHTTP: 'OKHTTP客户端',
      Dalvik: 'Android应用',
      Java: 'Java客户端',
    };

    if (knownUAs[ua]) {
      return knownUAs[ua];
    }

    for (const [key, name] of Object.entries(knownUAs)) {
      if (ua.toLowerCase().includes(key.toLowerCase())) {
        return name;
      }
    }

    return ua.length > 20 ? ua.substring(0, 20) + '...' : ua;
  };

  return (
    <div className='p-3 sm:p-6'>
      <div className='space-y-6'>
        {/* 统计信息 */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <div className='bg-teal-50 dark:bg-teal-900/30 p-4 rounded-lg border border-teal-200 dark:border-teal-700'>
            <div className='flex items-center justify-between'>
              <Shield className='text-blue-500' size={24} />
              <div className='text-right'>
                <div className='text-2xl font-bold text-blue-600'>
                  {securitySettings.userTokens.length}
                </div>
                <div className='text-sm text-gray-500'>用户Token</div>
              </div>
            </div>
          </div>
          <div className='bg-teal-50 dark:bg-teal-900/30 p-4 rounded-lg border border-teal-200 dark:border-teal-700'>
            <div className='flex items-center justify-between'>
              <Smartphone className='text-green-500' size={24} />
              <div className='text-right'>
                <div className='text-2xl font-bold text-green-600'>
                  {securitySettings.userTokens.reduce(
                    (acc, t) => acc + t.devices.length,
                    0,
                  )}
                </div>
                <div className='text-sm text-gray-500'>绑定设备</div>
              </div>
            </div>
          </div>
          <div className='bg-teal-50 dark:bg-teal-900/30 p-4 rounded-lg border border-teal-200 dark:border-teal-700'>
            <div className='flex items-center justify-between'>
              <Activity className='text-purple-500' size={24} />
              <div className='text-right'>
                <div className='text-2xl font-bold text-purple-600'>
                  {securitySettings.enableRateLimit
                    ? securitySettings.rateLimit
                    : '∞'}
                </div>
                <div className='text-sm text-gray-500'>频率限制</div>
              </div>
            </div>
          </div>
          <div className='bg-teal-50 dark:bg-teal-900/30 p-4 rounded-lg border border-teal-200 dark:border-teal-700'>
            <div className='flex items-center justify-between'>
              <Globe className='text-orange-500' size={24} />
              <div className='text-right'>
                <div className='text-2xl font-bold text-orange-600'>
                  {securitySettings.allowedUserAgents.length}
                </div>
                <div className='text-sm text-gray-500'>UA白名单</div>
              </div>
            </div>
          </div>
        </div>

        {/* 消息提示 */}
        {jarRefreshMsg && (
          <div className='p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg'>
            <p className='text-sm text-blue-600 dark:text-blue-400'>
              {jarRefreshMsg}
            </p>
          </div>
        )}

        {/* 频率限制 */}
        <div className='bg-teal-50 dark:bg-teal-900/30 border rounded-lg p-6 border-teal-200 dark:border-teal-700'>
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                访问频率限制
              </h3>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                限制每个IP每分钟的访问次数，防止滥用
              </p>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={securitySettings.enableRateLimit}
                onChange={async (e) => {
                  const newEnableRateLimit = e.target.checked;

                  // 立即更新本地状态，让UI立即响应
                  setSecuritySettings((prev) => ({
                    ...prev,
                    enableRateLimit: newEnableRateLimit,
                  }));

                  try {
                    // 获取当前完整配置
                    try {
                      const currentResponse = await fetch('/api/tvbox-config');
                      const currentData = await currentResponse.json();

                      // 构建完整的配置对象，只更新频率限制相关字段
                      const saveData = {
                        enableAuth:
                          currentData.securityConfig?.enableAuth || false,
                        token: currentData.securityConfig?.token || '',
                        enableRateLimit: newEnableRateLimit,
                        rateLimit: securitySettings.rateLimit,
                        enableDeviceBinding:
                          currentData.securityConfig?.enableDeviceBinding ||
                          false,
                        maxDevices: currentData.securityConfig?.maxDevices || 1,
                        enableUserAgentWhitelist:
                          currentData.securityConfig
                            ?.enableUserAgentWhitelist || false,
                        allowedUserAgents:
                          currentData.securityConfig?.allowedUserAgents || [],
                        currentDevices:
                          currentData.securityConfig?.currentDevices || [],
                        userTokens:
                          currentData.securityConfig?.userTokens || [],
                      };

                      const response = await fetch(
                        '/api/admin/tvbox-security',
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(saveData),
                        },
                      );

                      if (response.ok) {
                        showSuccess(
                          `频率限制已${newEnableRateLimit ? '开启' : '关闭'}`,
                        );
                      } else {
                        // 如果保存失败，恢复状态
                        setSecuritySettings((prev) => ({
                          ...prev,
                          enableRateLimit: !newEnableRateLimit,
                        }));

                        // 尝试获取更详细的错误信息
                        const errorData = await response
                          .json()
                          .catch(() => ({}));
                        throw new Error(errorData.error || '保存失败');
                      }
                    } catch (fetchError) {
                      // 如果获取当前配置失败，使用本地状态
                      logger.error(
                        '获取当前配置失败，使用本地状态:',
                        fetchError,
                      );

                      const saveData = {
                        enableAuth: false,
                        token: '',
                        enableRateLimit: newEnableRateLimit,
                        rateLimit: securitySettings.rateLimit,
                        enableDeviceBinding:
                          securitySettings.enableDeviceBinding,
                        maxDevices: securitySettings.maxDevices,
                        enableUserAgentWhitelist:
                          securitySettings.enableUserAgentWhitelist,
                        allowedUserAgents: securitySettings.allowedUserAgents,
                        currentDevices: securitySettings.userTokens.flatMap(
                          (user) => user.devices,
                        ),
                        userTokens: securitySettings.userTokens,
                      };

                      const response = await fetch(
                        '/api/admin/tvbox-security',
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(saveData),
                        },
                      );

                      if (response.ok) {
                        showSuccess(
                          `频率限制已${newEnableRateLimit ? '开启' : '关闭'}`,
                        );
                      } else {
                        // 如果保存失败，恢复状态
                        setSecuritySettings((prev) => ({
                          ...prev,
                          enableRateLimit: !newEnableRateLimit,
                        }));

                        // 尝试获取更详细的错误信息
                        const errorData = await response
                          .json()
                          .catch(() => ({}));
                        throw new Error(errorData.error || '保存失败');
                      }
                    }
                  } catch (error) {
                    logger.error('保存频率限制失败:', error);
                    // 如果保存失败，恢复状态
                    setSecuritySettings((prev) => ({
                      ...prev,
                      enableRateLimit: !newEnableRateLimit,
                    }));
                    showError('保存失败: ' + (error as Error).message);
                  }
                }}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {securitySettings.enableRateLimit && (
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                每分钟请求次数限制
              </label>
              <input
                type='number'
                min='1'
                max='1000'
                value={securitySettings.rateLimit}
                onChange={(e) =>
                  setSecuritySettings((prev) => ({
                    ...prev,
                    rateLimit: parseInt(e.target.value) || 60,
                  }))
                }
                className='w-32 px-3 py-2 border border-teal-300 dark:border-teal-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              />
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                建议设置30-60次，过低可能影响正常使用
              </p>
            </div>
          )}
        </div>

        {/* User-Agent白名单 */}
        <div className='bg-teal-50 dark:bg-teal-900/30 border rounded-lg p-6 border-teal-200 dark:border-teal-700'>
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2'>
                <Globe className='w-5 h-5' />
                User-Agent白名单
              </h3>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                限制只有特定User-Agent的客户端才能访问TVBox API
              </p>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={securitySettings.enableUserAgentWhitelist}
                onChange={async (e) => {
                  const newEnableUserAgentWhitelist = e.target.checked;

                  // 立即更新本地状态，让UI立即响应
                  setSecuritySettings((prev) => ({
                    ...prev,
                    enableUserAgentWhitelist: newEnableUserAgentWhitelist,
                  }));

                  try {
                    // 获取当前完整配置
                    try {
                      const currentResponse = await fetch('/api/tvbox-config');
                      const currentData = await currentResponse.json();

                      // 构建完整的配置对象，只更新User-Agent白名单相关字段
                      const saveData = {
                        enableAuth:
                          currentData.securityConfig?.enableAuth || false,
                        token: currentData.securityConfig?.token || '',
                        enableRateLimit:
                          currentData.securityConfig?.enableRateLimit || false,
                        rateLimit: currentData.securityConfig?.rateLimit || 30,
                        enableDeviceBinding:
                          currentData.securityConfig?.enableDeviceBinding ||
                          false,
                        maxDevices: currentData.securityConfig?.maxDevices || 1,
                        enableUserAgentWhitelist: newEnableUserAgentWhitelist,
                        allowedUserAgents: securitySettings.allowedUserAgents,
                        currentDevices:
                          currentData.securityConfig?.currentDevices || [],
                        userTokens:
                          currentData.securityConfig?.userTokens || [],
                      };

                      const response = await fetch(
                        '/api/admin/tvbox-security',
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(saveData),
                        },
                      );

                      if (response.ok) {
                        showSuccess(
                          `User-Agent白名单已${newEnableUserAgentWhitelist ? '开启' : '关闭'}`,
                        );
                      } else {
                        // 如果保存失败，恢复状态
                        setSecuritySettings((prev) => ({
                          ...prev,
                          enableUserAgentWhitelist:
                            !newEnableUserAgentWhitelist,
                        }));

                        // 尝试获取更详细的错误信息
                        const errorData = await response
                          .json()
                          .catch(() => ({}));
                        throw new Error(errorData.error || '保存失败');
                      }
                    } catch (fetchError) {
                      // 如果获取当前配置失败，使用本地状态
                      logger.error(
                        '获取当前配置失败，使用本地状态:',
                        fetchError,
                      );

                      const saveData = {
                        enableAuth: false,
                        token: '',
                        enableRateLimit: securitySettings.enableRateLimit,
                        rateLimit: securitySettings.rateLimit,
                        enableDeviceBinding:
                          securitySettings.enableDeviceBinding,
                        maxDevices: securitySettings.maxDevices,
                        enableUserAgentWhitelist: newEnableUserAgentWhitelist,
                        allowedUserAgents: securitySettings.allowedUserAgents,
                        currentDevices: securitySettings.userTokens.flatMap(
                          (user) => user.devices,
                        ),
                        userTokens: securitySettings.userTokens,
                      };

                      const response = await fetch(
                        '/api/admin/tvbox-security',
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(saveData),
                        },
                      );

                      if (response.ok) {
                        showSuccess(
                          `User-Agent白名单已${newEnableUserAgentWhitelist ? '开启' : '关闭'}`,
                        );
                      } else {
                        // 如果保存失败，恢复状态
                        setSecuritySettings((prev) => ({
                          ...prev,
                          enableUserAgentWhitelist:
                            !newEnableUserAgentWhitelist,
                        }));

                        // 尝试获取更详细的错误信息
                        const errorData = await response
                          .json()
                          .catch(() => ({}));
                        throw new Error(errorData.error || '保存失败');
                      }
                    }
                  } catch (error) {
                    logger.error('保存User-Agent白名单失败:', error);
                    // 如果保存失败，恢复状态
                    setSecuritySettings((prev) => ({
                      ...prev,
                      enableUserAgentWhitelist: !newEnableUserAgentWhitelist,
                    }));
                    showError('保存失败: ' + (error as Error).message);
                  }
                }}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {securitySettings.enableUserAgentWhitelist && (
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  添加白名单规则
                </label>
                {/* PC端布局 - 水平排列 */}
                <div className='hidden md:flex gap-2'>
                  <input
                    type='text'
                    value={newUAName}
                    onChange={(e) => setNewUAName(e.target.value)}
                    placeholder='名称（可选）'
                    className='flex-1 px-3 py-2 border border-teal-300 dark:border-teal-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  />
                  <input
                    type='text'
                    value={newUAValue}
                    onChange={(e) => setNewUAValue(e.target.value)}
                    placeholder='User-Agent值（如：okHttp/Mod-1.4.0.0）'
                    className='flex-1 px-3 py-2 border border-teal-300 dark:border-teal-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  />
                  <button
                    onClick={handleAddUserAgent}
                    className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2'
                  >
                    <CheckCircle className='w-4 h-4' />
                    添加
                  </button>
                </div>

                {/* 移动端布局 - 垂直排列 */}
                <div className='md:hidden space-y-3'>
                  <input
                    type='text'
                    value={newUAName}
                    onChange={(e) => setNewUAName(e.target.value)}
                    placeholder='名称（可选）'
                    className='w-full px-3 py-2 border border-teal-300 dark:border-teal-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  />
                  <input
                    type='text'
                    value={newUAValue}
                    onChange={(e) => setNewUAValue(e.target.value)}
                    placeholder='User-Agent值（如：okHttp/Mod-1.4.0.0）'
                    className='w-full px-3 py-2 border border-teal-300 dark:border-teal-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  />
                  <button
                    onClick={handleAddUserAgent}
                    className='w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2'
                  >
                    <CheckCircle className='w-4 h-4' />
                    添加
                  </button>
                </div>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  支持部分匹配，如输入"okHttp"将匹配所有包含该字符串的User-Agent
                </p>
              </div>

              <div>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2'>
                  <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    当前白名单
                  </label>
                  <button
                    onClick={() => setShowUAList(!showUAList)}
                    className='text-xs px-3 py-1 bg-teal-100 dark:bg-teal-600 hover:bg-teal-200 dark:hover:bg-teal-500 text-teal-700 dark:text-teal-300 rounded transition-colors'
                  >
                    {showUAList ? '隐藏' : '显示'} (
                    {securitySettings.allowedUserAgents?.length || 0})
                  </button>{' '}
                </div>

                {showUAList && (
                  <div className='space-y-2'>
                    {securitySettings.allowedUserAgents?.map(
                      (ua: string, index: number) => (
                        <div
                          key={index}
                          className='flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-teal-50 dark:bg-teal-800 rounded-lg gap-2'
                        >
                          <div className='flex-1 min-w-0'>
                            <div className='font-medium text-gray-900 dark:text-gray-100 truncate'>
                              {getUAName(ua)}
                            </div>
                            <code className='text-xs text-gray-600 dark:text-gray-400 break-all'>
                              {ua}
                            </code>
                          </div>
                          <button
                            onClick={() => handleDeleteUserAgent(index)}
                            className='sm:ml-3 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1'
                          >
                            <XCircle className='w-4 h-4' />
                          </button>
                        </div>
                      ),
                    )}
                    {(!securitySettings.allowedUserAgents ||
                      securitySettings.allowedUserAgents.length === 0) && (
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400 bg-teal-50 dark:bg-teal-800 rounded-lg'>
                        暂无白名单规则
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Token和设备管理 */}
        <div className='bg-teal-50 dark:bg-teal-900/30 border rounded-lg p-6 border-teal-200 dark:border-teal-700'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
              用户Token验证和绑定
            </h3>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={securitySettings.enableDeviceBinding}
                onChange={async (e) => {
                  const newEnableDeviceBinding = e.target.checked;
                  const oldEnableDeviceBinding =
                    securitySettings.enableDeviceBinding;

                  // 立即更新本地状态，让UI立即响应
                  setSecuritySettings((prev) => ({
                    ...prev,
                    enableDeviceBinding: newEnableDeviceBinding,
                  }));

                  try {
                    let userTokens = [...securitySettings.userTokens];

                    // 如果是开启操作，确保有当前用户的token
                    if (newEnableDeviceBinding) {
                      const authInfo = getAuthInfoFromBrowserCookie();
                      const currentUsername = authInfo?.username;

                      if (currentUsername) {
                        // 如果当前用户没有token，添加一个
                        if (
                          !userTokens.find(
                            (t) => t.username === currentUsername,
                          )
                        ) {
                          const chars =
                            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          let token = '';
                          for (let i = 0; i < 32; i++) {
                            token += chars.charAt(
                              Math.floor(Math.random() * chars.length),
                            );
                          }

                          userTokens.push({
                            username: currentUsername,
                            token,
                            enabled: true,
                            devices: [],
                          });

                          // 立即更新用户Tokens状态
                          setSecuritySettings((prev) => ({
                            ...prev,
                            userTokens,
                          }));
                        }
                      }
                    }

                    // 构建简化的配置对象
                    const saveData = {
                      enableAuth: newEnableDeviceBinding, // 当启用设备绑定时启用Token验证
                      token: '',
                      enableRateLimit:
                        securitySettings.enableRateLimit || false,
                      rateLimit: securitySettings.rateLimit || 30,
                      enableDeviceBinding: newEnableDeviceBinding,
                      maxDevices: securitySettings.maxDevices || 5,
                      enableUserAgentWhitelist:
                        securitySettings.enableUserAgentWhitelist || false,
                      allowedUserAgents:
                        securitySettings.allowedUserAgents || [],
                      currentDevices: userTokens.flatMap(
                        (user) => user.devices,
                      ),
                      userTokens: userTokens,
                    };

                    const response = await fetch('/api/admin/tvbox-security', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(saveData),
                    });

                    if (response.ok) {
                      showSuccess(
                        `设备绑定功能已${newEnableDeviceBinding ? '开启' : '关闭'}`,
                      );
                    } else {
                      // 如果保存失败，恢复状态
                      setSecuritySettings((prev) => ({
                        ...prev,
                        enableDeviceBinding: oldEnableDeviceBinding,
                      }));

                      // 尝试获取更详细的错误信息
                      const errorData = await response.json().catch(() => ({}));
                      throw new Error(errorData.error || '保存失败');
                    }
                  } catch (error) {
                    logger.error('保存设备绑定失败:', error);
                    // 如果保存失败，恢复状态
                    setSecuritySettings((prev) => ({
                      ...prev,
                      enableDeviceBinding: oldEnableDeviceBinding,
                    }));
                    showError(
                      '保存失败: ' +
                        (error instanceof Error ? error.message : '未知错误'),
                    );
                  }
                }}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {securitySettings.enableDeviceBinding && (
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  设备绑定数量限制
                </label>
                <div className='flex items-center gap-3'>
                  <input
                    type='number'
                    min='1'
                    max='100'
                    value={securitySettings.maxDevices}
                    onChange={(e) =>
                      setSecuritySettings((prev) => ({
                        ...prev,
                        maxDevices: parseInt(e.target.value) || 1,
                      }))
                    }
                    className='w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm'
                  />
                  <span className='text-sm text-gray-600 dark:text-gray-400'>
                    台设备
                  </span>
                </div>
              </div>

              <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4'>
                <div className='flex items-center justify-between mb-4'>
                  <h4 className='text-sm font-medium text-blue-900 dark:text-blue-300'>
                    用户Token管理
                  </h4>
                  <div className='flex items-center gap-3'>
                    <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'>
                      {securitySettings.userTokens.length} 个用户
                    </span>
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className='text-xs px-3 py-1 bg-teal-100 dark:bg-teal-600 hover:bg-teal-200 dark:hover:bg-teal-500 text-teal-700 dark:text-teal-300 rounded transition-colors'
                    >
                      {showToken ? '隐藏Token' : '显示Token'}
                    </button>
                  </div>
                </div>

                <div className='overflow-x-auto'>
                  <table className='w-full text-sm'>
                    <thead>
                      <tr className='border-b border-blue-200 dark:border-blue-700'>
                        <th className='text-left py-3 px-4 text-blue-900 dark:text-blue-300 font-medium'>
                          用户名
                        </th>
                        <th className='text-left py-3 px-4 text-blue-900 dark:text-blue-300 font-medium'>
                          设备数量
                        </th>
                        <th className='text-left py-3 px-4 text-blue-900 dark:text-blue-300 font-medium'>
                          Token
                        </th>
                        <th className='text-left py-3 px-4 text-blue-900 dark:text-blue-300 font-medium'>
                          状态
                        </th>
                        <th className='text-left py-3 px-4 text-blue-900 dark:text-blue-300 font-medium'>
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {securitySettings.userTokens.map((userToken) => (
                        <tr
                          key={userToken.username}
                          className='border-b border-blue-100 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors'
                        >
                          <td className='py-3 px-4'>
                            <div className='flex items-center gap-2'>
                              <span className='font-medium text-blue-900 dark:text-blue-300'>
                                {userToken.username}
                              </span>
                              {userToken.username === process.env.USERNAME && (
                                <span className='inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'>
                                  站长
                                </span>
                              )}
                            </div>
                          </td>
                          <td className='py-3 px-4'>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                userToken.devices.length >=
                                securitySettings.maxDevices
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                                  : userToken.devices.length === 0
                                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                                    : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                              }`}
                            >
                              {userToken.devices.length}/
                              {securitySettings.maxDevices}
                            </span>
                          </td>
                          <td className='py-3 px-4'>
                            <div className='flex items-center gap-2'>
                              <code
                                className={`font-mono text-xs ${
                                  showToken
                                    ? 'text-gray-900 dark:text-gray-100'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {showToken
                                  ? userToken.token
                                  : '••••••••••••••••••••••••••••••••'}
                              </code>
                              <button
                                onClick={() => copyUserToken(userToken.token)}
                                className='p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors'
                                title='复制Token'
                              >
                                <Copy className='w-3 h-3' />
                              </button>
                            </div>
                          </td>
                          <td className='py-3 px-4'>
                            <div className='flex items-center gap-2'>
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  userToken.enabled
                                    ? 'bg-green-500'
                                    : 'bg-red-500'
                                }`}
                              ></div>
                              <span
                                className={`text-xs ${
                                  userToken.enabled
                                    ? 'text-green-700 dark:text-green-400'
                                    : 'text-red-700 dark:text-red-400'
                                }`}
                              >
                                {userToken.enabled ? '已启用' : '已禁用'}
                              </span>
                            </div>
                          </td>
                          <td className='py-3 px-4'>
                            <div className='flex items-center gap-1'>
                              <button
                                onClick={() => {
                                  const newTokens =
                                    securitySettings.userTokens.map((t) =>
                                      t.username === userToken.username
                                        ? { ...t, token: generateToken() }
                                        : t,
                                    );
                                  setSecuritySettings((prev) => ({
                                    ...prev,
                                    userTokens: newTokens,
                                  }));
                                  showSuccess(
                                    `${userToken.username}的Token已重新生成`,
                                  );
                                }}
                                className='text-xs px-2 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:hover:bg-green-700 text-green-700 dark:text-green-300 rounded transition-colors'
                                title='重新生成Token'
                              >
                                重新生成
                              </button>
                              <button
                                onClick={() => {
                                  const newTokens =
                                    securitySettings.userTokens.map((t) =>
                                      t.username === userToken.username
                                        ? { ...t, enabled: !t.enabled }
                                        : t,
                                    );
                                  setSecuritySettings((prev) => ({
                                    ...prev,
                                    userTokens: newTokens,
                                  }));
                                }}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                  userToken.enabled
                                    ? 'bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800 dark:hover:bg-yellow-700 text-yellow-700 dark:text-yellow-300'
                                    : 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:hover:bg-blue-700 text-blue-700 dark:text-blue-300'
                                }`}
                                title={
                                  userToken.enabled ? '禁用Token' : '启用Token'
                                }
                              >
                                {userToken.enabled ? '禁用' : '启用'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 暂无Token提示 */}
                {securitySettings.userTokens.length === 0 && (
                  <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                    <svg
                      className='mx-auto h-12 w-12 text-gray-400'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 4v16m8-8H4'
                      />
                    </svg>
                    <p className='text-sm'>暂无用户Token</p>
                    <p className='text-xs mt-1'>系统会自动为用户生成Token</p>
                  </div>
                )}
              </div>

              {/* 绑定设备列表 */}
              <div className='bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-4'>
                <div className='flex items-center justify-between mb-4'>
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    绑定设备列表
                  </h4>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs text-gray-500 dark:text-gray-400'>
                      {securitySettings.userTokens.reduce(
                        (total, user) => total + user.devices.length,
                        0,
                      )}{' '}
                      台设备
                    </span>
                    {securitySettings.userTokens.some(
                      (user) => user.devices.length > 0,
                    ) && (
                      <button
                        onClick={async () => {
                          const clearedTokens = securitySettings.userTokens.map(
                            (user) => ({
                              ...user,
                              devices: [],
                            }),
                          );

                          const saveData = {
                            enableAuth: securitySettings.enableDeviceBinding,
                            token: '',
                            enableRateLimit: securitySettings.enableRateLimit,
                            rateLimit: securitySettings.rateLimit,
                            enableDeviceBinding:
                              securitySettings.enableDeviceBinding,
                            maxDevices: securitySettings.maxDevices,
                            enableUserAgentWhitelist:
                              securitySettings.enableUserAgentWhitelist,
                            allowedUserAgents:
                              securitySettings.allowedUserAgents,
                            currentDevices: [],
                            userTokens: clearedTokens,
                          };
                          logger.log(
                            '清空所有设备发送的数据:',
                            JSON.stringify(saveData, null, 2),
                          );
                          logger.log(
                            '清空后的userTokens详情:',
                            saveData.userTokens.map((t) => ({
                              username: t.username,
                              devicesCount: t.devices?.length || 0,
                              devices: t.devices,
                            })),
                          );
                          const response = await fetch(
                            '/api/admin/tvbox-security',
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(saveData),
                            },
                          );

                          if (response.ok) {
                            showSuccess('已清空所有绑定设备');
                            // 延迟一下再加载配置，确保缓存清除
                            setTimeout(async () => {
                              await loadConfig();
                            }, 500);
                          } else {
                            const errorData = await response.json();
                            logger.error('清空失败:', errorData);
                            showError(errorData.error || '清空失败');
                          }
                        }}
                        className='text-xs px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-700 dark:text-red-300 rounded transition-colors'
                      >
                        清空所有
                      </button>
                    )}
                  </div>
                </div>

                {securitySettings.userTokens.some(
                  (user) => user.devices.length > 0,
                ) ? (
                  <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                      <thead>
                        <tr className='border-b border-gray-200 dark:border-gray-600'>
                          <th className='text-left py-3 px-4 text-gray-600 dark:text-gray-400 font-medium'>
                            设备ID
                          </th>
                          <th className='text-left py-3 px-4 text-gray-600 dark:text-gray-400 font-medium'>
                            设备信息
                          </th>
                          <th className='text-left py-3 px-4 text-gray-600 dark:text-gray-400 font-medium'>
                            绑定时间
                          </th>
                          <th className='text-left py-3 px-4 text-gray-600 dark:text-gray-400 font-medium'>
                            用户
                          </th>
                          <th className='text-left py-3 px-4 text-gray-600 dark:text-gray-400 font-medium'>
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {securitySettings.userTokens.flatMap((userToken) =>
                          userToken.devices.map((device) => (
                            <tr
                              key={`${userToken.username}-${device.deviceId}`}
                              className='border-b border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors'
                            >
                              <td className='py-3 px-4'>
                                <code className='text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded'>
                                  {device.deviceId.substring(0, 8)}...
                                </code>
                              </td>
                              <td className='py-3 px-4 text-gray-700 dark:text-gray-300 max-w-xs'>
                                <div
                                  className='truncate'
                                  title={device.deviceInfo}
                                >
                                  {device.deviceInfo}
                                </div>
                              </td>
                              <td className='py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap'>
                                {new Date(device.bindTime).toLocaleString(
                                  'zh-CN',
                                )}
                              </td>
                              <td className='py-3 px-4'>
                                <span className='inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'>
                                  {userToken.username}
                                </span>
                              </td>
                              <td className='py-3 px-4'>
                                <div className='flex items-center gap-1'>
                                  <button
                                    onClick={async () => {
                                      const updatedTokens =
                                        securitySettings.userTokens.map(
                                          (user) =>
                                            user.username === userToken.username
                                              ? {
                                                  ...user,
                                                  devices: user.devices.filter(
                                                    (d) =>
                                                      d.deviceId !==
                                                      device.deviceId,
                                                  ),
                                                }
                                              : user,
                                        );

                                      const saveData = {
                                        enableAuth:
                                          securitySettings.enableDeviceBinding,
                                        token: '',
                                        enableRateLimit:
                                          securitySettings.enableRateLimit,
                                        rateLimit: securitySettings.rateLimit,
                                        enableDeviceBinding:
                                          securitySettings.enableDeviceBinding,
                                        maxDevices: securitySettings.maxDevices,
                                        enableUserAgentWhitelist:
                                          securitySettings.enableUserAgentWhitelist,
                                        allowedUserAgents:
                                          securitySettings.allowedUserAgents,
                                        currentDevices: updatedTokens.flatMap(
                                          (user) => user.devices,
                                        ),
                                        userTokens: updatedTokens,
                                      };

                                      logger.log(
                                        '解绑设备发送的数据:',
                                        JSON.stringify(saveData, null, 2),
                                      );
                                      logger.log(
                                        '解绑后的userTokens详情:',
                                        saveData.userTokens.map((t) => ({
                                          username: t.username,
                                          devicesCount: t.devices?.length || 0,
                                          devices: t.devices,
                                        })),
                                      );
                                      const response = await fetch(
                                        '/api/admin/tvbox-security',
                                        {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                          },
                                          body: JSON.stringify(saveData),
                                        },
                                      );

                                      if (response.ok) {
                                        showSuccess('设备已解绑');
                                        // 延迟一下再加载配置，确保缓存清除
                                        setTimeout(async () => {
                                          await loadConfig();
                                        }, 500);
                                      } else {
                                        const errorData = await response.json();
                                        logger.error('解绑失败:', errorData);
                                        showError(
                                          errorData.error || '解绑失败',
                                        );
                                      }
                                    }}
                                    className='text-xs px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-700 dark:text-red-300 rounded transition-colors'
                                    title='解绑设备'
                                  >
                                    解绑
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                    <svg
                      className='mx-auto h-12 w-12 text-gray-400'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                      />
                    </svg>
                    <p className='text-sm'>暂无绑定设备</p>
                    <p className='text-xs mt-1'>
                      用户使用Token后会自动绑定设备
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 配置生成器 */}
        <div className='bg-teal-50 dark:bg-teal-900/30 border rounded-lg p-6 border-teal-200 dark:border-teal-700'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4'>
            配置生成器
          </h3>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                配置模式
              </label>
              <select
                value={configMode}
                onChange={(e) =>
                  setConfigMode(
                    e.target.value as
                      | 'standard'
                      | 'safe'
                      | 'fast'
                      | 'yingshicang',
                  )
                }
                className='w-full px-3 py-2 border border-teal-300 dark:border-teal-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              >
                <option value='standard'>标准模式</option>
                <option value='safe'>安全模式</option>
                <option value='fast'>快速模式</option>
                <option value='yingshicang'>影视仓模式</option>
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                输出格式
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'json' | 'base64')}
                className='w-full px-3 py-2 border border-teal-300 dark:border-teal-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              >
                <option value='json'>JSON</option>
                <option value='base64'>Base64</option>
              </select>
            </div>
          </div>

          <div className='bg-teal-50 dark:bg-teal-800 rounded-lg p-4'>
            <div className='flex items-center justify-between mb-2'>
              <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                生成的URL
              </label>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(generateExampleURL())
                }
                className='text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors'
              >
                <Copy className='w-4 h-4' />
              </button>
            </div>
            <code className='text-xs text-gray-600 dark:text-gray-400 break-all'>
              {generateExampleURL()}
            </code>
          </div>

          {/* 操作按钮组 */}
          <div className='flex flex-wrap gap-2 mt-4'>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open(generateExampleURL(), '_blank');
                }
              }}
              className='flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors'
            >
              <ExternalLink size={16} />
              <span>测试访问</span>
            </button>

            <button
              onClick={handleDiagnose}
              disabled={isLoading('diagnoseTVBox')}
              className='flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50'
            >
              <BarChart3 size={16} />
              <span>
                {isLoading('diagnoseTVBox') ? '诊断中...' : '配置诊断'}
              </span>
            </button>

            <button
              onClick={handleRefreshJar}
              disabled={refreshingJar}
              className='flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50'
            >
              <RefreshCw
                className={refreshingJar ? 'animate-spin' : ''}
                size={16}
              />
              <span>{refreshingJar ? '刷新中...' : '刷新JAR'}</span>
            </button>

            <button
              onClick={handleSmartHealthCheck}
              disabled={smartHealthLoading}
              className='flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50'
            >
              <Heart
                className={smartHealthLoading ? 'animate-pulse' : ''}
                size={16}
              />
              <span>{smartHealthLoading ? '检查中...' : '健康检查'}</span>
            </button>

            <button
              onClick={handleJarFix}
              disabled={jarFixLoading}
              className='flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50'
            >
              <RefreshCw
                className={jarFixLoading ? 'animate-spin' : ''}
                size={16}
              />
              <span>{jarFixLoading ? '检测中...' : '源修复'}</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isLoading('saveTVBoxConfig')}
              className='flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50'
            >
              <Save size={16} />
              <span>
                {isLoading('saveTVBoxConfig') ? '保存中...' : '保存配置'}
              </span>
            </button>
          </div>
        </div>

        {/* 诊断结果 */}
        {showDiagnoseResult && diagnoseResult && (
          <div className='bg-white dark:bg-gray-800 border rounded-lg p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                诊断结果
              </h3>
              <button
                onClick={() => setShowDiagnoseResult(false)}
                className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              >
                <XCircle className='w-5 h-5' />
              </button>
            </div>

            <div
              className={`p-4 rounded-lg ${diagnoseResult.pass ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'}`}
            >
              <div className='flex items-center gap-2 mb-2'>
                {diagnoseResult.pass ? (
                  <CheckCircle className='text-green-500' size={20} />
                ) : (
                  <XCircle className='text-red-500' size={20} />
                )}
                <span
                  className={`font-medium ${diagnoseResult.pass ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}
                >
                  {diagnoseResult.pass ? '诊断通过' : '发现问题'}
                </span>
              </div>

              {diagnoseResult.issues && diagnoseResult.issues.length > 0 && (
                <ul className='mt-2 space-y-1 text-sm text-red-600 dark:text-red-400'>
                  {diagnoseResult.issues.map((issue: string, index: number) => (
                    <li key={index}>• {issue}</li>
                  ))}
                </ul>
              )}

              {diagnoseResult.recommendations &&
                diagnoseResult.recommendations.length > 0 && (
                  <div className='mt-3'>
                    <p className='text-sm font-medium text-blue-700 dark:text-blue-300 mb-1'>
                      建议：
                    </p>
                    <ul className='space-y-1 text-sm text-blue-600 dark:text-blue-400'>
                      {diagnoseResult.recommendations.map(
                        (rec: string, index: number) => (
                          <li key={index}>• {rec}</li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* 智能健康检查结果 */}
        {smartHealthResult && (
          <div className='bg-white dark:bg-gray-800 border rounded-lg p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                智能健康检查结果
              </h3>
              <button
                onClick={() => setSmartHealthResult(null)}
                className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              >
                <XCircle className='w-5 h-5' />
              </button>
            </div>

            {smartHealthResult.success ? (
              <div className='space-y-4'>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div className='text-center'>
                    <div
                      className={`text-2xl font-bold ${
                        smartHealthResult.status.overall === 'excellent'
                          ? 'text-green-600'
                          : smartHealthResult.status.overall === 'good'
                            ? 'text-blue-600'
                            : 'text-yellow-600'
                      }`}
                    >
                      {smartHealthResult.status.overall === 'excellent'
                        ? '优秀'
                        : smartHealthResult.status.overall === 'good'
                          ? '良好'
                          : '需要关注'}
                    </div>
                    <div className='text-sm text-gray-500'>整体状态</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-blue-600'>
                      {smartHealthResult.reachability.health_score}%
                    </div>
                    <div className='text-sm text-gray-500'>健康分数</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-purple-600'>
                      {smartHealthResult.executionTime}ms
                    </div>
                    <div className='text-sm text-gray-500'>执行时间</div>
                  </div>
                </div>

                {smartHealthResult.recommendations.length > 0 && (
                  <div>
                    <h4 className='font-medium text-gray-900 dark:text-gray-100 mb-2'>
                      优化建议
                    </h4>
                    <ul className='space-y-1 text-sm text-gray-600 dark:text-gray-400'>
                      {smartHealthResult.recommendations.map((rec, index) => (
                        <li key={index}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className='p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg'>
                <p className='text-red-600 dark:text-red-400'>
                  {smartHealthResult.error}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 源修复结果 */}
        {showJarFixResult && jarFixResult && (
          <div className='bg-white dark:bg-gray-800 border rounded-lg p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                JAR源修复检测结果
              </h3>
              <button
                onClick={() => setShowJarFixResult(false)}
                className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              >
                <XCircle className='w-5 h-5' />
              </button>
            </div>

            {jarFixResult.success ? (
              <div className='space-y-4'>
                {/* 测试结果概览 */}
                <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-blue-600'>
                      {jarFixResult.summary.total_tested}
                    </div>
                    <div className='text-sm text-gray-500'>测试源数</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-green-600'>
                      {jarFixResult.summary.successful}
                    </div>
                    <div className='text-sm text-gray-500'>可用源</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-red-600'>
                      {jarFixResult.summary.failed}
                    </div>
                    <div className='text-sm text-gray-500'>失败源</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-purple-600'>
                      {Math.round(jarFixResult.summary.avg_response_time)}ms
                    </div>
                    <div className='text-sm text-gray-500'>平均响应</div>
                  </div>
                </div>

                {/* 网络环境 */}
                <div className='p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg'>
                  <p className='text-sm text-blue-700 dark:text-blue-300'>
                    检测到网络环境：
                    {jarFixResult.summary.user_region === 'domestic'
                      ? '国内'
                      : '国际'}
                  </p>
                </div>

                {/* 推荐的最佳源 */}
                {jarFixResult.recommended_sources &&
                  jarFixResult.recommended_sources.length > 0 && (
                    <div>
                      <h4 className='font-medium text-gray-900 dark:text-gray-100 mb-2'>
                        推荐的最佳源
                      </h4>
                      <div className='space-y-2'>
                        {jarFixResult.recommended_sources.map(
                          (source, index) => (
                            <div
                              key={index}
                              className='flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg'
                            >
                              <div className='flex-1'>
                                <div className='font-medium text-gray-900 dark:text-gray-100'>
                                  {source.name}
                                </div>
                                <code className='text-xs text-gray-600 dark:text-gray-400 break-all'>
                                  {source.url}
                                </code>
                              </div>
                              <div className='text-right ml-4'>
                                <div className='text-sm font-medium text-green-600'>
                                  {Math.round(source.responseTime)}ms
                                </div>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                {/* 修复建议 */}
                {jarFixResult.recommendations && (
                  <div className='space-y-3'>
                    {jarFixResult.recommendations.immediate &&
                      jarFixResult.recommendations.immediate.length > 0 && (
                        <div>
                          <h4 className='font-medium text-gray-900 dark:text-gray-100 mb-2'>
                            立即处理
                          </h4>
                          <ul className='space-y-1 text-sm text-gray-600 dark:text-gray-400'>
                            {jarFixResult.recommendations.immediate.map(
                              (rec: string, index: number) => (
                                <li key={index}>• {rec}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}

                    {jarFixResult.recommendations.configuration &&
                      jarFixResult.recommendations.configuration.length > 0 && (
                        <div>
                          <h4 className='font-medium text-gray-900 dark:text-gray-100 mb-2'>
                            配置建议
                          </h4>
                          <ul className='space-y-1 text-sm text-gray-600 dark:text-gray-400'>
                            {jarFixResult.recommendations.configuration.map(
                              (rec: string, index: number) => (
                                <li key={index}>• {rec}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}

                    {jarFixResult.recommendations.troubleshooting &&
                      jarFixResult.recommendations.troubleshooting.length >
                        0 && (
                        <div>
                          <h4 className='font-medium text-gray-900 dark:text-gray-100 mb-2'>
                            故障排查
                          </h4>
                          <ul className='space-y-1 text-sm text-gray-600 dark:text-gray-400'>
                            {jarFixResult.recommendations.troubleshooting.map(
                              (rec: string, index: number) => (
                                <li key={index}>• {rec}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                  </div>
                )}

                {/* 详细测试结果 */}
                {jarFixResult.test_results && (
                  <div>
                    <h4 className='font-medium text-gray-900 dark:text-gray-100 mb-2'>
                      详细测试结果
                    </h4>
                    <div className='space-y-2'>
                      {jarFixResult.test_results.map((result, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${
                            result.success
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                          }`}
                        >
                          <div className='flex items-center justify-between mb-1'>
                            <div className='font-medium text-gray-900 dark:text-gray-100'>
                              {result.name}
                            </div>
                            <div className='text-sm'>
                              {result.success ? (
                                <span className='text-green-600'>✓ 可用</span>
                              ) : (
                                <span className='text-red-600'>✗ 不可用</span>
                              )}
                            </div>
                          </div>
                          <code className='text-xs text-gray-600 dark:text-gray-400 break-all block mb-1'>
                            {result.url}
                          </code>
                          <div className='text-xs text-gray-500 dark:text-gray-400'>
                            -
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 修复后的配置URL */}
                {jarFixResult.fixed_config_urls &&
                  jarFixResult.fixed_config_urls.length > 0 && (
                    <div>
                      <h4 className='font-medium text-gray-900 dark:text-gray-100 mb-2'>
                        修复后的配置URL
                      </h4>
                      <div className='space-y-2'>
                        {jarFixResult.fixed_config_urls.map(
                          (url: string, index: number) => (
                            <div
                              key={index}
                              className='flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg'
                            >
                              <code className='text-xs text-gray-600 dark:text-gray-400 break-all flex-1'>
                                {url}
                              </code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(url);
                                  showSuccess('URL已复制到剪贴板');
                                }}
                                className='ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
                              >
                                <Copy className='w-4 h-4' />
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <div className='p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg'>
                <p className='text-red-600 dark:text-red-400'>
                  {jarFixResult.error}
                </p>
                {jarFixResult.emergency_recommendations && (
                  <div className='mt-3'>
                    <h4 className='font-medium text-gray-900 dark:text-gray-100 mb-2'>
                      紧急建议
                    </h4>
                    <ul className='space-y-1 text-sm text-gray-600 dark:text-gray-400'>
                      {jarFixResult.emergency_recommendations.map(
                        (rec: string, index: number) => (
                          <li key={index}>• {rec}</li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 导出组件
function TVBoxConfig() {
  return <TVBoxConfigContent />;
}

export default TVBoxConfig;
