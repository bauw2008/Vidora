import { logger } from '@/lib/logger';

import { AdminConfig } from './admin.types';
import { KvrocksStorage } from './kvrocks.db';
import { RedisStorage } from './redis.db';
import type { OwnerConfig } from './types';
import {
  ContentStat,
  EpisodeSkipConfig,
  Favorite,
  IStorage,
  PlayRecord,
  PlayStatsResult,
  UserPlayStat,
} from './types';
import { UpstashRedisStorage } from './upstash.db';

// storage type 常量: 'localstorage' | 'redis' | 'upstash'，默认 'localstorage'
const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'upstash'
    | 'kvrocks'
    | undefined) || 'localstorage';

// 创建存储实例
function createStorage(): IStorage {
  switch (STORAGE_TYPE) {
    case 'redis':
      return new RedisStorage();
    case 'upstash':
      return new UpstashRedisStorage();
    case 'kvrocks':
      return new KvrocksStorage();
    case 'localstorage':
    default:
      return null as unknown as IStorage;
  }
}

// 单例存储实例
let storageInstance: IStorage | null = null;

function getStorage(): IStorage {
  if (!storageInstance) {
    storageInstance = createStorage();
  }
  return storageInstance;
}

// 工具函数：生成存储key
export function generateStorageKey(source: string, id: string): string {
  return `${source}+${id}`;
}

// 导出便捷方法
export class DbManager {
  public storage: IStorage;

  constructor() {
    this.storage = getStorage();
  }

  // 播放记录相关方法
  async getPlayRecord(
    userName: string,
    source: string,
    id: string,
  ): Promise<PlayRecord | null> {
    if (!this.isPlayRecordSupported()) {
      return null;
    }
    const key = generateStorageKey(source, id);
    return this.storage.getPlayRecord(userName, key);
  }

  async savePlayRecord(
    userName: string,
    source: string,
    id: string,
    record: PlayRecord,
  ): Promise<void> {
    if (!this.isPlayRecordSupported()) {
      return;
    }
    const key = generateStorageKey(source, id);
    await this.storage.setPlayRecord(userName, key, record);
  }

  async getAllPlayRecords(userName: string): Promise<{
    [key: string]: PlayRecord;
  }> {
    if (!this.isPlayRecordSupported()) {
      return {};
    }
    return this.storage.getAllPlayRecords(userName);
  }

  async deletePlayRecord(
    userName: string,
    source: string,
    id: string,
  ): Promise<void> {
    if (!this.isPlayRecordSupported()) {
      return;
    }
    const key = generateStorageKey(source, id);
    await this.storage.deletePlayRecord(userName, key);
  }

  // 收藏相关方法
  async getFavorite(
    userName: string,
    source: string,
    id: string,
  ): Promise<Favorite | null> {
    if (!this.isFavoriteSupported()) {
      return null;
    }
    const key = generateStorageKey(source, id);
    return this.storage.getFavorite(userName, key);
  }

  async saveFavorite(
    userName: string,
    source: string,
    id: string,
    favorite: Favorite,
  ): Promise<void> {
    if (!this.isFavoriteSupported()) {
      return;
    }
    const key = generateStorageKey(source, id);
    await this.storage.setFavorite(userName, key, favorite);
  }

  async getAllFavorites(
    userName: string,
  ): Promise<{ [key: string]: Favorite }> {
    if (!this.isFavoriteSupported()) {
      return {};
    }
    return this.storage.getAllFavorites(userName);
  }

  async deleteFavorite(
    userName: string,
    source: string,
    id: string,
  ): Promise<void> {
    if (!this.isFavoriteSupported()) {
      return;
    }
    const key = generateStorageKey(source, id);
    await this.storage.deleteFavorite(userName, key);
  }

  async isFavorited(
    userName: string,
    source: string,
    id: string,
  ): Promise<boolean> {
    const favorite = await this.getFavorite(userName, source, id);
    return favorite !== null;
  }

