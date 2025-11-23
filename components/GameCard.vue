<script setup lang="ts">
import { computed } from 'vue'
import type { Game } from '~/types/api'

const props = defineProps<{ game: Game; compact?: boolean; showClicks?: boolean }>()

const coverImage = computed(() => props.game.title_screen_image || props.game.title_screen_image1 || '')
</script>

<template>
  <NuxtLink :to="`/games/${game.game_id}`" class="game-card" :class="{ 'game-card--compact': compact }">
    <div class="game-card__art">
      <img v-if="coverImage" :src="coverImage" :alt="game.title" loading="lazy" />
      <div v-else class="placeholder">NO ART</div>
    </div>
    <div class="game-card__title">{{ game.title }}</div>
    <div class="game-card__meta">
      <span>{{ game.type }}</span>
      <span>·</span>
      <span>{{ game.language }}</span>
      <span v-if="game.region">· {{ game.region }}</span>
      <span v-if="showClicks && game.click_count" class="badge">{{ game.click_count }} hits</span>
    </div>
  </NuxtLink>
</template>
