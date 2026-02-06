/**
 * API 响应通用类型定义
 * 用于统一处理所有 API 路由的响应格式
 */

// 通用 API 响应结构
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// 缓存相关类型
export interface CacheItem<T = unknown> {
  data: T;
  timestamp: number;
  expireTime?: number;
  version?: string;
}

// 直播相关类型
export interface LiveChannel {
  id: string;
  tvgId: string;
  name: string;
  logo: string;
  group: string;
  url: string;
}

export interface LiveSource {
  key: string;
  name: string;
  url: string;
  ua?: string;
  epg?: string;
  from: 'config' | 'custom';
  channelNumber?: number;
  disabled?: boolean;
}

export interface LiveChannelFromAPI {
  id: string;
  tvgId?: string;
  name: string;
  logo: string;
  group?: string;
  url: string;
}

// EPG 节目单相关
export interface EpgProgram {
  start: string;
  end: string;
  title: string;
}

export interface EpgData {
  tvgId: string;
  source: string;
  epgUrl: string;
  programs: EpgProgram[];
}

// TVBox 相关类型
export interface TVBoxSource {
  key: string;
  name: string;
  url: string;
  enabled: boolean;
  type?: string;
}

export interface TVBoxVideo {
  id: string;
  name: string;
  url: string;
  type?: string;
}

// TVBox 配置诊断结果
export interface ConfigDiagnosisResult {
  ok: boolean;
  status: number;
  contentType: string;
  size: number;
  baseUrl: string;
  configUrl: string;
  receivedToken: string;
  hasJson: boolean;
  issues: string[];
  json?: unknown;
  parseError?: string;
  spider_url?: string;
  spider_md5?: string;
  spider_cached?: boolean;
  spider_real_size?: number;
  spider_tried?: boolean;
  spider_success?: boolean;
  spiderReachable?: boolean;
  spiderStatus?: number | string;
  spiderContentLength?: string;
  spiderLastModified?: string;
  spiderSizeKB?: number;
  sitesCount?: number;
  livesCount?: number;
  spider?: string;
  spiderPrivate?: boolean;
  privateApis?: number;
  issuesCount?: number;
  parsesCount?: number;
  spider_backup?: string;
  spider_candidates?: string[];
  pass?: boolean;
  recommendations?: string[];
}

// TVBox JAR 源修复结果
export interface JarFixResult {
  success: boolean;
  timestamp: number;
  executionTime: number;
  summary: {
    total_tested: number;
    successful: number;
    failed: number;
    user_region: 'domestic' | 'international';
    avg_response_time: number;
  };
  test_results: JarTestResult[];
  recommended_sources: JarTestResult[];
  recommendations: {
    immediate: string[];
    configuration: string[];
    troubleshooting: string[];
  };
  fixed_config_urls: string[];
  status: {
    jar_available: boolean;
    network_quality: 'good' | 'fair' | 'poor';
    needs_troubleshooting: boolean;
  };
  error?: string;
  message?: string;
  emergency_recommendations?: string[];
}

// JAR 源定义
export interface JarSource {
  url: string;
  name: string;
  region: 'domestic' | 'international' | 'proxy' | 'overseas';
  priority: number;
}

// JAR 源测试结果
export interface JarTestResult {
  url: string;
  name: string;
  success: boolean;
  responseTime: number;
  size?: number;
  error?: string;
  statusCode?: number;
}

// 短剧相关类型
export interface ShortDramaCategory {
  id: number;
  name: string;
  version: string;
  created_at?: string;
  sub_categories?: Array<{ id: number; name: string }>;
}

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
}

// TMDB 相关类型
export interface TMDBActor {
  id: number;
  name: string;
  profile_path: string | null;
  character: string;
  order: number;
}

export interface TMDBPoster {
  file_path: string;
  width: number;
  height: number;
  iso_639_1: string | null;
  vote_average: number;
  vote_count: number;
  aspect_ratio: number;
}

// 播放统计相关
export interface PlayStatistics {
  userName: string;
  source: string;
  id: string;
  watchTime: number;
  timestamp: number;
}

// 用户相关类型
export interface UserInfo {
  username: string;
  role: 'user' | 'admin';
  createdAt: number;
  lastLoginAt: number;
  loginIp?: string;
  avatar?: string;
}

// 配置相关类型
export interface ConfigData {
  key: string;
  value: unknown;
  updatedAt: number;
}

// HLS 相关类型
export interface HlsConfig {
  debug: boolean;
  enableWorker: boolean;
  lowLatencyMode: boolean;
  maxBufferLength: number;
  backBufferLength: number;
  maxBufferSize: number;
}

// 播放器相关类型
export interface PlayerConfig {
  url: string;
  poster?: string;
  volume: number;
  isLive: boolean;
  muted: boolean;
  autoplay: boolean;
  pip: boolean;
  autoSize: boolean;
  autoMini: boolean;
  screenshot: boolean;
  setting: boolean;
  loop: boolean;
  flip: boolean;
  playbackRate: boolean;
  aspectRatio: boolean;
  fullscreen: boolean;
  fullscreenWeb: boolean;
  subtitleOffset: boolean;
  miniProgressBar: boolean;
  mutex: boolean;
  playsInline: boolean;
  autoPlayback: boolean;
  airplay: boolean;
  theme: string;
  lang: string;
  hotkey: boolean;
  fastForward: boolean;
  autoOrientation: boolean;
  lock: boolean;
}

