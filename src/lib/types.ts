import { AdminConfig } from './admin.types';

export type { AdminConfig } from './admin.types';

// 播放记录数据结构
export interface PlayRecord {
  id: string; // 视频ID
  source: string; // 视频源
  title: string;
  source_name: string;
  cover: string;
  year: string;
  index: number; // 第几集
  total_episodes: number; // 总集数
  original_episodes?: number; // 首次观看时的原始集数
  play_time: number; // 播放进度（秒）
  total_time: number; // 总进度（秒）
  save_time: number; // 记录保存时间（时间戳）
  search_title: string; // 搜索时使用的标题
  remarks?: string; // 备注信息（如"已完结"、"更新至20集"等）
  type?: string; // 内容类型，从URL参数获取
}

// 站长配置数据结构
export interface OwnerConfig {
  SiteMaintenance?: boolean;
  DebugMode?: boolean;
  MaxUsers?: number;
}

// 收藏数据结构
export interface Favorite {
  source_name: string;
  total_episodes: number; // 总集数
  title: string;
  year: string;
  cover: string;
  save_time: number; // 记录保存时间（时间戳）
  search_title: string; // 搜索时使用的标题
  origin?: 'vod' | 'live';
  type?: string; // 内容类型（movie/tv/variety/等）
}

// Redis 客户端接口
export interface IRedisClient {
  keys(pattern: string): Promise<string[]>;
  get(key: string): Promise<string | null | {}>;
  mget?(keys: string[]): Promise<(string | null | {})[]>; // Upstash 使用 mget
  mGet?(keys: string[]): Promise<(string | null | {})[]>; // ioredis 使用 mGet
  set?(key: string, value: string): Promise<string | null | {}>;
  del?(...keys: string[]): Promise<number>;
  exists?(key: string): Promise<number>;
  expire?(key: string, seconds: number): Promise<number>;
}

// 存储接口
export interface IStorage {
  // Redis/Upstash 特有属性（可选）
  client?: IRedisClient;
  withRetry?: <T>(fn: () => Promise<T>) => Promise<T>;
  // 播放记录相关
  getPlayRecord(userName: string, key: string): Promise<PlayRecord | null>;
  setPlayRecord(
    userName: string,
    key: string,
    record: PlayRecord,
  ): Promise<void>;
  getAllPlayRecords(userName: string): Promise<{ [key: string]: PlayRecord }>;
  deletePlayRecord(userName: string, key: string): Promise<void>;

  // 收藏相关
  getFavorite(userName: string, key: string): Promise<Favorite | null>;
  setFavorite(userName: string, key: string, favorite: Favorite): Promise<void>;
  getAllFavorites(userName: string): Promise<{ [key: string]: Favorite }>;
  deleteFavorite(userName: string, key: string): Promise<void>;

  // 用户相关
  registerUser(userName: string, password: string): Promise<void>;
  verifyUser(userName: string, password: string): Promise<boolean>;
  // 检查用户是否存在（无需密码）
  checkUserExist(userName: string): Promise<boolean>;
  // 修改用户密码
  changePassword(userName: string, newPassword: string): Promise<void>;
  // 删除用户（包括密码、搜索历史、播放记录、收藏夹）
  deleteUser(userName: string): Promise<void>;
  // 获取用户密码（仅管理员功能）
  getUserPassword(userName: string): Promise<string | null>;
  // 获取用户登录IP（仅管理员功能）
  getUserLoginIp(userName: string): Promise<string | null>;
  // 获取用户头像（仅管理员功能）
  getUserAvatar(userName: string): Promise<string | null>;
  // 设置用户头像（仅管理员功能）
  setUserAvatar(userName: string, avatarBase64: string): Promise<void>;
  // 删除用户头像（仅管理员功能）
  deleteUserAvatar(userName: string): Promise<void>;
  // 设置用户登录IP
  setUserLoginIp(userName: string, ip: string): Promise<void>;
  // 更新用户最后登录时间
  updateUserLastLogin(userName: string, lastLoginAt: number): Promise<void>;

  // 搜索历史相关
  getSearchHistory(userName: string): Promise<string[]>;
  addSearchHistory(userName: string, keyword: string): Promise<void>;
  deleteSearchHistory(userName: string, keyword?: string): Promise<void>;

  // 用户列表
  getAllUsers(): Promise<string[]>;
  getAllUsersWithDetails(): Promise<AdminConfig['UserConfig']['Users']>;

  // 管理员配置相关
  getAdminConfig(): Promise<AdminConfig | null>;
  setAdminConfig(config: AdminConfig): Promise<void>;