  // ---------- 用户相关 ----------
  async registerUser(userName: string, password: string): Promise<void> {
    await this.storage.registerUser(userName, password);
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    return this.storage.verifyUser(userName, password);
  }

  // 检查用户是否已存在
  async checkUserExist(userName: string): Promise<boolean> {
    return this.storage.checkUserExist(userName);
  }

  // 获取用户密码（仅管理员功能）
  async getUserPassword(userName: string): Promise<string | null> {
    if (typeof this.storage.getUserPassword === 'function') {
      return await this.storage.getUserPassword(userName);
    }
    return null;
  }

  // 更新用户最后登录时间
  async updateUserLastLogin(
    userName: string,
    lastLoginAt: number,
  ): Promise<void> {
    if (typeof this.storage.updateUserLastLogin === 'function') {
      await this.storage.updateUserLastLogin(userName, lastLoginAt);
    }
  }

  // 获取用户登录IP（仅管理员功能）
  async getUserLoginIp(userName: string): Promise<string | null> {
    if (typeof this.storage.getUserLoginIp === 'function') {
      return await this.storage.getUserLoginIp(userName);
    }
    return null;
  }

  // 设置用户登录IP
  async setUserLoginIp(userName: string, ip: string): Promise<void> {
    if (this.storage && typeof this.storage.setUserLoginIp === 'function') {
      await this.storage.setUserLoginIp(userName, ip);
    }
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    await this.storage.changePassword(userName, newPassword);
  }

  async deleteUser(userName: string): Promise<void> {
    await this.storage.deleteUser(userName);
  }

  // ---------- 搜索历史 ----------
  async getSearchHistory(userName: string): Promise<string[]> {
    if (!this.isSearchHistorySupported()) {
      return [];
    }
    return this.storage.getSearchHistory(userName);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    if (!this.isSearchHistorySupported()) {
      return;
    }
    await this.storage.addSearchHistory(userName, keyword);
  }

  async deleteSearchHistory(userName: string, keyword: string): Promise<void> {
    if (!this.isSearchHistorySupported()) {
      return;
    }
    await this.storage.deleteSearchHistory(userName, keyword);
  }

  // 获取全部用户名
  async getAllUsers(): Promise<string[]> {
    if (
      this.storage &&
      typeof (this.storage as IStorage).getAllUsers === 'function'
    ) {
      return (this.storage as IStorage).getAllUsers();
    }
    return [];
  }

  // 获取全部用户详细信息
  async getAllUsersWithDetails(): Promise<AdminConfig['UserConfig']['Users']> {
    if (
      this.storage &&
      typeof (this.storage as IStorage).getAllUsersWithDetails === 'function'
    ) {
      return (this.storage as IStorage).getAllUsersWithDetails();
    }

    // 如果存储不支持，从管理员配置中获取
    try {
      const adminConfig = await this.getAdminConfig();
      if (adminConfig?.UserConfig?.Users) {
        return adminConfig.UserConfig.Users;
      }
    } catch (error) {
      logger.error('获取用户详细信息失败:', error);
    }

    return [];
  }

  // ---------- 管理员配置 ----------
  async getAdminConfig(): Promise<AdminConfig | null> {
    if (
      this.storage &&
      typeof (this.storage as IStorage).getAdminConfig === 'function'
    ) {
      return (this.storage as IStorage).getAdminConfig();
    }
    return null;
  }

  async saveAdminConfig(config: AdminConfig): Promise<void> {
    if (
      this.storage &&
      typeof (this.storage as IStorage).setAdminConfig === 'function'
    ) {
      await (this.storage as IStorage).setAdminConfig(config);
    }
  }

  // ---------- 用户头像 ----------
  async getUserAvatar(userName: string): Promise<string | null> {
    if (
      this.storage &&
      typeof (this.storage as IStorage).getUserAvatar === 'function'
    ) {
      return (this.storage as IStorage).getUserAvatar(userName);
    }
    return null;
  }

