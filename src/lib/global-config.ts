/**
 * 全局配置管理工具函数
 * 操作 window.RUNTIME_CONFIG
 *
 * 简化版本：
 * - 移除 syncToServer() 函数
 * - 移除 localStorage 同步机制
 * - 移除页面可见性监听
 * - 简化 notifyConfigUpdated() 函数
 */

import { MenuSettings } from '@/types/menu';

export interface CustomCategory {
  name: string;
  type: 'movie' | 'tv';
  query: string;
  disabled: boolean;
  from: string;
}

export interface NetDiskConfig {
  enabled: boolean;
  pansouUrl?: string;
  timeout?: number;
  enabledCloudTypes?: string[];
}

export interface AIConfig {
  enabled: boolean;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface TMDBConfig {
  enableActorSearch: boolean;
  enablePosters?: boolean;
  apiKey?: string;
  language?: string;
}

export interface RuntimeConfig {
  STORAGE_TYPE: string;
  DOUBAN_PROXY_TYPE?: string;
  DOUBAN_PROXY?: string;
  DOUBAN_IMAGE_PROXY_TYPE?: string;
  DOUBAN_IMAGE_PROXY?: string;
  DISABLE_YELLOW_FILTER?: boolean;
  CUSTOM_CATEGORIES: CustomCategory[];
  FLUID_SEARCH?: boolean;
  NetDiskConfig?: NetDiskConfig;
  AIConfig?: AIConfig;
  TMDBConfig?: TMDBConfig;
  MenuSettings: MenuSettings;
  SiteName?: string;
  __DISABLED_MENUS?: DisabledMenus;
}

export interface DisabledMenus {
  showLive: boolean;
  showTvbox: boolean;
  showShortDrama: boolean;
  showMovies: boolean;
  showTVShows: boolean;
  showAnime: boolean;
  showVariety: boolean;
}

// 扩展 Window 接口
declare global {
  interface Window {
    RUNTIME_CONFIG?: Partial<RuntimeConfig> & {
      STORAGE_TYPE?: 'localstorage' | 'redis' | 'upstash' | 'kvrocks';
    };
    __DISABLED_MENUS: DisabledMenus;
  }
}

// 获取全局运行时配置
export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') {
    // 服务端渲染时返回默认值
    return {
      STORAGE_TYPE: 'localstorage',
      CUSTOM_CATEGORIES: [],
      NetDiskConfig: {
        enabled: false,
        pansouUrl: 'https://so.252035.xyz',
        timeout: 30,
        enabledCloudTypes: ['baidu', 'aliyun', 'quark'],
      },
      AIConfig: {
        enabled: false,
        apiUrl: '',
        apiKey: '',
        model: '',
        temperature: 0.7,
        maxTokens: 3000,
      },
      TMDBConfig: {
        enableActorSearch: false,
        enablePosters: false,
        apiKey: '',
        language: 'zh-CN',
      },
      MenuSettings: {
        showMovies: true,
        showTVShows: true,
        showAnime: true,
        showVariety: true,
        showLive: false,
        showTvbox: false,
        showShortDrama: false,
      },
    };
  }

  return (window.RUNTIME_CONFIG || getDefaultConfig()) as RuntimeConfig;
}

// 默认配置
function getDefaultConfig(): RuntimeConfig {
  return {
    STORAGE_TYPE: 'localstorage',
    CUSTOM_CATEGORIES: [],
    NetDiskConfig: {
      enabled: false,
      pansouUrl: 'https://so.252035.xyz',
      timeout: 30,
      enabledCloudTypes: ['baidu', 'aliyun', 'quark'],
    },
    AIConfig: {
      enabled: false,
      apiUrl: '',
      apiKey: '',
      model: '',
      temperature: 0.7,
      maxTokens: 3000,
    },
    TMDBConfig: {
      enableActorSearch: false,
      enablePosters: false,
      apiKey: '',
      language: 'zh-CN',
    },
    MenuSettings: {
      showMovies: true,
      showTVShows: true,
      showAnime: true,
      showVariety: true,
      showLive: false,
      showTvbox: false,
      showShortDrama: false,
    },
  };
}

// 获取存储类型
export function getStorageType(): string {
  return getRuntimeConfig().STORAGE_TYPE;
}

// 检查是否为服务端模式
export function isServerMode(): boolean {
  return getStorageType() !== 'localstorage';
}

// 获取菜单设置
export function getMenuSettings(): MenuSettings {
  return getRuntimeConfig().MenuSettings;
}

// 更新菜单设置
export function updateMenuSettings(newSettings: Partial<MenuSettings>): void {
  if (typeof window === 'undefined') return;

  const config = getRuntimeConfig();
  const updatedSettings = { ...config.MenuSettings, ...newSettings };

  // 更新全局配置
  window.RUNTIME_CONFIG.MenuSettings = updatedSettings;

  // 更新禁用菜单配置
  updateDisabledMenus();

  // 触发配置更新事件（仅通知组件更新，不触发同步）
  notifyConfigUpdated();
}

// 检查菜单是否启用
export function isMenuEnabled(menuKey: keyof MenuSettings): boolean {
  const settings = getMenuSettings();
  return settings[menuKey];
}

// 更新禁用菜单的全局变量
function updateDisabledMenus(): void {
  if (typeof window === 'undefined') return;

  const menuSettings = getMenuSettings();
  const disabledMenus: DisabledMenus = {
    showLive: menuSettings.showLive === false,
    showTvbox: menuSettings.showTvbox === false,
    showShortDrama: menuSettings.showShortDrama === false,
    showMovies: menuSettings.showMovies === false,
    showTVShows: menuSettings.showTVShows === false,
    showAnime: menuSettings.showAnime === false,
    showVariety: menuSettings.showVariety === false,
  };

  // 更新window.__DISABLED_MENUS供页面访问权限检查使用
  window.__DISABLED_MENUS = disabledMenus;

  // 同时更新RUNTIME_CONFIG中的配置
  if (window.RUNTIME_CONFIG) {
    window.RUNTIME_CONFIG.__DISABLED_MENUS = disabledMenus;
  }
}

// 获取自定义分类
export function getCustomCategories(): CustomCategory[] {
  return getRuntimeConfig().CUSTOM_CATEGORIES || [];
}

// 更新自定义分类
export function updateCustomCategories(categories: CustomCategory[]): void {
  if (typeof window === 'undefined') return;

  // 更新全局配置
  window.RUNTIME_CONFIG.CUSTOM_CATEGORIES = categories;

  // 触发配置更新事件
  notifyConfigUpdated();
}

// 简化的配置更新通知
// 只触发自定义事件，不进行 localStorage 同步或服务器同步
export async function notifyConfigUpdated(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  // 触发自定义事件供组件监听
  const event = new CustomEvent('vidora-config-update', {
    bubbles: true,
    composed: true,
  });
  window.dispatchEvent(event);
}

// 初始化配置监听（简化版）
// 只初始化禁用菜单配置，移除 storage 和 visibility 监听
export function initConfigListener(): () => void {
  if (typeof window === 'undefined') return () => {};

  // 初始化禁用菜单配置
  updateDisabledMenus();

  // 返回空的清理函数
  return () => {};
}
