<script setup lang="ts">
import type { GameSave } from '~/types/api'

const retroApi = useRetroApi()
const { isAuthenticated, hasClerk, initClerkState } = useAuthState()
const { buildImageUrl } = useImageBase()

onMounted(() => {
  initClerkState()
})

const {
  data: saves,
  pending,
  error,
  refresh
} = await useAsyncData('user-saves', () => retroApi.fetchAllSaves(), {
  immediate: false,
  server: false,
  default: () => []
})

const actionMessage = ref('')
const actionLoading = ref(false)

// 按 game_id 分组存档
const savesByGame = computed(() => {
  if (!saves.value?.length) return []
  const grouped = new Map<number, GameSave[]>()
  for (const save of saves.value) {
    const existing = grouped.get(save.game_id) || []
    existing.push(save)
    grouped.set(save.game_id, existing)
  }
  return Array.from(grouped.entries()).map(([gameId, gameSaves]) => {
    const firstSave = gameSaves[0]
    return {
      game_id: gameId,
      game_title: firstSave.game_title || `游戏 #${gameId}`,
      game_image: firstSave.game_image,
      saves: gameSaves,
      latestUpdate: gameSaves.reduce((latest, save) => {
        return save.update_time > latest ? save.update_time : latest
      }, gameSaves[0].update_time)
    }
  })
})

watch(isAuthenticated, value => {
  actionMessage.value = ''
  if (value) {
    refresh()
  } else {
    saves.value = []
  }
}, { immediate: true })

const deleteSave = async (gameId: number) => {
  if (!isAuthenticated.value) {
    actionMessage.value = '请先登录以删除存档。'
    return
  }
  actionLoading.value = true
  actionMessage.value = ''
  try {
    await retroApi.deleteSave(gameId)
    actionMessage.value = `已删除游戏 ${gameId} 的所有存档`
    await refresh()
  } catch (err: any) {
    actionMessage.value = err?.statusMessage || '删除失败'
  } finally {
    actionLoading.value = false
  }
}

const deleteSingleSave = async (saveId: number, gameId: number) => {
  if (!isAuthenticated.value) {
    actionMessage.value = '请先登录以删除存档。'
    return
  }
  actionLoading.value = true
  actionMessage.value = ''
  try {
    await retroApi.deleteSave(gameId)
    actionMessage.value = `已删除存档 ID: ${saveId}`
    await refresh()
  } catch (err: any) {
    actionMessage.value = err?.statusMessage || '删除失败'
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <RetroPanel>
    <template #title>云存档中心</template>
    <ClientOnly>
      <div v-if="!isAuthenticated" class="notice-box">
        <template v-if="hasClerk">
          <p>
            请先
            <SignInButton mode="modal" v-slot="slotProps">
              <span class="auth-link" @click="slotProps?.open?.()">登录</span>
            </SignInButton>
            以管理云存档。
          </p>
        </template>
        <template v-else>
          <p>请在 <code>.env</code> 中设置 <code>CLERK_PUBLISHABLE_KEY</code> 和 <code>CLERK_SECRET_KEY</code> 以启用登录功能。</p>
        </template>
      </div>
      <div v-else>
      <div class="actions" style="display:flex; gap:1rem; margin-bottom:1rem; flex-wrap:wrap;">
        <button class="retro-button" type="button" @click="refresh" :disabled="pending">
          {{ pending ? '同步中...' : '刷新存档列表' }}
        </button>
      </div>
      <div v-if="pending" class="notice-box">正在拉取存档...</div>
      <div v-else-if="error" class="notice-box">{{ error.statusMessage }}</div>
      <div v-else-if="savesByGame?.length" class="save-grid">
        <article v-for="group in savesByGame" :key="group.game_id" class="detail-card">
          <div style="display:flex; gap:1rem; align-items:flex-start; margin-bottom:1rem;">
            <div v-if="group.game_image" class="game-card__art" style="width:120px; flex-shrink:0;">
              <img :src="buildImageUrl(group.game_image)" :alt="group.game_title" style="width:100%; height:100%; object-fit:cover;" />
            </div>
            <div style="flex:1;">
              <h3>{{ group.game_title }}</h3>
              <p class="game-card__meta" style="margin:0.5rem 0;">游戏 ID: {{ group.game_id }}</p>
              <p style="margin:0.5rem 0; color:#9ba4c4; font-size:0.9rem;">最新更新：{{ group.latestUpdate }}</p>
            </div>
            <div style="display:flex; align-items:center;">
              <NuxtLink :to="`/games/${group.game_id}/touch`" class="retro-button">
                进入游戏
              </NuxtLink>
            </div>
          </div>
          <div style="border-top:1px solid var(--nes-border); padding-top:1rem; margin-top:1rem;">
            <p style="margin-bottom:0.8rem; font-weight:600;">存档列表（{{ group.saves.length }} 个）</p>
            <div style="display:flex; flex-direction:column; gap:0.8rem;">
              <div v-for="save in group.saves" :key="save.id" style="background:#15192b; border:1px solid var(--nes-border); border-radius:8px; padding:0.8rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                  <div style="flex:1; min-width:200px;">
                    <p style="margin:0; font-size:0.85rem; color:#9ba4c4;">存档 ID: {{ save.id }}</p>
                    <p style="margin:0.3rem 0 0; font-size:0.85rem; color:#9ba4c4;">创建：{{ save.create_time }}</p>
                    <p style="margin:0.3rem 0 0; font-size:0.85rem; color:#9ba4c4;">更新：{{ save.update_time }}</p>
                  </div>
                  <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                    <button 
                      class="retro-button" 
                      type="button" 
                      @click="deleteSingleSave(save.id, save.game_id)" 
                      :disabled="actionLoading"
                      style="font-size:0.85rem; padding:0.4rem 0.8rem;"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style="display:flex; gap:0.8rem; flex-wrap:wrap; align-items:center; margin-top:1rem; padding-top:1rem; border-top:1px solid var(--nes-border);">
            <NuxtLink :to="`/games/${group.game_id}`" class="badge">查看游戏</NuxtLink>
            <button class="retro-button" type="button" @click="deleteSave(group.game_id)" :disabled="actionLoading">
              删除所有存档
            </button>
          </div>
        </article>
      </div>
      <div v-else class="notice-box">暂无任何云存档。</div>
      <p v-if="actionMessage" class="badge" style="margin-top:1rem;">{{ actionMessage }}</p>
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
