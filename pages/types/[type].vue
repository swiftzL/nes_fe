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

// For mobile select dropdown
const handleTypeChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  if (target.value) {
    router.push(`/types/${target.value}`)
  }
}

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
      
      <!-- Mobile Dropdown -->
      <div class="mobile-only-block" style="margin-bottom: 1rem;">
        <select :value="platformType" @change="handleTypeChange" style="width: 100%; padding: 0.8rem; background: #0c111d; border: 2px solid var(--nes-border); color: var(--nes-soft); border-radius: 8px;">
          <option v-for="type in platformTypes" :key="type" :value="type">{{ type }}</option>
        </select>
      </div>

      <!-- Desktop Tabs -->
      <div class="type-tabs desktop-only">
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
      
      <div class="pagination">
        <button class="retro-button" :disabled="currentPage === 1" @click="gotoPage(currentPage - 1)">上一页</button>
        <span class="badge">{{ currentPage }} / {{ totalPages }}</span>
        <button class="retro-button" :disabled="currentPage === totalPages" @click="gotoPage(currentPage + 1)">下一页</button>
      </div>
    </RetroPanel>
  </div>
</template>
