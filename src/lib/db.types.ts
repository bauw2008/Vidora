/**
 * 数据库操作类型定义
 * 用于统一处理所有数据库操作的类型
 */

// 数据库操作结果
export interface DbResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// 数据库查询条件
export interface DbQueryCondition {
  field: string;
  operator:
    | 'eq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'nin'
    | 'like'
    | 'contains';
  value: unknown;
}

// 数据库排序
export interface DbSortOption {
  field: string;
  order: 'asc' | 'desc';
}

// 数据库分页
export interface DbPagination {
  page: number;
  pageSize: number;
}

// 数据库查询选项
export interface DbQueryOptions {
  conditions?: DbQueryCondition[];
  sort?: DbSortOption[];
  pagination?: DbPagination;
  fields?: string[];
}

// 数据库更新操作
export interface DbUpdateOperation {
  field: string;
  operation: 'set' | 'inc' | 'dec' | 'push' | 'pull';
  value: unknown;
}

// 数据库事务
export interface DbTransaction {
  id: string;
  operations: Array<{
    type: 'create' | 'update' | 'delete';
    collection: string;
    data: Record<string, unknown>;
  }>;
  timestamp: number;
}

// 数据库索引
export interface DbIndex {
  name: string;
  fields: string[];
  unique?: boolean;
  sparse?: boolean;
}

// 数据库集合
export interface DbCollection {
  name: string;
  schema?: Record<string, unknown>;
  indexes?: DbIndex[];
}

// 数据库连接配置
export interface DbConnectionConfig {
  type: 'memory' | 'file' | 'redis' | 'upstash' | 'kvrocks';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  options?: Record<string, unknown>;
}

// 数据库统计信息
export interface DbStats {
  totalCollections: number;
  totalDocuments: number;
  totalSize: number;
  indexes: number;
  connections: number;
}

// 数据库备份
export interface DbBackup {
  id: string;
  timestamp: number;
  size: number;
  checksum: string;
  compressed: boolean;
}

// 数据库恢复
export interface DbRestore {
  backupId: string;
  timestamp: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

// 数据库迁移
export interface DbMigration {
  id: string;
  version: string;
  name: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
  appliedAt?: number;
}

// 数据库事件
export interface DbEvent {
  type: 'insert' | 'update' | 'delete' | 'query';
  collection: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// 数据库监听器
export interface DbListener {
  event: DbEvent['type'];
  collection: string;
  callback: (event: DbEvent) => void;
}

// 缓存操作类型
export type CacheOperation =
  | 'get'
  | 'set'
  | 'delete'
  | 'clear'
  | 'exists'
  | 'expire';

// 缓存操作结果
export interface CacheResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 缓存统计
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  keys: number;
}

// Redis 配置
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  keyPrefix?: string;
  ttl?: number;
  maxRetries?: number;
  retryDelay?: number;
}

// Upstash 配置
export interface UpstashConfig {
  url: string;
  token: string;
  keyPrefix?: string;
  ttl?: number;
}

// Kvrocks 配置
export interface KvrocksConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  keyPrefix?: string;
  ttl?: number;
}

// 本地存储配置
export interface LocalStorageConfig {
  prefix: string;
  version: string;
  ttl?: number;
  maxSize?: number;
}

// 存储适配器接口
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  clear(pattern?: string): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  getMultiple<T>(keys: string[]): Promise<(T | null)[]>;
  setMultiple<T>(
    entries: Array<{ key: string; value: T; ttl?: number }>,
  ): Promise<void>;
  deleteMultiple(keys: string[]): Promise<void>;
  expire(key: string, ttl: number): Promise<void>;
  ttl(key: string): Promise<number>;
  increment(key: string, amount?: number): Promise<number>;
  decrement(key: string, amount?: number): Promise<number>;
  getStats(): Promise<CacheStats>;
}

// 存储键生成器
export interface StorageKeyGenerator {
  prefix: string;
  separator: string;
  generate(...parts: string[]): string;
  parse(key: string): string[];
}

// 存储键模式
export interface StorageKeyPattern {
  pattern: string;
  description: string;
  example: string;
}

// 播放记录存储键
export interface PlayRecordStorageKey {
  userName: string;
  id: string;
  source: string;
}

// 收藏存储键
export interface FavoriteStorageKey {
  userName: string;
  id: string;
  source: string;
}

// 搜索历史存储键
export interface SearchHistoryStorageKey {
  userName: string;
}

// 用户统计存储键
export interface UserStatsStorageKey {
  userName: string;
}

// 评论存储键
export interface CommentStorageKey {
  id: string;
}

// 缓存存储键
export interface CacheStorageKey {
  prefix: string;
  key: string;
}

// 存储键工厂
export class StorageKeyFactory {
  private static SEPARATOR = ':';

  static playRecord(userName: string, id: string, source: string): string {
    return `play_record${this.SEPARATOR}${userName}${this.SEPARATOR}${source}${this.SEPARATOR}${id}`;
  }

