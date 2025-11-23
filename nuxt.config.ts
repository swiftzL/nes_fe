export default defineNuxtConfig({
  ssr: true,
  devtools: { enabled: false },
  app: {
    head: {
      title: 'NES Retro Hub',
      meta: [
        { name: 'description', content: '复古NES风格的怀旧游戏平台，浏览经典游戏、收藏与历史。' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Grotesk:wght@400;500;700&display=swap' }
      ]
    }
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiBase: process.env.NES_API_BASE || 'http://localhost:8080',
      authToken: process.env.NES_API_TOKEN || ''
    }
  },
  components: [{ path: '~/components', extensions: ['vue'] }],
  nitro: {
    routeRules: {
      '/api/**': { proxy: { to: 'http://localhost:8080/api/**' } }
    }
  },
  future: {
    compatibilityVersion: 4
  }
})
