import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { logger } from '@/lib/logger';

export type FeatureType =
  | 'ai-recommend'
  | 'disable-yellow-filter'
  | 'netdisk-search'
  | 'tmdb-actor-search';

interface FeaturePermissions {
  'ai-recommend': boolean;
  'disable-yellow-filter': boolean;
  'netdisk-search': boolean;
  'tmdb-actor-search': boolean;
}

export function useFeaturePermission() {
  const [permissions, setPermissions] = useState<FeaturePermissions>({
    'ai-recommend': false,
    'disable-yellow-filter': false,
    'netdisk-search': false,
    'tmdb-actor-search': false,
  });
  const [loading, setLoading] = useState(true);

  async function checkPermission(feature: FeatureType): Promise<boolean> {
    try {
      const authInfo = getAuthInfoFromBrowserCookie();
      if (!authInfo || !authInfo.username) {
        return false;
      }

      const timestamp = Date.now();
      const url = `/api/check-permission?feature=${feature}&_t=${timestamp}`;

      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.hasPermission || false;
      }

      return false;
    } catch (error) {
      logger.error(`[useFeaturePermission] 检查 ${feature} 权限失败:`, error);
      return false;
    }
  }

  function hasPermission(feature: FeatureType): boolean {
    return permissions[feature];
  }

  async function refreshPermissions() {
    setLoading(true);
    try {
      const features: FeatureType[] = [
        'ai-recommend',
        'disable-yellow-filter',
        'netdisk-search',
        'tmdb-actor-search',
      ];

      const results = await Promise.all(
        features.map(async (feature) => {
          const hasPermission = await checkPermission(feature);
          return { feature, hasPermission };
        }),
      );

      const newPermissions: Partial<FeaturePermissions> = {};
      results.forEach(({ feature, hasPermission }) => {
        newPermissions[feature] = hasPermission;
      });

      setPermissions((prev) => ({
        ...prev,
        ...newPermissions,
      }));
    } catch (error) {
      logger.error('[useFeaturePermission] 刷新权限失败:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadPermissions() {
      setLoading(true);
      try {
        const features: FeatureType[] = [
          'ai-recommend',
          'disable-yellow-filter',
          'netdisk-search',
          'tmdb-actor-search',
        ];

        const results = await Promise.all(
          features.map(async (feature) => {
            const hasPermission = await checkPermission(feature);
            return { feature, hasPermission };
          }),
        );

        const newPermissions: Partial<FeaturePermissions> = {};
        results.forEach(({ feature, hasPermission }) => {
          newPermissions[feature] = hasPermission;
        });

        setPermissions((prev) => ({
          ...prev,
          ...newPermissions,
        }));
      } catch (error) {
        logger.error('[useFeaturePermission] 刷新权限失败:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPermissions();
  }, []);

  // 使用 ref 存储最新的 refreshPermissions 函数
  const refreshPermissionsRef = useRef(refreshPermissions);

  // 每次 refreshPermissions 更新时同步到 ref
  useEffect(() => {
    refreshPermissionsRef.current = refreshPermissions;
  });

  // 监听配置更新事件，重新检查权限
  useLayoutEffect(() => {
    const handleConfigUpdate = () => {
      refreshPermissionsRef.current();
    };

    // 同时注册捕获阶段和冒泡阶段监听器，确保能捕获事件
    window.addEventListener('vidora-config-update', handleConfigUpdate, true);
    window.addEventListener('vidora-config-update', handleConfigUpdate);

    // 开发环境下：测试事件监听器
    let testEventHandler: ((event: Event) => void) | null = null;
    if (process.env.NODE_ENV === 'development') {
      testEventHandler = () => {};
      window.addEventListener('vidora-config-test', testEventHandler);

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('vidora-config-test'));
      }, 500);
    }

    return () => {
      window.removeEventListener(
        'vidora-config-update',
        handleConfigUpdate,
        true,
      );
      window.removeEventListener('vidora-config-update', handleConfigUpdate);

      if (testEventHandler) {
        window.removeEventListener('vidora-config-test', testEventHandler);
      }
    };
  }, []);

  return {
    permissions,
    hasPermission,
    loading,
    refreshPermissions,
  };
}
