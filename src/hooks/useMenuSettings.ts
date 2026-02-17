import { useCallback, useEffect, useState } from 'react';

import {
  getMenuSettings,
  updateMenuSettings as updateMenuSettingsGlobal,
} from '@/lib/global-config';

import { MenuSettings } from '@/types/menu';
import { menuLabels } from '@/types/menu';

const menuSettings = getMenuSettings();

export function useMenuSettings() {
  const [currentSettings, setCurrentSettings] =
    useState<MenuSettings>(menuSettings);

  useEffect(() => {
    const handleConfigUpdate = () => {
      const newSettings = getMenuSettings();
      setCurrentSettings(newSettings);
    };

    window.addEventListener('vidora-config-update', handleConfigUpdate);

    return () => {
      window.removeEventListener('vidora-config-update', handleConfigUpdate);
    };
  }, []);

  const updateMenuSettings = (newSettings: Partial<typeof menuSettings>) => {
    updateMenuSettingsGlobal(newSettings);
    setCurrentSettings(getMenuSettings()); // 立即更新本地状态
  };

  const toggleMenu = (menuKey: keyof typeof menuSettings) => {
    const newSettings = {
      ...menuSettings,
      [menuKey]: !menuSettings[menuKey],
    };
    updateMenuSettingsGlobal(newSettings);
    setCurrentSettings(newSettings);

    // 触发自定义事件，通知其他组件更新
    window.dispatchEvent(
      new CustomEvent('vidora-config-update', {
        bubbles: true,
        composed: true,
        detail: { menuSettings: newSettings },
      }),
    );
  };

  const setMenuEnabled = (
    menuKey: keyof typeof menuSettings,
    enabled: boolean,
  ) => {
    const newSettings = { ...menuSettings, [menuKey]: enabled };
    updateMenuSettingsGlobal(newSettings);
    setCurrentSettings(newSettings);

    // 触发自定义事件，通知其他组件更新
    window.dispatchEvent(
      new CustomEvent('vidora-config-update', {
        bubbles: true,
        composed: true,
        detail: { menuSettings: newSettings },
      }),
    );
  };

  const resetToDefaults = useCallback(() => {
    const defaults: MenuSettings = {
      showMovies: true,
      showTVShows: true,
      showAnime: true,
      showVariety: true,
      showLive: false,
      showTvbox: false,
      showShortDrama: false,
    };
    updateMenuSettingsGlobal(defaults);
    setCurrentSettings(defaults);

    // 触发自定义事件，通知其他组件更新
    window.dispatchEvent(
      new CustomEvent('vidora-config-update', {
        bubbles: true,
        composed: true,
        detail: { menuSettings: defaults },
      }),
    );
  }, []);

  const isMenuEnabled = (menuKey: keyof MenuSettings): boolean => {
    return currentSettings[menuKey];
  };

  const getEnabledMenus = useCallback(() => {
    return Object.entries(currentSettings)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key as keyof MenuSettings);
  }, [currentSettings]);

  const getDisabledMenus = useCallback(() => {
    return Object.entries(currentSettings)
      .filter(([, enabled]) => !enabled)
      .map(([key]) => key as keyof MenuSettings);
  }, [currentSettings]);

  return {
    menuSettings: currentSettings,
    updateMenuSettings,
    toggleMenu,
    setMenuEnabled,
    resetToDefaults,
    isMenuEnabled,
    getEnabledMenus,
    getDisabledMenus,
    menuLabels,
  };
}
