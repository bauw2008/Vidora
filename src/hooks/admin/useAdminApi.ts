import { useAdminLoading } from './useAdminLoading';
import { useToastNotification } from './useToastNotification';

interface AdminApiOptions {
  showSuccess?: boolean;
  showError?: boolean;
  successMessage?: string;
}

export const useAdminApi = () => {
  const { withLoading } = useAdminLoading();
  const { showSuccess } = useToastNotification();

  const callApi = async <T>(
    endpoint: string,
    options: RequestInit,
    apiOptions: AdminApiOptions = {},
  ): Promise<T> => {
    return withLoading(`api_${endpoint}`, async () => {
      const response = await fetch(endpoint, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `请求失败: ${response.status}`);
      }

      const data = await response.json();

      if (apiOptions.showSuccess) {
        showSuccess(apiOptions.successMessage || '操作成功');
      }

      return data;
    });
  };

  // 配置文件管理 API
  const configApi = {
    getConfig: () =>
      callApi('/api/admin/config', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      }),

    updateConfigFile: (
      configFile: string,
      subscriptionUrl: string,
      autoUpdate: boolean,
      lastCheckTime: string,
    ) =>
      callApi(
        '/api/admin/config_file',
        {
          method: 'POST',
          body: JSON.stringify({
            configFile,
            subscriptionUrl,
            autoUpdate,
            lastCheckTime,
          }),
        },
        { showSuccess: true, successMessage: '配置文件保存成功' },
      ),

    fetchSubscription: (url: string) =>
      callApi(
        '/api/admin/config_subscription/fetch',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        },
        { showSuccess: true, successMessage: '配置拉取成功' },
      ),

    updateShortDramaConfig: (config: {
      apiUrl: string;
      apiKey: string;
      authEnabled: boolean;
      [key: string]: string | boolean | number;
    }) =>
      callApi(
        '/api/admin/shortdrama',
        {
          method: 'POST',
          body: JSON.stringify(config),
        },
        { showSuccess: true, successMessage: '短剧配置已保存' },
      ),
  };

  // 用户管理 API
  const userApi = {
    ban: (username: string) =>
      callApi(
        '/api/admin/user',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'ban',
            targetUsername: username,
          }),
        },
        { showSuccess: true, successMessage: '用户已封禁' },
      ),

    unban: (username: string) =>
      callApi(
        '/api/admin/user',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'unban',
            targetUsername: username,
          }),
        },
        { showSuccess: true, successMessage: '用户已解封' },
      ),

    setAdmin: (username: string) =>
      callApi(
        '/api/admin/user',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'setAdmin',
            targetUsername: username,
          }),
        },
        { showSuccess: true, successMessage: '用户已设为管理员' },
      ),

    cancelAdmin: (username: string) =>
      callApi(
        '/api/admin/user',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'cancelAdmin',
            targetUsername: username,
          }),
        },
        { showSuccess: true, successMessage: '管理员权限已取消' },
      ),

    changePassword: (username: string, password: string) =>
      callApi(
        '/api/admin/user',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'changePassword',
            targetUsername: username,
            targetPassword: password,
          }),
        },
        { showSuccess: true, successMessage: '密码修改成功' },
      ),

    addUser: (username: string, password: string, userGroup?: string) =>
      callApi(
        '/api/admin/user',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'add',
            targetUsername: username,
            targetPassword: password,
            userGroup,
          }),
        },
        { showSuccess: true, successMessage: '用户添加成功' },
      ),

    deleteUser: (username: string) =>
      callApi(
        '/api/admin/user',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'deleteUser',
            targetUsername: username,
          }),
        },
        { showSuccess: true, successMessage: '用户删除成功' },
      ),

    updateUserVideoSources: (username: string, videoSources: string[]) =>
      callApi(
        '/api/admin/user',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'updateUserApis',
            targetUsername: username,
            videoSources,
          }),
        },
        { showSuccess: true, successMessage: '用户权限已更新' },
      ),

    // 用户组管理
    addUserGroup: (groupName: string, videoSources: string[]) =>
      callApi(
        '/api/admin/user',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'userGroup',
            groupAction: 'add',
            groupName,
            videoSources,
          }),
        },
        { showSuccess: true, successMessage: '用户组添加成功' },
      ),

    editUserGroup: (groupName: string, videoSources: string[]) =>
      callApi(
        '/api/admin/user',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'userGroup',
            groupAction: 'edit',
            groupName,
            videoSources,
          }),
        },
        { showSuccess: true, successMessage: '用户组更新成功' },
      ),

    deleteUserGroup: (groupName: string) =>
      callApi(
        '/api/admin/user',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'userGroup',
            groupAction: 'delete',
            groupName,
          }),
        },
        { showSuccess: true, successMessage: '用户组删除成功' },
      ),
  };

  return { callApi, configApi, userApi };
};