  static favorite(userName: string, id: string, source: string): string {
    return `favorite${this.SEPARATOR}${userName}${this.SEPARATOR}${source}${this.SEPARATOR}${id}`;
  }

  static searchHistory(userName: string): string {
    return `search_history${this.SEPARATOR}${userName}`;
  }

  static userStats(userName: string): string {
    return `user_stats${this.SEPARATOR}${userName}`;
  }

  static comment(id: string): string {
    return `comment${this.SEPARATOR}${id}`;
  }

  static cache(prefix: string, key: string): string {
    return `cache${this.SEPARATOR}${prefix}${this.SEPARATOR}${key}`;
  }

  static parse(key: string): string[] {
    return key.split(this.SEPARATOR);
  }
}

// 数据库操作错误
export interface DbError extends Error {
  code: string;
  collection?: string;
  operation?: string;
  details?: Record<string, unknown>;
}

// 数据库操作重试配置
export interface DbRetryConfig {
  maxAttempts: number;
  delay: number;
  backoffMultiplier: number;
  maxDelay: number;
  retryableErrors: string[];
}

// 数据库连接池配置
export interface DbConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
}

// 数据库查询性能指标
export interface DbQueryMetrics {
  query: string;
  duration: number;
  rowsAffected: number;
  timestamp: number;
}

// 数据库健康检查
export interface DbHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  connections: number;
  errors: number;
  timestamp: number;
}

// 数据库备份策略
export interface DbBackupStrategy {
  enabled: boolean;
  interval: number;
  retention: number;
  compression: boolean;
  encryption: boolean;
  destination: string;
}

// 数据库复制配置
export interface DbReplicationConfig {
  enabled: boolean;
  mode: 'master-slave' | 'multi-master';
  nodes: Array<{
    id: string;
    host: string;
    port: number;
    role: 'master' | 'slave';
  }>;
  syncInterval: number;
}

// 数据库分片配置
export interface DbShardingConfig {
  enabled: boolean;
  strategy: 'hash' | 'range' | 'directory';
  shards: Array<{
    id: string;
    host: string;
    port: number;
    database: string;
  }>;
  shardKey: string;
}

// 数据库审计配置
export interface DbAuditConfig {
  enabled: boolean;
  operations: Array<'read' | 'write' | 'delete'>;
  collections: string[];
  logLevel: 'info' | 'warn' | 'error';
  retention: number;
}

// 数据库加密配置
export interface DbEncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keySize: number;
  fields: string[];
  keyRotation: boolean;
  rotationInterval: number;
}

// 数据库压缩配置
export interface DbCompressionConfig {
  enabled: boolean;
  algorithm: 'gzip' | 'brotli' | 'zlib';
  level: number;
  threshold: number;
}

// 数据库验证规则
export interface DbValidationRule {
  field: string;
  type: string;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: unknown[];
  custom?: (value: unknown) => boolean;
}

// 数据库验证结果
export interface DbValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value: unknown;
  }>;
}

