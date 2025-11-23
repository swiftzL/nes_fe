<template>
  <div class="retro-shell">
    <header class="retro-header">
      <NuxtLink class="logo" to="/">
        <span class="logo__chip">NES</span>
        Retro Hub
      </NuxtLink>
      <nav class="retro-nav">
        <NuxtLink to="/" exact-active-class="is-active">主页</NuxtLink>
        <NuxtLink to="/types/NES" active-class="is-active">平台</NuxtLink>
        <NuxtLink to="/favorites" active-class="is-active">收藏</NuxtLink>
        <NuxtLink to="/history" active-class="is-active">历史</NuxtLink>
        <NuxtLink to="/saves" active-class="is-active">存档</NuxtLink>
      </nav>
      <div class="status-indicator">
        <span class="led"></span>
        ONLINE
      </div>
    </header>

    <main class="retro-main">
      <slot />
    </main>

    <footer class="retro-footer">
      <p>© {{ new Date().getFullYear() }} NES Retro Hub · 重温红白机的像素魅力</p>
      <div class="footer-meta">
        <span>Powered by Nuxt SSR</span>
        <span>API: localhost:8080</span>
      </div>
    </footer>
  </div>
</template>
