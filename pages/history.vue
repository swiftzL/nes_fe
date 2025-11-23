<script setup lang="ts">
const retroApi = useRetroApi()
const runtime = useRuntimeConfig()
const hasAuth = computed(() => Boolean(runtime.public.authToken))

const {
  data: history,
  pending,
  error,
  refresh
} = await useAsyncData('history-client', () => retroApi.fetchHistory(), {
  immediate: hasAuth.value,
  server: false,
  default: () => []
})
</script>

<template>
  <RetroPanel>
    <template #title>游玩历史</template>
    <div v-if="!hasAuth" class="notice-box">
      历史记录需要认证，设置 NES_API_TOKEN 后可在此同步数据。
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
  </RetroPanel>
</template>
