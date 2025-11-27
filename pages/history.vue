<script setup lang="ts">
const retroApi = useRetroApi()
const { isAuthenticated, hasClerk, initClerkState } = useAuthState()

onMounted(() => {
  initClerkState()
})

const {
  data: history,
  pending,
  error,
  refresh
} = await useAsyncData('history-client', () => retroApi.fetchHistory(), {
  immediate: false,
  server: false,
  default: () => []
})

watch(isAuthenticated, (val) => {
  if (val) {
    refresh()
  } else {
    history.value = []
  }
}, { immediate: true })
</script>

<template>
  <RetroPanel>
    <template #title>游玩历史</template>
    <ClientOnly>
      <div v-if="!isAuthenticated" class="notice-box">
        <template v-if="hasClerk">
          <p>
            请先
            <SignInButton mode="modal" v-slot="slotProps">
              <span class="auth-link" @click="slotProps?.open?.()">登录</span>
            </SignInButton>
            以查看游玩历史。
          </p>
        </template>
        <template v-else>
          <p>请在 <code>.env</code> 中设置 <code>CLERK_PUBLISHABLE_KEY</code> 和 <code>CLERK_SECRET_KEY</code> 以启用登录功能。</p>
        </template>
      </div>
      <div v-else>
        <div class="actions" style="display:flex; gap:1rem; margin-bottom:1rem;">
          <button class="retro-button" type="button" @click="refresh" :disabled="pending">
            {{ pending ? '同步中...' : '同步历史' }}
          </button>
        </div>
        <div v-if="pending" class="notice-box">读取服务器历史记录...</div>
        <div v-else-if="error" class="notice-box">{{ error.statusMessage }}</div>
        <div v-else-if="history?.length" class="history-grid">
          <article v-for="item in history" :key="item.game_id" class="detail-card">
            <h3>{{ item.title }}</h3>
            <p class="game-card__meta">
              {{ item.type }} · {{ item.language }} · {{ item.region }}
            </p>
            <p>游玩时长：{{ item.play_time || '未知' }}</p>
            <p>最近游玩：{{ item.update_time || item.create_time || '未知' }}</p>
            <NuxtLink :to="`/games/${item.game_id}`" class="badge">查看游戏</NuxtLink>
          </article>
        </div>
        <div v-else class="notice-box">尚无历史记录。</div>
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
