// 菜单设置类型定义 - 统一的权威定义
export interface MenuSettings {
  showMovies: boolean;
  showTVShows: boolean;
  showAnime: boolean;
  showVariety: boolean;
  showLive: boolean;
  showTvbox: boolean;
  showShortDrama: boolean;
}

// 菜单标签映射
export const menuLabels: Record<keyof MenuSettings, string> = {
  showMovies: '电影',
  showTVShows: '剧集',
  showAnime: '动漫',
  showVariety: '综艺',
  showLive: '直播',
  showTvbox: 'TVBox',
  showShortDrama: '短剧',
};