  // 数据清理相关
  clearAllData(): Promise<void>;

  // 通用缓存相关（新增）
  getCache(key: string): Promise<unknown | null>;
  setCache(key: string, data: unknown, expireSeconds?: number): Promise<void>;
  deleteCache(key: string): Promise<void>;
  clearExpiredCache(prefix?: string): Promise<void>;

  // 播放统计相关
  getPlayStats(): Promise<PlayStatsResult>;
  getUserPlayStat(userName: string): Promise<UserPlayStat>;
  getContentStats(limit?: number): Promise<ContentStat[]>;
  updatePlayStatistics(
    userName: string,
    source: string,
    id: string,
    watchTime: number,
  ): Promise<void>;

  // 登入统计相关
  updateUserLoginStats(
    userName: string,
    loginTime: number,
    isFirstLogin?: boolean,
  ): Promise<void>;

  // 站长配置相关
  getOwnerConfig(): Promise<OwnerConfig>;
  setOwnerConfig(config: OwnerConfig): Promise<void>;

  // 剧集跳过配置相关
  getEpisodeSkipConfig(
    userName: string,
    source: string,
    id: string,
  ): Promise<EpisodeSkipConfig | null>;
  saveEpisodeSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: EpisodeSkipConfig,
  ): Promise<void>;
  deleteEpisodeSkipConfig(
    userName: string,
    source: string,
    id: string,
  ): Promise<void>;
  getAllEpisodeSkipConfigs(
    userName: string,
  ): Promise<Record<string, EpisodeSkipConfig>>;
}

// 搜索结果数据结构
export interface SearchResult {
  id: string;
  title: string;
  poster: string;
  episodes: string[];
  episodes_titles: string[];
  source: string;
  source_name: string;
  class?: string;
  year: string;
  desc?: string;
  type_name?: string;
  type?: string; // 内容类型，由 inferType 函数推断
  douban_id?: number;
  remarks?: string; // 备注信息（如"已完结"、"更新至20集"等）
  drama_name?: string; // 短剧剧名（用于备用API fallback）
}

// 统一的视频数据结构（用于所有视频场景）
export interface UnifiedVideoItem {
  id: string;
  title: string;
  poster: string;
  type: 'movie' | 'tv' | 'anime' | 'variety' | 'shortdrama' | ''; // 允许空字符串，在 VideoCard 中推断
  source?: string;
  videoId?: string;
  source_name?: string;
  episodes?: number;
  year?: string;
  rate?: string;
  remarks?: string;
  douban_id?: number;
  type_name?: string; // 用于TVBox页面点击时推断类型
  // 豆瓣特有字段（可选）
  directors?: string[];
  screenwriters?: string[];
  cast?: string[];
  genres?: string[];
  countries?: string[];
  languages?: string[];
  episode_length?: number;
  movie_duration?: number;
  first_aired?: string;
  plot_summary?: string;
}

// 豆瓣数据结构（保留用于豆瓣 API 兼容）
export interface DoubanItem {
  id: string;
  title: string;
  poster: string;
  rate: string;
  year: string;
  type?: string; // 内容类型，由页面设置
  // 详细信息字段
  directors?: string[];
  screenwriters?: string[];
  cast?: string[];
  genres?: string[];
  countries?: string[];
  languages?: string[];
  episodes?: number;
  episode_length?: number;
  movie_duration?: number;
  first_aired?: string;
  plot_summary?: string;
  // TVBox场景：保存原始视频源信息
  source?: string;
  videoId?: string;
  source_name?: string;
  contentType?: string; // 内容类型：movie/tv/anime/variety/shortdrama
  remarks?: string; // 备注/更新时间
}

export interface DoubanResult {
  code: number;
  message: string;
  list: DoubanItem[];
}

// ---- 跳过配置（多片段支持）----

// 单个跳过片段
export interface SkipSegment {
  start: number; // 开始时间（秒）
  end: number; // 结束时间（秒）
  type: 'opening' | 'ending'; // 片头或片尾
  title?: string; // 可选的描述
  autoSkip?: boolean; // 是否自动跳过（默认true）
  autoNextEpisode?: boolean; // 片尾是否自动跳转下一集（默认true，仅对ending类型有效）
  mode?: 'absolute' | 'remaining'; // 时间模式：absolute=绝对时间，remaining=剩余时间
  remainingTime?: number; // 剩余时间（秒），仅在mode=remaining时有效
}

// 剧集跳过配置
export interface EpisodeSkipConfig {
  source: string; // 资源站标识
  id: string; // 剧集ID
  title: string; // 剧集标题
  segments: SkipSegment[]; // 跳过片段列表
  updated_time: number; // 最后更新时间
}

