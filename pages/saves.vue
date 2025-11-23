<script setup lang="ts">
const retroApi = useRetroApi()
const runtime = useRuntimeConfig()
const hasAuth = computed(() => Boolean(runtime.public.authToken))

const {
  data: saves,
  pending,
  error,
  refresh
} = await useAsyncData('user-saves', () => retroApi.fetchAllSaves(), {
  immediate: hasAuth.value,
  server: false,
  default: () => []
})

const uploadForm = reactive({ gameId: '', file: null as File | null, loading: false, message: '' })
const fileInput = ref<HTMLInputElement | null>(null)

watch(hasAuth, value => {
  uploadForm.message = ''
  if (value) {
    refresh()
  } else {
    saves.value = []
  }
})

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  uploadForm.file = target.files?.[0] || null
}

const submitUpload = async () => {
  if (!hasAuth.value) {
    uploadForm.message = '请配置 NES_API_TOKEN 以调用存档接口。'
    return
  }
  const numericGameId = Number(uploadForm.gameId)
  if (!numericGameId) {
    uploadForm.message = '请输入正确的游戏 ID。'
    return
  }
  if (!uploadForm.file) {
    uploadForm.message = '请选择需要上传的存档文件 (.bin)。'
    return
  }
  const formData = new FormData()
  formData.append('game_id', String(numericGameId))
  formData.append('save_file', uploadForm.file)
  uploadForm.loading = true
  try {
    await retroApi.uploadSave(formData)
    uploadForm.message = '上传成功'
    uploadForm.gameId = ''
    uploadForm.file = null
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    await refresh()
  } catch (err: any) {
    uploadForm.message = err?.statusMessage || '上传失败'
  } finally {
    uploadForm.loading = false
  }
}

const deleteSave = async (gameId: number) => {
  if (!hasAuth.value) {
    uploadForm.message = '缺少认证信息，无法删除。'
    return
  }
  uploadForm.loading = true
  try {
    await retroApi.deleteSave(gameId)
    uploadForm.message = `已删除游戏 ${gameId} 的存档`
    await refresh()
  } catch (err: any) {
    uploadForm.message = err?.statusMessage || '删除失败'
  } finally {
    uploadForm.loading = false
  }
}
</script>

<template>
  <RetroPanel>
    <template #title>云存档中心</template>
    <div v-if="!hasAuth" class="notice-box">
      需要在 .env 中设置 NES_API_TOKEN 后才能同步和管理存档。
    </div>
    <div v-else>
      <div class="actions" style="display:flex; gap:1rem; margin-bottom:1rem; flex-wrap:wrap;">
        <button class="retro-button" type="button" @click="refresh" :disabled="pending">
          {{ pending ? '同步中...' : '刷新存档列表' }}
        </button>
      </div>
      <div v-if="pending" class="notice-box">正在拉取存档...</div>
      <div v-else-if="error" class="notice-box">{{ error.statusMessage }}</div>
      <div v-else-if="saves?.length" class="save-grid">
        <article v-for="save in saves" :key="save.id" class="detail-card">
          <h3>游戏 #{{ save.game_id }}</h3>
          <p>存档链接：<a :href="save.save_file" target="_blank" rel="noopener">打开</a></p>
          <p>创建时间：{{ save.create_time }}</p>
          <p>更新时间：{{ save.update_time }}</p>
          <div style="display:flex; gap:0.8rem; flex-wrap:wrap; align-items:center;">
            <NuxtLink :to="`/games/${save.game_id}`" class="badge">查看游戏</NuxtLink>
            <button class="retro-button" type="button" @click="deleteSave(save.game_id)" :disabled="uploadForm.loading">
              删除存档
            </button>
          </div>
        </article>
      </div>
      <div v-else class="notice-box">暂无任何云存档。</div>

      <section class="detail-section" style="margin-top:2rem;">
        <h3>上传新的存档</h3>
        <p>填写游戏 ID 并选择 `.bin` 文件即可上传到服务器。</p>
        <form @submit.prevent="submitUpload" style="display:grid; gap:1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
          <input
            v-model="uploadForm.gameId"
            type="number"
            min="1"
            placeholder="游戏 ID"
            style="padding:0.8rem; border:2px solid var(--nes-border); border-radius:10px; background:#0b101c; color:var(--nes-soft);"
          />
          <input
            ref="fileInput"
            type="file"
            accept=".bin,.sav"
            @change="onFileChange"
            style="padding:0.8rem; border:2px dashed var(--nes-border); border-radius:10px; background:#0b101c; color:var(--nes-soft);"
          />
          <button class="retro-button" type="submit" :disabled="uploadForm.loading">
            {{ uploadForm.loading ? '上传中...' : '上传存档' }}
          </button>
        </form>
        <p v-if="uploadForm.message" class="badge" style="margin-top:0.8rem;">{{ uploadForm.message }}</p>
      </section>
    </div>
  </RetroPanel>
</template>
