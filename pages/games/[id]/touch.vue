<script setup lang="ts">
import JSZip from "jszip";
import type { GameSave } from "~/types/api";

const route = useRoute();
const retroApi = useRetroApi();
const runtime = useRuntimeConfig();

type EmulatorSaveFns = {
    getState?: () => Promise<Uint8Array | string | null> | Uint8Array | string | null;
    loadState?: (payload: Uint8Array | string) => Promise<void> | void;
};

type EmulatorGameManager = EmulatorSaveFns & {
    functions?: EmulatorSaveFns;
};

type EmulatorInstance = {
    gameManager?: EmulatorGameManager;
};

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
        EJS_emulator: EmulatorInstance;
        // 自定义云存档接口
        EJS_cloudSave: () => Promise<boolean | void>;
        EJS_getSelectSave: () => Promise<Array<{ id: string; desc: string }>>;
        EJS_loadSave: (id: string) => Promise<void>;
    }>;

const fullscreenRoot = ref<HTMLElement | null>(null);
const emulatorStage = ref<HTMLElement | null>(null);
const emulatorMessage = ref("");
const isFullscreen = ref(false);
const emulatorReady = ref(false);

const { isAuthenticated, hasClerk, initClerkState } = useAuthState();
const remoteSave = ref<GameSave | null>(null);
const allSaves = ref<GameSave[]>([]);
const showSaveSelector = ref(false);
const hasShownInitialSelector = ref(false);
const saveSyncing = ref(false);
const saveUploading = ref(false);
const loadApplying = ref(false);
const saveMessage = ref("");
const loadMessage = ref("");
const saveFetchMessage = ref("");
let saveFetchToken = 0;

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

