<script setup lang="ts">
import JSZip from "jszip";
import type { GameSave } from "~/types/api";

definePageMeta({
    layout: false,
    auth: false
});

const route = useRoute();
// Get token from URL query
const token = computed(() => route.query.token as string | undefined);
// Initialize API with custom token
const retroApi = useRetroApi(token.value);
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
    toggleFullscreen?: (fullscreen?: boolean) => void;
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
        // Hooks
        EJS_cloudSave: () => Promise<boolean | void>;
        EJS_getSelectSave: () => Promise<Array<{ id: string; desc: string }>>;
        EJS_loadSave: (id: string) => Promise<void>;
    }>;

const emulatorStage = ref<HTMLElement | null>(null);
const emulatorMessage = ref("");
const isLoading = ref(true);
const allSaves = ref<GameSave[]>([]);

const gameId = computed(() => {
    const id = Number(route.params.id);
    return Number.isFinite(id) ? id : 0;
});

// Helpers for binary conversion
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

// Save/Load Logic
const fetchRemoteSave = async () => {
    if (!import.meta.client || !token.value) return;
    try {
        const allSavesData = await retroApi.fetchAllSaves();
        const gameSaves = allSavesData.filter(save => save.game_id === gameId.value);
        allSaves.value = gameSaves;
    } catch (err) {
        console.error("[wx_touch] fetchRemoteSave failed", err);
        allSaves.value = [];
    }
};

const handleSaveState = async () => {
    if (!import.meta.client || !token.value) {
        console.warn("[wx_touch] Cannot save: no token");
        return;
    }
    try {
        const manager = await waitForGameManager();
        if (!manager?.getState) {
            throw new Error("Emulator getState not available");
        }
        const rawState = await manager.getState();
        if (!rawState) throw new Error("No state returned");
        
        const bytes = toUint8Array(rawState);
        if (!bytes) throw new Error("Invalid state data");

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
        console.log("[wx_touch] Save uploaded successfully");
        await fetchRemoteSave(); // Refresh list
    } catch (err) {
        console.error("[wx_touch] handleSaveState failed", err);
        throw err; // Re-throw for emulator to catch
    }
};

const loadSelectedSave = async (save: GameSave) => {
    if (!import.meta.client) return;
    try {
        const manager = await waitForGameManager();
        if (!manager?.loadState) {
            throw new Error("Emulator loadState not available");
        }
        const response = await fetch(save.save_file);
        if (!response.ok) throw new Error("Failed to download save file");
        
        const buffer = await response.arrayBuffer();
        const stateBytes = new Uint8Array(buffer);
        try {
            await manager.loadState(stateBytes);
        } catch (err) {
            console.warn("[wx_touch] loadState bytes failed, trying base64", err);
            const base64State = arrayBufferToBase64(buffer);
            await manager.loadState(base64State);
        }
        console.log("[wx_touch] Save loaded successfully");
    } catch (err) {
        console.error("[wx_touch] loadSelectedSave failed", err);
        throw err;
    }
};

