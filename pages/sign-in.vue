<template>
  <div class="auth-screen">
    <div class="auth-card">
      <ClientOnly>
        <template v-if="hasClerk && signInComponent">
          <component
            :is="signInComponent"
            routing="path"
            path="/sign-in"
            :after-sign-in-url="redirectTo"
            :after-sign-up-url="redirectTo"
            :sign-up-url="signUpPath"
          />
        </template>
        <template v-else>
          <div class="auth-missing">
            <p>尚未加载 Clerk 登录组件。</p>
            <p>请在环境变量中设置 <code>CLERK_PUBLISHABLE_KEY</code> 和 <code>CLERK_SECRET_KEY</code> 后重新启动应用。</p>
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const runtime = useRuntimeConfig()
const redirectTo = (route.query.redirectTo as string) || '/'
const signUpPath = `/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`
const hasClerk = computed(() => Boolean(runtime.public?.clerkPublishableKey))
const signInComponent = computed(() => (hasClerk.value ? 'SignIn' : null))
</script>

<style scoped>
.auth-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #07090f;
  padding: 2rem;
}

.auth-card {
  width: min(420px, 100%);
  background: rgba(15, 20, 36, 0.85);
  border: 2px solid var(--nes-border, #55597b);
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.65);
}

.auth-missing {
  color: var(--nes-soft, #e2e6f2);
  text-align: center;
  line-height: 1.5;
}

.auth-missing code {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}
</style>
