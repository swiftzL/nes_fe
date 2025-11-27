<template>
  <div class="retro-shell">
    <header class="retro-header">
      <NuxtLink class="logo" to="/">
        <span class="logo__chip">NES</span>
        Retro Hub
      </NuxtLink>
      <nav class="retro-nav">
        <NuxtLink to="/" exact-active-class="is-active">主页</NuxtLink>
        <NuxtLink to="/types/nes" active-class="is-active">平台</NuxtLink>
        <NuxtLink to="/favorites" active-class="is-active">收藏</NuxtLink>
        <NuxtLink to="/history" active-class="is-active">历史</NuxtLink>
        <NuxtLink to="/saves" active-class="is-active">存档</NuxtLink>
      </nav>
      <div class="header-actions">
        <div class="status-indicator">
          <span class="led"></span>
          ONLINE
        </div>
        <ClientOnly>
          <template v-if="hasClerk">
            <SignedIn>
              <div class="user-menu">
                <UserButton
                  :after-sign-out-url="'/'"
                  :appearance="{
                    elements: {
                      avatarBox: 'user-avatar-box'
                    }
                  }"
                />
              </div>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal" v-slot="slotProps">
                <button
                  class="retro-button retro-button--ghost"
                  type="button"
                  @click="slotProps?.open?.()"
                >
                  登录
                </button>
              </SignInButton>
            </SignedOut>
          </template>
          <template v-else>
            <span class="retro-button retro-button--ghost retro-button--disabled">登录</span>
          </template>
        </ClientOnly>
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

<script setup lang="ts">
const runtime = useRuntimeConfig()
const hasClerk = computed(() => Boolean(runtime.public?.clerkPublishableKey))
</script>

<style scoped>
.retro-button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