  async setUserAvatar(userName: string, avatarBase64: string): Promise<void> {
    if (typeof (this.storage as IStorage).setUserAvatar === 'function') {
      await (this.storage as IStorage).setUserAvatar(userName, avatarBase64);
    }
  }

  async deleteUserAvatar(userName: string): Promise<void> {
    if (typeof (this.storage as IStorage).deleteUserAvatar === 'function') {
      await (this.storage as IStorage).deleteUserAvatar(userName);
    }
  }

  // ---------- 剧集跳过配置（新版，多片段支持）----------
  async getEpisodeSkipConfig(
    userName: string,
    source: string,
    id: string,
  ): Promise<EpisodeSkipConfig | null> {
    if (typeof (this.storage as IStorage).getEpisodeSkipConfig === 'function') {
      return (this.storage as IStorage).getEpisodeSkipConfig(
        userName,
        source,
        id,
      );
    }
    return null;
  }

  async saveEpisodeSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: EpisodeSkipConfig,
  ): Promise<void> {
    if (
      typeof (this.storage as IStorage).saveEpisodeSkipConfig === 'function'
    ) {
      await (this.storage as IStorage).saveEpisodeSkipConfig(
        userName,
        source,
        id,
        config,
      );
    }
  }

  async deleteEpisodeSkipConfig(
    userName: string,
    source: string,
    id: string,
  ): Promise<void> {
    if (
      typeof (this.storage as IStorage).deleteEpisodeSkipConfig === 'function'
    ) {
      await (this.storage as IStorage).deleteEpisodeSkipConfig(
        userName,
        source,
        id,
      );
    }
  }

  async getAllEpisodeSkipConfigs(
    userName: string,
  ): Promise<Record<string, EpisodeSkipConfig>> {
    if (
      typeof (this.storage as IStorage).getAllEpisodeSkipConfigs === 'function'
    ) {
      return (this.storage as IStorage).getAllEpisodeSkipConfigs(userName);
    }
    return {};
  }

  // ---------- 数据清理 ----------
  async clearAllData(): Promise<void> {
    if (typeof (this.storage as IStorage).clearAllData === 'function') {
      await (this.storage as IStorage).clearAllData();
    } else {
      throw new Error('存储类型不支持清空数据操作');
    }
  }

  // ---------- 通用缓存方法 ----------
  async getCache(key: string): Promise<unknown | null> {
    // 本地存储模式不支持缓存功能
    if (!this.isCacheSupported()) {
      return null;
    }
    if (this.storage && typeof this.storage.getCache === 'function') {
      return await this.storage.getCache(key);
    }
    return null;
  }

  async setCache(
    key: string,
    data: unknown,
    expireSeconds?: number,
  ): Promise<void> {
    // 本地存储模式不支持缓存功能
    if (!this.isCacheSupported()) {
      return;
    }
    if (this.storage && typeof this.storage.setCache === 'function') {
      await this.storage.setCache(key, data, expireSeconds);
    }
  }

  async deleteCache(key: string): Promise<void> {
    if (typeof this.storage.deleteCache === 'function') {
      await this.storage.deleteCache(key);
    }
  }

  async clearExpiredCache(prefix?: string): Promise<void> {
    if (typeof this.storage.clearExpiredCache === 'function') {
      await this.storage.clearExpiredCache(prefix);
    }
  }

  // ---------- 播放统计相关 ----------
  async getPlayStats(): Promise<PlayStatsResult> {
    if (typeof (this.storage as IStorage).getPlayStats === 'function') {
      return (this.storage as IStorage).getPlayStats();
    }

    // 如果存储不支持统计功能，返回默认值
    return {
      totalUsers: 0,
      totalWatchTime: 0,
      totalPlays: 0,
      avgWatchTimePerUser: 0,
      avgPlaysPerUser: 0,
      userStats: [],
      topSources: [],
      dailyStats: [],
      // 新增：用户注册统计
      registrationStats: {
        todayNewUsers: 0,
        totalRegisteredUsers: 0,
        registrationTrend: [],
      },
      // 新增：用户活跃度统计
      activeUsers: {
        daily: 0,
        weekly: 0,
        monthly: 0,
      },
    };
  }

  async getUserPlayStat(userName: string): Promise<UserPlayStat> {
    if (typeof (this.storage as IStorage).getUserPlayStat === 'function') {
      return (this.storage as IStorage).getUserPlayStat(userName);
    }

    // 如果存储不支持统计功能，返回默认值
    return {
      username: userName,
      totalWatchTime: 0,
      totalPlays: 0,
      lastPlayTime: 0,
      recentRecords: [],
      avgWatchTime: 0,
      mostWatchedSource: '',
      registrationDays: 0,
      lastLoginTime: 0,
    };
  }

  async getContentStats(limit = 10): Promise<ContentStat[]> {
    if (typeof (this.storage as IStorage).getContentStats === 'function') {
      return (this.storage as IStorage).getContentStats(limit);
    }

    // 如果存储不支持统计功能，返回空数组
    return [];
  }

  async updatePlayStatistics(
    _userName: string,
    _source: string,
    _id: string,
    _watchTime: number,
  ): Promise<void> {
    if (typeof (this.storage as IStorage).updatePlayStatistics === 'function') {
      await (this.storage as IStorage).updatePlayStatistics(
        _userName,
        _source,
        _id,
        _watchTime,
      );
    }
  }

  async updateUserLoginStats(
    userName: string,
    loginTime: number,
    isFirstLogin?: boolean,
  ): Promise<void> {
    // 检查storage是否存在且支持统计功能
    if (!this.storage) {
      logger.warn('存储实例不存在，跳过登录统计记录');
      return;
    }

    if (typeof (this.storage as IStorage).updateUserLoginStats === 'function') {
      await (this.storage as IStorage).updateUserLoginStats(
        userName,
        loginTime,
        isFirstLogin,
      );
    } else {
      logger.warn('当前存储类型不支持登录统计功能');
    }
  }

  // 检查存储类型是否支持统计功能
  isStatsSupported(): boolean {
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
    return storageType !== 'localstorage';
  }

  // 检查存储类型是否支持缓存功能
  isCacheSupported(): boolean {
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
    return storageType !== 'localstorage';
  }

  // 检查存储类型是否支持用户数据持久化
  isUserDataSupported(): boolean {
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
    return storageType !== 'localstorage';
  }

  // 检查存储类型是否支持播放记录
  isPlayRecordSupported(): boolean {
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
    return storageType !== 'localstorage';
  }

  // 检查存储类型是否支持收藏功能
  isFavoriteSupported(): boolean {
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
    return storageType !== 'localstorage';
  }

  // 检查存储类型是否支持搜索历史
  isSearchHistorySupported(): boolean {
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
    return storageType !== 'localstorage';
  }

  // 站长配置相关方法
  async getOwnerConfig(): Promise<OwnerConfig> {
    if (!this.isUserDataSupported()) {
      return { SiteMaintenance: false, DebugMode: false, MaxUsers: 1000 };
    }
    if (typeof this.storage.getOwnerConfig === 'function') {
      return await this.storage.getOwnerConfig();
    }
    return { SiteMaintenance: false, DebugMode: false, MaxUsers: 1000 };
  }

  async setOwnerConfig(config: OwnerConfig): Promise<void> {
    if (!this.isUserDataSupported()) {
      return;
    }
    if (typeof this.storage.setOwnerConfig === 'function') {
      await this.storage.setOwnerConfig(config);
    }
  }
}

// 导出默认实例
export const db = new DbManager();