// WebSocket 相关类型
export interface WebSocketMessage<T = unknown> {
  type: string;
  data?: T;
  timestamp?: number;
}

// 搜索相关类型
export interface SearchQuery {
  keyword: string;
  page?: number;
  pageSize?: number;
  filters?: Record<string, unknown>;
}

export interface SearchResultItem {
  id: string;
  title: string;
  poster: string;
  type?: string;
  year?: string;
  rate?: string;
}

// 验证相关类型
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

// 诊断相关类型
export interface DiagnosticResult {
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

// 通用键值对类型
export interface KeyValuePairs {
  [key: string]: unknown;
}

// 函数类型
export type AsyncFunction<T = void> = (...args: unknown[]) => Promise<T>;

// 事件处理器类型
export type EventHandler<T = Event> = (event: T) => void;
export type AsyncEventHandler<T = Event> = (event: T) => Promise<void>;

// 回调函数类型
export type Callback<T = void> = () => T;
export type AsyncCallback<T = void> = () => Promise<T>;
export type CallbackWithParam<P, T = void> = (param: P) => T;
export type AsyncCallbackWithParam<P, T = void> = (param: P) => Promise<T>;

// 变更监听器类型
export type ChangeListener<T> = (newValue: T, oldValue: T) => void;

// 错误处理类型
export interface ErrorWithMessage extends Error {
  message: string;
  code?: string;
  details?: unknown;
}

export type ErrorHandler = (error: ErrorWithMessage) => void;

// 加载状态类型
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// 主题类型
export type Theme = 'light' | 'dark' | 'system';

// 语言类型
export type Language = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR';

// 排序类型
export type SortOrder = 'asc' | 'desc';

// 过滤器类型
export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

// 选择器类型
export interface SelectorOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

// 表单相关类型
export interface FormField {
  name: string;
  value: unknown;
  error?: string;
  touched?: boolean;
  dirty?: boolean;
}

export interface FormState {
  fields: Record<string, FormField>;
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
}

// 通知类型
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  timestamp: number;
}

// 模态框类型
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

// 工具提示类型
export interface TooltipProps {
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

// 下拉菜单类型
export interface DropdownOption {
  label: string;
  value: string;
  icon?: string;
  disabled?: boolean;
  divider?: boolean;
}

// 标签页类型
export interface TabItem {
  key: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  content?: React.ReactNode;
}

// 面包屑类型
export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: string;
}

// 分页类型
export interface PaginationInfo {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
}

// 表格类型
export interface TableColumn<T = unknown> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  width?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: unknown, record: T, index: number) => React.ReactNode;
}

export interface TableData<T = unknown> {
  data: T[];
  total: number;
  loading?: boolean;
}

// 树形结构类型
export interface TreeNode<T = unknown> {
  key: string;
  title: string;
  children?: TreeNode<T>[];
  data?: T;
  expanded?: boolean;
  selected?: boolean;
  disabled?: boolean;
}

// 拖拽相关类型
export interface DragItem<T = unknown> {
  id: string;
  data: T;
  index: number;
}

export interface DropZoneProps {
  onDrop: (item: DragItem) => void;
  onDragOver?: (event: DragEvent) => void;
  onDragLeave?: (event: DragEvent) => void;
  accept?: string[];
}

// 动画类型
export interface AnimationConfig {
  duration?: number;
  easing?: string;
  delay?: number;
}

// 过渡类型
export interface TransitionConfig {
  name: string;
  mode?: 'in-out' | 'out-in' | 'default';
  duration?: number;
}

// 响应式断点类型
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export type BreakpointValues = {
  [key in Breakpoint]: number;
};

// 媒体查询类型
export interface MediaQueryConfig {
  minWidth?: number;
  maxWidth?: number;
  orientation?: 'portrait' | 'landscape';
}

// 图标类型
export interface IconProps {
  name: string;
  size?: number | string;
  color?: string;
  className?: string;
}

// 图片类型
export interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  lazy?: boolean;
  placeholder?: string;
}

// 视频类型
export interface VideoProps {
  src: string;
  poster?: string;
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
}

// 音频类型
export interface AudioProps {
  src: string;
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
}

// 文件类型
export interface FileUploadOptions {
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  onUpload?: (files: File[]) => void;
  onError?: (error: Error) => void;
}

// 日期时间类型
export type DateInput = string | number | Date;

export interface DateRange {
  start: DateInput;
  end: DateInput;
}

// 地理位置
export interface Geolocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
}

// 设备信息
export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  screenResolution: string;
  viewportSize: string;
  touchSupport: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

// 性能指标
export interface PerformanceMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  domContentLoaded?: number;
  loadComplete?: number;
}

// 安全相关
export interface SecurityConfig {
  csrfToken?: string;
  contentSecurityPolicy?: string;
  xssProtection?: boolean;
  frameOptions?: string;
  referrerPolicy?: string;
}

