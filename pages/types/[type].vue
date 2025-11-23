<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const retroApi = useRetroApi()

const platformType = computed(() => route.params.type as string)
const currentPage = ref(Number(route.query.page) || 1)

watch(
  () => route.query.page,
  value => {
    const pageNumber = Number(value) || 1
    if (pageNumber !== currentPage.value) {
      currentPage.value = pageNumber
    }
  }
)

const { data: platformTypes } = await useAsyncData('types-nav', () => retroApi.fetchTypes())

const {
  data: pageData,
  pending
} = await useAsyncData(
  () => `type-${platformType.value}-${currentPage.value}`,
  () => retroApi.fetchGamesByType({ type: platformType.value, page: currentPage.value, page_size: 20 }),
  { watch: [platformType, currentPage] }
)

const totalPages = computed(() => {
  if (!pageData.value) return 1
  return Math.max(1, Math.ceil(pageData.value.total / pageData.value.page_size))
})

const gotoPage = (page: number) => {
  if (page < 1 || page > totalPages.value) return
  router.push({ query: { page } })
}
</script>

<template>
  <div>
    <RetroPanel>
      <template #title>{{ platformType }} 平台游戏库</template>
      <div class="type-tabs">
        <NuxtLink
          v-for="type in platformTypes"
          :key="type"
          :to="`/types/${type}`"
          class="type-tab"
          :class="{ 'is-active': type === platformType }"
        >
          {{ type }}
        </NuxtLink>
      </div>
      <div v-if="pending" class="notice-box">正在加载 {{ platformType }} 游戏...</div>
      <div v-else-if="pageData?.games?.length" class="game-grid" style="margin-top:1.5rem;">
        <GameCard v-for="game in pageData.games" :key="game.game_id" :game="game" />
      </div>
      <div v-else class="notice-box">暂无该类型游戏。</div>
      <div class="pagination" style="display:flex; justify-content:center; gap:1rem; margin-top:1.5rem;">
        <button class="retro-button" :disabled="currentPage === 1" @click="gotoPage(currentPage - 1)">上一页</button>
        <span class="badge">{{ currentPage }} / {{ totalPages }}</span>
        <button class="retro-button" :disabled="currentPage === totalPages" @click="gotoPage(currentPage + 1)">下一页</button>
      </div>
    </RetroPanel>
  </div>
</template>
