# NES Retro Hub

复古 NES 风格的 SSR 前端，基于 Nuxt 3 + Vue 构建。项目调用 `http://localhost:8080` 提供的游戏服务器 API，可浏览推荐、排行榜、按平台分类、搜索、收藏与历史等数据。

## 主要特性

- ⚡️ **Nuxt 3 SSR**：默认服务端渲染，提升首屏与 SEO
- 🕹️ **NES 主题 UI**：像素字体、发光指示灯、卡带式卡片
- 🔍 **搜索与筛选**：关键字搜索、语言过滤、分页列表
- 📊 **排行榜与推荐**：调取 `/api/games/recommend`、`/api/games/ranking`
- ❤️ **收藏/历史入口**：详情页可加入/取消收藏并记录游玩历史
- 💾 **云存档管理**：详情页支持单个游戏存档刷新/上传/删除，`/saves` 页面集中查看所有存档

## 快速开始

```bash
# 安装依赖（需要 Node.js 18+）
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
npm run start
```

## 环境变量

在根目录创建 `.env` 并配置：

```
NES_API_BASE=http://localhost:8080
NES_API_TOKEN=Bearer your-token
NES_ROM_BASE=https://bin9.vae88.com/files/
NES_EMULATOR_BASE=https://cdn.jsdelivr.net/npm/@ttgame/emulatorjs@4.2.3/data/
```

- `NES_API_BASE`：后端 API 地址
- `NES_API_TOKEN`：可选，携带认证信息以调用收藏、历史、存档接口
- `NES_ROM_BASE`：ROM 文件基础地址，触屏启动页会拼接 `binary_file`
- `NES_EMULATOR_BASE`：EmulatorJS 静态资源地址，可改为自建 CDN

## 目录结构

```
├─ app.vue                # Nuxt 入口
├─ nuxt.config.ts         # 配置 & 运行时变量
├─ assets/css/main.css    # NES 主题样式
├─ components/            # 复用组件（GameCard、RetroPanel）
├─ composables/useRetroApi.ts # API 封装与错误处理
├─ pages/                 # 首页、详情、平台、收藏、历史、存档页面
└─ types/api.ts           # TypeScript API 类型
```

## API 集成

`composables/useRetroApi.ts` 封装了 API 文档中的公开与用户接口，统一解包 `{ code, data, msg }`。页面通过 `useAsyncData`/`useLazyAsyncData` 在 SSR 或客户端获取数据，并根据需要显示加载状态。

## 复古设计要点

- `Press Start 2P` 与 `Space Grotesk` 作为主字体
- 渐变背景 + LED 指示灯 + 卡带风格卡片
- 自定义 `RetroPanel`、`GameCard` 组件方便复用

欢迎根据实际 API 返回的数据进一步丰富页面，例如添加 ROM 在线预览或更多筛选条件。