const romBaseUrl = runtime.public?.romBase || "https://bin9.vae88.com/files/";
const romSourceUrl = computed(() => {
    const binaryPath = game.value?.game_binary_file || game.value?.binary_file;
    if (!binaryPath) return "";
    if (/^(?:https?:)?\/\//i.test(binaryPath)) {
        return binaryPath;
    }
    const normalizedPath = binaryPath.replace(/^\/+/, "");
    const trimmed = normalizedPath.replace(/^files\//i, "");
    const base = romBaseUrl.replace(/\/+$/, "");
    return `${base}/${trimmed}`;
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
        const romBuffer = romBytes.buffer.slice(
            romBytes.byteOffset,
            romBytes.byteOffset + romBytes.byteLength,
        ) as ArrayBuffer;
        const objectUrl = URL.createObjectURL(
            new Blob([romBuffer], { type: "application/octet-stream" }),
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

const emulatorBase = runtime.public?.emulatorBase;
const loaderScriptSrc = `${emulatorBase.replace(/\/+$/, "")}/loader.js`;
const emulatorScriptSrc = `${emulatorBase.replace(/\/+$/, "")}/src/emulator.js`;

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
    if (emulatorStage.value) {
        emulatorStage.value.innerHTML = "";
    }
    const win = window as EmulatorWindow;
    win.EJS_player = "#emulator-stage";
    win.EJS_core = "nes";
    win.EJS_gameUrl = preparedRomUrl.value;
    win.EJS_fullscreenOnLoad = true;
    win.EJS_pathtodata = `${emulatorBase.replace(/\/+$/, "")}/`;
    win.EJS_gameID = game.value
        ? `game-${game.value.game_id}`
        : `game-${gameId.value}`;
    win.EJS_startOnLoaded = true;
    win.EJS_onGameStart = async () => {
        romLoading.value = false;
        // 等待 gameManager 可用后再标记为就绪
        const manager = await waitForGameManager(5000);
        if (manager) {
            emulatorReady.value = true;
            console.log("[touch] emulator ready with gameManager");
        } else {
            console.warn("[touch] emulator started but gameManager not available");
            emulatorReady.value = true; // 仍然标记为就绪，但会在使用时重试
        }
    };

    // 注入自定义云存档钩子
    // 1. EJS_cloudSave: 模拟器触发“保存到云端”时调用
    (win as any).EJS_cloudSave = async () => {
        if (!isAuthenticated.value) {
            alert("请先登录再使用云存档功能。");
            return;
        }
        try {
            await handleSaveState();
            alert("云存档保存成功！");
            return true;
        } catch (e) {
            console.error("EJS_cloudSave error", e);
            alert("云存档保存失败");
            return false;
        }
    };

    // 2. EJS_getSelectSave: 模拟器打开“加载云存档”列表时调用
    (win as any).EJS_getSelectSave = async () => {
        if (!isAuthenticated.value) {
            alert("请先登录再使用云存档功能。");
            return [];
        }
        try {
            await fetchRemoteSave(); // 确保 allSaves 是最新的
            // 格式化为 emulator 需要的格式 {id, desc}
            // id 必须是字符串，desc 是显示在列表里的文本
            return allSaves.value.map(save => ({
                id: String(save.id),
                desc: `${save.create_time} (ID: ${save.id})`
            }));
        } catch (e) {
            console.error("EJS_getSelectSave error", e);
            return [];
        }
    };

    // 3. EJS_loadSave: 用户在列表中选择了某个存档 id 后调用
    (win as any).EJS_loadSave = async (id: string) => {
        const saveId = Number(id);
        const targetSave = allSaves.value.find(s => s.id === saveId);
        if (!targetSave) {
            alert("未找到该存档信息");
            return;
        }
        // 调用现有的加载逻辑
        await loadSelectedSave(targetSave);
        alert("云存档加载成功！");
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

const handleFullscreenChange = () => {
    if (!import.meta.client) return;
    isFullscreen.value = Boolean(document.fullscreenElement);
};

const getGameManager = (): EmulatorGameManager | null => {
    if (!import.meta.client) return null;
    const win = window as EmulatorWindow;
    return win.EJS_emulator?.gameManager || null;
};

const waitForGameManager = async (maxWaitMs = 3000): Promise<EmulatorGameManager | null> => {
    if (!import.meta.client) return null;
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
        const manager = getGameManager();
        if (manager != null) {
            return manager;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
};


const base64ToUint8Array = (base64: string) => {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

const toUint8Array = (value: unknown): Uint8Array | null => {
    if (!value) return null;
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (typeof value === "string") {
        try {
            return base64ToUint8Array(value);
        } catch {
            return null;
        }
    }
    return null;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i += chunk) {
        const sub = bytes.subarray(i, i + chunk);
        binary += String.fromCharCode(...sub);
    }
    return btoa(binary);
};

const fetchRemoteSave = async () => {
    if (!import.meta.client) return;
    if (!isAuthenticated.value || !gameId.value) {
        remoteSave.value = null;
        allSaves.value = [];
        return;
    }
    const currentToken = ++saveFetchToken;
    saveSyncing.value = true;
    saveFetchMessage.value = "";
    try {
        // 获取所有存档，然后过滤出当前游戏的存档
        const allSavesData = await retroApi.fetchAllSaves();
        if (currentToken === saveFetchToken) {
            const gameSaves = allSavesData.filter(save => save.game_id === gameId.value);
            allSaves.value = gameSaves;
            // 保留最新的存档作为默认
            remoteSave.value = gameSaves.length > 0 ? (gameSaves[0] || null) : null;
            // 如果有存档且是首次加载，自动显示选择弹窗
            if (gameSaves.length > 0 && !hasShownInitialSelector.value) {
                hasShownInitialSelector.value = true;
                showSaveSelector.value = true;
            }
        }
    } catch (err: any) {
        if (currentToken !== saveFetchToken) return;
        remoteSave.value = null;
        allSaves.value = [];
        if (err?.statusCode !== 404) {
            saveFetchMessage.value =
                err?.statusMessage || "云存档同步失败，请稍后再试。";
        }
    } finally {
        if (currentToken === saveFetchToken) {
            saveSyncing.value = false;
        }
    }
};

const handleSaveState = async () => {
    if (!import.meta.client) return;
    if (!isAuthenticated.value) {
        saveMessage.value = "请先登录再保存存档。";
        return;
    }
    if (saveUploading.value) return; // 防止重复点击
    saveUploading.value = true;
    saveMessage.value = "正在等待模拟器就绪...";
    try {
        const manager = await waitForGameManager(5000);
        if (!manager?.getState) {
            saveMessage.value = "当前模拟器未暴露存档接口。";
            return;
        }
        saveMessage.value = "正在保存存档...";
        const rawState = await manager.getState();
        if (!rawState) {
            throw new Error("无法获取存档数据。");
        }
        const bytes = toUint8Array(rawState);
        if (!bytes) {
            throw new Error("无法解析存档数据。");
        }
        const fileName = `${game.value?.title || "save"}-${gameId.value}.bin`;
        const bytesBuffer = bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
        const formData = new FormData();
        formData.append("game_id", String(gameId.value));
        formData.append(
            "save_file",
            new File([bytesBuffer], fileName, { type: "application/octet-stream" }),
        );
        await retroApi.uploadSave(formData);
        saveMessage.value = "已上传云存档。";
        await fetchRemoteSave();
    } catch (err: any) {
        console.error("[touch] save state failed", err);
        saveMessage.value = err?.message || "保存存档失败。";
    } finally {
        saveUploading.value = false;
    }
};

const handleLoadState = async () => {
    if (!import.meta.client) return;
    if (!isAuthenticated.value) {
        loadMessage.value = "请先登录再加载存档。";
        return;
    }
    if (allSaves.value.length === 0) {
        loadMessage.value = "暂无云存档可加载。";
        return;
    }
    // 如果有多个存档，显示选择弹窗
    if (allSaves.value.length > 1) {
        showSaveSelector.value = true;
        return;
    }
    // 只有一个存档，直接加载
    const firstSave = allSaves.value[0];
    if (firstSave) {
        await loadSelectedSave(firstSave);
    } else {
        loadMessage.value = "暂无存档可加载。";
    }
};

const loadSelectedSave = async (save: GameSave) => {
    if (!import.meta.client) return;
    showSaveSelector.value = false;
    if (loadApplying.value) return;
    loadApplying.value = true;
    loadMessage.value = "正在等待模拟器就绪...";
    try {
        const manager = await waitForGameManager(5000);
        if (!manager?.loadState) {
            loadMessage.value = "当前模拟器未暴露加载接口。";
            return;
        }
        loadMessage.value = "正在加载存档...";
        const response = await fetch(save.save_file);
        if (!response.ok) {
            throw new Error("下载云存档失败。");
        }
        const buffer = await response.arrayBuffer();
        const stateBytes = new Uint8Array(buffer);
        try {
            await manager.loadState(stateBytes);
        } catch (err) {
            console.warn("[touch] loadState with bytes failed, fallback to base64", err);
            const base64State = arrayBufferToBase64(buffer);
            await manager.loadState(base64State);
        }
        loadMessage.value = "已加载云存档。";
    } catch (err: any) {
        console.error("[touch] load state failed", err);
        loadMessage.value = err?.message || "加载存档失败。";
    } finally {
        loadApplying.value = false;
    }
};

const requestFullscreen = async () => {
    // @ts-ignore
    window.EJS_emulator?.toggleFullscreen(true);
};

const exitFullscreen = async () => {
    // @ts-ignore
    window.EJS_emulator?.toggleFullscreen(false);
};

const toggleFullscreen = async () => {
    if (isFullscreen.value) {
        await exitFullscreen();
    } else {
        await requestFullscreen();
    }
};

const fullscreenLabel = computed(() =>
    isFullscreen.value ? "退出全屏" : "全屏模式",
);

watch(
    () => [isAuthenticated.value, gameId.value],
    () => {
        if (!import.meta.client) return;
        saveMessage.value = "";
        loadMessage.value = "";
        // 切换游戏时重置初始选择器标志
        hasShownInitialSelector.value = false;
        fetchRemoteSave();
    },
    { immediate: true },
);

onMounted(() => {
    if (!import.meta.client) return;
    initClerkState();
    document.addEventListener("fullscreenchange", handleFullscreenChange);
});

onBeforeUnmount(() => {
    if (!import.meta.client) return;
    cleanupPreparedRom();
    const loaderScript = document.getElementById("touch-emulator-loader");
    loaderScript?.parentElement?.removeChild(loaderScript);
    const mainScript = document.getElementById("touch-emulator-main");
    mainScript?.parentElement?.removeChild(mainScript);
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
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
            <div class="touch-play__actions">
                <ClientOnly>
                    <template v-if="isAuthenticated">
                        <button
                            class="retro-button"
                            type="button"
                            @click="handleSaveState"
                            :disabled="saveUploading || romLoading || !emulatorReady"
                        >
                            {{ saveUploading ? "保存中..." : "保存存档" }}
                        </button>
                        <button
                            class="retro-button"
                            type="button"
                            @click="handleLoadState"
                            :disabled="
                                loadApplying ||
                                allSaves.length === 0 ||
                                saveSyncing ||
                                !emulatorReady
                            "
                        >
                            {{
                                loadApplying
                                    ? "加载中..."
                                    : allSaves.length > 0
                                      ? "加载存档"
                                      : "暂无存档"
                            }}
                        </button>
                        <span class="badge" v-if="saveSyncing">
                            同步云存档...
                        </span>
                    </template>
                    <template v-else>
                        <span class="badge">
                            <template v-if="hasClerk">
                                登录后可保存 / 加载存档
                            </template>
                            <template v-else>
                                配置认证信息后可保存存档
                            </template>
                        </span>
                    </template>
                </ClientOnly>
                <button
                    class="retro-button retro-button--ghost"
                    type="button"
                    @click="toggleFullscreen"
                >
                    {{ fullscreenLabel }}
                </button>
            </div>
        </div>

        <div
            class="touch-play__messages"
            v-if="saveMessage || loadMessage || saveFetchMessage"
        >
            <span class="badge" v-if="saveFetchMessage">
                {{ saveFetchMessage }}
            </span>
            <span class="badge" v-if="saveMessage">{{ saveMessage }}</span>
            <span class="badge" v-if="loadMessage">{{ loadMessage }}</span>
        </div>

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

        <!-- 存档选择弹窗 -->
        <ClientOnly>
            <div
                v-if="showSaveSelector"
                class="save-selector-overlay"
                @click.self="showSaveSelector = false"
            >
                <div class="save-selector-modal">
                    <div class="save-selector-header">
                        <h3>选择要加载的存档</h3>
                        <button
                            class="save-selector-close"
                            type="button"
                            @click="showSaveSelector = false"
                        >
                            ×
                        </button>
                    </div>
                    <div class="save-selector-content">
                        <div
                            v-if="allSaves.length === 0"
                            class="notice-box"
                        >
                            暂无存档可加载
                        </div>
                        <div
                            v-else
                            class="save-selector-list"
                        >
                            <div
                                v-for="save in allSaves"
                                :key="save.id"
                                class="save-selector-item"
                                @click="loadSelectedSave(save)"
                            >
                                <div class="save-selector-item-info">
                                    <p class="save-selector-item-id">存档 ID: {{ save.id }}</p>
                                    <p class="save-selector-item-time">创建：{{ save.create_time }}</p>
                                    <p class="save-selector-item-time">更新：{{ save.update_time }}</p>
                                </div>
                                <button
                                    class="retro-button"
                                    type="button"
                                    :disabled="loadApplying"
                                >
                                    加载
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ClientOnly>
    </div>
</template>
