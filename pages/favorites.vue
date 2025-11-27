<script setup lang="ts">
const retroApi = useRetroApi()
const { isAuthenticated, hasClerk, initClerkState } = useAuthState()

// 初始化 Clerk 状态
onMounted(() => {
  initClerkState()
})

const {
  data: favorites,
  pending,
  error,
  refresh
} = await useAsyncData('favorites-client', () => retroApi.fetchFavorites(), {
  immediate: false,
  server: false,
  default: () => []
})

// 当认证状态变化时自动刷新
watch(isAuthenticated, (val) => {
  if (val) {
    refresh()
  } else {
    favorites.value = []
  }
}, { immediate: true })
</script>

<template>
  <RetroPanel>
    <template #title>我的收藏</template>
    <ClientOnly>
      <div v-if="!isAuthenticated" class="notice-box">
        <template v-if="hasClerk">
          <p>
            请先
            <SignInButton mode="modal" v-slot="slotProps">
              <span class="auth-link" @click="slotProps?.open?.()">登录</span>
            </SignInButton>
            以查看收藏列表。
          </p>
        </template>
        <template v-else>
          <p>请在 <code>.env</code> 中设置 <code>CLERK_PUBLISHABLE_KEY</code> 和 <code>CLERK_SECRET_KEY</code> 以启用登录功能。</p>
        </template>
      </div>
      <div v-else>
        <div class="actions" style="margin-bottom:1rem; display:flex; gap:1rem;">
          <button class="retro-button" type="button" @click="refresh" :disabled="pending">
            {{ pending ? '刷新中...' : '刷新收藏' }}
          </button>
        </div>
        <div v-if="pending" class="notice-box">正在加载收藏列表...</div>
        <div v-else-if="error" class="notice-box">{{ error.statusMessage }}</div>
        <div v-else-if="favorites?.length" class="game-grid favorites-grid">
          <GameCard v-for="game in favorites" :key="game.game_id" :game="game" size="small" />
        </div>
        <div v-else class="notice-box">收藏夹为空，前往游戏详情页点击"加入收藏"。</div>
      </div>
      <template #fallback>
        <div class="notice-box">加载中...</div>
      </template>
    </ClientOnly>
  </RetroPanel>
</template>

<style scoped>
.auth-link {
  color: var(--nes-accent, #ff4655);
  text-decoration: underline;
  cursor: pointer;
}
.auth-link:hover {
  color: var(--nes-gold, #f3d45c);
}
</style>
