<script setup lang="ts">
const route = useRoute()
const retroApi = useRetroApi()
const runtime = useRuntimeConfig()
const hasAuth = computed(() => Boolean(runtime.public.authToken))

const gameId = computed(() => Number(route.params.id))

const { data: game, pending, error } = await useAsyncData(
  () => `game-${gameId.value}`,
  () => retroApi.fetchGameById(gameId.value),
  { watch: [gameId] }
)

const favoriteState = reactive({ isFavorite: false, loading: false, message: '' })
const historyForm = reactive({ playTime: '30分钟', loading: false, message: '' })
const saveUpload = reactive<{ file: File | null; loading: boolean; message: string }>({
  file: null,
  loading: false,
  message: ''
})
const saveInput = ref<HTMLInputElement | null>(null)

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
  if (!hasAuth.value || !gameId.value) return
  try {
    const status = await retroApi.checkFavorite(gameId.value)
    favoriteState.isFavorite = status.is_favorite
  } catch (err) {
    console.error(err)
  }
}

watch(hasAuth, () => {
  favoriteState.message = ''
  historyForm.message = ''
  saveUpload.message = ''
  checkFavoriteState()
  if (hasAuth.value) {
    fetchGameSave()
  } else {
    saveData.value = null
  }
})

watch(gameId, () => {
  saveUpload.message = ''
  if (hasAuth.value) {
    fetchGameSave()
  } else {
    saveData.value = null
  }
})

onMounted(() => {
  checkFavoriteState()
  if (hasAuth.value) {
    fetchGameSave()
  }
})

const toggleFavorite = async () => {
  if (!hasAuth.value || !game.value) {
    favoriteState.message = '未配置认证信息，无法调用收藏接口。'
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

const submitHistory = async () => {
  if (!hasAuth.value || !game.value) {
    historyForm.message = '未配置认证信息，无法记录历史。'
    return
  }
  if (!historyForm.playTime.trim()) {
    historyForm.message = '请输入游玩时长，例如 30分钟。'
    return
  }
  historyForm.loading = true
  try {
    await retroApi.addHistory({ game_id: game.value.game_id, play_time: historyForm.playTime })
    historyForm.message = '已记录游玩历史'
  } catch (err: any) {
    historyForm.message = err?.statusMessage || '记录失败'
  } finally {
    historyForm.loading = false
  }
}

const onSaveFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  saveUpload.file = target.files?.[0] || null
}

const submitSave = async () => {
  if (!hasAuth.value || !game.value) {
    saveUpload.message = '请先配置 NES_API_TOKEN 才能上传存档。'
    return
  }
  if (!saveUpload.file) {
    saveUpload.message = '请选择要上传的 .bin 存档文件。'
    return
  }
  const formData = new FormData()
  formData.append('game_id', String(game.value.game_id))
  formData.append('save_file', saveUpload.file)
  saveUpload.loading = true
  try {
    await retroApi.uploadSave(formData)
    saveUpload.message = '存档上传成功'
    if (saveInput.value) {
      saveInput.value.value = ''
    }
    saveUpload.file = null
    await fetchGameSave()
  } catch (err: any) {
    saveUpload.message = err?.statusMessage || '上传失败'
  } finally {
    saveUpload.loading = false
  }
}

const deleteSave = async () => {
  if (!hasAuth.value || !game.value) {
    saveUpload.message = '缺少认证信息，无法删除存档。'
    return
  }
  saveUpload.loading = true
  try {
    await retroApi.deleteSave(game.value.game_id)
    saveUpload.message = '已删除存档'
    await fetchGameSave()
  } catch (err: any) {
    saveUpload.message = err?.statusMessage || '删除失败'
  } finally {
    saveUpload.loading = false
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
            <img :src="game.title_screen_image || game.title_screen_image1" :alt="game.title" />
          </div>
          <h2>{{ game.title }}</h2>
          <p class="game-card__meta">
            <span>{{ game.type }}</span>
            <span>· {{ game.language }}</span>
            <span v-if="game.region">· {{ game.region }}</span>
          </p>
          <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-top:1.5rem;">
            <button class="retro-button" type="button">立即启动</button>
            <button class="retro-button" type="button" @click="toggleFavorite" :disabled="favoriteState.loading">
              {{ favoriteState.isFavorite ? '取消收藏' : '加入收藏' }}
            </button>
          </div>
          <p v-if="favoriteState.message" class="badge" style="margin-top:1rem;">{{ favoriteState.message }}</p>
          <div v-if="!hasAuth" class="notice-box" style="margin-top:1rem;">
            收藏、历史、存档等操作需要在运行环境中设置 NES_API_TOKEN。
          </div>
        </div>
        <div class="detail-card">
          <h2>元数据</h2>
          <table class="meta-table">
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
          </table>
          <div style="margin-top:1.5rem;">
            <NuxtLink :to="`/types/${game.type}`" class="badge">更多 {{ game.type }} 游戏</NuxtLink>
          </div>
        </div>
        <div class="detail-card">
          <h2>游玩记录 & 存档</h2>
          <section class="detail-section">
            <h3>添加游玩历史</h3>
            <p>向服务器提交游玩时长，便于在“游玩历史”页面回顾。</p>
            <input
              v-model="historyForm.playTime"
              type="text"
              placeholder="例如：30分钟"
              style="width:100%; margin:0.5rem 0; padding:0.6rem; border:2px solid var(--nes-border); border-radius:8px; background:#0b101c; color:var(--nes-soft);"
            />
            <button class="retro-button" type="button" @click="submitHistory" :disabled="historyForm.loading">
              {{ historyForm.loading ? '提交中...' : '记录游玩' }}
            </button>
            <p v-if="historyForm.message" class="badge" style="margin-top:0.8rem;">{{ historyForm.message }}</p>
          </section>
          <section class="detail-section">
            <h3>存档管理</h3>
            <div v-if="!hasAuth" class="notice-box">
              上传、读取、删除存档需要认证信息。请配置 NES_API_TOKEN。
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
                <button class="retro-button" type="button" @click="deleteSave" :disabled="saveUpload.loading">
                  删除当前存档
                </button>
              </div>
              <div v-else class="notice-box">暂无该游戏存档，尝试上传吧。</div>
              <form class="upload-form" style="margin-top:1rem; display:flex; flex-direction:column; gap:0.8rem;" @submit.prevent="submitSave">
                <input
                  ref="saveInput"
                  type="file"
                  accept=".bin,.sav"
                  @change="onSaveFileChange"
                  style="border:2px dashed var(--nes-border); padding:0.8rem; border-radius:10px; background:#0b101c; color:var(--nes-soft);"
                />
                <button class="retro-button" type="submit" :disabled="saveUpload.loading">
                  {{ saveUpload.loading ? '上传中...' : '上传存档文件' }}
                </button>
              </form>
              <p v-if="saveUpload.message" class="badge" style="margin-top:0.6rem;">{{ saveUpload.message }}</p>
            </div>
          </section>
        </div>
      </div>
    </RetroPanel>
  </div>
</template>
