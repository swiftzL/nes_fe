<template>
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-header">
        <NuxtLink to="/" class="back-home">← 返回首页</NuxtLink>
        <h1>注册 NES Retro Hub</h1>
        <p>创建账号，畅玩复古游戏</p>
      </div>
      <ClientOnly>
        <template v-if="hasClerk">
          <SignUp
            :fallback-redirect-url="redirectTo"
            :sign-in-url="signInPath"
          />
        </template>
        <template v-else>
          <div class="auth-missing">
            <p>尚未配置 Clerk 登录服务。</p>
            <p>请在 <code>.env</code> 文件中设置以下环境变量后重新启动应用：</p>
            <ul>
              <li><code>CLERK_PUBLISHABLE_KEY</code></li>
              <li><code>CLERK_SECRET_KEY</code></li>
            </ul>
            <p>可在 <a href="https://clerk.com" target="_blank" rel="noopener">clerk.com</a> 创建应用并获取密钥。</p>
          </div>
        </template>
        <template #fallback>
          <div class="auth-loading">
            <span class="led"></span>
            加载中...
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const runtime = useRuntimeConfig()
const redirectTo = computed(() => (route.query.redirectTo as string) || '/')
const signInPath = computed(() => `/sign-in?redirectTo=${encodeURIComponent(redirectTo.value)}`)
const hasClerk = computed(() => Boolean(runtime.public?.clerkPublishableKey))
</script>

<style scoped>
.auth-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top, #1e2235 0%, #0b0d14 60%);
  padding: 2rem;
}

.auth-card {
  width: min(480px, 100%);
  background: rgba(15, 20, 36, 0.9);
  border: 3px solid var(--nes-border, #55597b);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.65), inset 0 0 30px rgba(0, 0, 0, 0.3);
}

.auth-header {
  text-align: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid var(--nes-border, #55597b);
}

.auth-header h1 {
  font-family: var(--font-display, 'Press Start 2P', cursive);
  font-size: 1.1rem;
  color: var(--nes-gold, #f3d45c);
  margin: 1rem 0 0.5rem;
}

.auth-header p {
  color: #9ba4c4;
  font-size: 0.9rem;
  margin: 0;
}

.back-home {
  color: var(--nes-blue, #8ab4ff);
  font-size: 0.85rem;
  border-bottom: 1px dashed transparent;
  transition: border-color 0.2s;
}

.back-home:hover {
  border-color: var(--nes-blue, #8ab4ff);
}

.auth-missing {
  color: var(--nes-soft, #e2e6f2);
  text-align: center;
  line-height: 1.8;
}

.auth-missing code {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

.auth-missing ul {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.auth-missing li {
  margin: 0.5rem 0;
}

.auth-missing a {
  color: var(--nes-accent, #ff4655);
  text-decoration: underline;
}

.auth-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  padding: 2rem;
  color: var(--nes-soft, #e2e6f2);
}

.auth-loading .led {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--nes-green, #4cf89e);
  box-shadow: 0 0 10px var(--nes-green, #4cf89e);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Clerk 组件样式覆盖 */
:deep(.cl-rootBox) {
  width: 100%;
}

:deep(.cl-card) {
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
}

:deep(.cl-headerTitle) {
  display: none;
}

:deep(.cl-headerSubtitle) {
  display: none;
}

:deep(.cl-socialButtonsBlockButton) {
  background: var(--nes-panel, #24293c) !important;
  border: 2px solid var(--nes-border, #55597b) !important;
  color: var(--nes-soft, #e2e6f2) !important;
}

:deep(.cl-socialButtonsBlockButton:hover) {
  background: var(--nes-dark, #1c1f2b) !important;
  border-color: var(--nes-accent, #ff4655) !important;
}

:deep(.cl-formButtonPrimary) {
  background: var(--nes-accent, #ff4655) !important;
  border: 2px solid #fff !important;
}

:deep(.cl-formButtonPrimary:hover) {
  background: #e63946 !important;
}

:deep(.cl-formFieldInput) {
  background: #0e111d !important;
  border: 2px solid var(--nes-border, #55597b) !important;
  color: var(--nes-soft, #e2e6f2) !important;
}

:deep(.cl-formFieldInput:focus) {
  border-color: var(--nes-accent, #ff4655) !important;
}

:deep(.cl-footerActionLink) {
  color: var(--nes-blue, #8ab4ff) !important;
}

:deep(.cl-dividerLine) {
  background: var(--nes-border, #55597b) !important;
}

:deep(.cl-dividerText) {
  color: #7e86a0 !important;
}
</style>