// 数据库钩子
export interface DbHooks {
  beforeInsert?: (
    data: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  afterInsert?: (data: Record<string, unknown>) => Promise<void>;
  beforeUpdate?: (
    data: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  afterUpdate?: (data: Record<string, unknown>) => Promise<void>;
  beforeDelete?: (id: string) => Promise<void>;
  afterDelete?: (id: string) => Promise<void>;
}

// 数据库中间件
export interface DbMiddleware {
  name: string;
  priority: number;
  before?: (context: DbContext) => Promise<void>;
  after?: (context: DbContext) => Promise<void>;
  error?: (context: DbContext, error: Error) => Promise<void>;
}

// 数据库上下文
export interface DbContext {
  operation: 'read' | 'write' | 'delete';
  collection: string;
  data: Record<string, unknown>;
  query?: DbQueryOptions;
  timestamp: number;
  user?: string;
}

// 数据库快照
export interface DbSnapshot {
  id: string;
  timestamp: number;
  data: Record<string, unknown>;
  checksum: string;
}

// 数据库事务管理器
export interface DbTransactionManager {
  begin(): Promise<string>;
  commit(transactionId: string): Promise<void>;
  rollback(transactionId: string): Promise<void>;
  getStatus(
    transactionId: string,
  ): Promise<'pending' | 'committed' | 'rolledback'>;
}

// 数据库锁
export interface DbLock {
  key: string;
  owner: string;
  acquiredAt: number;
  ttl: number;
}

// 数据库锁管理器
export interface DbLockManager {
  acquire(key: string, owner: string, ttl: number): Promise<boolean>;
  release(key: string, owner: string): Promise<boolean>;
  extend(key: string, owner: string, ttl: number): Promise<boolean>;
  isLocked(key: string): Promise<boolean>;
  getOwner(key: string): Promise<string | null>;
}

// 数据库事件总线
export interface DbEventBus {
  publish(event: DbEvent): Promise<void>;
  subscribe(listener: DbListener): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  publishAsync(event: DbEvent): void;
}

// 数据库查询构建器
export interface DbQueryBuilder<T = unknown> {
  select(fields: string[]): DbQueryBuilder<T>;
  where(conditions: DbQueryCondition[]): DbQueryBuilder<T>;
  orderBy(sort: DbSortOption[]): DbQueryBuilder<T>;
  limit(limit: number): DbQueryBuilder<T>;
  offset(offset: number): DbQueryBuilder<T>;
  build(): string;
  execute(): Promise<T[]>;
  count(): Promise<number>;
  first(): Promise<T | null>;
}

// 数据库聚合操作
export interface DbAggregation {
  pipeline: Array<{
    $match?: Record<string, unknown>;
    $group?: Record<string, unknown>;
    $sort?: Record<string, unknown>;
    $limit?: number;
    $skip?: number;
    $project?: Record<string, unknown>;
    $unwind?: string;
    $lookup?: Record<string, unknown>;
  }>;
}

// 数据库聚合结果
export interface DbAggregationResult<T = unknown> {
  data: T[];
  count: number;
  duration: number;
}

// 数据库索引统计
export interface DbIndexStats {
  name: string;
  keys: number;
  size: number;
  usage: number;
  lastAccessed: number;
}

// 数据库集合统计
export interface DbCollectionStats {
  name: string;
  documents: number;
  size: number;
  avgDocSize: number;
  indexes: DbIndexStats[];
  lastModified: number;
}

// 数据库性能指标
export interface DbPerformanceMetrics {
  queries: number;
  reads: number;
  writes: number;
  deletes: number;
  avgQueryTime: number;
  maxQueryTime: number;
  avgReadTime: number;
  avgWriteTime: number;
  cacheHitRate: number;
  connections: number;
  errors: number;
  timestamp: number;
}

// 数据库配置验证
export interface DbConfigValidation {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}

// 数据库迁移状态
export interface DbMigrationState {
  currentVersion: string;
  pendingMigrations: string[];
  appliedMigrations: string[];
  lastMigrationAt: number;
}

// 数据库备份状态
export interface DbBackupState {
  lastBackupAt: number;
  nextBackupAt: number;
  totalBackups: number;
  totalSize: number;
  retentionDays: number;
}

// 数据库恢复状态
export interface DbRestoreState {
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

// 数据库同步状态
export interface DbSyncState {
  status: 'idle' | 'syncing' | 'completed' | 'failed';
  lastSyncAt: number;
  nextSyncAt: number;
  syncedRecords: number;
  totalRecords: number;
  error?: string;
}

// 数据库清理策略
export interface DbCleanupStrategy {
  enabled: boolean;
  interval: number;
  retention: number;
  collections: Array<{
    name: string;
    criteria: Record<string, unknown>;
  }>;
}

// 数据库压缩策略
export interface DbCompressionStrategy {
  enabled: boolean;
  interval: number;
  threshold: number;
  collections: string[];
}

// 数据库优化策略
export interface DbOptimizationStrategy {
  enabled: boolean;
  interval: number;
  operations: Array<'analyze' | 'reindex' | 'compact' | 'vacuum'>;
}

// 数据库监控策略
export interface DbMonitoringStrategy {
  enabled: boolean;
  interval: number;
  metrics: Array<'performance' | 'health' | 'connections' | 'queries'>;
  alerts: Array<{
    metric: string;
    threshold: number;
    action: string;
  }>;
}

// 数据库安全策略
export interface DbSecurityStrategy {
  enabled: boolean;
  encryption: boolean;
  authentication: boolean;
  authorization: boolean;
  auditing: boolean;
  rateLimit: boolean;
}

// 数据库备份计划
export interface DbBackupSchedule {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string; // cron expression
  retention: number;
  compression: boolean;
  encryption: boolean;
  destination: string;
  lastRun?: number;
  nextRun?: number;
}

// 数据库恢复计划
export interface DbRestoreSchedule {
  id: string;
  name: string;
  enabled: boolean;
  backupId: string;
  targetDatabase: string;
  overwrite: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

// 数据库测试数据
export interface DbTestData {
  collection: string;
  data: Record<string, unknown>[];
  cleanupAfterTest: boolean;
}

// 数据库测试配置
export interface DbTestConfig {
  enabled: boolean;
  testData: DbTestData[];
  isolation: boolean;
  cleanupAfterTest: boolean;
  seedData: Record<string, Record<string, unknown>[]>;
}

// 数据库文档
export interface DbDocumentation {
  collection: string;
  description: string;
  schema: Record<string, unknown>;
  indexes: DbIndex[];
  relationships: Array<{
    collection: string;
    field: string;
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  }>;
  examples: Record<string, unknown>[];
}
