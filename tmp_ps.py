<script setup lang="ts">
import JSZip from "jszip";

const route = useRoute();
const retroApi = useRetroApi();
const runtime = useRuntimeConfig();

type EmulatorWindow = Window &
    Partial<{
        EJS_player: string;
        EJS_core: string;
        EJS_gameUrl: string;
        EJS_fullscreenOnLoad: boolean;
        EJS_pathtodata: string;
        EJS_gameID: string;
        EJS_startOnLoaded: boolean;
        EJS_onGameStart: () => void;
    }>;

const fullscreenRoot = ref<HTMLElement | null>(null);
const emulatorStage = ref<HTMLElement | null>(null);
const fullscreenMessage = ref("");
const emulatorMessage = ref("");

const gameId = computed(() => {
    const id = Number(route.params.id);
    return Number.isFinite(id) ? id : 0;
});

const {
    data: game,
    pending,
    error,
} = await useAsyncData(
    () => `touch-game-${gameId.value}`,
    () => retroApi.fetchGameById(gameId.value),
    { watch: [gameId] },
);

const ROM_BASE_URL = "https://bin9.vae88.com/files/";
const romSourceUrl = computed(() => {
    const binaryPath = game.value?.game_binary_file || game.value?.binary_file;
    if (!binaryPath) return "";
    if (/^(?:https?:)?\/\//i.test(binaryPath)) {
        return binaryPath;
    }
    const normalizedPath = binaryPath.replace(/^\/+/, "");
    const trimmed = normalizedPath.replace(/^files\//i, "");
    return `${ROM_BASE_URL}${trimmed}`;
});

useHead(() => ({
    title: game.value ? `${game.value.title} · 触屏模式` : "触屏触控模式",
}));

const romLoading = ref(false);
const preparedRomUrl = ref("");
let romTaskToken = 0;
let romTaskCount = 0;
let romObjectUrl: string | null = null;

const cleanupPreparedRom = () => {
    if (romObjectUrl && import.meta.client) {
        URL.revokeObjectURL(romObjectUrl);
    }
    romObjectUrl = null;
    preparedRomUrl.value = "";
};

const selectRomEntry = (zip: JSZip) => {
    const entries = Object.values(zip.files).filter((file) => !file.dir);
    const preferredExts = [".nes", ".bin", ".rom"];
    for (const ext of preferredExts) {
        const match = entries.find((entry) =>
            entry.name.toLowerCase().endsWith(ext),
        );
        if (match) {
            return match;
        }
    }
    return entries[0] || null;
};

const isZipFile = (bytes: Uint8Array) =>
    bytes.length > 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;

const updateRomLoadingState = (delta: number) => {
    romTaskCount = Math.max(0, romTaskCount + delta);
    romLoading.value = romTaskCount > 0;
};

const prepareRomFile = async () => {
    if (!import.meta.client) return;
    if (!romSourceUrl.value) {
        cleanupPreparedRom();
        emulatorMessage.value = "未找到 ROM 路径。";
        return;
    }
    console.log("[touch] start prepare ROM", romSourceUrl.value);
    const currentToken = ++romTaskToken;
    updateRomLoadingState(1);
    emulatorMessage.value = "";
    try {
        const response = await fetch(romSourceUrl.value);
        if (!response.ok) {
            throw new Error("ROM 下载失败，请稍后再试。");
        }
        const buffer = await response.arrayBuffer();
        const rawBytes = new Uint8Array(buffer);
        let romBytes: Uint8Array;
        if (isZipFile(rawBytes)) {
            const zip = await JSZip.loadAsync(buffer);
            const romEntry = selectRomEntry(zip);
            if (!romEntry) {
                throw new Error("压缩包中未找到 ROM 文件。");
            }
            romBytes = await romEntry.async("uint8array");
        } else {
            romBytes = rawBytes;
        }
        if (currentToken !== romTaskToken) {
            return;
        }
        cleanupPreparedRom();
        const objectUrl = URL.createObjectURL(
            new Blob([romBytes], { type: "application/octet-stream" }),
        );
        romObjectUrl = objectUrl;
        preparedRomUrl.value = objectUrl;
        await attachEmulator();
    } catch (err: any) {
        console.error("[touch] prepare ROM failed", err);
        if (currentToken !== romTaskToken) return;
        cleanupPreparedRom();
        emulatorMessage.value = err?.message || "ROM 处理失败。";
    } finally {
        updateRomLoadingState(-1);
    }
};

const EMULATOR_BASE = "https://cdn.jsdelivr.net/npm/@ttgame/emulatorjs@4.2.3/data";
const loaderScriptSrc = `${EMULATOR_BASE}/loader.js`;
const emulatorScriptSrc = `${EMULATOR_BASE}/src/emulator.js`;

const requestFullscreen = async () => {
    if (!import.meta.client) return;
    const target = fullscreenRoot.value || document.documentElement;
    if (!target?.requestFullscreen) return;
    if (document.fullscreenElement === target) return;
    try {
        await target.requestFullscreen();
        fullscreenMessage.value = "";
    } catch {
        fullscreenMessage.value = "浏览器阻止了自动全屏，请点击“重新全屏”。";
    }
};

const attachEmulator = async () => {
    if (!import.meta.client) return;
    if (!preparedRomUrl.value) {
        console.warn("[touch] attachEmulator without ROM url");
        emulatorMessage.value = "ROM 尚未准备好，稍候再试。";
        return;
    }
    console.log("[touch] attachEmulator start", preparedRomUrl.value);
    emulatorMessage.value = "";
    await nextTick();
    await requestFullscreen();
    if (emulatorStage.value) {
        emulatorStage.value.innerHTML = "";
    }
    const win = window as EmulatorWindow;
    win.EJS_player = "#emulator-stage";
    win.EJS_core = "nes";
    win.EJS_gameUrl = preparedRomUrl.value;
    win.EJS_fullscreenOnLoad = true;
    win.EJS_pathtodata = `${EMULATOR_BASE}/`;
    win.EJS_gameID = game.value
        ? `game-${game.value.game_id}`
        : `game-${gameId.value}`;
    win.EJS_startOnLoaded = true;
    win.EJS_onGameStart = () => {
        romLoading.value = false;
    };

    const loadScriptOnce = (id: string, src: string) =>
        new Promise<void>((resolve, reject) => {
            const existing = document.getElementById(id) as HTMLScriptElement | null;
            if (existing) {
                if (existing.getAttribute("data-loaded") === "true") {
                    resolve();
                    return;
                }
                existing.addEventListener("load", () => resolve(), { once: true });
                existing.addEventListener(
                    "error",
                    () => reject(new Error(`加载 ${src} 失败`)),
                    { once: true },
                );
                return;
            }
            const script = document.createElement("script");
            script.id = id;
            script.src = src;
            script.async = true;
            script.onload = () => {
                script.setAttribute("data-loaded", "true");
                resolve();
            };
            script.onerror = () => reject(new Error(`加载 ${src} 失败`));
            document.body.appendChild(script);
        });

    try {
        await loadScriptOnce("touch-emulator-loader", loaderScriptSrc);
        await loadScriptOnce("touch-emulator-main", emulatorScriptSrc);
    } catch (err: any) {
        console.error("[touch] emulator script load failed", err);
        emulatorMessage.value = err?.message || "模拟器脚本加载失败。";
    }
};

const handleFullscreenClick = () => {
    requestFullscreen();
};

if (import.meta.client) {
    watch(
        () => romSourceUrl.value,
        (value) => {
            if (value) {
                prepareRomFile();
            } else {
                cleanupPreparedRom();
                emulatorMessage.value = "未找到 ROM 路径。";
            }
        },
        { immediate: true },
    );
}

onMounted(() => {
    // no-op placeholder for future hooks
});

onBeforeUnmount(() => {
    if (!import.meta.client) return;
    cleanupPreparedRom();
    const loaderScript = document.getElementById("touch-emulator-loader");
    loaderScript?.parentElement?.removeChild(loaderScript);
    const mainScript = document.getElementById("touch-emulator-main");
    mainScript?.parentElement?.removeChild(mainScript);
});

</script>

<template>
    <div class="touch-play" ref="fullscreenRoot">
        <div class="touch-play__top">
            <NuxtLink class="back-link" :to="`/games/${gameId}`"
                >← 返回详情</NuxtLink
            >
            <div class="touch-play__meta">
                <p class="touch-play__tag">触屏专用</p>
                <h1>{{ game ? game.title : "触控启动" }}</h1>
                <p v-if="game" class="touch-play__desc">
                    {{ game.type }} · {{ game.language }} ·
                    {{ game.region || "地区未知" }}
                </p>
            </div>
            <button
                class="retro-button"
                type="button"
                @click="handleFullscreenClick"
            >
                重新全屏
            </button>
        </div>

        <p v-if="fullscreenMessage" class="notice-box">
            {{ fullscreenMessage }}
        </p>

        <div class="touch-play__body">
            <section class="touch-play__emulator">
                <div v-if="pending" class="notice-box">加载游戏信息...</div>
                <div v-else-if="error" class="notice-box">
                    {{ error.statusMessage }}
                </div>
                <div v-else-if="!game" class="notice-box">
                    未查询到游戏详情。
                </div>
                <div v-else class="emulator-shell">
                    <header class="emulator-shell__header">
                        <h3>{{ game.title }} · 触屏启动</h3>
                        <p>ROM：{{ game.binary_file }}</p>
                    </header>
                    <p
                        v-if="romLoading"
                        class="notice-box"
                        style="margin-bottom: 1rem"
                    >
                        ROM 下载解压中，请稍候...
                    </p>
                    <div
                        id="emulator-stage"
                        ref="emulatorStage"
                        class="emulator-stage"
                    ></div>
                    <p
                        v-if="emulatorMessage"
                        class="notice-box"
                        style="margin-top: 1rem"
                    >
                        {{ emulatorMessage }}
                    </p>
                </div>
            </section>
        </div>
    </div>
</template>