// 用户播放统计数据结构
export interface UserPlayStat {
  username: string; // 用户名
  totalWatchTime: number; // 总观看时间（秒）
  totalPlays: number; // 总播放次数
  lastPlayTime: number; // 最后播放时间戳
  recentRecords: PlayRecord[]; // 最近播放记录（最多10条）
  avgWatchTime: number; // 平均每次观看时长
  mostWatchedSource: string; // 最常观看的来源
  loginIp?: string; // 用户登录IP（仅管理员可见）
  avatar?: string; // 用户头像（仅管理员可见）
  registrationDays: number; // 注册天数
  lastLoginTime: number; // 最后登录时间
  // 新增高级统计字段
  totalMovies?: number; // 观看影片总数（去重）
  firstWatchDate?: number; // 首次观看时间戳
  lastUpdateTime?: number; // 最后更新时间戳
  createdAt?: number; // 注册时间戳
  loginDays?: number; // 累计登录天数
  lastLoginDate?: number; // 最后登录日期
  firstLoginTime?: number; // 首次登入时间戳（新增）
  loginCount?: number; // 登入次数（新增）
  activeStreak?: number; // 连续活跃天数
  continuousLoginDays?: number; // 连续登录天数
}

// 全站播放统计数据结构
export interface PlayStatsResult {
  totalUsers: number; // 总用户数
  totalWatchTime: number; // 全站总观看时间
  totalPlays: number; // 全站总播放次数
  avgWatchTimePerUser: number; // 用户平均观看时长
  avgPlaysPerUser: number; // 用户平均播放次数
  userStats: Array<{
    username: string;
    totalWatchTime: number;
    totalPlays: number;
    lastPlayTime: number;
    recentRecords: PlayRecord[];
    avgWatchTime: number;
    mostWatchedSource: string;
    registrationDays: number; // 注册天数
    lastLoginTime: number; // 最后登录时间
    loginCount: number; // 登入次数
    createdAt: number; // 用户创建时间
    loginIp?: string; // 用户登录IP（仅管理员可见）
    avatar?: string; // 用户头像（仅管理员可见）
    lastActivityTime?: number; // 最后活动时间戳
    isOnline?: boolean; // 是否在线
    activityTimeDiff?: number; // 距离上次活动时间
  }>; // 每个用户的统计
  topSources: Array<{
    // 热门来源统计（前5名）
    source: string;
    count: number;
  }>;
  dailyStats: Array<{
    // 近7天每日统计
    date: string;
    watchTime: number;
    plays: number;
  }>;
  // 新增：用户注册统计
  registrationStats: {
    todayNewUsers: number; // 今日新增用户
    totalRegisteredUsers: number; // 总注册用户数
    registrationTrend: Array<{
      // 近7天注册趋势
      date: string;
      newUsers: number;
    }>;
  };
  // 新增：用户活跃度统计
  activeUsers: {
    daily: number; // 日活跃用户数
    weekly: number; // 周活跃用户数
    monthly: number; // 月活跃用户数
  };
}

// 内容热度统计数据结构
export interface ContentStat {
  source: string;
  id: string;
  title: string;
  source_name: string;
  cover: string;
  year: string;
  playCount: number; // 播放次数
  totalWatchTime: number; // 总观看时长
  averageWatchTime: number; // 平均观看时长
  lastPlayed: number; // 最后播放时间
  uniqueUsers: number; // 观看用户数
}

// 短剧分类
export interface ShortDramaCategory {
  id: number;
  name: string;
  version: string;
  created_at?: string;
  sub_categories?: Array<{ id: number; name: string }>;
}

// 短剧项目
export interface ShortDramaItem {
  id: number | string;
  name: string;
  cover: string;
  update_time: string;
  score: number;
  episode_count: number;
  description: string;
  author: string;
  backdrop: string;
  vote_average: number;
  tmdb_id?: number;
  year?: string;
}

// 短剧解析结果
export interface ShortDramaParseResult {
  code: number;
  msg?: string;
  data?: {
    videoId: number | string;
    videoName: string;
    currentEpisode: number;
    totalEpisodes: number;
    parsedUrl: string;
    proxyUrl: string;
    cover: string;
    description: string;
    episode?: {
      index: number;
      label: string;
      parsedUrl: string;
      proxyUrl: string;
      title: string;
    };
  };
  metadata?: {
    author: string;
    backdrop: string;
    vote_average: number;
    tmdb_id?: number;
  };
}