// 权限相关
export interface Permission {
  resource: string;
  action: string;
  granted: boolean;
}

export interface Role {
  name: string;
  permissions: Permission[];
}

// 审计日志
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  timestamp: number;
  ip?: string;
}

// 缓存策略
export interface CacheStrategy {
  type: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB';
  ttl?: number;
  maxSize?: number;
  maxItems?: number;
}

// 重试配置
export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoffMultiplier?: number;
  maxDelay?: number;
  retryableErrors?: string[];
}

// 限流配置
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// 请求配置
export interface RequestConfig extends Omit<RequestInit, 'cache'> {
  timeout?: number;
  retry?: RetryConfig;
  cacheStrategy?: CacheStrategy;
  headers?: Record<string, string>;
}

// 响应拦截器
export interface ResponseInterceptor {
  onFulfilled?: (response: Response) => Response | Promise<Response>;
  onRejected?: (error: Error) => Error | Promise<Error>;
}

// 请求拦截器
export interface RequestInterceptor {
  onFulfilled?: (
    config: RequestConfig,
  ) => RequestConfig | Promise<RequestConfig>;
  onRejected?: (error: Error) => Error | Promise<Error>;
}

// HTTP 客户端配置
export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  interceptors?: {
    request?: RequestInterceptor[];
    response?: ResponseInterceptor[];
  };
}

// WebSocket 配置
export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  heartbeatMessage?: string;
}

// 实时数据订阅
export interface Subscription<T = unknown> {
  id: string;
  topic: string;
  callback: (data: T) => void;
  unsubscribe: () => void;
}

// 状态管理
export interface State<T = unknown> {
  value: T;
  version: number;
  timestamp: number;
}

export interface StateListener<T = unknown> {
  callback: (value: T, oldValue: T) => void;
  immediate?: boolean;
}

// 路由相关
export interface Route {
  path: string;
  name: string;
  component?: React.ComponentType;
  meta?: Record<string, unknown>;
  children?: Route[];
}

export interface NavigationGuard {
  to: Route;
  from: Route;
  next: (path?: string) => void;
}

// 国际化
export interface I18nConfig {
  locale: string;
  fallbackLocale: string;
  messages: Record<string, Record<string, string>>;
  dateTimeFormats?: Record<string, Record<string, string>>;
  numberFormats?: Record<string, Record<string, string>>;
}

// 主题配置
export interface ThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  border: string;
  error: string;
  warning: string;
  success: string;
  info: string;
}

// 组件配置
export interface ComponentConfig {
  name: string;
  props?: Record<string, unknown>;
  events?: Record<string, EventHandler>;
  slots?: Record<string, React.ReactNode>;
}

// 插件配置
export interface PluginConfig {
  name: string;
  version: string;
  enabled: boolean;
  options?: Record<string, unknown>;
}

// 应用配置
export interface AppConfig {
  name: string;
  version: string;
  description?: string;
  env: 'development' | 'staging' | 'production';
  debug: boolean;
  features: Record<string, boolean>;
  plugins: PluginConfig[];
}

// 日志级别
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// 日志条目
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  stack?: string;
}

// 日志配置
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStorageSize?: number;
  enableRemote?: boolean;
  remoteUrl?: string;
}

// 监控配置
export interface MonitoringConfig {
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  enableUserTracking: boolean;
  samplingRate: number;
  endpoint?: string;
}

// 分析配置
export interface AnalyticsConfig {
  trackingId: string;
  enablePageViewTracking: boolean;
  enableEventTracking: boolean;
  enableUserTracking: boolean;
  customDimensions?: Record<string, string>;
}

// A/B 测试
export interface Experiment {
  name: string;
  variant: string;
  enabled: boolean;
  parameters?: Record<string, unknown>;
}

export interface ExperimentConfig {
  experiments: Experiment[];
  fallbackVariant?: string;
}

// 特性标志
export interface FeatureFlag {
  name: string;
  enabled: boolean;
  conditions?: Array<{
    type: string;
    value: unknown;
  }>;
  rolloutPercentage?: number;
}

export interface FeatureFlagsConfig {
  flags: FeatureFlag[];
  defaultEnabled: boolean;
}

// 优化配置
export interface OptimizationConfig {
  enableCodeSplitting: boolean;
  enableTreeShaking: boolean;
  enableMinification: boolean;
  enableCompression: boolean;
  enableCaching: boolean;
  enablePrefetching: boolean;
  enablePreloading: boolean;
}

// 构建配置
export interface BuildConfig {
  target: 'es5' | 'es2015' | 'es2020' | 'esnext';
  mode: 'development' | 'production';
  sourceMap: boolean;
  minify: boolean;
  analyze: boolean;
}

// 部署配置
export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  region?: string;
  cdn?: string;
  apiEndpoint?: string;
  websocketEndpoint?: string;
}

// 环境变量
export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  API_URL?: string;
  WS_URL?: string;
  CDN_URL?: string;
  STORAGE_TYPE?: string;
  DEBUG?: boolean;
  LOG_LEVEL?: LogLevel;
}
