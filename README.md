<div align="center">

# 🎬 Vidora

<img src="public/logo.png" alt="Vidora Logo" width="140">

**一款优雅的影视聚合平台**

基于 [MoonTV](https://github.com/MoonTechLab/LunaTV) 二次开发 · Next.js 16 + Tailwind CSS 4.1 + TypeScript

[![Next.js](https://img.shields.io/badge/Next.js-16.1-000?logo=nextdotjs)](https://nextjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Docker Ready](https://img.shields.io/badge/Docker-ready-blue?logo=docker)](https://www.docker.com/)

</div>

---

> 🚨 **郑重声明**：部署后为空壳应用，无内置播放源，需自行配置。请勿在中国大陆社交平台宣传本项目。

## ⚡ 快速开始

```bash
# 克隆仓库
git clone https://github.com/your-repo/vidora.git

# 使用 Docker Compose 启动 (推荐 Kvrocks)
docker compose up -d
```

## 🚀 部署方式

### 方案一：Kvrocks（推荐）

高性能磁盘存储，数据持久化，适合长期使用。

```yml
services:
  vidora-core:
    image: ghcr.io/bauw2008/vidora:latest
    container_name: vidora-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=kvrocks
      - KVROCKS_URL=redis://vidora-kvrocks:6666
    networks:
      - vidora-network
    depends_on:
      - vidora-kvrocks
  vidora-kvrocks:
    image: apache/kvrocks
    container_name: vidora-kvrocks
    restart: unless-stopped
    volumes:
      - kvrocks-data:/var/lib/kvrocks
    networks:
      - vidora-network
networks:
  vidora-network:
volumes:
  kvrocks-data:
```

### 方案二：Redis

轻量级方案，适合快速部署。

```yml
services:
  vidora-core:
    image: ghcr.io/bauw2008/vidora:latest
    container_name: vidora-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=redis
      - REDIS_URL=redis://vidora-redis:6379
    networks:
      - vidora-network
    depends_on:
      - vidora-redis
  vidora-redis:
    image: redis:alpine
    container_name: vidora-redis
    restart: unless-stopped
    command: redis-server --save 60 1
    volumes:
      - ./data:/data
    networks:
      - vidora-network
networks:
  vidora-network:
```

### 方案三：Upstash

云端 Redis，无需维护数据库实例，适合 Serverless 部署。

1. 在 [Upstash](https://upstash.com/) 创建 Redis 实例
2. 获取 `UPSTASH_URL` 和 `UPSTASH_TOKEN`

```yml
services:
  vidora-core:
    image: ghcr.io/bauw2008/vidora:latest
    container_name: vidora-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=upstash
      - UPSTASH_URL=https://xxx.upstash.io
      - UPSTASH_TOKEN=your_token
```

### 方案四：EdgeOne

腾讯云全托管平台，无存储限制。

1. 导入 GitHub 仓库 → 2. 配置环境变量 → 3. 绑定域名

**推荐搭配 Upstash 使用，零运维。**

### 🏠 OpenWrt 路由器部署

```yml
services:
  vidora-core:
    image: ghcr.io/bauw2008/vidora:latest
    network_mode: host
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=kvrocks
      - KVROCKS_URL=redis://127.0.0.1:6666
      - PORT=3060
    depends_on:
      - vidora-kvrocks
  vidora-kvrocks:
    image: apache/kvrocks
    ports:
      - '6666:6666'
    volumes:
      - kvrocks-data:/var/lib/kvrocks
volumes:
  kvrocks-data:
```

## ⚙️ 配置文件

部署后在管理后台配置，示例：

```json
{
  "cache_time": 7200,
  "api_site": {
    "mysite": {
      "api": "http://xxx.com/api.php/provide/vod",
      "name": "我的资源站",
      "detail": "http://xxx.com"
    }
  },
  "custom_category": [
    { "name": "华语电影", "type": "movie", "query": "华语" },
    { "name": "美剧", "type": "tv", "query": "美剧" }
  ]
}
```

支持标准苹果 CMS V10 API 格式。

## 📋 环境变量

| 变量 | 说明 | 必填 |
|------|------|:----:|
| `USERNAME` | 站长账号 | ✅ |
| `PASSWORD` | 站长密码 | ✅ |
| `NEXT_PUBLIC_STORAGE_TYPE` | 存储类型 (redis/kvrocks/upstash) | ✅ |
| `REDIS_URL` / `KVROCKS_URL` / `UPSTASH_URL` | 数据库连接地址 | ✅ |
| `UPSTASH_TOKEN` | Upstash Token (仅 upstash) | - |
| `SITE_BASE` | 站点 URL | - |
| `NEXT_PUBLIC_SITE_NAME` | 站点名称，默认 Vidora | - |
| `ANNOUNCEMENT` | 站点公告 | - |
| `AUTH_TOKEN` | 授权码 | - |

<details>
<summary>📖 更多环境变量</summary>

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NEXT_PUBLIC_SEARCH_MAX_PAGE` | 搜索最大页数 | 5 |
| `NEXT_PUBLIC_DOUBAN_PROXY_TYPE` | 豆瓣数据源 (direct/cors-proxy-zwei/cmliussss-cdn-tencent/cmliussss-cdn-ali/custom) | direct |
| `NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE` | 豆瓣图片代理 (direct/server/img3/cmliussss-cdn-tencent/cmliussss-cdn-ali/custom) | direct |
| `NEXT_PUBLIC_DISABLE_YELLOW_FILTER` | 关闭内容过滤 | false |
| `NEXT_PUBLIC_FLUID_SEARCH` | 流式搜索输出 | true |

</details>

## ✨ 功能亮点

| 功能 | 描述 |
|------|------|
| 🔍 **多源聚合** | 一键搜索，聚合多站资源 |
| 📺 **直播支持** | 兼容 TVBox 直播源 |
| 🎬 **豆瓣集成** | 海量影视元数据与评分 |
| ▶️ **在线播放** | ArtPlayer + HLS.js，流畅体验 |
| ❤️ **数据同步** | 收藏、播放记录云端同步 |
| 🌓 **主题切换** | 深色/浅色自由切换 |
| 📱 **响应式** | 完美适配各种设备 |

## 🔒 安全声明

- ⚠️ **仅供个人学习使用**
- ⚠️ **请勿公开分享或商业使用**
- ⚠️ **中国大陆地区不提供服务**
- ⚠️ **用户需自行承担法律责任**

## 🙏 致谢

- [MoonTechLab/LunaTV](https://github.com/MoonTechLab/LunaTV) — 原始项目
- [ArtPlayer](https://github.com/zhw2590582/ArtPlayer) — 播放器
- [HLS.js](https://github.com/video-dev/hls.js) — 流媒体支持
- [Zwei](https://github.com/bestzwei) — 豆瓣代理
- [CMLiussss](https://github.com/cmliu) — CDN 服务

---

<div align="center">

[MIT](LICENSE) © 2025 Vidora

如果觉得不错，给个 ⭐ Star 支持一下吧！

[![Star History Chart](https://api.star-history.com/svg?repos=MoonTechLab/LunaTV&type=Date)](https://www.star-history.com/#MoonTechLab/LunaTV&Date)

</div>