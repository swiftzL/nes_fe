<script setup lang="ts">
import type { Game } from '~/types/api'

const retroApi = useRetroApi()
const searchQuery = ref('')
const page = ref(1)
const languageFilter = ref('')

const { data: types } = await useAsyncData('game-types', () => retroApi.fetchTypes())
const typeList = computed(() => types.value || [])
const selectedType = ref(typeList.value[0] || 'NES')

watch(
  () => typeList.value,
  newTypes => {
    if (newTypes.length && !newTypes.includes(selectedType.value)) {
      selectedType.value = newTypes[0]
    }
  }
)

watch(selectedType, () => {
  page.value = 1
})

const { data: recommend } = await useAsyncData('recommend', () => retroApi.fetchRecommend(12), {
  default: () => []
})
const { data: ranking } = await useAsyncData('ranking', () => retroApi.fetchRanking(10), {
  default: () => []
})

const {
  data: gamesPage,
  pending: gamesPending
} = await useAsyncData(
  'games-by-type',
  () =>
    retroApi.fetchGamesByType({
      type: selectedType.value,
      page: page.value,
      page_size: 12,
      language: languageFilter.value || undefined
    }),
  {
    watch: [selectedType, page, languageFilter],
    default: () => null
  }
)

const {
  data: searchResults,
  pending: searchPending,
  execute: runSearch,
  status: searchStatus
} = await useLazyAsyncData('search-games', () => retroApi.searchByTitle(searchQuery.value), {
  immediate: false,
  server: false,
  default: () => []
})

const heroGame = computed<Game | undefined>(() => recommend.value?.[0])
const showingSearch = computed(() => searchQuery.value.trim().length > 0)

const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    return
  }
  await runSearch()
}

const resetSearch = () => {
  searchQuery.value = ''
}

const totalPages = computed(() => {
  if (!gamesPage.value) return 1
  return Math.max(1, Math.ceil(gamesPage.value.total / gamesPage.value.page_size))
})

const changePage = (direction: 'prev' | 'next') => {
  if (direction === 'prev' && page.value > 1) {
    page.value -= 1
  }
  if (direction === 'next' && page.value < totalPages.value) {
    page.value += 1
  }
}
</script>

<template>
  <div>
    <section class="hero-panel">
      <div class="hero-panel__content">
        <p class="badge">8-BIT LIBRARY</p>
        <h1>NES Retro Hub</h1>
        <p>基于复古NES主机的怀旧游戏厅，支持搜索、类型浏览、排行榜与收藏。全部数据实时来自提供的 API。</p>
        <NuxtLink class="retro-button" to="/types/NES">
          浏览平台
          <span aria-hidden>⟶</span>
        </NuxtLink>
      </div>
      <div class="hero-panel__art" v-if="heroGame">
        <GameCard :game="heroGame" compact />
      </div>
    </section>

    <RetroPanel class="search-panel">
      <template #title>快速搜索</template>
      <div class="search-bar">
        <input v-model="searchQuery" type="text" placeholder="输入游戏标题，例如 Mario" @keyup.enter="handleSearch" />
        <button class="retro-button" type="button" @click="handleSearch" :disabled="searchPending">
          {{ searchPending ? '搜索中...' : '开始搜索' }}
        </button>
        <button v-if="showingSearch" class="retro-button" type="button" style="background:var(--nes-blue); color:#111" @click="resetSearch">
          清空
        </button>
      </div>
      <div class="type-tabs">
        <div
          v-for="type in typeList"
          :key="type"
          class="type-tab"
          :class="{ 'is-active': type === selectedType }"
          @click="selectedType = type"
        >
          {{ type }}
        </div>
      </div>
    </RetroPanel>

    <RetroPanel v-if="showingSearch">
      <template #title>
        搜索结果
        <span v-if="searchStatus === 'success' && searchResults?.length">· {{ searchResults.length }} 个</span>
      </template>
      <div v-if="searchPending" class="notice-box">正在通过 API 查询...</div>
      <div v-else-if="searchResults?.length" class="game-grid">
        <GameCard v-for="game in searchResults" :key="game.game_id" :game="game" />
      </div>
      <div v-else class="notice-box">暂无匹配的游戏，请尝试其他关键字。</div>
    </RetroPanel>

    <RetroPanel>
      <template #title>
        {{ selectedType }} 游戏库
      </template>
      <div class="filter-row" style="display:flex; gap:1rem; align-items:center; margin-bottom:1rem; flex-wrap:wrap;">
        <label style="display:flex; flex-direction:column; font-size:0.8rem; gap:0.3rem;">
          语言筛选
          <select v-model="languageFilter" style="background:#0c111d; border:2px solid var(--nes-border); color:var(--nes-soft); padding:0.4rem 0.8rem; border-radius:8px;">
            <option value="">全部</option>
            <option value="EN">EN</option>
            <option value="JP">JP</option>
            <option value="CN">CN</option>
          </select>
        </label>
        <NuxtLink :to="`/types/${selectedType}`" class="badge">前往平台详情</NuxtLink>
      </div>
      <div v-if="gamesPending" class="notice-box">加载 {{ selectedType }} 游戏列表...</div>
      <div v-else-if="gamesPage?.games?.length" class="game-grid">
        <GameCard v-for="game in gamesPage.games" :key="game.game_id" :game="game" />
      </div>
      <div v-else class="notice-box">该类型暂无数据。</div>
      <div class="pagination" style="display:flex; justify-content:space-between; margin-top:1.5rem;">
        <button class="retro-button" :disabled="page === 1" @click="changePage('prev')">上一页</button>
        <span class="badge">第 {{ page }} / {{ totalPages }} 页</span>
        <button class="retro-button" :disabled="page === totalPages" @click="changePage('next')">下一页</button>
      </div>
    </RetroPanel>

    <div class="detail-layout" style="margin-top:2.5rem;">
      <RetroPanel title="推荐精选">
        <div class="game-grid">
          <GameCard v-for="game in recommend" :key="game.game_id" :game="game" />
        </div>
      </RetroPanel>
      <RetroPanel title="点击排行榜">
        <ol class="ranking-list">
          <li v-for="(game, index) in ranking" :key="game.game_id" class="ranking-item">
            <strong>#{{ index + 1 }}</strong>
            <div>
              <div>{{ game.title }}</div>
              <div class="game-card__meta">{{ game.type }} · {{ game.language }}</div>
            </div>
            <span class="badge">{{ game.click_count || 0 }} 点击</span>
          </li>
        </ol>
      </RetroPanel>
    </div>
  </div>
</template>
