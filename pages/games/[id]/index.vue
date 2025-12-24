<script setup lang="ts">
const route = useRoute()
const retroApi = useRetroApi()
const { buildImageUrl } = useImageBase()
const { isAuthenticated, hasClerk, initClerkState } = useAuthState()

onMounted(() => {
  initClerkState()
})

const gameId = computed(() => Number(route.params.id))

const { data: game, pending, error } = await useAsyncData(
  () => `game-${gameId.value}`,
  () => retroApi.fetchGameById(gameId.value),
  { watch: [gameId] }
)

const coverImageSrc = computed(() =>
  buildImageUrl(game.value?.title_screen_image1 || game.value?.title_screen_image || '')
)

const favoriteState = reactive({ isFavorite: false, loading: false, message: '' })
const saveAction = reactive({ loading: false, message: '' })

const {
  data: saveData,
  pending: savePending,
  error: saveError,
  status: saveStatus,
  execute: fetchGameSave
} = await useLazyAsyncData(() => `save-${gameId.value}`, () => retroApi.fetchSave(gameId.value), {
  immediate: false,
  server: false,
  default: () => null
})

const checkFavoriteState = async () => {
  if (!isAuthenticated.value || !gameId.value) return
  try {
    const status = await retroApi.checkFavorite(gameId.value)
    favoriteState.isFavorite = status.is_favorite
  } catch (err) {
    console.error(err)
  }
}

watch(isAuthenticated, () => {
  favoriteState.message = ''
  saveAction.message = ''
  checkFavoriteState()
  if (isAuthenticated.value) {
    fetchGameSave()
  } else {
    saveData.value = null
  }
})

watch(gameId, () => {
  saveAction.message = ''
  if (isAuthenticated.value) {
    fetchGameSave()
  } else {
    saveData.value = null
  }
})

watch(isAuthenticated, (val) => {
  if (val) {
    checkFavoriteState()
    fetchGameSave()
  }
}, { immediate: true })

const toggleFavorite = async () => {
  if (!isAuthenticated.value || !game.value) {
    favoriteState.message = '请先登录以使用收藏功能。'
    return
  }
  favoriteState.loading = true
  try {
    if (favoriteState.isFavorite) {
      await retroApi.removeFavorite(game.value.game_id)
      favoriteState.isFavorite = false
      favoriteState.message = '已取消收藏'
    } else {
      await retroApi.addFavorite({ game_id: game.value.game_id })
      favoriteState.isFavorite = true
      favoriteState.message = '收藏成功'
    }
  } catch (err: any) {
    favoriteState.message = err?.statusMessage || '操作失败'
  } finally {
    favoriteState.loading = false
  }
}

const deleteSave = async () => {
  if (!isAuthenticated.value || !game.value) {
    saveAction.message = '请先登录以删除存档。'
    return
  }
  saveAction.loading = true
  saveAction.message = ''
  try {
    await retroApi.deleteSave(game.value.game_id)
    saveAction.message = '已删除存档'
    await fetchGameSave()
  } catch (err: any) {
    saveAction.message = err?.statusMessage || '删除失败'
  } finally {
    saveAction.loading = false
  }
}
</script>

<template>
  <div>
    <RetroPanel>
      <template #title>游戏详情</template>
      <div v-if="pending" class="notice-box">加载游戏信息...</div>
      <div v-else-if="error" class="notice-box">{{ error.statusMessage }}</div>
      <div v-else-if="game" class="detail-layout">
        <div class="detail-card">
          <div class="game-card__art" style="margin-bottom:1rem;">
            <img v-if="coverImageSrc" :src="coverImageSrc" :alt="game.title" />
            <div v-else class="notice-box">暂无封面</div>
          </div>
          <h2>{{ game.title }}</h2>
          <p class="game-card__meta">
            <span>{{ game.type }}</span>
            <span>· {{ game.language }}</span>
            <span v-if="game.region">· {{ game.region }}</span>
          </p>
          <div class="action-buttons">
            <NuxtLink class="retro-button" :to="`/games/${game.game_id}/touch`">
              立即启动
            </NuxtLink>
            <button class="retro-button" type="button" @click="toggleFavorite" :disabled="favoriteState.loading">
              {{ favoriteState.isFavorite ? '取消收藏' : '加入收藏' }}
            </button>
          </div>
          <p v-if="favoriteState.message" class="badge" style="margin-top:1rem;">{{ favoriteState.message }}</p>
          <ClientOnly>
            <div v-if="!isAuthenticated" class="notice-box" style="margin-top:1rem;">
              <template v-if="hasClerk">
                <SignInButton mode="modal" v-slot="slotProps">
                  <span class="auth-link" @click="slotProps?.open?.()">登录</span>
                </SignInButton>
                后可使用收藏、历史、存档等功能。
              </template>
              <template v-else>
                请配置 Clerk 密钥以启用登录功能。
              </template>
            </div>
          </ClientOnly>
        </div>
        <div class="detail-card">
          <h2>元数据</h2>
          <table class="meta-table">
            <tbody>
              <tr>
                <td>游戏ID</td>
                <td>{{ game.game_id }}</td>
              </tr>
              <tr>
                <td>ROM 文件</td>
                <td>{{ game.binary_file }}</td>
              </tr>
              <tr>
                <td>UID</td>
                <td>{{ game.game_uid || 'N/A' }}</td>
              </tr>
              <tr>
                <td>点击量</td>
                <td>{{ game.click_count || '无数据' }}</td>
              </tr>
            </tbody>
          </table>
          <div style="margin-top:1.5rem;">
            <NuxtLink :to="`/types/${game.type}`" class="badge">更多 {{ game.type }} 游戏</NuxtLink>
          </div>
        </div>
        <div class="detail-card">
          <h2>存档管理</h2>
          <section class="detail-section">
            <ClientOnly>
              <div v-if="!isAuthenticated" class="notice-box">
                <template v-if="hasClerk">
                  <SignInButton mode="modal" v-slot="slotProps">
                    <span class="auth-link" @click="slotProps?.open?.()">登录</span>
                  </SignInButton>
                  后可管理存档。
                </template>
                <template v-else>
                  请配置 Clerk 密钥以启用存档功能。
                </template>
              </div>
              <div v-else>
              <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:center; margin-bottom:1rem;">
                <button class="retro-button" type="button" @click="fetchGameSave" :disabled="savePending">
                  {{ savePending ? '同步中...' : '刷新存档' }}
                </button>
                <span class="badge" v-if="saveStatus === 'success'">存档信息已同步</span>
              </div>
              <div v-if="savePending" class="notice-box">查询服务器存档...</div>
              <div v-else-if="saveError" class="notice-box">{{ saveError.statusMessage }}</div>
              <div v-else-if="saveData" class="save-box">
                <p>存档文件：<a :href="saveData.save_file" target="_blank" rel="noopener">下载链接</a></p>
                <p>更新于：{{ saveData.update_time }}</p>
                <button class="retro-button" type="button" @click="deleteSave" :disabled="saveAction.loading">
                  删除当前存档
                </button>
              </div>
              <div v-else class="notice-box">暂无该游戏存档，可在触屏模式保存后同步。</div>
              <p v-if="saveAction.message" class="badge" style="margin-top:0.6rem;">{{ saveAction.message }}</p>
            </div>
          </ClientOnly>
          </section>
        </div>
      </div>
    </RetroPanel>
  </div>
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
