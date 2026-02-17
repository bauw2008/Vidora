import { useEffect, useState } from 'react';

/**
 * 用户设置配置项的类型定义
 */
interface UserSettings {
  defaultAggregateSearch: boolean;
  doubanProxyUrl: string;
  enableOptimization: boolean;
  fluidSearch: boolean;
  liveDirectConnect: boolean;
  doubanDataSource: string;
  doubanImageProxyType: string;
  doubanImageProxyUrl: string;
  enableNotifications: boolean;
}

/**
 * 从 localStorage 读取用户设置
 */
const loadSettingsFromStorage = (): Partial<UserSettings> => {
  if (typeof window === 'undefined') return {};

  const settings: Partial<UserSettings> = {};

  // 读取并解析每个设置项
  const aggregateSearch = localStorage.getItem('defaultAggregateSearch');
  if (aggregateSearch !== null) {
    settings.defaultAggregateSearch = JSON.parse(aggregateSearch);
  }

  const doubanProxyUrl = localStorage.getItem('doubanProxyUrl');
  if (doubanProxyUrl !== null) {
    settings.doubanProxyUrl = doubanProxyUrl;
  }

  const enableOptimization = localStorage.getItem('enableOptimization');
  if (enableOptimization !== null) {
    settings.enableOptimization = JSON.parse(enableOptimization);
  }

  const fluidSearch = localStorage.getItem('fluidSearch');
  if (fluidSearch !== null) {
    settings.fluidSearch = JSON.parse(fluidSearch);
  }

  const liveDirectConnect = localStorage.getItem('liveDirectConnect');
  if (liveDirectConnect !== null) {
    settings.liveDirectConnect = JSON.parse(liveDirectConnect);
  }

  const doubanDataSource = localStorage.getItem('doubanDataSource');
  if (doubanDataSource !== null) {
    settings.doubanDataSource = doubanDataSource;
  }

  const doubanImageProxyType = localStorage.getItem('doubanImageProxyType');
  if (doubanImageProxyType !== null) {
    settings.doubanImageProxyType = doubanImageProxyType;
  }

  const doubanImageProxyUrl = localStorage.getItem('doubanImageProxyUrl');
  if (doubanImageProxyUrl !== null) {
    settings.doubanImageProxyUrl = doubanImageProxyUrl;
  }

  const enableNotifications = localStorage.getItem('enableNotifications');
  if (enableNotifications !== null) {
    settings.enableNotifications = JSON.parse(enableNotifications);
  }

  return settings;
};

/**
 * 保存设置到 localStorage
 */
const saveSettingToStorage = <K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K],
): void => {
  if (typeof window === 'undefined') return;

  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  localStorage.setItem(key, stringValue);
};

/**
 * 获取运行时配置的默认值
 */
const getRuntimeDefaults = (): UserSettings => {
  if (typeof window === 'undefined') {
    // 服务器端返回硬编码的默认值
    return {
      defaultAggregateSearch: true,
      doubanProxyUrl: '',
      enableOptimization: false,
      fluidSearch: true,
      liveDirectConnect: false,
      doubanDataSource: 'direct',
      doubanImageProxyType: 'direct',
      doubanImageProxyUrl: '',
      enableNotifications: true,
    };
  }

  const runtimeConfig = (window as Window).RUNTIME_CONFIG || {};
  return {
    defaultAggregateSearch: true,
    doubanProxyUrl: runtimeConfig.DOUBAN_PROXY || '',
    enableOptimization: false,
    fluidSearch: runtimeConfig.FLUID_SEARCH !== false,
    liveDirectConnect: false,
    doubanDataSource: runtimeConfig.DOUBAN_PROXY_TYPE || 'direct',
    doubanImageProxyType: runtimeConfig.DOUBAN_IMAGE_PROXY_TYPE || 'direct',
    doubanImageProxyUrl: runtimeConfig.DOUBAN_IMAGE_PROXY || '',
    enableNotifications: true,
  };
};

/**
 * 自定义 hook：管理用户设置
 * 统一处理 localStorage 的读取和写入
 */
export const useUserSettings = () => {
  // 先初始化默认值
  const [settings, setSettings] = useState<UserSettings>(getRuntimeDefaults());
  const [isInitialized, setIsInitialized] = useState(false);

  // 客户端初始化时读取 localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || isInitialized) return;

    const storedSettings = loadSettingsFromStorage();
    const runtimeDefaults = getRuntimeDefaults();

    // 合并存储的值和默认值
    const mergedSettings: UserSettings = {
      defaultAggregateSearch:
        storedSettings.defaultAggregateSearch ??
        runtimeDefaults.defaultAggregateSearch,
      doubanProxyUrl:
        storedSettings.doubanProxyUrl ?? runtimeDefaults.doubanProxyUrl,
      enableOptimization:
        storedSettings.enableOptimization ?? runtimeDefaults.enableOptimization,
      fluidSearch: storedSettings.fluidSearch ?? runtimeDefaults.fluidSearch,
      liveDirectConnect:
        storedSettings.liveDirectConnect ?? runtimeDefaults.liveDirectConnect,
      doubanDataSource:
        storedSettings.doubanDataSource ?? runtimeDefaults.doubanDataSource,
      doubanImageProxyType:
        storedSettings.doubanImageProxyType ??
        runtimeDefaults.doubanImageProxyType,
      doubanImageProxyUrl:
        storedSettings.doubanImageProxyUrl ??
        runtimeDefaults.doubanImageProxyUrl,
      enableNotifications:
        storedSettings.enableNotifications ??
        runtimeDefaults.enableNotifications,
    };

    // 使用 requestAnimationFrame 来延迟 setState 调用
    requestAnimationFrame(() => {
      setSettings(mergedSettings);
      setIsInitialized(true);
    });
  }, [isInitialized]);

  // 更新单个设置的函数
  const updateSetting = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) => {
    setSettings((prev) => {
      const newSettings = { ...prev, [key]: value };
      saveSettingToStorage(key, value);
      return newSettings;
    });
  };

  // 重置所有设置
  const resetSettings = () => {
    const newSettings = getRuntimeDefaults();
    setSettings(newSettings);

    // 清除所有 localStorage 项
    if (typeof window !== 'undefined') {
      const keys: (keyof UserSettings)[] = [
        'defaultAggregateSearch',
        'doubanProxyUrl',
        'enableOptimization',
        'fluidSearch',
        'liveDirectConnect',
        'doubanDataSource',
        'doubanImageProxyType',
        'doubanImageProxyUrl',
        'enableNotifications',
      ];

      keys.forEach((key) => {
        localStorage.removeItem(key);
      });
    }
  };

  return {
    settings,
    updateSetting,
    resetSettings,
  };
};