const {
    data: game,
    pending,
    error,
} = await useAsyncData(
    () => `wx-touch-game-${gameId.value}`,
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
    title: game.value ? `${game.value.title}` : "游戏加载中...",
    viewport: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
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

const getGameManager = (): EmulatorGameManager | null => {
    if (!import.meta.client) return null;
    const win = window as EmulatorWindow;
    return win.EJS_emulator?.gameManager || null;
};

const waitForGameManager = async (maxWaitMs = 5000): Promise<EmulatorGameManager | null> => {
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
    (window as any).AutoFull = true;
    if (!romSourceUrl.value) {
        cleanupPreparedRom();
        emulatorMessage.value = "未找到 ROM 路径。";
        isLoading.value = false; // Stop loading if failed
        return;
    }
    const currentToken = ++romTaskToken;
    updateRomLoadingState(1);
    emulatorMessage.value = "";
    try {
        const response = await fetch(romSourceUrl.value);
        if (!response.ok) {
            throw new Error("ROM 下载失败");
        }
        const buffer = await response.arrayBuffer();
        const rawBytes = new Uint8Array(buffer);
        let romBytes: Uint8Array;
        if (isZipFile(rawBytes)) {
            const zip = await JSZip.loadAsync(buffer);
            const romEntry = selectRomEntry(zip);
            if (!romEntry) {
                throw new Error("压缩包异常");
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
        console.error("[wx_touch] prepare ROM failed", err);
        if (currentToken !== romTaskToken) return;
        cleanupPreparedRom();
        emulatorMessage.value = err?.message || "ROM 加载失败";
        isLoading.value = false; // Show error
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
        emulatorMessage.value = "ROM 未就绪";
        isLoading.value = false;
        return;
    }
    emulatorMessage.value = "";
    await nextTick();
    if (emulatorStage.value) {
        emulatorStage.value.innerHTML = "";
    }
    const win = window as EmulatorWindow;
    win.EJS_player = "#emulator-stage";
    win.EJS_core = "nes";
    win.EJS_gameUrl = preparedRomUrl.value;
    win.EJS_fullscreenOnLoad = false; // Disable internal fullscreen to respect our CSS container
    win.EJS_pathtodata = `${emulatorBase.replace(/\/+$/, "")}/`;
    win.EJS_gameID = game.value
        ? `game-${game.value.game_id}`
        : `game-${gameId.value}`;
    win.EJS_startOnLoaded = true;

    // 1. EJS_cloudSave
    (win as any).EJS_cloudSave = async () => {
        if (!token.value) {
            console.warn("[wx_touch] Save attempted without token");
            return false;
        }
        try {
            await handleSaveState();
            return true;
        } catch (e) {
            console.error("[wx_touch] EJS_cloudSave error", e);
            return false;
        }
    };

    // 2. EJS_getSelectSave
    (win as any).EJS_getSelectSave = async () => {
        if (!token.value) return [];
        try {
            await fetchRemoteSave();
            return allSaves.value.map(save => ({
                id: String(save.id),
                desc: `${save.create_time} (ID: ${save.id})`
            }));
        } catch (e) {
            console.error("[wx_touch] EJS_getSelectSave error", e);
            return [];
        }
    };

    // 3. EJS_loadSave
    (win as any).EJS_loadSave = async (id: string) => {
        const saveId = Number(id);
        const targetSave = allSaves.value.find(s => s.id === saveId);
        if (!targetSave) {
            console.warn("[wx_touch] Save not found:", id);
            return;
        }
        await loadSelectedSave(targetSave);
    };

    win.EJS_onGameStart = async () => {
        console.log("[wx_touch] EJS_onGameStart triggered");
        romLoading.value = false;
        isLoading.value = false; // Loading complete!

        // Poll for toggleFullscreen existence explicitly
        let attempts = 0;
        const maxAttempts = 50; // Try for 5 seconds (50 * 100ms)
        const checkFullscreen = setInterval(() => {
            attempts++;
            const emu = (window as any).EJS_emulator;
            if (emu && typeof emu.toggleFullscreen === 'function') {
                clearInterval(checkFullscreen);
                console.log("[wx_touch] toggleFullscreen found, executing...");
                try {
                    // Force true just in case
                    // emu.toggleFullscreen(true); 
                } catch(e) {
                    console.error("[wx_touch] toggleFullscreen failed (possible user interaction policy):", e);
                }
            } else if (attempts >= maxAttempts) {
                clearInterval(checkFullscreen);
                console.warn("[wx_touch] toggleFullscreen not found after timeout");
            }
        }, 100);
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
        console.error("[wx_touch] script load failed", err);
        emulatorMessage.value = "模拟器脚本加载失败";
        isLoading.value = false;
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
                emulatorMessage.value = "未找到 ROM";
                isLoading.value = false;
            }
        },
        { immediate: true },
    );
}

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
    <div class="wx-touch-container">
        <!-- Loading Overlay -->
        <div v-if="isLoading || pending" class="loading-overlay">
            <div class="loading-spinner"></div>
            <p class="loading-text">{{ romLoading ? '正在下载游戏...' : '正在加载模拟器...' }}</p>
        </div>

        <!-- Error Message -->
        <div v-if="error || emulatorMessage" class="error-overlay">
            <p>{{ error?.statusMessage || emulatorMessage }}</p>
            <NuxtLink to="/" class="back-btn">返回首页</NuxtLink>
        </div>

        <!-- Emulator Stage -->
        <div id="emulator-stage" ref="emulatorStage" class="emulator-stage"></div>
    </div>
</template>

<style scoped>
:global(html), :global(body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #000;
    touch-action: none; /* Prevent browser handling of touch gestures */
}

.wx-touch-container {
    position: fixed; /* Fixed is better than absolute for viewport filling */
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: #000;
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
}

.emulator-stage {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
}

/* Deep selector to force the canvas to fit */
:global(#emulator-stage canvas) {
    max-width: 100% !important;
    max-height: 100% !important;
    object-fit: contain !important;
    width: auto !important; /* Allow aspect ratio to determine width */
    height: auto !important; /* Allow aspect ratio to determine height */
}

/* Removed forced rotation logic to support vertical display */
.wx-touch-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: #000;
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
}

.emulator-stage {
    width: 100%;
    height: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
}

/* Deep selector to force the canvas to fit */
:global(#emulator-stage canvas) {
    max-width: 100% !important;
    max-height: 100% !important;
    object-fit: contain !important;
    width: auto !important;
    height: auto !important;
}

.loading-overlay, .error-overlay {
    position: fixed; /* Use fixed for overlays too */
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #212529;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: #fff;
    z-index: 10000; /* Ensure on top of everything */
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #fff;
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 1rem;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.loading-text {
    font-size: 1rem;
    font-family: sans-serif;
}

.back-btn {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    border: 1px solid #fff;
    color: #fff;
    text-decoration: none;
    border-radius: 4px;
}
</style>
