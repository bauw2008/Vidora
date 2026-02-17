/**
 * 从播放URL中提取剧集信息
 */
export function extractEpisodesFromPlayUrl(playUrl: string | undefined): {
  episodes: string[];
  titles: string[];
} {
  let episodes: string[] = [];
  let titles: string[] = [];

  if (playUrl) {
    // 先用 $$$ 分割不同的播放源
    const vod_play_url_array = playUrl.split('$$$');
    // 分集之间#分割，标题和播放链接 $ 分割
    vod_play_url_array.forEach((url: string) => {
      const matchEpisodes: string[] = [];
      const matchTitles: string[] = [];
      const title_url_array = url.split('#');
      title_url_array.forEach((title_url: string) => {
        const episode_title_url = title_url.split('$');
        if (
          episode_title_url.length === 2 &&
          episode_title_url[1].endsWith('.m3u8')
        ) {
          matchTitles.push(episode_title_url[0]);
          matchEpisodes.push(episode_title_url[1]);
        }
      });
      if (matchEpisodes.length > episodes.length) {
        episodes = matchEpisodes;
        titles = matchTitles;
      }
    });
  }

  return { episodes, titles };
}
