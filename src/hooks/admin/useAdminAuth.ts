import { useEffect, useState } from 'react';

interface AdminAuthState {
  // 权限信息
  role: 'owner' | 'admin' | null;
  username: string | null;

  // 状态信息
  loading: boolean;
  error: string | null;

  // 便捷属性
  isAdminOrOwner: boolean;
  isOwner: boolean;
  isAdmin: boolean;

  // 权限检查方法
  hasPermission: (requiredRole: 'owner' | 'admin') => boolean;
  canManageUser: (targetUser: { username: string; role: string }) => boolean;
}

export const useAdminAuth = (): AdminAuthState => {
  const [state, setState] = useState<AdminAuthState>({
    role: null,
    username: null,
    loading: true,
    error: null,
    isAdminOrOwner: false,
    isOwner: false,
    isAdmin: false,
    hasPermission: () => false,
    canManageUser: () => false,
  });

  useEffect(() => {
    // 每次组件挂载时都验证权限
    const verifyAuth = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await fetch('/api/admin/config', {
          // 添加缓存控制，确保获取最新数据
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('无权限访问');
          }
          throw new Error(`验证失败: ${response.status}`);
        }

        const data = await response.json();
        const role = data.Role || null;
        const username = data.Username || null;

        setState({
          role,
          username,
          loading: false,
          error: null,
          isAdminOrOwner: role === 'admin' || role === 'owner',
          isOwner: role === 'owner',
          isAdmin: role === 'admin',
          hasPermission: (requiredRole) => {
            if (!role) return false;
            if (requiredRole === 'owner') return role === 'owner';
            if (requiredRole === 'admin')
              return role === 'admin' || role === 'owner';
            return false;
          },
          canManageUser: (targetUser) => {
            // 站长可以管理所有用户
            if (role === 'owner') return true;
            // 管理员需要有用户名
            if (!username) return false;
            if (role === 'admin') {
              return (
                targetUser.role === 'user' || targetUser.username === username
              );
            }
            return false;
          },
        });
      } catch (error) {
        setState({
          role: null,
          username: null,
          loading: false,
          error: error instanceof Error ? error.message : '验证失败',
          isAdminOrOwner: false,
          isOwner: false,
          isAdmin: false,
          hasPermission: () => false,
          canManageUser: () => false,
        });
      }
    };

    verifyAuth();
  }, []);

  return state;
};
