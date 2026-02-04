import { MenuSettings } from '@/types/menu';

export interface AdminConfig {
  ConfigSubscribtion: {
    URL: string;
    AutoUpdate: boolean;
    LastCheck: string;
  };
  ConfigFile: string;
  SiteConfig: {
    SiteName: string;
    Announcement: string;
    SearchDownstreamMaxPage: number;
    SiteInterfaceCacheTime: number;
    DoubanProxyType: string;
    DoubanProxy: string;
    DoubanImageProxyType: string;
    DoubanImageProxy: string;
    DisableYellowFilter: boolean;
    FluidSearch: boolean;
    // TMDB配置
    TMDBApiKey?: string;
    TMDBLanguage?: string;
    EnableTMDBActorSearch?: boolean;
    EnableTMDBPosters?: boolean;
    MaxUsers?: number; // 最大用户数限制
    MenuSettings: MenuSettings;
    CustomAdFilterVersion?: number; // 自定义去广告代码版本号
  };
  YellowWords?: string[]; // 18+内容过滤词
  UserConfig: {
    AllowRegister?: boolean; // 是否允许用户注册，默认 true
    AutoCleanupInactiveUsers?: boolean; // 是否自动清理非活跃用户，默认 false
    InactiveUserDays?: number; // 非活跃用户保留天数，默认 7
    RequireApproval?: boolean; // 是否需要注册审核，默认 false
    PendingUsers?: {
      username: string;
      reason?: string;
      encryptedPassword?: string; // 加密后的密码，审批通过时解密
      appliedAt: string; // ISO 时间
      createdAt?: number; // 申请时间
    }[]; // 待审核用户队列
    Users: {
      username: string;
      password?: string; // 加密密码
      role: 'user' | 'admin' | 'owner';
      enabled?: boolean; // 用户是否启用
      banned?: boolean;
      videoSources?: string[]; // 用户直接配置的视频源
      features?: {
        // 用户直接配置的功能开关
        aiEnabled?: boolean;
        disableYellowFilter?: boolean;
        netDiskSearchEnabled?: boolean;
        tmdbActorSearchEnabled?: boolean;
      };
      tags?: string[]; // 多 tags 取并集限制
      createdAt?: number; // 创建时间（可选）
      permissionVersion?: number; // 权限版本号，用于缓存失效
      videoSourcesInherited?: boolean; // videoSources是否继承自用户组
      userGroup?: string; // 用户组
      lastLoginTime?: number; // 最后登录时间（时间戳）
      lastLoginAt?: string; // 最后登录时间（ISO字符串）
    }[];
    Tags?: Array<{
      name: string;
      videoSources: string[]; // 用户组的视频源配置
      disableYellowFilter?: boolean;
      aiEnabled?: boolean;
      netDiskSearchEnabled?: boolean;
      tmdbActorSearchEnabled?: boolean;
    }>;
  };
  SourceConfig: {
    key: string;
    name: string;
    api: string;
    detail?: string;
    from: 'config' | 'custom';
    disabled?: boolean;
    requiresAuth?: boolean;
  }[];
  CustomCategories: {
    name?: string;
    type: 'movie' | 'tv';
    query: string;
    from: 'config' | 'custom';
    disabled?: boolean;
  }[];
  LiveConfig?: {
    key: string;
    name: string;
    url: string; // m3u 地址
    ua?: string;
    epg?: string; // 节目单
    from: 'config' | 'custom';
    channelNumber?: number;
    disabled?: boolean;
  }[];
  NetDiskConfig?: {
    enabled: boolean; // 是否启用网盘搜索
    pansouUrl: string; // PanSou服务地址
    timeout: number; // 请求超时时间(秒)
    enabledCloudTypes: string[]; // 启用的网盘类型
  };
  AIRecommendConfig?: {
    enabled: boolean; // 是否启用AI推荐功能
    apiUrl: string; // OpenAI兼容API地址
    apiKey: string; // API密钥
    model: string; // 模型名称
    temperature: number; // 温度参数 0-2
    maxTokens: number; // 最大token数
  };
  TVBoxSecurityConfig?: {
    enableAuth: boolean;
    token?: string;
    enableRateLimit: boolean;
    rateLimit: number;
    enableDeviceBinding: boolean;
    maxDevices: number;
    enableUserAgentWhitelist: boolean;
    allowedUserAgents: string[];
    defaultUserGroup?: string;
    currentDevices?: Array<{
      deviceId: string;
      deviceInfo: string;
      bindTime: number;
    }>;
    userTokens?: Array<{
      username: string;
      token: string;
      enabled: boolean;
      devices: Array<{
        deviceId: string;
        deviceInfo: string;
        bindTime: number;
      }>;
    }>;
    configGenerator?: {
      configMode: 'standard' | 'advanced' | 'custom';
      format: 'json' | 'txt' | 'm3u';
    };
  };
  ShortDramaConfig?: {
    apiUrl: string;
    apiKey: string;
    authEnabled: boolean;
  };
  DanmuApiConfig?: {
    enabled: boolean;
    useCustomApi: boolean;
    customApiUrl: string;
    customToken: string;
    timeout: number;
  };
}
