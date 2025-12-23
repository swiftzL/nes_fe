const env =
  (
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env
  ) || {};

console.log(env);
const rawApiBase = env.NES_API_BASE || "http://localhost:8080";
console.log(rawApiBase);
const normalizedApiBase = rawApiBase.replace(/\/+$/, "");
console.log(normalizedApiBase);
const proxyTarget = normalizedApiBase.endsWith("/api")
  ? `${normalizedApiBase}/**`
  : `${normalizedApiBase}/api/**`;
const clerkPublishableKey = env.CLERK_PUBLISHABLE_KEY || "";
const clerkSecretKey = env.CLERK_SECRET_KEY || "";
const clerkInstanceType = clerkPublishableKey.startsWith("pk_live_")
  ? "production"
  : clerkPublishableKey
  ? "development"
  : "disabled";
let enableClerk = Boolean(clerkPublishableKey && clerkSecretKey);
enableClerk = true

export default defineNuxtConfig({
  ssr: true,
  devtools: { enabled: false },
  modules:  ["@clerk/nuxt"],
  app: {
    head: {
      title: "NES Retro Hub",
      meta: [
        {
          name: "description",
          content: "复古NES风格的怀旧游戏平台，浏览经典游戏、收藏与历史。",
        },
      ],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Grotesk:wght@400;500;700&display=swap",
        },
      ],
    },
  },
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    apiBase: normalizedApiBase || "http://localhost:8080",
    public: {
      apiBase: "/api",
      imageBase:
        env.NES_IMAGE_BASE || "https://bin9.vae88.com/files/img/",
      romBase: env.NES_ROM_BASE || "https://bin9.vae88.com/files/",
      emulatorBase:
        env.NES_EMULATOR_BASE ||
        "https://cdn.jsdelivr.net/npm/@ttgame/emulatorjs@4.2.4/data",
      clerkPublishableKey,
      clerkInstanceType,
      claritySiteId: env.MICROSOFT_CLARITY_ID || "",
    },
    clerkSecretKey,
  },
  components: [{ path: "~/components", extensions: ["vue"] }],
  nitro: {
    routeRules: {
      "/api/**": {
        proxy: {
          to: proxyTarget,
        },
      },
    },
  },
  future: {
    compatibilityVersion: 4,
  },
});
