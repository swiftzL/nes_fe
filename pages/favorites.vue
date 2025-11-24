<script setup lang="ts">
const retroApi = useRetroApi()
const runtime = useRuntimeConfig()
const hasAuth = computed(() => Boolean(runtime.public.hasAuth))

const {
  data: favorites,
  pending,
  error,
  refresh
} = await useAsyncData('favorites-client', () => retroApi.fetchFavorites(), {
  immediate: hasAuth.value,
  default: () => []
})
</script>

<template>
  <RetroPanel>
    <template #title>我的收藏</template>
    <div v-if="!hasAuth" class="notice-box">
      请在运行前设置 <code>NES_API_TOKEN</code> 环境变量以携带认证信息，然后刷新页面以同步收藏。
    </div>
    <div v-else>
      <div class="actions" style="margin-bottom:1rem; display:flex; gap:1rem;">
        <button class="retro-button" type="button" @click="refresh" :disabled="pending">
          {{ pending ? '刷新中...' : '刷新收藏' }}
        </button>
      </div>
      <div v-if="pending" class="notice-box">正在加载收藏列表...</div>
      <div v-else-if="error" class="notice-box">{{ error.statusMessage }}</div>
      <div v-else-if="favorites?.length" class="game-grid">
        <GameCard v-for="game in favorites" :key="game.game_id" :game="game" />
      </div>
      <div v-else class="notice-box">收藏夹为空，前往游戏详情页点击“加入收藏”。</div>
    </div>
  </RetroPanel>
</template>
