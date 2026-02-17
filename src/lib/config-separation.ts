/**
 * 检查用户是否有18+过滤豁免权限
 * @param config 配置对象
 * @param username 用户名
 * @returns true=有豁免权限（不过滤），false=需要过滤
 */

interface UserFeatures {
  disableYellowFilter?: boolean;
  aiEnabled?: boolean;
  netDiskSearchEnabled?: boolean;
  tmdbActorSearchEnabled?: boolean;
}

interface User {
  username: string;
  role: 'owner' | 'admin' | 'user';
  features?: UserFeatures;
  tags?: string[];
}

interface Tag {
  name: string;
  disableYellowFilter?: boolean;
  aiEnabled?: boolean;
  netDiskSearchEnabled?: boolean;
  tmdbActorSearchEnabled?: boolean;
}

interface UserConfig {
  Users?: User[];
  Tags?: Tag[];
}

interface SiteConfig {
  DisableYellowFilter?: boolean;
  EnableTMDBActorSearch?: boolean;
}

interface AIConfig {
  enabled?: boolean;
}

interface NetDiskConfig {
  enabled?: boolean;
}

interface Config {
  SiteConfig?: SiteConfig;
  UserConfig?: UserConfig;
  AIConfig?: AIConfig;
  NetDiskConfig?: NetDiskConfig;
}

export function shouldApplyYellowFilter(
  config: Config,
  username: string,
): boolean {
  // 1. 检查全局开关（优先级最高）
  if (config.SiteConfig?.DisableYellowFilter) {
    return false; // 全局关闭，所有人都不过滤
  }

  // 2. 检查用户配置
  const userConfig = config.UserConfig?.Users?.find(
    (u: User) => u.username === username,
  );
  if (!userConfig) {
    return true; // 新用户默认过滤
  }

  // 3. 站长和管理员有豁免权限
  if (userConfig.role === 'owner' || userConfig.role === 'admin') {
    return false;
  }

  // 4. 检查用户features权限
  if (userConfig.features?.disableYellowFilter) {
    return false;
  }

  // 5. 检查用户组权限
  if (userConfig.tags) {
    for (const tagName of userConfig.tags) {
      const tagConfig = config.UserConfig?.Tags?.find(
        (t: Tag) => t.name === tagName,
      );
      // 检查用户组是否有18+权限
      if (tagConfig?.disableYellowFilter) {
        return false;
      }
    }
    // 如果用户属于某个组，但该组没有18+权限，则过滤
    // 这实现了用户组级别的控制
  }

  // 6. 默认需要过滤
  return true;
}

/**
 * 检查用户是否有AI功能权限
 * @param config 配置对象
 * @param username 用户名
 * @returns true=有权限，false=无权限
 */
export function hasAIPermission(config: Config, username: string): boolean {
  // 1. 检查全局AI开关（优先级最高）
  if (!config.AIConfig?.enabled) {
    return false; // 全局关闭，所有人都不能用
  }

  // 2. 检查用户配置
  const userConfig = config.UserConfig?.Users?.find(
    (u: User) => u.username === username,
  );
  if (!userConfig) {
    return false; // 新用户默认无权限
  }

  // 3. 站长和管理员默认有权限
  if (userConfig.role === 'owner' || userConfig.role === 'admin') {
    return true;
  }

  // 4. 检查用户features权限
  if (userConfig.features?.aiEnabled) {
    return true;
  }

  // 5. 检查用户组权限
  if (userConfig.tags) {
    for (const tagName of userConfig.tags) {
      const tagConfig = config.UserConfig?.Tags?.find(
        (t: Tag) => t.name === tagName,
      );
      // 检查用户组是否有AI权限
      if (tagConfig?.aiEnabled) {
        return true;
      }
    }
    // 如果用户属于某个组，但该组没有AI权限，则无权限
    // 这实现了用户组级别的控制
  }

  // 6. 默认无权限
  return false;
}

/**
 * 检查用户是否有网盘搜索功能权限
 * @param config 配置对象
 * @param username 用户名
 * @returns true=有权限，false=无权限
 */
export function hasNetDiskSearchPermission(
  config: Config,
  username: string,
): boolean {
  // 1. 检查全局网盘搜索开关（优先级最高）
  if (!config.NetDiskConfig?.enabled) {
    return false; // 全局关闭，所有人都不能用
  }

  // 2. 检查用户配置
  const userConfig = config.UserConfig?.Users?.find(
    (u: User) => u.username === username,
  );
  if (!userConfig) {
    return false; // 新用户默认无权限
  }

  // 3. 站长和管理员默认有权限
  if (userConfig.role === 'owner' || userConfig.role === 'admin') {
    return true;
  }

  // 4. 检查用户features权限
  if (userConfig.features?.netDiskSearchEnabled) {
    return true;
  }

  // 5. 检查用户组权限
  if (userConfig.tags) {
    for (const tagName of userConfig.tags) {
      const tagConfig = config.UserConfig?.Tags?.find(
        (t: Tag) => t.name === tagName,
      );
      // 检查用户组是否有网盘搜索权限
      if (tagConfig?.netDiskSearchEnabled) {
        return true;
      }
    }
    // 如果用户属于某个组，但该组没有网盘搜索权限，则无权限
    // 这实现了用户组级别的控制
  }

  // 6. 默认无权限
  return false;
}

/**
 * 检查用户是否有TMDB演员搜索功能权限
 * @param config 配置对象
 * @param username 用户名
 * @returns true=有权限，false=无权限
 */
export function hasTmdbActorSearchPermission(
  config: Config,
  username: string,
): boolean {
  // 1. 检查全局TMDB演员搜索开关（优先级最高）
  if (!config.SiteConfig?.EnableTMDBActorSearch) {
    return false; // 全局关闭，所有人都不能用
  }

  // 2. 检查用户配置
  const userConfig = config.UserConfig?.Users?.find(
    (u: User) => u.username === username,
  );
  if (!userConfig) {
    return false; // 新用户默认无权限
  }

  // 3. 站长和管理员默认有权限
  if (userConfig.role === 'owner' || userConfig.role === 'admin') {
    return true;
  }

  // 4. 检查用户features权限
  if (userConfig.features?.tmdbActorSearchEnabled) {
    return true;
  }

  // 5. 检查用户组权限
  if (userConfig.tags) {
    for (const tagName of userConfig.tags) {
      const tagConfig = config.UserConfig?.Tags?.find(
        (t: Tag) => t.name === tagName,
      );
      // 检查用户组是否有TMDB演员搜索权限
      if (tagConfig?.tmdbActorSearchEnabled) {
        return true;
      }
    }
    // 如果用户属于某个组，但该组没有TMDB演员搜索权限，则无权限
    // 这实现了用户组级别的控制
  }

  // 6. 默认无权限
  return false;
}
